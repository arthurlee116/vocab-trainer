import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import QuizPage from '../pages/QuizPage';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import { createMockQuestion, createMockSuperJson, createMockType3Question } from '../test-utils/quizFixtures';
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

  describe('第三大题填空题', () => {
    it('第三大题渲染输入框而非选择按钮', async () => {
      const type3Question = createMockType3Question();
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question],
          },
          metadata: { totalQuestions: 1 },
        },
      });

      renderQuiz();

      // 应该看到输入框
      const input = screen.getByPlaceholderText('请输入答案...');
      expect(input).toBeInTheDocument();

      // 不应该有选择按钮（除了提交按钮）
      const choiceButtons = screen.queryAllByRole('button').filter(
        (btn) => !['完成', '下一题', '查看提示', '收起提示'].includes(btn.textContent ?? ''),
      );
      expect(choiceButtons.length).toBe(0);
    });

    it('beginner/intermediate 难度下显示首字母提示', async () => {
      const type3Question = createMockType3Question({ correctAnswer: 'misanthrope' });
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question],
          },
          metadata: { totalQuestions: 1, difficulty: 'beginner' },
        },
      });
      usePracticeStore.setState({ difficulty: 'beginner' });

      renderQuiz();

      // 句子中应该包含首字母提示 m_____
      expect(screen.getByText(/m_____/)).toBeInTheDocument();
    });

    it('advanced 难度下不显示首字母提示', async () => {
      const type3Question = createMockType3Question({ correctAnswer: 'misanthrope' });
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question],
          },
          metadata: { totalQuestions: 1, difficulty: 'advanced' },
        },
      });
      usePracticeStore.setState({ difficulty: 'advanced' });

      renderQuiz();

      // 句子中应该只显示 _____ 而不是 m_____
      expect(screen.queryByText(/m_____/)).toBeNull();
      expect(screen.getByText(/_____/)).toBeInTheDocument();
    });

    it('输入正确答案后可以提交', async () => {
      const type3Question = createMockType3Question({ correctAnswer: 'misanthrope' });
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question],
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

      const input = screen.getByPlaceholderText('请输入答案...');
      const submitButton = screen.getByRole('button', { name: '完成' });

      // 初始状态下按钮应该禁用
      expect(submitButton).toBeDisabled();

      // 输入答案后按钮应该启用
      await userEvent.type(input, 'misanthrope');
      expect(submitButton).toBeEnabled();

      // 提交
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(requestAnalysis).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/practice/report');
      });

      const { lastResult, answers } = usePracticeStore.getState();
      expect(lastResult?.score).toBe(100);
      expect(answers[0]?.userInput).toBe('misanthrope');
      expect(answers[0]?.correct).toBe(true);
    });

    it('输入错误答案时 correct 为 false', async () => {
      const type3Question = createMockType3Question({ correctAnswer: 'misanthrope' });
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question],
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

      const input = screen.getByPlaceholderText('请输入答案...');
      await userEvent.type(input, 'wronganswer');
      await userEvent.click(screen.getByRole('button', { name: '完成' }));

      await waitFor(() => {
        expect(requestAnalysis).toHaveBeenCalled();
      });

      const { answers } = usePracticeStore.getState();
      expect(answers[0]?.userInput).toBe('wronganswer');
      expect(answers[0]?.correct).toBe(false);
    });

    it('按回车键可以提交答案', async () => {
      const type3Question = createMockType3Question({ correctAnswer: 'test' });
      const type3Question2 = createMockType3Question({ correctAnswer: 'another', id: 'q2' });
      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [type3Question, type3Question2],
          },
          metadata: { totalQuestions: 2 },
        },
      });

      renderQuiz();

      const input = screen.getByPlaceholderText('请输入答案...');
      await userEvent.type(input, 'test{enter}');

      // 应该进入下一题
      await waitFor(() => {
        expect(screen.getByText('第 2 / 2 题')).toBeInTheDocument();
      });
    });

    it('旧版第三大题（无 correctAnswer）会被过滤掉', async () => {
      // 创建一个旧版的第三大题（使用 choices 而非 correctAnswer）
      const oldType3Question = createMockQuestion({
        type: 'questions_type_3',
        choices: [
          { id: 'c1', text: 'option1' },
          { id: 'c2', text: 'option2' },
        ],
        correctChoiceId: 'c1',
        // 没有 correctAnswer 字段
      });

      setQuizState({
        superJsonOverrides: {
          sections: {
            questions_type_1: [],
            questions_type_2: [],
            questions_type_3: [oldType3Question],
          },
          metadata: { totalQuestions: 1 },
        },
      });

      renderQuiz();

      // 旧版题目被过滤后，应该显示题库准备中或无题目
      expect(screen.getByText('题库准备中...')).toBeInTheDocument();
    });
  });

  /**
   * 重练模式测试
   * Requirements: 2.3, 2.4, 3.4
   */
  describe('重练模式', () => {
    const setRetryModeState = (retryQuestions: ReturnType<typeof createMockQuestion>[]) => {
      usePracticeStore.setState({
        isRetryMode: true,
        retryQuestions,
        retryAnswers: [],
        originalLastResult: {
          score: 50,
          analysis: { report: '原始报告', recommendations: [] },
          incorrectWords: ['test'],
        },
        status: 'inProgress',
        // 重练模式下不需要 superJson，但保留以防其他逻辑依赖
        superJson: undefined,
      });
    };

    it('重练模式下使用 retryQuestions 而非 superJson', async () => {
      const retryQuestion = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目',
        choices: [
          { id: 'r1', text: '正确答案' },
          { id: 'r2', text: '错误答案' },
        ],
        correctChoiceId: 'r1',
      });

      setRetryModeState([retryQuestion]);

      renderQuiz();

      // 应该显示重练题目
      expect(screen.getByText('重练题目')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '正确答案' })).toBeInTheDocument();
    });

    it('重练模式下进度标签显示"错题重练"', async () => {
      const retryQuestion = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目',
        choices: [
          { id: 'r1', text: '正确' },
          { id: 'r2', text: '错误' },
        ],
        correctChoiceId: 'r1',
      });

      setRetryModeState([retryQuestion]);

      renderQuiz();

      // 进度标签应该显示"错题重练"
      expect(screen.getByText('错题重练')).toBeInTheDocument();
    });

    it('重练模式下不显示大题进度胶囊', async () => {
      const retryQuestion = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目',
        choices: [
          { id: 'r1', text: '正确' },
          { id: 'r2', text: '错误' },
        ],
        correctChoiceId: 'r1',
      });

      setRetryModeState([retryQuestion]);

      renderQuiz();

      // 不应该显示大题进度胶囊（SECTION_LABELS 中的标签）
      expect(screen.queryByText(SECTION_LABELS.questions_type_1)).toBeNull();
      expect(screen.queryByText(SECTION_LABELS.questions_type_2)).toBeNull();
      expect(screen.queryByText(SECTION_LABELS.questions_type_3)).toBeNull();
    });

    it('重练模式下答题使用 recordRetryAnswer', async () => {
      const retryQuestion1 = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目1',
        choices: [
          { id: 'r1', text: '正确' },
          { id: 'r2', text: '错误' },
        ],
        correctChoiceId: 'r1',
      });
      const retryQuestion2 = createMockQuestion({
        id: 'retry-q2',
        type: 'questions_type_1',
        prompt: '重练题目2',
        choices: [
          { id: 'r3', text: '正确2' },
          { id: 'r4', text: '错误2' },
        ],
        correctChoiceId: 'r3',
      });

      setRetryModeState([retryQuestion1, retryQuestion2]);

      renderQuiz();

      // 选择答案并提交
      await userEvent.click(screen.getByRole('button', { name: '正确' }));
      await userEvent.click(screen.getByRole('button', { name: '下一题' }));

      // 检查 retryAnswers 而非 answers
      const { retryAnswers, answers } = usePracticeStore.getState();
      expect(retryAnswers.length).toBe(1);
      expect(retryAnswers[0].questionId).toBe('retry-q1');
      expect(retryAnswers[0].correct).toBe(true);
      // 原始 answers 不应该被修改
      expect(answers.length).toBe(0);
    });

    it('重练模式完成后不调用 API，直接设置结果', async () => {
      const retryQuestion = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目',
        choices: [
          { id: 'r1', text: '正确' },
          { id: 'r2', text: '错误' },
        ],
        correctChoiceId: 'r1',
      });

      setRetryModeState([retryQuestion]);

      // 清除之前的 mock 调用
      (requestAnalysis as vi.Mock).mockClear();
      (saveGuestSession as vi.Mock).mockClear();
      (saveAuthenticatedSession as vi.Mock).mockClear();

      renderQuiz();

      await userEvent.click(screen.getByRole('button', { name: '正确' }));
      await userEvent.click(screen.getByRole('button', { name: '完成' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/report');
      });

      // 重练模式不应该调用 API
      expect(requestAnalysis).not.toHaveBeenCalled();
      expect(saveGuestSession).not.toHaveBeenCalled();
      expect(saveAuthenticatedSession).not.toHaveBeenCalled();

      // 检查结果已设置
      const { lastResult } = usePracticeStore.getState();
      expect(lastResult?.score).toBe(100);
    });

    it('重练模式下第三大题填空也能正常工作', async () => {
      const retryType3Question = createMockType3Question({
        id: 'retry-type3',
        correctAnswer: 'testword',
      });

      setRetryModeState([retryType3Question]);

      renderQuiz();

      // 应该显示输入框
      const input = screen.getByPlaceholderText('请输入答案...');
      expect(input).toBeInTheDocument();

      // 输入答案并提交
      await userEvent.type(input, 'testword');
      await userEvent.click(screen.getByRole('button', { name: '完成' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/report');
      });

      const { retryAnswers, lastResult } = usePracticeStore.getState();
      expect(retryAnswers.length).toBe(1);
      expect(retryAnswers[0].userInput).toBe('testword');
      expect(retryAnswers[0].correct).toBe(true);
      expect(lastResult?.score).toBe(100);
    });

    it('重练全对时显示恭喜消息', async () => {
      const retryQuestion = createMockQuestion({
        id: 'retry-q1',
        type: 'questions_type_1',
        prompt: '重练题目',
        choices: [
          { id: 'r1', text: '正确' },
          { id: 'r2', text: '错误' },
        ],
        correctChoiceId: 'r1',
      });

      setRetryModeState([retryQuestion]);

      renderQuiz();

      await userEvent.click(screen.getByRole('button', { name: '正确' }));
      await userEvent.click(screen.getByRole('button', { name: '完成' }));

      await waitFor(() => {
        const { lastResult } = usePracticeStore.getState();
        expect(lastResult?.analysis.report).toContain('恭喜');
      });
    });
  });
});
