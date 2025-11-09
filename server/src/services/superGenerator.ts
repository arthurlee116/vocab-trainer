import { DifficultyLevel, QuestionType, SuperJson, SuperQuestion } from '../types';
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

const QUESTION_TYPE_RULES: Record<QuestionType, string> = {
  questions_type_1:
    '- 题干使用清晰的中文释义、情境或例句，要求考生从 4 个英文中选出正确单词，正确答案必须出自单词表，其余干扰项需贴近语义但可以不在单词表中。',
  questions_type_2:
    '- 题干使用英文释义或例句，要求考生选择对应的中文释义或翻译，可结合常见误区设计干扰项。',
  questions_type_3:
    '- 题干为包含 “_____” 的英文句子，并附中文翻译与提示（词性/定义/词根），提供 4 个英文候选词，仅有一个能正确填空。',
};

const buildTypeResponseSchema = (questionType: QuestionType, count: number) => ({
  name: `${questionType}_bundle`,
  strict: true,
  schema: {
    type: 'object',
    properties: {
      [questionType]: {
        type: 'array',
        minItems: Math.max(3, Math.min(count, 30)),
        maxItems: Math.max(3, count),
        items: questionSchema,
      },
    },
    required: [questionType],
    additionalProperties: false,
  },
});

const SHARED_TYPE_RULES = `
- 所有题目都必须提供 4 个选项 (choices[4])，且 correctChoiceId 对应其中一个选项。
- explanation 与 hint 必须使用中文，提示需要给出方向性的点（词性/词根/记忆法）。
- 每个题目的 type 字段固定写为本题型的标识，且 id/choices.id 不得重复。
- 题干与选项要自然流畅，严禁输出 markdown/额外文本，只能返回 JSON。`;

export const generateQuestionsForType = async (params: {
  questionType: QuestionType;
  words: string[];
  difficulty: DifficultyLevel;
  perType: number;
}): Promise<SuperQuestion[]> => {
  const { questionType, words, difficulty, perType } = params;

  if (!words.length) {
    throw new Error('Word list cannot be empty');
  }

  const prompt = `
你是一名严谨的出题 AI。根据给定的单词列表与难度，生成 ${perType} 道 ${questionType} 题目。
${QUESTION_TYPE_RULES[questionType]}
${SHARED_TYPE_RULES}
- 单词列表：${words.join(', ')}
- 难度：${difficulty}
- 题目数量：${perType}

请严格返回 JSON，字段结构必须匹配 schema。`;

  const messages = [
    {
      role: 'system' as const,
      content:
        'You only return JSON that follows the provided schema. Avoid markdown fences. Keep distractors natural and do not leak English explanations in the Chinese fields.',
    },
    { role: 'user' as const, content: prompt },
  ];

  const schema = buildTypeResponseSchema(questionType, perType);

  let lastError: unknown;

  for (const model of MODEL_FALLBACKS) {
    try {
      logger.info(
        `SuperGenerator: Generating ${perType} questions for ${questionType} with ${words.length} words (${difficulty}) via ${model}`,
      );
      const startTime = Date.now();
      const result = await openRouterChat<Record<QuestionType, SuperQuestion[]>>({
        model,
        messages,
        temperature: difficulty === 'advanced' ? 0.85 : 0.65,
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
      });
      const responseTime = Date.now() - startTime;
      const bundle = result[questionType] ?? [];
      const normalizedBundle = shuffleWithin(bundle).map((question) => ({
        ...question,
        type: questionType,
      }));

      logger.info(
        `SuperGenerator: ${questionType} succeeded with ${normalizedBundle.length} questions in ${responseTime}ms (${model})`,
        {
          difficulty,
          perType,
          wordsCount: words.length,
        },
      );

      return normalizedBundle;
    } catch (error) {
      lastError = error;
      logger.warn(`SuperGenerator: ${questionType} failed`, {
        error: error instanceof Error ? error.message : error,
        difficulty,
        perType,
        wordsCount: words.length,
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error while generating questions'));
};
