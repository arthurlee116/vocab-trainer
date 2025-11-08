# VLM Extraction Test Results Summary

## Overview
Total tests run: 7
Date: 2025-11-08T00:48:05.673Z

## Test Results (Sorted by Accuracy)

### Test: TEST_2025_001_Qwen3VL235B
- **Model**: qwen/qwen3-vl-235b-a22b-instruct
- **Accuracy**: 46.51%
- **Matches**: 60/129
- **Missing**: 69 words
- **Extra**: 74 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 20761ms

---
### Test: TEST_2025_002_GPT5Image
- **Model**: openai/gpt-5-image
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 0 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 1327ms

---
### Test: TEST_2025_003_Gemini25Flash
- **Model**: google/gemini-2.5-flash-image
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 0 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 1816ms

---
### Test: TEST_2025_004_ClaudeSonnet45
- **Model**: anthropic/claude-sonnet-4.5
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 0 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 14030ms

---
### Test: TEST_2025_005_Qwen3VL30B
- **Model**: qwen/qwen3-vl-30b-a3b-instruct
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 134 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 27827ms

---
### Test: TEST_2025_006_GPT5ImageMini
- **Model**: openai/gpt-5-image-mini
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 0 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 1069ms

---
### Test: TEST_2025_007_NovaPremier
- **Model**: amazon/nova-premier-v1
- **Accuracy**: 0.00%
- **Matches**: 0/129
- **Missing**: 129 words
- **Extra**: 0 words
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English voc...
- **Duration**: 40710ms


## Best Performing Configuration
- **Model**: qwen/qwen3-vl-235b-a22b-instruct
- **Accuracy**: 46.51%
- **Prompt**: You are a vocabulary extraction specialist. Carefully analyze this image and extract ALL English vocabulary words and phrases.

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

Output must be a JSON object with a "words" array containing all extracted vocabulary items.
- **Request Format**: user_role_single_image