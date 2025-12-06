/**
 * VocabularyDetailsPage Session Creation Tests
 * 
 * Tests for the in-progress session creation when starting practice.
 * Requirements: 1.1, 1.2, 1.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import VocabularyDetailsPage from '../VocabularyDetailsPage';
import { usePracticeStore } from '../../store/usePracticeStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { SuperJson, VocabularyDetail } from '../../types';

// Mock progressService
const mockCreateInProgressSession = vi.fn();

vi.mock('../../lib/progressService', () => ({
  createInProgressSession: (params: unknown) => mockCreateInProgressSession(params),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useGenerationPolling
vi.mock('../../hooks/useGenerationPolling', () => ({
  useGenerationPolling: () => ({ pollError: '' }),
}));

// Mock api
vi.mock('../../lib/api', () => ({
  fetchVocabularyDetails: vi.fn(),
  retryGenerationSection: vi.fn(),
}));

// Mock tts
vi.mock('../../lib/tts', () => ({
  tts: {
    speak: vi.fn(),
    canSpeak: vi.fn().mockReturnValue(true),
  },
}));

const mockSuperJson: SuperJson = {
  metadata: {
    totalQuestions: 6,
    words: ['apple', 'banana'],
    difficulty: 'beginner',
    generatedAt: '2025-12-01T10:00:00Z',
  },
  questions_type_1: [
    {
      id: 'q1',
      word: 'apple',
      prompt: 'apple',
      choices: [{ id: 'c1', text: '苹果' }],
      correctChoiceId: 'c1',
      explanation: 'test',
      type: 'questions_type_1',
    },
  ],
  questions_type_2: [],
  questions_type_3: [],
};

const mockVocabDetails: VocabularyDetail[] = [
  {
    word: 'apple',
    partsOfSpeech: ['noun'],
    definitions: ['苹果'],
    examples: [{ en: 'I eat an apple.', zh: '我吃一个苹果。' }],
  },
];

const setupReadyState = () => {
  usePracticeStore.setState({
    superJson: mockSuperJson,
    words: ['apple', 'banana'],
    difficulty: 'beginner',
    vocabDetails: mockVocabDetails,
    detailsStatus: 'ready',
    sessionId: 'gen-session-1',
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
    estimatedTotalQuestions: 6,
    status: 'inProgress',
    historySessionId: undefined,
  });
};

describe('VocabularyDetailsPage Session Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ mode: 'guest', initializing: false });
    usePracticeStore.getState().resetSession();
  });

  it('authenticated user: creates session via API before navigation (Requirements 1.1, 1.3)', async () => {
    useAuthStore.setState({ mode: 'authenticated', initializing: false });
    setupReadyState();
    
    mockCreateInProgressSession.mockResolvedValue({
      id: 'history-session-123',
      createdAt: '2025-12-06T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <VocabularyDetailsPage />
      </MemoryRouter>
    );

    // Click start practice button
    const startButton = screen.getByRole('button', { name: '开始练习' });
    await userEvent.click(startButton);

    // Verify createInProgressSession was called with correct params
    await waitFor(() => {
      expect(mockCreateInProgressSession).toHaveBeenCalledWith({
        difficulty: 'beginner',
        words: ['apple', 'banana'],
        superJson: mockSuperJson,
      });
    });

    // Verify historySessionId was set in store
    await waitFor(() => {
      const { historySessionId } = usePracticeStore.getState();
      expect(historySessionId).toBe('history-session-123');
    });

    // Verify navigation occurred
    expect(mockNavigate).toHaveBeenCalledWith('/practice/run');
  });

  it('guest user: creates session in LocalStorage before navigation (Requirements 1.2, 1.3)', async () => {
    useAuthStore.setState({ mode: 'guest', initializing: false });
    setupReadyState();
    
    mockCreateInProgressSession.mockResolvedValue({
      id: 'guest-session-456',
      createdAt: '2025-12-06T10:00:00Z',
    });

    render(
      <MemoryRouter>
        <VocabularyDetailsPage />
      </MemoryRouter>
    );

    const startButton = screen.getByRole('button', { name: '开始练习' });
    await userEvent.click(startButton);

    // Verify createInProgressSession was called
    await waitFor(() => {
      expect(mockCreateInProgressSession).toHaveBeenCalledWith({
        difficulty: 'beginner',
        words: ['apple', 'banana'],
        superJson: mockSuperJson,
      });
    });

    // Verify historySessionId was set
    await waitFor(() => {
      const { historySessionId } = usePracticeStore.getState();
      expect(historySessionId).toBe('guest-session-456');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/practice/run');
  });

  it('error handling: shows error but still navigates (Requirement 1.4)', async () => {
    setupReadyState();
    
    // Simulate API failure
    mockCreateInProgressSession.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <VocabularyDetailsPage />
      </MemoryRouter>
    );

    const startButton = screen.getByRole('button', { name: '开始练习' });
    await userEvent.click(startButton);

    // Verify error message is shown
    await waitFor(() => {
      expect(screen.getByText('进度保存功能暂时不可用，但您可以继续练习')).toBeInTheDocument();
    });

    // Verify navigation still occurred (graceful degradation)
    expect(mockNavigate).toHaveBeenCalledWith('/practice/run');

    // Verify historySessionId was NOT set (since creation failed)
    const { historySessionId } = usePracticeStore.getState();
    expect(historySessionId).toBeUndefined();
  });

  it('button shows loading state during session creation', async () => {
    setupReadyState();
    
    // Create a promise that doesn't resolve immediately
    let resolvePromise: (value: { id: string; createdAt: string }) => void;
    const pendingPromise = new Promise<{ id: string; createdAt: string }>((resolve) => {
      resolvePromise = resolve;
    });
    mockCreateInProgressSession.mockReturnValue(pendingPromise);

    render(
      <MemoryRouter>
        <VocabularyDetailsPage />
      </MemoryRouter>
    );

    const startButton = screen.getByRole('button', { name: '开始练习' });
    await userEvent.click(startButton);

    // Button should show loading state
    expect(screen.getByRole('button', { name: '正在准备...' })).toBeDisabled();

    // Resolve the promise
    resolvePromise!({ id: 'session-id', createdAt: '2025-12-06T10:00:00Z' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/practice/run');
    });
  });

  it('button is disabled when details are not ready', () => {
    usePracticeStore.setState({
      superJson: mockSuperJson,
      words: ['apple'],
      difficulty: 'beginner',
      vocabDetails: undefined,
      detailsStatus: 'loading',
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
    });

    render(
      <MemoryRouter>
        <VocabularyDetailsPage />
      </MemoryRouter>
    );

    const startButton = screen.getByRole('button', { name: 'AI 正在整理词条...' });
    expect(startButton).toBeDisabled();
  });
});
