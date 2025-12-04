import { Choice, SuperQuestion } from '../types';

const fisherYates = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
};

const findCorrectIndex = (choices: Choice[], correctChoiceId: string): number =>
  choices.findIndex((choice) => choice.id === correctChoiceId);

interface ShuffleOptions {
  initialPrevIndex?: number | null;
  maxAttempts?: number;
}

interface ShuffleResult {
  questions: SuperQuestion[];
  lastCorrectIndex: number | null;
}

const MAX_ATTEMPTS = 6;

/**
 * 随机打乱每道题的选项，同时追踪正确答案的索引，尽量避免相邻题落在同一位置。
 * 注意：第三大题（填空题）没有 choices 和 correctChoiceId，会直接返回原题目。
 */
export const shuffleQuestionChoices = (
  questions: SuperQuestion[],
  options: ShuffleOptions = {},
): ShuffleResult => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? MAX_ATTEMPTS);
  let prevCorrectIndex = options.initialPrevIndex ?? null;

  const shuffledQuestions = questions.map((question) => {
    // 第三大题（填空题）或缺少 choices/correctChoiceId 的题目直接返回
    if (!question.choices?.length || !question.correctChoiceId) {
      return question;
    }

    const correctChoiceId = question.correctChoiceId;
    let shuffled = fisherYates(question.choices);
    let attempts = 0;
    let correctIndex = findCorrectIndex(shuffled, correctChoiceId);

    const ensureCorrectVisible = () => {
      if (correctIndex !== -1) {
        return;
      }
      const fallback = question.choices!.find((choice) => choice.id === correctChoiceId);
      if (!fallback) {
        return;
      }
      const remaining = shuffled.filter((choice) => choice.id !== fallback.id);
      shuffled = [fallback, ...remaining];
      correctIndex = 0;
    };

    ensureCorrectVisible();

    while (
      correctIndex !== -1 &&
      prevCorrectIndex !== null &&
      correctIndex === prevCorrectIndex &&
      attempts < maxAttempts
    ) {
      shuffled = fisherYates(shuffled);
      correctIndex = findCorrectIndex(shuffled, correctChoiceId);
      ensureCorrectVisible();
      attempts += 1;
    }

    if (prevCorrectIndex !== null && correctIndex === prevCorrectIndex && shuffled.length > 1) {
      const swapIndex = (correctIndex + 1) % shuffled.length;
      const temp = shuffled[correctIndex]!;
      shuffled[correctIndex] = shuffled[swapIndex]!;
      shuffled[swapIndex] = temp;
      correctIndex = swapIndex;
    }

    prevCorrectIndex = correctIndex >= 0 ? correctIndex : prevCorrectIndex;

    return {
      ...question,
      choices: shuffled,
    };
  });

  return {
    questions: shuffledQuestions,
    lastCorrectIndex: prevCorrectIndex,
  };
};
