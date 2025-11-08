#!/usr/bin/env node

/**
 * evaluateResults.mjs
 * 将模型输出与 ImageTest/List1.md 的标准答案对比，计算覆盖率和额外噪声。
 *
 * 用法：
 *   node ImageTest/evaluateResults.mjs ImageTest/results_matrix/<timestamp>
 *   # 若不传路径，则自动选取 results_matrix 下最新的时间戳目录
 */

import fs from 'fs/promises';
import path from 'path';

const resultsRoot = path.resolve('ImageTest/results_matrix');
const groundTruthPath = path.resolve('ImageTest/List1.md');

const normalize = str =>
  str
    .toLowerCase()
    .replace(/```(json|markdown)?/gi, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[:;.,]+$/, '')
    .trim();

const parseGroundTruth = async () => {
  const content = await fs.readFile(groundTruthPath, 'utf8');
  const lines = content.split('\n');
  const entries = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s*(.+)$/);
    if (match) {
      entries.push(match[1].trim());
    }
  }
  return entries;
};

const stripFence = text => {
  if (!text) return text;
  return text.replace(/^\s*```[a-zA-Z]*\s*/g, '').replace(/```$/g, '').trim();
};

const tryParseJson = value => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractFromJson = json => {
  const acc = [];
  if (!json || typeof json !== 'object') {
    return acc;
  }

  const visit = node => {
    if (node == null) return;
    if (typeof node === 'string') {
      acc.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === 'object') {
      if (typeof node.normalized === 'string') {
        acc.push(node.normalized);
      } else if (typeof node.text === 'string') {
        acc.push(node.text);
      } else if (typeof node.value === 'string') {
        acc.push(node.value);
      }
      if (typeof node.heading === 'string' && !node.entries && !node.items) {
        acc.push(node.heading);
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
          visit(value);
        }
      }
    }
  };

  visit(json);
  return acc;
};

const extractFromMarkdown = text => {
  const lines = text.split('\n');
  const words = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)]\s*(.+)$/);
    if (match) {
      words.push(match[1].trim());
    }
  }
  return words;
};

const extractTexts = content => {
  if (typeof content !== 'string') {
    return [];
  }

  const trimmed = content.trim();
  const cleaned = stripFence(trimmed);
  const asJson = tryParseJson(cleaned);

  if (asJson) {
    return extractFromJson(asJson);
  }

  const maybeJson = trimmed.startsWith('{') ? tryParseJson(trimmed) : null;
  if (maybeJson) {
    return extractFromJson(maybeJson);
  }

  return extractFromMarkdown(content);
};

const readLatestFolder = async () => {
  const entries = await fs.readdir(resultsRoot);
  const dirs = [];
  for (const name of entries) {
    const fullPath = path.join(resultsRoot, name);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      dirs.push({ name, fullPath });
    }
  }
  if (!dirs.length) {
    throw new Error('results_matrix 目录为空');
  }
  dirs.sort((a, b) => (a.name < b.name ? 1 : -1));
  return dirs[0].fullPath;
};

const evaluateFile = async (filePath, truthSet) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const content =
    parsed?.result?.choices?.[0]?.message?.content ??
    parsed?.choices?.[0]?.message?.content ??
    '';

  const extracted = extractTexts(content);
  const normalizedExtracted = extracted
    .map(normalize)
    .filter(Boolean);

  const uniqueExtracted = [...new Set(normalizedExtracted)];

  const matches = uniqueExtracted.filter(text => truthSet.has(text));
  const extras = uniqueExtracted.filter(text => !truthSet.has(text));

  const coverage = matches.length / truthSet.size;

  return {
    totalExtracted: uniqueExtracted.length,
    matches: matches.length,
    extras: extras.length,
    coverage,
    unmatchedSamples: extras.slice(0, 10),
    missingSamples: [...truthSet]
      .filter(item => !matches.includes(item))
      .slice(0, 10)
  };
};

const main = async () => {
  const targetFolder =
    process.argv[2] && !process.argv[2].startsWith('--')
      ? path.resolve(process.argv[2])
      : await readLatestFolder();

  const groundTruth = await parseGroundTruth();
  const truthSet = new Set(groundTruth.map(normalize).filter(Boolean));

  const files = (await fs.readdir(targetFolder)).filter(file => {
    if (!file.endsWith('.json')) return false;
    return !['summary.json', 'metadata.json', 'evaluation.json'].includes(file);
  });

  if (!files.length) {
    console.error('没有找到结果文件');
    process.exit(1);
  }

  const summary = [];

  for (const file of files) {
    if (file === 'metadata.json') continue;
    const filePath = path.join(targetFolder, file);
    const stats = await evaluateFile(filePath, truthSet);
    summary.push({
      file,
      ...stats
    });
    console.log(
      `${file}: coverage=${(stats.coverage * 100).toFixed(1)}% ` +
        `matches=${stats.matches}/${truthSet.size} extras=${stats.extras}`
    );
  }

  await fs.writeFile(
    path.join(targetFolder, 'evaluation.json'),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        truth_size: truthSet.size,
        summary
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`评估完成，结果写入 ${path.join(targetFolder, 'evaluation.json')}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
