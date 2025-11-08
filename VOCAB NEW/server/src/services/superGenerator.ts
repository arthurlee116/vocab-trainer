import { DifficultyLevel, SuperJson } from '../types';
import { openRouterChat } from './openrouter';
import { logger } from '../utils/logger';

const MODEL_FALLBACKS = [
  'moonshotai/kimi-linear-48b-a3b-instruct',
  'google/gemini-2.5-flash-preview-09-2025',
  'openrouter/polaris-alpha',
] as const;

const shuffleWithin = <T>(items: T[]): T[] => {
  if (items.length <= 1) {
    return [...items];
  }

  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
};

const questionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    word: { type: 'string' },
    prompt: { type: 'string' },
    choices: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
    correctChoiceId: { type: 'string' },
    explanation: { type: 'string' },
    sentence: { type: 'string' },
    translation: { type: 'string' },
    hint: { type: 'string' },
    type: {
      type: 'string',
      enum: ['questions_type_1', 'questions_type_2', 'questions_type_3'],
    },
  },
  required: ['id', 'word', 'prompt', 'choices', 'correctChoiceId', 'explanation', 'type'],
  additionalProperties: false,
};

const responseSchema = {
  name: 'super_drill_bundle',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: {
          totalQuestions: { type: 'integer' },
          words: { type: 'array', items: { type: 'string' } },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          generatedAt: { type: 'string' },
        },
        required: ['totalQuestions', 'words', 'difficulty', 'generatedAt'],
        additionalProperties: false,
      },
      questions_type_1: { type: 'array', minItems: 1, items: questionSchema },
      questions_type_2: { type: 'array', minItems: 1, items: questionSchema },
      questions_type_3: { type: 'array', minItems: 1, items: questionSchema },
    },
    required: ['metadata', 'questions_type_1', 'questions_type_2', 'questions_type_3'],
    additionalProperties: false,
  },
};

export const generateSuperJson = async (
  words: string[],
  difficulty: DifficultyLevel,
  questionCountPerType?: number,
): Promise<SuperJson> => {
  const startTime = Date.now();

  const normalized = Array.from(new Set(words.map((w) => w.trim().toLowerCase()))).filter(Boolean);
  if (!normalized.length) {
    throw new Error('Word list cannot be empty');
  }

  const perType = questionCountPerType ?? Math.min(20, normalized.length);

  logger.info(`SuperGenerator: Generating ${perType} questions per type for ${normalized.length} words (${difficulty})`);

  const prompt = `
你是一名严谨的出题 AI。使用用户提供的单词列表生成一个"超级 JSON"，包含 3 大题型，每大题 ${perType} 小题。

- questions_type_1: 展示中文释义/情境，提供 4 个英文选项，正确答案必须来自单词表，其余干扰项自然但可不在单词表中。
- questions_type_2: 展示英文释义或例句，要求选择正确的中文释义或翻译。
- questions_type_3: 句子填空，必须包含 "_____" 的英文例句、中文翻译以及提示（词性/定义/词根），并给出 4 个英文候选词。

题目顺序务必打乱，choices 数组必须 4 选 1。解释和提示请使用中文，并让每个题目的 type 字段标记为所属的 questions_type_x。严格遵守 JSON Schema。
`;

  const messages = [
    {
      role: 'system' as const,
      content:
        'You only return JSON that follows the provided schema. Always craft natural distractors and never reuse the same order.',
    },
    {
      role: 'user' as const,
      content: `${prompt}\n难度：${difficulty}\n单词：${normalized.join(', ')}`,
    },
  ];

  let lastError: unknown;

  for (const model of MODEL_FALLBACKS) {
    try {
      logger.info(`SuperGenerator: Attempting model ${model}`);

      const result = await openRouterChat<SuperJson>({
        model,
        messages,
        temperature: difficulty === 'advanced' ? 0.85 : 0.65,
        response_format: {
          type: 'json_schema',
          json_schema: responseSchema,
        },
      });

      const responseTime = Date.now() - startTime;
      const totalQuestions = result.metadata?.totalQuestions || 0;

      const shuffledResult: SuperJson = {
        ...result,
        questions_type_1: shuffleWithin(result.questions_type_1 ?? []),
        questions_type_2: shuffleWithin(result.questions_type_2 ?? []),
        questions_type_3: shuffleWithin(result.questions_type_3 ?? []),
      };

      logger.info(`SuperGenerator: Successfully generated ${totalQuestions} total questions in ${responseTime}ms`, {
        difficulty,
        perType,
        wordsCount: normalized.length,
        model,
      });

      return shuffledResult;
    } catch (error) {
      lastError = error;
      const responseTime = Date.now() - startTime;
      logger.warn(`SuperGenerator: Model ${model} failed after ${responseTime}ms`, {
        error: error instanceof Error ? error.message : error,
        difficulty,
        perType,
        wordsCount: normalized.length,
      });
    }
  }

  const responseTime = Date.now() - startTime;
  logger.error(`SuperGenerator: All models failed after ${responseTime}ms`, {
    error: lastError instanceof Error ? lastError.message : lastError,
    difficulty,
    perType,
    wordsCount: normalized.length,
  });

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error'));
};
