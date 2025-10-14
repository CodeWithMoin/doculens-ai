import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { useNotificationStore } from '../../stores/notificationStore';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function NotificationCenter({ open, onClose, children }: NotificationCenterProps) {
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-end bg-black/10 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="m-4 w-full max-w-md border-border/70 bg-card/95 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="border-b border-border/70 pb-3">
          {children}
        </CardHeader>
        <CardContent className="max-h-[420px] space-y-3 overflow-y-auto py-4">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet. Actions you take will show up here.</p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
              >
                <IconForVariant variant={item.variant} />
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {!item.read ? (
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted"
                        onClick={() => markAsRead(item.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                    {item.href ? (
                      <a className="text-primary underline" href={item.href}>
                        View
                      </a>
                    ) : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeNotification(item.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>,
    document.body,
  );
}

function IconForVariant({ variant }: { variant: 'info' | 'success' | 'warning' | 'error' }) {
  const className = 'mt-0.5 h-4 w-4';
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`${className} text-emerald-500`} />;
    case 'warning':
      return <AlertCircle className={`${className} text-amber-500`} />;
    case 'error':
      return <AlertCircle className={`${className} text-destructive`} />;
    default:
      return <Info className={`${className} text-primary`} />;
  }
}
