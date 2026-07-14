import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  toggleSidebar: (value?: boolean) => void;
  toggleSidebarCollapsed: (value?: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isSidebarCollapsed: false,
  toggleSidebar: (value) =>
    set((state) => ({ isSidebarOpen: typeof value === 'boolean' ? value : !state.isSidebarOpen })),
  toggleSidebarCollapsed: (value) =>
    set((state) => ({ isSidebarCollapsed: typeof value === 'boolean' ? value : !state.isSidebarCollapsed })),
}));
