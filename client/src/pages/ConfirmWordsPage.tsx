import { useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchVocabularyDetails, startGenerationSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { DifficultyLevel, GenerationSessionSnapshot } from '../types';

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
  // Toggle state for vocabulary details generation (Requirements 1.1, 1.2, 1.3)
  const [enableVocabDetails, setEnableVocabDetails] = useState(false);
  // State for vocab details error handling (Requirements 3.4, 3.5)
  const [vocabDetailsError, setVocabDetailsError] = useState('');
  const [retrying, setRetrying] = useState(false);
  // Store session snapshot for retry/skip scenario
  const pendingSessionRef = useRef<GenerationSessionSnapshot | null>(null);
  const pendingDifficultyRef = useRef<DifficultyLevel | null>(null);
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
    setError('');
    setVocabDetailsError('');
    
    try {
      if (enableVocabDetails) {
        // Toggle 开启时：并行调用两个 API (Requirements 3.1)
        const sessionPromise = startGenerationSession({ words, difficulty });
        const detailsPromise = fetchVocabularyDetails({ words, difficulty });
        
        // Wait for both, but handle vocab details failure separately
        const results = await Promise.allSettled([sessionPromise, detailsPromise]);
        const [sessionResult, detailsResult] = results;
        
        // Check if quiz generation failed (Requirements 3.5)
        if (sessionResult.status === 'rejected') {
          const message = getErrorMessage(sessionResult.reason, '生成题库失败，请重试');
          setError(message);
          setSelecting(false);
          setLoading(false);
          return;
        }
        
        const sessionSnapshot = sessionResult.value;
        applySessionSnapshot(sessionSnapshot);
        
        // Check if vocab details failed but quiz succeeded (Requirements 3.4)
        if (detailsResult.status === 'rejected') {
          const message = getErrorMessage(detailsResult.reason, '词汇详情生成失败');
          setVocabDetailsError(message);
          pendingSessionRef.current = sessionSnapshot;
          pendingDifficultyRef.current = difficulty;
          setLoading(false);
          return;
        }
        
        // Both succeeded (Requirements 3.3)
        setVocabDetails(detailsResult.value);
        navigate('/practice/details');
      } else {
        // Toggle 关闭时：仅调用 startGenerationSession，成功后直接跳转 QuizPage
        // (Requirements 2.1, 2.3)
        const sessionSnapshot = await startGenerationSession({ words, difficulty });
        applySessionSnapshot(sessionSnapshot);
        navigate('/practice/quiz');
      }
    } catch (err) {
      const message = getErrorMessage(err, '生成题库失败，请重试');
      setError(message);
      setSelecting(false);
    } finally {
      setLoading(false);
    }
  };

  // Retry vocabulary details generation (Requirements 3.4)
  const handleRetryVocabDetails = async () => {
    if (!pendingDifficultyRef.current) return;
    
    setRetrying(true);
    setVocabDetailsError('');
    
    try {
      const details = await fetchVocabularyDetails({
        words,
        difficulty: pendingDifficultyRef.current,
      });
      setVocabDetails(details);
      navigate('/practice/details');
    } catch (err) {
      const message = getErrorMessage(err, '词汇详情生成失败');
      setVocabDetailsError(message);
    } finally {
      setRetrying(false);
    }
  };

  // Skip vocabulary details and go directly to quiz (Requirements 3.5)
  const handleSkipVocabDetails = () => {
    setVocabDetailsError('');
    pendingSessionRef.current = null;
    pendingDifficultyRef.current = null;
    // hasVocabDetails will be false since we didn't set vocabDetails
    navigate('/practice/quiz');
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

        {/* Vocab details error with retry/skip options (Requirements 3.4, 3.5) */}
        {vocabDetailsError && (
          <div className="vocab-status error" data-testid="vocab-details-error">
            <p>{vocabDetailsError}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="ghost small"
                onClick={handleRetryVocabDetails}
                disabled={retrying}
              >
                {retrying ? '重试中...' : '重试词汇详情'}
              </button>
              <button
                type="button"
                className="primary small"
                onClick={handleSkipVocabDetails}
                disabled={retrying}
              >
                跳过，直接开始
              </button>
            </div>
          </div>
        )}

        <button type="button" className="primary" onClick={handleConfirm} disabled={!words.length || !!vocabDetailsError}>
          确认，开始练习
        </button>

        {selecting && (
          <div className="difficulty-panel">
            <p>选择难度：</p>
            <div className="difficulty-grid">
              <button type="button" onClick={() => handleDifficulty('beginner')} disabled={loading}>
                {loading ? '正在生成...' : '初级'}
              </button>
              <button type="button" onClick={() => handleDifficulty('intermediate')} disabled={loading}>
                {loading ? '正在生成...' : '中级'}
              </button>
              <button type="button" onClick={() => handleDifficulty('advanced')} disabled={loading}>
                {loading ? '正在生成...' : '高级'}
              </button>
            </div>
            {/* Toggle for vocabulary details generation (Requirements 1.1, 1.2, 1.3) */}
            <label
              className="listening-mode-toggle"
              style={{ marginTop: '1rem', justifyContent: 'flex-start' }}
              data-testid="vocab-details-toggle"
            >
              <span
                className={`toggle-switch ${enableVocabDetails ? 'active' : ''}`}
                onClick={() => !loading && setEnableVocabDetails(!enableVocabDetails)}
                role="switch"
                aria-checked={enableVocabDetails}
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !loading) {
                    e.preventDefault();
                    setEnableVocabDetails(!enableVocabDetails);
                  }
                }}
              />
              <span>生成词汇详情</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfirmWordsPage;
