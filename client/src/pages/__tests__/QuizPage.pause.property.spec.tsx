/**
 * Property-based tests for QuizPage pause button visibility
 * **Feature: session-resume-fix, Property 4: Pause Button Visibility**
 * **Validates: Requirements 3.1**
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePracticeStore } from '../../store/usePracticeStore';
import QuizPage from '../QuizPage';
import type { SuperJson, SuperQuestion, QuestionType, Choice } from '../../types';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API calls
vi.mock('../../lib/api', () => ({
  requestAnalysis: vi.fn(),
  retryGenerationSection: vi.fn(),
  saveAuthenticatedSession: vi.fn(),
}));

vi.mock('../../lib/progressService', () => ({
  updateSessionSuperJson: vi.fn(),
}));

vi.mock('../../lib/storage', () => ({
  saveGuestSession: vi.fn(),
}));

vi.mock('../../lib/tts', () => ({
  tts: {
    canSpeak: () => true,
    speak: vi.fn(),
    cancel: vi.fn(),
    subscribe: () => () => {},
  },
}));

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating a choice
const choiceArb: fc.Arbitrary<Choice> = fc.record({
  id: idArb,
  text: fc.string({ minLength: 1, maxLength: 50 }),
});

// Arbitrary for generating a choice-based question (type 1 or 2)
const choiceQuestionArb = (type: 'questions_type_1' | 'questions_type_2'): fc.Arbitrary<SuperQuestion> =>
  fc.record({
    id: idArb,
    word: fc.string({ minLength: 1, maxLength: 20 }),
    prompt: fc.string({ minLength: 1, maxLength: 100 }),
    choices: fc.array(choiceArb, { minLength: 2, maxLength: 4 }),
    explanation: fc.string({ minLength: 0, maxLength: 200 }),
    type: fc.constant(type),
    hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  }).map((q) => ({
    ...q,
    correctChoiceId: q.choices![0].id,
  }));

// Generate a SuperJson with at least one question
const superJsonArb: fc.Arbitrary<SuperJson> = fc
  .array(choiceQuestionArb('questions_type_1'), { minLength: 1, maxLength: 3 })
  .map((type1) => ({
    metadata: {
      totalQuestions: type1.length,
      words: [...new Set(type1.map((q) => q.word))],
      difficulty: 'intermediate' as const,
      generatedAt: new Date().toISOString(),
    },
    questions_type_1: type1,
    questions_type_2: [],
    questions_type_3: [],
  }));

// Arbitrary for generating a non-empty historySessionId
const historySessionIdArb = fc.string({ minLength: 1, maxLength: 36 });

// Helper to render QuizPage
const renderQuizPage = () => {
  return render(
    <MemoryRouter>
      <QuizPage />
    </MemoryRouter>
  );
};

describe('QuizPage Pause Button - Property Tests', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    usePracticeStore.setState({
      words: [],
      images: [],
      answers: [],
      status: 'inProgress',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'ready',
        questions_type_3: 'ready',
      },
      sectionErrors: {
        questions_type_1: undefined,
        questions_type_2: undefined,
        questions_type_3: undefined,
      },
      detailsStatus: 'idle',
      isRetryMode: false,
      retryQuestions: [],
      retryAnswers: [],
      originalLastResult: undefined,
      superJson: undefined,
      lastResult: undefined,
      historySessionId: undefined,
      currentQuestionIndex: 0,
      isResumedSession: false,
      listeningMode: false,
      audioEnabled: true,
    });
  });

  afterEach(() => {
    usePracticeStore.getState().resetSession();
  });

  /**
   * **Feature: session-resume-fix, Property 4: Pause Button Visibility**
   * **Validates: Requirements 3.1**
   *
   * For any practice store state where historySessionId is defined and non-empty,
   * the QuizPage must render the pause button.
   */
  describe('Property 4: Pause Button Visibility', () => {
    it('should show pause button when historySessionId is defined and non-empty', () => {
      fc.assert(
        fc.property(
          superJsonArb,
          historySessionIdArb,
          (superJson, historySessionId) => {
            // Setup: Set store state with historySessionId
            usePracticeStore.setState({
              superJson,
              historySessionId,
              isRetryMode: false,
              status: 'inProgress',
              sectionStatus: {
                questions_type_1: 'ready',
                questions_type_2: 'ready',
                questions_type_3: 'ready',
              },
            });

            // Render QuizPage
            const { unmount } = renderQuizPage();

            // Property: Pause button should be visible
            const pauseButton = screen.queryByRole('button', { name: '暂停' });
            expect(pauseButton).not.toBeNull();
            expect(pauseButton).toBeInTheDocument();

            // Cleanup
            unmount();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 15000);

    it('should NOT show pause button when historySessionId is undefined', () => {
      fc.assert(
        fc.property(
          superJsonArb,
          (superJson) => {
            // Setup: Set store state WITHOUT historySessionId
            usePracticeStore.setState({
              superJson,
              historySessionId: undefined,
              isRetryMode: false,
              status: 'inProgress',
              sectionStatus: {
                questions_type_1: 'ready',
                questions_type_2: 'ready',
                questions_type_3: 'ready',
              },
            });

            // Render QuizPage
            const { unmount } = renderQuizPage();

            // Property: Pause button should NOT be visible
            const pauseButton = screen.queryByRole('button', { name: '暂停' });
            expect(pauseButton).toBeNull();

            // Cleanup
            unmount();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 15000);

    it('should NOT show pause button in retry mode even with historySessionId', () => {
      fc.assert(
        fc.property(
          superJsonArb,
          historySessionIdArb,
          (superJson, historySessionId) => {
            // Get retry questions from superJson
            const retryQuestions = superJson.questions_type_1.slice(0, 1);
            if (retryQuestions.length === 0) return true; // Skip if no questions

            // Setup: Set store state with historySessionId BUT in retry mode
            usePracticeStore.setState({
              superJson: undefined, // Retry mode doesn't use superJson
              historySessionId,
              isRetryMode: true,
              retryQuestions,
              retryAnswers: [],
              status: 'inProgress',
              sectionStatus: {
                questions_type_1: 'ready',
                questions_type_2: 'ready',
                questions_type_3: 'ready',
              },
            });

            // Render QuizPage
            const { unmount } = renderQuizPage();

            // Property: Pause button should NOT be visible in retry mode
            const pauseButton = screen.queryByRole('button', { name: '暂停' });
            expect(pauseButton).toBeNull();

            // Cleanup
            unmount();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 15000);
  });
});
