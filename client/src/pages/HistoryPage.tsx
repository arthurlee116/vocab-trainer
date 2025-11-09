import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { History, Clock, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { fetchAuthenticatedHistory } from '../lib/api';
import { loadGuestHistory } from '../lib/storage';
import { getErrorMessage } from '../lib/errors';
import type { SessionSnapshot } from '../types';

const HistoryPage = () => {
  const mode = useAuthStore((state) => state.mode);
  const [records, setRecords] = useState<SessionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
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
    };
    void run();
  }, [mode]);

  if (loading) {
    return <div className="page-section">加载中...</div>;
  }

  return (
    <div className="page-section">
      <div className="panel">
        <h2>
          <History size={24} className="page-title-icon" />
          历史记录
        </h2>
        {error && <p className="form-error">{error}</p>}
        {!records.length && <p>暂无记录</p>}
        <div className="history-list">
          {records.map((record) => (
            <article key={record.id} className="history-item">
              <header>
                <h3>
                  <Trophy size={18} className="inline-icon" />
                  {Math.round(record.score)} 分 · {record.difficulty}
                </h3>
                <span>
                  <Clock size={16} className="inline-icon" />
                  {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                </span>
              </header>
              <p>{record.analysis.report}</p>
              <ul>
                {record.analysis.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
