#!/usr/bin/env node

/**
 * matrixRunner.mjs
 * 扩展版实验脚本：在多个模型 × 提示词 × JSON 模板之间交叉测试。
 * 结果输出到 ImageTest/results_matrix/<timestamp>/，并附带 summary.json 方便统计。
 *
 * 用法：
 *   OPENROUTER_API_KEY=sk-... node ImageTest/matrixRunner.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { ProxyAgent } from 'undici';

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
  console.error('缺少 OPENROUTER_API_KEY 环境变量');
  process.exit(1);
}

const imagePath = path.resolve('ImageTest/1765ED57-F230-4C6A-B019-52CE51812F3B_1_105_c.jpeg');
const outputDir = path.resolve('ImageTest/results_matrix');

const schemaSections = {
  type: 'json_schema',
  json_schema: {
    name: 'sections_payload',
    schema: {
      type: 'object',
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    order: { type: 'integer' },
                    text: { type: 'string' },
                    note: { type: 'string' }
                  },
                  required: ['text']
                }
              }
            },
            required: ['heading', 'entries']
          }
        }
      },
      required: ['sections'],
      additionalProperties: false
    }
  }
};

const schemaFlatList = {
  type: 'json_schema',
  json_schema: {
    name: 'flat_list_payload',
    schema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'integer' },
              text: { type: 'string' },
              heading: { type: 'string' }
            },
            required: ['text']
          }
        }
      },
      required: ['words'],
      additionalProperties: false
    }
  }
};

const entryRuleText =
  '只提取编号词汇，不要把区块标题当成词条。去掉 (n.)、(adj.) 等词性括号，让文本与核心单词一致，同时保留花体撇号/连字符（例如 “cat’s”）。';

const promptStyles = {
  strictSections: {
    system:
      '你是一个严格的视觉 OCR 代理，读取学习资料时必须逐字核对。' +
      '禁止臆造内容，并确保“cat’s”这类撇号写法完全保留。' +
      entryRuleText,
    user:
      '阅读给定的单词表照片，按照区块（标题 + 列表）输出 JSON。' +
      '每个条目需要原样文本，去掉 (n.)、(adj.) 尾巴，若你不确定请在 note 字段里写 "uncertain"。',
    responseFormat: schemaSections
  },
  bilingualFlat: {
    system:
      'Act as a bilingual vocabulary transcriber. Capture the heading each term belongs to. ' +
      'Return the bare word/phrase only and retain curly apostrophes (’).',
    user:
      'Parse the entire worksheet. Return JSON with一个扁平 words[] 数组，包含 index、heading、text 字段。' +
      entryRuleText,
    responseFormat: schemaFlatList
  },
  markdownDualPass: {
    system:
      'Perform two-pass transcription: pass one captures everything, pass two verifies spelling. ' +
      'Mark uncertain items with "(?)" and remember to drop (n.)/(adj.) tails while keeping curly apostrophes intact.',
    user:
      '输出 Markdown：二级标题 = 区块名，下面使用有序列表。完成后列出 `Uncertain:` 行，写出你标记的问题词。' +
      entryRuleText,
    responseFormat: null
  }
};

const experiments = [
  {
    name: 'claude45_sections',
    model: 'anthropic/claude-sonnet-4.5',
    temperature: 0,
    promptKey: 'strictSections'
  },
  {
    name: 'claude35_sections',
    model: 'anthropic/claude-3.5-sonnet',
    temperature: 0,
    promptKey: 'strictSections'
  },
  {
    name: 'gemini25_flat',
    model: 'google/gemini-2.5-pro',
    temperature: 0.05,
    promptKey: 'bilingualFlat'
  },
  {
    name: 'nova_sections',
    model: 'amazon/nova-premier-v1',
    temperature: 0.05,
    promptKey: 'strictSections'
  },
  {
    name: 'qwen235_markdown',
    model: 'qwen/qwen3-vl-235b-a22b-instruct',
    temperature: 0,
    promptKey: 'markdownDualPass'
  },
  {
    name: 'llama90_markdown',
    model: 'meta-llama/llama-3.2-90b-vision-instruct',
    temperature: 0,
    promptKey: 'markdownDualPass'
  }
];

const ensureDir = async target => {
  await fs.mkdir(target, { recursive: true });
};

const readImageAsDataUrl = async filePath => {
  const buf = await fs.readFile(filePath);
  const base64 = buf.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
};

const buildBody = (experiment, promptStyle, imageDataUrl) => {
  const body = {
    model: experiment.model,
    temperature: experiment.temperature ?? 0,
    messages: [
      { role: 'system', content: promptStyle.system },
      {
        role: 'user',
        content: [
          { type: 'text', text: promptStyle.user },
          { type: 'image_url', image_url: imageDataUrl }
        ]
      }
    ]
  };

  if (promptStyle.responseFormat) {
    body.response_format = promptStyle.responseFormat;
  }

  return body;
};

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
      `OpenRouter request failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  return parsed;
};

const main = async () => {
  await ensureDir(outputDir);
  const imageDataUrl = await readImageAsDataUrl(imagePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runFolder = path.join(outputDir, timestamp);
  await ensureDir(runFolder);

  const summary = [];
  await fs.writeFile(
    path.join(runFolder, 'metadata.json'),
    JSON.stringify(
      {
        timestamp,
        experiments,
        promptStyles: Object.keys(promptStyles)
      },
      null,
      2
    )
  );

  for (const experiment of experiments) {
    const promptStyle = promptStyles[experiment.promptKey];
    if (!promptStyle) {
      console.warn(
        `跳过 ${experiment.name}，未知 promptKey=${experiment.promptKey}`
      );
      continue;
    }

    const label = `${experiment.name}`;
    process.stdout.write(`Running ${label}...\n`);
    try {
      const body = buildBody(experiment, promptStyle, imageDataUrl);
      const result = await runRequest(body);
      summary.push({
        experiment: label,
        model: experiment.model,
        prompt: experiment.promptKey,
        success: true
      });
      await fs.writeFile(
        path.join(runFolder, `${label}.json`),
        JSON.stringify(
          {
            experiment,
            promptStyle,
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
        model: experiment.model,
        prompt: experiment.promptKey,
        success: false,
        error: error.message
      });
      await fs.writeFile(
        path.join(runFolder, `${label}-error.txt`),
        error.stack ?? String(error),
        'utf8'
      );
      console.log(`  ❌ Failed ${label} (${error.message})`);
    }
  }

  await fs.writeFile(
    path.join(runFolder, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
  console.log(`\n本轮结果：${runFolder}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
