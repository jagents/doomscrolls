import { create } from 'zustand';
import { api } from '../services/api';
import type { Passage } from '../types';

interface FeedState {
  passages: Passage[];
  cursor: string | null;
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  currentCategory: string | null;

  fetchMore: (category?: string) => Promise<void>;
  reset: () => void;
  setCategory: (category: string | null) => void;
  updatePassageLikeCount: (id: string, delta: number) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  passages: [],
  cursor: null,
  isLoading: false,
  hasMore: true,
  error: null,
  currentCategory: null,

  fetchMore: async (category) => {
    const { cursor, isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true, error: null });

    try {
      const response = await api.getFeed({
        category: category || undefined,
        cursor,
        limit: 20
      });

      set((state) => ({
        passages: [...state.passages, ...response.passages],
        cursor: response.nextCursor,
        hasMore: response.hasMore,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load feed',
        isLoading: false
      });
    }
  },

  reset: () => set({
    passages: [],
    cursor: null,
    hasMore: true,
    error: null,
  }),

  setCategory: (category) => {
    set({ currentCategory: category });
    get().reset();
    get().fetchMore(category || undefined);
  },

  updatePassageLikeCount: (id, delta) => {
    set((state) => ({
      passages: state.passages.map((p) =>
        p.id === id ? { ...p, like_count: Math.max(0, p.like_count + delta) } : p
      ),
    }));
  },
}));
