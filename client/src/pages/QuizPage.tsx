import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AnswerRecord, QuestionType, SectionStatus, SessionSnapshot, SuperQuestion } from '../types';
import { fetchGenerationSession, requestAnalysis, retryGenerationSection, saveAuthenticatedSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { saveGuestSession } from '../lib/storage';
import { buildSentenceParts } from '../lib/sentenceMask';

const sectionOrder: QuestionType[] = ['questions_type_1', 'questions_type_2', 'questions_type_3'];

const sectionLabels: Record<QuestionType, string> = {
  questions_type_1: '第一大题 · 看中文选英文',
  questions_type_2: '第二大题 · 看英文选中文',
  questions_type_3: '第三大题 · 句子填空',
};

const QuizPage = () => {
  const superJson = usePracticeStore((state) => state.superJson);
  const recordAnswer = usePracticeStore((state) => state.recordAnswer);
  const words = usePracticeStore((state) => state.words);
  const setLastResult = usePracticeStore((state) => state.setLastResult);
  const sessionId = usePracticeStore((state) => state.sessionId);
  const sectionStatus = usePracticeStore((state) => state.sectionStatus);
  const sectionErrors = usePracticeStore((state) => state.sectionErrors);
  const estimatedTotalQuestions = usePracticeStore((state) => state.estimatedTotalQuestions);
  const applySessionSnapshot = usePracticeStore((state) => state.applySessionSnapshot);
  const mode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef<AnswerRecord[]>([]);
  const [error, setError] = useState('');
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [retryingSection, setRetryingSection] = useState<QuestionType | null>(null);
  const [pollError, setPollError] = useState('');
  const [isHintOpen, setIsHintOpen] = useState(false);

  const queue = useMemo(() => {
    if (!superJson) return [];
    return [
      ...superJson.questions_type_1,
      ...superJson.questions_type_2,
      ...superJson.questions_type_3,
    ];
  }, [superJson]);

  const questionMap = useMemo(() => {
    const map: Record<string, SuperQuestion> = {};
    queue.forEach((q) => {
      map[q.id] = q;
    });
    return map;
  }, [queue]);

  const allSectionsReady = sectionOrder.every((type) => sectionStatus[type] === 'ready');
  const totalTarget = Math.max(estimatedTotalQuestions ?? superJson?.metadata.totalQuestions ?? queue.length, 1);

  useEffect(() => {
    if (!sessionId || allSectionsReady) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const snapshot = await fetchGenerationSession(sessionId);
        if (!active) return;
        applySessionSnapshot(snapshot);
        setPollError('');
      } catch (err) {
        if (!active) return;
        setPollError(getErrorMessage(err, '刷新题库状态失败，请稍后重试'));
      } finally {
        if (active) {
          timer = setTimeout(poll, 4000);
        }
      }
    };

    poll();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [sessionId, allSectionsReady, applySessionSnapshot]);

  useEffect(() => {
    if (!pendingAdvance) {
      return;
    }
    if (index < queue.length - 1) {
      setPendingAdvance(false);
      setSelected(null);
      setQuestionStart(Date.now());
      setIndex((prev) => prev + 1);
    }
  }, [pendingAdvance, queue.length, index]);

  const current = queue[index];
  const currentId = current?.id;
  const sentenceHasProvidedBlank = current?.sentence?.includes('_____') ?? false;
  const correctChoiceText = current?.choices.find((choice) => choice.id === current.correctChoiceId)?.text;
  const canMaskSentence = Boolean(current?.sentence && !sentenceHasProvidedBlank && correctChoiceText);
  const sentenceMaskResult = canMaskSentence && current?.sentence && correctChoiceText
    ? buildSentenceParts(current.sentence, correctChoiceText)
    : null;
  const sentenceParts = sentenceMaskResult?.parts ?? null;
  const matchedSentenceVariant = sentenceMaskResult?.matchedVariant;
  const currentChoices = useMemo(() => {
    if (!current) return [];
    if (!matchedSentenceVariant || !correctChoiceText) return current.choices;
    return current.choices.map((choice) =>
      choice.id === current.correctChoiceId
        ? { ...choice, text: matchedSentenceVariant }
        : choice,
    );
  }, [current, matchedSentenceVariant, correctChoiceText]);

  useEffect(() => {
    setIsHintOpen(false);
  }, [currentId]);

  if (!superJson) {
    return null;
  }
  const progressCurrent = Math.min(index + 1, totalTarget);
  const progressPercent = Math.min((progressCurrent / totalTarget) * 100, 100);
  const sectionQuestions: Record<QuestionType, SuperQuestion[]> = {
    questions_type_1: superJson.questions_type_1,
    questions_type_2: superJson.questions_type_2,
    questions_type_3: superJson.questions_type_3,
  };
  const currentSectionType = current?.type as QuestionType | undefined;
  const nextBlockedSection = currentSectionType
    ? sectionOrder.slice(sectionOrder.indexOf(currentSectionType) + 1).find((type) => sectionStatus[type] !== 'ready')
    : sectionOrder.find((type) => sectionStatus[type] !== 'ready');
  const waitingSectionType = pendingAdvance
    ? nextBlockedSection ?? sectionOrder.find((type) => sectionStatus[type] !== 'ready')
    : undefined;
  const sectionStates = sectionOrder.map((type) => ({
    type,
    label: sectionLabels[type],
    status: sectionStatus[type],
    error: sectionErrors[type],
    count: sectionQuestions[type].length,
  }));
  const progressLabel = waitingSectionType
    ? `${sectionLabels[waitingSectionType]} · 准备中`
    : current
      ? sectionLabels[current.type as QuestionType]
      : '题目';
  const waitingSectionError = waitingSectionType ? sectionErrors[waitingSectionType] : undefined;
  const getSectionStatusText = (status: SectionStatus, count: number) => {
    switch (status) {
      case 'ready':
        return `${count} 题已就绪`;
      case 'generating':
        return '生成中...';
      case 'pending':
        return '等待上一大题';
      case 'error':
        return '生成失败';
      default:
        return '';
    }
  };

  const handleNext = async () => {
    if (!selected || !current || pendingAdvance) return;
    const elapsedMs = Date.now() - questionStart;
    const answer: AnswerRecord = {
      questionId: current.id,
      choiceId: selected,
      correct: selected === current.correctChoiceId,
      elapsedMs,
    };

    recordAnswer(answer);
    const nextAnswers = [...answersRef.current, answer];
    answersRef.current = nextAnswers;
    const hasMoreQuestions = index < queue.length - 1;

    if (hasMoreQuestions) {
      setSelected(null);
      setQuestionStart(Date.now());
      setIndex((prev) => prev + 1);
      return;
    }

    if (!allSectionsReady) {
      setPendingAdvance(true);
      setSelected(null);
      setError('');
      return;
    }

    await finalize(nextAnswers);
  };

  const finalize = async (answers: AnswerRecord[]) => {
    setSubmitting(true);
    setError('');
    try {
      const correct = answers.filter((a) => a.correct).length;
      const score = Math.round((correct / answers.length) * 100);
      const analysis = await requestAnalysis({
        difficulty: superJson.metadata.difficulty,
        words,
        answers,
        superJson,
        score,
      });

      const incorrectWords = answers
        .filter((a) => !a.correct)
        .map((a) => questionMap[a.questionId]?.word)
        .filter(Boolean) as string[];

      let snapshot: SessionSnapshot | undefined;
      if (mode === 'guest') {
        snapshot = saveGuestSession({
          difficulty: superJson.metadata.difficulty,
          words,
          score,
          analysis,
          superJson,
          answers,
        });
      } else {
        snapshot = await saveAuthenticatedSession({
          difficulty: superJson.metadata.difficulty,
          words,
          score,
          analysis,
          superJson,
          answers,
        });
      }

      setLastResult({
        score,
        analysis,
        incorrectWords,
        snapshot,
      });
      navigate('/practice/report');
    } catch (err) {
      setError(getErrorMessage(err, '生成报告失败，请稍后再试'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (type: QuestionType) => {
    if (!sessionId) return;
    setRetryingSection(type);
    setError('');
    try {
      const snapshot = await retryGenerationSection(sessionId, type);
      applySessionSnapshot(snapshot);
    } catch (err) {
      setError(getErrorMessage(err, '重试失败，请稍后再试'));
    } finally {
      setRetryingSection(null);
    }
  };

  return (
    <div className="quiz-shell">
      <div className="quiz-progress">
        <div className="progress-header">
          <p className="progress-label">{progressLabel}</p>
          <p className="progress-count">
            第 {progressCurrent} / {totalTarget} 题
          </p>
        </div>
        <div className="progress-track">
          <div className="progress-thumb" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="section-capsule-row">
          {sectionStates.map((section) => {
            const statusText =
              section.status === 'error'
                ? section.error ?? '生成失败'
                : getSectionStatusText(section.status, section.count);
            const canRetry = section.status === 'error' && section.type !== 'questions_type_1' && !!sessionId;
            return (
              <div key={section.type} className={`section-status section-${section.status} section-capsule`}>
                <div>
                  <strong className="capsule-title">{section.label}</strong>
                  <p className="section-status-text capsule-status">{statusText}</p>
                </div>
                {canRetry && (
                  <button
                    type="button"
                    className="secondary capsule-retry"
                    onClick={() => handleRetry(section.type)}
                    disabled={retryingSection === section.type}
                  >
                    {retryingSection === section.type ? '重试中...' : '重新生成'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {pollError && <p className="form-error subtle">{pollError}</p>}
      </div>

      <div className="panel question-card">
        {pendingAdvance && waitingSectionType ? (
          <div className="waiting-section">
            <h3>{sectionLabels[waitingSectionType]} 正在准备</h3>
            <p>系统正在生成下一大题，请稍候 5-10 秒。</p>
            {waitingSectionError && <p className="form-error">{waitingSectionError}</p>}
            {waitingSectionError && sessionId && waitingSectionType !== 'questions_type_1' && (
              <button
                type="button"
                className="secondary"
                onClick={() => handleRetry(waitingSectionType)}
                disabled={retryingSection === waitingSectionType}
              >
                {retryingSection === waitingSectionType ? '重试中...' : '重新生成'}
              </button>
            )}
          </div>
        ) : current ? (
          <>
            <h3>{current.prompt}</h3>
            {current.sentence && (
              <p className="sentence">
                {sentenceParts
                  ? sentenceParts.map((part, idx) =>
                      part.type === 'blank' ? (
                        <span
                          key={`blank-${idx}`}
                          className="answer-blank"
                          style={{ width: `${part.length}ch` }}
                          aria-label="填空"
                        />
                      ) : (
                        <span key={`text-${idx}`}>{part.value}</span>
                      ),
                    )
                  : current.sentence}
                {current.translation && <span>（{current.translation}）</span>}
              </p>
            )}
            {current.hint && (
              <div className="hint-toggle">
                <button
                  type="button"
                  className={`pill-toggle ${isHintOpen ? 'open' : ''}`}
                  onClick={() => setIsHintOpen((prev) => !prev)}
                  aria-expanded={isHintOpen}
                  aria-controls={`hint-${current.id}`}
                >
                  <span>{isHintOpen ? '收起提示' : '查看提示'}</span>
                  <svg
                    className={`pill-toggle-icon ${isHintOpen ? 'rotated' : ''}`}
                    viewBox="0 0 24 24"
                    role="presentation"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isHintOpen && (
                  <p className="hint" id={`hint-${current.id}`}>
                    提示：{current.hint}
                  </p>
                )}
              </div>
            )}

            <div className="choices">
              {currentChoices.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  className={selected === choice.id ? 'choice selected' : 'choice'}
                  onClick={() => setSelected(choice.id)}
                  disabled={submitting || pendingAdvance}
                >
                  {choice.text}
                </button>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="primary"
              disabled={!selected || submitting || pendingAdvance}
              onClick={handleNext}
            >
              {index === queue.length - 1 && allSectionsReady ? '完成' : '下一题'}
            </button>
          </>
        ) : (
          <div className="waiting-section">
            <h3>题库准备中...</h3>
            <p>正在同步最新题目，请稍候。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
