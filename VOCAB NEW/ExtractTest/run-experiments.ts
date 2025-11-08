#!/usr/bin/env node

/**
 * Fast VLM Extraction Experiments
 *
 * Quick experiments to find the best configuration
 * Uses smaller/faster models for rapid iteration
 */

import { openRouterChat } from '../server/src/services/openrouter.js';

const TEST_IMAGE_PATH = '/Users/arthur/AI TEST/VOCAB NEW/ExtractTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg';
const EXPECTED_WORDS_PATH = '/Users/arthur/AI TEST/VOCAB NEW/ExtractTest/List1.md';

// Load image and expected words
import fs from 'fs';
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

const expectedWordsContent = fs.readFileSync(EXPECTED_WORDS_PATH, 'utf-8');
const expectedWords = expectedWordsContent
  .split('\n')
  .map(line => line.match(/^\d+\.\s*(.+)$/)?.[1]?.trim())
  .filter(Boolean);

console.log('🚀 Fast VLM Experiments');
console.log('='.repeat(80));
console.log(`Expected words: ${expectedWords.length}`);
console.log('='.repeat(80));

// Pre-defined JSON schema
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

// Test configurations - small set for fast results
const experiments = [
  {
    id: 'EXP_001',
    model: 'openai/gpt-5-image-mini',
    modelName: 'GPT-5 Image Mini',
    prompt: 'Extract all vocabulary words from this image. Include single words, phrases with sb./sth., idioms, and hyphenated terms. Return JSON array.',
    useSchema: true
  },
  {
    id: 'EXP_002',
    model: 'openai/gpt-5-image-mini',
    modelName: 'GPT-5 Image Mini',
    prompt: 'Extract all vocabulary words from this image. Include single words, phrases with sb./sth., idioms, and hyphenated terms.',
    useSchema: false
  },
  {
    id: 'EXP_003',
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    modelName: 'Gemini 2.5 Flash Lite',
    prompt: 'Extract all vocabulary words from this image. Include single words, phrases with sb./sth., idioms, and hyphenated terms. Return JSON.',
    useSchema: false
  }
];

// Compare results
function compare(extracted: string[], expected: string[]) {
  const normalizedExtracted = extracted.map(w => w.toLowerCase().trim());
  const normalizedExpected = expected.map(w => w.toLowerCase().trim());

  const matches = normalizedExtracted.filter(word => normalizedExpected.includes(word));
  const missing = normalizedExpected.filter(word => !normalizedExtracted.includes(word));
  const extra = normalizedExtracted.filter(word => !normalizedExpected.includes(word));

  return {
    accuracy: (matches.length / expected.length) * 100,
    matched: matches.length,
    total: expected.length,
    missing: missing.length,
    extra: extra.length
  };
}

// Run single experiment
async function runExperiment(exp: typeof experiments[0]) {
  console.log(`\n🧪 ${exp.id}: ${exp.modelName}`);
  console.log(`   Prompt: ${exp.prompt.substring(0, 60)}...`);

  const start = Date.now();
  const imageContent = {
    type: 'image_url' as const,
    image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
  };

  try {
    let response;
    if (exp.useSchema) {
      response = await openRouterChat({
        model: exp.model,
        messages: [
          { role: 'user', content: [imageContent, { type: 'text', text: exp.prompt }] }
        ],
        response_format: { type: 'json_schema', json_schema: schema },
        temperature: 0.1
      });
    } else {
      response = await openRouterChat({
        model: exp.model,
        messages: [
          { role: 'user', content: [imageContent, { type: 'text', text: exp.prompt }] }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });
      // Parse the content to extract words array
      if (response && typeof response === 'object' && 'words' in response) {
        response = response as { words: string[] };
      }
    }

    const duration = Date.now() - start;
    const result = compare((response as any).words || [], expectedWords);

    console.log(`   ✓ Duration: ${duration}ms`);
    console.log(`   ✓ Accuracy: ${result.accuracy.toFixed(1)}% (${result.matched}/${result.total})`);
    console.log(`   ✓ Missing: ${result.missing}, Extra: ${result.extra}`);

    fs.writeFileSync(
      `/tmp/${exp.id}_result.json`,
      JSON.stringify({ experiment: exp, result, duration, words: (response as any).words }, null, 2)
    );

    return { exp, result, duration, words: (response as any).words };
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
    return { exp, error, duration: Date.now() - start };
  }
}

// Run all experiments
async function main() {
  console.log(`\n📊 Running ${experiments.length} experiments...\n`);

  const results = [];

  for (const exp of experiments) {
    const result = await runExperiment(exp);
    results.push(result);

    // Brief delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏆 FINAL RESULTS');
  console.log('='.repeat(80));

  const successful = results.filter(r => !('error' in r));
  successful.forEach((r, i) => {
    const rank = i + 1;
    console.log(`${rank}. ${r.exp.id}: ${r.result.accuracy.toFixed(1)}% - ${r.exp.modelName} (${r.duration}ms)`);
  });

  if (successful.length > 0) {
    const best = successful[0];
    console.log('\n🎯 RECOMMENDED:');
    console.log(`   Model: ${best.exp.modelName}`);
    console.log(`   Accuracy: ${best.result.accuracy.toFixed(1)}%`);
    console.log(`   Words matched: ${best.result.matched}/${best.result.total}`);
    console.log(`   JSON Schema: ${best.exp.useSchema ? 'Yes' : 'No'}`);
  }

  console.log('\n✨ Experiments completed!');
  console.log('📄 Detailed results saved to /tmp/ directory');
}

// Add utility functions to make it importable
async function testPrompt(prompt: string, model = 'openai/gpt-5-image-mini') {
  const start = Date.now();
  const response = await openRouterChat({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          },
          { type: 'text', text: prompt }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 4000
  });

  const duration = Date.now() - start;
  const result = compare((response as any).words || [], expectedWords);

  return {
    prompt,
    accuracy: result.accuracy,
    matched: result.matched,
    total: result.total,
    duration
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testPrompt, expectedWords };
