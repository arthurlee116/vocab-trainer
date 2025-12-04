import type { QuestionType, SuperJson, SuperQuestion } from '../types';

let nextId = 1;

const createChoice = (text: string) => {
  const id = `choice-${nextId++}`;
  return { id, text };
};

export const createMockQuestion = (overrides: Partial<SuperQuestion> = {}): SuperQuestion => {
  const correctChoice = createChoice('answer');
  const distractor = createChoice('wrong');
  const fallback: SuperQuestion = {
    id: `question-${nextId++}`,
    prompt: '测试题干',
    word: 'lexeme',
    choices: [correctChoice, distractor],
    correctChoiceId: correctChoice.id,
    explanation: 'explanation',
    type: 'questions_type_1',
    sentence: 'I want to answer this question.',
    translation: '我想回答这个问题',
    hint: '提示信息',
  };
  return { ...fallback, ...overrides };
};

/**
 * 创建第三大题的 mock 数据（填空题，无选项）
 */
export const createMockType3Question = (overrides: Partial<SuperQuestion> = {}): SuperQuestion => {
  const fallback: SuperQuestion = {
    id: `question-${nextId++}`,
    prompt: '根据句意填空',
    word: 'misanthrope',
    correctAnswer: 'misanthrope',
    explanation: '厌世者的解释',
    type: 'questions_type_3',
    sentence: 'The bitter old man was known as a _____, avoiding all social contact.',
    translation: '那个苦涩的老人被称为厌世者，避免所有社交接触。',
    hint: '名词，表示厌恶人类或回避人群的人',
  };
  return { ...fallback, ...overrides };
};

export const createMockSuperJson = (options?: {
  sections?: Partial<Record<QuestionType, SuperQuestion[]>>;
  metadata?: Partial<SuperJson['metadata']>;
}): SuperJson => {
  const defaults: SuperJson = {
    metadata: {
      totalQuestions: 3,
      words: ['lexeme'],
      difficulty: 'beginner',
      generatedAt: new Date().toISOString(),
    },
    questions_type_1: [createMockQuestion({ type: 'questions_type_1' })],
    questions_type_2: [createMockQuestion({ type: 'questions_type_2' })],
    questions_type_3: [createMockType3Question()],
  };

  const sections: Record<QuestionType, SuperQuestion[]> = {
    questions_type_1: options?.sections?.questions_type_1 ?? defaults.questions_type_1,
    questions_type_2: options?.sections?.questions_type_2 ?? defaults.questions_type_2,
    questions_type_3: options?.sections?.questions_type_3 ?? defaults.questions_type_3,
  };

  return {
    ...defaults,
    ...sections,
    metadata: { ...defaults.metadata, ...options?.metadata },
  };
};
