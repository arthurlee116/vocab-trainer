import { render, screen } from '@testing-library/react';
import WrongAnswerList from '../WrongAnswerList';
import type { WrongAnswerItem } from '../../lib/wrongAnswers';
import type { SuperQuestion } from '../../types';

// 测试用的选择题（type 1）
const choiceQuestion1: SuperQuestion = {
  id: 'q1',
  word: 'apple',
  prompt: '请选择 "apple" 的中文意思',
  choices: [
    { id: 'c1', text: '苹果' },
    { id: 'c2', text: '香蕉' },
    { id: 'c3', text: '橙子' },
  ],
  correctChoiceId: 'c1',
  explanation: '苹果是一种常见的水果',
  type: 'questions_type_1',
  hint: '这是一种红色的水果',
};

// 测试用的选择题（type 2）
const choiceQuestion2: SuperQuestion = {
  id: 'q2',
  word: 'banana',
  prompt: 'What is the English word for "香蕉"?',
  choices: [
    { id: 'c4', text: 'banana' },
    { id: 'c5', text: 'apple' },
    { id: 'c6', text: 'orange' },
  ],
  correctChoiceId: 'c4',
  explanation: 'Banana is a yellow fruit',
  type: 'questions_type_2',
};

// 测试用的填空题（type 3）
const fillBlankQuestion: SuperQuestion = {
  id: 'q3',
  word: 'run',
  prompt: '请填写正确的单词',
  correctAnswer: 'running',
  explanation: 'run 的现在分词是 running',
  type: 'questions_type_3',
  sentence: 'She is _____ in the park.',
  translation: '她正在公园里跑步。',
  hint: '动词 run 的现在分词形式',
};

// 测试用的错题数据
const wrongAnswerItems: WrongAnswerItem[] = [
  {
    question: choiceQuestion1,
    userAnswer: '香蕉',
    correctAnswer: '苹果',
  },
  {
    question: choiceQuestion2,
    userAnswer: 'apple',
    correctAnswer: 'banana',
  },
  {
    question: fillBlankQuestion,
    userAnswer: 'run',
    correctAnswer: 'running',
  },
];

describe('WrongAnswerList', () => {
  describe('渲染错题列表', () => {
    it('应该渲染所有错题项', () => {
      render(<WrongAnswerList items={wrongAnswerItems} />);

      // 检查标题
      expect(screen.getByText('错题回顾')).toBeInTheDocument();

      // 检查所有题目的序号
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('应该显示题型标签', () => {
      render(<WrongAnswerList items={wrongAnswerItems} />);

      expect(screen.getByText('第一大题 · 看中文选英文')).toBeInTheDocument();
      expect(screen.getByText('第二大题 · 看英文选中文')).toBeInTheDocument();
      expect(screen.getByText('第三大题 · 句子填空')).toBeInTheDocument();
    });

    it('应该显示题目内容', () => {
      render(<WrongAnswerList items={wrongAnswerItems} />);

      expect(screen.getByText(/请选择 "apple" 的中文意思/)).toBeInTheDocument();
      expect(screen.getByText(/What is the English word for "香蕉"\?/)).toBeInTheDocument();
      expect(screen.getByText(/请填写正确的单词/)).toBeInTheDocument();
    });

    it('应该显示正确答案和用户答案', () => {
      render(<WrongAnswerList items={wrongAnswerItems} />);

      // 检查正确答案
      const correctAnswers = screen.getAllByText(/✓ 正确答案：/);
      expect(correctAnswers).toHaveLength(3);

      // 检查用户答案
      const userAnswers = screen.getAllByText(/✗ 你的答案：/);
      expect(userAnswers).toHaveLength(3);

      // 检查具体答案内容
      expect(screen.getByText('苹果')).toBeInTheDocument();
      expect(screen.getByText('香蕉')).toBeInTheDocument();
      expect(screen.getByText('banana')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
    });
  });

  describe('填空题特殊显示', () => {
    it('应该显示句子内容', () => {
      render(<WrongAnswerList items={[wrongAnswerItems[2]]} />);

      expect(screen.getByText(/She is _____ in the park\./)).toBeInTheDocument();
    });
  });

  describe('提示显示', () => {
    it('应该显示有提示的题目的提示内容', () => {
      render(<WrongAnswerList items={wrongAnswerItems} />);

      // choiceQuestion1 有 hint
      expect(screen.getByText('这是一种红色的水果')).toBeInTheDocument();

      // fillBlankQuestion 有 hint
      expect(screen.getByText('动词 run 的现在分词形式')).toBeInTheDocument();
    });

    it('没有提示的题目不应该显示提示区域', () => {
      // choiceQuestion2 没有 hint
      const itemWithoutHint: WrongAnswerItem = {
        question: choiceQuestion2,
        userAnswer: 'apple',
        correctAnswer: 'banana',
      };

      const { container } = render(<WrongAnswerList items={[itemWithoutHint]} />);

      // 应该只有一个错题项，且没有提示区域
      const hintElements = container.querySelectorAll('.wrong-answer-hint');
      expect(hintElements).toHaveLength(0);
    });
  });

  describe('空状态', () => {
    it('没有错题时应该显示祝贺消息', () => {
      render(<WrongAnswerList items={[]} />);

      expect(screen.getByText('🎉 本轮全对，暂无可重练题目')).toBeInTheDocument();
    });

    it('空状态不应该显示错题回顾标题', () => {
      render(<WrongAnswerList items={[]} />);

      expect(screen.queryByText('错题回顾')).not.toBeInTheDocument();
    });
  });

  describe('未作答情况', () => {
    it('用户未作答时应该显示"（未作答）"', () => {
      const itemWithEmptyAnswer: WrongAnswerItem = {
        question: choiceQuestion1,
        userAnswer: '',
        correctAnswer: '苹果',
      };

      render(<WrongAnswerList items={[itemWithEmptyAnswer]} />);

      expect(screen.getByText('（未作答）')).toBeInTheDocument();
    });
  });
});
