import { randomUUID } from 'crypto';
import { db } from '../db/client';
import { SessionRecord } from '../types';

const insertStmt = db.prepare(
  `
  INSERT INTO sessions (id, user_id, mode, difficulty, words, super_json, answers, score, analysis, created_at)
  VALUES (@id, @user_id, @mode, @difficulty, @words, @super_json, @answers, @score, @analysis, @created_at)
`,
);

const listStmt = db.prepare(
  `
  SELECT *
  FROM sessions
  WHERE user_id = ?
  ORDER BY datetime(created_at) DESC
`,
);

const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?');

export const saveSession = (record: Omit<SessionRecord, 'id' | 'createdAt'> & { userId: string }) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  insertStmt.run({
    id,
    user_id: record.userId,
    mode: record.mode,
    difficulty: record.difficulty,
    words: JSON.stringify(record.words),
    super_json: JSON.stringify(record.superJson),
    answers: JSON.stringify(record.answers),
    score: record.score,
    analysis: JSON.stringify(record.analysis),
    created_at: createdAt,
  });

  return { ...record, id, createdAt };
};

const mapRow = (row: any): SessionRecord => ({
  id: row.id,
  userId: row.user_id,
  mode: row.mode,
  difficulty: row.difficulty,
  words: JSON.parse(row.words),
  superJson: JSON.parse(row.super_json),
  answers: JSON.parse(row.answers),
  score: row.score,
  analysis: JSON.parse(row.analysis),
  createdAt: row.created_at,
});

export const listSessions = (userId: string): SessionRecord[] => {
  const rows = listStmt.all(userId);
  return rows.map(mapRow);
};

export const getSession = (userId: string, sessionId: string): SessionRecord | null => {
  const row = getStmt.get(sessionId, userId);
  return row ? mapRow(row) : null;
};
