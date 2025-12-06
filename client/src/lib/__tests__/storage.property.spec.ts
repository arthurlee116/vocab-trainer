/**
 * Property-based tests for guest progress persistence
 * **Feature: session-resume, Property 4: Progress Persistence Round-Trip (Guest)**
 * **Validates: Requirements 2.2**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  saveGuestSession,
  loadGuestHistory,
  updateGuestProgress,
  getGuestInProgressSessions,
  deleteGuestSession,
} from '../storage';
import type { AnswerRecord, SuperJson, SuperQuestion, Choice, DifficultyLevel } from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Arbitraries for generating test data
const idArb = fc.uuid();

const choiceArb: fc.Arbitrary<Choice> = fc.record({
  id: idArb,
  text: fc.string({ minLength: 1, maxLength: 50 }),
});

const difficultyArb: fc.Arbitrary<DifficultyLevel> = fc.constantFrom('beginner', 'intermediate', 'advanced');

const choiceQuestionArb = (type: 'questions_type_1' | 'questions_type_2'): fc.Arbitrary<SuperQuestion> =>
  fc.record({
    id: idArb,
    word: fc.string({ minLength: 1, maxLength: 20 }),
    prompt: fc.string({ minLength: 1, maxLength: 100 }),
    choices: fc.array(choiceArb, { minLength: 2, maxLength: 4 }),
    explanation: fc.string({ minLength: 0, maxLength: 200 }),
    type: fc.constant(type),
  }).map((q) => ({
    ...q,
    correctChoiceId: q.choices![0].id,
  }));


const fillBlankQuestionArb: fc.Arbitrary<SuperQuestion> = fc.record({
  id: idArb,
  word: fc.string({ minLength: 1, maxLength: 20 }),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  correctAnswer: fc.string({ minLength: 1, maxLength: 50 }),
  explanation: fc.string({ minLength: 0, maxLength: 200 }),
  type: fc.constant('questions_type_3' as const),
  sentence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  translation: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
});

// Generate a SuperJson with questions of all types
const superJsonArb: fc.Arbitrary<SuperJson> = fc
  .tuple(
    fc.array(choiceQuestionArb('questions_type_1'), { minLength: 1, maxLength: 3 }),
    fc.array(choiceQuestionArb('questions_type_2'), { minLength: 1, maxLength: 3 }),
    fc.array(fillBlankQuestionArb, { minLength: 1, maxLength: 3 }),
    difficultyArb
  )
  .map(([type1, type2, type3, difficulty]) => ({
    metadata: {
      totalQuestions: type1.length + type2.length + type3.length,
      words: [...new Set([...type1, ...type2, ...type3].map((q) => q.word))],
      difficulty,
      generatedAt: new Date().toISOString(),
    },
    questions_type_1: type1,
    questions_type_2: type2,
    questions_type_3: type3,
  }));

// Generate an answer record
const answerRecordArb: fc.Arbitrary<AnswerRecord> = fc.record({
  questionId: idArb,
  choiceId: fc.option(idArb, { nil: undefined }),
  userInput: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  correct: fc.boolean(),
  elapsedMs: fc.integer({ min: 100, max: 30000 }),
});



describe('Guest Progress Persistence - Property Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  /**
   * Property 4: Progress Persistence Round-Trip (Guest)
   * For any answer record and question index, saving progress and then loading
   * the session SHALL return the same answer record and index.
   * **Validates: Requirements 2.2**
   */
  it('should persist and retrieve progress correctly (round-trip)', () => {
    fc.assert(
      fc.property(
        superJsonArb,
        answerRecordArb,
        fc.integer({ min: 1, max: 10 }),
        (superJson, answer, newIndex) => {
          // Clear localStorage before each property iteration
          localStorageMock.clear();
          
          // Create an in-progress session
          const session = saveGuestSession({
            difficulty: superJson.metadata.difficulty,
            words: superJson.metadata.words,
            score: 0,
            analysis: { report: '', recommendations: [] },
            superJson,
            answers: [],
            status: 'in_progress',
            currentQuestionIndex: 0,
          });

          expect(session).toBeDefined();
          if (!session) return;

          // Update progress with the answer
          const clampedIndex = Math.min(newIndex, superJson.metadata.totalQuestions);
          const updated = updateGuestProgress(session.id, answer, clampedIndex);

          expect(updated).toBeDefined();
          if (!updated) return;

          // Load and verify
          const history = loadGuestHistory();
          const loaded = history.find((s) => s.id === session.id);

          expect(loaded).toBeDefined();
          if (!loaded) return;

          // Property: answer is persisted correctly
          expect(loaded.answers).toHaveLength(1);
          expect(loaded.answers[0].questionId).toBe(answer.questionId);
          expect(loaded.answers[0].correct).toBe(answer.correct);
          expect(loaded.answers[0].elapsedMs).toBe(answer.elapsedMs);

          // Property: index is persisted correctly
          expect(loaded.currentQuestionIndex).toBe(clampedIndex);

          // Property: updatedAt is set
          expect(loaded.updatedAt).toBeDefined();
          expect(new Date(loaded.updatedAt).getTime()).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 5: Status Transition Completeness
   * For any session where currentQuestionIndex equals totalQuestions,
   * the session status SHALL be 'completed'.
   * **Validates: Requirements 2.4**
   */
  it('should auto-transition to completed when all questions answered', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        // Clear localStorage before each property iteration
        localStorageMock.clear();
        
        const totalQuestions = superJson.metadata.totalQuestions;
        
        // Create an in-progress session
        const session = saveGuestSession({
          difficulty: superJson.metadata.difficulty,
          words: superJson.metadata.words,
          score: 0,
          analysis: { report: '', recommendations: [] },
          superJson,
          answers: [],
          status: 'in_progress',
          currentQuestionIndex: 0,
        });

        expect(session).toBeDefined();
        if (!session) return;

        // Simulate answering all questions
        let currentSession = session;
        for (let i = 0; i < totalQuestions; i++) {
          const answer: AnswerRecord = {
            questionId: `q-${i}`,
            correct: Math.random() > 0.5,
            elapsedMs: 1000,
          };
          const updated = updateGuestProgress(currentSession.id, answer, i + 1);
          expect(updated).toBeDefined();
          if (updated) currentSession = updated;
        }

        // Property: status should be 'completed' when index equals total
        expect(currentSession.currentQuestionIndex).toBe(totalQuestions);
        expect(currentSession.status).toBe('completed');
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Test: getGuestInProgressSessions returns only in-progress sessions
   */
  it('should filter and return only in-progress sessions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }).chain((count) =>
          fc.tuple(
            fc.array(superJsonArb, { minLength: count, maxLength: count }),
            fc.array(fc.boolean(), { minLength: count, maxLength: count })
          )
        ),
        ([superJsons, completedFlags]) => {
          // Clear localStorage before each property iteration
          localStorageMock.clear();
          
          // Track expected in-progress count
          let expectedInProgressCount = 0;
          
          // Create sessions with mixed statuses
          superJsons.forEach((superJson, i) => {
            const isCompleted = completedFlags[i];
            if (!isCompleted) expectedInProgressCount++;
            
            saveGuestSession({
              difficulty: superJson.metadata.difficulty,
              words: superJson.metadata.words,
              score: isCompleted ? 85 : 0,
              analysis: { report: '', recommendations: [] },
              superJson,
              answers: [],
              status: isCompleted ? 'completed' : 'in_progress',
              currentQuestionIndex: isCompleted ? superJson.metadata.totalQuestions : 0,
            });
          });

          const inProgressSessions = getGuestInProgressSessions();

          // Property: count matches expected in-progress sessions
          expect(inProgressSessions.length).toBe(expectedInProgressCount);

          // Property: all returned sessions have correct summary fields
          for (const summary of inProgressSessions) {
            expect(summary.id).toBeDefined();
            expect(summary.difficulty).toBeDefined();
            expect(summary.wordCount).toBeGreaterThan(0);
            expect(summary.totalQuestions).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Test: deleteGuestSession removes session correctly
   */
  it('should delete session and return true, or return false if not found', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        // Clear localStorage before each property iteration
        localStorageMock.clear();
        
        // Create a session
        const session = saveGuestSession({
          difficulty: superJson.metadata.difficulty,
          words: superJson.metadata.words,
          score: 0,
          analysis: { report: '', recommendations: [] },
          superJson,
          answers: [],
          status: 'in_progress',
          currentQuestionIndex: 0,
        });

        expect(session).toBeDefined();
        if (!session) return;

        // Verify session exists
        let history = loadGuestHistory();
        expect(history.some((s) => s.id === session.id)).toBe(true);

        // Delete session
        const deleted = deleteGuestSession(session.id);
        expect(deleted).toBe(true);

        // Verify session is removed
        history = loadGuestHistory();
        expect(history.some((s) => s.id === session.id)).toBe(false);

        // Deleting again should return false
        const deletedAgain = deleteGuestSession(session.id);
        expect(deletedAgain).toBe(false);
      }),
      { numRuns: 30 }
    );
  });
});
