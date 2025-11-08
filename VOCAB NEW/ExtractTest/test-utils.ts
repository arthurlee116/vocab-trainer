import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import fs from 'fs';
import path from 'path';

export interface TestResult {
  testId: string;
  model: string;
  prompt: string;
  requestFormat: string;
  extractedWords: string[];
  expectedWords: string[];
  matchCount: number;
  missingWords: string[];
  extraWords: string[];
  accuracy: number;
  timestamp: string;
  duration: number;
  rawResponse?: any;
  errors?: string[];
}

export interface TestConfig {
  id: string;
  model: string;
  prompt: string;
  requestFormat: string;
  description: string;
}

/**
 * Parse the expected words from List1.md
 */
export function loadExpectedWords(): string[] {
  const filePath = path.join(__dirname, 'List1.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  const words = content
    .split('\n')
    .map(line => {
      // Remove number prefix like "1. " or "10. "
      const match = line.match(/^\d+\.\s*(.+)$/);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean) as string[];

  return words;
}

/**
 * Load the test image as base64
 */
export function loadTestImage(): string {
  const imagePath = path.join(
    __dirname,
    '1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg'
  );
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * Compare extracted words with expected words
 */
export function compareResults(
  extracted: string[],
  expected: string[]
): {
  matchCount: number;
  missingWords: string[];
  extraWords: string[];
  accuracy: number;
} {
  // Normalize both arrays (lowercase, trim)
  const normalizedExtracted = extracted.map(w => w.toLowerCase().trim());
  const normalizedExpected = expected.map(w => w.toLowerCase().trim());

  const matches = normalizedExtracted.filter(word =>
    normalizedExpected.includes(word)
  );

  const missing = normalizedExpected.filter(word =>
    !normalizedExtracted.includes(word)
  );

  const extra = normalizedExtracted.filter(word =>
    !normalizedExpected.includes(word)
  );

  const accuracy = (matches.length / normalizedExpected.length) * 100;

  return {
    matchCount: matches.length,
    missingWords: missing,
    extraWords: extra,
    accuracy
  };
}

/**
 * Save test result to JSON file
 */
export function saveTestResult(result: TestResult): void {
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const fileName = `${result.testId}_${Date.now()}.json`;
  const filePath = path.join(resultsDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`✓ Test result saved to: ${fileName}`);
}

/**
 * Generate a summary report from all test results
 */
export function generateSummaryReport(): void {
  const resultsDir = path.join(__dirname, 'results');

  if (!fs.existsSync(resultsDir)) {
    console.log('No test results found.');
    return;
  }

  const files = fs
    .readdirSync(resultsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf-8')))
    .sort((a: TestResult, b: TestResult) => b.accuracy - a.accuracy);

  const report = `# VLM Extraction Test Results Summary

## Overview
Total tests run: ${files.length}
Date: ${new Date().toISOString()}

## Test Results (Sorted by Accuracy)

${files
  .map(
    (result: TestResult) => `### Test: ${result.testId}
- **Model**: ${result.model}
- **Accuracy**: ${result.accuracy.toFixed(2)}%
- **Matches**: ${result.matchCount}/${result.expectedWords.length}
- **Missing**: ${result.missingWords.length} words
- **Extra**: ${result.extraWords.length} words
- **Prompt**: ${result.prompt.substring(0, 100)}...
- **Duration**: ${result.duration}ms
`
  )
  .join('\n---\n')}

## Best Performing Configuration
${files.length > 0 ?
  `- **Model**: ${files[0].model}\n` +
  `- **Accuracy**: ${files[0].accuracy.toFixed(2)}%\n` +
  `- **Prompt**: ${files[0].prompt}\n` +
  `- **Request Format**: ${files[0].requestFormat}` :
  'No tests completed yet'}`;

  const reportPath = path.join(__dirname, 'SUMMARY_REPORT.md');
  fs.writeFileSync(reportPath, report);

  console.log(`📊 Summary report saved to: ${reportPath}`);
}

/**
 * Print a detailed test result
 */
export function printTestResult(result: TestResult): void {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST: ${result.testId}`);
  console.log('='.repeat(80));
  console.log(`Model: ${result.model}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`\nAccuracy: ${result.accuracy.toFixed(2)}%`);
  console.log(`Matched: ${result.matchCount} / ${result.expectedWords.length}`);
  console.log(`Missing: ${result.missingWords.length}`);
  console.log(`Extra: ${result.extraWords.length}`);

  if (result.errors && result.errors.length > 0) {
    console.log(`\nErrors: ${result.errors.join(', ')}`);
  }

  console.log('\nSample Missing (first 10):');
  result.missingWords.slice(0, 10).forEach(word => console.log(`  - ${word}`));

  console.log('\nSample Extra (first 10):');
  result.extraWords.slice(0, 10).forEach(word => console.log(`  - ${word}`));
}
