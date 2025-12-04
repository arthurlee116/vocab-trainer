/**
 * Unit tests for wrongAnswers utility functions
 * _Requirements: 1.1, 1.3, 1.4, 1.5_
 */
import { describe, it, expect } from 'vitest';
import { extractWrongAnswers, getRetryQuestions, WrongAnswerItem } from '../wrongAnswers';
import type { AnswerRecord, SuperJson, SuperQuestion } from '../../types';

// Test fixtures
const createChoiceQuestion = (
  id: string,
  type: 'questions_type_1' | 'questions_type_2',
  word: string
): SuperQuestion => ({
  id,
  word,
  prompt: `What is the meaning of "${word}"?`,
  choices: [
    { id: `${id}-a`, text: 'Correct answer' },
    { id: `${id}-b`, text: 'Wrong answer 1' },
    { id: `${id}-c`, text: 'Wrong answer 2' },
  ],
  correctChoiceId: `${id}-a`,
  explanation: `Explanation for ${word}`,
  type,
  hint: `Hint for ${word}`,
});

const createFillBlankQuestion = (id: string, word: string): SuperQuestion => ({
  id,
  word,
  prompt: `Fill in the blank with "${word}"`,
  correctAnswer: word,
  explanation: `Explanation for ${word}`,
  type: 'questions_type_3',
  sentence: `The _____ is important.`,
  translation: '这个 _____ 很重要。',
  hint: `Starts with ${word[0]}`,
});

const createSuperJson = (
  type1: SuperQuestion[],
  type2: SuperQuestion[],
  type3: SuperQuestion[]
): SuperJson => ({
  metadata: {
    totalQuestions: type1.length + type2.length + type3.length,
    words: [...type1, ...type2, ...type3].map((q) => q.word),
    difficulty: 'intermediate',
    generatedAt: new Date().toISOString(),
  },
  questions_type_1: type1,
  questions_type_2: type2,
  questions_type_3: type3,
});

describe('extractWrongAnswers', () => {
  it('should extract wrong answers from mixed correct/wrong answers', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const q2 = createChoiceQuestion('q2', 'questions_type_2', 'banana');
    const q3 = createFillBlankQuestion('q3', 'cherry');

    const superJson = createSuperJson([q1], [q2], [q3]);

    const answers: AnswerRecord[] = [
      { questionId: 'q1', choiceId: 'q1-a', correct: true, elapsedMs: 1000 }, // correct
      { questionId: 'q2', choiceId: 'q2-b', correct: false, elapsedMs: 1500 }, // wrong
      { questionId: 'q3', userInput: 'wrong', correct: false, elapsedMs: 2000 }, // wrong
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems).toHaveLength(2);
    expect(wrongItems[0].question.id).toBe('q2');
    expect(wrongItems[1].question.id).toBe('q3');
  });

  it('should return correct and user answer text for choice-based questions', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const superJson = createSuperJson([q1], [], []);

    const answers: AnswerRecord[] = [
      { questionId: 'q1', choiceId: 'q1-b', correct: false, elapsedMs: 1000 },
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems).toHaveLength(1);
    expect(wrongItems[0].correctAnswer).toBe('Correct answer');
    expect(wrongItems[0].userAnswer).toBe('Wrong answer 1');
  });

  it('should return correct and user answer text for fill-in-blank questions', () => {
    const q3 = createFillBlankQuestion('q3', 'cherry');
    const superJson = createSuperJson([], [], [q3]);

    const answers: AnswerRecord[] = [
      { questionId: 'q3', userInput: 'wrong_input', correct: false, elapsedMs: 1000 },
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems).toHaveLength(1);
    expect(wrongItems[0].correctAnswer).toBe('cherry');
    expect(wrongItems[0].userAnswer).toBe('wrong_input');
  });

  it('should return empty array when all answers are correct', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const q2 = createFillBlankQuestion('q2', 'banana');
    const superJson = createSuperJson([q1], [], [q2]);

    const answers: AnswerRecord[] = [
      { questionId: 'q1', choiceId: 'q1-a', correct: true, elapsedMs: 1000 },
      { questionId: 'q2', userInput: 'banana', correct: true, elapsedMs: 1500 },
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems).toHaveLength(0);
  });

  it('should handle missing question gracefully', () => {
    const superJson = createSuperJson([], [], []);

    const answers: AnswerRecord[] = [
      { questionId: 'nonexistent', choiceId: 'x', correct: false, elapsedMs: 1000 },
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems).toHaveLength(0);
  });

  it('should preserve hint information in wrong answer items', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const superJson = createSuperJson([q1], [], []);

    const answers: AnswerRecord[] = [
      { questionId: 'q1', choiceId: 'q1-b', correct: false, elapsedMs: 1000 },
    ];

    const wrongItems = extractWrongAnswers(answers, superJson);

    expect(wrongItems[0].question.hint).toBe('Hint for apple');
  });
});

describe('getRetryQuestions', () => {
  it('should return question list from wrong answer items', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const q2 = createFillBlankQuestion('q2', 'banana');

    const wrongItems: WrongAnswerItem[] = [
      { question: q1, userAnswer: 'Wrong answer 1', correctAnswer: 'Correct answer' },
      { question: q2, userAnswer: 'wrong', correctAnswer: 'banana' },
    ];

    const retryQuestions = getRetryQuestions(wrongItems);

    expect(retryQuestions).toHaveLength(2);
    expect(retryQuestions[0]).toBe(q1);
    expect(retryQuestions[1]).toBe(q2);
  });

  it('should return empty array for empty wrong items', () => {
    const retryQuestions = getRetryQuestions([]);

    expect(retryQuestions).toHaveLength(0);
  });

  it('should preserve question order', () => {
    const q1 = createChoiceQuestion('q1', 'questions_type_1', 'apple');
    const q2 = createChoiceQuestion('q2', 'questions_type_2', 'banana');
    const q3 = createFillBlankQuestion('q3', 'cherry');

    const wrongItems: WrongAnswerItem[] = [
      { question: q1, userAnswer: 'x', correctAnswer: 'y' },
      { question: q2, userAnswer: 'x', correctAnswer: 'y' },
      { question: q3, userAnswer: 'x', correctAnswer: 'y' },
    ];

    const retryQuestions = getRetryQuestions(wrongItems);

    expect(retryQuestions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
  });
});
