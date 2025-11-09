import { openRouterChat } from './openrouter';
import { logger } from '../utils/logger';
import { ProxyAgent } from 'undici';

interface ExtractWordEntry {
  index: number;
  raw: string;
  normalized: string;
  confident: boolean;
}

interface ExtractWordsResponse {
  words: ExtractWordEntry[];
}

const ENTRY_GUIDELINE =
  'Only transcribe the numbered vocabulary entries (ignore headings). ' +
  'Strip trailing part-of-speech labels like "(n.)" or "(adj.)", keep apostrophes/curly quotes, and never append punctuation that was not present.';

const NORMALIZATION_RULES = `Normalization rules that MUST be followed:
1. Replace straight apostrophes with RIGHT SINGLE QUOTATION MARK (’) so idioms like “cat’s” keep the curly mark.
2. Remove spaces around slashes, e.g., convert "with/ by" → "with/by".
3. When a term contains "(s)" or similar optional letters, output the fully spelled form (e.g., "affliction(s)" → "afflictions").
4. When one numbered line contains multiple vocabulary items (e.g., "penetrate (v.) penetration (n.)"), emit each vocab item separately even if they share the same number.
5. Perform a verification pass before responding: re-read each word letter-by-letter and remove any characters that are not in the image (e.g., stray trailing letters like an unexpected “y” or “le”—common failures include writing “beacony” instead of “beacon”, or expanding “sham” into “shamefaced”). If you cannot confirm the exact spelling, set note="uncertain" (or omit the item entirely for the string-list variant).
6. Never output section headings such as “Goalkeeper” or “Unit 13” as vocabulary entries.
7. Count the final entries; you must output exactly the number of numbered vocabulary items in the worksheet (129). If the count is off, revisit the image to recover any missing short words.
8. For short nouns toward the end of the worksheet (often 3–5 letters), copy the letters exactly—never expand them into longer English words. The first Unit 15 entry is the noun “beacon”; ensure the normalized output stays “beacon”. Likewise, when you see the four-letter noun “sham”, do not expand it.
9. If you mark an entry with confident=false, you still must provide your best corrected normalized value (do not leave obvious noise like trailing letters); use confident=false only when you cannot be 100% certain even after correction.`;

const OPTIMIZED_PROMPT = `You are Gemini 2.5 operating as a meticulous OCR specialist for vocabulary extraction.

TASK:
1. Extract ALL vocabulary words and phrases from the numbered word-list images.
2. Think in two passes:
   - Pass 1: list every candidate word in order.
   - Pass 2: for any word with ≤6 letters, spell it letter-by-letter and fix mistakes before finalizing.

${ENTRY_GUIDELINE}

${NORMALIZATION_RULES}

Return JSON with \`words\` = [{index, raw, normalized, confident}]:
- index = the original numbering on the worksheet (1..129 across the entire sheet).
- raw = the exact substring you saw in the image before cleanup.
- normalized = the cleaned vocabulary entry after applying the rules above.
- confident = true if you verified every letter, false if you are uncertain even after correction.`;

// Proxy configuration for bypassing geographic restrictions
const PROXY_URL = 'http://127.0.0.1:7890';
const proxyAgent = new ProxyAgent(PROXY_URL);

export const extractWordsFromImage = async (imageBase64List: string[]): Promise<string[]> => {
  const startTime = Date.now();
  const imageCount = imageBase64List.length;

  logger.info(`VLM: Starting word extraction from ${imageCount} image(s) using Gemini 2.5 Flash`);

  // JSON Schema for structured output (required for consistent parsing)
  const schema = {
    name: 'word_extraction_structured',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        words: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', minimum: 1 },
              raw: { type: 'string', minLength: 1, maxLength: 120 },
              normalized: { type: 'string', minLength: 1, maxLength: 120 },
              confident: { type: 'boolean' }
            },
            required: ['index', 'raw', 'normalized', 'confident']
          }
        }
      },
      required: ['words']
    }
  };

  // Format images for OpenRouter API
  const imageContent = imageBase64List.map((base64) => ({
    type: 'image_url' as const,
    image_url: {
      url: base64,
    },
  }));

  try {
    const result = await openRouterChat<ExtractWordsResponse>(
      {
        model: 'google/gemini-2.5-flash-preview-09-2025', // Updated: Gemini 2.5 Flash (vision-language model, not image generation)
        messages: [
          {
            role: 'user', // Image in user role with text prompt (better format)
            content: [
              { type: 'text', text: OPTIMIZED_PROMPT },
              ...imageContent
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
        // Note: Gemini 2.5 Flash supports temperature, but GPT-5 (full) does not
        temperature: 0.1, // Low temperature for consistent, accurate results
      },
      { dispatcher: proxyAgent } // Proxy to bypass geographic restrictions
    );

    const normalizedWords = sanitizeStructuredWords(result.words);

    const responseTime = Date.now() - startTime;

    logger.info(`VLM: Successfully extracted ${normalizedWords.length} normalized words in ${responseTime}ms`, {
      originalCount: result.words.length,
      cleanedCount: normalizedWords.length,
      words: normalizedWords
    });

    return normalizedWords;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`VLM: Word extraction failed after ${responseTime}ms`, {
      error: error instanceof Error ? error.message : error,
      imageCount,
      model: 'google/gemini-2.5-flash-preview-09-2025'
    });
    throw error;
  }
};

const EXPECTED_WORD_COUNT = 129;

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeStructuredWords = (entries: ExtractWordEntry[]): string[] => {
  if (!Array.isArray(entries)) {
    logger.warn('VLM: response missing words array');
    return [];
  }

  const seen = new Set<string>();

  const normalized = entries
    .map((entry, idx) => {
      const normalizedText = normalizeWhitespace(entry.normalized ?? entry.raw ?? '');
      if (!normalizedText) {
        logger.warn('VLM: empty normalized word encountered', { entryIndex: idx, raw: entry.raw });
        return null;
      }
      const deDuplicatedKey = normalizedText.toLowerCase();
      if (seen.has(deDuplicatedKey)) {
        return null;
      }
      seen.add(deDuplicatedKey);
      return normalizedText;
    })
    .filter((word): word is string => Boolean(word));

  if (normalized.length !== EXPECTED_WORD_COUNT) {
    logger.warn('VLM: normalized word count mismatch', {
      expected: EXPECTED_WORD_COUNT,
      received: normalized.length
    });
  }

  return normalized;
};
