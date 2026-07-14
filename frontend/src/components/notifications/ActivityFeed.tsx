import { type ComponentType, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Brain, FileText, MessageSquare, RefreshCw, Search } from 'lucide-react';

import { fetchEvents } from '../../api/client';
import type { EventEntry } from '../../api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useNotificationStore } from '../../stores/notificationStore';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  upload: FileText,
  summary: Brain,
  qa: MessageSquare,
  search: Search,
  default: Activity,
};

export function ActivityFeed({ limit = 2 }: { limit?: number }) {
  const notifications = useNotificationStore((state) => state.notifications);
  const { data: events = [], isFetching, refetch } = useQuery({
    queryKey: ['workspace-activity', limit],
    queryFn: () => fetchEvents(Math.max(limit * 3, 10)),
  });
  const activity = useMemo(() => {
    const localItems: ActivityItem[] = notifications.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      timestamp: item.timestamp,
      variant: 'default',
    }));
    const eventItems = events.map(toActivityItem).filter((item): item is ActivityItem => item !== null);
    return [...localItems, ...eventItems]
      .sort((first, second) => second.timestamp - first.timestamp)
      .slice(0, limit);
  }, [events, limit, notifications]);

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">Recent activity</CardTitle>
          <CardDescription>Recent searches, answers, summaries, and uploads.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh activity">
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Actions taken in the console will appear here.</p>
        ) : (
          activity.map((item) => {
            const Icon = iconMap[item.variant] ?? iconMap.default;
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-md border border-border/70 bg-background/70 px-3 py-2">
                <Icon className="mt-0.5 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.title}</p>
                  {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: number;
  variant: string;
}

function toActivityItem(event: EventEntry): ActivityItem | null {
  const eventType = stringValue(event.data.event_type);
  const timestamp = Date.parse(event.created_at);
  if (!eventType || Number.isNaN(timestamp)) return null;

  if (eventType === 'document_upload') {
    const metadata = objectValue(event.data.metadata);
    const filename = stringValue(metadata.uploaded_filename) ?? stringValue(event.data.filename) ?? 'Document';
    return {
      id: event.id,
      title: 'Document indexed',
      description: filename.split('/').pop(),
      timestamp,
      variant: 'upload',
    };
  }

  if (eventType === 'document_summary') {
    const context = objectValue(event.task_context);
    const metadata = objectValue(context.metadata);
    const summaries = objectValue(metadata.document_summaries);
    const firstSummary = objectValue(Object.values(summaries)[0]);
    return {
      id: event.id,
      title: 'Summary completed',
      description: stringValue(firstSummary.filename) ?? 'Document summary is ready',
      timestamp,
      variant: 'summary',
    };
  }

  if (eventType === 'qa_query') {
    return {
      id: event.id,
      title: 'Grounded answer generated',
      description: stringValue(event.data.query),
      timestamp,
      variant: 'qa',
    };
  }

  if (eventType === 'search_query') {
    return {
      id: event.id,
      title: 'Semantic search completed',
      description: stringValue(event.data.query),
      timestamp,
      variant: 'search',
    };
  }

  return null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
