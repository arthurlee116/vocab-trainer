import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';

const ReportPage = () => {
  const { lastResult, setWords } = usePracticeStore();
  const authMode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();

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
