#!/usr/bin/env node

/**
 * Test GPT-5 with optimized prompt via proxy
 * Uses the winning prompt from prompt variation testing
 */

import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Load image
const TEST_IMAGE_PATH = '/Users/arthur/AI TEST/VOCAB NEW/ExtractTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg';
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

// API Configuration
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY not found');
  process.exit(1);
}

console.log('🚀 Testing GPT-5 WITH PROXY');
console.log('==============================\n');

// Optimized prompt from previous tests (PROMPT_V2 - Winner!)
const OPTIMIZED_PROMPT = `Extract vocabulary words from this image.

CRITICAL: DO NOT include any trailing punctuation like colons (:) or semicolons (;).
Return each word EXACTLY as shown, but WITHOUT any trailing punctuation.

Return JSON: {"words": ["word1", "word2", ...]}`;

// JSON Schema for validation
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

// Proxy configuration
const PROXY_URL = 'http://127.0.0.1:7890';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);

// API Request
declare global {
  var fetch: any;
}

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

async function testGPT5() {
  const requestBody = {
    model: 'openai/gpt-5-image',
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
    temperature: 0.1,
    max_tokens: 4000
  };

  console.log('📋 Request Details:');
  console.log(`   Model: openai/gpt-5-image`);
  console.log(`   Proxy: ${PROXY_URL}`);
  console.log(`   Prompt: Optimized (no punctuation instruction)`);
  console.log('');

  const startTime = Date.now();

  try {
    console.log('⏳ Sending request to GPT-5 via proxy...\n');

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

    // Check for any issues
    const wordsWithColons = result.words.filter((w) => w.includes(':'));
    const wordsWithTrailingPunctuation = result.words.filter((w) => /[:;]$/.test(w));

    console.log('\n🔍 Quality Check:');
    console.log(`   Words with colons: ${wordsWithColons.length}`);
    console.log(`   Words with trailing punctuation: ${wordsWithTrailingPunctuation.length}`);

    if (wordsWithTrailingPunctuation.length > 0) {
      console.log('\n   ⚠️  Words needing cleanup:');
      wordsWithTrailingPunctuation.forEach((w) => console.log(`      - "${w}"`));
    } else {
      console.log('   ✅ Perfect! No trailing punctuation');
    }

    // Save result
    const outputFile = `/tmp/gpt5_test_result_${Date.now()}.json`;
    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          model: 'openai/gpt-5-image',
          prompt: 'OPTIMIZED_PROMPT_V2',
          duration: responseTime,
          words: result.words,
          wordCount: result.words.length,
          issues: {
            hasColons: wordsWithColons.length > 0,
            trailingPunctuation: wordsWithTrailingPunctuation
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
testGPT5()
  .then((result) => {
    if (result.success) {
      console.log(`\n🏆 FINAL RESULT: ${result.wordCount} words extracted`);
      if (result.issues === 0) {
        console.log('✅ Perfect! No issues detected');
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
