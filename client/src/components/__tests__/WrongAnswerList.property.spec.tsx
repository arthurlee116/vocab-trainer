/**
 * Property-based tests for WrongAnswerList component
 * **Feature: quiz-wrong-review, Property 2: Question type labels consistency**
 * **Validates: Requirements 1.2, 5.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import WrongAnswerList from '../WrongAnswerList';
import { SECTION_LABELS } from '../../constants/sections';
import type { WrongAnswerItem } from '../../lib/wrongAnswers';
import type { SuperQuestion, QuestionType, Choice } from '../../types';

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating a choice
const choiceArb: fc.Arbitrary<Choice> = fc.record({
  id: idArb,
  text: fc.string({ minLength: 1, maxLength: 50 }),
});

// Arbitrary for generating a question type
const questionTypeArb: fc.Arbitrary<QuestionType> = fc.constantFrom(
  'questions_type_1',
  'questions_type_2',
  'questions_type_3'
);

// Arbitrary for generating a SuperQuestion with a specific type
const questionArb = (type: QuestionType): fc.Arbitrary<SuperQuestion> => {
  const baseQuestion = fc.record({
    id: idArb,
    word: fc.string({ minLength: 1, maxLength: 20 }),
    prompt: fc.string({ minLength: 1, maxLength: 100 }),
    explanation: fc.string({ minLength: 0, maxLength: 200 }),
    type: fc.constant(type),
    hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  });

  if (type === 'questions_type_3') {
    return baseQuestion.chain((base) =>
      fc.record({
        ...Object.fromEntries(Object.entries(base).map(([k, v]) => [k, fc.constant(v)])),
        correctAnswer: fc.string({ minLength: 1, maxLength: 50 }),
        sentence: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        translation: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      })
    ) as fc.Arbitrary<SuperQuestion>;
  } else {
    return baseQuestion.chain((base) =>
      fc.array(choiceArb, { minLength: 2, maxLength: 4 }).map((choices) => ({
        ...base,
        choices,
        correctChoiceId: choices[0].id,
      }))
    ) as fc.Arbitrary<SuperQuestion>;
  }
};

// Arbitrary for generating a WrongAnswerItem with a specific question type
const wrongAnswerItemArb = (type: QuestionType): fc.Arbitrary<WrongAnswerItem> =>
  questionArb(type).chain((question) =>
    fc.record({
      question: fc.constant(question),
      userAnswer: fc.string({ minLength: 0, maxLength: 50 }),
      correctAnswer: fc.string({ minLength: 1, maxLength: 50 }),
    })
  );

// Arbitrary for generating a list of WrongAnswerItems with mixed types
const wrongAnswerItemsArb: fc.Arbitrary<WrongAnswerItem[]> = fc
  .array(questionTypeArb, { minLength: 1, maxLength: 10 })
  .chain((types) => fc.tuple(...types.map((type) => wrongAnswerItemArb(type))));

describe('WrongAnswerList - Property Tests', () => {
  /**
   * Property 2: Question type labels consistency
   * For any wrong answer displayed, the type label SHALL match the corresponding
   * value from SECTION_LABELS constant for that question type.
   */
  it('should display correct SECTION_LABELS for each question type', () => {
    fc.assert(
      fc.property(wrongAnswerItemsArb, (items) => {
        const { container } = render(<WrongAnswerList items={items} />);

        // Get all type label elements
        const typeLabels = container.querySelectorAll('.wrong-answer-type');

        // Property: number of type labels matches number of items
        expect(typeLabels.length).toBe(items.length);

        // Property: each type label matches SECTION_LABELS for that question type
        items.forEach((item, index) => {
          const expectedLabel = SECTION_LABELS[item.question.type];
          expect(typeLabels[index].textContent).toBe(expectedLabel);
        });
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2 (continued): All three question types should use their correct labels
   */
  it('should use correct labels for all question types', () => {
    const questionTypes: QuestionType[] = ['questions_type_1', 'questions_type_2', 'questions_type_3'];

    fc.assert(
      fc.property(
        fc.constantFrom(...questionTypes),
        (type) => {
          // Generate a single item with the specific type
          return fc.assert(
            fc.property(wrongAnswerItemArb(type), (item) => {
              const { container } = render(<WrongAnswerList items={[item]} />);

              const typeLabel = container.querySelector('.wrong-answer-type');
              expect(typeLabel).not.toBeNull();
              expect(typeLabel?.textContent).toBe(SECTION_LABELS[type]);
            }),
            { numRuns: 10 }
          );
        }
      ),
      { numRuns: 3 } // One for each question type
    );
  });

  /**
   * Property 2 (continued): Labels should be consistent across multiple renders
   */
  it('should render consistent labels across multiple renders', () => {
    fc.assert(
      fc.property(wrongAnswerItemsArb, (items) => {
        // Render twice and compare
        const { container: container1 } = render(<WrongAnswerList items={items} />);
        const labels1 = Array.from(container1.querySelectorAll('.wrong-answer-type')).map(
          (el) => el.textContent
        );

        const { container: container2 } = render(<WrongAnswerList items={items} />);
        const labels2 = Array.from(container2.querySelectorAll('.wrong-answer-type')).map(
          (el) => el.textContent
        );

        // Property: labels should be identical across renders
        expect(labels1).toEqual(labels2);

        // Property: all labels should be valid SECTION_LABELS values
        const validLabels = Object.values(SECTION_LABELS);
        labels1.forEach((label) => {
          expect(validLabels).toContain(label);
        });
      }),
      { numRuns: 20 }
    );
  });
});
