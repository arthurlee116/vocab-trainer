# VLM Extraction Test Suite

This directory contains a comprehensive testing framework for experimenting with different VLM (Vision Language Model) configurations to extract vocabulary words from images.

## Setup

1. Ensure you have copied `server/.env.example` to `server/.env` and added your OpenRouter API key

2. Install dependencies:
```bash
npm install
```

3. Verify test files are present:
   - `1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg` - The test image (vocabulary list)
   - `List1.md` - Ground truth list of expected words (129 words)

## Running Tests

Run all tests:
```bash
npm test
```

## Test Configurations

The test suite runs multiple configurations defined in [run-tests.ts](run-tests.ts):

1. **TEST_001_Baseline** - Current production setup (Grok-4-fast)
2. **TEST_002_GPT4_ImprovedPrompt** - Gemini 2.0 with detailed instruction
3. **TEST_003_GPT5_Basic** - GPT-4o with basic extraction prompt
4. **TEST_004_GPT5_Detailed** - GPT-4o with formatting preservation instructions
5. **TEST_005_GPT4oMini** - GPT-4o-mini with formatting preservation
6. **TEST_006_Gemini_Standard** - Gemini 2.0 with standard prompt

## Experiment Variables

### Models Tested
- `x-ai/grok-4-fast` (current production)
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `google/gemini-2.0-flash-exp:free`

### Prompt Variations
- Basic extraction prompt
- Detailed formatting instructions
- Emphasis on preserving punctuation and special characters
- Multi-step reasoning instructions

### Request Formats
- `system_role_with_image` - Image in system role (current approach)
- `user_role_single_image` - Image in user role with text prompt

## Output

After running tests, you'll find:

1. **`results/` directory** - Contains JSON files for each test run with:
   - Extracted words vs expected words
   - Accuracy percentage
   - Missing words list
   - Extra words found
   - Duration and timestamp
   - Raw API response

2. **`SUMMARY_REPORT.md`** - Auto-generated report comparing all test results

3. **Console output** - Real-time progress and final rankings

## Understanding Results

**Accuracy Calculation:**
- `(matched_words / total_expected_words) * 100`

**Key Metrics:**
- **Match Count** - Words correctly extracted
- **Missing Words** - Expected words not found
- **Extra Words** - Words found but not expected (potential hallucinations)

## Adding New Tests

Edit [run-tests.ts](run-tests.ts) and add to the `testConfigs` array:

```typescript
{
  id: 'TEST_007_Custom',
  model: 'model-name',
  prompt: 'Your custom prompt here',
  requestFormat: 'user_role_single_image',
  description: 'Description of what this tests'
}
```

## Troubleshooting

**API Key Issues:**
- Ensure `OPENROUTER_API_KEY` is set in `server/.env`
- API key must have access to the models being tested

**Rate Limits:**
- Tests run sequentially with 1-second delays
- Some free models may have stricter limits

**Model Availability:**
- Models may change or be deprecated
- Update model names in [run-tests.ts](run-tests.ts) if needed

## Example Output

```
VLM EXTRACTION EXPERIMENT
================================================================================
Expected words: 129
Image size: 153.34 KB (base64)
================================================================================

🧪 Running TEST_001_Baseline - x-ai/grok-4-fast
Description: Current production approach
================================================================================
TEST: TEST_001_Baseline
================================================================================
Model: x-ai/grok-4-fast
Duration: 3204ms

Accuracy: 67.44%
Matched: 87 / 129
Missing: 42
Extra: 12

Sample Missing (first 10):
  - hold sb. accountable for
  - hangs in the balance
  - balance the books
  ...
```

## Next Steps

Once you've identified the best performing configuration:

1. Review the top 2-3 configurations in detail
2. Check the missing words patterns (common errors)
3. Consider adding more targeted tests for problematic cases
4. Implement the winning configuration in the main application

## Notes

- **No code changes** to the main application are made during testing
- All experiments are isolated to this directory
- Images and ground truth are preserved for reproducibility
- Test results include sufficient metadata for debugging
