import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for session-resume database migrations
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

interface TableColumn {
  name: string;
  type: string;
  dflt_value: string | null;
}

interface SessionRow {
  id: string;
  status: string | null;
  current_question_index: number | null;
  updated_at: string | null;
  created_at: string;
}

describe('session-resume migrations', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-migration-'));
    const dbDir = path.join(tempDir, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    dbPath = path.join(dbDir, 'test.db');
    process.env.DATABASE_PATH = dbPath;
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should add status column with default in_progress (Requirement 6.1)', async () => {
    const { db } = await import('../client.js');

    try {
      const columns = db.prepare('PRAGMA table_info(sessions)').all() as TableColumn[];
      const statusColumn = columns.find((col) => col.name === 'status');

      expect(statusColumn).toBeDefined();
      expect(statusColumn?.dflt_value).toBe("'in_progress'");
    } finally {
      db.close();
    }
  });

  it('should add current_question_index column with default 0 (Requirement 6.2)', async () => {
    const { db } = await import('../client.js');

    try {
      const columns = db.prepare('PRAGMA table_info(sessions)').all() as TableColumn[];
      const indexColumn = columns.find((col) => col.name === 'current_question_index');

      expect(indexColumn).toBeDefined();
      expect(indexColumn?.type).toBe('INTEGER');
      expect(indexColumn?.dflt_value).toBe('0');
    } finally {
      db.close();
    }
  });

  it('should add updated_at column (Requirement 6.3)', async () => {
    const { db } = await import('../client.js');

    try {
      const columns = db.prepare('PRAGMA table_info(sessions)').all() as TableColumn[];
      const updatedAtColumn = columns.find((col) => col.name === 'updated_at');

      expect(updatedAtColumn).toBeDefined();
      expect(updatedAtColumn?.type).toBe('TEXT');
    } finally {
      db.close();
    }
  });

  it('should migrate existing records: set status to completed and copy created_at to updated_at (Requirement 6.4)', async () => {
    // First, create a database with old schema (without new columns)
    const Database = (await import('better-sqlite3')).default;
    const oldDb = new Database(dbPath);
    oldDb.pragma('journal_mode = WAL');

    // Create old schema without new columns
    oldDb.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();

    oldDb.prepare(`
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
      )
    `).run();

    // Insert a test user
    oldDb.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES ('test-user', 'test@example.com', 'hash', '2025-01-01T00:00:00.000Z')
    `).run();

    // Insert existing session record (simulating pre-migration data)
    const existingCreatedAt = '2025-01-15T10:30:00.000Z';
    oldDb.prepare(`
      INSERT INTO sessions (id, user_id, mode, difficulty, words, super_json, answers, score, analysis, created_at)
      VALUES ('existing-session', 'test-user', 'authenticated', 'beginner', '["word1"]', '{}', '[]', 85, '{}', ?)
    `).run(existingCreatedAt);

    oldDb.close();

    // Now run migrations by importing the client
    vi.resetModules();
    const { db } = await import('../client.js');

    try {
      // Verify the existing record was migrated correctly
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('existing-session') as SessionRow;

      // Requirement 6.4: existing sessions should have status = 'completed'
      expect(session.status).toBe('completed');

      // Requirement 6.4: updated_at should be copied from created_at
      expect(session.updated_at).toBe(existingCreatedAt);
    } finally {
      db.close();
    }
  });

  it('should set default values for new sessions after migration', async () => {
    const { db } = await import('../client.js');

    try {
      // Insert a test user first
      db.prepare(`
        INSERT INTO users (id, email, password_hash, created_at)
        VALUES ('new-user', 'new@example.com', 'hash', '2025-01-01T00:00:00.000Z')
      `).run();

      // Insert a new session without specifying new columns
      const createdAt = new Date().toISOString();
      db.prepare(`
        INSERT INTO sessions (id, user_id, mode, difficulty, words, super_json, answers, score, analysis, created_at, updated_at)
        VALUES ('new-session', 'new-user', 'authenticated', 'beginner', '["word1"]', '{}', '[]', 0, '{}', ?, ?)
      `).run(createdAt, createdAt);

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get('new-session') as SessionRow;

      // New sessions should have default status 'in_progress'
      expect(session.status).toBe('in_progress');
      // New sessions should have default current_question_index 0
      expect(session.current_question_index).toBe(0);
    } finally {
      db.close();
    }
  });

  it('should be idempotent - running migrations multiple times should not fail', async () => {
    const { db, runSessionResumeMigrations } = await import('../client.js');

    try {
      // Run migrations again - should not throw
      expect(() => runSessionResumeMigrations()).not.toThrow();

      // Verify columns still exist
      const columns = db.prepare('PRAGMA table_info(sessions)').all() as TableColumn[];
      const columnNames = columns.map((col) => col.name);

      expect(columnNames).toContain('status');
      expect(columnNames).toContain('current_question_index');
      expect(columnNames).toContain('updated_at');
    } finally {
      db.close();
    }
  });
});
