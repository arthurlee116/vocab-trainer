#!/bin/bash

export OPENROUTER_API_KEY=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

cd "/Users/arthur/AI TEST/VOCAB NEW/ExtractTest"
npx tsx test-nemotron-simple.ts 2>&1 | head -200
