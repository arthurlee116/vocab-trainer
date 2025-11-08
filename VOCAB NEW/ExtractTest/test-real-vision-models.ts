#!/usr/bin/env node

/**
 * Test REAL Vision-Language Models (NOT image generation models)
 * Correct models for vision + text understanding:
 * - openai/gpt-5-mini
 * - openai/gpt-4o
 * - anthropic/claude-3.5-sonnet
 * - google/gemini-2.0-flash
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

console.log('🎯 Testing REAL Vision-Language Models');
console.log('(NOT image generation models)');
console.log('='.repeat(80));

// Load image
const TEST_IMAGE_PATH = path.join(__dirname, '1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg');
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

// Optimized prompt (PROMPT_V2 - winner!)
const OPTIMIZED_PROMPT = `Extract vocabulary words from this image.

CRITICAL: DO NOT include any trailing punctuation like colons (:) or semicolons (;).
Return each word EXACTLY as shown, but WITHOUT any trailing punctuation.

Return JSON: {"words": ["word1", "word2", ...]}`;

// Proxy
const PROXY_URL = 'http://127.0.0.1:7890';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ExtractResult {
  words: string[];
}

interface ModelTest {
  id: string;
  name: string;
  model: string;
  supportsTemperature?: boolean;
  supportsJsonSchema?: boolean;
}

const VISION_MODELS: ModelTest[] = [
  {
    id: 'GPT5_MINI',
    name: 'GPT-5 Mini',
    model: 'openai/gpt-5-mini',
    supportsTemperature: true,
    supportsJsonSchema: true
  },
  {
    id: 'GPT4O',
    name: 'GPT-4o',
    model: 'openai/gpt-4o',
    supportsTemperature: true,
    supportsJsonSchema: true
  },
  {
    id: 'CLAUDE_35_sonnet',
    name: 'Claude 3.5 Sonnet',
    model: 'anthropic/claude-3.5-sonnet',
    supportsTemperature: true,
    supportsJsonSchema: true
  },
  {
    id: 'GEMINI_20_FLASH',
    name: 'Gemini 2.0 Flash',
    model: 'google/gemini-2.0-flash',
    supportsTemperature: true,
    supportsJsonSchema: true
  }
];

// Test a single model
async function testModel(modelConfig: ModelTest): Promise<{
  success: boolean;
  wordCount?: number;
  duration?: number;
  error?: string;
  words?: string[];
}> {
  console.log(`\n🧪 Testing: ${modelConfig.name}`);
  console.log(`   Model ID: ${modelConfig.model}`);

  const startTime = Date.now();

  // JSON Schema
  const schema = {
    name: 'word_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1
        }
      },
      required: ['words'],
      additionalProperties: false
    }
  };

  const requestBody: any = {
    model: modelConfig.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OPTIMIZED_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }
    ],
    max_tokens: 4000
  };

  // Add optional parameters
  if (modelConfig.supportsTemperature) {
    requestBody.temperature = 0.1;
  }

  if (modelConfig.supportsJsonSchema) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: schema
    };
  } else {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...requestBody, stream: false }),
      agent: proxyAgent
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from model');
    }

    // Parse response
    let result: ExtractResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Try to clean markdown if present
      const cleanContent = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
      try {
        result = JSON.parse(cleanContent);
      } catch (e) {
        console.log('   Raw response (first 300 chars):', content.substring(0, 300));
        throw new Error(`Failed to parse JSON: ${parseError}`);
      }
    }

    // Validate
    if (!result.words || !Array.isArray(result.words)) {
      console.error('   Invalid response structure:', Object.keys(result));
      throw new Error('Response missing words array');
    }

    // Quality check
    const wordsWithTrailingPunct = result.words.filter(w => /[:;]$/.test(w));

    console.log(`   ✅ Success! ${result.words.length} words in ${responseTime}ms`);
    console.log(`   Quality: ${wordsWithTrailingPunct.length} words with trailing punctuation`);

    // Sample
    console.log(`   Sample: ${result.words.slice(0, 5).join(', ')}...`);

    return {
      success: true,
      wordCount: result.words.length,
      duration: responseTime,
      words: result.words
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run all tests
async function main() {
  console.log('📊 Testing Real Vision-Language Models');
  console.log(`Proxy: ${PROXY_URL}\n`);

  const results = [];

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const model = VISION_MODELS[i];
    const result = await testModel(model);

    results.push({
      ...model,
      ...result
    });

    if (i < VISION_MODELS.length - 1) {
      console.log('\n   ⏳ Waiting 2 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('🏆 VISION MODEL RESULTS SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);

  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    const details = r.success
      ? `${r.wordCount} words, ${r.duration}ms`
      : `Failed: ${r.error?.substring(0, 50)}...`;
    console.log(`${i + 1}. ${status} ${r.name}: ${details}`);
  });

  if (successful.length > 0) {
    console.log('\n🎯 WINNER MODELS:');
    successful.forEach(r => {
      console.log(`   - ${r.name}: ${r.wordCount} words in ${r.duration}ms`);
    });
  }

  // Save results
  const outputFile = `/tmp/vision_models_results_${Date.now()}.json`;
  fs.writeFileSync(
    outputFile,
    JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2)
  );

  console.log(`\n📄 Full results saved to: ${outputFile}`);
  console.log('✨ Vision model testing complete!');

  process.exit(0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
