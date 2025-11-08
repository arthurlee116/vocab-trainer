import { nanoid } from 'nanoid';
import { MAX_GUEST_HISTORY, STORAGE_KEYS } from '../constants/storage';
import type { SessionSnapshot, AnalysisSummary, AnswerRecord, SuperJson, DifficultyLevel } from '../types';

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
  return (safeWindow.localStorage.getItem(STORAGE_KEYS.mode) as any) ?? 'unauthenticated';
};

export const saveGuestSession = (session: {
  difficulty: DifficultyLevel;
  words: string[];
  score: number;
  analysis: AnalysisSummary;
  superJson: SuperJson;
  answers: AnswerRecord[];
}) => {
  if (!safeWindow) return;
  const snapshot: SessionSnapshot = {
    ...session,
    id: nanoid(),
    mode: 'guest',
    createdAt: new Date().toISOString(),
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
