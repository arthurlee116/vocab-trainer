#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Latest VLM Models Test Suite - 2025
 *
 * Tests cutting-edge vision-language models for vocabulary extraction
 * Updated with latest models as of November 2025
 */

import dotenv from 'dotenv';
import path from 'path';
import {
  TestConfig,
  TestResult,
  loadExpectedWords,
  loadTestImage,
  compareResults,
  saveTestResult,
  printTestResult,
  generateSummaryReport
} from './test-utils';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });

if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY not found. Please copy server/.env.example to server/.env and add your API key.');
  process.exit(1);
}

const EXPECTED_WORDS = loadExpectedWords();
const TEST_IMAGE_BASE64 = loadTestImage();

console.log('='.repeat(80));
console.log('🚀 LATEST VLM MODELS TEST SUITE (2025)');
console.log('='.repeat(80));
console.log(`Expected words: ${EXPECTED_WORDS.length}`);
console.log(`Testing ${TEST_IMAGE_BASE64.length / 1024 / 1024} MB image (base64)`);
console.log('='.repeat(80));
console.log('Models being tested:');
console.log('• Qwen3-VL-235B (Alibaba) - Largest vision model');
console.log('• GPT-5 Image (OpenAI) - State-of-the-art');
console.log('• Gemini 2.5 Flash (Google) - 1M context');
console.log('• Claude Sonnet 4.5 (Anthropic) - Best structured output');
console.log('• Qwen3-VL-30B (Alibaba) - Cost-effective');
console.log('• GPT-5 Image Mini (OpenAI) - Lightweight version');
console.log('• Nova Premier (Amazon) - 1M context');
console.log('='.repeat(80));

// Enhanced prompt for better vocabulary extraction
const ENHANCED_PROMPT = `You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English vocabulary words and phrases.

CRITICAL INSTRUCTIONS:
1. Extract words exactly as they appear (preserve case, punctuation, formatting)
2. Include all types:
   - Single words (e.g., "anthropology")
   - Phrases with sb./sth. abbreviations (e.g., "hold sb. accountable for")
   - Idioms and expressions (e.g., "a cat has nine lives")
   - Hyphenated words (e.g., "far-fetched")
   - Contractions/possessives (e.g., "cat's")
3. Do NOT include numbers, bullet points, or formatting markers
4. Return each vocabulary item as a separate string in the array
5. Be thorough - look carefully for all text in the image

Output must be a JSON object with a "words" array containing all extracted vocabulary items.`;

const testConfigs: TestConfig[] = [
  {
    id: 'TEST_2025_001_Qwen3VL235B',
    model: 'qwen/qwen3-vl-235b-a22b-instruct',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'Qwen3-VL 235B - Largest vision model, optimized for document OCR'
  },
  {
    id: 'TEST_2025_002_GPT5Image',
    model: 'openai/gpt-5-image',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'GPT-5 Vision - State-of-the-art multimodal'
  },
  {
    id: 'TEST_2025_003_Gemini25Flash',
    model: 'google/gemini-2.5-flash-image',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'Gemini 2.5 Flash - Superior reasoning and long context'
  },
  {
    id: 'TEST_2025_004_ClaudeSonnet45',
    model: 'anthropic/claude-sonnet-4.5',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'Claude Sonnet 4.5 - Best structured output and safety'
  },
  {
    id: 'TEST_2025_005_Qwen3VL30B',
    model: 'qwen/qwen3-vl-30b-a3b-instruct',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'Qwen3-VL 30B - Cost-effective alternative to 235B'
  },
  {
    id: 'TEST_2025_006_GPT5ImageMini',
    model: 'openai/gpt-5-image-mini',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'GPT-5 Image Mini - Lightweight, faster version'
  },
  {
    id: 'TEST_2025_007_NovaPremier',
    model: 'amazon/nova-premier-v1',
    prompt: ENHANCED_PROMPT,
    requestFormat: 'user_role_single_image',
    description: 'Amazon Nova Premier - 1M context window'
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
      'X-Title': 'VLM Test Suite 2025',
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
    throw new Error(
      `Failed to parse JSON response: ${parseError}. Content: ${content.substring(0, 300)}`
    );
  }
}

