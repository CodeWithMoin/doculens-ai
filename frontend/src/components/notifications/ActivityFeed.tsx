import { type ComponentType } from 'react';
import { Activity, Brain, FileText, MessageSquare, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useNotificationStore } from '../../stores/notificationStore';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  upload: FileText,
  summary: Brain,
  qa: MessageSquare,
  default: Activity,
};

export function ActivityFeed({ limit = 2 }: { limit?: number }) {
  const notifications = useNotificationStore((state) => state.notifications).slice(0, limit);

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">Recent activity</CardTitle>
          <CardDescription>Key pipeline events from the past few minutes.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" disabled>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Actions taken in the console will appear here.</p>
        ) : (
          notifications.map((item) => {
            const Icon = iconMap[item.variant] ?? iconMap.default;
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-md border border-border/70 bg-white px-3 py-2">
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
