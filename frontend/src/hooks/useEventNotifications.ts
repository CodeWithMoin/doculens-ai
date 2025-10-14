import { useEffect, useRef } from 'react';

import { fetchQaHistory, fetchSearchHistory } from '../api/client';
import type { QAHistoryEntry, SearchHistoryEntry } from '../api/types';
import { useNotificationStore } from '../stores/notificationStore';

const HISTORY_LIMIT = 10;
const POLL_INTERVAL_MS = 15_000;

export function useEventNotifications() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const initializedRef = useRef(false);
  const seenQaIds = useRef(new Set<string>());
  const seenSearchIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const [qaHistory, searchHistory] = await Promise.allSettled([
          fetchQaHistory(HISTORY_LIMIT),
          fetchSearchHistory(HISTORY_LIMIT),
        ]);

        if (pollSettled(qaHistory) && !cancelled) {
          processQaHistory(qaHistory.value);
        }
        if (pollSettled(searchHistory) && !cancelled) {
          processSearchHistory(searchHistory.value);
        }
      } catch (err) {
        console.error('Event notification poll failed', err);
      }
    };

    const processQaHistory = (entries: QAHistoryEntry[]) => {
      entries.forEach((entry) => {
        if (!initializedRef.current) {
          seenQaIds.current.add(entry.event_id);
          return;
        }

        if (!seenQaIds.current.has(entry.event_id)) {
          seenQaIds.current.add(entry.event_id);
          addNotification({
            title: 'QA answer ready',
            description: entry.answer ? `${entry.answer.slice(0, 80)}…` : entry.query,
            variant: 'success',
            href: '/qa',
          });
        }
      });
    };

    const processSearchHistory = (entries: SearchHistoryEntry[]) => {
      entries.forEach((entry) => {
        if (!initializedRef.current) {
          seenSearchIds.current.add(entry.event_id);
          return;
        }

        if (!seenSearchIds.current.has(entry.event_id)) {
          seenSearchIds.current.add(entry.event_id);
          addNotification({
            title: 'Search results updated',
            description: `${entry.query} (${entry.result_count} results)`,
            variant: 'info',
            href: '/qa',
          });
        }
      });
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const trigger = () => {
      void poll().then(() => {
        initializedRef.current = true;
      });
    };
    trigger();

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        trigger();
      }
    };
    window.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [addNotification]);
}

function pollSettled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}