async function runTest(config: TestConfig): Promise<TestResult> {
  console.log(`\n🧪 Running ${config.id}`);
  console.log(`   Model: ${config.model}`);
  console.log(`   ${config.description}`);

  const startTime = Date.now();
  const errors: string[] = [];

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
            description: 'List of extracted vocabulary items from the image'
          }
        },
        required: ['words'],
        additionalProperties: false
      }
    };

    const request: OpenRouterRequest = {
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: config.prompt },
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
      testId: config.id,
      model: config.model,
      prompt: config.prompt,
      requestFormat: config.requestFormat,
      extractedWords: response.words,
      expectedWords: EXPECTED_WORDS,
      matchCount: comparison.matchCount,
      missingWords: comparison.missingWords,
      extraWords: comparison.extraWords,
      accuracy: comparison.accuracy,
      timestamp: new Date().toISOString(),
      duration,
      rawResponse: response,
      errors: errors.length > 0 ? errors : undefined
    };

    const accuracyStr = comparison.accuracy.toFixed(2);
    const price = estimateCost(config.model, response.words.length, duration);
    console.log(`   ✓ Accuracy: ${accuracyStr}% (${comparison.matchCount}/${EXPECTED_WORDS.length})`);
    console.log(`   ✓ Duration: ${duration}ms ~ ${price}`);

    saveTestResult(result);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    errors.push(error instanceof Error ? error.message : String(error));
    console.error(`   ❌ Failed: ${errors.join(', ')}`);

    const result: TestResult = {
      testId: config.id,
      model: config.model,
      prompt: config.prompt,
      requestFormat: config.requestFormat,
      extractedWords: [],
      expectedWords: EXPECTED_WORDS,
      matchCount: 0,
      missingWords: EXPECTED_WORDS.map(w => w.toLowerCase()),
      extraWords: [],
      accuracy: 0,
      timestamp: new Date().toISOString(),
      duration,
      errors
    };

    saveTestResult(result);
    return result;
  }
}

function estimateCost(model: string, wordCount: number, duration: number): string {
  // Rough estimates per 1M tokens
  const pricing: Record<string, number> = {
    'qwen/qwen3-vl-235b-a22b-instruct': 0.3,
    'openai/gpt-5-image': 10.0,
    'google/gemini-2.5-flash-image': 3.0,
    'anthropic/claude-sonnet-4.5': 15.0,
    'qwen/qwen3-vl-30b-a3b-instruct': 0.1,
    'openai/gpt-5-image-mini': 2.0,
    'amazon/nova-premier-v1': 6.0
  };

  // Rough token estimation: 1 token ~ 0.75 words (image tokens extra)
  const tokens = Math.ceil(wordCount * 1.5);
  const estimatedTokens = tokens + 1000; // Add image tokens (~750 tokens for our image)
  const costPerMillion = pricing[model] || 5.0;
  const cost = (estimatedTokens / 1000000) * costPerMillion;

  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
}

async function main() {
  console.log('\n⏳ Starting test suite...\n');

  const results: TestResult[] = [];
  const failed: string[] = [];

  // Run all tests with delays to avoid rate limits
  for (let i = 0; i < testConfigs.length; i++) {
    const config = testConfigs[i];
    try {
      const result = await runTest(config);
      results.push(result);

      // Show progress
      const progress = ((i + 1) / testConfigs.length) * 100;
      console.log(`\n📊 Progress: ${progress.toFixed(0)}% (${i + 1}/${testConfigs.length})`);

      // Wait between requests (rate limit protection)
      if (i < testConfigs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`   ❌ Critical failure: ${error}`);
      failed.push(config.id);
    }
  }

  // Generate final summary
  console.log('\n' + '='.repeat(80));
  console.log('🏆 FINAL RESULTS');
  console.log('='.repeat(80));

  results.sort((a, b) => b.accuracy - a.accuracy);

  results.forEach((result, idx) => {
    const rank = idx + 1;
    const status = result.errors ? '❌' : '🏆';
    const accuracy = result.errors ? 'N/A' : `${result.accuracy.toFixed(1)}%`;
    const modelName = result.model.split('/').pop() || result.model;
    console.log(`${rank}. ${status} ${result.testId}: ${accuracy} - ${modelName}`);
  });

  if (results.length > 0) {
    const best = results[0];
    console.log('\n🎯 RECOMMENDED CONFIGURATION:');
    console.log(`   Model: ${best.model}`);
    console.log(`   Accuracy: ${best.accuracy.toFixed(1)}%`);
    console.log(`   Matched: ${best.matchCount}/${best.expectedWords.length} words`);
    const missingPercent = ((best.missingWords.length / best.expectedWords.length) * 100).toFixed(1);
    console.log(`   Missing: ${best.missingWords.length} words (${missingPercent}%)`);
    console.log(`   Duration: ${best.duration}ms`);
  }

  generateSummaryReport();

  if (failed.length > 0) {
    console.log('\n⚠️  Failed tests:', failed.join(', '));
  }

  console.log('\n✨ All tests completed!');
  console.log('📂 Results saved to: results/ directory');
  console.log('📊 Summary: SUMMARY_REPORT.md');
  console.log('💰 Cost estimates are approximate');

  process.exit(0);
}

process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});


main();
