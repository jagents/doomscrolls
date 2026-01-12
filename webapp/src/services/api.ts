import type {
  FeedResponse,
  Passage,
  AuthorDetail,
  WorkDetail,
  Category,
  Author,
  Work,
  AuthResponse,
  User,
  UserStats,
  List,
  ReadingProgress,
  SearchResult,
  SimilarPassage,
} from '../types';
import { useAuthStore } from '../store/authStore';

const API_BASE = '/api';

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

function getAuthHeaders(): HeadersInit {
  const { accessToken } = useAuthStore.getState();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Device-ID': getDeviceId(),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Include cookies for refresh token
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // Handle 401 by attempting token refresh
  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry the request with new token
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
          ...options.headers,
        },
      });
      if (!retryResponse.ok) {
        throw new Error(`API Error: ${retryResponse.status}`);
      }
      return retryResponse.json();
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }

  return response.json();
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      useAuthStore.getState().setAccessToken(data.accessToken);
      useAuthStore.getState().setUser(data.user);
      return true;
    }
  } catch {
    // Refresh failed
  }

  // Clear auth state on refresh failure
  useAuthStore.getState().logout();
  return false;
}

export const api = {
  // Auth
  signup: (email: string, password: string, displayName?: string) =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  refreshToken: () =>
    request<AuthResponse>('/auth/refresh', { method: 'POST' }),

  getMe: () => request<{ user: User }>('/auth/me'),

  updateMe: (updates: { displayName?: string }) =>
    request<{ user: User }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // User Data
  getUserLikes: () =>
    request<{ likes: Array<{ chunkId: string; likedAt: string }> }>('/user/likes'),

  syncLikes: (chunkIds: string[]) =>
    request<{ synced: number; likes: Array<{ chunkId: string; likedAt: string }> }>('/user/likes/sync', {
      method: 'POST',
      body: JSON.stringify({ chunkIds }),
    }),

  unlikePassage: (chunkId: string) =>
    request<{ success: boolean }>(`/user/likes/${chunkId}`, { method: 'DELETE' }),

  getUserBookmarks: () =>
    request<{ bookmarks: Array<{ chunkId: string; bookmarkedAt: string }> }>('/user/bookmarks'),

  syncBookmarks: (chunkIds: string[]) =>
    request<{ synced: number; bookmarks: Array<{ chunkId: string; bookmarkedAt: string }> }>('/user/bookmarks/sync', {
      method: 'POST',
      body: JSON.stringify({ chunkIds }),
    }),

  removeBookmark: (chunkId: string) =>
    request<{ success: boolean }>(`/user/bookmarks/${chunkId}`, { method: 'DELETE' }),

  getUserFollowing: () =>
    request<{ following: Array<{ authorId: string; authorName: string; authorSlug: string; followedAt: string }> }>('/user/following'),

  getUserStats: () => request<{ stats: UserStats }>('/user/stats'),

  getUserReading: () =>
    request<{ reading: ReadingProgress[] }>('/user/reading'),

  // Feed
  getFeed: (params: { category?: string; cursor?: string | null; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    return request<FeedResponse>(`/feed?${searchParams}`);
  },

  // Passages
  getPassage: (id: string) => request<Passage>(`/passages/${id}`),

  likePassage: (id: string, increment: boolean) =>
    request<{ like_count: number }>(`/passages/${id}/like`, {
      method: 'POST',
      body: JSON.stringify({ increment }),
    }),

  // Authors
  getAuthors: (params: { limit?: number; offset?: number } = {}) =>
    request<{ authors: Author[]; total: number }>(`/authors?limit=${params.limit || 20}&offset=${params.offset || 0}`),

  getAuthor: (slug: string) => request<AuthorDetail>(`/authors/${slug}`),

  getAuthorPassages: (slug: string, params: { limit?: number; offset?: number } = {}) =>
    request<{ passages: Passage[]; author: { id: string; name: string; slug: string } }>(`/authors/${slug}/passages?limit=${params.limit || 20}&offset=${params.offset || 0}`),

  followAuthor: (slug: string) =>
    request<{ success: boolean; isFollowing: boolean; followerCount: number }>(`/authors/${slug}/follow`, { method: 'POST' }),

  unfollowAuthor: (slug: string) =>
    request<{ success: boolean; isFollowing: boolean; followerCount: number }>(`/authors/${slug}/follow`, { method: 'DELETE' }),

  // Works
  getWork: (slug: string) => request<WorkDetail>(`/works/${slug}`),

  getWorkPassages: (slug: string, params: { limit?: number; offset?: number } = {}) =>
    request<{ passages: Passage[]; work: { id: string; title: string; slug: string }; total: number }>(`/works/${slug}/passages?limit=${params.limit || 20}&offset=${params.offset || 0}`),

  // Work Reader
  getWorkForReading: (slug: string) =>
    request<{
      work: {
        id: string;
        title: string;
        slug: string;
        year: number | null;
        type: string | null;
        genre: string | null;
        author: { name: string; slug: string };
      };
      totalChunks: number;
      userProgress: {
        currentIndex: number;
        totalChunks: number;
        lastReadAt: string;
        completedAt: string | null;
        percentComplete: number;
      } | null;
    }>(`/works/${slug}/read`),

  getWorkChunks: (slug: string, params: { start?: number; limit?: number } = {}) =>
    request<{
      chunks: Array<{ id: string; text: string; type: string; index: number }>;
      total: number;
      hasMore: boolean;
      start: number;
      limit: number;
    }>(`/works/${slug}/chunks?start=${params.start || 0}&limit=${params.limit || 10}`),

  updateReadingProgress: (slug: string, currentIndex: number) =>
    request<{
      success: boolean;
      currentIndex: number;
      totalChunks: number;
      percentComplete: number;
      completed: boolean;
    }>(`/works/${slug}/progress`, {
      method: 'POST',
      body: JSON.stringify({ currentIndex }),
    }),

  // Similar Passages
  getSimilarPassages: (id: string, limit?: number) =>
    request<{
      passage: {
        id: string;
        text: string;
        author: { name: string; slug: string };
        work: { title: string; slug: string } | null;
      };
      similar: SimilarPassage[];
      method: 'embedding' | 'fallback';
      embeddingsAvailable: boolean;
    }>(`/passages/${id}/similar?limit=${limit || 10}`),

  // Lists
  getLists: () =>
    request<{ lists: List[] }>('/lists'),

  getCuratedLists: () =>
    request<{ lists: List[] }>('/lists/curated'),

  getList: (id: string) =>
    request<{
      list: List & { user?: { id: string; displayName: string } };
      passages: Passage[];
    }>(`/lists/${id}`),

  createList: (name: string, description?: string, isPublic?: boolean) =>
    request<{ list: List }>('/lists', {
      method: 'POST',
      body: JSON.stringify({ name, description, isPublic }),
    }),

  updateList: (id: string, updates: { name?: string; description?: string; isPublic?: boolean }) =>
    request<{ list: List }>(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteList: (id: string) =>
    request<{ success: boolean }>(`/lists/${id}`, { method: 'DELETE' }),

  addToList: (id: string, chunkId: string) =>
    request<{ success: boolean }>(`/lists/${id}/passages`, {
      method: 'POST',
      body: JSON.stringify({ chunkId }),
    }),

  removeFromList: (id: string, chunkId: string) =>
    request<{ success: boolean }>(`/lists/${id}/passages/${chunkId}`, { method: 'DELETE' }),

  // Search
  search: (query: string, params: { type?: string; limit?: number } = {}) => {
    const searchParams = new URLSearchParams({ q: query });
    if (params.type) searchParams.set('type', params.type);
    if (params.limit) searchParams.set('limit', String(params.limit));
    return request<{
      results: SearchResult[];
      query: string;
      total: number;
      method: 'hybrid' | 'keyword';
    }>(`/search?${searchParams}`);
  },

  // Following Feed
  getFollowingFeed: (params: { cursor?: string | null; limit?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    return request<FeedResponse>(`/feed/following?${searchParams}`);
  },

  // For You Feed
  getForYouFeed: (params: { cursor?: string | null; limit?: number } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.cursor) searchParams.set('cursor', params.cursor);
    if (params.limit) searchParams.set('limit', String(params.limit));
    return request<FeedResponse>(`/feed/for-you?${searchParams}`);
  },

  // Categories
  getCategories: () => request<{ categories: Category[] }>('/categories'),

  // Discover
  discoverAuthors: (limit?: number) =>
    request<{ authors: Author[] }>(`/discover/authors?limit=${limit || 5}`),

  discoverPopular: (limit?: number) =>
    request<{ passages: Passage[] }>(`/discover/popular?limit=${limit || 5}`),

  discoverWorks: (limit?: number) =>
    request<{ works: Work[] }>(`/discover/works?limit=${limit || 5}`),

  // Admin
  getAdminStats: () => request<{
    dataset: {
      chunks: number;
      works: number;
      authors: number;
      curatedWorks: number;
      categories: number;
      categoryBreakdown: Array<{ name: string; slug: string; icon: string; workCount: number }>;
    };
    feed: {
      totalLikes: number;
      totalViews: number;
      topPassages: Array<{
        id: string;
        text: string;
        authorName: string;
        workTitle: string | null;
        likeCount: number;
      }>;
    };
    phase2: {
      users: {
        total: number;
        activeThisWeek: number;
        withLikes: number;
        withFollows: number;
      };
      embeddings: {
        total: number;
        withEmbeddings: number;
        percentComplete: number;
      };
      lists: {
        total: number;
        curated: number;
        totalPassagesInLists: number;
      };
      follows: {
        totalFollows: number;
        topAuthors: Array<{ name: string; slug: string; followers: number }>;
      };
    };
  }>('/admin/stats'),

  getAdminConfig: () => request<{
    config: {
      maxAuthorRepeat: number;
      maxWorkRepeat: number;
      minLength: number;
      maxLength: number;
      lengthDiversityEnabled: boolean;
      shortMaxLength: number;
      longMinLength: number;
      shortRatio: number;
      mediumRatio: number;
      longRatio: number;
    };
  }>('/admin/config'),

  updateAdminConfig: (config: {
    maxAuthorRepeat?: number;
    maxWorkRepeat?: number;
    minLength?: number;
    maxLength?: number;
    lengthDiversityEnabled?: boolean;
    shortMaxLength?: number;
    longMinLength?: number;
    shortRatio?: number;
    mediumRatio?: number;
    longRatio?: number;
  }) => request<{
    config: {
      maxAuthorRepeat: number;
      maxWorkRepeat: number;
      minLength: number;
      maxLength: number;
      lengthDiversityEnabled: boolean;
      shortMaxLength: number;
      longMinLength: number;
      shortRatio: number;
      mediumRatio: number;
      longRatio: number;
    };
  }>('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
};
