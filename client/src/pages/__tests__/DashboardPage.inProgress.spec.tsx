/**
 * DashboardPage In-Progress Sessions Tests
 * 
 * Tests for the in-progress sessions section on the dashboard.
 * Requirements: 4.1, 4.3, 4.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { useAuthStore } from '../../store/useAuthStore';
import type { InProgressSessionSummary, SessionSnapshot } from '../../types';

// Mock progressService
const mockGetInProgressSessions = vi.fn();
const mockGetSessionForResume = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../lib/progressService', () => ({
  getInProgressSessions: () => mockGetInProgressSessions(),
  getSessionForResume: (id: string) => mockGetSessionForResume(id),
  deleteSession: (id: string) => mockDeleteSession(id),
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

// Mock usePracticeStore
const mockResetSession = vi.fn();
const mockResumeSession = vi.fn();

vi.mock('../../store/usePracticeStore', () => ({
  usePracticeStore: (selector: (state: unknown) => unknown) => {
    const state = {
      resetSession: mockResetSession,
      resumeSession: mockResumeSession,
      lastResult: null,
    };
    return selector(state);
  },
}));

const mockInProgressSessions: InProgressSessionSummary[] = [
  {
    id: 'session-1',
    difficulty: 'beginner',
    wordCount: 20,
    answeredCount: 10,
    totalQuestions: 40,
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2025-12-04T08:00:00Z',
  },
  {
    id: 'session-2',
    difficulty: 'intermediate',
    wordCount: 30,
    answeredCount: 25,
    totalQuestions: 60,
    createdAt: '2025-12-02T10:00:00Z',
    updatedAt: '2025-12-04T09:00:00Z',
  },
];

const mockSessionSnapshot: SessionSnapshot = {
  id: 'session-1',
  mode: 'guest',
  difficulty: 'beginner',
  words: ['apple', 'banana'],
  score: 0,
  analysis: { report: '', recommendations: [] },
  superJson: {
    metadata: {
      totalQuestions: 40,
      words: ['apple', 'banana'],
      difficulty: 'beginner',
      generatedAt: '2025-12-01T10:00:00Z',
    },
    questions_type_1: [],
    questions_type_2: [],
    questions_type_3: [],
  },
  answers: [],
  createdAt: '2025-12-01T10:00:00Z',
  status: 'in_progress',
  currentQuestionIndex: 10,
  updatedAt: '2025-12-04T08:00:00Z',
};

describe('DashboardPage In-Progress Sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ mode: 'guest' });
  });

  it('displays in-progress sessions when available (Requirements 4.1)', async () => {
    mockGetInProgressSessions.mockResolvedValue(mockInProgressSessions);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Wait for sessions to load
    await waitFor(() => {
      expect(screen.getByText('继续练习')).toBeInTheDocument();
    });

    // Check session cards are rendered
    expect(screen.getByText('初级')).toBeInTheDocument();
    expect(screen.getByText('中级')).toBeInTheDocument();
    expect(screen.getByText('20 词')).toBeInTheDocument();
    expect(screen.getByText('30 词')).toBeInTheDocument();
  });

  it('does not display section when no in-progress sessions (Requirements 4.1)', async () => {
    mockGetInProgressSessions.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('继续练习')).not.toBeInTheDocument();
    });
  });

  it('handles continue button click (Requirements 4.3)', async () => {
    mockGetInProgressSessions.mockResolvedValue(mockInProgressSessions);
    mockGetSessionForResume.mockResolvedValue(mockSessionSnapshot);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('继续练习')).toBeInTheDocument();
    });

    // Click continue on first session
    const continueButtons = screen.getAllByRole('button', { name: /继续/i });
    await userEvent.click(continueButtons[0]);

    await waitFor(() => {
      expect(mockGetSessionForResume).toHaveBeenCalledWith('session-1');
      expect(mockResumeSession).toHaveBeenCalledWith(mockSessionSnapshot);
      expect(mockNavigate).toHaveBeenCalledWith('/practice/quiz');
    });
  });

  it('handles delete button with confirmation (Requirements 4.4)', async () => {
    mockGetInProgressSessions.mockResolvedValue(mockInProgressSessions);
    mockDeleteSession.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('继续练习')).toBeInTheDocument();
    });

    // Click delete button on first session
    const deleteButtons = screen.getAllByRole('button', { name: /删除练习/i });
    await userEvent.click(deleteButtons[0]);

    // Confirmation dialog should appear
    expect(screen.getByText('确定要删除这个练习吗？此操作不可撤销。')).toBeInTheDocument();

    // Confirm deletion
    await userEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
    });
  });

  it('handles delete cancellation (Requirements 4.4)', async () => {
    mockGetInProgressSessions.mockResolvedValue(mockInProgressSessions);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('继续练习')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByRole('button', { name: /删除练习/i });
    await userEvent.click(deleteButtons[0]);

    // Cancel deletion
    await userEvent.click(screen.getByRole('button', { name: '取消' }));

    // Session should still be visible
    expect(screen.getByText('初级')).toBeInTheDocument();
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it('displays loading state while fetching sessions', async () => {
    // Create a promise that doesn't resolve immediately
    let resolvePromise: (value: InProgressSessionSummary[]) => void;
    const pendingPromise = new Promise<InProgressSessionSummary[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockGetInProgressSessions.mockReturnValue(pendingPromise);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Loading state should be visible
    expect(screen.getByText('加载中...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!([]);

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });
  });

  it('displays error state when fetch fails', async () => {
    mockGetInProgressSessions.mockRejectedValue(new Error('网络错误'));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });
});
