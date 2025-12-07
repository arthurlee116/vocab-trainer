/**
 * Progress Service - Abstract interface for both auth modes
 * 
 * This service provides a unified API for managing session progress,
 * routing to either the server API (authenticated users) or LocalStorage (guests).
 * 
 * Requirements: 2.1, 2.2, 4.1
 */

import { useAuthStore } from '../store/useAuthStore';
import type { AnswerRecord, SessionSnapshot, InProgressSessionSummary, DifficultyLevel, SuperJson } from '../types';
import {
  updateGuestProgress,
  getGuestInProgressSessions,
  loadGuestHistory,
  deleteGuestSession,
  updateGuestSessionSuperJson,
  createGuestInProgressSession,
} from './storage';
import {
  saveProgressToServer,
  fetchInProgressSessions,
  fetchAuthenticatedSessionDetail,
  deleteServerSession,
  updateServerSessionSuperJson,
  createInProgressSessionOnServer,
} from './api';

/**
 * Save progress for a single answer
 * - Routes to API for authenticated users
 * - Routes to LocalStorage for guests
 * 
 * @param sessionId - The session ID to update
 * @param answer - The answer record to append
 * @param newIndex - The new question index after this answer
 * 
 * Requirements: 2.1, 2.2
 */
export const saveProgress = async (
  sessionId: string,
  answer: AnswerRecord,
  newIndex: number
): Promise<void> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: save to server via API
    await saveProgressToServer(sessionId, answer, newIndex);
  } else {
    // Guest user: save to LocalStorage
    const updated = updateGuestProgress(sessionId, answer, newIndex);
    if (!updated) {
      throw new Error('Session not found in LocalStorage');
    }
  }
};

/**
 * Get all in-progress sessions for the current user
 * - Returns server sessions for authenticated users
 * - Returns LocalStorage sessions for guests
 * 
 * @returns Array of in-progress session summaries
 * 
 * Requirements: 4.1
 */
export const getInProgressSessions = async (): Promise<InProgressSessionSummary[]> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: fetch from server with status filter
    const sessions = await fetchInProgressSessions();
    
    // Map full sessions to summary format
    return sessions.map((s) => ({
      id: s.id,
      difficulty: s.difficulty,
      wordCount: s.words.length,
      answeredCount: s.answers.length,
      totalQuestions: s.superJson.metadata.totalQuestions,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  } else {
    // Guest user: get from LocalStorage
    return getGuestInProgressSessions();
  }
};

/**
 * Get full session data for resuming
 * - Fetches from server for authenticated users
 * - Loads from LocalStorage for guests
 * 
 * @param sessionId - The session ID to retrieve
 * @returns Full session snapshot for resumption
 * 
 * Requirements: 2.1, 2.2
 */
export const getSessionForResume = async (sessionId: string): Promise<SessionSnapshot> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: fetch from server
    return fetchAuthenticatedSessionDetail(sessionId);
  } else {
    // Guest user: find in LocalStorage
    const history = loadGuestHistory();
    const session = history.find((s) => s.id === sessionId);
    
    if (!session) {
      throw new Error('Session not found in LocalStorage');
    }
    
    return session;
  }
};

/**
 * Delete a session
 * - Deletes from server for authenticated users
 * - Removes from LocalStorage for guests
 * 
 * @param sessionId - The session ID to delete
 * 
 * Requirements: 4.4
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: delete via API
    await deleteServerSession(sessionId);
  } else {
    // Guest user: delete from LocalStorage
    const deleted = deleteGuestSession(sessionId);
    if (!deleted) {
      throw new Error('Session not found in LocalStorage');
    }
  }
};

/**
 * Update superJson for an in-progress session (when retry succeeds)
 * - Updates on server for authenticated users
 * - Updates in LocalStorage for guests
 * 
 * @param sessionId - The session ID to update
 * @param superJson - The updated superJson with new questions
 * 
 * Requirements: 7.3
 */
export const updateSessionSuperJson = async (
  sessionId: string,
  superJson: SuperJson
): Promise<void> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: update via API
    await updateServerSessionSuperJson(sessionId, superJson);
  } else {
    // Guest user: update in LocalStorage
    const updated = updateGuestSessionSuperJson(sessionId, superJson);
    if (!updated) {
      throw new Error('Session not found in LocalStorage');
    }
  }
};

/**
 * Create a new in-progress session
 * - Routes to API for authenticated users
 * - Routes to LocalStorage for guests
 * 
 * @param params - Session creation parameters
 * @param params.difficulty - The difficulty level of the session
 * @param params.words - Array of words for the session
 * @param params.superJson - The generated quiz data
 * @param params.hasVocabDetails - Whether vocabulary details were generated
 * @param params.vocabDetails - Optional vocabulary details data
 * @returns Created session ID and timestamp
 * 
 * Requirements: 1.1, 1.2, 4.1, 4.2
 */
export const createInProgressSession = async (params: {
  difficulty: DifficultyLevel;
  words: string[];
  superJson: SuperJson;
  hasVocabDetails?: boolean;
  vocabDetails?: import('../types').VocabularyDetail[];
}): Promise<{ id: string; createdAt: string }> => {
  const mode = useAuthStore.getState().mode;

  if (mode === 'authenticated') {
    // Authenticated user: create via API
    return createInProgressSessionOnServer(params);
  } else {
    // Guest user: create in LocalStorage
    const result = createGuestInProgressSession(params);
    if (!result) {
      throw new Error('Failed to create guest session in LocalStorage');
    }
    return result;
  }
};
