/**
 * InProgressSessionCard - 显示进行中的练习会话卡片
 *
 * Requirements: 4.2, 4.3, 4.4
 */

import { useState } from 'react';
import { Clock, Play, Trash2 } from 'lucide-react';
import type { InProgressSessionSummary, DifficultyLevel } from '../types';

interface InProgressSessionCardProps {
  session: InProgressSessionSummary;
  onContinue: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  isDeleting?: boolean;
}

const difficultyLabels: Record<DifficultyLevel, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};

const difficultyColors: Record<DifficultyLevel, string> = {
  beginner: '#10b981',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

/**
 * 格式化相对时间
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

const InProgressSessionCard = ({
  session,
  onContinue,
  onDelete,
  isDeleting = false,
}: InProgressSessionCardProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(session.id);
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  const progressPercent = Math.round(
    (session.answeredCount / session.totalQuestions) * 100
  );

  return (
    <div className="in-progress-card">
      <div className="in-progress-card-header">
        <div className="in-progress-card-info">
          <span
            className="difficulty-badge"
            style={{ backgroundColor: difficultyColors[session.difficulty] }}
          >
            {difficultyLabels[session.difficulty]}
          </span>
          <span className="word-count">{session.wordCount} 词</span>
        </div>
        <div className="in-progress-card-time">
          <Clock size={14} />
          <span>{formatRelativeTime(session.updatedAt)}</span>
        </div>
      </div>

      <div className="in-progress-card-progress">
        <div className="progress-text">
          已完成 <strong>{session.answeredCount}</strong> / {session.totalQuestions} 题
          <span className="progress-percent">({progressPercent}%)</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {showConfirm ? (
        <div className="in-progress-card-confirm">
          <p>确定要删除这个练习吗？此操作不可撤销。</p>
          <div className="confirm-actions">
            <button
              type="button"
              className="ghost small"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              取消
            </button>
            <button
              type="button"
              className="danger small"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      ) : (
        <div className="in-progress-card-actions">
          <button
            type="button"
            className="primary small"
            onClick={() => onContinue(session.id)}
          >
            <Play size={16} />
            继续
          </button>
          <button
            type="button"
            className="ghost small icon-only"
            onClick={handleDeleteClick}
            aria-label="删除练习"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default InProgressSessionCard;
