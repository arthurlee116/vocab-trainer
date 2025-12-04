/**
 * Property-based tests for usePracticeStore retry functionality
 * Tests Properties 4, 5, and 7 from the design document
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { usePracticeStore } from '../usePracticeStore';
import type { SuperQuestion, QuestionType, AnswerRecord, AnalysisSummary } from '../../types';

// Reset store before each test
beforeEach(() => {
  usePracticeStore.setState({
    words: [],
    images: [],
    answers: [],
    status: 'idle',
    sectionStatus: {
      questions_type_1: 'pending',
      questions_type_2: 'pending',
      questions_type_3: 'pending',
    },
    sectionErrors: {
      questions_type_1: undefined,
      questions_type_2: undefined,
      questions_type_3: undefined,
    },
    detailsStatus: 'idle',
    isRetryMode: false,
    retryQuestions: [],
    retryAnswers: [],
    originalLastResult: undefined,
    superJson: undefined,
    lastResult: undefined,
  });
});

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating a SuperQuestion
const superQuestionArb: fc.Arbitrary<SuperQuestion> = fc.record({
  id: idArb,
  word: fc.string({ minLength: 1, maxLength: 20 }),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  choices: fc.array(
    fc.record({
      id: idArb,
      text: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 2, maxLength: 4 }
  ),
  correctChoiceId: idArb,
  explanation: fc.string({ minLength: 0, maxLength: 200 }),
  type: fc.constantFrom('questions_type_1', 'questions_type_2', 'questions_type_3') as fc.Arbitrary<QuestionType>,
  hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

// Arbitrary for generating an AnswerRecord
const answerRecordArb: fc.Arbitrary<AnswerRecord> = fc.record({
  questionId: idArb,
  choiceId: fc.option(idArb, { nil: undefined }),
  userInput: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  correct: fc.boolean(),
  elapsedMs: fc.integer({ min: 100, max: 30000 }),
});

// Arbitrary for generating an AnalysisSummary
const analysisSummaryArb: fc.Arbitrary<AnalysisSummary> = fc.record({
  report: fc.string({ minLength: 1, maxLength: 500 }),
  recommendations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
});

// Arbitrary for generating a lastResult
const lastResultArb = fc.record({
  score: fc.integer({ min: 0, max: 100 }),
  analysis: analysisSummaryArb,
  incorrectWords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  snapshot: fc.constant(undefined),
});

describe('usePracticeStore Retry - Property Tests', () => {
  /**
   * **Feature: quiz-wrong-review, Property 4: Retry questions isolation**
   * **Validates: Requirements 2.3, 2.5, 4.1**
   *
   * For any retry practice session, the retryQuestions array SHALL contain
   * exactly the questions that were answered incorrectly, and the original
   * superJson SHALL remain unchanged.
   */
  describe('Property 4: Retry questions isolation', () => {
    it('startRetryPractice should set retryQuestions without modifying superJson', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          (wrongQuestions) => {
            // Setup: create a mock superJson in the store
            const mockSuperJson = {
              metadata: {
                totalQuestions: 15,
                words: ['test', 'word'],
                difficulty: 'intermediate' as const,
                generatedAt: new Date().toISOString(),
              },
              questions_type_1: [{ id: 'original-1', word: 'original', prompt: 'test', explanation: '', type: 'questions_type_1' as QuestionType }],
              questions_type_2: [],
              questions_type_3: [],
            };

            usePracticeStore.setState({ superJson: mockSuperJson });
            const superJsonBefore = JSON.stringify(usePracticeStore.getState().superJson);

            // Action: start retry practice
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            const state = usePracticeStore.getState();

            // Property: retryQuestions contains exactly the wrong questions
            expect(state.retryQuestions).toEqual(wrongQuestions);
            expect(state.retryQuestions.length).toBe(wrongQuestions.length);

            // Property: superJson remains unchanged
            expect(JSON.stringify(state.superJson)).toBe(superJsonBefore);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('retryQuestions should be independent from original answers', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          fc.array(answerRecordArb, { minLength: 0, maxLength: 10 }),
          (wrongQuestions, originalAnswers) => {
            // Setup: set original answers
            usePracticeStore.setState({ answers: originalAnswers });
            const answersBefore = [...usePracticeStore.getState().answers];

            // Action: start retry practice
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            const state = usePracticeStore.getState();

            // Property: original answers remain unchanged
            expect(state.answers).toEqual(answersBefore);

            // Property: retryAnswers is cleared
            expect(state.retryAnswers).toEqual([]);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: quiz-wrong-review, Property 5: Retry mode flag correctness**
   * **Validates: Requirements 3.4, 4.4**
   *
   * For any practice session, the isRetryMode flag SHALL be true if and only if
   * the user is currently in a retry practice round.
   */
  describe('Property 5: Retry mode flag correctness', () => {
    it('isRetryMode should be true after startRetryPractice and false initially', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          (wrongQuestions) => {
            // Initial state: isRetryMode should be false
            expect(usePracticeStore.getState().isRetryMode).toBe(false);

            // Action: start retry practice
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            // Property: isRetryMode should be true after starting retry
            expect(usePracticeStore.getState().isRetryMode).toBe(true);

            // Reset for next iteration
            usePracticeStore.setState({ isRetryMode: false, retryQuestions: [], retryAnswers: [] });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('isRetryMode should be false after exitRetryMode', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          lastResultArb,
          (wrongQuestions, originalResult) => {
            // Setup: start retry practice with original result
            usePracticeStore.setState({ lastResult: originalResult });
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            // Verify retry mode is active
            expect(usePracticeStore.getState().isRetryMode).toBe(true);

            // Action: exit retry mode
            usePracticeStore.getState().exitRetryMode();

            // Property: isRetryMode should be false after exiting
            expect(usePracticeStore.getState().isRetryMode).toBe(false);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('status should be inProgress when in retry mode', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          (wrongQuestions) => {
            // Setup: set status to report (typical state before retry)
            usePracticeStore.setState({ status: 'report' });

            // Action: start retry practice
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            const state = usePracticeStore.getState();

            // Property: status should be inProgress when in retry mode
            expect(state.isRetryMode).toBe(true);
            expect(state.status).toBe('inProgress');

            // Reset for next iteration
            usePracticeStore.setState({ isRetryMode: false, retryQuestions: [], retryAnswers: [], status: 'idle' });

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: quiz-wrong-review, Property 7: State cleanup on exit**
   * **Validates: Requirements 4.3**
   *
   * For any retry session, when the user exits retry mode, the retry-specific state
   * (retryQuestions, retryAnswers, isRetryMode) SHALL be reset to initial values.
   */
  describe('Property 7: State cleanup on exit', () => {
    it('exitRetryMode should reset all retry-specific state to initial values', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          fc.array(answerRecordArb, { minLength: 1, maxLength: 10 }),
          lastResultArb,
          (wrongQuestions, retryAnswers, originalResult) => {
            // Setup: simulate a retry session in progress
            usePracticeStore.setState({ lastResult: originalResult });
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            // Add some retry answers
            for (const answer of retryAnswers) {
              usePracticeStore.getState().recordRetryAnswer(answer);
            }

            // Verify retry state is populated
            const stateBefore = usePracticeStore.getState();
            expect(stateBefore.isRetryMode).toBe(true);
            expect(stateBefore.retryQuestions.length).toBe(wrongQuestions.length);
            expect(stateBefore.retryAnswers.length).toBe(retryAnswers.length);

            // Action: exit retry mode
            usePracticeStore.getState().exitRetryMode();

            const stateAfter = usePracticeStore.getState();

            // Property: isRetryMode should be false
            expect(stateAfter.isRetryMode).toBe(false);

            // Property: retryQuestions should be empty
            expect(stateAfter.retryQuestions).toEqual([]);

            // Property: retryAnswers should be empty
            expect(stateAfter.retryAnswers).toEqual([]);

            // Property: originalLastResult should be cleared
            expect(stateAfter.originalLastResult).toBeUndefined();

            // Property: lastResult should be restored to original
            expect(stateAfter.lastResult).toEqual(originalResult);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('resetSession should also clear retry state', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          fc.array(answerRecordArb, { minLength: 1, maxLength: 10 }),
          (wrongQuestions, retryAnswers) => {
            // Setup: simulate a retry session in progress
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            // Add some retry answers
            for (const answer of retryAnswers) {
              usePracticeStore.getState().recordRetryAnswer(answer);
            }

            // Action: reset entire session
            usePracticeStore.getState().resetSession();

            const stateAfter = usePracticeStore.getState();

            // Property: all retry state should be cleared
            expect(stateAfter.isRetryMode).toBe(false);
            expect(stateAfter.retryQuestions).toEqual([]);
            expect(stateAfter.retryAnswers).toEqual([]);
            expect(stateAfter.originalLastResult).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('status should be report after exitRetryMode', () => {
      fc.assert(
        fc.property(
          fc.array(superQuestionArb, { minLength: 1, maxLength: 10 }),
          lastResultArb,
          (wrongQuestions, originalResult) => {
            // Setup: start retry practice
            usePracticeStore.setState({ lastResult: originalResult, status: 'report' });
            usePracticeStore.getState().startRetryPractice(wrongQuestions);

            // Verify status is inProgress during retry
            expect(usePracticeStore.getState().status).toBe('inProgress');

            // Action: exit retry mode
            usePracticeStore.getState().exitRetryMode();

            // Property: status should return to report
            expect(usePracticeStore.getState().status).toBe('report');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
