import type { FeedResponse, Passage, AuthorDetail, WorkDetail, Category, Author, Work } from '../types';

const API_BASE = '/api';

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': getDeviceId(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
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

  // Works
  getWork: (slug: string) => request<WorkDetail>(`/works/${slug}`),

  getWorkPassages: (slug: string, params: { limit?: number; offset?: number } = {}) =>
    request<{ passages: Passage[]; work: { id: string; title: string; slug: string }; total: number }>(`/works/${slug}/passages?limit=${params.limit || 20}&offset=${params.offset || 0}`),

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
  }>('/admin/stats'),

  getAdminConfig: () => request<{
    config: {
      maxAuthorRepeat: number;
      maxWorkRepeat: number;
      minLength: number;
      maxLength: number;
    };
  }>('/admin/config'),

  updateAdminConfig: (config: {
    maxAuthorRepeat?: number;
    maxWorkRepeat?: number;
    minLength?: number;
    maxLength?: number;
  }) => request<{
    config: {
      maxAuthorRepeat: number;
      maxWorkRepeat: number;
      minLength: number;
      maxLength: number;
    };
  }>('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
};
