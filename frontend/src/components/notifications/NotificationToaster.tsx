import { CheckCircle2, Info, AlertCircle, X, Sparkles } from 'lucide-react';

import { useNotificationStore } from '../../stores/notificationStore';

export function NotificationToaster() {
  const toasts = useNotificationStore((state) => state.toasts);
  const dismissToast = useNotificationStore((state) => state.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border/70 bg-card/95 p-4 shadow-lg"
        >
          <ToastIcon variant={toast.variant} />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">{toast.title}</p>
            {toast.description ? (
              <p className="text-xs text-muted-foreground">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="rounded p-1 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ variant }: { variant: 'info' | 'success' | 'warning' | 'error' }) {
  const className = 'mt-0.5 h-5 w-5';
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`${className} text-emerald-500`} />;
    case 'warning':
      return <Sparkles className={`${className} text-amber-500`} />;
    case 'error':
      return <AlertCircle className={`${className} text-destructive`} />;
    default:
      return <Info className={`${className} text-primary`} />;
  }
}
