#!/usr/bin/env node

/**
 * Prompt Variation Test Suite
 *
 * Tests different prompts on the BEST model to identify
 * the most effective instruction strategy
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

import {
  TestConfig,
  TestResult,
  loadExpectedWords,
  loadTestImage,
  compareResults,
  saveTestResult,
  printTestResult
} from './test-utils.js';

if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY not found.');
  process.exit(1);
}

const EXPECTED_WORDS = loadExpectedWords();
const TEST_IMAGE_BASE64 = loadTestImage();

console.log('='.repeat(80));
console.log('🎨 PROMPT VARIATION TEST SUITE');
console.log('Testing: Qwen3-VL-235B with different prompts');
console.log('='.repeat(80));

const BEST_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';

// Different prompt variations to test
const PROMPT_VARIATIONS = [
  {
    id: 'PROMPT_V1_Basic',
    prompt: `Extract all vocabulary words from this image.

Return as JSON: {"words": ["word1", "word2", ...]}`,
    description: 'Basic extraction prompt'
  },
  {
    id: 'PROMPT_V2_Detailed',
    prompt: `You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English vocabulary words and phrases.

INSTRUCTIONS:
1. Extract words EXACTLY as they appear (preserve punctuation, hyphens, apostrophes)
2. Include: single words, phrases with sb./sth., idioms, hyphenated words, possessives
3. Do NOT include numbers, bullet points, or formatting markers
4. Return as JSON: {"words": ["word1", "word2", ...]}

BE THOROUGH - look carefully for all text in the image.`,
    description: 'Detailed instructions with format preservation'
  },
  {
    id: 'PROMPT_V3_Thinking',
    prompt: `Analyze this educational vocabulary sheet step-by-step:

FIRST: Identify the layout and structure of the document
SECOND: Carefully read each line of text
THIRD: Extract every vocabulary item including:
   - Individual words (anthropology, philosophy)
   - Phrases with abbreviations (hold sb. accountable for)
   - Idiomatic expressions (a cat has nine lives)
   - Hyphenated terms (far-fetched)
   - Possessives (cat's)

FOURTH: Format each item exactly as it appears
FIFTH: Return JSON: {"words": ["extracted", "words", "here"]}

Focus on accuracy and completeness.`,
    description: 'Chain-of-thought style, step-by-step reasoning'
  },
  {
    id: 'PROMPT_V4_Examples',
    prompt: `Extract all vocabulary items from this image. Return EXACTLY as they appear, preserving all punctuation and formatting.

Look for:
- Single words: "anthropology", "philosophy"
- Phrases: "hold sb. accountable for"
- Idioms: "a cat has nine lives", "let the cat out of the bag"
- Hyphenated: "far-fetched"
- Possessives: "cat's"

CRITICAL: Do NOT modify or normalize the text. Return each item exactly as shown.

JSON format: {"words": ["item1", "item2", ...]}`,
    description: 'With concrete examples of expected output'
  },
  {
    id: 'PROMPT_V5_JSONSchema',
    prompt: `You are a precise OCR system. Extract ALL text items from this vocabulary list.

REQUIREMENTS:
- Preserve original spelling, punctuation, and capitalization
- Include multi-word phrases and idioms
- Keep sb./sth. abbreviations
- Maintain hyphens and apostrophes

Output MUST be valid JSON array of strings.

Example output:
{"words": ["anthropology", "philosophy", "hold sb. accountable for", "a cat has nine lives", "far-fetched"]}`
    ,
    description: 'System role with schema emphasis and examples'
  },
  {
    id: 'PROMPT_V6_Strict',
    prompt: `TASK: Extract vocabulary from image

RULES:
1. NO modifications to text
2. NO adding or removing punctuation
3. NO case changes
4. Include ALL phrases with exact wording
5. Include ALL idioms with exact wording
6. Include ALL hyphenated words
7. Output in JSON format array

FAILURE CONDITIONS:
- Missing any vocabulary item
- Changing punctuation or formatting
- Not including multi-word phrases

Do this correctly. Return JSON only.`,
    description: 'Strict rules with failure conditions'
  }
];

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: any;
};

type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_schema' | 'json_object';
    json_schema?: any;
  };
};

type ExtractWordsResponse = {
  words: string[];
};

async function callOpenRouter(payload: OpenRouterRequest): Promise<ExtractWordsResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      'X-Title': 'Prompt Variation Test',
    },
    body: JSON.stringify({
      ...payload,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Model returned empty response');
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
    throw new Error(`Failed to parse JSON response: ${parseError}. Content: ${preview}`);
  }
}

async function runPromptTest(promptVariation: typeof PROMPT_VARIATIONS[0]): Promise<TestResult> {
  console.log(`\n🎨 Testing ${promptVariation.id}`);
  console.log(`   ${promptVariation.description}`);

  const startTime = Date.now();

  try {
    const schema = {
      name: 'word_extraction',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          words: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Extracted vocabulary words'
          }
        },
        required: ['words'],
        additionalProperties: false
      }
    };

    const request: OpenRouterRequest = {
      model: BEST_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptVariation.prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${TEST_IMAGE_BASE64}` }
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema
      },
      temperature: 0.1,
      max_tokens: 4000
    };

    const response = await callOpenRouter(request);
    const duration = Date.now() - startTime;
    const comparison = compareResults(response.words, EXPECTED_WORDS);

    const result: TestResult = {
      testId: promptVariation.id,
      model: BEST_MODEL,
      prompt: promptVariation.prompt,
      requestFormat: 'user_role_single_image',
      extractedWords: response.words,
      expectedWords: EXPECTED_WORDS,
      matchCount: comparison.matchCount,
      missingWords: comparison.missingWords,
      extraWords: comparison.extraWords,
      accuracy: comparison.accuracy,
      timestamp: new Date().toISOString(),
      duration,
      rawResponse: response
    };

    printTestResult(result);
    saveTestResult(result);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Failed: ${errorMsg}`);

    const result: TestResult = {
      testId: promptVariation.id,
      model: BEST_MODEL,
      prompt: promptVariation.prompt,
      requestFormat: 'user_role_single_image',
      extractedWords: [],
      expectedWords: EXPECTED_WORDS,
      matchCount: 0,
      missingWords: EXPECTED_WORDS.map(w => w.toLowerCase()),
      extraWords: [],
      accuracy: 0,
      timestamp: new Date().toISOString(),
      duration,
      errors: [errorMsg]
    };

    saveTestResult(result);
    return result;
  }
}

async function main() {
  console.log(`\n⏳ Testing ${PROMPT_VARIATIONS.length} prompt variations...\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < PROMPT_VARIATIONS.length; i++) {
    const variation = PROMPT_VARIATIONS[i];
    try {
      const result = await runPromptTest(variation);
      results.push(result);

      const progress = ((i + 1) / PROMPT_VARIATIONS.length) * 100;
      console.log(`\n📊 Progress: ${progress.toFixed(0)}% (${i + 1}/${PROMPT_VARIATIONS.length})`);

      if (i < PROMPT_VARIATIONS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`   ⚠️ Skipped ${variation.id}: ${error}`);
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('🏆 PROMPT VARIATION RESULTS');
  console.log('='.repeat(80));

  results.sort((a, b) => b.accuracy - a.accuracy);

  results.forEach((result, idx) => {
    const rank = idx + 1;
    const status = result.errors ? '❌' : '🏆';
    const accuracy = result.errors ? 'N/A' : `${result.accuracy.toFixed(1)}%`;
    console.log(`${rank}. ${status} ${result.testId}: ${accuracy}`);
  });

  if (results.length > 0) {
    const best = results[0];
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    console.log('\n🎯 BEST PROMPT:');
    console.log(`   Accuracy: ${best.accuracy.toFixed(1)}%`);
    console.log(`   Matched: ${best.matchCount}/${best.expectedWords.length} words`);
    console.log(`   Duration: ${best.duration}ms`);
    console.log(`   Avg Duration: ${Math.round(avgDuration)}ms`);
    console.log(`\n💡 PROMPT STRATEGY: ${best.testId}`);
    console.log(`   ${PROMPT_VARIATIONS.find(p => p.id === best.testId)?.description}`);
  }

  console.log('\n✨ All prompt variations tested!');
  console.log('📂 Results saved to: results/ directory');

  process.exit(0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
