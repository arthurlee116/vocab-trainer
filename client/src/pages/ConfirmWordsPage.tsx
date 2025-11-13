import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchVocabularyDetails, startGenerationSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { DifficultyLevel } from '../types';

const ConfirmWordsPage = () => {
  const {
    words,
    addWord,
    removeWord,
    applySessionSnapshot,
    startGenerating,
    setVocabDetails,
    setDetailsError,
  } = usePracticeStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const navigate = useNavigate();

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    addWord(input);
    setInput('');
  };

  const handleConfirm = () => {
    if (!words.length) {
      setError('至少需要一个单词');
      return;
    }
    setError('');
    setSelecting(true);
  };

  const handleDifficulty = async (difficulty: DifficultyLevel) => {
    setLoading(true);
    startGenerating();
    try {
      const sessionPromise = startGenerationSession({ words, difficulty }).then((snapshot) => {
        applySessionSnapshot(snapshot);
        return snapshot;
      });
      const detailsPromise = fetchVocabularyDetails({ words, difficulty }).then((details) => {
        setVocabDetails(details);
        return details;
      });

      await Promise.all([sessionPromise, detailsPromise]);
      navigate('/practice/details');
    } catch (err) {
      const message = getErrorMessage(err, '生成词汇详情失败，请重试');
      setError(message);
      setDetailsError(message);
      setSelecting(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section">
      <div className="panel">
        <p className="eyebrow">单词确认</p>
        <h2>已识别 {words.length} 个词</h2>
        <div className="tag-grid">
          {words.map((word) => (
            <button key={word} type="button" className="tag" onClick={() => removeWord(word)}>
              {word}
              <span>×</span>
            </button>
          ))}
        </div>

        <form className="tag-form" onSubmit={handleAdd}>
          <input
            placeholder="手动添加新词..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit">添加</button>
        </form>

        {error && <p className="form-error">{error}</p>}

        <button type="button" className="primary" onClick={handleConfirm} disabled={!words.length}>
          确认，开始练习
        </button>

        {selecting && (
          <div className="difficulty-panel">
            <p>选择难度：</p>
            <div className="difficulty-grid">
              <button type="button" onClick={() => handleDifficulty('beginner')} disabled={loading}>
                初级
              </button>
              <button type="button" onClick={() => handleDifficulty('intermediate')} disabled={loading}>
                中级
              </button>
              <button type="button" onClick={() => handleDifficulty('advanced')} disabled={loading}>
                高级
              </button>
            </div>
            {loading && <p>AI 正在为您准备题目...</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmWordsPage;
