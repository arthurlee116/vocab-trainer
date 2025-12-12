/**
 * Property-based tests for ReportPage retry button state
 * **Feature: quiz-wrong-review, Property 3: Retry button state correctness**
 * **Validates: Requirements 2.1, 2.2**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportPage from '../ReportPage';
import { usePracticeStore } from '../../store/usePracticeStore';
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

// Generate answers for a SuperJson with a specified number of wrong answers
const answersWithWrongCountArb = (
  superJson: SuperJson,
  wrongCount: number
): fc.Arbitrary<AnswerRecord[]> => {
  const allQuestions = [
    ...superJson.questions_type_1,
    ...superJson.questions_type_2,
    ...superJson.questions_type_3,
  ];

  const totalQuestions = allQuestions.length;
  const actualWrongCount = Math.min(wrongCount, totalQuestions);

  // Create a shuffled array of indices to determine which are wrong
  return fc.shuffledSubarray(
    Array.from({ length: totalQuestions }, (_, i) => i),
    { minLength: totalQuestions, maxLength: totalQuestions }
  ).map((shuffledIndices) => {
    const wrongIndices = new Set(shuffledIndices.slice(0, actualWrongCount));

    return allQuestions.map((q, i) => {
      const isWrong = wrongIndices.has(i);
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
  });
};

const renderReportPage = () => {
  cleanup(); // Clean up any previous renders
  return render(
    <MemoryRouter>
      <ReportPage />
    </MemoryRouter>
  );
};

describe('ReportPage - Property Tests', () => {
  beforeEach(() => {
    act(() => {
      usePracticeStore.setState({
        isRetryMode: false,
        retryQuestions: [],
        retryAnswers: [],
        originalLastResult: undefined,
      });
    });
  });

  afterEach(() => {
    act(() => {
      usePracticeStore.getState().resetSession();
    });
  });

  /**
   * Property 3: Retry button state correctness
   * For any quiz result, the "重练错题" button SHALL be enabled if and only if
   * there exists at least one wrong answer in the session.
   */
  it('should enable retry button if and only if wrong answers exist', () => {
    fc.assert(
      fc.property(
        superJsonArb,
        fc.integer({ min: 0, max: 9 }), // wrongCount (max 9 = 3 questions per type)
        fc.integer({ min: 0, max: 1000000 }), // seed for deterministic shuffle
        (superJson, wrongCount, seed) => {
          const allQuestions = [
            ...superJson.questions_type_1,
            ...superJson.questions_type_2,
            ...superJson.questions_type_3,
          ];
          const actualWrongCount = Math.min(wrongCount, allQuestions.length);

          // Deterministically generate wrong indices using seed
          const indices = Array.from({ length: allQuestions.length }, (_, i) => i);
          // Simple seeded shuffle
          const shuffled = [...indices].sort((a, b) => {
            const hashA = (seed * (a + 1) * 31) % 1000;
            const hashB = (seed * (b + 1) * 31) % 1000;
            return hashA - hashB;
          });
          const wrongIndices = new Set(shuffled.slice(0, actualWrongCount));

          const answers = allQuestions.map((q, i) => {
            const isWrong = wrongIndices.has(i);
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

          // Set up store state
          act(() => {
            usePracticeStore.setState({
              superJson,
              answers,
              lastResult: {
                score: ((allQuestions.length - actualWrongCount) / allQuestions.length) * 100,
                analysis: {
                  report: 'Test report',
                  recommendations: ['Recommendation 1'],
                },
                incorrectWords: [],
              },
              isRetryMode: false,
            });
          });

          renderReportPage();

          const retryButton = screen.getByRole('button', { name: '重练错题' });
          const hasWrongAnswers = actualWrongCount > 0;

          // Property: button disabled state matches absence of wrong answers
          if (hasWrongAnswers) {
            expect(retryButton).not.toBeDisabled();
          } else {
            expect(retryButton).toBeDisabled();
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);

  /**
   * Property 3 (continued): Button should be disabled when all answers are correct
   */
  it('should disable retry button when all answers are correct', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        const allQuestions = [
          ...superJson.questions_type_1,
          ...superJson.questions_type_2,
          ...superJson.questions_type_3,
        ];

        // All correct answers
        const answers = allQuestions.map((q) => {
          if (q.type === 'questions_type_3') {
            return {
              questionId: q.id,
              userInput: q.correctAnswer!,
              correct: true,
              elapsedMs: 1000,
            };
          } else {
            return {
              questionId: q.id,
              choiceId: q.correctChoiceId!,
              correct: true,
              elapsedMs: 1000,
            };
          }
        });

        act(() => {
          usePracticeStore.setState({
            superJson,
            answers,
            lastResult: {
              score: 100,
              analysis: {
                report: 'Perfect score!',
                recommendations: [],
              },
              incorrectWords: [],
            },
            isRetryMode: false,
          });
        });

        renderReportPage();

        const retryButton = screen.getByRole('button', { name: '重练错题' });
        expect(retryButton).toBeDisabled();
      }),
      { numRuns: 50 }
    );
  }, 15000);

  /**
   * Property 3 (continued): Button should be enabled when at least one answer is wrong
   */
  it('should enable retry button when at least one answer is wrong', () => {
    fc.assert(
      fc.property(
        superJsonArb,
        fc.integer({ min: 1, max: 9 }), // At least 1 wrong
        fc.integer({ min: 0, max: 1000000 }), // seed for deterministic shuffle
        (superJson, wrongCount, seed) => {
          const allQuestions = [
            ...superJson.questions_type_1,
            ...superJson.questions_type_2,
            ...superJson.questions_type_3,
          ];
          const actualWrongCount = Math.min(wrongCount, allQuestions.length);

          // Deterministically generate wrong indices using seed
          const indices = Array.from({ length: allQuestions.length }, (_, i) => i);
          const shuffled = [...indices].sort((a, b) => {
            const hashA = (seed * (a + 1) * 31) % 1000;
            const hashB = (seed * (b + 1) * 31) % 1000;
            return hashA - hashB;
          });
          const wrongIndices = new Set(shuffled.slice(0, actualWrongCount));

          const answers = allQuestions.map((q, i) => {
            const isWrong = wrongIndices.has(i);
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

          act(() => {
            usePracticeStore.setState({
              superJson,
              answers,
              lastResult: {
                score: ((allQuestions.length - actualWrongCount) / allQuestions.length) * 100,
                analysis: {
                  report: 'Test report',
                  recommendations: ['Study more'],
                },
                incorrectWords: [],
              },
              isRetryMode: false,
            });
          });

          renderReportPage();

          const retryButton = screen.getByRole('button', { name: '重练错题' });
          expect(retryButton).not.toBeDisabled();
        }
      ),
      { numRuns: 50 }
    );
  }, 15000);
});
