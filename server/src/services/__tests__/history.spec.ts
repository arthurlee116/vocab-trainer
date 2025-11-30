import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerRecord, SuperJson } from '../../types';

const createTestHistory = async (options?: { precreateDir?: boolean }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-history-'));
  const dbDir = path.join(tempDir, 'db');
  const dbPath = path.join(dbDir, 'history.db');
  if (options?.precreateDir) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  process.env.DATABASE_PATH = dbPath;
  vi.resetModules();

  const { db } = await import('../../db/client');
  const history = await import('../history');
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
