/**
 * Property-based tests for QuizPage retry completion re-retry
 * **Feature: quiz-wrong-review, Property 6: Retry completion allows re-retry**
 * **Validates: Requirements 3.3**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { usePracticeStore } from '../../store/usePracticeStore';
import { extractWrongAnswers, getRetryQuestions } from '../../lib/wrongAnswers';
import type { AnswerRecord, SuperJson, SuperQuestion, QuestionType, Choice } from '../../types';

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating a choice
const choiceArb: fc.Arbitrary<Choice> = fc.record({
  id: idArb,
  text: fc.string({ minLength: 1, maxLength: 50 }),
});

// Arbitrary for generating a choice-based question (type 1 or 2)
const choiceQuestionArb = (type: 'questions_type_1' | 'questions_type_2'): fc.Arbitrary<SuperQuestion> =>
  fc.record({
    id: idArb,
    word: fc.string({ minLength: 1, maxLength: 20 }),
    prompt: fc.string({ minLength: 1, maxLength: 100 }),
    choices: fc.array(choiceArb, { minLength: 2, maxLength: 4 }),
    explanation: fc.string({ minLength: 0, maxLength: 200 }),
    type: fc.constant(type),
    hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  }).map((q) => ({
    ...q,
    correctChoiceId: q.choices![0].id,
  }));

// Arbitrary for generating a fill-in-blank question (type 3)
const fillBlankQuestionArb: fc.Arbitrary<SuperQuestion> = fc.record({
  id: idArb,
  word: fc.string({ minLength: 1, maxLength: 20 }),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  correctAnswer: fc.string({ minLength: 1, maxLength: 50 }),
  explanation: fc.string({ minLength: 0, maxLength: 200 }),
  type: fc.constant('questions_type_3' as QuestionType),
  sentence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  translation: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

// Generate a SuperJson with questions of all types
const superJsonArb: fc.Arbitrary<SuperJson> = fc
  .tuple(
    fc.array(choiceQuestionArb('questions_type_1'), { minLength: 1, maxLength: 3 }),
    fc.array(choiceQuestionArb('questions_type_2'), { minLength: 1, maxLength: 3 }),
    fc.array(fillBlankQuestionArb, { minLength: 1, maxLength: 3 })
  )
  .map(([type1, type2, type3]) => ({
    metadata: {
      totalQuestions: type1.length + type2.length + type3.length,
      words: [...new Set([...type1, ...type2, ...type3].map((q) => q.word))],
      difficulty: 'intermediate' as const,
      generatedAt: new Date().toISOString(),
    },
    questions_type_1: type1,
    questions_type_2: type2,
    questions_type_3: type3,
  }));

/**
 * Generate retry answers for a set of retry questions with a specified number of wrong answers
 */
function generateRetryAnswers(
  retryQuestions: SuperQuestion[],
  wrongIndices: Set<number>
): AnswerRecord[] {
  return retryQuestions.map((q, i) => {
    const isWrong = wrongIndices.has(i);
    if (q.type === 'questions_type_3') {
      return {
        questionId: q.id,
        userInput: isWrong ? 'wrong_answer_retry' : q.correctAnswer!,
        correct: !isWrong,
        elapsedMs: 1000,
      };
    } else {
      const wrongChoiceId = q.choices?.find((c) => c.id !== q.correctChoiceId)?.id ?? '';
      return {
        questionId: q.id,
        choiceId: isWrong ? wrongChoiceId : q.correctChoiceId!,
        correct: !isWrong,
        elapsedMs: 1000,
      };
    }
  });
}

