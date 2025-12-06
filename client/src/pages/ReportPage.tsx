import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import WrongAnswerList from '../components/WrongAnswerList';
import { extractWrongAnswers, getRetryQuestions } from '../lib/wrongAnswers';

const ReportPage = () => {
  const {
    lastResult,
    setWords,
    superJson,
    answers,
    isRetryMode,
    retryQuestions,
    retryAnswers,
    startRetryPractice,
    exitRetryMode,
  } = usePracticeStore();
  const authMode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();

  // 提取错题列表
  const wrongAnswerItems = useMemo(() => {
    if (isRetryMode) {
      // 重练模式：从 retryQuestions 和 retryAnswers 提取
      if (!retryQuestions.length || !retryAnswers.length) return [];
      // 构建临时 SuperJson 用于提取
      const tempSuperJson = {
        metadata: { totalQuestions: retryQuestions.length, words: [], difficulty: 'beginner' as const, generatedAt: '' },
        questions_type_1: retryQuestions.filter((q) => q.type === 'questions_type_1'),
        questions_type_2: retryQuestions.filter((q) => q.type === 'questions_type_2'),
        questions_type_3: retryQuestions.filter((q) => q.type === 'questions_type_3'),
      };
      return extractWrongAnswers(retryAnswers, tempSuperJson);
    }
    // 正常模式：从 superJson 和 answers 提取
    if (!superJson || !answers.length) return [];
    return extractWrongAnswers(answers, superJson);
  }, [isRetryMode, superJson, answers, retryQuestions, retryAnswers]);

  const hasWrongAnswers = wrongAnswerItems.length > 0;

  if (!lastResult) {
    return null;
  }

  const handleReinforce = () => {
    if (!lastResult.incorrectWords.length) {
      return;
    }
    setWords(lastResult.incorrectWords);
    navigate('/practice/confirm');
  };

  const handleRetryPractice = () => {
    if (!hasWrongAnswers) return;
    const questions = getRetryQuestions(wrongAnswerItems);
    startRetryPractice(questions);
    navigate('/practice/quiz');
  };

  const handleBackToOriginalReport = () => {
    exitRetryMode();
  };

  // 重练模式 UI
  if (isRetryMode) {
    const allCorrect = !hasWrongAnswers;
    return (
      <div className="page-section">
        <div className="panel">
          <p className="eyebrow">错题重练结果</p>
          <h1>{Math.round(lastResult.score)} 分</h1>
          {allCorrect ? (
            <p className="report-text success-message">🎉 恭喜！错题已全部掌握</p>
          ) : (
            <p className="report-text">{lastResult.analysis.report}</p>
          )}
          {!allCorrect && (
            <ul className="recommendations">
              {lastResult.analysis.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <WrongAnswerList items={wrongAnswerItems} />

        <div className="panel">
          <div className="report-actions">
            <button type="button" className="ghost" onClick={handleBackToOriginalReport}>
              返回原报告
            </button>
            {hasWrongAnswers && (
              <button type="button" className="primary" onClick={handleRetryPractice}>
                继续重练
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 正常模式 UI
  return (
    <div className="page-section">
      <div className="panel">
        <p className="eyebrow">成绩</p>
        <h1>{Math.round(lastResult.score)} 分</h1>
        <p className="report-text">{lastResult.analysis.report}</p>
        <ul className="recommendations">
          {lastResult.analysis.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <WrongAnswerList items={wrongAnswerItems} />

      <div className="panel">
        <div className="report-actions">
          <button type="button" className="primary" onClick={() => navigate('/dashboard')}>
            返回主界面
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!lastResult.incorrectWords.length}
            onClick={handleReinforce}
          >
            针对错题强化练习
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!hasWrongAnswers}
            onClick={handleRetryPractice}
            title={hasWrongAnswers ? '使用本轮错题重新练习' : '本轮全对，暂无可重练题目'}
          >
            重练错题
          </button>
        </div>
        {authMode === 'guest' && (
          <div className="panel warning">
            注册/登录以永久保存您的学习记录，随时跨设备同步。
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPage;
