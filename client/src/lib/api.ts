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
