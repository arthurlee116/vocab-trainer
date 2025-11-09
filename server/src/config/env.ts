import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const rootEnvPath = path.resolve(__dirname, '../../..', '.env');

if (!fs.existsSync(rootEnvPath)) {
  throw new Error(`Missing required root .env file: ${rootEnvPath}`);
}

dotenv.config({ path: rootEnvPath });

const required = (value: string | undefined, label: string) => {
  if (!value) {
    throw new Error(`Missing required env var: ${label}`);
  }

  return value;
};

const parseOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return ['http://localhost:5173'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN),
  openRouterApiKey: required(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
  openRouterTitle: process.env.OPENROUTER_APP_TITLE ?? 'AI Vocabulary Trainer',
  openRouterReferer: process.env.OPENROUTER_REFERER ?? 'http://localhost:5173',
  openRouterProxy: process.env.OPENROUTER_PROXY,
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  databasePath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'storage', 'vocab.db'),
  maxVlmImages: parsePositiveInt(process.env.VITE_MAX_VLM_IMAGES, 5),
};
