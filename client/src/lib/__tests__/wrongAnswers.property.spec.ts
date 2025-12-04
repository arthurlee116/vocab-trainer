/**
 * Property-based tests for wrongAnswers utility functions
 * **Feature: quiz-wrong-review, Property 1: Wrong answers display completeness**
 * **Validates: Requirements 1.1, 1.3, 1.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractWrongAnswers } from '../wrongAnswers';
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
    correctChoiceId: q.choices![0].id, // First choice is always correct
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
    fc.array(choiceQuestionArb('questions_type_1'), { minLength: 1, maxLength: 5 }),
    fc.array(choiceQuestionArb('questions_type_2'), { minLength: 1, maxLength: 5 }),
    fc.array(fillBlankQuestionArb, { minLength: 1, maxLength: 5 })
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

// Generate an answer record for a given question
const answerForQuestionArb = (question: SuperQuestion, correct: boolean): fc.Arbitrary<AnswerRecord> => {
  if (question.type === 'questions_type_3') {
    // Fill-in-blank question
    const userInput = correct
      ? fc.constant(question.correctAnswer!)
      : fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s !== question.correctAnswer);
    return fc.record({
      questionId: fc.constant(question.id),
      userInput,
      correct: fc.constant(correct),
      elapsedMs: fc.integer({ min: 100, max: 30000 }),
    });
  } else {
    // Choice-based question
    const choiceId = correct
      ? fc.constant(question.correctChoiceId!)
      : fc.constantFrom(...(question.choices?.filter((c) => c.id !== question.correctChoiceId).map((c) => c.id) ?? []));
    return fc.record({
      questionId: fc.constant(question.id),
      choiceId,
      correct: fc.constant(correct),
      elapsedMs: fc.integer({ min: 100, max: 30000 }),
    });
  }
};

describe('extractWrongAnswers - Property Tests', () => {
  /**
   * Property 1: Wrong answers display completeness
   * For any quiz session with wrong answers, extractWrongAnswers SHALL return
   * all and only the questions where the user's answer was incorrect.
   */
  it('should return exactly the wrong answers from the answer records', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        const allQuestions = [
          ...superJson.questions_type_1,
          ...superJson.questions_type_2,
          ...superJson.questions_type_3,
        ];

        // Generate a mix of correct and wrong answers
        return fc.assert(
          fc.property(
            fc.array(fc.boolean(), { minLength: allQuestions.length, maxLength: allQuestions.length }),
            (correctFlags) => {
              // Build answers based on correctFlags
              const answers: AnswerRecord[] = allQuestions.map((q, i) => {
                const isCorrect = correctFlags[i];
                if (q.type === 'questions_type_3') {
                  return {
                    questionId: q.id,
                    userInput: isCorrect ? q.correctAnswer! : 'wrong_answer_' + i,
                    correct: isCorrect,
                    elapsedMs: 1000,
                  };
                } else {
                  const wrongChoiceId = q.choices?.find((c) => c.id !== q.correctChoiceId)?.id ?? '';
                  return {
                    questionId: q.id,
                    choiceId: isCorrect ? q.correctChoiceId! : wrongChoiceId,
                    correct: isCorrect,
                    elapsedMs: 1000,
                  };
                }
              });

              const wrongItems = extractWrongAnswers(answers, superJson);
              const expectedWrongCount = correctFlags.filter((c) => !c).length;

              // Property: count matches
              expect(wrongItems.length).toBe(expectedWrongCount);

              // Property: all returned items are actually wrong
              for (const item of wrongItems) {
                const answer = answers.find((a) => a.questionId === item.question.id);
                expect(answer?.correct).toBe(false);
              }

              // Property: all wrong answers are included
              const wrongQuestionIds = new Set(wrongItems.map((item) => item.question.id));
              for (const answer of answers) {
                if (!answer.correct) {
                  expect(wrongQuestionIds.has(answer.questionId)).toBe(true);
                }
              }
            }
          ),
          { numRuns: 10 } // Inner property runs
        );
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1 (continued): For choice-based questions, display both correct and user's choice text
   */
  it('should display correct choice text for choice-based questions', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        const choiceQuestions = [
          ...superJson.questions_type_1,
          ...superJson.questions_type_2,
        ];

        if (choiceQuestions.length === 0) return true;

        // Create wrong answers for all choice questions
        const answers: AnswerRecord[] = choiceQuestions.map((q) => {
          const wrongChoice = q.choices?.find((c) => c.id !== q.correctChoiceId);
          return {
            questionId: q.id,
            choiceId: wrongChoice?.id ?? '',
            correct: false,
            elapsedMs: 1000,
          };
        });

        const wrongItems = extractWrongAnswers(answers, superJson);

        for (const item of wrongItems) {
          const question = item.question;
          if (question.type !== 'questions_type_3') {
            // Correct answer should be the text of correctChoiceId
            const correctChoice = question.choices?.find((c) => c.id === question.correctChoiceId);
            expect(item.correctAnswer).toBe(correctChoice?.text ?? '');

            // User answer should be the text of the selected choice
            const answer = answers.find((a) => a.questionId === question.id);
            const userChoice = question.choices?.find((c) => c.id === answer?.choiceId);
            expect(item.userAnswer).toBe(userChoice?.text ?? '');
          }
        }

        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1 (continued): For fill-in-blank questions, display correct answer and user input
   */
  it('should display correct answer and user input for fill-in-blank questions', () => {
    fc.assert(
      fc.property(superJsonArb, (superJson) => {
        const fillBlankQuestions = superJson.questions_type_3;

        if (fillBlankQuestions.length === 0) return true;

        // Create wrong answers for all fill-in-blank questions
        const answers: AnswerRecord[] = fillBlankQuestions.map((q, i) => ({
          questionId: q.id,
          userInput: 'wrong_input_' + i,
          correct: false,
          elapsedMs: 1000,
        }));

        const wrongItems = extractWrongAnswers(answers, superJson);

        for (const item of wrongItems) {
          if (item.question.type === 'questions_type_3') {
            // Correct answer should be the question's correctAnswer
            expect(item.correctAnswer).toBe(item.question.correctAnswer ?? '');

            // User answer should be the userInput from the answer record
            const answer = answers.find((a) => a.questionId === item.question.id);
            expect(item.userAnswer).toBe(answer?.userInput ?? '');
          }
        }

        return true;
      }),
      { numRuns: 20 }
    );
  });
});
