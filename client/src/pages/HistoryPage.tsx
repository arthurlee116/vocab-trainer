import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { History, Clock, CheckCircle, Trash2, BookOpen } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchAuthenticatedHistory } from '../lib/api';
import { loadGuestHistory } from '../lib/storage';
import { deleteSession, getSessionForResume } from '../lib/progressService';
import { getErrorMessage } from '../lib/errors';
import type { SessionSnapshot, DifficultyLevel } from '../types';

const difficultyLabels: Record<DifficultyLevel, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

const HistoryPage = () => {
  const mode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();
  const resumeSession = usePracticeStore((state) => state.resumeSession);
  const setLastResult = usePracticeStore((state) => state.setLastResult);
  
  const [records, setRecords] = useState<SessionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Vocab details resume choice state (Requirements 5.1, 5.2)
  const [vocabChoiceSession, setVocabChoiceSession] = useState<SessionSnapshot | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'guest') {
        setRecords(loadGuestHistory());
      } else {
        const data = await fetchAuthenticatedHistory();
        setRecords(data);
      }
    } catch (err) {
      setError(getErrorMessage(err, '无法加载历史记录'));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  // Handle click on session item (Requirements 5.3, 5.4)
  const handleSessionClick = useCallback(async (record: SessionSnapshot) => {
    if (record.status === 'in_progress') {
      // In-progress: check for vocab details (Requirements 5.1, 5.2, 5.3)
      try {
        const session = await getSessionForResume(record.id);
        // If session has vocab details, show choice dialog (Requirements 5.1, 5.2)
        if (session.hasVocabDetails && session.vocabDetails?.length) {
          setVocabChoiceSession(session);
        } else {
          // No vocab details: navigate directly to QuizPage (Requirements 5.3)
          resumeSession(session);
          navigate('/practice/quiz');
        }
      } catch (err) {
        setError(getErrorMessage(err, '加载会话失败'));
      }
    } else {
      // Completed: navigate to ReportPage (Requirements 5.4)
      setLastResult({
        score: record.score,
        analysis: record.analysis,
        incorrectWords: [],
        snapshot: record,
      });
      navigate('/practice/report');
    }
  }, [resumeSession, setLastResult, navigate]);

  // Handle vocab details choice: view details first (Requirements 5.2)
  const handleViewVocabDetails = useCallback(() => {
    if (!vocabChoiceSession) return;
    resumeSession(vocabChoiceSession);
    setVocabChoiceSession(null);
    navigate('/practice/details');
  }, [vocabChoiceSession, resumeSession, navigate]);

  // Handle vocab details choice: skip to quiz directly (Requirements 5.3)
  const handleSkipToQuiz = useCallback(() => {
    if (!vocabChoiceSession) return;
    resumeSession(vocabChoiceSession);
    setVocabChoiceSession(null);
    navigate('/practice/quiz');
  }, [vocabChoiceSession, resumeSession, navigate]);

  // Cancel vocab choice dialog
  const handleCancelVocabChoice = useCallback(() => {
    setVocabChoiceSession(null);
  }, []);

  // Handle delete session (Requirements 4.4)
  const handleDelete = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering session click
    
    if (confirmDeleteId !== sessionId) {
      setConfirmDeleteId(sessionId);
      return;
    }
    
    try {
      setDeletingId(sessionId);
      await deleteSession(sessionId);
      setRecords((prev) => prev.filter((r) => r.id !== sessionId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(getErrorMessage(err, '删除失败'));
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteId]);

  // Cancel delete confirmation
  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }, []);

  if (loading) {
    return <div className="page-section">加载中...</div>;
  }

  return (
    <div className="page-section">
      {/* Vocab details choice dialog (Requirements 5.1, 5.2) */}
      {vocabChoiceSession && (
        <div className="modal-overlay" onClick={handleCancelVocabChoice}>
          <div className="modal-content vocab-choice-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <BookOpen size={20} className="inline-icon" />
              此会话包含词汇详情
            </h3>
            <p>您可以先查看词汇详情，或直接继续练习。</p>
            <div className="vocab-choice-actions">
              <button type="button" className="secondary" onClick={handleViewVocabDetails}>
                <BookOpen size={16} />
                查看词汇详情
              </button>
              <button type="button" className="primary" onClick={handleSkipToQuiz}>
                直接继续练习
              </button>
            </div>
            <button
              type="button"
              className="ghost small modal-close"
              onClick={handleCancelVocabChoice}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="panel">
        <h2>
          <History size={24} className="page-title-icon" />
          历史记录
        </h2>
        {error && <p className="form-error">{error}</p>}
        {!records.length && <p>暂无记录</p>}
        <div className="history-list">
          {records.map((record) => {
            const isInProgress = record.status === 'in_progress';
            const totalQuestions = record.superJson?.metadata?.totalQuestions ?? 0;
            const answeredCount = record.answers?.length ?? 0;
            
            return (
              <article
                key={record.id}
                className={`history-item history-item-clickable ${isInProgress ? 'history-item-in-progress' : ''}`}
                onClick={() => handleSessionClick(record)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSessionClick(record);
                  }
                }}
              >
                <header>
                  <h3>
                    {/* Status-based icon rendering (Requirements 5.1) */}
                    {isInProgress ? (
                      <Clock size={18} className="inline-icon status-icon-in-progress" />
                    ) : (
                      <CheckCircle size={18} className="inline-icon status-icon-completed" />
                    )}
                    {/* Status-based info display (Requirements 5.2) */}
                    {isInProgress ? (
                      <span>已做 {answeredCount}/{totalQuestions} 题</span>
                    ) : (
                      <span>{Math.round(record.score)} 分</span>
                    )}
                    <span className="history-difficulty"> · {difficultyLabels[record.difficulty]}</span>
                    {/* Vocab details badge (Requirements 4.3) */}
                    {record.hasVocabDetails && (
                      <span className="history-vocab-badge" title="含词汇详情">
                        <BookOpen size={14} className="inline-icon" />
                        词典
                      </span>
                    )}
                  </h3>
                  <div className="history-item-actions">
                    <span className="history-time">
                      <Clock size={14} className="inline-icon" />
                      {dayjs(record.updatedAt || record.createdAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                    {/* Delete button (Requirements 4.4) */}
                    {confirmDeleteId === record.id ? (
                      <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
                        <span className="delete-confirm-text">确定删除？</span>
                        <button
                          type="button"
                          className="danger small"
                          onClick={(e) => handleDelete(record.id, e)}
                          disabled={deletingId === record.id}
                        >
                          {deletingId === record.id ? '删除中...' : '确定'}
                        </button>
                        <button
                          type="button"
                          className="ghost small"
                          onClick={handleCancelDelete}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ghost small icon-only delete-btn"
                        onClick={(e) => handleDelete(record.id, e)}
                        aria-label="删除记录"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </header>
                {/* Show analysis only for completed sessions */}
                {!isInProgress && record.analysis && (
                  <>
                    <p>{record.analysis.report}</p>
                    {record.analysis.recommendations?.length > 0 && (
                      <ul>
                        {record.analysis.recommendations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {/* Show progress hint for in-progress sessions */}
                {isInProgress && (
                  <p className="history-continue-hint">点击继续练习 →</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
