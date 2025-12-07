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

/**
 * Check if a column exists in a table
 */
const columnExists = (tableName: string, columnName: string): boolean => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((col) => col.name === columnName);
};

/**
 * Run initial schema migrations (create tables if not exist)
 */
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

  // Run session resume migrations
  runSessionResumeMigrations();

  // Run optional vocab details migrations
  runVocabDetailsMigrations();
};

/**
 * Migration for session-resume feature (Requirements 6.1, 6.2, 6.3, 6.4)
 * Adds status, current_question_index, and updated_at columns to sessions table
 */
export const runSessionResumeMigrations = () => {
  // Add status column with default 'in_progress' (Requirement 6.1)
  if (!columnExists('sessions', 'status')) {
    db.prepare(`ALTER TABLE sessions ADD COLUMN status TEXT DEFAULT 'in_progress'`).run();
    // Migrate existing records: set status to 'completed'
    db.prepare(`UPDATE sessions SET status = 'completed' WHERE status IS NULL OR status = 'in_progress'`).run();
  }

  // Add current_question_index column with default 0 (Requirement 6.2)
  if (!columnExists('sessions', 'current_question_index')) {
    db.prepare(`ALTER TABLE sessions ADD COLUMN current_question_index INTEGER DEFAULT 0`).run();
  }

  // Add updated_at column (Requirement 6.3)
  if (!columnExists('sessions', 'updated_at')) {
    db.prepare(`ALTER TABLE sessions ADD COLUMN updated_at TEXT`).run();
    // Migrate existing records: copy created_at to updated_at (Requirement 6.4)
    db.prepare(`UPDATE sessions SET updated_at = created_at WHERE updated_at IS NULL`).run();
  }
};

/**
 * Migration for optional-vocab-details feature (Requirements 4.1, 4.2)
 * Adds has_vocab_details and vocab_details columns to sessions table
 */
export const runVocabDetailsMigrations = () => {
  // Add has_vocab_details column with default 0 (false) (Requirement 4.1)
  if (!columnExists('sessions', 'has_vocab_details')) {
    db.prepare(`ALTER TABLE sessions ADD COLUMN has_vocab_details INTEGER DEFAULT 0`).run();
  }

  // Add vocab_details column for JSON storage (Requirement 4.2)
  if (!columnExists('sessions', 'vocab_details')) {
    db.prepare(`ALTER TABLE sessions ADD COLUMN vocab_details TEXT`).run();
  }
};

runMigrations();
