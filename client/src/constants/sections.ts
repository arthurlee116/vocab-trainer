import type { QuestionType } from '../types';

export const SECTION_ORDER: QuestionType[] = ['questions_type_1', 'questions_type_2', 'questions_type_3'];

export const SECTION_LABELS: Record<QuestionType, string> = {
  questions_type_1: '第一大题 · 看中文选英文',
  questions_type_2: '第二大题 · 看英文选中文',
  questions_type_3: '第三大题 · 句子填空',
};
