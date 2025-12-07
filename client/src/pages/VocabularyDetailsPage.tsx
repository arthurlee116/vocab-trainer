import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchVocabularyDetails, retryGenerationSection } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { createInProgressSession } from '../lib/progressService';
import SectionProgressCapsules from '../components/SectionProgressCapsules';
import { useGenerationPolling } from '../hooks/useGenerationPolling';
import { SECTION_LABELS, SECTION_ORDER } from '../constants/sections';
import type { QuestionType, SuperQuestion } from '../types';
import { tts } from '../lib/tts';

const VocabularyDetailsPage = () => {
  const vocabDetails = usePracticeStore((state) => state.vocabDetails);
  const detailsStatus = usePracticeStore((state) => state.detailsStatus);
  const detailsError = usePracticeStore((state) => state.detailsError);
  const sectionStatus = usePracticeStore((state) => state.sectionStatus);
  const sectionErrors = usePracticeStore((state) => state.sectionErrors);
  const sessionId = usePracticeStore((state) => state.sessionId);
  const superJson = usePracticeStore((state) => state.superJson);
  const estimatedTotalQuestions = usePracticeStore((state) => state.estimatedTotalQuestions);
  const words = usePracticeStore((state) => state.words);
  const difficulty = usePracticeStore((state) => state.difficulty);
  const beginDetailsFetch = usePracticeStore((state) => state.beginDetailsFetch);
  const setVocabDetails = usePracticeStore((state) => state.setVocabDetails);
  const setDetailsError = usePracticeStore((state) => state.setDetailsError);
  const applySessionSnapshot = usePracticeStore((state) => state.applySessionSnapshot);
  const audioEnabled = usePracticeStore((state) => state.audioEnabled);
  const initializeHistorySession = usePracticeStore((state) => state.initializeHistorySession);
  // Session resume fields (Requirements 5.1, 5.2)
  const isResumedSession = usePracticeStore((state) => state.isResumedSession);
  const navigate = useNavigate();
  const { pollError } = useGenerationPolling();
  const [retryingSection, setRetryingSection] = useState<QuestionType | null>(null);
  const [sectionRetryError, setSectionRetryError] = useState('');
  const [sessionCreateError, setSessionCreateError] = useState('');
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  
  const canSpeak = tts.canSpeak();

  const sectionQuestions: Record<QuestionType, SuperQuestion[]> = useMemo(
    () => ({
      questions_type_1: superJson?.questions_type_1 ?? [],
      questions_type_2: superJson?.questions_type_2 ?? [],
      questions_type_3: superJson?.questions_type_3 ?? [],
    }),
    [superJson],
  );

  const totalTarget = Math.max(estimatedTotalQuestions ?? superJson?.metadata.totalQuestions ?? 1, 1);
  const readyCount = SECTION_ORDER.reduce(
    (sum, type) => sum + (sectionStatus[type] === 'ready' ? sectionQuestions[type].length : 0),
    0,
  );
  const progressPercent = Math.min((readyCount / totalTarget) * 100, 100);

  const sectionStates = SECTION_ORDER.map((type) => ({
    type,
    label: SECTION_LABELS[type],
    status: sectionStatus[type],
    error: sectionErrors[type],
    count: sectionQuestions[type].length,
    canRetry: type !== 'questions_type_1' && !!sessionId,
  }));

  // For resumed sessions with vocab details, they are already ready (Requirements 5.1, 5.2)
  const detailReady = detailsStatus === 'ready' && (vocabDetails?.length ?? 0) > 0;

  const handleRetrySection = async (type: QuestionType) => {
    if (!sessionId) return;
    setSectionRetryError('');
    setRetryingSection(type);
    try {
      const snapshot = await retryGenerationSection(sessionId, type);
      applySessionSnapshot(snapshot);
    } catch (err) {
      setSectionRetryError(getErrorMessage(err, '重新生成该题型失败，请稍后重试'));
    } finally {
      setRetryingSection(null);
    }
  };

  const handleRetryDetails = async () => {
    if (!words.length || !difficulty) {
      setDetailsError('缺少词汇或难度信息，请返回上一页重新开始');
      return;
    }
    beginDetailsFetch();
    try {
      const details = await fetchVocabularyDetails({ words, difficulty });
      setVocabDetails(details);
    } catch (err) {
      setDetailsError(getErrorMessage(err, '词汇详情生成失败，请稍后重试'));
    }
  };

  const handleStartPractice = async () => {
    if (!detailReady || !superJson || !difficulty) return;
    
    // For resumed sessions, skip creating new session (Requirements 5.1, 5.2)
    if (isResumedSession) {
      navigate('/practice/run');
      return;
    }
    
    setIsStartingPractice(true);
    setSessionCreateError('');
    
    try {
      // Create in-progress session before navigation (Requirements 1.1, 1.2, 1.3)
      const { id } = await createInProgressSession({
        difficulty,
        words,
        superJson,
      });
      // Store session ID in practice store (Requirement 1.3)
      initializeHistorySession(id);
    } catch (err) {
      // Graceful degradation: show error but still allow navigation (Requirement 1.4)
      console.error('Failed to create in-progress session:', err);
      setSessionCreateError('进度保存功能暂时不可用，但您可以继续练习');
      // Clear error after 3 seconds
      setTimeout(() => setSessionCreateError(''), 3000);
    }
    
    setIsStartingPractice(false);
    navigate('/practice/run');
  };

  // Determine button text based on session state (Requirements 5.1, 5.2)
  const getButtonText = () => {
    if (isStartingPractice) return '正在准备...';
    if (isResumedSession && detailReady) return '继续练习';
    if (detailReady) return '开始练习';
    return 'AI 正在整理词条...';
  };

  return (
    <div className="page-section">
      {/* Hide quiz progress for resumed sessions since quiz is already complete (Requirements 5.1, 5.2) */}
      {!isResumedSession && (
        <div className="quiz-progress">
          <div className="progress-header">
            <p className="progress-label">题库进度</p>
            <p className="progress-count">
              已就绪 {readyCount} / {totalTarget} 题
            </p>
          </div>
          <div className="progress-track">
            <div className="progress-thumb" style={{ width: `${progressPercent}%` }} />
          </div>
          <SectionProgressCapsules
            sections={sectionStates}
            onRetry={sessionId ? handleRetrySection : undefined}
            retryingSection={retryingSection}
          />
          {pollError && <p className="form-error subtle">{pollError}</p>}
          {sectionRetryError && <p className="form-error subtle">{sectionRetryError}</p>}
          {sessionCreateError && <p className="form-error subtle">{sessionCreateError}</p>}
        </div>
      )}

      <div className="panel vocab-panel">
        <div className="vocab-panel-head">
          <div>
            <p className="eyebrow">{isResumedSession ? '已保存的词汇详情' : '词汇详情'}</p>
            <h2>{isResumedSession ? '复习词汇释义与例句' : '逐词检查释义与例句'}</h2>
          </div>
          <button 
            type="button" 
            className="primary" 
            onClick={handleStartPractice} 
            disabled={!detailReady || isStartingPractice}
          >
            {getButtonText()}
          </button>
        </div>

        {detailsStatus === 'loading' && (
          <div className="vocab-status">
            <p>AI 正在整理词条，请稍候 5-10 秒...</p>
          </div>
        )}

        {detailsStatus === 'error' && (
          <div className="vocab-status error">
            <p className="form-error">{detailsError ?? '词汇详情生成失败，请重试'}</p>
            <button type="button" className="secondary" onClick={handleRetryDetails}>
              重新生成词汇详情
            </button>
          </div>
        )}

        {detailReady && vocabDetails && (
          <div className="vocab-list">
            {vocabDetails.map((detail) => (
              <article key={detail.word} className="vocab-entry">
                <header className="vocab-entry-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3>{detail.word}</h3>
                    <button
                      type="button"
                      className="audio-btn"
                      style={{ width: '28px', height: '28px' }}
                      onClick={() => tts.speak(detail.word)}
                      disabled={!canSpeak || !audioEnabled}
                      title={!canSpeak ? "当前浏览器不支持语音播放" : !audioEnabled ? "音频已禁用" : "播放发音"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                  </div>
                  <div className="pos-list">
                    {detail.partsOfSpeech.map((pos) => (
                      <span key={`${detail.word}-${pos}`} className="pos-badge">
                        {pos}
                      </span>
                    ))}
                  </div>
                </header>
                <ol className="definition-list">
                  {detail.definitions.map((definition, index) => (
                    <li key={`${detail.word}-def-${index}`}>{definition}</li>
                  ))}
                </ol>
                <details className="example-block">
                  <summary>查看例句</summary>
                  <ul className="example-list">
                    {detail.examples.map((example, index) => (
                      <li key={`${detail.word}-ex-${index}`}>
                        <p className="example-en">{example.en}</p>
                        <p className="example-zh">{example.zh}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabularyDetailsPage;
