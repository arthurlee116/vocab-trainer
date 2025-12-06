/**
 * Unit tests for ReportPage retry functionality
 * **Feature: quiz-wrong-review**
 * **Validates: Requirements 2.1, 2.2, 2.3, 3.1**
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportPage from '../ReportPage';
import { usePracticeStore } from '../../store/usePracticeStore';
import { createMockSuperJson, createMockQuestion } from '../../test-utils/quizFixtures';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderReportPage = () => {
  cleanup();
  return render(
    <MemoryRouter>
      <ReportPage />
    </MemoryRouter>
  );
};

describe('ReportPage - Retry Functionality', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    usePracticeStore.getState().resetSession();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Retry button enabled/disabled states', () => {
    it('should disable retry button when all answers are correct', () => {
      const superJson = createMockSuperJson();
      const allQuestions = [
        ...superJson.questions_type_1,
        ...superJson.questions_type_2,
        ...superJson.questions_type_3,
      ];

      // All correct answers
      const answers = allQuestions.map((q) => ({
        questionId: q.id,
        choiceId: q.correctChoiceId,
        userInput: q.correctAnswer,
        correct: true,
        elapsedMs: 1000,
      }));

      usePracticeStore.setState({
        superJson,
        answers,
        lastResult: {
          score: 100,
          analysis: { report: 'Perfect!', recommendations: [] },
          incorrectWords: [],
        },
        isRetryMode: false,
      });

      renderReportPage();

      const retryButton = screen.getByRole('button', { name: '重练错题' });
      expect(retryButton).toBeDisabled();
    });

    it('should enable retry button when wrong answers exist', () => {
      const superJson = createMockSuperJson();
      const question = superJson.questions_type_1[0];
      const wrongChoiceId = question.choices?.find((c) => c.id !== question.correctChoiceId)?.id;

      const answers = [
        {
          questionId: question.id,
          choiceId: wrongChoiceId,
          correct: false,
          elapsedMs: 1000,
        },
      ];

      usePracticeStore.setState({
        superJson,
        answers,
        lastResult: {
          score: 0,
          analysis: { report: 'Try again', recommendations: ['Study more'] },
          incorrectWords: [question.word],
        },
        isRetryMode: false,
      });

      renderReportPage();

      const retryButton = screen.getByRole('button', { name: '重练错题' });
      expect(retryButton).not.toBeDisabled();
    });
  });

  describe('Retry button click triggers correct actions', () => {
    it('should call startRetryPractice and navigate to /practice/quiz on click', () => {
      const superJson = createMockSuperJson();
      const question = superJson.questions_type_1[0];
      const wrongChoiceId = question.choices?.find((c) => c.id !== question.correctChoiceId)?.id;

      const answers = [
        {
          questionId: question.id,
          choiceId: wrongChoiceId,
          correct: false,
          elapsedMs: 1000,
        },
      ];

      usePracticeStore.setState({
        superJson,
        answers,
        lastResult: {
          score: 0,
          analysis: { report: 'Try again', recommendations: [] },
          incorrectWords: [question.word],
        },
        isRetryMode: false,
      });

      renderReportPage();

      const retryButton = screen.getByRole('button', { name: '重练错题' });
      fireEvent.click(retryButton);

      // Check that retry mode was started
      const state = usePracticeStore.getState();
      expect(state.isRetryMode).toBe(true);
      expect(state.retryQuestions.length).toBeGreaterThan(0);
      expect(mockNavigate).toHaveBeenCalledWith('/practice/quiz');
    });
  });

  describe('Retry mode UI differences', () => {
    it('should show retry-specific UI when in retry mode', () => {
      const retryQuestion = createMockQuestion({ type: 'questions_type_1' });

      usePracticeStore.setState({
        isRetryMode: true,
        retryQuestions: [retryQuestion],
        retryAnswers: [
          {
            questionId: retryQuestion.id,
            choiceId: retryQuestion.correctChoiceId,
            correct: true,
            elapsedMs: 1000,
          },
        ],
        lastResult: {
          score: 100,
          analysis: { report: 'Great job!', recommendations: [] },
          incorrectWords: [],
        },
        originalLastResult: {
          score: 50,
          analysis: { report: 'Original report', recommendations: [] },
          incorrectWords: [retryQuestion.word],
        },
      });

      renderReportPage();

      // Should show retry-specific header
      expect(screen.getByText('错题重练结果')).toBeInTheDocument();
      // Should show "返回原报告" button
      expect(screen.getByRole('button', { name: '返回原报告' })).toBeInTheDocument();
    });

    it('should show success message when all retry questions are correct', () => {
      const retryQuestion = createMockQuestion({ type: 'questions_type_1' });

      usePracticeStore.setState({
        isRetryMode: true,
        retryQuestions: [retryQuestion],
        retryAnswers: [
          {
            questionId: retryQuestion.id,
            choiceId: retryQuestion.correctChoiceId,
            correct: true,
            elapsedMs: 1000,
          },
        ],
        lastResult: {
          score: 100,
          analysis: { report: 'Great!', recommendations: [] },
          incorrectWords: [],
        },
        originalLastResult: {
          score: 50,
          analysis: { report: 'Original', recommendations: [] },
          incorrectWords: [],
        },
      });

      renderReportPage();

      expect(screen.getByText(/恭喜！错题已全部掌握/)).toBeInTheDocument();
    });

    it('should show "继续重练" button when retry has wrong answers', () => {
      const retryQuestion = createMockQuestion({ type: 'questions_type_1' });
      const wrongChoiceId = retryQuestion.choices?.find((c) => c.id !== retryQuestion.correctChoiceId)?.id;

      usePracticeStore.setState({
        isRetryMode: true,
        retryQuestions: [retryQuestion],
        retryAnswers: [
          {
            questionId: retryQuestion.id,
            choiceId: wrongChoiceId,
            correct: false,
            elapsedMs: 1000,
          },
        ],
        lastResult: {
          score: 0,
          analysis: { report: 'Keep trying', recommendations: ['Practice more'] },
          incorrectWords: [retryQuestion.word],
        },
        originalLastResult: {
          score: 50,
          analysis: { report: 'Original', recommendations: [] },
          incorrectWords: [],
        },
      });

      renderReportPage();

      expect(screen.getByRole('button', { name: '继续重练' })).toBeInTheDocument();
    });

    it('should call exitRetryMode when clicking "返回原报告"', () => {
      const retryQuestion = createMockQuestion({ type: 'questions_type_1' });

      usePracticeStore.setState({
        isRetryMode: true,
        retryQuestions: [retryQuestion],
        retryAnswers: [
          {
            questionId: retryQuestion.id,
            choiceId: retryQuestion.correctChoiceId,
            correct: true,
            elapsedMs: 1000,
          },
        ],
        lastResult: {
          score: 100,
          analysis: { report: 'Great!', recommendations: [] },
          incorrectWords: [],
        },
        originalLastResult: {
          score: 50,
          analysis: { report: 'Original report', recommendations: ['Study'] },
          incorrectWords: [],
        },
      });

      renderReportPage();

      const backButton = screen.getByRole('button', { name: '返回原报告' });
      fireEvent.click(backButton);

      const state = usePracticeStore.getState();
      expect(state.isRetryMode).toBe(false);
      expect(state.retryQuestions).toEqual([]);
      expect(state.retryAnswers).toEqual([]);
    });
  });

  describe('WrongAnswerList integration', () => {
    it('should display wrong answers in normal mode', () => {
      const superJson = createMockSuperJson();
      const question = superJson.questions_type_1[0];
      const wrongChoiceId = question.choices?.find((c) => c.id !== question.correctChoiceId)?.id;

      const answers = [
        {
          questionId: question.id,
          choiceId: wrongChoiceId,
          correct: false,
          elapsedMs: 1000,
        },
      ];

      usePracticeStore.setState({
        superJson,
        answers,
        lastResult: {
          score: 0,
          analysis: { report: 'Try again', recommendations: [] },
          incorrectWords: [question.word],
        },
        isRetryMode: false,
      });

      renderReportPage();

      expect(screen.getByText('错题回顾')).toBeInTheDocument();
    });

    it('should display empty message when no wrong answers', () => {
      const superJson = createMockSuperJson();
      const allQuestions = [
        ...superJson.questions_type_1,
        ...superJson.questions_type_2,
        ...superJson.questions_type_3,
      ];

      const answers = allQuestions.map((q) => ({
        questionId: q.id,
        choiceId: q.correctChoiceId,
        userInput: q.correctAnswer,
        correct: true,
        elapsedMs: 1000,
      }));

      usePracticeStore.setState({
        superJson,
        answers,
        lastResult: {
          score: 100,
          analysis: { report: 'Perfect!', recommendations: [] },
          incorrectWords: [],
        },
        isRetryMode: false,
      });

      renderReportPage();

      expect(screen.getByText(/本轮全对，暂无可重练题目/)).toBeInTheDocument();
    });
  });
});
