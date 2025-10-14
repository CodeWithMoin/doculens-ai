import { useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

import { Button } from '../ui/button';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationCenter } from './NotificationCenter';

export function NotificationBell() {
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setIsOpen((open) => !open)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      <NotificationCenter open={isOpen} onClose={() => setIsOpen(false)}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              markAllAsRead();
              setIsOpen(false);
            }}
            disabled={!unreadCount}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </NotificationCenter>
    </div>
  );
}
