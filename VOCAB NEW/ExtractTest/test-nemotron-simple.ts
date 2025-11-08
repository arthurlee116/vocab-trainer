#!/usr/bin/env node

/**
 * Test NVIDIA Nemotron Nano 12B V2 with simpler format (no strict schema)
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

console.log('🚀 Testing NVIDIA Nemotron Nano 12B V2 (Simple Format)');
console.log('Model: nvidia/nemotron-nano-12b-v2-vl:free');
console.log('Cost: FREE (0.00)');
console.log('Format: Simple JSON (no strict schema)\n');

// Load image
const TEST_IMAGE_PATH = path.join(__dirname, '1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg');
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

// Simple, direct prompt
const SIMPLE_PROMPT = `Extract vocabulary words from this image.

Extract all vocabulary words exactly as they appear.
DO NOT include numbers or numbering.
DO NOT include trailing colons (:) or punctuation.

Return as JSON array: ["word1", "word2", ...]`;

// Proxy
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

async function testNemotronSimple() {
  const requestBody = {
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SIMPLE_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 4000
  };

  const startTime = Date.now();

  try {
    console.log('⏳ Sending request (simple format)...\n');

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

    console.log('✅ Received response!');
    console.log(`   Duration: ${responseTime}ms`);
    console.log(`   Raw content length: ${content.length} chars\n`);

    console.log('📄 Raw response (first 500 chars):');
    console.log(content.substring(0, 500));
    if (content.length > 500) {
      console.log('   ... [truncated]');
    }
    console.log('');

    // Try to parse as JSON
    let result: string[] | null = null;
    let parseError = null;

    try {
      // Try parsing as direct JSON array
      result = JSON.parse(content);
      console.log('✅ Successfully parsed as JSON array');
    } catch (e) {
      parseError = e;
      console.log('❌ Could not parse as JSON array directly');

      // Try wrapping in an object
      try {
        const wrapped = JSON.parse(`{"words": ${content}}`);
        result = wrapped.words;
        console.log('✅ Successfully parsed as object with words array');
      } catch (e2) {
        parseError = e2;
        console.log('❌ Could not parse with wrapping either');
      }
    }

    if (result && Array.isArray(result)) {
      console.log(`\n🎯 Extracted ${result.length} words:`);
      console.log('Sample words:');
      result.slice(0, 20).forEach((word, i) => {
        console.log(`   ${i + 1}. "${word}"`);
      });

      // Quality checks
      const hasColons = result.some((w: string) => typeof w === 'string' && w.includes(':'));
      const withTrailingPunct = result.filter((w: string) => typeof w === 'string' && /[:;]$/.test(w));
      const hasNumbering = result.some((w: string) => typeof w === 'string' && /^\d+\./.test(w));

      console.log('\n🔍 Quality Check:');
      console.log(`   Has colons: ${hasColons}`);
      console.log(`   Words with trailing punctuation: ${withTrailingPunct.length}`);
      console.log(`   Has numbering: ${hasNumbering}`);

      if (withTrailingPunct.length > 0) {
        console.log('\n   Words needing cleanup:');
        withTrailingPunct.slice(0, 10).forEach(w => console.log(`      - "${w}"`));
      }

      // Save
      const outputFile = `/tmp/nemotron_simple_result_${Date.now()}.json`;
      fs.writeFileSync(outputFile, JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        duration: responseTime,
        words: result,
        wordCount: result.length,
        quality: { hasColons, trailingPunctuationCount: withTrailingPunct.length, hasNumbering }
      }, null, 2));
      console.log(`\n📄 Result saved to: ${outputFile}`);

      return { success: true, wordCount: result.length, issues: withTrailingPunct.length };
    } else {
      console.log('\n❌ Could not parse response');
      console.log(`   Error: ${parseError}`);

      // Save raw response for analysis
      const errorFile = `/tmp/nemotron_error_${Date.now()}.txt`;
      fs.writeFileSync(errorFile, content);
      console.log(`\n📄 Raw response saved to: ${errorFile}`);

      return { success: false, error: 'Parse failed', duration: responseTime };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ TEST FAILED');
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    console.error(`   Duration: ${duration}ms`);
    return { success: false, error };
  }
}

// Run test
testNemotronSimple()
  .then(result => {
    if (result.success) {
      console.log(`\n🏆 FINAL RESULT: ${result.wordCount} words extracted`);
      if (result.issues === 0) console.log('✅ Perfect! No issues');
      else console.log(`⚠️  ${result.issues} words need cleanup`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
