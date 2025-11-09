import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trophy, BarChart3 } from 'lucide-react';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';

const DashboardPage = () => {
  const navigate = useNavigate();
  const resetSession = usePracticeStore((state) => state.resetSession);
  const lastResult = usePracticeStore((state) => state.lastResult);
  const authMode = useAuthStore((state) => state.mode);

  const handleStart = () => {
    resetSession();
    navigate('/practice/upload');
  };

  return (
    <div className="page-section">
      <div className="panel hero">
        <div>
          <p className="eyebrow">流程</p>
          <h2>上传词表 → 选择难度 → 题流练习 → AI 分析</h2>
          <p>一次训练约 60 题，完成后生成 100 字中文分析。错题可一键强化。</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary" onClick={handleStart}>
            <Plus size={20} className="btn-icon" />
            开始新的练习
          </button>
          <button type="button" className="ghost" onClick={() => navigate('/history')}>
            <BookOpen size={18} className="btn-icon" />
            查看历史记录
          </button>
        </div>
      </div>

      {authMode === 'guest' && (
        <div className="panel warning">
          完成练习后可在报告页注册/登录，以永久保存记录。
        </div>
      )}

      {lastResult && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">最近一次练习</p>
              <h3>
                <Trophy size={24} className="score-icon" />
                {Math.round(lastResult.score)} 分
              </h3>
            </div>
            <button type="button" className="text-button" onClick={() => navigate('/practice/report')}>
              <BarChart3 size={18} className="btn-icon" />
              回看报告
            </button>
          </div>
          <p>{lastResult.analysis.report}</p>
          <ul className="recommendations">
            {lastResult.analysis.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
