# ImageTest Experiments

This folder is isolated from the main app so we can try different vision-model prompts without touching server or client code.

## Files
- `1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg` — the worksheet photo.
- `List1.md` — ground-truth terms for manual comparison.
- `models.md` — authoritative list of models to exercise (keep this updated; the runners read it directly).
- `runExperiments.mjs` — reads `models.md`, runs each model through multiple prompt + JSON Schema combos (all structured outputs), and writes responses under `ImageTest/results/`.
- `fetchModels.mjs` — pulls the full OpenRouter model catalog and extracts vision-capable candidates into `ImageTest/models/`.
- `matrixRunner.mjs` — matrix-style runner that sweeps models × prompts × JSON schemas and stores outputs in `ImageTest/results_matrix/`.
- `evaluateResults.mjs` — compares any result folder against `List1.md`, reporting coverage/extra terms via `evaluation.json`.

## Running the Harness
```bash
# Primary structured-output harness (reads models.md)
OPENROUTER_API_KEY=sk-... node ImageTest/runExperiments.mjs
# Limit models/variants if needed
MODEL_FILTER="openai/gpt-5-mini,anthropic/claude-sonnet-4.5" VARIANT_FILTER="nopunct_words,sections_after_number" node ImageTest/runExperiments.mjs
# Targeted per-model scripts (run in parallel as needed)
OPENROUTER_API_KEY=sk-... node ImageTest/scripts/run-openai-gpt-5-mini.mjs
OPENROUTER_API_KEY=sk-... node ImageTest/scripts/run-openai-gpt-5.mjs
OPENROUTER_API_KEY=sk-... node ImageTest/scripts/run-google-gemini-2.5-pro.mjs
# Original matrix runner + evaluator (optional/back-compat)
OPENROUTER_API_KEY=sk-... node ImageTest/matrixRunner.mjs
node ImageTest/evaluateResults.mjs ImageTest/results_matrix/<timestamp>
# Refresh catalog
OPENROUTER_API_KEY=sk-... node ImageTest/fetchModels.mjs
```

All OpenRouter requests default to the local proxy at `http://127.0.0.1:7890`; override with `OPENROUTER_PROXY=http://host:port` or disable via `OPENROUTER_NO_PROXY=1`. Each run creates a timestamped folder in `ImageTest/results/` (or `results_matrix/`) containing the raw JSON responses (or error logs) plus a `summary.json`. `fetchModels.mjs` behaves similarly but writes into `ImageTest/models/`. Update `models.md` + the prompt variants inside `runExperiments.mjs` whenever you need to try new models, schemas, or instructions. Keeping all code and outputs here ensures the main project stays untouched until we find a reliable extraction recipe and model choice.
