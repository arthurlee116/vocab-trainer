# Quick Start Guide - VLM Extraction Tests

## 🎯 Goal

Experiment with 2025's latest vision-language models to find the best configuration for extracting vocabulary words from your test image.

## 📋 Prerequisites

1. **Generate an OpenRouter API key**:
   - Go to https://openrouter.ai/keys
   - Create a new key

2. **Copy the environment file**:
   ```bash
   cp ../server/.env.example ../server/.env
   ```

3. **Edit `../server/.env`** and add your API key:
   ```env
   OPENROUTER_API_KEY=your_key_here
   ... other settings ...
   ```

4. **Verify your test files exist**:
   - `1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg` - Your test image
   - `List1.md` - Ground truth vocabulary list (129 words)

## 🚀 Running the Tests

### Option 1: Latest 2025 Models (Recommended)

Tests 7 cutting-edge models released in 2025:
- Qwen3-VL-235B (Alibaba's largest)
- GPT-5 Vision (OpenAI)
- Gemini 2.5 Flash (Google)
- Claude Sonnet 4.5 (Anthropic)
- And more...

```bash
npm install
npm run test:latest
```

Or directly:
```bash
npx tsx run-latest-tests.ts
```

### Option 2: Original Models

Tests older models (Grok-4, GPT-4o, Gemini 1.5, etc.):

```bash
npm install
npm run test
```

## 📊 Understanding Results

While tests run, you'll see real-time progress:

```
🧪 Running TEST_2025_001_Qwen3VL235B
   Model: qwen/qwen3-vl-235b-a22b-instruct
   Qwen3-VL 235B - Largest vision model, optimized for document OCR
   ✓ Accuracy: 87.6% (113/129)
   ✓ Duration: 3847ms ~ $0.86

📊 Progress: 14% (1/7)
```

After completion, see final rankings:

```
🏆 FINAL RESULTS
================================================================================
1. 🏆 TEST_2025_001_Qwen3VL235B: 87.6% - qwen3-vl-235b-a22b-instruct
2. 🏆 TEST_2025_002_GPT5Image: 84.5% - gpt-5-image
3. 🏆 TEST_2025_003_Gemini25Flash: 79.8% - gemini-2.5-flash-image
...
```

## 📁 Output Files

After running tests, you'll find:

1. **`results/` directory** - JSON files for each test:
   - Extracted words vs expected words
   - Accuracy percentage
   - Missing words list
   - Extra/hallucinated words
   - API response and timing

2. **`SUMMARY_REPORT.md`** - Human-readable comparison of all results

3. **Console output** - Best model recommendation with cost estimates

## 💡 Interpreting Results

**Accuracy**: Higher is better
- 100% = Perfect extraction
- 80-90% = Excellent performance
- 60-80% = Good, needs refinement
- <60% = Model not suitable

**Missing Words**: Check if specific patterns fail:
- `sb./sth.` abbreviations?
- Hyphenated words?
- Multi-word phrases?
- Numbers in text?

**Extra Words**: Indicates hallucination - model making up text

**Duration**: Affects user experience
- <2s = Fast
- 2-5s = Acceptable
- >5s = Slow

## 🎛️ Customizing Tests

### Test Different Prompts

Edit `run-latest-tests.ts` and modify `ENHANCED_PROMPT`:

```typescript
const ENHANCED_PROMPT = `Your custom prompt here...

CRITICAL:
1. Extract words exactly as they appear
2. Preserve special characters like hyphens and apostrophes
3. Include phrases with sb./sth. abbreviations
4. ... etc
`;
```

### Change Request Format

Two formats supported:

1. **User role with image** (recommended):
```typescript
requestFormat: 'user_role_single_image'
// Sends image + text in single user message
```

2. **System role with image** (legacy):
```typescript
requestFormat: 'system_role_with_image'
// Puts image in system role, text in user role
```

### Test Additional Models

1. Check `available-models.md` for complete list
2. Add to `testConfigs` array:

```typescript
{
  id: 'TEST_2025_008_Custom',
  model: 'your/model-id',
  prompt: ENHANCED_PROMPT,
  requestFormat: 'user_role_single_image',
  description: 'Your description'
}
```

## 🔍 Troubleshooting

### "OPENROUTER_API_KEY not found"

**Problem**: Missing API key
**Solution**:
```bash
cp ../server/.env.example ../server/.env
# Then edit ../server/.env and add your key
```

### API Rate Limits

**Problem**: "Too many requests" errors
**Solution**: Tests already include 2-second delays between requests. If still hitting limits:
- Increase delay in `run-latest-tests.ts`: `setTimeout(resolve, 5000)`
- Run fewer tests at once (comment out some in `testConfigs`)

### High Costs

**Problem**: API calls expensive
**Solutions**:
1. Test free model first:
   ```typescript
   // Add this test
   {
     id: 'TEST_FREE',
     model: 'nvidia/nemotron-nano-12b-v2-vl:free',
     prompt: ENHANCED_PROMPT,
     requestFormat: 'user_role_single_image',
     description: 'Free NVIDIA model'
   }
   ```

2. Use smaller models:
   - Qwen3-VL-30B costs ~10% of 235B
   - GPT-5 Image Mini much cheaper than full GPT-5

### Tests Taking Too Long

**Problem**: 7 models × ~5 seconds each = 35+ seconds
**Solutions**:
1. Test top 3 models instead of all 7
2. Comment out slower models in `testConfigs`
3. Run in background: `npx tsx run-latest-tests.ts > results.log 2>&1 &`

## 📈 Next Steps After Testing

1. **Review top performers** in `results/` directory
2. **Check missing words patterns** - common failures?
3. **Refine prompt** based on errors
4. **Test again** with optimized configuration
5. **Implement winner** in main application

## 🌟 Model Recommendations

Based on your use case (Chinese + English vocabulary extraction):

**If budget is no concern**:
```typescript
model: 'qwen/qwen3-vl-235b-a22b-instruct'
// Best OCR accuracy, especially for mixed Chinese/English text
```

**Best balance**:
```typescript
model: 'qwen/qwen3-vl-30b-a3b-instruct'
// 85% performance at 10% cost of 235B
```

**Fastest**:
```typescript
model: 'nvidia/nemotron-nano-12b-v2-vl:free'
// Free and optimized for document OCR
```

## 🛠️ Testing Checklist

- [ ] Copied `../server/.env.example` to `../server/.env`
- [ ] Added OpenRouter API key to `../server/.env`
- [ ] Installed dependencies: `npm install`
- [ ] Test image present: `1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg`
- [ ] Ground truth present: `List1.md`
- [ ] Run tests: `npx tsx run-latest-tests.ts`
- [ ] Review results in `results/` directory
- [ ] Check `SUMMARY_REPORT.md` for comparison
- [ ] Identify best model based on accuracy + cost

## 📞 Support

If tests fail or you need help:
1. Check `results/` directory for error messages
2. Review console output for specific error details
3. Verify API key has sufficient balance
4. Ensure test image is clear and readable
5. Check ground truth file has correct format (numbered list)

---

**Good luck!** May the best VLM win. 🚀
