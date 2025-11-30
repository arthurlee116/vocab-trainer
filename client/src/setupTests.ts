import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { usePracticeStore } from './store/usePracticeStore';
import { useAuthStore } from './store/useAuthStore';

const defaultSectionState = {
  questions_type_1: 'pending' as const,
  questions_type_2: 'pending' as const,
  questions_type_3: 'pending' as const,
};

const resetPracticeStore = () => {
  usePracticeStore.setState({
    words: [],
    images: [],
    vocabDetails: undefined,
    difficulty: undefined,
    sessionId: undefined,
    perType: undefined,
    estimatedTotalQuestions: undefined,
    superJson: undefined,
    answers: [],
    status: 'idle',
    sectionStatus: { ...defaultSectionState },
    sectionErrors: {
      questions_type_1: undefined,
      questions_type_2: undefined,
      questions_type_3: undefined,
    },
    detailsStatus: 'idle',
    detailsError: undefined,
    lastResult: undefined,
  });
};

const resetAuthStore = () => {
  useAuthStore.setState({
    mode: 'unauthenticated',
    user: null,
    token: null,
    initializing: false,
  });
};

beforeEach(() => {
  resetPracticeStore();
  resetAuthStore();
});

afterEach(() => {
  usePracticeStore.setState({ answers: [] });
});
