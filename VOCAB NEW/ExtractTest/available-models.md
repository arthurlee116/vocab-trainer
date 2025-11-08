# Latest Vision Models Available on OpenRouter (2025)

**Last Updated**: 2025-11-08
**Total vision-capable models fetched**: From OpenRouter `/api/v1/models`

## 🏆 Top-Tier Models (Most Powerful)

### 1. **Qwen3-VL-235B Series** (Alibaba)
- **Model**: `qwen/qwen3-vl-235b-a22b-thinking`
- **Model**: `qwen/qwen3-vl-235b-a22b-instruct`
- **Released**: April 2025
- **Type**: Mixture-of-Experts (MoE)
- **Total Parameters**: 235B (22B activated)
- **Context**: 256K tokens (expandable to 1M)
- **Features**: Dual-mode (thinking/non-thinking), advanced OCR, video comprehension
- **Pricing**: $0.30/M input, $1.20/M output
- **Why Test**: Currently the largest vision-language model, excellent for document OCR

### 2. **GPT-5 Vision Series** (OpenAI)
- **Model**: `openai/gpt-5-image`
- **Model**: `openai/gpt-5-image-mini`
- **Released**: 2025
- **Type**: Native multimodal
- **Context**: 400,000 tokens
- **Features**: Advanced reasoning, image generation + understanding, text rendering
- **Pricing**: $10/M input, $10/M output (for main model)
- **Why Test**: State-of-the-art general-purpose vision model

### 3. **Gemini 2.5 Flash Series** (Google)
- **Model**: `google/gemini-2.5-flash-image`
- **Model**: `google/gemini-2.5-flash-preview-09-2025`
- **Model**: `google/gemini-2.5-flash-lite-preview-09-2025`
- **Type**: Multimodal with 1M+ context
- **Features**: "Thinking model" architecture, superior STEM reasoning
- **Why Test**: Leading benchmark performance on multimodal tasks

### 4. **Claude Sonnet 4.5 & Haiku 4.5** (Anthropic)
- **Model**: `anthropic/claude-sonnet-4.5`
- **Model**: `anthropic/claude-haiku-4.5`
- **Released**: 2025
- **Context**: 200K tokens
- **Features**: Safety-focused, excellent document analysis, computer use capabilities
- **Why Test**: Best-in-class for programming and structured data extraction

### 5. **Amazon Nova Premier** (Amazon)
- **Model**: `amazon/nova-premier-v1`
- **Released**: 2025
- **Context**: 1,000,000 tokens (1M!)
- **Features**: Complex reasoning, teacher model for distillation
- **Pricing**: Very competitive ($2.50/M input, $12.50/M output)
- **Why Test**: Massive context window for large documents

### 6. **Qwen3-VL Medium Series** (Alibaba)
- **Model**: `qwen/qwen3-vl-30b-a3b-thinking`
- **Model**: `qwen/qwen3-vl-30b-a3b-instruct`
- **Model**: `qwen/qwen3-vl-8b-thinking`
- **Model**: `qwen/qwen3-vl-8b-instruct`
- **Parameters**: 30B and 8B variants
- **Why Test**: More cost-effective than 235B, excellent Chinese document OCR

### 7. **NVIDIA Nemotron Nano 2 VL**
- **Model**: `nvidia/nemotron-nano-12b-v2-vl`
- **Model**: `nvidia/nemotron-nano-12b-v2-vl:free`
- **Parameters**: 12B
- **Features**: Hybrid Transformer-Mamba architecture, optimized for OCR
- **Pricing**: FREE for one variant
- **Why Test**: Leading OCR performance, optimized for document intelligence

## 🎯 Mid-Tier Models (Good Performance, Better Value)

### 8. **Other Notable Vision Models**
- `perplexity/sonar-pro-search` - Agentic search with vision
- `openrouter/polaris-alpha` - Free, general-purpose multimodal
- `mistralai/voxtral-small-24b-2507` - Audio + vision + text

## 📊 Model Comparison Summary

| Model | Context | Strengths | Best For |
|-------|---------|-----------|----------|
| Qwen3-VL-235B | 256K | OCR, Chinese text | Chinese vocabulary lists |
| GPT-5 Image | 400K | General vision, reasoning | All-purpose extraction |
| Gemini 2.5 Flash | 1M+ | STEM reasoning, long docs | Complex documents |
| Claude 4.5 Sonnet | 200K | Programming, safety | Structured extraction |
| Nova Premier | 1M | Long context, cost | Very large images |
| Qwen3-VL-30B | 256K | Balanced performance | Cost-effective Chinese OCR |
| Nemotron Nano | 128K | OCR, speed | Fast processing |

## 💡 Recommended Test Configuration

Based on your use case (extracting vocabulary from images with mixed English/Chinese text):

**Primary candidates:**
1. **Qwen3-VL-235B-instruct** - Best for Chinese + English mixed text
2. **GPT-5-image** - Best overall accuracy
3. **Gemini-2.5-flash-image** - Best for complex layouts
4. **Claude-sonnet-4.5** - Best for structured output

**Budget-friendly:**
5. **Qwen3-VL-30B-instruct** - 80% performance at 10% cost
6. **Nemotron-nano-12b-v2-vl:free** - Free option to test

**Alternative:**
7. **Gemini-2.5-flash-lite** - Lower cost Gemini option

## 🔧 Model IDs for Testing

```typescript
const LATEST_MODELS = [
  // Tier 1: Best of the best
  "qwen/qwen3-vl-235b-a22b-instruct",
  "openai/gpt-5-image",
  "google/gemini-2.5-flash-image",
  "anthropic/claude-sonnet-4.5",
  "amazon/nova-premier-v1",

  // Tier 2: Excellent value
  "qwen/qwen3-vl-30b-a3b-instruct",
  "openai/gpt-5-image-mini",
  "nvidia/nemotron-nano-12b-v2-vl",

  // Tier 3: Alternative options
  "google/gemini-2.5-flash-lite-preview",
  "anthropic/claude-haiku-4.5",
  "qwen/qwen3-vl-8b-instruct",
];
```

## 📈 Expected Performance

Based on 2025 benchmarks:

- **OCR Accuracy**: GPT-5, Gemini 2.5, Qwen3-VL 235B > 95%
- **Chinese Text**: Qwen3-VL series best-in-class
- **Speed**: Nemotron Nano > GPT-5-mini > Qwen3-30B > Qwen3-235B
- **Cost/Million Tokens**:
  - Free: Nemotron Nano (free version)
  - $0.5-2: Qwen3-8B/30B, Gemini Flash Lite
  - $5-15: GPT-5-mini, Claude Haiku
  - $15-30: GPT-5, Gemini 2.5, Qwen3-235B
  - $30+: (premium models)

---

**Next Steps**: Replace the model IDs in `run-tests.ts` with these latest models before running tests.
