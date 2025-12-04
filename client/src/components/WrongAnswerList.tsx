import type { WrongAnswerItem } from '../lib/wrongAnswers';
import { SECTION_LABELS } from '../constants/sections';

interface WrongAnswerListProps {
  items: WrongAnswerItem[];
}

/**
 * 错题列表组件
 * 显示用户答错的题目详情，包括题干、正确答案、用户作答和提示
 */
const WrongAnswerList = ({ items }: WrongAnswerListProps) => {
  if (items.length === 0) {
    return (
      <div className="panel wrong-answer-empty">
        <p className="empty-message">🎉 本轮全对，暂无可重练题目</p>
      </div>
    );
  }

  return (
    <div className="wrong-answer-list">
      <p className="eyebrow">错题回顾</p>
      <div className="wrong-answer-items">
        {items.map((item, index) => (
          <div key={item.question.id} className="wrong-answer-item panel">
            <div className="wrong-answer-header">
              <span className="wrong-answer-index">#{index + 1}</span>
              <span className="wrong-answer-type">{SECTION_LABELS[item.question.type]}</span>
            </div>
            <div className="wrong-answer-prompt">
              <strong>题目：</strong>
              {item.question.prompt}
            </div>
            {item.question.sentence && (
              <div className="wrong-answer-sentence">
                <strong>句子：</strong>
                {item.question.sentence}
              </div>
            )}
            <div className="wrong-answer-answers">
              <div className="answer-row correct">
                <span className="answer-label">✓ 正确答案：</span>
                <span className="answer-text">{item.correctAnswer}</span>
              </div>
              <div className="answer-row wrong">
                <span className="answer-label">✗ 你的答案：</span>
                <span className="answer-text">{item.userAnswer || '（未作答）'}</span>
              </div>
            </div>
            {item.question.hint && (
              <div className="wrong-answer-hint">
                <span className="hint-label">💡 提示：</span>
                {item.question.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WrongAnswerList;
