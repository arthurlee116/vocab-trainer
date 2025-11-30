import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import QuizPage from '../pages/QuizPage';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import { createMockQuestion, createMockSuperJson } from '../test-utils/quizFixtures';
import type { QuestionType } from '../types';
import { SECTION_LABELS } from '../constants/sections';
import { requestAnalysis, retryGenerationSection, saveAuthenticatedSession } from '../lib/api';
import { saveGuestSession } from '../lib/storage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useGenerationPolling', () => ({
  useGenerationPolling: vi.fn(() => ({ pollError: '' })),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    requestAnalysis: vi.fn(),
    retryGenerationSection: vi.fn(),
    saveAuthenticatedSession: vi.fn(),
  };
});

vi.mock('../lib/storage', async () => {
  const actual = await vi.importActual<typeof import('../lib/storage')>('../lib/storage');
  return {
    ...actual,
    saveGuestSession: vi.fn(),
  };
});

const setQuizState = (options?: {
  sectionStatus?: Partial<Record<QuestionType, 'pending' | 'ready' | 'generating' | 'error'>>;
  sectionErrors?: Partial<Record<QuestionType, string | undefined>>;
  superJsonOverrides?: Parameters<typeof createMockSuperJson>[0];
}) => {
  const superJson = createMockSuperJson(options?.superJsonOverrides);
  usePracticeStore.setState({
    superJson,
    words: superJson.metadata.words,
    sessionId: 'session-1',
    sectionStatus: {
      questions_type_1: options?.sectionStatus?.questions_type_1 ?? 'ready',
      questions_type_2: options?.sectionStatus?.questions_type_2 ?? 'ready',
      questions_type_3: options?.sectionStatus?.questions_type_3 ?? 'ready',
    },
    sectionErrors: {
      questions_type_1: options?.sectionErrors?.questions_type_1,
      questions_type_2: options?.sectionErrors?.questions_type_2,
      questions_type_3: options?.sectionErrors?.questions_type_3,
    },
    estimatedTotalQuestions: superJson.metadata.totalQuestions,
    status: 'inProgress',
  });
  return superJson;
};

