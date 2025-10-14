import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: (value?: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: (value) =>
    set((state) => ({ isSidebarOpen: typeof value === 'boolean' ? value : !state.isSidebarOpen })),
}));
