import { nanoid } from 'nanoid';
import { MAX_GUEST_HISTORY, STORAGE_KEYS } from '../constants/storage';
import type { SessionSnapshot, AnalysisSummary, AnswerRecord, SuperJson, DifficultyLevel, SessionStatus, InProgressSessionSummary } from '../types';

const safeWindow = typeof window !== 'undefined' ? window : undefined;

export const persistToken = (token: string | null) => {
  if (!safeWindow) return;
  if (!token) {
    safeWindow.localStorage.removeItem(STORAGE_KEYS.authToken);
    return;
  }
  safeWindow.localStorage.setItem(STORAGE_KEYS.authToken, token);
};

export const setMode = (mode: 'guest' | 'authenticated' | 'unauthenticated') => {
  if (!safeWindow) return;
  safeWindow.localStorage.setItem(STORAGE_KEYS.mode, mode);
};

export const getMode = (): 'guest' | 'authenticated' | 'unauthenticated' => {
  if (!safeWindow) return 'unauthenticated';
  const stored = safeWindow.localStorage.getItem(STORAGE_KEYS.mode);
  if (stored === 'guest' || stored === 'authenticated' || stored === 'unauthenticated') {
    return stored;
  }
  return 'unauthenticated';
};

export const saveGuestSession = (session: {
  difficulty: DifficultyLevel;
  words: string[];
  score: number;
  analysis: AnalysisSummary;
  superJson: SuperJson;
  answers: AnswerRecord[];
  status?: SessionStatus;
  currentQuestionIndex?: number;
}): SessionSnapshot | undefined => {
  if (!safeWindow) return;
  const now = new Date().toISOString();
  const totalQuestions = session.superJson.metadata.totalQuestions;
  const inferredStatus = session.status ?? (session.answers.length >= totalQuestions ? 'completed' : 'in_progress');
  const inferredIndex = session.currentQuestionIndex ?? Math.min(session.answers.length, totalQuestions);
  const snapshot: SessionSnapshot = {
    ...session,
    id: nanoid(),
    mode: 'guest',
    createdAt: now,
    status: inferredStatus,
    currentQuestionIndex: inferredIndex,
    updatedAt: now,
  };

  const history = loadGuestHistory();
  const updated = [snapshot, ...history].slice(0, MAX_GUEST_HISTORY);
  safeWindow.localStorage.setItem(STORAGE_KEYS.guestHistory, JSON.stringify(updated));
  return snapshot;
};

export const loadGuestHistory = (): SessionSnapshot[] => {
  if (!safeWindow) return [];
  const value = safeWindow.localStorage.getItem(STORAGE_KEYS.guestHistory);
  if (!value) return [];
  try {
    return JSON.parse(value) as SessionSnapshot[];
  } catch {
    return [];
  }
};


/**
 * Update progress for a guest session
 * - Find session by ID
 * - Append answer, update index and timestamp
 * - Auto-transition status when complete
 * Requirements: 2.2, 2.3, 2.4
 */
export const updateGuestProgress = (
  sessionId: string,
  answer: AnswerRecord,
  newIndex: number
): SessionSnapshot | undefined => {
  if (!safeWindow) return;
  
  const history = loadGuestHistory();
  const sessionIndex = history.findIndex((s) => s.id === sessionId);
  
  if (sessionIndex === -1) return undefined;
  
  const session = history[sessionIndex];
  const totalQuestions = session.superJson.metadata.totalQuestions;
  
  // Append answer and update index
  const updatedAnswers = [...session.answers, answer];
  const updatedSession: SessionSnapshot = {
    ...session,
    answers: updatedAnswers,
    currentQuestionIndex: newIndex,
    updatedAt: new Date().toISOString(),
    // Auto-transition to completed when all questions answered (Requirement 2.4)
    status: newIndex >= totalQuestions ? 'completed' : 'in_progress',
  };
  
  // Update score if completed
  if (updatedSession.status === 'completed') {
    const correctCount = updatedAnswers.filter((a) => a.correct).length;
    updatedSession.score = Math.round((correctCount / totalQuestions) * 100);
  }
  
  // Update history
  const updatedHistory = [...history];
  updatedHistory[sessionIndex] = updatedSession;
  safeWindow.localStorage.setItem(STORAGE_KEYS.guestHistory, JSON.stringify(updatedHistory));
  
  return updatedSession;
};


