#!/usr/bin/env node

import { runModel } from './run-model-base.mjs';

runModel({
  modelId: 'google/gemini-2.5-pro',
  variantKeys:
    process.env.VARIANTS?.split(',').map(v => v.trim()).filter(Boolean) ?? []
}).catch(err => {
  console.error(err);
  process.exit(1);
});

