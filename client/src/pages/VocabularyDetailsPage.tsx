import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchVocabularyDetails, retryGenerationSection } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import SectionProgressCapsules from '../components/SectionProgressCapsules';
import { useGenerationPolling } from '../hooks/useGenerationPolling';
import { SECTION_LABELS, SECTION_ORDER } from '../constants/sections';
import type { QuestionType, SuperQuestion } from '../types';

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
  const navigate = useNavigate();
  const { pollError } = useGenerationPolling();
  const [retryingSection, setRetryingSection] = useState<QuestionType | null>(null);
  const [sectionRetryError, setSectionRetryError] = useState('');

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

  const handleStartPractice = () => {
    if (!detailReady) return;
    navigate('/practice/run');
  };

  return (
    <div className="page-section">
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
      </div>

      <div className="panel vocab-panel">
        <div className="vocab-panel-head">
          <div>
            <p className="eyebrow">词汇详情</p>
            <h2>逐词检查释义与例句</h2>
          </div>
          <button type="button" className="primary" onClick={handleStartPractice} disabled={!detailReady}>
            {detailReady ? '开始练习' : 'AI 正在整理词条...'}
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
                  <h3>{detail.word}</h3>
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
