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
  author_id?: string;
  author_name?: string;
  author_slug?: string;
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

export interface FeedResponse {
  passages: Passage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AuthorDetail extends Author {
  works: Work[];
  followerCount?: number;
  isFollowing?: boolean;
}

export interface WorkDetail extends Work {
  author_name: string;
  author_slug: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface UserStats {
  likeCount: number;
  bookmarkCount: number;
  followingCount: number;
  listsCount: number;
  worksInProgress: number;
  worksCompleted: number;
}

export interface List {
  id: string;
  name: string;
  description: string | null;
  isCurated: boolean;
  isPublic: boolean;
  passageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  workId: string;
  workTitle: string;
  workSlug: string;
  authorName: string;
  authorSlug: string;
  currentIndex: number;
  totalChunks: number;
  percentComplete: number;
  lastReadAt: string;
  completedAt: string | null;
}

export interface SearchResult {
  type: 'passage' | 'author' | 'work';
  passage?: Passage;
  author?: Author;
  work?: Work;
  score?: number;
}

export interface SimilarPassage extends Passage {
  similarity: string;
}
