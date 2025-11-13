import { useEffect, useState } from 'react';
import { usePracticeStore } from '../store/usePracticeStore';
import { fetchGenerationSession } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { SECTION_ORDER } from '../constants/sections';

export const useGenerationPolling = () => {
  const sessionId = usePracticeStore((state) => state.sessionId);
  const sectionStatus = usePracticeStore((state) => state.sectionStatus);
  const applySessionSnapshot = usePracticeStore((state) => state.applySessionSnapshot);
  const [pollError, setPollError] = useState('');
  const allSectionsReady = SECTION_ORDER.every((type) => sectionStatus[type] === 'ready');

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
        setPollError(getErrorMessage(err, '刷新题库状态失败，请稍后重试'));
      } finally {
        if (active) {
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
  }, [sessionId, allSectionsReady, applySessionSnapshot]);

  return { pollError };
};
