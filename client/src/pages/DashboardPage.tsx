import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trophy, BarChart3, Clock, Loader2, AlertCircle, TrendingUp, Calendar } from 'lucide-react';
import { usePracticeStore } from '../store/usePracticeStore';
import { useAuthStore } from '../store/useAuthStore';
import { getInProgressSessions, getSessionForResume, deleteSession } from '../lib/progressService';
import { fetchLearningStats } from '../lib/api';
import InProgressSessionCard from '../components/InProgressSessionCard';
import type { InProgressSessionSummary, StatsResponse } from '../types';

const DashboardPage = () => {
  const navigate = useNavigate();
  const resetSession = usePracticeStore((state) => state.resetSession);
  const resumeSession = usePracticeStore((state) => state.resumeSession);
  const lastResult = usePracticeStore((state) => state.lastResult);
  const authMode = useAuthStore((state) => state.mode);

  // In-progress sessions state (Requirements 4.1)
  const [inProgressSessions, setInProgressSessions] = useState<InProgressSessionSummary[]>([]);
  const [loadingInProgress, setLoadingInProgress] = useState(true);
  const [inProgressError, setInProgressError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Learning statistics state
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch in-progress sessions on mount (Requirements 4.1)
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoadingInProgress(true);
        setInProgressError(null);
        const sessions = await getInProgressSessions();
        setInProgressSessions(sessions);
      } catch (err) {
        setInProgressError(err instanceof Error ? err.message : '加载进行中的练习失败');
      } finally {
        setLoadingInProgress(false);
      }
    };
    fetchSessions();
  }, []);

  // Fetch learning statistics on mount (only for authenticated users)
  useEffect(() => {
    if (authMode === 'authenticated') {
      const fetchStats = async () => {
        try {
          setLoadingStats(true);
          setStatsError(null);
          const statsData = await fetchLearningStats();
          setStats(statsData);
        } catch (err) {
          setStatsError(err instanceof Error ? err.message : '加载学习统计失败');
        } finally {
          setLoadingStats(false);
        }
      };
      fetchStats();
    } else {
      setLoadingStats(false);
    }
  }, [authMode]);

  const handleStart = () => {
    resetSession();
    navigate('/practice/upload');
  };

  // Handle continue session (Requirements 4.3, 3.3)
  const handleContinue = useCallback(async (sessionId: string) => {
    try {
      const session = await getSessionForResume(sessionId);
      resumeSession(session);
      navigate('/practice/quiz');
    } catch (err) {
      setInProgressError(err instanceof Error ? err.message : '加载会话失败');
    }
  }, [resumeSession, navigate]);

  // Handle delete session (Requirements 4.4)
  const handleDelete = useCallback(async (sessionId: string) => {
    try {
      setDeletingSessionId(sessionId);
      await deleteSession(sessionId);
      setInProgressSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setInProgressError(err instanceof Error ? err.message : '删除会话失败');
    } finally {
      setDeletingSessionId(null);
    }
  }, []);

  // Helper function to format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Helper function to get weekday name
  const getWeekdayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  };

  return (
    <div className="page-section">
      {/* Learning Statistics Panel (only for authenticated users) */}
      {authMode === 'authenticated' && (
        <div className="stats-panel">
          <h2>
            <TrendingUp size={20} />
            学习进度统计
          </h2>
          
          {loadingStats && (
            <div className="stats-loading">
              <Loader2 size={20} className="spin" />
              <span>加载统计数据中...</span>
            </div>
          )}

          {statsError && (
            <div className="stats-error">
              <AlertCircle size={18} />
              <span>{statsError}</span>
            </div>
          )}

          {!loadingStats && !statsError && stats && (
            <>
              {/* Stats Cards */}
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-icon">
                    <BookOpen size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.totalWordsLearned.toLocaleString()}</div>
                    <div className="stat-label">学习单词数</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <Trophy size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.totalSessionsCompleted.toLocaleString()}</div>
                    <div className="stat-label">完成练习数</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <Calendar size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">
                      {stats.weeklyActivity.reduce((sum, day) => sum + day.count, 0)}
                    </div>
                    <div className="stat-label">本周练习数</div>
                  </div>
                </div>
              </div>

              {/* Weekly Activity Chart */}
              <div className="weekly-activity">
                <h3>最近7天活动</h3>
                <div className="chart-container">
                  <div className="chart-bars">
                    {stats.weeklyActivity.map((day) => {
                      const maxCount = Math.max(...stats.weeklyActivity.map(d => d.count), 1);
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      
                      return (
                        <div key={day.date} className="chart-bar-wrapper">
                          <div 
                            className="chart-bar"
                            style={{ height: `${height}%` }}
                            title={`${getWeekdayName(day.date)} (${formatDate(day.date)}): ${day.count} 次练习`}
                          >
                            {day.count > 0 && (
                              <div className="chart-bar-value">{day.count}</div>
                            )}
                          </div>
                          <div className="chart-label">
                            <div className="chart-weekday">{getWeekdayName(day.date)}</div>
                            <div className="chart-date">{formatDate(day.date)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="panel hero">
        <div>
          <p className="eyebrow">流程</p>
          <h2>上传词表 → 选择难度 → 题流练习 → AI 分析</h2>
          <p>一次训练约 60 题，完成后生成 100 字中文分析。错题可一键强化。</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary" onClick={handleStart}>
            <Plus size={20} />
            开始新的练习
          </button>
          <button type="button" className="ghost" onClick={() => navigate('/history')}>
            <BookOpen size={18} />
            查看历史记录
          </button>
        </div>
      </div>

      {/* In-Progress Sessions Section (Requirements 4.1, 4.2) */}
      {!loadingInProgress && (
        <div className="in-progress-section">
          <h2>
            <Clock size={20} />
            继续练习
          </h2>
          {inProgressSessions.length > 0 ? (
            <div className="in-progress-grid">
              {inProgressSessions.map((session) => (
                <InProgressSessionCard
                  key={session.id}
                  session={session}
                  onContinue={handleContinue}
                  onDelete={handleDelete}
                  isDeleting={deletingSessionId === session.id}
                />
              ))}
            </div>
          ) : (
            <div className="in-progress-empty">
              <p>暂无进行中的练习</p>
              <p className="hint">做题时点击"暂停"按钮可保存进度，稍后继续</p>
            </div>
          )}
        </div>
      )}

      {loadingInProgress && (
        <div className="in-progress-loading">
          <Loader2 size={20} className="spin" />
          <span>加载中...</span>
        </div>
      )}

      {inProgressError && (
        <div className="in-progress-error">
          <AlertCircle size={18} />
          <span>{inProgressError}</span>
        </div>
      )}

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
              <BarChart3 size={18} />
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
