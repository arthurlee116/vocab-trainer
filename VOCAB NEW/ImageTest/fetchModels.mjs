#!/usr/bin/env node

/**
 * Pulls the full model catalog from OpenRouter and saves it under ImageTest/models/.
 * It also extracts vision-capable candidates to make it easier to spot the latest options.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... node ImageTest/fetchModels.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { ProxyAgent } from 'undici';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const API_KEY = process.env.OPENROUTER_API_KEY;
const proxyUrl =
  process.env.OPENROUTER_NO_PROXY === '1'
    ? null
    : process.env.OPENROUTER_PROXY ??
      process.env.HTTPS_PROXY ??
      process.env.HTTP_PROXY ??
      'http://127.0.0.1:7890';
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

if (!API_KEY) {
  console.error('Missing OPENROUTER_API_KEY env variable.');
  process.exit(1);
}

const outDir = path.resolve('ImageTest/models');
await fs.mkdir(outDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const folder = path.join(outDir, timestamp);
await fs.mkdir(folder, { recursive: true });

const fetchOptions = {
  headers: {
    Authorization: `Bearer ${API_KEY}`
  }
};

if (dispatcher) {
  fetchOptions.dispatcher = dispatcher;
}

const res = await fetch(OPENROUTER_MODELS_URL, fetchOptions);

if (!res.ok) {
  const text = await res.text();
  throw new Error(`Failed to fetch model list (${res.status}): ${text}`);
}

const payload = await res.json();
const rawPath = path.join(folder, 'openrouter-models.json');
await fs.writeFile(rawPath, JSON.stringify(payload, null, 2));
console.log(`Saved raw catalog to ${rawPath}`);

const models = Array.isArray(payload?.data) ? payload.data : [];

const toLower = value => (value ?? '').toString().toLowerCase();

const visionTags = ['vision', 'vlm', 'image', 'multimodal'];
const flagshipKeywords = [
  'gpt-5',
  'gpt-4.5',
  'claude 4.5',
  'sonnet 4.5',
  'gemini 2.5',
  'gemini-2.5',
  'gemini 2.0',
  'nova',
  'kimi k2',
  'qwen',
  'openrouter/polaris',
  'amazon/nova',
  'meta-llama',
  'google/gemini',
  'openai/gpt-4.2',
  'xai/grok',
  'minimax',
  'moonshot',
  'perplexity'
];

const isVisionModel = model => {
  const modalities = [
    ...(model?.architecture?.input_modalities ?? []),
    model?.architecture?.modality ?? '',
    ...(model?.tags ?? []),
    ...(model?.capabilities ?? [])
  ]
    .filter(Boolean)
    .map(toLower);

  const hasVisionTag = modalities.some(modality =>
    visionTags.some(tag => modality.includes(tag))
  );

  const nameHit =
    toLower(model?.name).includes('vision') ||
    toLower(model?.id).includes('vision');

  return hasVisionTag || nameHit;
};

const normalizeModelEntry = model => ({
  id: model.id,
  name: model.name,
  vendor: model.id?.split('/')?.[0] ?? '',
  created: model.created,
  context_length: model.context_length,
  input_modalities: model?.architecture?.input_modalities ?? [],
  description: model.description?.split('\n')?.[0] ?? '',
  pricing: model.pricing ?? {}
});

const visionModels = models.filter(isVisionModel).map(normalizeModelEntry);
visionModels.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));

const flagshipVision = visionModels.filter(model => {
  const haystack = `${toLower(model.id)} ${toLower(model.name)}`;
  return flagshipKeywords.some(keyword => haystack.includes(keyword));
});

const visionPath = path.join(folder, 'vision-models.json');
await fs.writeFile(visionPath, JSON.stringify(visionModels, null, 2));
console.log(`Saved ${visionModels.length} vision-capable models to ${visionPath}`);

const flagshipPath = path.join(folder, 'flagship-vision-models.json');
await fs.writeFile(flagshipPath, JSON.stringify(flagshipVision, null, 2));
console.log(`Saved ${flagshipVision.length} flagship candidates to ${flagshipPath}`);

const summaryPath = path.join(folder, 'summary.json');
await fs.writeFile(
  summaryPath,
  JSON.stringify(
    {
      timestamp,
      total: models.length,
      vision: visionModels.length,
      flagship: flagshipVision.length
    },
    null,
    2
  )
);
console.log(`Summary written to ${summaryPath}`);
