import axios, { type AxiosRequestHeaders } from 'axios';
import type {
  DifficultyLevel,
  SuperJson,
  AnswerRecord,
  AnalysisSummary,
  SessionSnapshot,
  GenerationSessionSnapshot,
  QuestionType,
  VocabularyDetail,
  StatsResponse,
} from '../types';
import { STORAGE_KEYS } from '../constants/storage';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(STORAGE_KEYS.authToken);
    if (token) {
      const headers = (config.headers ?? {}) as AxiosRequestHeaders;
      headers.Authorization = `Bearer ${token}`;
      config.headers = headers;
    }
  }
  return config;
});

export const register = (email: string, password: string) =>
  api.post<{ user: { id: string; email: string }; token: string }>('/auth/register', { email, password });

export const login = (email: string, password: string) =>
  api.post<{ user: { id: string; email: string }; token: string }>('/auth/login', { email, password });

export const fetchProfile = () => api.get<{ user: { id: string; email: string } }>('/auth/me');

export const extractWords = (imageBase64List: string[]) =>
  api.post<{ words: string[] }>('/vlm/extract', { images: imageBase64List }).then((res) => res.data.words);

export const startGenerationSession = (params: {
  words: string[];
  difficulty: DifficultyLevel;
  questionCountPerType?: number;
}) => api.post<GenerationSessionSnapshot>('/generation/session', params).then((res) => res.data);

export const fetchGenerationSession = (sessionId: string) =>
  api.get<GenerationSessionSnapshot>(`/generation/session/${sessionId}`).then((res) => res.data);

export const retryGenerationSection = (sessionId: string, type: QuestionType) =>
  api
    .post<GenerationSessionSnapshot>(`/generation/session/${sessionId}/retry`, { type })
    .then((res) => res.data);

/**
 * Bind a history session ID to a generation session
 * When all sections complete, the superJson will be automatically synced to the history session
 * This allows users to resume with complete questions even if they paused before generation finished
 * 
 * @param sessionId - The generation session ID
 * @param historySessionId - The history session ID to bind
 */
export const bindGenerationSession = (sessionId: string, historySessionId: string) =>
  api
    .post<{ success: boolean }>(`/generation/session/${sessionId}/bind`, { historySessionId })
    .then((res) => res.data);

export const fetchVocabularyDetails = (params: { words: string[]; difficulty: DifficultyLevel }) =>
  api.post<{ details: VocabularyDetail[] }>('/generation/details', params).then((res) => res.data.details);

export const requestAnalysis = (payload: {
  difficulty: DifficultyLevel;
  words: string[];
  answers: AnswerRecord[];
  superJson: SuperJson;
  score: number;
}) => api.post<AnalysisSummary>('/analysis/report', payload).then((res) => res.data);

export const saveAuthenticatedSession = (session: {
  difficulty: DifficultyLevel;
  words: string[];
  superJson: SuperJson;
  answers: AnswerRecord[];
  score: number;
  analysis: AnalysisSummary;
}) =>
  api
    .post<SessionSnapshot>('/history', {
      mode: 'authenticated',
      ...session,
    })
    .then((res) => res.data);

export const fetchAuthenticatedHistory = () =>
  api.get<{ sessions: SessionSnapshot[] }>('/history').then((res) => res.data.sessions);

export const fetchAuthenticatedSessionDetail = (sessionId: string) =>
  api.get<SessionSnapshot>(`/history/${sessionId}`).then((res) => res.data);

// ============================================================================
// Session Progress API (Requirements: 2.1, 4.1, 4.4)
// ============================================================================

/**
 * Response type for progress save endpoint
 */
export interface ProgressUpdateResponse {
  id: string;
  status: 'in_progress' | 'completed';
  currentQuestionIndex: number;
  answeredCount: number;
  score: number;
  updatedAt: string;
}

/**
 * Save answer progress for an in-progress session
 * PATCH /api/history/:sessionId/progress
 * 
 * @param sessionId - The session ID to update
 * @param answer - The answer record to append
 * @param currentQuestionIndex - The new question index after this answer
 * @returns Updated session summary
 * 
 * Requirements: 2.1
 */
export const saveProgressToServer = (
  sessionId: string,
  answer: AnswerRecord,
  currentQuestionIndex: number
) =>
  api
    .patch<ProgressUpdateResponse>(`/history/${sessionId}/progress`, {
      answer,
      currentQuestionIndex,
    })
    .then((res) => res.data);

/**
 * Fetch all in-progress sessions for the authenticated user
 * GET /api/history?status=in_progress
 * 
 * @returns Array of in-progress sessions
 * 
 * Requirements: 4.1
 */
export const fetchInProgressSessions = () =>
  api
    .get<{ sessions: SessionSnapshot[] }>('/history', {
      params: { status: 'in_progress' },
    })
    .then((res) => res.data.sessions);

/**
 * Delete a session from the server
 * DELETE /api/history/:sessionId
 * 
 * @param sessionId - The session ID to delete
 * @returns Success response
 * 
 * Requirements: 4.4
 */
export const deleteServerSession = (sessionId: string) =>
  api
    .delete<{ success: boolean; message: string }>(`/history/${sessionId}`)
    .then((res) => res.data);

/**
 * Response type for superJson update endpoint
 */
export interface SuperJsonUpdateResponse {
  id: string;
  status: 'in_progress' | 'completed';
  totalQuestions: number;
  updatedAt: string;
}

/**
 * Update superJson for an in-progress session (when retry succeeds)
 * PATCH /api/history/:sessionId/super-json
 * 
 * @param sessionId - The session ID to update
 * @param superJson - The updated superJson with new questions
 * @returns Updated session summary
 * 
 * Requirements: 7.3
 */
export const updateServerSessionSuperJson = (
  sessionId: string,
  superJson: SuperJson
) =>
  api
    .patch<SuperJsonUpdateResponse>(`/history/${sessionId}/super-json`, {
      superJson,
    })
    .then((res) => res.data);

/**
 * Fetch learning statistics for the authenticated user
 * GET /api/history/stats
 * 
 * @returns Learning statistics including words learned, sessions completed, and weekly activity
 */
export const fetchLearningStats = () =>
  api
    .get<StatsResponse>('/history/stats')
    .then((res) => res.data);

/**
 * Response type for in-progress session creation endpoint
 */
export interface CreateInProgressSessionResponse {
  id: string;
  createdAt: string;
}

/**
 * Create a new in-progress session on the server
 * POST /api/history/in-progress
 * 
 * @param params - Session creation parameters
 * @param params.difficulty - The difficulty level of the session
 * @param params.words - Array of words for the session
 * @param params.superJson - The generated quiz data
 * @param params.hasVocabDetails - Whether vocabulary details were generated
 * @param params.vocabDetails - Optional vocabulary details data
 * @returns Created session ID and timestamp
 * 
 * Requirements: 2.3, 4.1, 4.2
 */
export const createInProgressSessionOnServer = (params: {
  difficulty: DifficultyLevel;
  words: string[];
  superJson: SuperJson;
  hasVocabDetails?: boolean;
  vocabDetails?: VocabularyDetail[];
}) =>
  api
    .post<CreateInProgressSessionResponse>('/history/in-progress', params)
    .then((res) => res.data);
