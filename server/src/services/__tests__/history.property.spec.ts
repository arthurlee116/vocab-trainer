import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { AnswerRecord, SuperJson, SessionRecord } from '../../types';

/**
 * Helper to create a test database environment
 */
const createTestHistory = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-history-prop-'));
  const dbDir = path.join(tempDir, 'db');
  const dbPath = path.join(dbDir, 'history.db');
  fs.mkdirSync(dbDir, { recursive: true });
  process.env.DATABASE_PATH = dbPath;
  vi.resetModules();

  const { db } = await import('../../db/client.js');
  const history = await import('../history.js');

  // Create test user
  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at)
     VALUES (@id, @email, @password_hash, @created_at)`
  ).run({
    id: 'test-user',
    email: 'test@example.com',
    password_hash: 'hash',
    created_at: new Date().toISOString(),
  });

  const cleanup = () => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  return { ...history, db, cleanup };
};

/**
 * Generate a valid SuperJson structure
 */
const createSuperJson = (questionCount: number = 3): SuperJson => ({
  metadata: {
    totalQuestions: questionCount,
    words: Array.from({ length: questionCount }, (_, i) => `word${i}`),
    difficulty: 'beginner',
    generatedAt: new Date().toISOString(),
  },
  questions_type_1: Array.from({ length: Math.ceil(questionCount / 3) }, (_, i) => ({
    id: `q1-${i}`,
    word: `word${i}`,
    prompt: `Prompt ${i}`,
    choices: [
      { id: 'c1', text: 'choice1' },
      { id: 'c2', text: 'choice2' },
      { id: 'c3', text: 'choice3' },
      { id: 'c4', text: 'choice4' },
    ],
    correctChoiceId: 'c1',
    explanation: `Explanation ${i}`,
    type: 'questions_type_1' as const,
  })),
  questions_type_2: Array.from({ length: Math.ceil(questionCount / 3) }, (_, i) => ({
    id: `q2-${i}`,
    word: `word${i + Math.ceil(questionCount / 3)}`,
    prompt: `Prompt ${i}`,
    choices: [
      { id: 'c1', text: 'choice1' },
      { id: 'c2', text: 'choice2' },
      { id: 'c3', text: 'choice3' },
      { id: 'c4', text: 'choice4' },
    ],
    correctChoiceId: 'c2',
    explanation: `Explanation ${i}`,
    type: 'questions_type_2' as const,
  })),
  questions_type_3: Array.from({ length: Math.floor(questionCount / 3) }, (_, i) => ({
    id: `q3-${i}`,
    word: `word${i + 2 * Math.ceil(questionCount / 3)}`,
    prompt: `Prompt ${i}`,
    correctAnswer: 'answer',
    explanation: `Explanation ${i}`,
    type: 'questions_type_3' as const,
    sentence: 'This is a _____ sentence.',
    translation: '这是一个句子。',
    hint: 'hint',
  })),
});

/**
 * Arbitrary for generating valid AnswerRecord
 */
const answerRecordArb = fc.record({
  questionId: fc.string({ minLength: 1, maxLength: 20 }),
  choiceId: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  userInput: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
  correct: fc.boolean(),
  elapsedMs: fc.integer({ min: 100, max: 60000 }),
});

/**
 * Arbitrary for generating valid difficulty levels
 */
const difficultyArb = fc.constantFrom('beginner', 'intermediate', 'advanced') as fc.Arbitrary<'beginner' | 'intermediate' | 'advanced'>;

/**
 * Arbitrary for generating valid words arrays
 */
const wordsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 20 }
);

describe('History Service Property Tests', () => {
  /**
   * **Feature: session-resume-fix, Property 2: In-Progress Session Initial State**
   * **Validates: Requirements 2.2, 4.1**
   *
   * For any valid superJson, words array, and difficulty level, the created
   * in-progress session must have status='in_progress', currentQuestionIndex=0,
   * and an empty answers array.
   */
  it('Property 2: In-progress session initial state is correct', async () => {
    const { createInProgressSession, getSession, cleanup } = await createTestHistory();

    try {
      await fc.assert(
        fc.asyncProperty(
          difficultyArb,
          wordsArb,
          fc.integer({ min: 3, max: 15 }),
          async (difficulty, words, questionCount) => {
            // Create a SuperJson with the given parameters
            const superJson = createSuperJson(questionCount);
            // Override metadata with generated values
            superJson.metadata.difficulty = difficulty;
            superJson.metadata.words = words;

            // Create an in-progress session
            const session = createInProgressSession({
              userId: 'test-user',
              mode: 'authenticated',
              difficulty,
              words,
              superJson,
            });

            // Property assertions: initial state must be correct
            expect(session.status).toBe('in_progress');
            expect(session.currentQuestionIndex).toBe(0);
            expect(session.answers).toEqual([]);
            expect(session.score).toBe(0);
            expect(session.analysis).toEqual({ report: '', recommendations: [] });

            // Verify persistence: load from DB and check same properties
            const loaded = getSession('test-user', session.id);
            expect(loaded).not.toBeNull();
            expect(loaded!.status).toBe('in_progress');
            expect(loaded!.currentQuestionIndex).toBe(0);
            expect(loaded!.answers).toEqual([]);
            expect(loaded!.score).toBe(0);
            expect(loaded!.difficulty).toBe(difficulty);
            expect(loaded!.words).toEqual(words);
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      cleanup();
    }
  });

  /**
   * **Feature: session-resume, Property 4: Progress Persistence Round-Trip**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any answer record and question index, saving progress and then
   * loading the session SHALL return the same answer record and index.
   */
  it('Property 4: Progress persistence round-trip', async () => {
    const { createInProgressSession, updateProgress, getSession, cleanup } = await createTestHistory();

    try {
      await fc.assert(
        fc.asyncProperty(
          answerRecordArb,
          fc.integer({ min: 1, max: 10 }),
          async (answer, newIndex) => {
            // Create an in-progress session with enough questions
            const superJson = createSuperJson(15); // Ensure enough questions
            const session = createInProgressSession({
              userId: 'test-user',
              mode: 'authenticated',
              difficulty: 'beginner',
              words: superJson.metadata.words,
              superJson,
            });

            // Update progress with the answer - convert to match AnswerRecord type
            const answerRecord: AnswerRecord = {
              questionId: answer.questionId,
              ...(answer.choiceId !== undefined && { choiceId: answer.choiceId }),
              ...(answer.userInput !== undefined && { userInput: answer.userInput }),
              correct: answer.correct,
              elapsedMs: answer.elapsedMs,
            };
            const updated = updateProgress('test-user', session.id, answerRecord, newIndex);
            expect(updated).not.toBeNull();

            // Load the session and verify round-trip
            const loaded = getSession('test-user', session.id);
            expect(loaded).not.toBeNull();

            // Verify the answer was persisted correctly
            const answers = loaded!.answers;
            expect(answers).toBeDefined();
            expect(answers.length).toBeGreaterThan(0);
            const lastAnswer = answers[answers.length - 1]!;
            expect(lastAnswer.questionId).toBe(answer.questionId);
            expect(lastAnswer.correct).toBe(answer.correct);
            expect(lastAnswer.elapsedMs).toBe(answer.elapsedMs);

            // Verify the index was persisted correctly
            expect(loaded!.currentQuestionIndex).toBe(newIndex);
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      cleanup();
    }
  });


  /**
   * **Feature: session-resume, Property 5: Status Transition Completeness**
   * **Validates: Requirements 2.4**
   *
   * For any session where currentQuestionIndex equals totalQuestions,
   * the session status SHALL be 'completed'.
   */
  it('Property 5: Status transition to completed when all questions answered', async () => {
    const { createInProgressSession, updateProgress, getSession, cleanup } = await createTestHistory();

    try {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // Total questions
          async (totalQuestions) => {
            // Create a SuperJson with exact number of questions
            const superJson = createSuperJson(totalQuestions);
            const actualTotal =
              superJson.questions_type_1.length +
              superJson.questions_type_2.length +
              superJson.questions_type_3.length;

            const session = createInProgressSession({
              userId: 'test-user',
              mode: 'authenticated',
              difficulty: 'intermediate',
              words: superJson.metadata.words,
              superJson,
            });

            // Verify initial status is in_progress
            expect(session.status).toBe('in_progress');

            // Answer all questions one by one
            let currentSession = session;
            for (let i = 0; i < actualTotal; i++) {
              const answer: AnswerRecord = {
                questionId: `q-${i}`,
                choiceId: 'c1',
                correct: true,
                elapsedMs: 1000,
              };
              const updated = updateProgress('test-user', currentSession.id, answer, i + 1);
              expect(updated).not.toBeNull();
              currentSession = updated!;
            }

            // Verify final status is completed
            const finalSession = getSession('test-user', session.id);
            expect(finalSession).not.toBeNull();
            expect(finalSession!.status).toBe('completed');
            expect(finalSession!.currentQuestionIndex).toBe(actualTotal);
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      cleanup();
    }
  });
});
