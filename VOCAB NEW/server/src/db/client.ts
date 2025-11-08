import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const dbDir = path.dirname(env.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');

export const runMigrations = () => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      mode TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      words TEXT NOT NULL,
      super_json TEXT NOT NULL,
      answers TEXT NOT NULL,
      score REAL NOT NULL,
      analysis TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
  ).run();
};

runMigrations();
