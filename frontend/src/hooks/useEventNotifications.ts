import { useEffect, useRef } from 'react';

import { fetchQaHistory, fetchSearchHistory } from '../api/client';
import type { QAHistoryEntry, SearchHistoryEntry } from '../api/types';
import { useNotificationStore } from '../stores/notificationStore';

const HISTORY_LIMIT = 10;
const POLL_INTERVAL_MS = 15_000;
const STORAGE_KEY_QA = 'doculens_seen_qa_ids';
const STORAGE_KEY_SEARCH = 'doculens_seen_search_ids';

function loadSeenIds(storageKey: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    }
  } catch (error) {
    console.warn(`Failed to load seen notification ids for ${storageKey}`, error);
  }
  return new Set();
}

function persistSeenIds(storageKey: string, ids: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.warn(`Failed to persist seen notification ids for ${storageKey}`, error);
  }
}

export function useEventNotifications() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const initializedRef = useRef(false);
  const seenQaIds = useRef<Set<string>>(loadSeenIds(STORAGE_KEY_QA));
  const seenSearchIds = useRef<Set<string>>(loadSeenIds(STORAGE_KEY_SEARCH));

  const rememberQaId = (id: string) => {
    if (!seenQaIds.current.has(id)) {
      seenQaIds.current.add(id);
      persistSeenIds(STORAGE_KEY_QA, seenQaIds.current);
    }
  };

  const rememberSearchId = (id: string) => {
    if (!seenSearchIds.current.has(id)) {
      seenSearchIds.current.add(id);
      persistSeenIds(STORAGE_KEY_SEARCH, seenSearchIds.current);
    }
  };

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
          rememberQaId(entry.event_id);
          return;
        }

        if (!seenQaIds.current.has(entry.event_id)) {
          rememberQaId(entry.event_id);
          const occurredAt = Date.parse(entry.created_at);
          addNotification({
            title: 'QA answer ready',
            description: entry.answer ? `${entry.answer.slice(0, 80)}…` : entry.query,
            variant: 'success',
            href: '/qa',
            timestamp: Number.isNaN(occurredAt) ? undefined : occurredAt,
          });
        }
      });
    };

    const processSearchHistory = (entries: SearchHistoryEntry[]) => {
      entries.forEach((entry) => {
        if (!initializedRef.current) {
          rememberSearchId(entry.event_id);
          return;
        }

        if (!seenSearchIds.current.has(entry.event_id)) {
          rememberSearchId(entry.event_id);
          const occurredAt = Date.parse(entry.created_at);
          addNotification({
            title: 'Search results updated',
            description: `${entry.query} (${entry.result_count} results)`,
            variant: 'info',
            href: '/qa',
            timestamp: Number.isNaN(occurredAt) ? undefined : occurredAt,
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
