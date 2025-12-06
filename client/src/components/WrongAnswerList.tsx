import type { WrongAnswerItem } from '../lib/wrongAnswers';
import { SECTION_LABELS } from '../constants/sections';
import { tts } from '../lib/tts';
import { usePracticeStore } from '../store/usePracticeStore';

interface WrongAnswerListProps {
  items: WrongAnswerItem[];
}

/**
 * 错题列表组件
 * 显示用户答错的题目详情，包括题干、正确答案、用户作答和提示
 */
const WrongAnswerList = ({ items }: WrongAnswerListProps) => {
  const audioEnabled = usePracticeStore((state) => state.audioEnabled);
  const canSpeak = tts.canSpeak();

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
              {/* Review Play Button */}
              <button
                type="button"
                className="audio-btn"
                style={{ width: '28px', height: '28px' }} // Smaller for list
                onClick={() => tts.speak(item.question.type === 'questions_type_3' ? item.question.sentence ?? '' : item.question.word)}
                disabled={!canSpeak || !audioEnabled}
                title={!canSpeak ? "当前浏览器不支持语音播放" : !audioEnabled ? "音频已禁用" : "播放发音"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
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
