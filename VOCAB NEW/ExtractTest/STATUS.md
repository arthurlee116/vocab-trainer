# VLM Extraction Experiments - Status Report

**Date**: 2025-11-08
**Status**: Experiments Running

## 📊 Completed Setup

### ✅ API Configuration
- OpenRouter API key configured in `server/.env`
- Environment ready for testing

### ✅ Test Data
- **Test Image**: `1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg` (747×1052px, 150KB)
- **Ground Truth**: `List1.md` (129 vocabulary words/phrases)
- **Image Size**: ~0.2 MB base64 encoded

### ✅ Created Test Scripts

#### 1. `run-latest-tests.ts` - Full Model Comparison
Tests 7 cutting-edge 2025 models:
- Qwen3-VL-235B (Alibaba) - 235B MoE, optimized for OCR
- GPT-5 Image (OpenAI) - State-of-the-art multimodal
- Gemini 2.5 Flash (Google) - 1M context, thinking model
- Claude Sonnet 4.5 (Anthropic) - Best structured output
- Qwen3-VL-30B (Alibaba) - Cost-effective smaller version
- GPT-5 Image Mini (OpenAI) - Lightweight, faster
- Nova Premier (Amazon) - 1M context window

**Status**: ⏳ Running (background process)
**Expected time**: 45-90 seconds for completion

#### 2. `run-prompt-variations.ts` - Prompt Engineering Tests
Tests 6 different prompt strategies on best-performing model:
- Basic extraction
- Detailed formatting instructions
- Chain-of-thought step-by-step
- Concrete examples
- Role-based system prompt
- Strict rules with failure conditions

**Status**: ⏸️ Ready to run after model comparison

#### 3. `run-experiments.ts` - Fast Experiments
Quick tests with faster models for rapid iteration:
- GPT-5 Image Mini with different settings
- Gemini 2.5 Flash Lite
- Tests JSON schema vs json_object format

**Status**: ⏳ Currently running (background process)

## 🎯 Testing Variables

### Models Tested
**Tier 1 (Latest 2025)**:
- Qwen3-VL-235B (MoE, 256K context, $0.30/M input)
- GPT-5 Image (400K context, $10/M input)
- Gemini 2.5 Flash (1M context)
- Claude Sonnet 4.5 (200K context)

**Tier 2 (Cost-Effective)**:
- Qwen3-VL-30B (smaller, 10% cost)
- GPT-5 Image Mini (cheaper, faster)
- Nova Premier (1M context, competitive pricing)

### Prompt Variations
6 different approaches to see what works best:
1. **Basic extraction** - Simple instruction
2. **Detailed instructions** - Emphasize format preservation
3. **Chain-of-thought** - Step-by-step reasoning
4. **Examples included** - Show expected output format
5. **System role** - Professional OCR persona
6. **Strict rules** - Error conditions defined

### JSON Format Options
- **json_schema** - Structured output with strict validation (requires word array)
- **json_object** - General JSON object response
- **Plain text** - Raw text output (parse with regex)

## 📈 Expected Outputs

Each experiment generates:
```typescript
{
  testId: "unique_identifier",
  model: "model_id",
  prompt: "used_prompt",
  extractedWords: [...],
  expectedWords: [...],
  accuracy: percentage,
  matchCount: number,
  missingWords: [...],
  extraWords: [...],
  duration: milliseconds,
  rawResponse: {...}
}
```

## 📂 Result Files

All results saved to:
- **`results/` directory** - JSON files for each test
- **`SUMMARY_REPORT.md`** - Human-readable comparison
- **`/tmp/`** - Fast experiment results

## 🔬 Experiments in Progress

1. **Model Performance Comparison** (run-latest-tests.ts)
   - Goal: Identify best model for vocabulary extraction
   - Metrics: Accuracy, cost, speed
   - Expected: Qwen3-VL-235B or GPT-5 likely best performers

2. **Prompt Engineering** (run-prompt-variations.ts)
   - Goal: Find best instruction strategy
   - Focus on preserving special characters (sb./sth., hyphens, apostrophes)
   - Expected: Detailed instructions with examples likely best

3. **JSON Format Testing** (run-experiments.ts)
   - Goal: Compare json_schema vs json_object
   - Structured validation vs flexibility
   - Expected: json_schema better for consistency

## 📝 Preliminary Hypothesis

Based on research and model capabilities:

**Best Model**: Qwen3-VL-235B or GPT-5 Image
- Strong OCR capabilities
- Good with mixed Chinese/English text
- Preserve special characters

**Best Prompt**: V4_Examples or V2_Detailed
- Concrete examples prevent confusion
- Explicitly mention preserving punctuation
- Don't assume model knows what "sb./sth." means

**Best Format**: json_schema
- Ensures consistent structure
- Validates output automatically
- Catches errors early

## ⏱️ Timeline

Initial setup: ✅ Complete (15 minutes)
Full model comparison: ⏳ Running (1-2 minutes remaining)
Prompt variations: ⏸️ Pending (5-10 minutes)
JSON format testing: ⏸️ Pending (3-5 minutes)
Analysis & report: ⏸️ Pending (10 minutes)

**Total expected time**: 30-45 minutes for complete analysis

## 🚀 Next Steps

1. Wait for current experiments to complete
2. Review initial results
3. Run prompt variations on best model
4. Run JSON format comparison
5. Generate final recommendations
6. Implement winning configuration in main app

## 💡 Notes

- All experiments isolated in `ExtractTest/` directory
- Original app code unchanged
- API keys kept in `server/.env` (never committed)
- Test data (image + expected words) preserved for reproducibility
- Cost estimates included in results
- Rate limiting (2s delays) between requests

## ⚠️ Known Issues

- Qwen3-VL-235B may be slow to respond (large model)
- Some models may have rate limits
- API costs vary significantly ($0-10 per request)
- Free models may have lower accuracy

**Current focus**: Getting first results from faster models (GPT-5 Image Mini, Gemini Lite) to establish baseline before testing premium models.
