import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AnswerRecord, QuestionType, SessionSnapshot, SuperQuestion } from '../types';
import { requestAnalysis, retryGenerationSection, saveAuthenticatedSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { saveGuestSession } from '../lib/storage';
import { buildSentenceParts } from '../lib/sentenceMask';
import { matchAnswer, generateFirstLetterHint } from '../lib/answerMatch';
import { useGenerationPolling } from '../hooks/useGenerationPolling';
import SectionProgressCapsules from '../components/SectionProgressCapsules';
import { SECTION_LABELS, SECTION_ORDER } from '../constants/sections';

const QuizPage = () => {
  const superJson = usePracticeStore((state) => state.superJson);
  const difficulty = usePracticeStore((state) => state.difficulty);
  const recordAnswer = usePracticeStore((state) => state.recordAnswer);
  const words = usePracticeStore((state) => state.words);
  const setLastResult = usePracticeStore((state) => state.setLastResult);
  const sessionId = usePracticeStore((state) => state.sessionId);
  const sectionStatus = usePracticeStore((state) => state.sectionStatus);
  const sectionErrors = usePracticeStore((state) => state.sectionErrors);
  const estimatedTotalQuestions = usePracticeStore((state) => state.estimatedTotalQuestions);
  const applySessionSnapshot = usePracticeStore((state) => state.applySessionSnapshot);
  const mode = useAuthStore((state) => state.mode);
  // Retry mode state
  const isRetryMode = usePracticeStore((state) => state.isRetryMode);
  const retryQuestions = usePracticeStore((state) => state.retryQuestions);
  const recordRetryAnswer = usePracticeStore((state) => state.recordRetryAnswer);
  const setRetryResult = usePracticeStore((state) => state.setRetryResult);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [textInput, setTextInput] = useState(''); // 第三大题填空输入
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef<AnswerRecord[]>([]);
  const [error, setError] = useState('');
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [retryingSection, setRetryingSection] = useState<QuestionType | null>(null);
  const [isHintOpen, setIsHintOpen] = useState(false);
  const { pollError } = useGenerationPolling();

  // 过滤掉旧版第三大题（没有 correctAnswer 字段的）
  // 重练模式下使用 retryQuestions，否则使用 superJson 队列
  const queue = useMemo(() => {
    if (isRetryMode) {
      return retryQuestions;
    }
    if (!superJson) return [];
    const type3Questions = superJson.questions_type_3.filter((q) => !!q.correctAnswer);
    return [
      ...superJson.questions_type_1,
      ...superJson.questions_type_2,
      ...type3Questions,
    ];
  }, [superJson, isRetryMode, retryQuestions]);

  const questionMap = useMemo(() => {
    const map: Record<string, SuperQuestion> = {};
    queue.forEach((q) => {
      map[q.id] = q;
    });
    return map;
  }, [queue]);

  // 重练模式下所有题目已就绪，无需等待
  const allSectionsReady = isRetryMode || SECTION_ORDER.every((type) => sectionStatus[type] === 'ready');
  // 重练模式下使用 retryQuestions 长度作为总题数
  const totalTarget = isRetryMode
    ? retryQuestions.length
    : Math.max(estimatedTotalQuestions ?? superJson?.metadata.totalQuestions ?? queue.length, 1);


  useEffect(() => {
    if (!pendingAdvance) {
      return;
    }
    if (index < queue.length - 1) {
      setPendingAdvance(false);
      setSelected(null);
      setTextInput('');
      setQuestionStart(Date.now());
      setIndex((prev) => prev + 1);
    }
  }, [pendingAdvance, queue.length, index]);

  const current = queue[index];
  const currentId = current?.id;
  const isType3 = current?.type === 'questions_type_3';
  const sentenceHasProvidedBlank = current?.sentence?.includes('_____') ?? false;
  const correctChoiceText = current?.choices?.find((choice) => choice.id === current.correctChoiceId)?.text;
  // 当为第二大题（看英文选中文）时，使用 question.word 作为匹配来源用来高亮句子中的短语
  const matchSourceText = current?.type === 'questions_type_2' ? current?.word : correctChoiceText;
  // 对于第二大题我们不遵循已存在的 "_____" 遮挡逻辑（不做遮挡，只做高亮），其余题型仍需忽略已有的下划线句子
  // 第三大题使用 correctAnswer 作为遮挡匹配源
  const canProcessSentence = Boolean(
    current?.sentence &&
      (current?.type === 'questions_type_2' || (!sentenceHasProvidedBlank && !isType3)) &&
      matchSourceText,
  );
  const sentenceMaskResult = canProcessSentence && current?.sentence && matchSourceText
    ? buildSentenceParts(current.sentence, matchSourceText)
    : null;
  const sentenceParts = sentenceMaskResult?.parts ?? null;
  const matchedSentenceVariant = sentenceMaskResult?.matchedVariant;
  const currentChoices = useMemo(() => {
    if (!current || !current.choices) return [];
    // 对于第二大题（看英文选中文）不要把选项替换成句子变体 — 选项必须保持为中文
    if (current.type === 'questions_type_2') return current.choices;
    if (!matchedSentenceVariant || !correctChoiceText) return current.choices;
    return current.choices.map((choice) =>
      choice.id === current.correctChoiceId
        ? { ...choice, text: matchedSentenceVariant }
        : choice,
    );
  }, [current, matchedSentenceVariant, correctChoiceText]);

  // 第三大题首字母提示（beginner/intermediate 显示，advanced 不显示）
  const type3Hint = useMemo(() => {
    if (!isType3 || !current?.correctAnswer) return null;
    if (difficulty === 'advanced') return '_____';
    return generateFirstLetterHint(current.correctAnswer);
  }, [isType3, current?.correctAnswer, difficulty]);

  useEffect(() => {
    setIsHintOpen(false);
    setTextInput(''); // 切换题目时清空填空输入
  }, [currentId]);

  // 重练模式下不需要 superJson，只需要 retryQuestions
  if (!isRetryMode && !superJson) {
    return null;
  }
  const progressCurrent = Math.min(index + 1, totalTarget);
  const progressPercent = Math.min((progressCurrent / totalTarget) * 100, 100);
  // 重练模式下不需要 sectionQuestions，使用空数组
  const sectionQuestions: Record<QuestionType, SuperQuestion[]> = isRetryMode
    ? { questions_type_1: [], questions_type_2: [], questions_type_3: [] }
    : {
        questions_type_1: superJson!.questions_type_1,
        questions_type_2: superJson!.questions_type_2,
        questions_type_3: superJson!.questions_type_3,
      };
  const currentSectionType = current?.type as QuestionType | undefined;
  const nextBlockedSection = currentSectionType
    ? SECTION_ORDER.slice(SECTION_ORDER.indexOf(currentSectionType) + 1).find((type) => sectionStatus[type] !== 'ready')
    : SECTION_ORDER.find((type) => sectionStatus[type] !== 'ready');
  const waitingSectionType = pendingAdvance
    ? nextBlockedSection ?? SECTION_ORDER.find((type) => sectionStatus[type] !== 'ready')
    : undefined;
  const sectionStates = SECTION_ORDER.map((type) => ({
    type,
    label: SECTION_LABELS[type],
    status: sectionStatus[type],
    error: sectionErrors[type],
    count: sectionQuestions[type].length,
    canRetry: type !== 'questions_type_1' && !!sessionId,
  }));
  const progressLabel = isRetryMode
    ? '错题重练'
    : waitingSectionType
      ? `${SECTION_LABELS[waitingSectionType]} · 准备中`
      : current
        ? SECTION_LABELS[current.type as QuestionType]
        : '题目';
  const waitingSectionError = waitingSectionType ? sectionErrors[waitingSectionType] : undefined;

  // 判断当前题目是否可以提交
  const canSubmit = isType3
    ? textInput.trim().length > 0
    : selected !== null;

  const handleNext = async () => {
    if (!current || pendingAdvance) return;

    const elapsedMs = Date.now() - questionStart;
    let answer: AnswerRecord;

    if (isType3) {
      // 第三大题：填空题
      if (!textInput.trim()) return;
      const isCorrect = matchAnswer(textInput, current.correctAnswer ?? '');
      answer = {
        questionId: current.id,
        userInput: textInput.trim(),
        correct: isCorrect,
        elapsedMs,
      };
    } else {
      // 第一、二大题：选择题
      if (!selected) return;
      answer = {
        questionId: current.id,
        choiceId: selected,
        correct: selected === current.correctChoiceId,
        elapsedMs,
      };
    }

    // 重练模式下使用 recordRetryAnswer，否则使用 recordAnswer
    if (isRetryMode) {
      recordRetryAnswer(answer);
    } else {
      recordAnswer(answer);
    }
    const nextAnswers = [...answersRef.current, answer];
    answersRef.current = nextAnswers;
    const hasMoreQuestions = index < queue.length - 1;

    if (hasMoreQuestions) {
      setSelected(null);
      setTextInput('');
      setQuestionStart(Date.now());
      setIndex((prev) => prev + 1);
      return;
    }

    if (!allSectionsReady) {
      setPendingAdvance(true);
      setSelected(null);
      setTextInput('');
      setError('');
      return;
    }

    // 重练模式下使用 finalizeRetry，否则使用 finalize
    if (isRetryMode) {
      await finalizeRetry(nextAnswers);
    } else {
      await finalize(nextAnswers);
    }
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

  // 重练模式完成处理：不调用 API，直接计算结果
  const finalizeRetry = async (answers: AnswerRecord[]) => {
    setSubmitting(true);
    setError('');
    try {
      const correct = answers.filter((a) => a.correct).length;
      const score = Math.round((correct / answers.length) * 100);

      const incorrectWords = answers
        .filter((a) => !a.correct)
        .map((a) => questionMap[a.questionId]?.word)
        .filter(Boolean) as string[];

      // 重练模式不调用 API，生成简单的分析结果
      const analysis = {
        report: score === 100
          ? '恭喜！错题已全部掌握。'
          : `本轮重练得分 ${score} 分，还有 ${incorrectWords.length} 个词汇需要继续练习。`,
        recommendations: incorrectWords.length > 0
          ? [`继续练习以下词汇：${incorrectWords.join('、')}`]
          : ['所有错题已掌握，可以返回原报告查看完整分析。'],
      };

      setRetryResult({
        score,
        analysis,
        incorrectWords,
        snapshot: undefined, // 重练不保存 session
      });
      navigate('/practice/report');
    } catch (err) {
      setError(getErrorMessage(err, '处理重练结果失败'));
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
        {/* 重练模式下不显示大题进度胶囊 */}
        {!isRetryMode && (
          <SectionProgressCapsules
            sections={sectionStates}
            onRetry={sessionId ? handleRetry : undefined}
            retryingSection={retryingSection}
          />
        )}
        {pollError && !isRetryMode && <p className="form-error subtle">{pollError}</p>}
      </div>

      <div className="panel question-card">
        {pendingAdvance && waitingSectionType ? (
          <div className="waiting-section">
            <h3>{SECTION_LABELS[waitingSectionType]} 正在准备</h3>
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
            {/* 第二大题不应该在头部重复展示被测短语 —— 使用通用标题并把短语高亮在句子里 */}
            <h3>{current.type === 'questions_type_2' ? SECTION_LABELS.questions_type_2 : current.prompt}</h3>
            {current.sentence && (
              <p className="sentence">
                {isType3 ? (
                  // 第三大题：直接显示句子（已包含 _____），用首字母提示替换空白
                  <>
                    {current.sentence.replace('_____', type3Hint ?? '_____')}
                    {current.translation && <span>（{current.translation}）</span>}
                  </>
                ) : sentenceParts ? (
                  sentenceParts.map((part, idx) =>
                    part.type === 'blank' ? (
                      // 第二大题只高亮目标短语，不遮挡；其他题型仍使用遮挡表现
                      current.type === 'questions_type_2' ? (
                        <strong key={`bl-hl-${idx}`} className="sentence-highlight">
                          {matchedSentenceVariant}
                        </strong>
                      ) : (
                        <span
                          key={`blank-${idx}`}
                          className="answer-blank"
                          style={{ width: `${part.length}ch` }}
                          aria-label="填空"
                        />
                      )
                    ) : (
                      <span key={`text-${idx}`}>{part.value}</span>
                    ),
                  )
                ) : (
                  <>{current.sentence}</>
                )}
                {!isType3 && current.translation && <span>（{current.translation}）</span>}
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

            {isType3 ? (
              // 第三大题：填空输入框
              <div className="fill-blank-input">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit && !submitting && !pendingAdvance) {
                      handleNext();
                    }
                  }}
                  placeholder="请输入答案..."
                  disabled={submitting || pendingAdvance}
                  autoFocus
                  className="text-input"
                />
              </div>
            ) : (
              // 第一、二大题：选择按钮
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
            )}
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="primary"
              disabled={!canSubmit || submitting || pendingAdvance}
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
