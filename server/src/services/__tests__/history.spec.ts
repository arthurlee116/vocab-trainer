import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerRecord, SuperJson, SessionStatus } from '../../types';

const createTestHistory = async (options?: { precreateDir?: boolean }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-history-'));
  const dbDir = path.join(tempDir, 'db');
  const dbPath = path.join(dbDir, 'history.db');
  if (options?.precreateDir) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  process.env.DATABASE_PATH = dbPath;
  vi.resetModules();

  const { db } = await import('../../db/client.js');
  const history = await import('../history.js');
  db
    .prepare(
      `
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (@id, @email, @password_hash, @created_at)
    `,
    )
    .run({
      id: 'tester',
      email: 'tester@example.com',
      password_hash: 'hash',
      created_at: new Date().toISOString(),
    });

  const cleanup = () => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  return { ...history, cleanup };
};

const createSuperJson = (): SuperJson => ({
  metadata: {
    totalQuestions: 3,
    words: ['alpha', 'beta', 'gamma'],
    difficulty: 'beginner',
    generatedAt: new Date().toISOString(),
  },
  questions_type_1: [
    {
      id: 'q1',
      word: 'alpha',
      prompt: '题干 1',
      choices: [
        { id: 'c1', text: 'alpha' },
        { id: 'c2', text: 'beta' },
        { id: 'c3', text: 'gamma' },
        { id: 'c4', text: 'delta' },
      ],
      correctChoiceId: 'c1',
      explanation: '解释 1',
      type: 'questions_type_1',
    },
  ],
  questions_type_2: [],
  questions_type_3: [],
});

const createAnswers = (): AnswerRecord[] => [
  { questionId: 'q1', choiceId: 'c1', correct: true, elapsedMs: 1200 },
];

describe('history service', () => {
  it('保存并读取 session 记录', async () => {
    const { saveSession, getSession, cleanup } = await createTestHistory();

    try {
      const saved = saveSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'intermediate',
        words: ['alpha', 'beta'],
        superJson: createSuperJson(),
        answers: createAnswers(),
        score: 88,
        analysis: { report: 'report', recommendations: ['focus'] },
        status: 'completed',
        currentQuestionIndex: 1,
        hasVocabDetails: false,
      });

      const fetched = getSession('tester', saved.id);
      expect(fetched).not.toBeNull();
      expect(fetched).toMatchObject({
        id: saved.id,
        userId: 'tester',
        words: ['alpha', 'beta'],
        score: 88,
        analysis: { report: 'report', recommendations: ['focus'] },
      });
    } finally {
      cleanup();
    }
  });

  it('按创建时间倒序返回 session 列表', async () => {
    const { saveSession, listSessions, cleanup } = await createTestHistory({ precreateDir: true });
    vi.useFakeTimers();

    try {
      const first = saveSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['one'],
        superJson: createSuperJson(),
        answers: createAnswers(),
        score: 70,
        analysis: { report: 'first', recommendations: [] },
        status: 'completed',
        currentQuestionIndex: 1,
        hasVocabDetails: false,
      });

      vi.advanceTimersByTime(1000);

      const second = saveSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['two'],
        superJson: createSuperJson(),
        answers: createAnswers(),
        score: 95,
        analysis: { report: 'second', recommendations: ['repeat'] },
        status: 'completed',
        currentQuestionIndex: 1,
        hasVocabDetails: false,
      });

      const sessions = listSessions('tester');
      expect(sessions.map((session) => session.id)).toEqual([second.id, first.id]);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('获取不存在的记录时返回 null', async () => {
    const { getSession, cleanup } = await createTestHistory();
    try {
      expect(getSession('tester', 'missing')).toBeNull();
    } finally {
      cleanup();
    }
  });
});

/**
 * Integration tests for new API endpoints
 * Requirements: 2.1, 4.1, 4.4
 */
