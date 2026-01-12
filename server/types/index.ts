// API Response Types

export interface Author {
  id: string;
  name: string;
  slug: string;
  birth_year?: number | null;
  death_year?: number | null;
  nationality?: string | null;
  era?: string | null;
  work_count?: number;
  chunk_count?: number;
  primary_genre?: string | null;
}

export interface Work {
  id: string;
  title: string;
  slug: string;
  author_id: string;
  year?: number | null;
  type?: string | null;
  genre?: string | null;
  chunk_count?: number;
  source?: string;
  source_url?: string | null;
}

export interface Passage {
  id: string;
  text: string;
  type: string;
  author: {
    id: string;
    name: string;
    slug: string;
  };
  work: {
    id: string;
    title: string;
    slug: string;
  } | null;
  like_count: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  display_order: number;
  work_count?: number;
}

export interface FeedOptions {
  category?: string;
  limit: number;
  cursor?: string | null;
}

export interface FeedResponse {
  passages: Passage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorData {
  recentAuthors: string[];
  recentWorks: string[];
  offset: number;
}
