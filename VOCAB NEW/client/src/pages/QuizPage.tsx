import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import type { AnswerRecord, SessionSnapshot, SuperQuestion } from '../types';
import { requestAnalysis, saveAuthenticatedSession } from '../lib/api';
import { saveGuestSession } from '../lib/storage';

const sectionLabels: Record<string, string> = {
  questions_type_1: '第一大题 · 看中文选英文',
  questions_type_2: '第二大题 · 看英文选中文',
  questions_type_3: '第三大题 · 句子填空',
};

const QuizPage = () => {
  const { superJson, recordAnswer, words, setLastResult } = usePracticeStore();
  const mode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef<AnswerRecord[]>([]);
  const [error, setError] = useState('');

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

  if (!superJson) {
    return null;
  }

  const current = queue[index];

  const handleNext = async () => {
    if (!selected) return;
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
    const isLast = index === queue.length - 1;
    if (isLast) {
      await finalize(nextAnswers);
    } else {
      setSelected(null);
      setQuestionStart(Date.now());
      setIndex((prev) => prev + 1);
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
    } catch (err: any) {
      setError(err?.response?.data?.message ?? '生成报告失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="quiz-shell">
      <div className="quiz-progress">
        <p>{sectionLabels[current.type] ?? '题目'}</p>
        <p>
          第 {index + 1} / {queue.length} 题
        </p>
        <div className="progress-track">
          <div className="progress-thumb" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
        </div>
      </div>

      <div className="panel question-card">
        <h3>{current.prompt}</h3>
        {current.sentence && (
          <p className="sentence">
            {current.sentence}
            {current.translation && <span>（{current.translation}）</span>}
          </p>
        )}
        {current.hint && <p className="hint">提示：{current.hint}</p>}

        <div className="choices">
          {current.choices.map((choice) => (
            <button
              type="button"
              key={choice.id}
              className={selected === choice.id ? 'choice selected' : 'choice'}
              onClick={() => setSelected(choice.id)}
              disabled={submitting}
            >
              {choice.text}
            </button>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="primary" disabled={!selected || submitting} onClick={handleNext}>
          {index === queue.length - 1 ? '完成' : '下一题'}
        </button>
      </div>
    </div>
  );
};

export default QuizPage;
