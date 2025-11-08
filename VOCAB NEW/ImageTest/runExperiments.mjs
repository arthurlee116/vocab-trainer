#!/usr/bin/env node

/**
 * runExperiments.mjs
 *
 * Reads the curated model list from ImageTest/models.md, then runs each model
 * through multiple prompt + JSON schema combinations using OpenRouter.
 * All prompts enforce native JSON Schema structured output.
 *
 * Usage examples:
 *   OPENROUTER_API_KEY=sk-... node ImageTest/runExperiments.mjs
 *   MODEL_FILTER="openai/gpt-5-mini,anthropic/claude-sonnet-4.5" node ImageTest/runExperiments.mjs
 *   MAX_MODELS=5 VARIANT_FILTER="nopunct_words,sections_after_number" node ImageTest/runExperiments.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { ProxyAgent } from 'undici';
import { promptVariants } from './lib/prompts.mjs';

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
  console.error('Missing OPENROUTER_API_KEY env variable.');
  process.exit(1);
}

const IMAGE_PATH = path.resolve(
  'ImageTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg'
);
const MODELS_MD_PATH = path.resolve('ImageTest/models.md');
const OUTPUT_DIR = path.resolve('ImageTest/results');

const sanitizeFilename = value =>
  value.replace(/[^a-z0-9._-]+/gi, '_').replace(/_+/g, '_');

const parseListArg = raw =>
  raw
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean) ?? [];

const resolveFilter = (...sources) => {
  for (const source of sources) {
    const parsed = parseListArg(source);
    if (parsed.length) return parsed;
  }
  return [];
};

const parseModelsMd = async () => {
  const content = await fs.readFile(MODELS_MD_PATH, 'utf8');
  const lines = content.split('\n');
  const models = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s*([^\s]+)\s*$/);
    if (match) {
      models.push(match[1]);
    }
  }
  return models;
};

const ensureDir = async dir => {
  await fs.mkdir(dir, { recursive: true });
};

const readImageAsDataUrl = async () => {
  const data = await fs.readFile(IMAGE_PATH);
  return `data:image/jpeg;base64,${data.toString('base64')}`;
};

const buildBody = (model, variant, imageDataUrl) => ({
  model,
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
  const fetchOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  if (dispatcher) {
    fetchOptions.dispatcher = dispatcher;
  }

  const res = await fetch(OPENROUTER_URL, fetchOptions);
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

const parseCliOptions = () => {
  const options = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [key, value = 'true'] = arg.slice(2).split('=');
    options[key] = value;
  }
  return options;
};

const main = async () => {
  const cli = parseCliOptions();
  const imageDataUrl = await readImageAsDataUrl();
  const models = await parseModelsMd();

  if (!models.length) {
    console.error(`No models found in ${MODELS_MD_PATH}`);
    process.exit(1);
  }

  const modelFilter = resolveFilter(
    cli.models,
    process.env.MODELS ?? process.env.MODEL_FILTER
  );
  const variantFilter = resolveFilter(
    cli.variants,
    process.env.VARIANTS ?? process.env.VARIANT_FILTER
  );
  const maxModels = Number(cli.limit ?? process.env.MAX_MODELS ?? models.length);

  const filteredModels = models.filter(model => {
    if (!modelFilter.length) return true;
    return modelFilter.includes(model);
  });

  if (!filteredModels.length) {
    console.error(
      'Model filter removed all entries. Check MODEL_FILTER / --models values.'
    );
    process.exit(1);
  }

  const maxCount =
    Number.isFinite(maxModels) && maxModels > 0
      ? Math.min(filteredModels.length, Math.floor(maxModels))
      : filteredModels.length;

  const selectedModels = filteredModels.slice(0, Math.max(1, maxCount));

  const selectedVariants = promptVariants.filter(variant => {
    if (!variantFilter.length) return true;
    return variantFilter.includes(variant.key);
  });

  if (!selectedVariants.length) {
    console.error('No prompt variants selected. Check VARIANT_FILTER or --variants.');
    process.exit(1);
  }

  await ensureDir(OUTPUT_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runFolder = path.join(OUTPUT_DIR, timestamp);
  await ensureDir(runFolder);

  console.log(`Models: ${selectedModels.join(', ')}`);
  console.log(`Variants: ${selectedVariants.map(v => v.key).join(', ')}`);
  console.log(`Saving results under ${runFolder}`);

  const summary = [];

  for (const model of selectedModels) {
    for (const variant of selectedVariants) {
      const label = `${sanitizeFilename(model)}__${variant.key}`;
      const payload = buildBody(model, variant, imageDataUrl);
      console.log(`Running ${label}...`);
      try {
        const result = await runRequest(payload);
        summary.push({
          experiment: label,
          model,
          variant: variant.key,
          success: true
        });
        await fs.writeFile(
          path.join(runFolder, `${label}.json`),
          JSON.stringify(
            {
              model,
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
        summary.push({
          experiment: label,
          model,
          variant: variant.key,
          success: false,
          error: error.message
        });
        await fs.writeFile(
          path.join(runFolder, `${label}-error.txt`),
          error.stack ?? String(error),
          'utf8'
        );
        console.log(`  ❌ Failed ${label}: ${error.message}`);
      }
    }
  }

  await fs.writeFile(
    path.join(runFolder, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log('\nSummary:', summary);
  console.log(`Results stored in ${runFolder}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
