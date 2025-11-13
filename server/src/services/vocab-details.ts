import { DifficultyLevel, VocabularyDetail } from '../types';
import { openRouterChat } from './openrouter';
import { MODEL_FALLBACKS } from '../constants/model-fallbacks';
import { logger } from '../utils/logger';

const exampleSchema = {
  type: 'object',
  properties: {
    en: { type: 'string' },
    zh: { type: 'string' },
  },
  required: ['en', 'zh'],
  additionalProperties: false,
};

const detailSchema = {
  type: 'object',
  properties: {
    word: { type: 'string' },
    partsOfSpeech: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
    definitions: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
    },
    examples: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: exampleSchema,
    },
  },
  required: ['word', 'partsOfSpeech', 'definitions', 'examples'],
  additionalProperties: false,
};

const responseSchema = {
  name: 'vocabulary_details_bundle',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      details: {
        type: 'array',
        minItems: 1,
        items: detailSchema,
      },
    },
    required: ['details'],
    additionalProperties: false,
  },
};

const normalizeWordList = (words: string[]): string[] =>
  Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)));

export const generateVocabularyDetails = async (
  words: string[],
  difficulty: DifficultyLevel,
): Promise<VocabularyDetail[]> => {
  const normalized = normalizeWordList(words);
  if (!normalized.length) {
    throw new Error('Word list cannot be empty');
  }

  const prompt = `
你是一名专业的英汉双语词典编写 AI，请针对下列单词生成词条：
1. word：保持输入单词的原始拼写。
2. partsOfSpeech：字符串数组，小写词性（例如 verb, adjective, noun）。
3. definitions：中文释义数组，仅输出简洁中文短句，覆盖常见含义，至少 1 条。
4. examples：至少 1 条、至多 3 条例句，每条含 en（英文例句）与 zh（对应中文翻译），句子难度贴合 ${difficulty} 学习者，可结合生活/学习场景。
5. 若单词有多个含义或词性，请全部列出；例句不得直接泄露答案（例如用同义改写）。
6. 按原顺序返回所有单词，禁止输出多余文本或 Markdown，只能返回 JSON。
`;

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a bilingual lexicographer. Always return JSON that matches the provided schema. Do not include markdown fences or explanations.',
    },
    {
      role: 'user' as const,
      content: `${prompt}\n单词列表：${normalized.join(', ')}`,
    },
  ];

  let lastError: unknown;

  for (const model of MODEL_FALLBACKS) {
    try {
      logger.info(
        `VocabDetails: Generating dictionary entries for ${normalized.length} words (${difficulty}) via ${model}`,
      );
      const startTime = Date.now();
      const result = await openRouterChat<{ details: VocabularyDetail[] }>({
        model,
        messages,
        temperature: difficulty === 'advanced' ? 0.65 : 0.45,
        response_format: {
          type: 'json_schema',
          json_schema: responseSchema,
        },
      });
      const responseTime = Date.now() - startTime;
      logger.info('VocabDetails: Successfully generated vocabulary details', {
        model,
        responseTime,
        words: normalized.length,
        difficulty,
      });
      return result.details;
    } catch (error) {
      lastError = error;
      logger.warn('VocabDetails: Model failed', {
        model,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error'));
};
