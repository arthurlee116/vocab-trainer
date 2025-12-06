import { renderHook, waitFor } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { useGenerationPolling } from '../useGenerationPolling';
import { usePracticeStore } from '../../store/usePracticeStore';
import type { GenerationSectionState, QuestionType, SessionSnapshot } from '../../types';
import { fetchGenerationSession } from '../../lib/api';
import { getSessionForResume } from '../../lib/progressService';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    fetchGenerationSession: vi.fn(),
  };
});

vi.mock('../../lib/progressService', async () => {
  return {
    getSessionForResume: vi.fn(),
  };
});

const createSection = (overrides?: Partial<GenerationSectionState>): GenerationSectionState => ({
  status: 'ready',
  questions: [],
  error: undefined,
  updatedAt: Date.now(),
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setStoreState = (statusOverrides?: Partial<Record<QuestionType, GenerationSectionState>>) => {
  usePracticeStore.setState({
    sessionId: 'session-1',
    sectionStatus: {
      questions_type_1: statusOverrides?.questions_type_1?.status ?? 'ready',
      questions_type_2: statusOverrides?.questions_type_2?.status ?? 'ready',
      questions_type_3: statusOverrides?.questions_type_3?.status ?? 'ready',
    },
    applySessionSnapshot: vi.fn(),
  });
};

const snapshot = {
  sessionId: 'session-1',
  metadata: {
    totalQuestions: 3,
    words: ['a', 'b'],
    difficulty: 'beginner' as const,
    generatedAt: new Date().toISOString(),
    estimatedTotalQuestions: 3,
  },
  perType: 1,
  sections: {
    questions_type_1: createSection(),
    questions_type_2: createSection({ status: 'ready' }),
    questions_type_3: createSection({ status: 'ready' }),
  },
};

describe('useGenerationPolling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePracticeStore.setState({
      sessionId: undefined,
      historySessionId: undefined,
      sectionStatus: {
        questions_type_1: 'pending',
        questions_type_2: 'pending',
        questions_type_3: 'pending',
      },
      applySessionSnapshot: usePracticeStore.getState().applySessionSnapshot,
      resumeSession: usePracticeStore.getState().resumeSession,
    });
  });

  it('未拥有 sessionId 时不会触发轮询', () => {
    const { unmount } = renderHook(() => useGenerationPolling());
    expect(fetchGenerationSession).not.toHaveBeenCalled();
    unmount();
  });

  it('所有大题已就绪时跳过轮询', () => {
    usePracticeStore.setState({
      sessionId: 'session-1',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'ready',
        questions_type_3: 'ready',
      },
    });

    const { unmount } = renderHook(() => useGenerationPolling());
    expect(fetchGenerationSession).not.toHaveBeenCalled();
    unmount();
  });

  it('轮询 session 并应用最新状态', async () => {
    setStoreState({
      questions_type_2: createSection({ status: 'generating' }),
      questions_type_3: createSection({ status: 'pending' }),
    });
    const applySnapshot = vi.fn();
    usePracticeStore.setState({ applySessionSnapshot: applySnapshot });
    (fetchGenerationSession as vi.Mock).mockResolvedValue(snapshot);

    const { result, unmount } = renderHook(() => useGenerationPolling());

    await waitFor(() => {
      expect(fetchGenerationSession).toHaveBeenCalledWith('session-1');
    });
    expect(applySnapshot).toHaveBeenCalledWith(snapshot);
    expect(result.current.pollError).toBe('');
    unmount();
  });

  it('请求失败时返回兜底错误', async () => {
    setStoreState({
      questions_type_2: createSection({ status: 'generating' }),
    });
    (fetchGenerationSession as vi.Mock).mockRejectedValue({});

    const { result, unmount } = renderHook(() => useGenerationPolling());

    await waitFor(() => {
      expect(result.current.pollError).toContain('刷新题库状态失败');
    });
    unmount();
  });

  it('卸载后不会更新已经完成的请求', async () => {
    const deferred = createDeferred<typeof snapshot>();
    (fetchGenerationSession as vi.Mock).mockReturnValue(deferred.promise);
    setStoreState({
      questions_type_2: createSection({ status: 'generating' }),
    });
    const applySnapshot = vi.fn();
    usePracticeStore.setState({ applySessionSnapshot: applySnapshot });

    const { unmount } = renderHook(() => useGenerationPolling());
    unmount();
    deferred.resolve(snapshot);
    await Promise.resolve();

    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('卸载后错误不会覆盖提示', async () => {
    const deferred = createDeferred<never>();
    (fetchGenerationSession as vi.Mock).mockReturnValue(deferred.promise);
    setStoreState({
      questions_type_2: createSection({ status: 'generating' }),
    });

    const { result, unmount } = renderHook(() => useGenerationPolling());
    unmount();
    deferred.reject(new Error('boom'));
    await Promise.resolve();

    expect(result.current.pollError).toBe('');
  });

  it('清理 effect 时会取消下一次轮询', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    (fetchGenerationSession as vi.Mock).mockResolvedValue(snapshot);
    setStoreState({
      questions_type_2: createSection({ status: 'generating' }),
    });

    const { unmount } = renderHook(() => useGenerationPolling());
    expect(fetchGenerationSession).toHaveBeenCalled();
    await Promise.resolve();
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });

  // Requirement 7.1: Generation session expiry fallback to history session
  it('404 错误时调用 getSessionForResume (Requirement 7.1)', async () => {
    // Setup store with historySessionId
    usePracticeStore.setState({
      sessionId: 'session-1',
      historySessionId: 'history-session-1',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
    });

    // Mock 404 error from generation session API
    const error404 = { response: { status: 404 } };
    (fetchGenerationSession as Mock).mockRejectedValue(error404);
    
    // Mock successful history session retrieval
    (getSessionForResume as Mock).mockResolvedValue({
      id: 'history-session-1',
      mode: 'guest',
      difficulty: 'beginner',
      words: ['a', 'b'],
      score: 0,
      analysis: { report: '', recommendations: [] },
      superJson: {
        metadata: {
          totalQuestions: 3,
          words: ['a', 'b'],
          difficulty: 'beginner',
          generatedAt: new Date().toISOString(),
        },
        questions_type_1: [],
        questions_type_2: [],
        questions_type_3: [],
      },
      answers: [],
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      currentQuestionIndex: 0,
      updatedAt: new Date().toISOString(),
    });

    const { unmount } = renderHook(() => useGenerationPolling());

    await waitFor(() => {
      expect(getSessionForResume).toHaveBeenCalledWith('history-session-1');
    });

    unmount();
  });

  it('404 错误时回退到 history session 并调用 resumeSession (Requirement 7.1)', async () => {
    const historySession: SessionSnapshot = {
      id: 'history-session-1',
      mode: 'guest',
      difficulty: 'beginner',
      words: ['a', 'b'],
      score: 0,
      analysis: { report: '', recommendations: [] },
      superJson: {
        metadata: {
          totalQuestions: 3,
          words: ['a', 'b'],
          difficulty: 'beginner',
          generatedAt: new Date().toISOString(),
        },
        questions_type_1: [],
        questions_type_2: [],
        questions_type_3: [],
      },
      answers: [],
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      currentQuestionIndex: 0,
      updatedAt: new Date().toISOString(),
    };

    const resumeSessionMock = vi.fn();
    
    // Setup store with historySessionId and mock resumeSession
    usePracticeStore.setState({
      sessionId: 'session-1',
      historySessionId: 'history-session-1',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
      resumeSession: resumeSessionMock,
    });

    // Mock 404 error from generation session API
    const error404 = { response: { status: 404 } };
    (fetchGenerationSession as Mock).mockRejectedValue(error404);
    
    // Mock successful history session retrieval
    (getSessionForResume as Mock).mockResolvedValue(historySession);

    const { unmount } = renderHook(() => useGenerationPolling());

    await waitFor(() => {
      expect(getSessionForResume).toHaveBeenCalledWith('history-session-1');
    });

    await waitFor(() => {
      expect(resumeSessionMock).toHaveBeenCalledWith(historySession);
    });

    unmount();
  });

  it('404 错误但无 historySessionId 时显示错误', async () => {
    // Setup store without historySessionId
    usePracticeStore.setState({
      sessionId: 'session-1',
      historySessionId: undefined,
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
    });

    // Mock 404 error
    const error404 = { response: { status: 404 } };
    (fetchGenerationSession as vi.Mock).mockRejectedValue(error404);

    const { result, unmount } = renderHook(() => useGenerationPolling());

    await waitFor(() => {
      expect(result.current.pollError).toContain('刷新题库状态失败');
    });

    // Should not attempt to get history session
    expect(getSessionForResume).not.toHaveBeenCalled();
    unmount();
  });

  it('404 回退失败时调用 getSessionForResume', async () => {
    // Setup mocks BEFORE setting store state
    // Mock 404 error from generation session API
    const error404 = { response: { status: 404 } };
    (fetchGenerationSession as Mock).mockRejectedValue(error404);
    
    // Mock failed history session retrieval
    (getSessionForResume as Mock).mockRejectedValue(new Error('History session not found'));
    
    // Setup store with historySessionId
    usePracticeStore.setState({
      sessionId: 'session-1',
      historySessionId: 'history-session-1',
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
    });

    const { unmount } = renderHook(() => useGenerationPolling());

    // Wait for getSessionForResume to be called
    await waitFor(() => {
      expect(getSessionForResume).toHaveBeenCalledWith('history-session-1');
    });

    unmount();
  });
});
