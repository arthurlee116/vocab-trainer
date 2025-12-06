import { useEffect, useState } from 'react';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchGenerationSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { SECTION_ORDER } from '../constants/sections';
import { getSessionForResume } from '../lib/progressService';
import type { AxiosError } from 'axios';

/**
 * Check if an error is a 404 Not Found error
 */
const is404Error = (err: unknown): boolean => {
  if (err && typeof err === 'object') {
    const axiosError = err as AxiosError;
    return axiosError.response?.status === 404;
  }
  return false;
};

export const useGenerationPolling = () => {
  const sessionId = usePracticeStore((state) => state.sessionId);
  const historySessionId = usePracticeStore((state) => state.historySessionId);
  const sectionStatus = usePracticeStore((state) => state.sectionStatus);
  const applySessionSnapshot = usePracticeStore((state) => state.applySessionSnapshot);
  const resumeSession = usePracticeStore((state) => state.resumeSession);
  const [pollError, setPollError] = useState('');
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const allSectionsReady = SECTION_ORDER.every((type) => sectionStatus[type] === 'ready');

  useEffect(() => {
    // 新的练习会话需要重新允许一次 fallback，避免前一会话的 404 状态阻塞轮询
    setFallbackAttempted(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || allSectionsReady) {
      return undefined;
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
        
        // Handle 404 error: generation session expired (Requirement 7.1)
        // Fallback to history session if available
        if (is404Error(err) && historySessionId && !fallbackAttempted) {
          setFallbackAttempted(true);
          try {
            const historySession = await getSessionForResume(historySessionId);
            if (!active) return;
            // Resume from history session - this loads superJson from persisted data
            resumeSession(historySession);
            setPollError('');
            return; // Stop polling after successful fallback
          } catch (fallbackErr) {
            if (!active) return;
            setPollError(getErrorMessage(fallbackErr, '题库会话已过期，恢复历史记录失败'));
          }
          return; // Don't continue polling after fallback attempt
        }
        
        setPollError(getErrorMessage(err, '刷新题库状态失败，请稍后重试'));
      } finally {
        if (active && !fallbackAttempted) {
          timer = setTimeout(poll, 4000);
        }
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [sessionId, historySessionId, allSectionsReady, applySessionSnapshot, resumeSession, fallbackAttempted]);

  return { pollError };
};
