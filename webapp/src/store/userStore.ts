import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  likes: string[];
  bookmarks: string[];
  theme: 'light' | 'dark';
  selectedCategories: string[];
  onboardingCompleted: boolean;

  toggleLike: (id: string) => void;
  toggleBookmark: (id: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setCategories: (categories: string[]) => void;
  completeOnboarding: () => void;
  isLiked: (id: string) => boolean;
  isBookmarked: (id: string) => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      likes: [],
      bookmarks: [],
      theme: 'dark',
      selectedCategories: [],
      onboardingCompleted: false,

      toggleLike: (id) => set((state) => ({
        likes: state.likes.includes(id)
          ? state.likes.filter((i) => i !== id)
          : [...state.likes, id],
      })),

      toggleBookmark: (id) => set((state) => ({
        bookmarks: state.bookmarks.includes(id)
          ? state.bookmarks.filter((i) => i !== id)
          : [...state.bookmarks, id],
      })),

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
