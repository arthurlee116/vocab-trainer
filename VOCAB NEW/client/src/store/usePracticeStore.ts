import { create } from 'zustand';
import type { AnswerRecord, AnalysisSummary, DifficultyLevel, SessionSnapshot, SuperJson, ImageFile } from '../types';
import { revokeObjectUrls } from '../lib/file';

interface PracticeState {
  words: string[];
  images: ImageFile[];
  difficulty?: DifficultyLevel;
  superJson?: SuperJson;
  answers: AnswerRecord[];
  status: 'idle' | 'uploading' | 'confirm' | 'generating' | 'inProgress' | 'report';
  lastResult?: {
    score: number;
    analysis: AnalysisSummary;
    incorrectWords: string[];
    snapshot?: SessionSnapshot;
  };
  setWords: (words: string[]) => void;
  addWord: (word: string) => void;
  removeWord: (word: string) => void;
  resetWords: () => void;
  startGenerating: () => void;
  setSuperJson: (payload: { superJson: SuperJson; difficulty: DifficultyLevel }) => void;
  resetSession: () => void;
  recordAnswer: (answer: AnswerRecord) => void;
  setLastResult: (result: PracticeState['lastResult']) => void;
  addImages: (newImages: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  words: [],
  images: [],
  answers: [],
  status: 'idle',
  setWords: (words) =>
    set({
      words: Array.from(new Set(words.map((w) => w.trim().toLowerCase()))).filter(Boolean),
      status: 'confirm',
    }),
  addWord: (word) =>
    set((state) => {
      const trimmed = word.trim().toLowerCase();
      if (!trimmed || state.words.includes(trimmed)) {
        return state;
      }
      return { words: [...state.words, trimmed] };
    }),
  removeWord: (word) =>
    set((state) => ({
      words: state.words.filter((w) => w !== word),
    })),
  resetWords: () =>
    set({
      words: [],
      status: 'idle',
    }),
  startGenerating: () => set({ status: 'generating' }),
  setSuperJson: ({ superJson, difficulty }) =>
    set({
      superJson,
      difficulty,
      status: 'inProgress',
      answers: [],
    }),
  resetSession: () => {
    const { images } = get();
    if (images.length > 0) {
      revokeObjectUrls(images);
    }
    set({
      words: [],
      images: [],
      difficulty: undefined,
      superJson: undefined,
      answers: [],
      status: 'idle',
      lastResult: undefined,
    });
  },
  recordAnswer: (answer) =>
    set((state) => ({
      answers: [...state.answers, answer],
    })),
  setLastResult: (result) =>
    set({
      lastResult: result,
      status: 'report',
    }),
  addImages: (newImages) =>
    set((state) => ({
      images: [...state.images, ...newImages],
    })),
  removeImage: (id) =>
    set((state) => {
      const imageToRemove = state.images.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return {
        images: state.images.filter((img) => img.id !== id),
      };
    }),
  clearImages: () => {
    const { images } = get();
    if (images.length > 0) {
      revokeObjectUrls(images);
    }
    set({ images: [] });
  },
}));
