import { create } from 'zustand';

interface UIState {
  authModalOpen: boolean;
  authModalMode: 'login' | 'signup';

  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  authModalOpen: false,
  authModalMode: 'login',

  openAuthModal: (mode = 'login') => set({ authModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
