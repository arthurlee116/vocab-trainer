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

const CHUNK_SIZE = 20;
const MAX_CONCURRENCY = 20;

const chunkWords = (words: string[]): string[][] => {
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
};

const validateDetailsBundle = (bundle: { details?: VocabularyDetail[] }, label: string) => {
  if (!bundle || !Array.isArray(bundle.details) || bundle.details.length === 0) {
    throw new Error(`${label}: details 数组缺失或为空`);
  }

  bundle.details.forEach((detail, idx) => {
    if (!detail || typeof detail !== 'object') {
      throw new Error(`${label}: detail[${idx}] 非对象`);
    }
    const allowedKeys = ['word', 'partsOfSpeech', 'definitions', 'examples'];
    const extraKeys = Object.keys(detail).filter((key) => !allowedKeys.includes(key));
    if (extraKeys.length) {
      throw new Error(`${label}: detail[${idx}] 存在多余字段 ${extraKeys.join(', ')}`);
    }
    if (!detail.word || typeof detail.word !== 'string') {
      throw new Error(`${label}: detail[${idx}].word 无效`);
    }
    if (!Array.isArray(detail.partsOfSpeech) || detail.partsOfSpeech.length < 1) {
      throw new Error(`${label}: detail[${idx}].partsOfSpeech 为空`);
    }
    if (!Array.isArray(detail.definitions) || detail.definitions.length < 1) {
      throw new Error(`${label}: detail[${idx}].definitions 为空`);
    }
    if (!Array.isArray(detail.examples) || detail.examples.length < 1 || detail.examples.length > 3) {
      throw new Error(`${label}: detail[${idx}].examples 数量不合法`);
    }
    detail.examples.forEach((ex, exIdx) => {
      const allowedExampleKeys = ['en', 'zh'];
      const extraExampleKeys = Object.keys(ex).filter((key) => !allowedExampleKeys.includes(key));
      if (extraExampleKeys.length) {
        throw new Error(`${label}: detail[${idx}].examples[${exIdx}] 存在多余字段 ${extraExampleKeys.join(', ')}`);
      }
      if (!ex.en || typeof ex.en !== 'string' || !ex.zh || typeof ex.zh !== 'string') {
        throw new Error(`${label}: detail[${idx}].examples[${exIdx}] 缺少 en/zh`);
      }
    });
  });
};

const generateChunk = async (
  words: string[],
  difficulty: DifficultyLevel,
  chunkIndex: number,
  totalChunks: number,
): Promise<VocabularyDetail[]> => {
  const prompt = `
你是一名专业的英汉双语词典编写 AI，请针对下列单词生成词条：
1. word：保持输入单词的原始拼写。
2. partsOfSpeech：字符串数组，小写词性（例如 verb, adjective, noun）。
3. definitions：中文释义数组，仅输出简洁中文短句，覆盖常见含义，至少 1 条。
4. examples：至少 1 条、至多 3 条例句，每条含 en（英文例句）与 zh（对应中文翻译），句子难度贴合 ${difficulty} 学习者，可结合生活/学习场景。
5. 若单词有多个含义或词性，请全部列出；例句不得直接泄露答案（例如用同义改写）。
6. 禁止输出多余文本或 Markdown，只能返回 JSON。
`;

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a bilingual lexicographer. Always return JSON that matches the provided schema. Do not include markdown fences or explanations.',
    },
    {
      role: 'user' as const,
      content: `${prompt}\n单词列表（第 ${chunkIndex + 1}/${totalChunks} 段）：${words.join(', ')}`,
    },
  ];

  let lastError: unknown;

  for (const model of MODEL_FALLBACKS) {
    try {
      logger.info(
        `VocabDetails: Generating chunk ${chunkIndex + 1}/${totalChunks} with ${words.length} words (${difficulty}) via ${model}`,
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
      validateDetailsBundle(result, `chunk ${chunkIndex + 1}`);
      const responseTime = Date.now() - startTime;
      logger.info('VocabDetails: Chunk generated', {
        model,
        responseTime,
        words: words.length,
        difficulty,
        chunkIndex,
        totalChunks,
      });
      return result.details;
    } catch (error) {
      lastError = error;
      logger.warn('VocabDetails: Chunk generation failed', {
        model,
        chunkIndex,
        totalChunks,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown chunk error'));
};

export const generateVocabularyDetails = async (
  words: string[],
  difficulty: DifficultyLevel,
): Promise<VocabularyDetail[]> => {
  const normalized = normalizeWordList(words);
  if (!normalized.length) {
    throw new Error('Word list cannot be empty');
  }

  const chunks = chunkWords(normalized);
  const totalChunks = chunks.length;
  const results: VocabularyDetail[] = [];
  const seenWords = new Set<string>();

  let currentIndex = 0;
  const worker = async () => {
    while (currentIndex < totalChunks) {
      const chunkIndex = currentIndex;
      currentIndex += 1;
      const chunkWordsList = chunks[chunkIndex];
      const chunkDetails = await generateChunk(chunkWordsList, difficulty, chunkIndex, totalChunks);
      chunkDetails.forEach((detail) => {
        const key = detail.word.toLowerCase();
        if (!seenWords.has(key)) {
          seenWords.add(key);
          results.push(detail);
        }
      });
    }
  };

  const workerCount = Math.min(MAX_CONCURRENCY, totalChunks);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);

  return results;
};
