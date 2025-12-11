import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { usePracticeStore } from '../../store/usePracticeStore';
import QuizPage from '../QuizPage';
import { createMockQuestion } from '../../test-utils/quizFixtures';

// Mock API calls
vi.mock('../../lib/api', () => ({
  requestAnalysis: vi.fn(),
  retryGenerationSection: vi.fn(),
  saveAuthenticatedSession: vi.fn(),
}));

// Mock progressService to avoid dynamic import issues
vi.mock('../../lib/progressService', () => ({
  saveProgress: vi.fn(),
}));

describe('QuizPage Skip Bug', () => {
  beforeEach(() => {
    usePracticeStore.getState().resetSession();
    vi.clearAllMocks();
  });

  it('should not skip a question when answering (double increment check)', async () => {
    const q1 = createMockQuestion({
      id: 'q1',
      type: 'questions_type_1',
      prompt: 'Question 1',
      choices: [{ id: 'c1', text: 'UniqueChoiceA' }],
      correctChoiceId: 'c1',
      sentence: undefined,
    });
    const q2 = createMockQuestion({
      id: 'q2',
      type: 'questions_type_1',
      prompt: 'Question 2',
      choices: [{ id: 'c2', text: 'UniqueChoiceB' }],
      correctChoiceId: 'c2',
      sentence: undefined,
    });
    const q3 = createMockQuestion({
      id: 'q3',
      type: 'questions_type_1',
      prompt: 'Question 3',
      choices: [{ id: 'c3', text: 'UniqueChoiceC' }],
      correctChoiceId: 'c3',
      sentence: undefined,
    });

    // Setup resumed session state
    usePracticeStore.setState({
      superJson: {
        metadata: { totalQuestions: 3, words: [], difficulty: 'beginner', generatedAt: '' },
        questions_type_1: [q1, q2, q3],
        questions_type_2: [],
        questions_type_3: [],
      },
      status: 'inProgress',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'ready',
        questions_type_3: 'ready',
      },
      // Simulate a resumed session
      isResumedSession: true,
      historySessionId: 'session-123',
      currentQuestionIndex: 0,
    });

    render(
      <MemoryRouter>
        <QuizPage />
      </MemoryRouter>
    );

    // Should show Q1
    expect(screen.getByText('Question 1')).toBeInTheDocument();

    // Answer Q1
    await userEvent.click(screen.getByText('UniqueChoiceA'));
    await userEvent.click(screen.getByRole('button', { name: '下一题' }));

    // Should show Q2
    // If double increment happens, it will show Q3
    await waitFor(() => {
      expect(screen.queryByText('Question 1')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Question 2')).toBeInTheDocument();
    expect(screen.queryByText('Question 3')).not.toBeInTheDocument();
  });
});
