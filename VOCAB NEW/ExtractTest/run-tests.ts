#!/usr/bin/env node

/**
 * VLM Extraction Test Suite
 *
 * This script tests different VLM (Vision Language Model) configurations for
 * extracting vocabulary words from images. It compares results against a known
 * ground truth to find the best combination of:
 * - Model selection
 * - Prompt engineering
 * - Request formatting
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

// Expected words from ground truth
const EXPECTED_WORDS = loadExpectedWords();
const TEST_IMAGE_BASE64 = loadTestImage();

console.log('='.repeat(80));
console.log('VLM EXTRACTION EXPERIMENT');
console.log('='.repeat(80));
console.log(`Expected words: ${EXPECTED_WORDS.length}`);
console.log(`Image size: ${(TEST_IMAGE_BASE64.length / 1024).toFixed(2)} KB (base64)`);
console.log('='.repeat(80));

// Define test configurations
const testConfigs: TestConfig[] = [
  {
    id: 'TEST_001_Baseline',
    model: 'x-ai/grok-4-fast',
    prompt: 'Read every word across all images and return a deduplicated list following the schema. Extract only clean English vocabulary tokens from study sheets, return lowercase single tokens.',
    requestFormat: 'system_role_with_image',
    description: 'Current production approach'
  },
  {
    id: 'TEST_002_GPT4_ImprovedPrompt',
    model: 'google/gemini-2.0-flash-exp:free',
    prompt: 'You are a vocabulary extraction assistant. Carefully examine the image and extract all English vocabulary words and phrases. Look for:\n- Individual words\n- Phrases and idioms\n- Words with special characters (hyphens, apostrophes)\n- Phrases with periods or abbreviations\n\nReturn each item exactly as it appears (do not change case or format). Do not include the numbers or bullet points.',
    requestFormat: 'user_role_single_image',
    description: 'Gemini 2.0 Flash with detailed prompt'
  },
  {
    id: 'TEST_003_GPT5_Basic',
    model: 'openai/gpt-4o',
    prompt: 'Extract all English vocabulary words and phrases from this image. Return each item exactly as it appears in the source material.',
    requestFormat: 'user_role_single_image',
    description: 'GPT-4o with explicit instruction'
  },
  {
    id: 'TEST_004_GPT5_Detailed',
    model: 'openai/gpt-4o',
    prompt: 'You are a vocabulary extraction expert. Analyze this image and extract ALL English vocabulary terms.\n\nIMPORTANT: Preserve the exact spelling, punctuation, and formatting of each term, including:\n- Hyphenated words (e.g., \"far-fetched\")\n- Phrases with periods (e.g., \"hold sb. accountable\")\n- Contractions and possessives (e.g., \"cat\'s\")\n- Numbered expressions (e.g., \"nine lives\")\n- Multi-word idioms and phrases\n\nDo not modify the terms. Return them exactly as they appear in the image.',
    requestFormat: 'user_role_single_image',
    description: 'GPT-4o with explicit formatting preservation'
  },
  {
    id: 'TEST_005_GPT4oMini',
    model: 'openai/gpt-4o-mini',
    prompt: 'Extract all vocabulary words and phrases from this image. Return them exactly as they appear, preserving formatting, punctuation, and multi-word expressions.',
    requestFormat: 'user_role_single_image',
    description: 'GPT-4o-mini with formatting preservation prompt'
  },
  {
    id: 'TEST_006_Gemini_Standard',
    model: 'google/gemini-2.0-flash-exp:free',
    prompt: 'Extract all vocabulary words and phrases from this image. Preserve the exact formatting, including hyphens, apostrophes, and periods.',
    requestFormat: 'user_role_single_image',
    description: 'Gemini 2.0 Flash standard prompt'
  }
];

// OpenRouter API client
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: any;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_schema' | 'json_object';
    json_schema?: any;
  };
}

interface ExtractWordsResponse {
  words: string[];
}

async function callOpenRouter(payload: OpenRouterRequest): Promise<ExtractWordsResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      'X-Title': 'VLM Test Suite',
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
    throw new Error(`Failed to parse JSON response: ${parseError}. Content: ${content.substring(0, 200)}`);
  }
}

// Run a single test
async function runTest(config: TestConfig): Promise<TestResult> {
  console.log(`\n🧪 Running ${config.id} - ${config.model}`);
  console.log(`Description: ${config.description}`);

  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // JSON schema for structured output
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
            description: 'List of extracted vocabulary words and phrases from the image'
          }
        },
        required: ['words'],
        additionalProperties: false
      }
    };

    // Build request based on format
    let request: OpenRouterRequest;

    if (config.requestFormat === 'system_role_with_image') {
      // Original format: image in system role
      request = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: [{
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${TEST_IMAGE_BASE64}` }
            }]
          },
          {
            role: 'user',
            content: config.prompt
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: schema
        },
        temperature: 0.1
      };
    } else if (config.requestFormat === 'user_role_single_image') {
      // New format: image in user role with text
      request = {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: config.prompt
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${TEST_IMAGE_BASE64}` }
              }
            ]
          }
        ],
        response_format: {
          type: 'json_object'
        },
        temperature: 0.1
      };
    } else {
      throw new Error(`Unknown request format: ${config.requestFormat}`);
    }

    // Call the API
    const response = await callOpenRouter(request);
    const duration = Date.now() - startTime;

    // Compare with expected
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

    printTestResult(result);
    saveTestResult(result);

    console.log(`✓ Test completed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    errors.push(error instanceof Error ? error.message : String(error));

    console.error(`❌ Test failed: ${errors.join(', ')}`);

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

// Main execution
async function main() {
  const results: TestResult[] = [];

  // Run all tests sequentially to avoid rate limits
  for (const config of testConfigs) {
    try {
      const result = await runTest(config);
      results.push(result);

      // Small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to run test ${config.id}:`, error);
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(80));

  results.sort((a, b) => b.accuracy - a.accuracy);

  results.forEach((result, index) => {
    const status = result.errors ? '❌' : '✓';
    const accuracy = result.errors ? 'N/A' : `${result.accuracy.toFixed(2)}%`;
    console.log(`${index + 1}. ${status} ${result.testId}: ${accuracy} (${result.model})`);
  });

  if (results.length > 0) {
    const best = results[0];
    console.log('\n🎯 Best Configuration:');
    console.log(`   Model: ${best.model}`);
    console.log(`   Accuracy: ${best.accuracy.toFixed(2)}%`);
    console.log(`   Matched: ${best.matchCount}/${best.expectedWords.length}`);
    console.log(`   Test ID: ${best.testId}`);
  }

  generateSummaryReport();

  console.log('\n✨ All tests completed. Check the results/ directory for detailed outputs.');
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run if this is the main module
if (require.main === module) {
  main();
}
