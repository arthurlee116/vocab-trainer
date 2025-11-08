import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

dotenv.config(envPath ? { path: envPath } : undefined);

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

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN),
  openRouterApiKey: required(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY'),
  openRouterTitle: process.env.OPENROUTER_APP_TITLE ?? 'AI Vocabulary Trainer',
  openRouterReferer: process.env.OPENROUTER_REFERER ?? 'http://localhost:5173',
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  databasePath: process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'storage', 'vocab.db'),
};