describe('QuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ mode: 'guest', initializing: false });
  });

  const renderQuiz = () => render(<QuizPage />);

  it('缺少 superJson 时返回 null', () => {
    usePracticeStore.setState({ superJson: undefined });
    const { container } = renderQuiz();
    expect(container.firstChild).toBeNull();
  });

  it('题库准备中时显示占位内容', () => {
    setQuizState({
      sectionStatus: {
        questions_type_1: 'generating',
        questions_type_2: 'pending',
        questions_type_3: 'pending',
      },
      superJsonOverrides: {
        sections: {
          questions_type_1: [],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 0 },
      },
    });

    renderQuiz();
    expect(screen.getByText('题库准备中...')).toBeInTheDocument();
  });

  it('渲染题干并在选择答案后进入下一题', async () => {
    const type1Question = createMockQuestion({
      type: 'questions_type_1',
      sentence: 'I will answer the blank honestly.',
      choices: [
        { id: 'c1', text: 'honestly' },
        { id: 'c2', text: 'later' },
      ],
      correctChoiceId: 'c1',
    });
    const type2Question = createMockQuestion({
      type: 'questions_type_2',
      prompt: '第二题',
      choices: [
        { id: 'c3', text: 'alpha' },
        { id: 'c4', text: 'beta' },
      ],
      correctChoiceId: 'c3',
    });
    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [type1Question],
          questions_type_2: [type2Question],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 2 },
      },
    });

    renderQuiz();

    expect(screen.getByText(type1Question.prompt)).toBeInTheDocument();
    expect(screen.getByLabelText('填空')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: '下一题' });
    expect(nextButton).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'honestly' }));
    expect(nextButton).toBeEnabled();

    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: SECTION_LABELS.questions_type_2 })).toBeInTheDocument();
    });
    expect(screen.getByText('第 2 / 2 题')).toBeInTheDocument();
  });

  it('新题目生成后会自动推进到下一题', async () => {
    const existingQuestion = createMockQuestion({
      type: 'questions_type_1',
      prompt: '第一题',
      choices: [
        { id: 'a', text: '正确' },
        { id: 'b', text: '错误' },
      ],
      correctChoiceId: 'a',
    });
    const upcomingQuestion = createMockQuestion({
      type: 'questions_type_2',
      prompt: '第二题',
      choices: [
        { id: 'd', text: '选项一' },
        { id: 'e', text: '选项二' },
      ],
      correctChoiceId: 'd',
    });

    setQuizState({
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
      superJsonOverrides: {
        sections: {
          questions_type_1: [existingQuestion],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 2 },
      },
    });

    renderQuiz();
    await userEvent.click(screen.getByRole('button', { name: '正确' }));
    await userEvent.click(screen.getByRole('button', { name: '下一题' }));
    await screen.findByText(`${SECTION_LABELS.questions_type_2} 正在准备`);

    act(() => {
      const current = usePracticeStore.getState();
      usePracticeStore.setState({
        superJson: {
          ...current.superJson!,
          questions_type_2: [upcomingQuestion],
        },
        sectionStatus: {
          ...current.sectionStatus,
          questions_type_2: 'ready',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: SECTION_LABELS.questions_type_2 })).toBeInTheDocument();
    });

  });

  it('第二大题只高亮被考查短语，不遮挡且保留中文选项', async () => {
    const type2Question = createMockQuestion({
      type: 'questions_type_2',
      prompt: 'Translate the marked phrase',
      sentence: "They lived in a damp hovel.",
      word: 'damp hovel',
      choices: [
        { id: 'c1', text: '豪宅' },
        { id: 'c2', text: '窝棚' },
        { id: 'c3', text: '别墅' },
        { id: 'c4', text: '公寓' },
      ],
      correctChoiceId: 'c2',
    });

    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [],
          questions_type_2: [type2Question],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });

    renderQuiz();

    // 顶部不应直接展示待考短语，而应显示通用第二大题标题（针对题干区域的 h3）
    expect(screen.getByRole('heading', { level: 3, name: SECTION_LABELS.questions_type_2 })).toBeInTheDocument();

    // 句子中被考查短语应以加粗/highlight 形式出现
    const highlighted = screen.getByText(/damp hovel/i);
    expect(highlighted).toBeInTheDocument();
    expect(highlighted.tagName.toLowerCase()).toBe('strong');

    // 选项应仍然为中文，不应被替换为英文短语
    expect(screen.getByRole('button', { name: '窝棚' })).toBeInTheDocument();
  });

  it('第二大题识别 sb 占位并高亮 him/held 等变体', async () => {
    const type2Question = createMockQuestion({
      type: 'questions_type_2',
      prompt: 'Translate the marked phrase',
      sentence: 'We must hold him accountable for his actions.',
      word: 'hold sb accountable for',
      choices: [
        { id: 'c1', text: '追究某人的责任' },
        { id: 'c2', text: '原谅某人' },
        { id: 'c3', text: '支持某人' },
        { id: 'c4', text: '忽略某人' },
      ],
      correctChoiceId: 'c1',
    });

    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [],
          questions_type_2: [type2Question],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });

    renderQuiz();

    expect(screen.getByRole('heading', { level: 3, name: SECTION_LABELS.questions_type_2 })).toBeInTheDocument();

    const highlighted = screen.getByText(/hold him accountable/i);
    expect(highlighted).toBeInTheDocument();
    expect(highlighted.tagName.toLowerCase()).toBe('strong');

    // 保证选项仍为中文
    expect(screen.getByRole('button', { name: '追究某人的责任' })).toBeInTheDocument();
  });

  it('第二大题能匹配 sb 占位并高亮 (hold sb accountable for -> hold him accountable for)', async () => {
    const type2Question = createMockQuestion({
      type: 'questions_type_2',
      prompt: 'Translate the marked phrase',
      sentence: 'We must hold him accountable for his actions.',
      word: 'hold sb accountable for',
      choices: [
        { id: 'c1', text: '追究某人的责任' },
        { id: 'c2', text: '原谅某人' },
        { id: 'c3', text: '赞扬某人' },
        { id: 'c4', text: '忽略某人' },
      ],
      correctChoiceId: 'c1',
    });

    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [],
          questions_type_2: [type2Question],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });

    renderQuiz();

    expect(screen.getByRole('heading', { level: 3, name: SECTION_LABELS.questions_type_2 })).toBeInTheDocument();

    const highlighted = screen.getByText(/hold him accountable for/i);
    expect(highlighted).toBeInTheDocument();
    expect(highlighted.tagName.toLowerCase()).toBe('strong');

    // 选项应为中文
    expect(screen.getByRole('button', { name: '追究某人的责任' })).toBeInTheDocument();
  });

  it('等待下一大题时展示生成提示并允许重试', async () => {
    const question = createMockQuestion({
      type: 'questions_type_1',
      prompt: '只有一道题',
      choices: [
        { id: 'x1', text: '正确' },
        { id: 'x2', text: '错误' },
      ],
      correctChoiceId: 'x1',
    });

    setQuizState({
      sectionStatus: {
        questions_type_1: 'ready',
        questions_type_2: 'generating',
        questions_type_3: 'pending',
      },
      sectionErrors: { questions_type_2: '生成失败' },
      superJsonOverrides: {
        sections: {
          questions_type_1: [question],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });

    renderQuiz();

    await userEvent.click(screen.getByRole('button', { name: '正确' }));
    await userEvent.click(screen.getByRole('button', { name: '下一题' }));

    const waitingHeading = await screen.findByText(`${SECTION_LABELS.questions_type_2} 正在准备`);
    expect(waitingHeading).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: '重新生成' });
    expect(retryButton).toBeEnabled();

    await userEvent.click(retryButton);
    await waitFor(() => {
      expect(retryGenerationSection).toHaveBeenCalledWith('session-1', 'questions_type_2');
    });
  });

  it('全部答题后会生成分析并跳转报告', async () => {
    const question = createMockQuestion({
      type: 'questions_type_1',
      choices: [
        { id: 'c1', text: '目标' },
        { id: 'c2', text: '干扰' },
      ],
      correctChoiceId: 'c1',
      hint: '提示',
    });
    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [question],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });
    (requestAnalysis as vi.Mock).mockResolvedValue({
      report: '分析',
      recommendations: [],
    });
    (saveGuestSession as vi.Mock).mockReturnValue({ id: 'snapshot', mode: 'guest' });

    renderQuiz();

    await userEvent.click(screen.getByRole('button', { name: '目标' }));
    await userEvent.click(screen.getByRole('button', { name: '完成' }));

    await waitFor(() => {
      expect(requestAnalysis).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(saveGuestSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/practice/report');
    });

    const { lastResult } = usePracticeStore.getState();
    expect(lastResult?.score).toBe(100);
  });

  it('登录用户会调用 saveAuthenticatedSession', async () => {
    useAuthStore.setState({ mode: 'authenticated', initializing: false });
    const question = createMockQuestion({
      type: 'questions_type_1',
      choices: [
        { id: 'c1', text: 'A' },
        { id: 'c2', text: 'B' },
      ],
      correctChoiceId: 'c1',
    });
    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [question],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });
    (requestAnalysis as vi.Mock).mockResolvedValue({
      report: '分析',
      recommendations: [],
    });
    (saveAuthenticatedSession as vi.Mock).mockResolvedValue({ id: 'history' });

    renderQuiz();
    await userEvent.click(screen.getByRole('button', { name: /a/i }));
    await userEvent.click(screen.getByRole('button', { name: '完成' }));

    await waitFor(() => {
      expect(saveAuthenticatedSession).toHaveBeenCalled();
    });
  });

  it('接口失败时会展示兜底错误', async () => {
    const question = createMockQuestion({
      type: 'questions_type_1',
      choices: [
        { id: 'h1', text: 'OK' },
        { id: 'h2', text: 'NO' },
      ],
      correctChoiceId: 'h1',
    });
    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [question],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });
    (requestAnalysis as vi.Mock).mockRejectedValue({});

    renderQuiz();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await userEvent.click(screen.getByRole('button', { name: '完成' }));

    await waitFor(() => {
      expect(screen.getByText('生成报告失败，请稍后再试')).toBeInTheDocument();
    });
  });

  it('提示按钮可以展开与收起', async () => {
    const question = createMockQuestion({
      type: 'questions_type_1',
      hint: '测试提示',
      choices: [
        { id: 'v1', text: 'alpha' },
        { id: 'v2', text: 'beta' },
      ],
      correctChoiceId: 'v1',
    });
    setQuizState({
      superJsonOverrides: {
        sections: {
          questions_type_1: [question],
          questions_type_2: [],
          questions_type_3: [],
        },
        metadata: { totalQuestions: 1 },
      },
    });

    renderQuiz();
    const toggle = screen.getByRole('button', { name: '查看提示' });
    await userEvent.click(toggle);
    expect(screen.getByText('提示：测试提示')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '收起提示' }));
    expect(screen.queryByText('提示：测试提示')).toBeNull();
  });
});
