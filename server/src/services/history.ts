import { randomUUID } from 'crypto';
import { db } from '../db/client';
import { InProgressSessionSummary, SessionRecord, SessionStatus, StatsResponse, WeeklyActivity } from '../types';

const insertStmt = db.prepare(
  `
  INSERT INTO sessions (id, user_id, mode, difficulty, words, super_json, answers, score, analysis, created_at, status, current_question_index, updated_at)
  VALUES (@id, @user_id, @mode, @difficulty, @words, @super_json, @answers, @score, @analysis, @created_at, @status, @current_question_index, @updated_at)
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

const listByStatusStmt = db.prepare(
  `
  SELECT *
  FROM sessions
  WHERE user_id = ? AND status = ?
  ORDER BY datetime(updated_at) DESC
`,
);

const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?');

export const saveSession = (record: Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;
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
    status: record.status,
    current_question_index: record.currentQuestionIndex,
    updated_at: updatedAt,
  });

  return { ...record, id, createdAt, updatedAt };
};

/**
 * Create an in-progress session when generation completes first section
 * Requirements: 7.2
 */
export const createInProgressSession = (
  record: Omit<SessionRecord, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentQuestionIndex' | 'score' | 'analysis' | 'answers'> & { userId: string },
): SessionRecord => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  insertStmt.run({
    id,
    user_id: record.userId,
    mode: record.mode,
    difficulty: record.difficulty,
    words: JSON.stringify(record.words),
    super_json: JSON.stringify(record.superJson),
    answers: JSON.stringify([]),
    score: 0,
    analysis: JSON.stringify({ report: '', recommendations: [] }),
    created_at: createdAt,
    status: 'in_progress',
    current_question_index: 0,
    updated_at: updatedAt,
  });

  return {
    id,
    userId: record.userId,
    mode: record.mode,
    difficulty: record.difficulty,
    words: record.words,
    superJson: record.superJson,
    answers: [],
    score: 0,
    analysis: { report: '', recommendations: [] },
    createdAt,
    status: 'in_progress',
    currentQuestionIndex: 0,
    updatedAt,
  };
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
  status: row.status || 'completed',
  currentQuestionIndex: row.current_question_index || 0,
  updatedAt: row.updated_at || row.created_at,
});

/**
 * List sessions with optional status filter
 * Requirements: 4.1
 */
export const listSessions = (userId: string, status?: SessionStatus): SessionRecord[] => {
  const rows = status ? listByStatusStmt.all(userId, status) : listStmt.all(userId);
  return rows.map(mapRow);
};

export const getSession = (userId: string, sessionId: string): SessionRecord | null => {
  const row = getStmt.get(sessionId, userId);
  return row ? mapRow(row) : null;
};

/**
 * Update progress for an in-progress session
 * Requirements: 2.1, 2.3, 2.4
 */
export const updateProgress = (
  userId: string,
  sessionId: string,
  answer: import('../types').AnswerRecord,
  newIndex: number,
): SessionRecord | null => {
  const session = getSession(userId, sessionId);
  if (!session) return null;

  const updatedAnswers = [...session.answers, answer];
  const updatedAt = new Date().toISOString();

  // Calculate total questions from superJson
  const totalQuestions =
    session.superJson.questions_type_1.length +
    session.superJson.questions_type_2.length +
    session.superJson.questions_type_3.length;

  // Auto-transition to completed when index equals total (Requirement 2.4)
  const newStatus: SessionStatus = newIndex >= totalQuestions ? 'completed' : 'in_progress';

  // Calculate score if completed
  const correctCount = updatedAnswers.filter((a) => a.correct).length;
  const newScore = newStatus === 'completed' ? Math.round((correctCount / totalQuestions) * 100) : session.score;

  db.prepare(
    `
    UPDATE sessions
    SET answers = @answers,
        current_question_index = @current_question_index,
        updated_at = @updated_at,
        status = @status,
        score = @score
    WHERE id = @id AND user_id = @user_id
  `,
  ).run({
    answers: JSON.stringify(updatedAnswers),
    current_question_index: newIndex,
    updated_at: updatedAt,
    status: newStatus,
    score: newScore,
    id: sessionId,
    user_id: userId,
  });

  return {
    ...session,
    answers: updatedAnswers,
    currentQuestionIndex: newIndex,
    updatedAt,
    status: newStatus,
    score: newScore,
  };
};

/**
 * Delete a session by ID with user ownership check
 * Requirements: 4.4
 */
export const deleteSession = (userId: string, sessionId: string): boolean => {
  const result = db
    .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .run(sessionId, userId);
  return result.changes > 0;
};

/**
 * Update superJson for an in-progress session (when retry succeeds)
 * This allows resuming with newly generated questions after partial failure
 * Requirements: 7.3
 */
export const updateSessionSuperJson = (
  userId: string,
  sessionId: string,
  superJson: import('../types').SuperJson,
): SessionRecord | null => {
  const session = getSession(userId, sessionId);
  if (!session) return null;

  // Only allow updating in-progress sessions
  if (session.status !== 'in_progress') {
    return null;
  }

  const updatedAt = new Date().toISOString();

  db.prepare(
    `
    UPDATE sessions
    SET super_json = @super_json,
        updated_at = @updated_at
    WHERE id = @id AND user_id = @user_id
  `,
  ).run({
    super_json: JSON.stringify(superJson),
    updated_at: updatedAt,
    id: sessionId,
    user_id: userId,
  });

  return {
    ...session,
    superJson,
    updatedAt,
  };
};

/**
 * Get learning statistics for a user
 * Returns total words learned, completed sessions, and weekly activity
 */
export const getLearningStats = (userId: string): StatsResponse => {
  // Get total words learned (distinct words from completed sessions)
  const totalWordsQuery = db.prepare(`
    SELECT COUNT(DISTINCT json_extract.value) as totalWords
    FROM sessions
    JOIN json_each(sessions.words) AS json_extract
    WHERE sessions.user_id = ? AND sessions.status = 'completed'
  `);
  
  const totalWordsResult = totalWordsQuery.get(userId) as { totalWords: number };
  const totalWordsLearned = totalWordsResult?.totalWords || 0;

  // Get total completed sessions
  const completedSessionsQuery = db.prepare(`
    SELECT COUNT(*) as totalSessions
    FROM sessions
    WHERE sessions.user_id = ? AND sessions.status = 'completed'
  `);
  
  const completedSessionsResult = completedSessionsQuery.get(userId) as { totalSessions: number };
  const totalSessionsCompleted = completedSessionsResult?.totalSessions || 0;

  // Get weekly activity (last 7 days)
  const weeklyActivityQuery = db.prepare(`
    SELECT 
      DATE(updated_at) as date,
      COUNT(*) as count
    FROM sessions
    WHERE sessions.user_id = ? 
      AND sessions.status = 'completed'
      AND DATE(updated_at) >= DATE('now', '-7 days')
    GROUP BY DATE(updated_at)
    ORDER BY date DESC
  `);
  
  const weeklyActivityRows = weeklyActivityQuery.all(userId) as Array<{ date: string; count: number }>;
  
  // Fill in missing days with 0 count
  const weeklyActivity: WeeklyActivity[] = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const dayData = weeklyActivityRows.find(row => row.date === dateStr);
    weeklyActivity.push({
      date: dateStr,
      count: dayData?.count || 0
    });
  }

  return {
    totalWordsLearned,
    totalSessionsCompleted,
    weeklyActivity
  };
};