describe('QuizPage Retry - Property Tests', () => {
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

  afterEach(() => {
    usePracticeStore.getState().resetSession();
  });

  /**
   * **Feature: quiz-wrong-review, Property 6: Retry completion allows re-retry**
   * **Validates: Requirements 3.3**
   *
   * For any completed retry session with remaining wrong answers, the system SHALL
   * allow starting another retry with only the newly wrong questions.
   */
  describe('Property 6: Retry completion allows re-retry', () => {
    it('should allow re-retry with only newly wrong questions after retry completion', () => {
      fc.assert(
        fc.property(
          superJsonArb,
          fc.integer({ min: 2, max: 9 }), // Initial wrong count (at least 2 to have some for re-retry)
          (superJson, initialWrongCount) => {
            const allQuestions = [
              ...superJson.questions_type_1,
              ...superJson.questions_type_2,
              ...superJson.questions_type_3,
            ];
            const actualInitialWrongCount = Math.min(initialWrongCount, allQuestions.length);

            // Skip if not enough questions for meaningful test
            if (actualInitialWrongCount < 2) return true;

            // Step 1: Simulate initial quiz with some wrong answers
            const initialWrongIndices = new Set(
              Array.from({ length: actualInitialWrongCount }, (_, i) => i)
            );
            const initialAnswers: AnswerRecord[] = allQuestions.map((q, i) => {
              const isWrong = initialWrongIndices.has(i);
              if (q.type === 'questions_type_3') {
                return {
                  questionId: q.id,
                  userInput: isWrong ? 'wrong_answer' : q.correctAnswer!,
                  correct: !isWrong,
                  elapsedMs: 1000,
                };
              } else {
                const wrongChoiceId = q.choices?.find((c) => c.id !== q.correctChoiceId)?.id ?? '';
                return {
                  questionId: q.id,
                  choiceId: isWrong ? wrongChoiceId : q.correctChoiceId!,
                  correct: !isWrong,
                  elapsedMs: 1000,
                };
              }
            });

            // Set up store with initial quiz results
            usePracticeStore.setState({
              superJson,
              answers: initialAnswers,
              lastResult: {
                score: ((allQuestions.length - actualInitialWrongCount) / allQuestions.length) * 100,
                analysis: { report: 'Initial report', recommendations: [] },
                incorrectWords: [],
              },
            });

            // Step 2: Extract wrong answers and start first retry
            const wrongItems = extractWrongAnswers(initialAnswers, superJson);
            const retryQuestions = getRetryQuestions(wrongItems);

            expect(retryQuestions.length).toBe(actualInitialWrongCount);

            usePracticeStore.getState().startRetryPractice(retryQuestions);

            // Verify retry mode is active
            expect(usePracticeStore.getState().isRetryMode).toBe(true);
            expect(usePracticeStore.getState().retryQuestions.length).toBe(actualInitialWrongCount);

            // Step 3: Simulate retry with some still wrong (half of them)
            const retryWrongCount = Math.max(1, Math.floor(actualInitialWrongCount / 2));
            const retryWrongIndices = new Set(
              Array.from({ length: retryWrongCount }, (_, i) => i)
            );
            const retryAnswers = generateRetryAnswers(retryQuestions, retryWrongIndices);

            // Record retry answers
            for (const answer of retryAnswers) {
              usePracticeStore.getState().recordRetryAnswer(answer);
            }

            // Step 4: Complete retry and set retry result
            const retryCorrect = retryAnswers.filter((a) => a.correct).length;
            const retryScore = Math.round((retryCorrect / retryAnswers.length) * 100);

            usePracticeStore.getState().setRetryResult({
              score: retryScore,
              analysis: { report: 'Retry report', recommendations: [] },
              incorrectWords: [],
            });

            // Verify retry result is set
            expect(usePracticeStore.getState().lastResult?.score).toBe(retryScore);

            // Step 5: Extract newly wrong answers for re-retry
            // Build a temporary SuperJson from retry questions for extraction
            const retrySuperJson: SuperJson = {
              metadata: superJson.metadata,
              questions_type_1: retryQuestions.filter((q) => q.type === 'questions_type_1'),
              questions_type_2: retryQuestions.filter((q) => q.type === 'questions_type_2'),
              questions_type_3: retryQuestions.filter((q) => q.type === 'questions_type_3'),
            };

            const newlyWrongItems = extractWrongAnswers(retryAnswers, retrySuperJson);
            const reRetryQuestions = getRetryQuestions(newlyWrongItems);

            // Property: The number of re-retry questions should equal the number of wrong answers in retry
            expect(reRetryQuestions.length).toBe(retryWrongCount);

            // Property: Re-retry questions should be a subset of the original retry questions
            const retryQuestionIds = new Set(retryQuestions.map((q) => q.id));
            for (const q of reRetryQuestions) {
              expect(retryQuestionIds.has(q.id)).toBe(true);
            }

            // Step 6: Verify we can start another retry with the newly wrong questions
            // First exit current retry mode
            usePracticeStore.getState().exitRetryMode();
            expect(usePracticeStore.getState().isRetryMode).toBe(false);

            // Start re-retry
            usePracticeStore.getState().startRetryPractice(reRetryQuestions);

            // Property: Re-retry should be allowed
            expect(usePracticeStore.getState().isRetryMode).toBe(true);
            expect(usePracticeStore.getState().retryQuestions.length).toBe(retryWrongCount);
            expect(usePracticeStore.getState().retryAnswers).toEqual([]);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not allow re-retry when all retry questions are answered correctly', () => {
      fc.assert(
        fc.property(
          superJsonArb,
          fc.integer({ min: 1, max: 9 }),
          (superJson, initialWrongCount) => {
            const allQuestions = [
              ...superJson.questions_type_1,
              ...superJson.questions_type_2,
              ...superJson.questions_type_3,
            ];
            const actualInitialWrongCount = Math.min(initialWrongCount, allQuestions.length);

            // Skip if no questions
            if (actualInitialWrongCount < 1) return true;

            // Simulate initial quiz with some wrong answers
            const initialWrongIndices = new Set(
              Array.from({ length: actualInitialWrongCount }, (_, i) => i)
            );
            const initialAnswers: AnswerRecord[] = allQuestions.map((q, i) => {
              const isWrong = initialWrongIndices.has(i);
              if (q.type === 'questions_type_3') {
                return {
                  questionId: q.id,
                  userInput: isWrong ? 'wrong_answer' : q.correctAnswer!,
                  correct: !isWrong,
                  elapsedMs: 1000,
                };
              } else {
                const wrongChoiceId = q.choices?.find((c) => c.id !== q.correctChoiceId)?.id ?? '';
                return {
                  questionId: q.id,
                  choiceId: isWrong ? wrongChoiceId : q.correctChoiceId!,
                  correct: !isWrong,
                  elapsedMs: 1000,
                };
              }
            });

            usePracticeStore.setState({
              superJson,
              answers: initialAnswers,
              lastResult: {
                score: ((allQuestions.length - actualInitialWrongCount) / allQuestions.length) * 100,
                analysis: { report: 'Initial report', recommendations: [] },
                incorrectWords: [],
              },
            });

            // Start retry with wrong questions
            const wrongItems = extractWrongAnswers(initialAnswers, superJson);
            const retryQuestions = getRetryQuestions(wrongItems);
            usePracticeStore.getState().startRetryPractice(retryQuestions);

            // Answer ALL retry questions correctly
            const retryAnswers = generateRetryAnswers(retryQuestions, new Set()); // Empty set = all correct

            for (const answer of retryAnswers) {
              usePracticeStore.getState().recordRetryAnswer(answer);
            }

            // Complete retry
            usePracticeStore.getState().setRetryResult({
              score: 100,
              analysis: { report: 'Perfect retry!', recommendations: [] },
              incorrectWords: [],
            });

            // Extract newly wrong answers (should be empty)
            const retrySuperJson: SuperJson = {
              metadata: superJson.metadata,
              questions_type_1: retryQuestions.filter((q) => q.type === 'questions_type_1'),
              questions_type_2: retryQuestions.filter((q) => q.type === 'questions_type_2'),
              questions_type_3: retryQuestions.filter((q) => q.type === 'questions_type_3'),
            };

            const newlyWrongItems = extractWrongAnswers(retryAnswers, retrySuperJson);

            // Property: No re-retry questions when all are correct
            expect(newlyWrongItems.length).toBe(0);
            expect(getRetryQuestions(newlyWrongItems).length).toBe(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
