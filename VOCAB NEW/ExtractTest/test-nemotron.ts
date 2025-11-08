#!/usr/bin/env node

/**
 * Test NVIDIA Nemotron Nano 12B V2 (free model)
 * Uses optimized prompt to compare with GPT-5 and Qwen3
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

console.log('🚀 Testing NVIDIA Nemotron Nano 12B V2');
console.log('Model: nvidia/nemotron-nano-12b-v2-vl:free');
console.log('Cost: FREE (0.00)');
console.log('='.repeat(80));

// Load image
const TEST_IMAGE_PATH = path.join(__dirname, '1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg');
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

// Optimized prompt (PROMPT_V2 - winner!)
const OPTIMIZED_PROMPT = `Extract vocabulary words from this image.

CRITICAL: DO NOT include any trailing punctuation like colons (:) or semicolons (;).
Return each word EXACTLY as shown, but WITHOUT any trailing punctuation.

Return JSON: {"words": ["word1", "word2", ...]}`;

// JSON Schema
const JSON_SCHEMA = {
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

async function testNemotron() {
  const requestBody = {
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
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
    response_format: {
      type: 'json_schema',
      json_schema: JSON_SCHEMA
    },
    max_tokens: 4000
  };

  console.log('📋 Request Details:');
  console.log(`   Model: nvidia/nemotron-nano-12b-v2-vl:free`);
  console.log(`   Proxy: ${PROXY_URL}`);
  console.log(`   Cost: FREE`);
  console.log('');

  const startTime = Date.now();

  try {
    console.log('⏳ Sending request to Nemotron (free) via proxy...\n');

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
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Model returned empty response');
    }

    const result = JSON.parse(content) as ExtractResult;

    console.log('✅ SUCCESS!');
    console.log(`   Duration: ${responseTime}ms`);
    console.log(`   Extracted: ${result.words.length} words\n`);

    console.log('🎯 Sample Output (first 20 words):');
    result.words.slice(0, 20).forEach((word, i) => {
      console.log(`   ${i + 1}. "${word}"`);
    });

    if (result.words.length > 20) {
      console.log('   ...');
    }

    // Quality check
    const wordsWithColons = result.words.filter((w) => w.includes(':'));
    const wordsWithTrailingPunctuation = result.words.filter((w) => /[:;]$/.test(w));
    const hasNumbering = result.words.some(w => /^\d+\./.test(w));

    console.log('\n🔍 Quality Check:');
    console.log(`   Words with colons: ${wordsWithColons.length}`);
    console.log(`   Words with trailing punctuation: ${wordsWithTrailingPunctuation.length}`);
    console.log(`   Has numbering: ${hasNumbering}`);

    if (wordsWithTrailingPunctuation.length > 0) {
      console.log('\n   ⚠️  Words needing cleanup:');
      wordsWithTrailingPunctuation.slice(0, 10).forEach((w) => {
        console.log(`      - "${w}"`);
      });
      if (wordsWithTrailingPunctuation.length > 10) {
        console.log(`      ... and ${wordsWithTrailingPunctuation.length - 10} more`);
      }
    } else {
      console.log('   ✅ Perfect! No trailing punctuation');
    }

    if (hasNumbering) {
      console.log('\n   ⚠️  Some words still have numbering (e.g., "1. word")');
    }

    // Cost comparison
    console.log('\n💰 Cost Comparison (per extraction):');
    console.log(`   This model (Nemotron): $0.00 (FREE)`);
    console.log(`   Qwen3-VL-235B:        $0.003`);
    console.log(`   GPT-5 Image:         $0.01-0.03`);

    // Save result
    const outputFile = `/tmp/nemotron_test_result_${Date.now()}.json`;
    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          model: 'nvidia/nemotron-nano-12b-v2-vl:free',
          prompt: 'OPTIMIZED_PROMPT_V2',
          duration: responseTime,
          words: result.words,
          wordCount: result.words.length,
          issues: {
            hasColons: wordsWithColons.length > 0,
            hasTrailingPunctuation: wordsWithTrailingPunctuation.length > 0,
            hasNumbering: hasNumbering,
            trailingPunctuationWords: wordsWithTrailingPunctuation
          }
        },
        null,
        2
      )
    );

    console.log(`\n📄 Full result saved to: ${outputFile}`);

    return {
      success: true,
      wordCount: result.words.length,
      issues: wordsWithTrailingPunctuation.length
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ TEST FAILED');
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    console.error(`   Duration: ${duration}ms`);

    return {
      success: false,
      error
    };
  }
}

// Run test
testNemotron()
  .then((result) => {
    if (result.success) {
      console.log(`\n🏆 FINAL RESULT: ${result.wordCount} words extracted`);
      if (result.issues === 0) {
        console.log('✅ Perfect! No issues detected');
        console.log('\n💡 This FREE model extracted clean text!');
      } else {
        console.log(`⚠️  ${result.issues} words need cleanup`);
      }
    } else {
      console.log('\n💡 Tip: Check your proxy is running on port 7890');
      console.log('   Ensure OPENROUTER_API_KEY is valid');
      console.log('   Verify image file exists');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