/**
 * Get all in-progress guest sessions
 * - Filter sessions by status === 'in_progress'
 * - Return summary list
 * Requirements: 4.1
 */
export const getGuestInProgressSessions = (): InProgressSessionSummary[] => {
  const history = loadGuestHistory();
  
  return history
    .filter((s) => s.status === 'in_progress')
    .map((s) => ({
      id: s.id,
      difficulty: s.difficulty,
      wordCount: s.words.length,
      answeredCount: s.answers.length,
      totalQuestions: s.superJson.metadata.totalQuestions,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
};


/**
 * Delete a guest session by ID
 * - Remove session by ID from LocalStorage
 * Requirements: 4.4
 */
export const deleteGuestSession = (sessionId: string): boolean => {
  if (!safeWindow) return false;
  
  const history = loadGuestHistory();
  const filteredHistory = history.filter((s) => s.id !== sessionId);
  
  // Return false if session was not found
  if (filteredHistory.length === history.length) return false;
  
  safeWindow.localStorage.setItem(STORAGE_KEYS.guestHistory, JSON.stringify(filteredHistory));
  return true;
};


/**
 * Update superJson for a guest session (when retry succeeds)
 * - Find session by ID
 * - Update superJson and timestamp
 * Requirements: 7.3
 */
export const updateGuestSessionSuperJson = (
  sessionId: string,
  superJson: import('../types').SuperJson
): SessionSnapshot | undefined => {
  if (!safeWindow) return;
  
  const history = loadGuestHistory();
  const sessionIndex = history.findIndex((s) => s.id === sessionId);
  
  if (sessionIndex === -1) return undefined;
  
  const session = history[sessionIndex];
  
  // Only allow updating in-progress sessions
  if (session.status !== 'in_progress') return undefined;
  
  const updatedSession: SessionSnapshot = {
    ...session,
    superJson,
    updatedAt: new Date().toISOString(),
  };
  
  // Update history
  const updatedHistory = [...history];
  updatedHistory[sessionIndex] = updatedSession;
  safeWindow.localStorage.setItem(STORAGE_KEYS.guestHistory, JSON.stringify(updatedHistory));
  
  return updatedSession;
};


/**
 * Create a new in-progress session for guest users
 * - Create session with status='in_progress', currentQuestionIndex=0, empty answers
 * - Generate nanoid for session ID
 * - Save to LocalStorage and return { id, createdAt }
 * Requirements: 4.1, 4.2
 */
export const createGuestInProgressSession = (params: {
  difficulty: DifficultyLevel;
  words: string[];
  superJson: SuperJson;
  hasVocabDetails?: boolean;
  vocabDetails?: import('../types').VocabularyDetail[];
}): { id: string; createdAt: string } | undefined => {
  if (!safeWindow) return undefined;
  
  const now = new Date().toISOString();
  const id = nanoid();
  
  const snapshot: SessionSnapshot = {
    id,
    mode: 'guest',
    difficulty: params.difficulty,
    words: params.words,
    superJson: params.superJson,
    answers: [],
    score: 0,
    analysis: { report: '', recommendations: [] },
    status: 'in_progress',
    currentQuestionIndex: 0,
    createdAt: now,
    updatedAt: now,
    hasVocabDetails: params.hasVocabDetails ?? false,
    vocabDetails: params.vocabDetails,
  };
  
  const history = loadGuestHistory();
  const updated = [snapshot, ...history].slice(0, MAX_GUEST_HISTORY);
  safeWindow.localStorage.setItem(STORAGE_KEYS.guestHistory, JSON.stringify(updated));
  
  return { id, createdAt: now };
};
