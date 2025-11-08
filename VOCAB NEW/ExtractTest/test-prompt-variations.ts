#!/usr/bin/env node

/**
 * Manual Prompt Variation Testing
 * Tests multiple prompt strategies to find best one that prevents colon artifacts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

import fs from 'fs';

const TEST_IMAGE_PATH = path.join(__dirname, '1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg');
const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString('base64');

console.log('🎯 PROMPT VARIATION TESTING WITH PROXY');
console.log('Testing strategies to prevent colon artifacts');
console.log('='.repeat(80));

// HTTP Proxy Agent
import { HttpsProxyAgent } from 'https-proxy-agent';

// Define proxy
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890');

interface ApiResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

interface TestResult {
  promptId: string;
  promptText: string;
  model: string;
  success: boolean;
  extractedWords: string[];
  issues: {
    hasColons: boolean;
    hasTrailingPunctuation: string[];
    hasIncorrectFormatting: boolean;
  };
  sampleWords: string[];
  error?: string;
  duration: number;
}

// Prompt variations to test
const PROMPT_VARIATIONS = [
  {
    id: 'PROMPT_V1_Basic',
    name: 'Basic Extraction',
    prompt: 'Extract all words from this image. Return as JSON array.',
  },
  {
    id: 'PROMPT_V2_NoPunctuation',
    name: 'Explicit No Punctuation',
    prompt: `Extract vocabulary words from this image.

CRITICAL: DO NOT include any trailing punctuation like colons (:) or semicolons (;).
Return each word EXACTLY as shown, but WITHOUT any trailing punctuation.

Return JSON: {"words": ["word1", "word2", ...]}`,
  },
  {
    id: 'PROMPT_V3_StripColons',
    name: 'Explicit Strip Colons',
    prompt: `Extract vocabulary words from this image.

CRITICAL INSTRUCTIONS:
1. Examine the numbered list items
2. For each numbered item ("1. word:"), extract ONLY the word itself
3. REMOVE the number, the period after the number, and the trailing colon
4. Return ONLY the clean word without any punctuation at the end

Example: "1. anthropology:" → extract "anthropology" (without colon)
Example: "2. balance out:" → extract "balance out" (without colon)

Return JSON: {"words": ["word1", "word2", ...]}`,
  },
  {
    id: 'PROMPT_V4_AfterNumberOnly',
    name: 'After Number Only',
    prompt: `Extract vocabulary words from this numbered list.

CRITICAL: Extract ONLY the text that appears AFTER each number (1., 2., 3., etc.).
Do not include the number, the period after the number, or any trailing punctuation.

Example: "1. anthropology:" → extract "anthropology"
Example: "4. stunting:" → extract "stunting"
Example: "9. hangs in the balance:" → extract "hangs in the balance"

Return JSON: {"words": ["word1", "word2", ...]}`,
  },
  {
    id: 'PROMPT_V5_RoleStrict',
    name: 'Strict OCR Role',
    prompt: `You are a precise OCR system with zero tolerance for errors.

Your task: Read the numbered vocabulary list and extract each word/phrase EXACTLY as it appears.

RULES (follow strictly):
1. Read past each number (1., 2., 3., etc.) - extract only what follows
2. If the text ends with punctuation (colon : or semicolon ;), REMOVE it
3. Keep all internal punctuation like sb./sth., hyphens, apostrophes
4. Return clean, minimal JSON array

Example items:
For "1. anthropology:" → return "anthropology"
For "12. balance out:" → return "balance out"
For "29. a cat has nine lives" → return "a cat has nine lives"

Output format: {"words": ["item1", "item2", ...]}`,
  },
  {
    id: 'PROMPT_V6_ProgrammingStyle',
    name: 'Programming Style',
    prompt: `TASK: Parse vocabulary list from image.

INPUT FORMAT:
- Numbered list (1. word:, 2. word:, etc.)
- Each item ends with colon or punctuation
- Some items are phrases or idioms

OUTPUT REQUIREMENT:
- Return array of strings
- Strip numbering prefix ("1. ", "2. ", etc.)
- Strip trailing colons and semicolons
- Preserve internal formatting (sb./sth., hyphens, apostrophes)
- No markdown, just raw JSON

EXAMPLES:
Input: "1. anthropology:" → Output: "anthropology"
Input: "4. hold sb. accountable for:" → Output: "hold sb. accountable for"
Input: "98. far-fetched" → Output: "far-fetched"

Return: {"words": ["item1", "item2", ...]}`,
  },
  {
    id: 'PROMPT_V7_JSONSchemaEnforced',
    name: 'JSON Schema Enforced',
    prompt: `You are a strict JSON output generator.

Your data schema requires an array of clean vocabulary strings.

 CONSTRAINTS:
- Each string must NOT end with : or ; punctuation
- Each string must NOT start with digits or numbering
- Internal punctuation (sb./sth., hyphens) is allowed
- Return valid JSON only

PROCESS:
1. Read each numbered item
2. Remove numeric prefix ("1.", "2.", etc.)
3. Remove trailing punctuation (: ; .)
4. Keep the cleaned text as an array element
5. Output JSON: {"words": ["clean1", "clean2", ...]}

The words in your output will be validated against the schema. Any with trailing colons will be rejected.`,
  },
  {
    id: 'PROMPT_V8_ThinkStepByStep',
    name: 'Chain-of-Thought',
    prompt: `Analyze this vocabulary list step-by-step.

Step 1: Identify the pattern - numbered items with text
Step 2: For each item, separate the number from the text
Step 3: Remove the number and period (e.g., "1.")
Step 4: Check if text ends with punctuation (: or ;)
Step 5: If yes, remove that trailing punctuation
Step 6: Keep the cleaned text

Example walkthrough:
- See: "1. anthropology:"
- Remove: "1." → "anthropology:"
- Check end: has colon
- Remove colon → "anthropology"
- Add to result array

Proceed through all items and return JSON: {"words": ["cleaned1", "cleaned2", ...]}`,
  },
];

// Test with Qwen3-VL-235B (most successful model from previous tests)
const TEST_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';

// Override fetch to use proxy
async function callOpenRouterWithProxy(prompt: string): Promise<{ words: string[] }> {
  const schema = {
    name: 'word_extraction',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        words: { type: 'array', items: { type: 'string' }, minItems: 1 }
      },
      required: ['words'],
      additionalProperties: false
    }
  };

  const requestBody = {
    model: TEST_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature: 0.1,
    max_tokens: 4000
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      'X-Title': 'Prompt Variation Test',
    },
    body: JSON.stringify({ ...requestBody, stream: false }),
    // Use proxy agent
    agent: proxyAgent
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as ApiResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Model returned empty response');
  }

  return JSON.parse(content);
}

// Analyze extracted words for issues
function analyzeExtraction(words: string[]): any {
  const issues = {
    hasColons: words.some(w => w.includes(':')),
    trailingPunctuation: words.filter(w => /[:;]$/.test(w)),
    incorrectFormatting: words.some(w => w.match(/^\d+\./) || w.includes('(n.)') || w.includes('(v.)') || w.includes('(adj.)')),
  };

  return issues;
}

// Test a single prompt variation
async function testPromptVariation(variation: typeof PROMPT_VARIATIONS[0]): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${variation.name}`);
  console.log(`   ID: ${variation.id}`);

  const startTime = Date.now();

  try {
    const result = await callOpenRouterWithProxy(variation.prompt);
    const duration = Date.now() - startTime;

    const extractedWords = result.words || [];
    const issues = analyzeExtraction(extractedWords);

    // Sample first 10 words for review
    const sampleWords = extractedWords.slice(0, 10);

    console.log(`   ✓ Duration: ${duration}ms`);
    console.log(`   ✓ Extracted: ${extractedWords.length} words`);
    console.log(`   ✓ Sample: ${sampleWords.join(', ')}`);
    console.log(`   Issues: ${JSON.stringify(issues, null, 2)}`);

    return {
      promptId: variation.id,
      promptText: variation.prompt,
      model: TEST_MODEL,
      success: true,
      extractedWords,
      issues,
      sampleWords,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`   ❌ Failed: ${error}`);

    return {
      promptId: variation.id,
      promptText: variation.prompt,
      model: TEST_MODEL,
      success: false,
      extractedWords: [],
      issues: { hasColons: false, trailingPunctuation: [], incorrectFormatting: false },
      sampleWords: [],
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  console.log(`\nTarget Model: ${TEST_MODEL}`);
  console.log(`Proxy: http://127.0.0.1:7890`);
  console.log('='.repeat(80));

  const results: TestResult[] = [];

  // Test each prompt variation
  for (const variation of PROMPT_VARIATIONS) {
    const result = await testPromptVariation(variation);
    results.push(result);

    if (results.length < PROMPT_VARIATIONS.length) {
      // Wait between requests
      console.log('\n   ⏳ Waiting 2 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('🏆 PROMPT VARIATION RESULTS');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);

  successful.forEach((r, i) => {
    const rank = i + 1;
    const hasProblems = r.issues.hasColons || r.issues.trailingPunctuation.length > 0 || r.issues.incorrectFormatting;
    const status = hasProblems ? '⚠️' : '✅';
    console.log(`${rank}. ${status} ${r.promptId}: ${r.extractedWords.length} words, issues: ${JSON.stringify(r.issues)}`);
  });

  // Find best performing prompt
  const bestPrompt = successful.find(r => !r.issues.hasColons && r.issues.trailingPunctuation.length === 0);

  if (bestPrompt) {
    console.log('\n🎯 BEST PROMPT:');
    console.log(`   Name: ${bestPrompt.promptId}`);
    console.log(`   Extracted: ${bestPrompt.extractedWords.length} words`);
    console.log(`   No colons! ✅`);
  } else {
    console.log('\n⚠️ No prompt completely eliminated issues');
    console.log('   Suggest: Use post-processing + best prompt');

    // Find the one with least issues
    const ranked = successful.map(r => ({
      ...r,
      issueScore: (r.issues.hasColons ? 1 : 0) + r.issues.trailingPunctuation.length
    })).sort((a, b) => a.issueScore - b.issueScore);

    if (ranked.length > 0) {
      console.log(`\n   Least problematic: ${ranked[0].promptId} (score: ${ranked[0].issueScore})`);
    }
  }

  // Save detailed results
  const resultsPath = path.join(__dirname, 'results', `prompt_variations_${Date.now()}.json`);
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));

  console.log('\n📄 Saved detailed results to:', resultsPath);
  console.log('✨ Prompt variation testing complete!');

  process.exit(0);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
