import type { AnswerRecord, SuperJson, SuperQuestion } from '../types';
import { SECTION_ORDER } from '../constants/sections';

/**
 * 错题详情项
 */
export interface WrongAnswerItem {
  question: SuperQuestion;
  userAnswer: string;
  correctAnswer: string;
}

/**
 * 从所有题目中查找指定 ID 的题目
 */
function findQuestionById(superJson: SuperJson, questionId: string): SuperQuestion | undefined {
  for (const type of SECTION_ORDER) {
    const found = superJson[type].find((q) => q.id === questionId);
    if (found) return found;
  }
  return undefined;
}

/**
 * 获取选择题的选项文本
 */
function getChoiceText(question: SuperQuestion, choiceId: string): string {
  const choice = question.choices?.find((c) => c.id === choiceId);
  return choice?.text ?? '';
}

/**
 * 从答题记录和题目数据中提取错题详情
 * @param answers 用户答题记录
 * @param superJson 题目数据
 * @returns 错题详情列表
 */
export function extractWrongAnswers(
  answers: AnswerRecord[],
  superJson: SuperJson
): WrongAnswerItem[] {
  const wrongItems: WrongAnswerItem[] = [];

  for (const answer of answers) {
    if (answer.correct) continue;

    const question = findQuestionById(superJson, answer.questionId);
    if (!question) continue;

    let userAnswer: string;
    let correctAnswer: string;

    if (question.type === 'questions_type_3') {
      // 填空题：使用 userInput 和 correctAnswer
      userAnswer = answer.userInput ?? '';
      correctAnswer = question.correctAnswer ?? '';
    } else {
      // 选择题：使用 choiceId 和 correctChoiceId
      userAnswer = answer.choiceId ? getChoiceText(question, answer.choiceId) : '';
      correctAnswer = question.correctChoiceId
        ? getChoiceText(question, question.correctChoiceId)
        : '';
    }

    wrongItems.push({
      question,
      userAnswer,
      correctAnswer,
    });
  }

  return wrongItems;
}

/**
 * 从错题详情中提取题目列表（用于重练）
 * @param wrongItems 错题详情列表
 * @returns 题目列表
 */
export function getRetryQuestions(wrongItems: WrongAnswerItem[]): SuperQuestion[] {
  return wrongItems.map((item) => item.question);
}
