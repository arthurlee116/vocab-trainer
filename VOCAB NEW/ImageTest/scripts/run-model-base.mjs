#!/usr/bin/env node

/**
 * Base helper for running a single model across selected prompt variants.
 * Other scripts import `runModel` from here so they can be executed in parallel.
 */

import fs from 'fs/promises';
import path from 'path';
import { ProxyAgent } from 'undici';
import { promptVariants, promptVariantMap } from '../lib/prompts.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
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
  throw new Error('Missing OPENROUTER_API_KEY env variable.');
}

const IMAGE_PATH = path.resolve(
  'ImageTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg'
);

const DEFAULT_OUTPUT_DIR = path.resolve('ImageTest/results/single-model');

const sanitize = value =>
  value.replace(/[^a-z0-9._-]+/gi, '_').replace(/_+/g, '_');

const ensureDir = async dir => {
  await fs.mkdir(dir, { recursive: true });
};

const readImageAsDataUrl = async () => {
  const file = await fs.readFile(IMAGE_PATH);
  return `data:image/jpeg;base64,${file.toString('base64')}`;
};

const buildBody = (modelId, variant, imageDataUrl) => ({
  model: modelId,
  temperature: variant.temperature ?? 0,
  messages: [
    { role: 'system', content: variant.system },
    {
      role: 'user',
      content: [
        { type: 'text', text: variant.user },
        { type: 'image_url', image_url: imageDataUrl }
      ]
    }
  ],
  response_format: variant.responseFormat
});

const runRequest = async body => {
  const options = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  if (dispatcher) {
    options.dispatcher = dispatcher;
  }

  const res = await fetch(OPENROUTER_URL, options);
  const text = await res.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: 'Failed to parse JSON', raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `OpenRouter request failed (${res.status}): ${text.slice(0, 400)}`
    );
  }

  return parsed;
};

export const getVariantList = variantKeys => {
  if (!variantKeys?.length) return promptVariants;
  return variantKeys
    .map(key => promptVariantMap[key])
    .filter(Boolean);
};

export async function runModel({
  modelId,
  variantKeys = [],
  outputDir = DEFAULT_OUTPUT_DIR,
  tag
}) {
  const variants = getVariantList(variantKeys);
  if (!variants.length) {
    throw new Error(
      `No valid variants found. Provided keys: ${variantKeys.join(', ') || '[]'}`
    );
  }

  const imageDataUrl = await readImageAsDataUrl();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(
    outputDir,
    sanitize(tag ?? modelId),
    timestamp
  );
  await ensureDir(folder);

  console.log(
    `[${modelId}] variants: ${variants.map(v => v.key).join(', ')} → ${folder}`
  );

  const summary = [];

  for (const variant of variants) {
    const label = `${sanitize(modelId)}__${variant.key}`;
    const payload = buildBody(modelId, variant, imageDataUrl);
    process.stdout.write(`Running ${label}...\n`);
    try {
      const result = await runRequest(payload);
      summary.push({ variant: variant.key, success: true });
      await fs.writeFile(
        path.join(folder, `${label}.json`),
        JSON.stringify(
          {
            model: modelId,
            variant,
            prompt: {
              system: variant.system,
              user: variant.user
            },
            response_format: variant.responseFormat,
            result
          },
          null,
          2
        ),
        'utf8'
      );
      console.log(`  ✅ Saved ${label}`);
    } catch (error) {
      summary.push({ variant: variant.key, success: false, error: error.message });
      await fs.writeFile(
        path.join(folder, `${label}-error.txt`),
        error.stack ?? String(error),
        'utf8'
      );
      console.log(`  ❌ Failed ${label}: ${error.message}`);
    }
  }

  await fs.writeFile(
    path.join(folder, 'summary.json'),
    JSON.stringify(
      {
        model: modelId,
        timestamp,
        summary
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Finished ${modelId}. Summary saved to ${folder}/summary.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const modelId = process.env.MODEL || process.env.MODEL_ID || process.argv[2];
  if (!modelId) {
    console.error('Usage: MODEL=<model_id> [VARIANTS=comma,list] node run-model-base.mjs');
    process.exit(1);
  }
  const variantKeys =
    process.env.VARIANTS?.split(',').map(v => v.trim()).filter(Boolean) ?? [];
  runModel({ modelId, variantKeys }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

