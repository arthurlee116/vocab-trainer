/**
 * Unit tests for ConfirmWordsPage vocabulary details toggle functionality
 * **Feature: optional-vocab-details**
 * **Validates: Requirements 1.2, 2.1, 3.1, 3.4**
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConfirmWordsPage from '../ConfirmWordsPage';
import { usePracticeStore } from '../../store/usePracticeStore';
import * as api from '../../lib/api';

// Mock the API module
vi.mock('../../lib/api', () => ({
  fetchVocabularyDetails: vi.fn(),
  startGenerationSession: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSessionSnapshot = {
  sessionId: 'test-session-123',
  metadata: {
    totalQuestions: 9,
    words: ['apple', 'banana', 'cherry'],
    difficulty: 'beginner' as const,
    generatedAt: new Date().toISOString(),
    estimatedTotalQuestions: 9,
  },
  perType: 3,
  sections: {
    questions_type_1: { status: 'ready' as const, questions: [] },
    questions_type_2: { status: 'pending' as const, questions: [] },
    questions_type_3: { status: 'pending' as const, questions: [] },
  },
};

const mockVocabDetails = [
  {
    word: 'apple',
    partsOfSpeech: ['noun'],
    definitions: ['a round fruit'],
    examples: [{ en: 'I ate an apple.', zh: '我吃了一个苹果。' }],
  },
];

const renderConfirmWordsPage = () => {
  cleanup();
  return render(
    <MemoryRouter>
      <ConfirmWordsPage />
    </MemoryRouter>
  );
};

describe('ConfirmWordsPage - Vocabulary Details Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    // Reset store with some words
    usePracticeStore.setState({
      words: ['apple', 'banana', 'cherry'],
      vocabDetails: null,
      detailsError: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Toggle default state (Requirements 1.2)', () => {
    it('should render toggle in off state by default', () => {
      renderConfirmWordsPage();

      // Click confirm to show difficulty panel
      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      // Find the toggle switch
      const toggleSwitch = screen.getByRole('switch');
      expect(toggleSwitch.getAttribute('aria-checked')).toBe('false');
      expect(toggleSwitch.classList.contains('active')).toBe(false);
    });

    it('should show toggle label "生成词汇详情"', () => {
      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      expect(screen.getByText('生成词汇详情')).toBeInTheDocument();
    });
  });

  describe('Toggle off - Quiz only generation (Requirements 2.1)', () => {
    it('should only call startGenerationSession when toggle is off', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);

      renderConfirmWordsPage();

      // Show difficulty panel
      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      // Toggle should be off by default, click difficulty button
      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(api.startGenerationSession).toHaveBeenCalledTimes(1);
        expect(api.fetchVocabularyDetails).not.toHaveBeenCalled();
      });
    });

    it('should navigate to /practice/quiz when toggle is off and generation succeeds', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/quiz');
      });
    });
  });

  describe('Toggle on - Both APIs called (Requirements 3.1)', () => {
    it('should call both APIs when toggle is on', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);
      vi.mocked(api.fetchVocabularyDetails).mockResolvedValue(mockVocabDetails);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      // Turn on the toggle
      const toggleSwitch = screen.getByRole('switch');
      fireEvent.click(toggleSwitch);
      expect(toggleSwitch.getAttribute('aria-checked')).toBe('true');

      // Click difficulty button
      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(api.startGenerationSession).toHaveBeenCalledTimes(1);
        expect(api.fetchVocabularyDetails).toHaveBeenCalledTimes(1);
      });
    });

    it('should navigate to /practice/details when toggle is on and both succeed', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);
      vi.mocked(api.fetchVocabularyDetails).mockResolvedValue(mockVocabDetails);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      // Turn on the toggle
      const toggleSwitch = screen.getByRole('switch');
      fireEvent.click(toggleSwitch);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/details');
      });
    });
  });

  describe('Error handling (Requirements 3.4)', () => {
    it('should show error with retry/skip options when vocab details fails but quiz succeeds', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);
      vi.mocked(api.fetchVocabularyDetails).mockRejectedValue(new Error('Vocab details failed'));

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      // Turn on the toggle
      const toggleSwitch = screen.getByRole('switch');
      fireEvent.click(toggleSwitch);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(screen.getByTestId('vocab-details-error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /重试词汇详情/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /跳过，直接开始/i })).toBeInTheDocument();
      });
    });

    it('should navigate to /practice/quiz when clicking skip button', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);
      vi.mocked(api.fetchVocabularyDetails).mockRejectedValue(new Error('Vocab details failed'));

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const toggleSwitch = screen.getByRole('switch');
      fireEvent.click(toggleSwitch);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(screen.getByTestId('vocab-details-error')).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /跳过，直接开始/i });
      fireEvent.click(skipButton);

      expect(mockNavigate).toHaveBeenCalledWith('/practice/quiz');
    });

    it('should retry vocab details when clicking retry button', async () => {
      vi.mocked(api.startGenerationSession).mockResolvedValue(mockSessionSnapshot);
      vi.mocked(api.fetchVocabularyDetails)
        .mockRejectedValueOnce(new Error('Vocab details failed'))
        .mockResolvedValueOnce(mockVocabDetails);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const toggleSwitch = screen.getByRole('switch');
      fireEvent.click(toggleSwitch);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        expect(screen.getByTestId('vocab-details-error')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /重试词汇详情/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(api.fetchVocabularyDetails).toHaveBeenCalledTimes(2);
        expect(mockNavigate).toHaveBeenCalledWith('/practice/details');
      });
    });

    it('should show general error when quiz generation fails', async () => {
      vi.mocked(api.startGenerationSession).mockRejectedValue(new Error('Quiz generation failed'));

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      await waitFor(() => {
        // Error message is displayed in form-error class
        expect(screen.getByText(/Quiz generation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading text on difficulty buttons while generating', async () => {
      // Create a promise that we can control
      let resolveSession: (value: typeof mockSessionSnapshot) => void;
      const sessionPromise = new Promise<typeof mockSessionSnapshot>((resolve) => {
        resolveSession = resolve;
      });
      vi.mocked(api.startGenerationSession).mockReturnValue(sessionPromise);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      // Should show loading state on all difficulty buttons
      await waitFor(() => {
        const loadingButtons = screen.getAllByRole('button', { name: /正在生成.../i });
        expect(loadingButtons.length).toBe(3);
      });

      // Resolve the promise
      resolveSession!(mockSessionSnapshot);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });

    it('should disable toggle while loading', async () => {
      let resolveSession: (value: typeof mockSessionSnapshot) => void;
      const sessionPromise = new Promise<typeof mockSessionSnapshot>((resolve) => {
        resolveSession = resolve;
      });
      vi.mocked(api.startGenerationSession).mockReturnValue(sessionPromise);

      renderConfirmWordsPage();

      const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
      fireEvent.click(confirmButton);

      const toggleSwitch = screen.getByRole('switch');
      const initialState = toggleSwitch.getAttribute('aria-checked');

      const beginnerButton = screen.getByRole('button', { name: /初级/i });
      fireEvent.click(beginnerButton);

      // Try to click toggle while loading - state should not change
      fireEvent.click(toggleSwitch);
      expect(toggleSwitch.getAttribute('aria-checked')).toBe(initialState);

      // Cleanup
      resolveSession!(mockSessionSnapshot);
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });
});
