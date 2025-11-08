# Optimized Prompts for Vocabulary Extraction

Based on test results (Qwen3-VL-235B only achieved 46.5% accuracy), here are improved prompts.

## Problem Analysis

Current issues:
1. Model returning words with trailing colons ("anthropology:")
2. Missing words with formats: "sb./sth.", "far-fetched"
3. Not preserving exact formatting of phrases
4. Special characters being normalized or removed

## Solution: Post-processing + Better Prompt

### Approach 1: Better Prompt (PROMPT_V2_Enhanced)
```
You are a precise OCR system for vocabulary extraction.

TASK: Extract ALL English vocabulary words and phrases from this image.

CRITICAL INSTRUCTIONS:
1. Extract text EXACTLY as it appears - do NOT add or remove punctuation
2. For each numbered item, extract the text AFTER the number (e.g., "1. anthropology" → "anthropology")
3. Preserve ALL special characters: sb./sth., hyphens, apostrophes, periods
4. Include multi-word phrases and idioms exactly as written
5. Remove ONLY the numbering prefix, keep everything else

Examples of what to extract:
✓ "anthropology" (not "anthropology:")
✓ "hold sb. accountable for" (not "hold sb. accountable for:")
✓ "far-fetched" (preserve hyphen)
✓ "a cat has nine lives" (full phrase)

Return JSON: {"words": ["word1", "word2", ...]}
```

### Approach 2: Smart Post-processing
```typescript
// After extraction, clean up common OCR artifacts
function cleanExtractedWords(words: string[]): string[] {
  return words.map(word => {
    // Remove trailing colons and semicolons
    word = word.replace(/[:;]$/, '');

    // Trim whitespace
    word = word.trim();

    // Skip empty strings
    return word;
  }).filter(Boolean);
}

// Then compare with expected without case sensitivity
function normalizeForComparison(word: string): string {
  return word.toLowerCase().trim();
}
```

### Approach 3: Re-run Tests with Better Prompt

Use this updated prompt in test scripts:

```typescript
const ENHANCED_PROMPT = `You are a precise OCR system for vocabulary extraction.

TASK: Extract ALL vocabulary words and phrases from this educational word list.

CRITICAL INSTRUCTIONS:
1. For each numbered item ("1. word"), extract ONLY the text after the number and period
2. Remove the numbering prefix but keep ALL other punctuation and characters
3. Preserve these EXACTLY as they appear:
   - Abbreviations: sb./sth.
   - Hyphens: far-fetched
   - Apostrophes: cat's
   - Periods in abbreviations
4. Include multi-word phrases and idioms
5. Return clean words without trailing colons or semicolons

WRONG: "anthropology:" (has trailing colon)
RIGHT: "anthropology"

WRONG: "hold sb. accountable for:"
RIGHT: "hold sb. accountable for"

Return JSON format: {"words": ["word1", "word2", "word3", ...]}`;
```

## Recommended Next Steps

1. **Fix Qwen3-VL-235B test** with better prompt + post-processing
2. **Try models without geo-restrictions**:
   - Anthropic Claude models (Sonnet 3.5, Haiku)
   - Other Qwen models
   - NVIDIA Nemotron (free tier)

3. **Run prompt variations** to find best instruction strategy
4. **Test both json_schema and json_object** for compatibility

## Quick Test Script

Create `run-optimized-test.ts`:

```typescript
const OPTIMIZED_PROMPT = `You are a precise OCR system for vocabulary extraction.

Extract ALL vocabulary words from this image. For each numbered item ("1. word"), extract ONLY the text after the number, removing the prefix but keeping all other characters EXACTLY as they appear.

Preserve: sb./sth., hyphens, apostrophes, periods in abbreviations
Return: {"words": ["word1", "word2", ...]}`;

// Run with post-processing cleanup
```