describe('history service - progress and session management', () => {
  it('updateProgress 保存答题进度并更新索引', async () => {
    const { createInProgressSession, updateProgress, getSession, cleanup } = await createTestHistory();

    try {
      // Create a SuperJson with multiple questions so status stays in_progress
      const superJsonWithMultipleQuestions: SuperJson = {
        ...createSuperJson(),
        questions_type_1: [
          {
            id: 'q1',
            word: 'alpha',
            prompt: '题干 1',
            choices: [
              { id: 'c1', text: 'alpha' },
              { id: 'c2', text: 'beta' },
            ],
            correctChoiceId: 'c1',
            explanation: '解释 1',
            type: 'questions_type_1',
          },
          {
            id: 'q2',
            word: 'beta',
            prompt: '题干 2',
            choices: [
              { id: 'c1', text: 'alpha' },
              { id: 'c2', text: 'beta' },
            ],
            correctChoiceId: 'c2',
            explanation: '解释 2',
            type: 'questions_type_1',
          },
          {
            id: 'q3',
            word: 'gamma',
            prompt: '题干 3',
            choices: [
              { id: 'c1', text: 'gamma' },
              { id: 'c2', text: 'delta' },
            ],
            correctChoiceId: 'c1',
            explanation: '解释 3',
            type: 'questions_type_1',
          },
        ],
      };

      // Create an in-progress session with 3 questions
      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha', 'beta', 'gamma'],
        superJson: superJsonWithMultipleQuestions,
        hasVocabDetails: false,
      });

      expect(session.status).toBe('in_progress');
      expect(session.currentQuestionIndex).toBe(0);
      expect(session.answers).toHaveLength(0);

      // Update progress with first answer (1 of 3 questions)
      const answer: AnswerRecord = {
        questionId: 'q1',
        choiceId: 'c1',
        correct: true,
        elapsedMs: 1500,
      };
      const updated = updateProgress('tester', session.id, answer, 1);

      expect(updated).not.toBeNull();
      expect(updated!.currentQuestionIndex).toBe(1);
      expect(updated!.answers).toHaveLength(1);
      expect(updated!.answers[0]).toMatchObject(answer);
      expect(updated!.status).toBe('in_progress'); // Still in progress (1/3)

      // Verify persistence
      const fetched = getSession('tester', session.id);
      expect(fetched!.currentQuestionIndex).toBe(1);
      expect(fetched!.answers).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('updateProgress 在完成所有题目时自动转换状态为 completed', async () => {
    const { createInProgressSession, updateProgress, getSession, cleanup } = await createTestHistory();

    try {
      const superJson = createSuperJson();
      const totalQuestions = superJson.questions_type_1.length;

      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson,
        hasVocabDetails: false,
      });

      // Answer the only question (totalQuestions = 1)
      const answer: AnswerRecord = {
        questionId: 'q1',
        choiceId: 'c1',
        correct: true,
        elapsedMs: 1000,
      };
      const updated = updateProgress('tester', session.id, answer, totalQuestions);

      expect(updated!.status).toBe('completed');
      expect(updated!.score).toBe(100); // 1/1 correct = 100%

      const fetched = getSession('tester', session.id);
      expect(fetched!.status).toBe('completed');
    } finally {
      cleanup();
    }
  });

  it('updateProgress 对不存在的 session 返回 null', async () => {
    const { updateProgress, cleanup } = await createTestHistory();

    try {
      const answer: AnswerRecord = {
        questionId: 'q1',
        choiceId: 'c1',
        correct: true,
        elapsedMs: 1000,
      };
      const result = updateProgress('tester', 'non-existent-id', answer, 1);
      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('deleteSession 删除用户拥有的 session', async () => {
    const { createInProgressSession, deleteSession, getSession, cleanup } = await createTestHistory();

    try {
      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson: createSuperJson(),
        hasVocabDetails: false,
      });

      // Verify session exists
      expect(getSession('tester', session.id)).not.toBeNull();

      // Delete session
      const deleted = deleteSession('tester', session.id);
      expect(deleted).toBe(true);

      // Verify session is gone
      expect(getSession('tester', session.id)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('deleteSession 对不存在的 session 返回 false', async () => {
    const { deleteSession, cleanup } = await createTestHistory();

    try {
      const deleted = deleteSession('tester', 'non-existent-id');
      expect(deleted).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('deleteSession 不能删除其他用户的 session', async () => {
    const { createInProgressSession, deleteSession, getSession, cleanup } = await createTestHistory();

    try {
      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson: createSuperJson(),
        hasVocabDetails: false,
      });

      // Try to delete with wrong user ID
      const deleted = deleteSession('other-user', session.id);
      expect(deleted).toBe(false);

      // Verify session still exists
      expect(getSession('tester', session.id)).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it('createInProgressSession 正确存储 hasVocabDetails 为 true', async () => {
    const { createInProgressSession, getSession, cleanup } = await createTestHistory();

    try {
      const vocabDetails = [
        {
          word: 'alpha',
          partsOfSpeech: ['noun'],
          definitions: ['第一个希腊字母'],
          examples: [{ en: 'Alpha is the first letter.', zh: 'Alpha 是第一个字母。' }],
        },
      ];

      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson: createSuperJson(),
        hasVocabDetails: true,
        vocabDetails,
      });

      expect(session.hasVocabDetails).toBe(true);
      expect(session.vocabDetails).toEqual(vocabDetails);

      // Verify persistence
      const fetched = getSession('tester', session.id);
      expect(fetched!.hasVocabDetails).toBe(true);
      expect(fetched!.vocabDetails).toEqual(vocabDetails);
    } finally {
      cleanup();
    }
  });

  it('createInProgressSession 正确存储 hasVocabDetails 为 false', async () => {
    const { createInProgressSession, getSession, cleanup } = await createTestHistory();

    try {
      const session = createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson: createSuperJson(),
        hasVocabDetails: false,
      });

      expect(session.hasVocabDetails).toBe(false);
      expect(session.vocabDetails).toBeUndefined();

      // Verify persistence
      const fetched = getSession('tester', session.id);
      expect(fetched!.hasVocabDetails).toBe(false);
      expect(fetched!.vocabDetails).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('saveSession 正确存储和读取 vocabDetails', async () => {
    const { saveSession, getSession, cleanup } = await createTestHistory();

    try {
      const vocabDetails = [
        {
          word: 'beta',
          partsOfSpeech: ['noun', 'adjective'],
          definitions: ['第二个希腊字母', '测试版'],
          examples: [
            { en: 'Beta version is not stable.', zh: '测试版不稳定。' },
            { en: 'Beta is the second letter.', zh: 'Beta 是第二个字母。' },
          ],
        },
        {
          word: 'gamma',
          partsOfSpeech: ['noun'],
          definitions: ['第三个希腊字母'],
          examples: [{ en: 'Gamma rays are dangerous.', zh: '伽马射线是危险的。' }],
        },
      ];

      const saved = saveSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'intermediate',
        words: ['beta', 'gamma'],
        superJson: createSuperJson(),
        answers: createAnswers(),
        score: 90,
        analysis: { report: 'good', recommendations: [] },
        status: 'completed',
        currentQuestionIndex: 1,
        hasVocabDetails: true,
        vocabDetails,
      });

      expect(saved.hasVocabDetails).toBe(true);
      expect(saved.vocabDetails).toEqual(vocabDetails);

      // Verify persistence
      const fetched = getSession('tester', saved.id);
      expect(fetched!.hasVocabDetails).toBe(true);
      expect(fetched!.vocabDetails).toEqual(vocabDetails);
    } finally {
      cleanup();
    }
  });

  it('listSessions 支持按 status 筛选', async () => {
    const { createInProgressSession, saveSession, listSessions, cleanup } = await createTestHistory();

    try {
      // Create an in-progress session
      createInProgressSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'beginner',
        words: ['alpha'],
        superJson: createSuperJson(),
        hasVocabDetails: false,
      });

      // Create a completed session
      saveSession({
        userId: 'tester',
        mode: 'authenticated',
        difficulty: 'intermediate',
        words: ['beta'],
        superJson: createSuperJson(),
        answers: createAnswers(),
        score: 100,
        analysis: { report: 'done', recommendations: [] },
        status: 'completed',
        currentQuestionIndex: 1,
        hasVocabDetails: false,
      });

      // List all sessions
      const allSessions = listSessions('tester');
      expect(allSessions).toHaveLength(2);

      // List only in-progress sessions
      const inProgressSessions = listSessions('tester', 'in_progress');
      expect(inProgressSessions).toHaveLength(1);
      expect(inProgressSessions[0]?.status).toBe('in_progress');

      // List only completed sessions
      const completedSessions = listSessions('tester', 'completed');
      expect(completedSessions).toHaveLength(1);
      expect(completedSessions[0]?.status).toBe('completed');
    } finally {
      cleanup();
    }
  });
});
