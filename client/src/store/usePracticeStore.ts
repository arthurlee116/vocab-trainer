import { create } from 'zustand';
import type {
  AnswerRecord,
  AnalysisSummary,
  DifficultyLevel,
  SessionSnapshot,
  SuperJson,
  SuperQuestion,
  ImageFile,
  GenerationSessionSnapshot,
  QuestionType,
  SectionStatus,
  VocabularyDetail,
} from '../types';
import { revokeObjectUrls } from '../lib/file';

interface PracticeState {
  words: string[];
  images: ImageFile[];
  vocabDetails?: VocabularyDetail[];
  difficulty?: DifficultyLevel;
  sessionId?: string;
  perType?: number;
  estimatedTotalQuestions?: number;
  superJson?: SuperJson;
  answers: AnswerRecord[];
  status: 'idle' | 'uploading' | 'confirm' | 'generating' | 'inProgress' | 'report';
  sectionStatus: Record<QuestionType, SectionStatus>;
  sectionErrors: Record<QuestionType, string | undefined>;
  detailsStatus: 'idle' | 'loading' | 'ready' | 'error';
  detailsError?: string;
  lastResult?: {
    score: number;
    analysis: AnalysisSummary;
    incorrectWords: string[];
    snapshot?: SessionSnapshot;
  };
  // Retry mode fields
  isRetryMode: boolean;
  retryQuestions: SuperQuestion[];
  retryAnswers: AnswerRecord[];
  originalLastResult?: PracticeState['lastResult'];
  setWords: (words: string[]) => void;
  addWord: (word: string) => void;
  removeWord: (word: string) => void;
  resetWords: () => void;
  startGenerating: () => void;
  applySessionSnapshot: (snapshot: GenerationSessionSnapshot) => void;
  resetSession: () => void;
  recordAnswer: (answer: AnswerRecord) => void;
  setLastResult: (result: PracticeState['lastResult']) => void;
  addImages: (newImages: ImageFile[]) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  beginDetailsFetch: () => void;
  setVocabDetails: (details: VocabularyDetail[]) => void;
  setDetailsError: (message: string) => void;
  // Retry mode actions
  startRetryPractice: (wrongQuestions: SuperQuestion[]) => void;
  recordRetryAnswer: (answer: AnswerRecord) => void;
  setRetryResult: (result: PracticeState['lastResult']) => void;
  exitRetryMode: () => void;
}

const createInitialSectionStatus = (): Record<QuestionType, SectionStatus> => ({
  questions_type_1: 'pending',
  questions_type_2: 'pending',
  questions_type_3: 'pending',
});

const createInitialSectionErrors = (): Record<QuestionType, string | undefined> => ({
  questions_type_1: undefined,
  questions_type_2: undefined,
  questions_type_3: undefined,
});

export const usePracticeStore = create<PracticeState>((set, get) => ({
  words: [],
  images: [],
  answers: [],
  status: 'idle',
  sectionStatus: createInitialSectionStatus(),
  sectionErrors: createInitialSectionErrors(),
  detailsStatus: 'idle',
  // Retry mode initial values
  isRetryMode: false,
  retryQuestions: [],
  retryAnswers: [],
  originalLastResult: undefined,
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
  startGenerating: () =>
    set({
      status: 'generating',
      sectionStatus: createInitialSectionStatus(),
      sectionErrors: createInitialSectionErrors(),
      sessionId: undefined,
      perType: undefined,
      estimatedTotalQuestions: undefined,
      vocabDetails: undefined,
      detailsStatus: 'loading',
      detailsError: undefined,
    }),
  applySessionSnapshot: (snapshot) =>
    set((state) => {
      const shouldResetAnswers = state.sessionId !== snapshot.sessionId;
      const statusAfterSnapshot = state.status === 'generating' ? 'inProgress' : state.status;
      const nextSectionStatus: Record<QuestionType, SectionStatus> = {
        questions_type_1: snapshot.sections.questions_type_1.status,
        questions_type_2: snapshot.sections.questions_type_2.status,
        questions_type_3: snapshot.sections.questions_type_3.status,
      };
      const nextSectionErrors: Record<QuestionType, string | undefined> = {
        questions_type_1: snapshot.sections.questions_type_1.error,
        questions_type_2: snapshot.sections.questions_type_2.error,
        questions_type_3: snapshot.sections.questions_type_3.error,
      };

      const nextSuperJson: SuperJson = {
        metadata: {
          totalQuestions: snapshot.metadata.totalQuestions,
          words: snapshot.metadata.words,
          difficulty: snapshot.metadata.difficulty,
          generatedAt: snapshot.metadata.generatedAt,
        },
        questions_type_1: snapshot.sections.questions_type_1.questions,
        questions_type_2: snapshot.sections.questions_type_2.questions,
        questions_type_3: snapshot.sections.questions_type_3.questions,
      };

      return {
        superJson: nextSuperJson,
        difficulty: snapshot.metadata.difficulty,
        sessionId: snapshot.sessionId,
        perType: snapshot.perType,
        estimatedTotalQuestions: snapshot.metadata.estimatedTotalQuestions,
        sectionStatus: nextSectionStatus,
        sectionErrors: nextSectionErrors,
        status: statusAfterSnapshot,
        answers: shouldResetAnswers ? [] : state.answers,
      };
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
      sessionId: undefined,
      perType: undefined,
      estimatedTotalQuestions: undefined,
      sectionStatus: createInitialSectionStatus(),
      sectionErrors: createInitialSectionErrors(),
      vocabDetails: undefined,
      detailsStatus: 'idle',
      detailsError: undefined,
      // Reset retry state
      isRetryMode: false,
      retryQuestions: [],
      retryAnswers: [],
      originalLastResult: undefined,
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
  beginDetailsFetch: () =>
    set({
      detailsStatus: 'loading',
      detailsError: undefined,
    }),
  setVocabDetails: (details) =>
    set({
      vocabDetails: details,
      detailsStatus: 'ready',
      detailsError: undefined,
    }),
  setDetailsError: (message) =>
    set({
      detailsStatus: 'error',
      detailsError: message,
    }),
  // Retry mode actions
  startRetryPractice: (wrongQuestions) =>
    set((state) => ({
      isRetryMode: true,
      retryQuestions: wrongQuestions,
      retryAnswers: [],
      originalLastResult: state.originalLastResult ?? state.lastResult,
      status: 'inProgress',
    })),
  recordRetryAnswer: (answer) =>
    set((state) => ({
      retryAnswers: [...state.retryAnswers, answer],
    })),
  setRetryResult: (result) =>
    set({
      lastResult: result,
      status: 'report',
    }),
  exitRetryMode: () =>
    set((state) => ({
      isRetryMode: false,
      retryQuestions: [],
      retryAnswers: [],
      lastResult: state.originalLastResult,
      originalLastResult: undefined,
      status: 'report',
    })),
}));
