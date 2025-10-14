import { create } from 'zustand';

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  variant: NotificationVariant;
  timestamp: number;
  read: boolean;
  href?: string;
}

interface NotificationStore {
  notifications: NotificationItem[];
  toasts: NotificationItem[];
  addNotification: (input: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  toasts: [],
  addNotification: (input) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const notification: NotificationItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant,
      href: input.href,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications],
      toasts: [...state.toasts, notification],
    }));

    window.setTimeout(() => {
      get().dismissToast(id);
    }, 5000);
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }));
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, read: true })),
    }));
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },
  clear: () => {
    set({ notifications: [], toasts: [] });
  },
}));
