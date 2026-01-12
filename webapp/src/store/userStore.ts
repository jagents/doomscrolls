import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { useAuthStore } from './authStore';

interface UserState {
  likes: string[];
  bookmarks: string[];
  theme: 'light' | 'dark';
  selectedCategories: string[];
  onboardingCompleted: boolean;
  hasSynced: boolean;

  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setCategories: (categories: string[]) => void;
  completeOnboarding: () => void;
  isLiked: (id: string) => boolean;
  isBookmarked: (id: string) => boolean;
  syncWithServer: () => Promise<void>;
  setLikes: (likes: string[]) => void;
  setBookmarks: (bookmarks: string[]) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likes: [],
      bookmarks: [],
      theme: 'dark',
      selectedCategories: [],
      onboardingCompleted: false,
      hasSynced: false,

      toggleLike: (id) => {
        const { isAuthenticated } = useAuthStore.getState();
        const isCurrentlyLiked = get().likes.includes(id);

        set((state) => ({
          likes: isCurrentlyLiked
            ? state.likes.filter((i) => i !== id)
            : [...state.likes, id],
        }));

        // Sync with server if authenticated
        if (isAuthenticated()) {
          if (isCurrentlyLiked) {
            api.unlikePassage(id).catch(console.error);
          } else {
            api.syncLikes([id]).catch(console.error);
          }
        }

        // Also update the passage like count on server
        api.likePassage(id, !isCurrentlyLiked).catch(console.error);
      },

      toggleBookmark: (id) => {
        const { isAuthenticated } = useAuthStore.getState();
        const isCurrentlyBookmarked = get().bookmarks.includes(id);

        set((state) => ({
          bookmarks: isCurrentlyBookmarked
            ? state.bookmarks.filter((i) => i !== id)
            : [...state.bookmarks, id],
        }));

        // Sync with server if authenticated
        if (isAuthenticated()) {
          if (isCurrentlyBookmarked) {
            api.removeBookmark(id).catch(console.error);
          } else {
            api.syncBookmarks([id]).catch(console.error);
          }
        }
      },

      setTheme: (theme) => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ theme });
      },

      setCategories: (categories) => set({ selectedCategories: categories }),

      completeOnboarding: () => set({ onboardingCompleted: true }),

      isLiked: (id) => get().likes.includes(id),

      isBookmarked: (id) => get().bookmarks.includes(id),

      setLikes: (likes) => set({ likes }),

      setBookmarks: (bookmarks) => set({ bookmarks }),

      syncWithServer: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated()) return;

        try {
          const { likes, bookmarks, hasSynced } = get();

          if (!hasSynced) {
            // First sync: merge local data with server
            if (likes.length > 0) {
              const result = await api.syncLikes(likes);
              set({ likes: result.likes.map((l) => l.chunkId) });
            } else {
              const result = await api.getUserLikes();
              set({ likes: result.likes.map((l) => l.chunkId) });
            }

            if (bookmarks.length > 0) {
              const result = await api.syncBookmarks(bookmarks);
              set({ bookmarks: result.bookmarks.map((b) => b.chunkId) });
            } else {
              const result = await api.getUserBookmarks();
              set({ bookmarks: result.bookmarks.map((b) => b.chunkId) });
            }

            set({ hasSynced: true });
          } else {
            // Already synced, just fetch latest from server
            const [likesResult, bookmarksResult] = await Promise.all([
              api.getUserLikes(),
              api.getUserBookmarks(),
            ]);
            set({
              likes: likesResult.likes.map((l) => l.chunkId),
              bookmarks: bookmarksResult.bookmarks.map((b) => b.chunkId),
            });
          }
        } catch (error) {
          console.error('Failed to sync with server:', error);
        }
      },
    }),
    {
      name: 'doomscrolls-user',
      onRehydrateStorage: () => (state) => {
        // Apply theme on load
        if (state?.theme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
