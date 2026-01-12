# Doomscrolls Phase 1 Coding Plan v1

**Created:** January 12, 2026
**Status:** Ready for Implementation
**Target:** Backend API + Web App (Server-side development)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Backend Implementation Plan](#4-backend-implementation-plan)
5. [Web App Implementation Plan](#5-web-app-implementation-plan)
6. [Database Schema Changes](#6-database-schema-changes)
7. [API Specification](#7-api-specification)
8. [Feed Algorithm Design](#8-feed-algorithm-design)
9. [Future Platform Considerations](#9-future-platform-considerations)
10. [Implementation Order](#10-implementation-order)
11. [File Structure](#11-file-structure)
12. [Testing Strategy](#12-testing-strategy)

---

## 1. Executive Summary

### Goal
Build the Phase 1 MVP of Doomscrolls: a Twitter-like infinite scroll experience for classical literature, running on port 4800 (API) with a React webapp.

### Deliverables
1. **Hono API Server** - RESTful backend serving passages, authors, works
2. **React Web App** - Twitter-style UI with infinite scroll feed
3. **Feed Algorithm** - Diversity-protected content selection from curated top works
4. **Local Storage** - Likes/bookmarks stored client-side (no accounts in Phase 1)

### Tech Stack
- **Runtime:** Bun
- **API Framework:** Hono
- **Database:** Neon PostgreSQL (existing, 10.3M chunks)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **State Management:** Zustand
- **Routing:** React Router v6

---

## 2. Current State Analysis

### What Exists
- **Data Pipeline:** Complete ingestion from 9 sources
- **Database:** Neon PostgreSQL with 10.3M chunks, 17K works, 7.6K authors
- **Utilities:** ID generation, slug creation, file handling in `src/utils/`
- **Types:** Basic data models in `src/types/index.ts`

### What's Missing (Phase 1 Scope)
- Web server / API layer
- Database tables for stats, curation, categories
- Feed algorithm implementation
- React web application
- CORS, rate limiting middleware

### Database Statistics (Neon)
| Table | Row Count |
|-------|-----------|
| chunks | 10,302,862 |
| works | 17,291 |
| authors | 7,664 |

---

## 3. Architecture Overview

### System Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 1 ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐ │
│  │   Browser    │────▶│  React App   │────▶│   Hono API       │ │
│  │   (User)     │     │  (Vite/5173) │     │   (Port 4800)    │ │
│  └──────────────┘     └──────────────┘     └────────┬─────────┘ │
│                                                      │           │
│                                                      ▼           │
│                                            ┌──────────────────┐  │
│                                            │ Neon PostgreSQL  │  │
│                                            │ (10.3M chunks)   │  │
│                                            └──────────────────┘  │
│                                                                  │
│  Local Storage: likes[], bookmarks[], theme, onboarding         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. User opens app → React app loads
2. App requests feed → `GET /api/feed`
3. API runs diversity algorithm → selects passages from curated works
4. Response includes passages with author/work metadata
5. User interactions (like/bookmark) stored in localStorage
6. Like increments global count via `POST /api/passages/:id/like`

---

## 4. Backend Implementation Plan

### 4.1 Project Setup

**New Dependencies to Install:**
```bash
bun add hono @hono/node-server postgres
bun add -d @types/node
```

**Directory Structure:**
```
server/
├── index.ts                 # Entry point, server startup
├── app.ts                   # Hono app configuration
├── db/
│   ├── client.ts            # PostgreSQL connection pool
│   ├── schema.sql           # New table definitions
│   └── seed.ts              # Seed curated_works, categories
├── routes/
│   ├── index.ts             # Route aggregator
│   ├── feed.ts              # GET /api/feed
│   ├── passages.ts          # GET/POST /api/passages/*
│   ├── authors.ts           # GET /api/authors/*
│   ├── works.ts             # GET /api/works/*
│   ├── categories.ts        # GET /api/categories
│   └── discover.ts          # GET /api/discover/*
├── services/
│   ├── feed-algorithm.ts    # Diversity-protected feed generation
│   ├── queries.ts           # Reusable SQL queries
│   └── cache.ts             # Simple in-memory cache (optional)
├── middleware/
│   ├── cors.ts              # CORS configuration
│   ├── rateLimit.ts         # Rate limiting (device-based)
│   └── errorHandler.ts      # Global error handling
└── types/
    └── index.ts             # API-specific types
```

### 4.2 Database Connection

**File: `server/db/client.ts`**
```typescript
import postgres from 'postgres';

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('NEON_DATABASE_URL environment variable is required');
}

export const sql = postgres(connectionString, {
  max: 10,                    // Connection pool size
  idle_timeout: 20,           // Close idle connections after 20s
  connect_timeout: 10,        // Connection timeout
});

export async function testConnection() {
  const result = await sql`SELECT NOW()`;
  return result[0];
}
```

### 4.3 Hono Server Setup

**File: `server/index.ts`**
```typescript
import { serve } from 'bun';
import { app } from './app';

const PORT = process.env.PORT || 4800;

console.log(`🚀 Doomscrolls API starting on port ${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`✅ Server running at http://localhost:${PORT}`);
```

**File: `server/app.ts`**
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';

export const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4800'],
  credentials: true,
}));
app.use('/api/*', rateLimit);
app.onError(errorHandler);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.route('/api', routes);

export default app;
```

### 4.4 Route Implementations

#### Feed Route (`server/routes/feed.ts`)
```typescript
import { Hono } from 'hono';
import { generateFeed } from '../services/feed-algorithm';

const feed = new Hono();

// GET /api/feed?category=philosophy&limit=20&cursor=xxx
feed.get('/', async (c) => {
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const cursor = c.req.query('cursor');

  const result = await generateFeed({
    category,
    limit,
    cursor,
  });

  return c.json(result);
});

export { feed };
```

#### Passages Route (`server/routes/passages.ts`)
```typescript
import { Hono } from 'hono';
import { sql } from '../db/client';

const passages = new Hono();

// GET /api/passages/:id
passages.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [passage] = await sql`
    SELECT
      c.id,
      c.text,
      c.type,
      c.char_count,
      c.word_count,
      a.id as author_id,
      a.name as author_name,
      a.slug as author_slug,
      w.id as work_id,
      w.title as work_title,
      w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.id = ${id}
  `;

  if (!passage) {
    return c.json({ error: 'Passage not found' }, 404);
  }

  return c.json(formatPassage(passage));
});

// POST /api/passages/:id/like
passages.post('/:id/like', async (c) => {
  const id = c.req.param('id');
  const { increment } = await c.req.json();

  if (increment) {
    await sql`
      INSERT INTO chunk_stats (chunk_id, like_count)
      VALUES (${id}, 1)
      ON CONFLICT (chunk_id)
      DO UPDATE SET like_count = chunk_stats.like_count + 1
    `;
  } else {
    await sql`
      UPDATE chunk_stats
      SET like_count = GREATEST(0, like_count - 1)
      WHERE chunk_id = ${id}
    `;
  }

  const [stats] = await sql`
    SELECT like_count FROM chunk_stats WHERE chunk_id = ${id}
  `;

  return c.json({ like_count: stats?.like_count || 0 });
});

export { passages };
```

#### Authors Route (`server/routes/authors.ts`)
```typescript
import { Hono } from 'hono';
import { sql } from '../db/client';

const authors = new Hono();

// GET /api/authors?limit=20&offset=0
authors.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const results = await sql`
    SELECT id, name, slug, birth_year, death_year, nationality, era,
           work_count, chunk_count, primary_genre
    FROM authors
    ORDER BY chunk_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({ authors: results, limit, offset });
});

// GET /api/authors/:slug
authors.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [author] = await sql`
    SELECT * FROM authors WHERE slug = ${slug}
  `;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  const works = await sql`
    SELECT id, title, slug, year, type, genre, chunk_count
    FROM works
    WHERE author_id = ${author.id}
    ORDER BY year ASC NULLS LAST
  `;

  return c.json({ ...author, works });
});

// GET /api/authors/:slug/passages?limit=20&offset=0
authors.get('/:slug/passages', async (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const [author] = await sql`SELECT id FROM authors WHERE slug = ${slug}`;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  const passages = await sql`
    SELECT
      c.id, c.text, c.type,
      a.name as author_name, a.slug as author_slug,
      w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.author_id = ${author.id}
    ORDER BY RANDOM()
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({ passages: passages.map(formatPassage), limit, offset });
});

export { authors };
```

#### Works Route (`server/routes/works.ts`)
```typescript
import { Hono } from 'hono';
import { sql } from '../db/client';

const works = new Hono();

// GET /api/works/:slug
works.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [work] = await sql`
    SELECT w.*, a.name as author_name, a.slug as author_slug
    FROM works w
    JOIN authors a ON w.author_id = a.id
    WHERE w.slug = ${slug}
  `;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  return c.json(work);
});

// GET /api/works/:slug/passages?limit=20&offset=0
works.get('/:slug/passages', async (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const [work] = await sql`SELECT id FROM works WHERE slug = ${slug}`;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  const passages = await sql`
    SELECT
      c.id, c.text, c.type, c.position_index,
      a.name as author_name, a.slug as author_slug,
      w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.work_id = ${work.id}
    ORDER BY c.position_index ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({ passages: passages.map(formatPassage), limit, offset });
});

export { works };
```

#### Categories Route (`server/routes/categories.ts`)
```typescript
import { Hono } from 'hono';
import { sql } from '../db/client';

const categories = new Hono();

// GET /api/categories
categories.get('/', async (c) => {
  const results = await sql`
    SELECT
      cat.id, cat.name, cat.slug, cat.icon, cat.description,
      COUNT(wc.work_id) as work_count
    FROM categories cat
    LEFT JOIN work_categories wc ON cat.id = wc.category_id
    GROUP BY cat.id
    ORDER BY cat.display_order ASC
  `;

  return c.json({ categories: results });
});

export { categories };
```

#### Discover Route (`server/routes/discover.ts`)
```typescript
import { Hono } from 'hono';
import { sql } from '../db/client';

const discover = new Hono();

// GET /api/discover/authors - Featured authors
discover.get('/authors', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

  const authors = await sql`
    SELECT id, name, slug, era, primary_genre, chunk_count
    FROM authors
    WHERE chunk_count > 100
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return c.json({ authors });
});

// GET /api/discover/popular - Most liked passages
discover.get('/popular', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

  const passages = await sql`
    SELECT
      c.id, c.text, c.type,
      a.name as author_name, a.slug as author_slug,
      w.title as work_title, w.slug as work_slug,
      cs.like_count
    FROM chunk_stats cs
    JOIN chunks c ON cs.chunk_id = c.id
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    ORDER BY cs.like_count DESC
    LIMIT ${limit}
  `;

  return c.json({ passages: passages.map(formatPassage) });
});

export { discover };
```

### 4.5 Middleware

#### Rate Limiting (`server/middleware/rateLimit.ts`)
```typescript
import { Context, Next } from 'hono';

// Simple in-memory rate limiting (replace with Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const DAILY_LIMIT = 1000; // Generous for Phase 1

export async function rateLimit(c: Context, next: Next) {
  const deviceId = c.req.header('X-Device-ID') || 'anonymous';
  const today = new Date().toISOString().split('T')[0];
  const key = `${deviceId}:${today}`;

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 86400000 });
  } else if (record.count >= DAILY_LIMIT) {
    return c.json({
      error: 'Daily limit exceeded',
      limit: DAILY_LIMIT,
      resetAt: new Date(record.resetAt).toISOString(),
    }, 429);
  } else {
    record.count++;
  }

  c.header('X-RateLimit-Remaining', String(DAILY_LIMIT - (record?.count || 1)));
  await next();
}
```

#### Error Handler (`server/middleware/errorHandler.ts`)
```typescript
import { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error('API Error:', err);

  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500);
}
```

---

## 5. Web App Implementation Plan

### 5.1 Project Setup

**Initialize Vite React Project:**
```bash
cd /aiprojects/doomscrolls
mkdir webapp && cd webapp
bun create vite . --template react-ts
bun add tailwindcss postcss autoprefixer @tailwindcss/typography
bun add zustand react-router-dom
bun add -d @types/react @types/react-dom
npx tailwindcss init -p
```

### 5.2 Directory Structure

```
webapp/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx                    # Entry point
    ├── App.tsx                     # Root component + routing
    ├── index.css                   # Tailwind imports + CSS variables
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.tsx          # Main layout wrapper
    │   │   ├── LeftSidebar.tsx     # Navigation sidebar
    │   │   ├── RightSidebar.tsx    # Discover sidebar
    │   │   ├── TopBar.tsx          # Category tabs
    │   │   └── MobileNav.tsx       # Mobile hamburger menu
    │   ├── feed/
    │   │   ├── Feed.tsx            # Infinite scroll container
    │   │   ├── PassageCard.tsx     # Individual passage display
    │   │   ├── PassageActions.tsx  # Like/bookmark/share buttons
    │   │   └── FeedSkeleton.tsx    # Loading skeleton
    │   ├── shared/
    │   │   ├── Button.tsx
    │   │   ├── IconButton.tsx
    │   │   ├── Avatar.tsx
    │   │   ├── Modal.tsx
    │   │   ├── ShareModal.tsx
    │   │   └── ThemeToggle.tsx
    │   └── onboarding/
    │       └── OnboardingModal.tsx
    ├── pages/
    │   ├── HomePage.tsx            # Main feed
    │   ├── ExplorePage.tsx         # Category grid
    │   ├── BookmarksPage.tsx       # Saved passages
    │   ├── ProfilePage.tsx         # User stats (local)
    │   ├── AuthorPage.tsx          # Author detail
    │   ├── WorkPage.tsx            # Work detail
    │   └── PassagePage.tsx         # Single passage (share link)
    ├── hooks/
    │   ├── useInfiniteScroll.ts    # Intersection observer hook
    │   ├── useLocalStorage.ts      # Typed localStorage hook
    │   ├── useDeviceId.ts          # Device identification
    │   └── useTheme.ts             # Theme management
    ├── services/
    │   ├── api.ts                  # API client
    │   └── storage.ts              # localStorage helpers
    ├── store/
    │   ├── index.ts                # Zustand store
    │   ├── feedStore.ts            # Feed state
    │   └── userStore.ts            # User preferences/likes/bookmarks
    └── types/
        └── index.ts                # TypeScript interfaces
```

### 5.3 Core Components

#### Layout Component (`components/layout/Layout.tsx`)
```tsx
import { Outlet } from 'react-router-dom';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileNav } from './MobileNav';

export function Layout() {
  return (
    <div className="min-h-screen bg-primary text-primary">
      {/* Mobile Navigation */}
      <MobileNav className="lg:hidden" />

      <div className="flex max-w-[1400px] mx-auto">
        {/* Left Sidebar - Hidden on mobile */}
        <aside className="hidden lg:flex lg:w-[275px] lg:flex-shrink-0">
          <LeftSidebar />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 border-x border-border">
          <Outlet />
        </main>

        {/* Right Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden xl:flex xl:w-[350px] xl:flex-shrink-0">
          <RightSidebar />
        </aside>
      </div>
    </div>
  );
}
```

#### Passage Card (`components/feed/PassageCard.tsx`)
```tsx
import { Link } from 'react-router-dom';
import { PassageActions } from './PassageActions';
import type { Passage } from '../../types';

interface PassageCardProps {
  passage: Passage;
}

export function PassageCard({ passage }: PassageCardProps) {
  return (
    <article className="p-4 border-b border-border hover:bg-secondary/50 transition-colors">
      {/* Passage Text */}
      <blockquote className="text-lg font-serif leading-relaxed mb-3">
        "{passage.text}"
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center gap-2 text-sm text-secondary mb-3">
        <span>—</span>
        <Link
          to={`/author/${passage.author_slug}`}
          className="hover:underline font-medium"
        >
          {passage.author_name}
        </Link>
        {passage.work_title && (
          <>
            <span>•</span>
            <Link
              to={`/work/${passage.work_slug}`}
              className="hover:underline italic"
            >
              {passage.work_title}
            </Link>
          </>
        )}
      </div>

      {/* Actions */}
      <PassageActions passage={passage} />
    </article>
  );
}
```

#### Infinite Scroll Feed (`components/feed/Feed.tsx`)
```tsx
import { useEffect, useRef, useCallback } from 'react';
import { PassageCard } from './PassageCard';
import { FeedSkeleton } from './FeedSkeleton';
import { useFeedStore } from '../../store/feedStore';

interface FeedProps {
  category?: string;
}

export function Feed({ category }: FeedProps) {
  const { passages, isLoading, hasMore, fetchMore, reset } = useFeedStore();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset feed when category changes
  useEffect(() => {
    reset();
    fetchMore(category);
  }, [category]);

  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !isLoading) {
      fetchMore(category);
    }
  }, [hasMore, isLoading, category]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: '200px',
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [handleObserver]);

  return (
    <div className="divide-y divide-border">
      {passages.map((passage) => (
        <PassageCard key={passage.id} passage={passage} />
      ))}

      {/* Loading indicator / Load more trigger */}
      <div ref={loadMoreRef} className="p-4">
        {isLoading && <FeedSkeleton count={3} />}
        {!hasMore && passages.length > 0 && (
          <p className="text-center text-secondary">
            You've reached the end. Pull to refresh for more wisdom.
          </p>
        )}
      </div>
    </div>
  );
}
```

#### Passage Actions (`components/feed/PassageActions.tsx`)
```tsx
import { Heart, Bookmark, Share2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { api } from '../../services/api';
import type { Passage } from '../../types';

interface PassageActionsProps {
  passage: Passage;
}

export function PassageActions({ passage }: PassageActionsProps) {
  const { likes, bookmarks, toggleLike, toggleBookmark } = useUserStore();

  const isLiked = likes.includes(passage.id);
  const isBookmarked = bookmarks.includes(passage.id);

  const handleLike = async () => {
    toggleLike(passage.id);
    await api.likePassage(passage.id, !isLiked);
  };

  const handleBookmark = () => {
    toggleBookmark(passage.id);
  };

  const handleShare = () => {
    // Open share modal or native share
    if (navigator.share) {
      navigator.share({
        title: `${passage.author_name} - Doomscrolls`,
        text: passage.text,
        url: `${window.location.origin}/passage/${passage.id}`,
      });
    }
  };

  return (
    <div className="flex items-center gap-6 text-secondary">
      {/* Like */}
      <button
        onClick={handleLike}
        className={`flex items-center gap-2 hover:text-like transition-colors
          ${isLiked ? 'text-like' : ''}`}
      >
        <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
        <span className="text-sm">{passage.like_count + (isLiked ? 1 : 0)}</span>
      </button>

      {/* Bookmark */}
      <button
        onClick={handleBookmark}
        className={`hover:text-accent transition-colors
          ${isBookmarked ? 'text-accent' : ''}`}
      >
        <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className="hover:text-accent transition-colors"
      >
        <Share2 className="w-5 h-5" />
      </button>
    </div>
  );
}
```

### 5.4 State Management (Zustand)

#### Feed Store (`store/feedStore.ts`)
```typescript
import { create } from 'zustand';
import { api } from '../services/api';
import type { Passage } from '../types';

interface FeedState {
  passages: Passage[];
  cursor: string | null;
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;

  fetchMore: (category?: string) => Promise<void>;
  reset: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  passages: [],
  cursor: null,
  isLoading: false,
  hasMore: true,
  error: null,

  fetchMore: async (category) => {
    const { cursor, isLoading, hasMore } = get();
    if (isLoading || !hasMore) return;

    set({ isLoading: true, error: null });

    try {
      const response = await api.getFeed({ category, cursor, limit: 20 });

      set((state) => ({
        passages: [...state.passages, ...response.passages],
        cursor: response.nextCursor,
        hasMore: response.hasMore,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to load feed', isLoading: false });
    }
  },

  reset: () => set({
    passages: [],
    cursor: null,
    hasMore: true,
    error: null,
  }),
}));
```

#### User Store (`store/userStore.ts`)
```typescript
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
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
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

      setTheme: (theme) => set({ theme }),
      setCategories: (categories) => set({ selectedCategories: categories }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
    }),
    {
      name: 'doomscrolls-user',
    }
  )
);
```

### 5.5 API Client (`services/api.ts`)
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4800';

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
    return request<FeedResponse>(`/api/feed?${searchParams}`);
  },

  // Passages
  getPassage: (id: string) => request<Passage>(`/api/passages/${id}`),
  likePassage: (id: string, increment: boolean) =>
    request<{ like_count: number }>(`/api/passages/${id}/like`, {
      method: 'POST',
      body: JSON.stringify({ increment }),
    }),

  // Authors
  getAuthors: (params: { limit?: number; offset?: number }) =>
    request<AuthorsResponse>(`/api/authors?limit=${params.limit || 20}&offset=${params.offset || 0}`),
  getAuthor: (slug: string) => request<AuthorDetail>(`/api/authors/${slug}`),
  getAuthorPassages: (slug: string, params: { limit?: number; offset?: number }) =>
    request<PassagesResponse>(`/api/authors/${slug}/passages?limit=${params.limit || 20}&offset=${params.offset || 0}`),

  // Works
  getWork: (slug: string) => request<WorkDetail>(`/api/works/${slug}`),
  getWorkPassages: (slug: string, params: { limit?: number; offset?: number }) =>
    request<PassagesResponse>(`/api/works/${slug}/passages?limit=${params.limit || 20}&offset=${params.offset || 0}`),

  // Categories
  getCategories: () => request<CategoriesResponse>('/api/categories'),

  // Discover
  discoverAuthors: (limit?: number) =>
    request<{ authors: Author[] }>(`/api/discover/authors?limit=${limit || 5}`),
  discoverPopular: (limit?: number) =>
    request<{ passages: Passage[] }>(`/api/discover/popular?limit=${limit || 5}`),
};
```

### 5.6 CSS Variables & Theming (`src/index.css`)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light Mode */
    --bg-primary: 255 255 255;
    --bg-secondary: 247 249 249;
    --bg-tertiary: 239 243 244;
    --text-primary: 15 20 25;
    --text-secondary: 83 100 113;
    --accent: 29 155 240;
    --accent-hover: 26 140 216;
    --border: 239 243 244;
    --like: 249 24 128;
    --success: 0 186 124;
  }

  .dark {
    --bg-primary: 0 0 0;
    --bg-secondary: 22 24 28;
    --bg-tertiary: 29 31 35;
    --text-primary: 231 233 234;
    --text-secondary: 113 118 123;
    --accent: 29 155 240;
    --accent-hover: 26 140 216;
    --border: 47 51 54;
    --like: 249 24 128;
    --success: 0 186 124;
  }

  body {
    @apply bg-primary text-primary;
  }
}

@layer utilities {
  .bg-primary { background-color: rgb(var(--bg-primary)); }
  .bg-secondary { background-color: rgb(var(--bg-secondary)); }
  .bg-tertiary { background-color: rgb(var(--bg-tertiary)); }
  .text-primary { color: rgb(var(--text-primary)); }
  .text-secondary { color: rgb(var(--text-secondary)); }
  .text-accent { color: rgb(var(--accent)); }
  .text-like { color: rgb(var(--like)); }
  .border-border { border-color: rgb(var(--border)); }
  .hover\:bg-secondary:hover { background-color: rgb(var(--bg-secondary)); }
}
```

---

## 6. Database Schema Changes

### New Tables for Phase 1

**File: `server/db/schema.sql`**
```sql
-- =============================================================================
-- DOOMSCROLLS PHASE 1 SCHEMA ADDITIONS
-- Run against existing Neon database with authors, works, chunks tables
-- =============================================================================

-- Global like/view counts per passage
CREATE TABLE IF NOT EXISTS chunk_stats (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunk_stats_like_count ON chunk_stats(like_count DESC);

-- Curated top works for Phase 1 (subset of full corpus)
CREATE TABLE IF NOT EXISTS curated_works (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,  -- Higher = more likely to appear
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT  -- Editorial notes about why this work was selected
);

CREATE INDEX idx_curated_works_priority ON curated_works(priority DESC);

-- Categories for filtering
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,  -- Emoji or icon name
  description TEXT,
  display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_categories_display_order ON categories(display_order ASC);

-- Many-to-many: works <-> categories
CREATE TABLE IF NOT EXISTS work_categories (
  work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, category_id)
);

CREATE INDEX idx_work_categories_category ON work_categories(category_id);

-- =============================================================================
-- PHASE 2 PREP: Add columns that will be needed (nullable for now)
-- =============================================================================

-- Future: user-related columns on chunks
-- ALTER TABLE chunks ADD COLUMN IF NOT EXISTS is_quote BOOLEAN DEFAULT FALSE;
-- ALTER TABLE chunks ADD COLUMN IF NOT EXISTS quality_score FLOAT;

-- =============================================================================
-- SEED DATA: Categories
-- =============================================================================

INSERT INTO categories (id, name, slug, icon, description, display_order) VALUES
  ('cat-philosophy', 'Philosophy', 'philosophy', '🏛️', 'Wisdom from the great thinkers', 1),
  ('cat-poetry', 'Poetry', 'poetry', '📜', 'Verses that move the soul', 2),
  ('cat-fiction', 'Fiction', 'fiction', '📖', 'Stories that shaped literature', 3),
  ('cat-religion', 'Religion & Spirituality', 'religion', '🙏', 'Sacred texts and spiritual wisdom', 4),
  ('cat-essays', 'Essays', 'essays', '✍️', 'Thoughtful prose and reflections', 5),
  ('cat-drama', 'Drama', 'drama', '🎭', 'Plays and theatrical works', 6),
  ('cat-history', 'History', 'history', '📚', 'Chronicles of human civilization', 7),
  ('cat-stoicism', 'Stoicism', 'stoicism', '⚖️', 'Ancient wisdom for modern life', 8),
  ('cat-romanticism', 'Romanticism', 'romanticism', '🌹', 'Emotion and nature celebrated', 9),
  ('cat-russian', 'Russian Literature', 'russian', '🪆', 'The great Russian masters', 10),
  ('cat-ancient', 'Ancient', 'ancient', '🏺', 'Works from antiquity', 11),
  ('cat-medieval', 'Medieval', 'medieval', '🏰', 'Middle Ages literature', 12),
  ('cat-modern', 'Modern', 'modern', '🌆', 'Contemporary classics', 13)
ON CONFLICT (id) DO NOTHING;
```

### Seed Script for Curated Works

**File: `server/db/seed-curated-works.ts`**
```typescript
import { sql } from './client';

// Top works to include in Phase 1 MVP
// Selection criteria: Famous, foundational, highly quotable
const CURATED_WORKS = [
  // Philosophy
  { slug: 'meditations', priority: 100, notes: 'Marcus Aurelius - Stoic classic' },
  { slug: 'republic', priority: 95, notes: 'Plato - Foundation of Western philosophy' },
  { slug: 'nicomachean-ethics', priority: 90, notes: 'Aristotle - Virtue ethics' },
  { slug: 'thus-spoke-zarathustra', priority: 85, notes: 'Nietzsche - Philosophical masterpiece' },
  { slug: 'beyond-good-and-evil', priority: 80, notes: 'Nietzsche' },
  { slug: 'the-republic', priority: 85, notes: 'Plato' },
  { slug: 'apology', priority: 80, notes: 'Plato - Socrates defense' },

  // Stoicism
  { slug: 'letters-from-a-stoic', priority: 95, notes: 'Seneca - Accessible Stoic wisdom' },
  { slug: 'discourses', priority: 90, notes: 'Epictetus' },
  { slug: 'enchiridion', priority: 85, notes: 'Epictetus - Stoic handbook' },

  // Literature - Russian
  { slug: 'war-and-peace', priority: 100, notes: 'Tolstoy - Epic masterpiece' },
  { slug: 'anna-karenina', priority: 95, notes: 'Tolstoy' },
  { slug: 'crime-and-punishment', priority: 95, notes: 'Dostoevsky' },
  { slug: 'the-brothers-karamazov', priority: 90, notes: 'Dostoevsky' },
  { slug: 'notes-from-underground', priority: 85, notes: 'Dostoevsky' },

  // Literature - English
  { slug: 'pride-and-prejudice', priority: 95, notes: 'Austen - Beloved classic' },
  { slug: 'sense-and-sensibility', priority: 85, notes: 'Austen' },
  { slug: 'great-expectations', priority: 90, notes: 'Dickens' },
  { slug: 'a-tale-of-two-cities', priority: 90, notes: 'Dickens' },
  { slug: 'jane-eyre', priority: 90, notes: 'Charlotte Brontë' },
  { slug: 'wuthering-heights', priority: 85, notes: 'Emily Brontë' },
  { slug: '1984', priority: 95, notes: 'Orwell - Dystopian classic' },
  { slug: 'animal-farm', priority: 90, notes: 'Orwell' },

  // Literature - American
  { slug: 'moby-dick', priority: 90, notes: 'Melville - American epic' },
  { slug: 'the-great-gatsby', priority: 95, notes: 'Fitzgerald' },
  { slug: 'walden', priority: 90, notes: 'Thoreau - Transcendentalism' },
  { slug: 'leaves-of-grass', priority: 85, notes: 'Whitman - American poetry' },

  // Poetry
  { slug: 'sonnets', priority: 95, notes: 'Shakespeare - Timeless poetry' },
  { slug: 'the-complete-poems', priority: 85, notes: 'Emily Dickinson' },
  { slug: 'paradise-lost', priority: 85, notes: 'Milton - Epic poem' },
  { slug: 'the-divine-comedy', priority: 90, notes: 'Dante' },
  { slug: 'the-odyssey', priority: 95, notes: 'Homer - Ancient epic' },
  { slug: 'the-iliad', priority: 95, notes: 'Homer' },

  // Essays
  { slug: 'essays', priority: 90, notes: 'Montaigne - Father of essays' },
  { slug: 'self-reliance', priority: 90, notes: 'Emerson - Transcendentalism' },
  { slug: 'nature', priority: 85, notes: 'Emerson' },
  { slug: 'civil-disobedience', priority: 85, notes: 'Thoreau' },

  // Religion/Spirituality
  { slug: 'tao-te-ching', priority: 95, notes: 'Lao Tzu - Taoist wisdom' },
  { slug: 'bhagavad-gita', priority: 90, notes: 'Hindu scripture' },
  { slug: 'the-art-of-war', priority: 90, notes: 'Sun Tzu - Strategic wisdom' },
  { slug: 'confessions', priority: 85, notes: 'Augustine' },

  // Drama
  { slug: 'hamlet', priority: 95, notes: 'Shakespeare' },
  { slug: 'macbeth', priority: 90, notes: 'Shakespeare' },
  { slug: 'othello', priority: 85, notes: 'Shakespeare' },
  { slug: 'king-lear', priority: 85, notes: 'Shakespeare' },
  { slug: 'a-midsummer-nights-dream', priority: 80, notes: 'Shakespeare' },
];

export async function seedCuratedWorks() {
  console.log('Seeding curated works...');

  for (const work of CURATED_WORKS) {
    // Find work by slug
    const [existingWork] = await sql`
      SELECT id FROM works WHERE slug = ${work.slug}
    `;

    if (existingWork) {
      await sql`
        INSERT INTO curated_works (work_id, priority, notes)
        VALUES (${existingWork.id}, ${work.priority}, ${work.notes})
        ON CONFLICT (work_id) DO UPDATE SET
          priority = EXCLUDED.priority,
          notes = EXCLUDED.notes
      `;
      console.log(`✓ Added: ${work.slug}`);
    } else {
      console.log(`⚠ Work not found: ${work.slug}`);
    }
  }

  console.log('Done seeding curated works');
}
```

---

## 7. API Specification

### Base URL
- Development: `http://localhost:4800/api`
- Production: `https://doomscrolls.app/api`

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/feed` | Get infinite scroll feed |
| GET | `/api/passages/:id` | Get single passage |
| POST | `/api/passages/:id/like` | Increment/decrement like |
| GET | `/api/authors` | List authors |
| GET | `/api/authors/:slug` | Get author detail |
| GET | `/api/authors/:slug/passages` | Get author's passages |
| GET | `/api/works/:slug` | Get work detail |
| GET | `/api/works/:slug/passages` | Get work's passages |
| GET | `/api/categories` | List categories |
| GET | `/api/discover/authors` | Featured authors |
| GET | `/api/discover/popular` | Most liked passages |

### Response Formats

**Feed Response:**
```json
{
  "passages": [
    {
      "id": "uuid",
      "text": "The passage text...",
      "type": "quote",
      "author": {
        "id": "author-id",
        "name": "Marcus Aurelius",
        "slug": "marcus-aurelius"
      },
      "work": {
        "id": "work-id",
        "title": "Meditations",
        "slug": "meditations"
      },
      "like_count": 142
    }
  ],
  "nextCursor": "cursor-string",
  "hasMore": true
}
```

**Author Detail Response:**
```json
{
  "id": "author-id",
  "name": "Marcus Aurelius",
  "slug": "marcus-aurelius",
  "birth_year": 121,
  "death_year": 180,
  "nationality": "Roman",
  "era": "Ancient",
  "work_count": 1,
  "chunk_count": 485,
  "works": [
    {
      "id": "work-id",
      "title": "Meditations",
      "slug": "meditations",
      "year": 180,
      "type": "philosophy",
      "chunk_count": 485
    }
  ]
}
```

---

## 8. Feed Algorithm Design

### Phase 1: Diversity-Protected Random Feed

**File: `server/services/feed-algorithm.ts`**
```typescript
import { sql } from '../db/client';

interface FeedOptions {
  category?: string;
  limit: number;
  cursor?: string | null;
  excludeIds?: string[];
}

interface FeedConfig {
  // Content type distribution targets
  quoteRatio: number;      // 0.6 = 60% quotes
  passageRatio: number;    // 0.3 = 30% passages
  poemRatio: number;       // 0.1 = 10% poems

  // Diversity constraints
  maxAuthorRepeat: number; // No author more than 1 per N passages
  maxWorkRepeat: number;   // No work more than 1 per N passages
}

const DEFAULT_CONFIG: FeedConfig = {
  quoteRatio: 0.6,
  passageRatio: 0.3,
  poemRatio: 0.1,
  maxAuthorRepeat: 10,
  maxWorkRepeat: 20,
};

export async function generateFeed(options: FeedOptions) {
  const { category, limit, cursor, excludeIds = [] } = options;

  // Decode cursor (contains last seen author_ids and work_ids for diversity)
  const cursorData = cursor ? decodeCursor(cursor) : {
    recentAuthors: [],
    recentWorks: [],
    offset: 0
  };

  // Build query with diversity constraints
  let query = sql`
    WITH curated_chunks AS (
      SELECT c.*,
             a.name as author_name, a.slug as author_slug,
             w.title as work_title, w.slug as work_slug,
             COALESCE(cs.like_count, 0) as like_count
      FROM chunks c
      JOIN curated_works cw ON c.work_id = cw.work_id
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      WHERE c.char_count BETWEEN 50 AND 1000
        ${excludeIds.length > 0 ? sql`AND c.id NOT IN ${sql(excludeIds)}` : sql``}
        ${cursorData.recentAuthors.length > 0
          ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
          : sql``}
        ${cursorData.recentWorks.length > 0
          ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
          : sql``}
    )
    SELECT * FROM curated_chunks
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  // Add category filter if specified
  if (category && category !== 'for-you') {
    query = sql`
      WITH curated_chunks AS (
        SELECT c.*,
               a.name as author_name, a.slug as author_slug,
               w.title as work_title, w.slug as work_slug,
               COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN curated_works cw ON c.work_id = cw.work_id
        JOIN work_categories wc ON c.work_id = wc.work_id
        JOIN categories cat ON wc.category_id = cat.id
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE cat.slug = ${category}
          AND c.char_count BETWEEN 50 AND 1000
      )
      SELECT * FROM curated_chunks
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
  }

  const passages = await query;

  // Build next cursor with recent author/work IDs for diversity
  const newRecentAuthors = [
    ...passages.slice(-DEFAULT_CONFIG.maxAuthorRepeat).map(p => p.author_id),
  ].slice(-DEFAULT_CONFIG.maxAuthorRepeat);

  const newRecentWorks = [
    ...passages.slice(-DEFAULT_CONFIG.maxWorkRepeat).map(p => p.work_id),
  ].slice(-DEFAULT_CONFIG.maxWorkRepeat);

  const nextCursor = encodeCursor({
    recentAuthors: newRecentAuthors,
    recentWorks: newRecentWorks,
    offset: cursorData.offset + passages.length,
  });

  return {
    passages: passages.map(formatPassage),
    nextCursor,
    hasMore: passages.length === limit,
  };
}

function formatPassage(row: any) {
  return {
    id: row.id,
    text: row.text,
    type: row.type,
    author: {
      id: row.author_id,
      name: row.author_name,
      slug: row.author_slug,
    },
    work: row.work_id ? {
      id: row.work_id,
      title: row.work_title,
      slug: row.work_slug,
    } : null,
    like_count: row.like_count,
  };
}

function encodeCursor(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor: string): any {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return { recentAuthors: [], recentWorks: [], offset: 0 };
  }
}
```

---

## 9. Future Platform Considerations

### Architecture Decisions for Phase 2/3 Compatibility

1. **API Design**
   - All endpoints return consistent JSON structure
   - Pagination uses cursor-based approach (scales better than offset)
   - Device ID header pattern ready for user authentication upgrade

2. **Database Schema**
   - `chunk_stats` separates global counts from future user-specific data
   - Categories designed for future user customization
   - Work/author relationships clean for future "follow" features

3. **State Management**
   - Zustand store structure mirrors future server-synced state
   - Local storage keys prefixed for easy migration to server sync

### Multi-Platform API Considerations

| Platform | API Base URL (Dev) | Notes |
|----------|-------------------|-------|
| Web (Server) | `http://localhost:4800` | Direct access |
| iOS Simulator | `http://localhost:4800` | Port forwarded via Termius |
| Android Emulator | `http://10.0.2.2:4800` | Android's localhost alias |
| Chrome Extension | `http://localhost:4800` | Direct access |

### Shared Type Definitions

Create a shared types package for future iOS/Android consumption:

**File: `shared/types/api.ts`** (Future)
```typescript
export interface Passage {
  id: string;
  text: string;
  type: 'quote' | 'passage' | 'poem' | 'verse';
  author: Author;
  work: Work | null;
  like_count: number;
}

export interface Author {
  id: string;
  name: string;
  slug: string;
  birth_year?: number;
  death_year?: number;
  era?: string;
  nationality?: string;
}

export interface Work {
  id: string;
  title: string;
  slug: string;
  year?: number;
  type?: string;
  genre?: string;
}

// ... more shared types
```

---

## 10. Implementation Order

### Step-by-Step Build Sequence

#### Phase 1A: Backend Foundation (Days 1-2)
1. ☐ Create `server/` directory structure
2. ☐ Install dependencies: `bun add hono postgres`
3. ☐ Set up database connection (`server/db/client.ts`)
4. ☐ Create and run schema migrations (`server/db/schema.sql`)
5. ☐ Seed categories table
6. ☐ Create curated works seed script and run it
7. ☐ Implement basic Hono server with health endpoint
8. ☐ Test: `curl http://localhost:4800/health`

#### Phase 1B: Core API Routes (Days 2-3)
1. ☐ Implement feed algorithm (`server/services/feed-algorithm.ts`)
2. ☐ Implement `/api/feed` route
3. ☐ Implement `/api/passages/:id` route
4. ☐ Implement `/api/passages/:id/like` route
5. ☐ Implement `/api/authors` routes
6. ☐ Implement `/api/works` routes
7. ☐ Implement `/api/categories` route
8. ☐ Implement `/api/discover/*` routes
9. ☐ Add CORS middleware
10. ☐ Add rate limiting middleware
11. ☐ Test all endpoints with curl/Postman

#### Phase 1C: Web App Setup (Day 3)
1. ☐ Create `webapp/` with Vite + React + TypeScript
2. ☐ Configure Tailwind CSS with custom theme
3. ☐ Set up CSS variables for light/dark mode
4. ☐ Create API client service
5. ☐ Set up Zustand stores (feed, user)
6. ☐ Configure React Router

#### Phase 1D: Web App Components (Days 4-5)
1. ☐ Build Layout component with sidebars
2. ☐ Build PassageCard component
3. ☐ Build Feed component with infinite scroll
4. ☐ Build PassageActions (like/bookmark/share)
5. ☐ Build LeftSidebar with navigation
6. ☐ Build RightSidebar with discover sections
7. ☐ Build TopBar with category tabs
8. ☐ Build MobileNav for responsive design

#### Phase 1E: Web App Pages (Days 5-6)
1. ☐ Build HomePage (main feed)
2. ☐ Build ExplorePage (category grid)
3. ☐ Build BookmarksPage
4. ☐ Build ProfilePage (local stats)
5. ☐ Build AuthorPage
6. ☐ Build WorkPage
7. ☐ Build PassagePage (share permalink)
8. ☐ Build OnboardingModal

#### Phase 1F: Polish & Deploy (Day 6-7)
1. ☐ Implement theme toggle (light/dark)
2. ☐ Implement share functionality
3. ☐ Add loading skeletons
4. ☐ Add error states
5. ☐ Responsive testing (mobile/tablet/desktop)
6. ☐ Performance optimization
7. ☐ Build production webapp: `bun run build`
8. ☐ Configure PM2 for API
9. ☐ Configure Nginx for webapp serving
10. ☐ SSL setup with Let's Encrypt
11. ☐ Final testing

---

## 11. File Structure

### Complete Phase 1 Structure

```
/aiprojects/doomscrolls/
├── CLAUDE.md                     # Claude Code context
├── README.md                     # Project overview
├── package.json                  # Root package.json
├── ecosystem.config.js           # PM2 configuration
├── .env                          # Environment variables
├── .gitignore
│
├── server/                       # Backend API
│   ├── index.ts                  # Entry point
│   ├── app.ts                    # Hono app config
│   ├── db/
│   │   ├── client.ts             # PostgreSQL connection
│   │   ├── schema.sql            # New tables DDL
│   │   ├── seed-categories.ts    # Category seeding
│   │   └── seed-curated-works.ts # Curated works seeding
│   ├── routes/
│   │   ├── index.ts              # Route aggregator
│   │   ├── feed.ts               # Feed endpoints
│   │   ├── passages.ts           # Passage endpoints
│   │   ├── authors.ts            # Author endpoints
│   │   ├── works.ts              # Work endpoints
│   │   ├── categories.ts         # Category endpoints
│   │   └── discover.ts           # Discover endpoints
│   ├── services/
│   │   ├── feed-algorithm.ts     # Feed generation logic
│   │   └── formatters.ts         # Response formatters
│   ├── middleware/
│   │   ├── cors.ts               # CORS config
│   │   ├── rateLimit.ts          # Rate limiting
│   │   └── errorHandler.ts       # Error handling
│   └── types/
│       └── index.ts              # Server types
│
├── webapp/                       # React Web App
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── components/
│       │   ├── layout/
│       │   ├── feed/
│       │   ├── shared/
│       │   └── onboarding/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       ├── store/
│       └── types/
│
├── src/                          # Existing data pipeline (unchanged)
│   ├── types/
│   └── utils/
│
├── scripts/                      # Existing ingestion scripts (unchanged)
│
├── data/                         # Data files (gitignored)
│
├── ios/                          # Future: iOS app (Mac development)
├── android/                      # Future: Android app (Mac development)
└── chrome-extension/             # Future: Chrome extension (Mac development)
```

---

## 12. Testing Strategy

### Backend Testing

**Manual API Testing:**
```bash
# Health check
curl http://localhost:4800/health

# Get feed
curl "http://localhost:4800/api/feed?limit=5"

# Get feed with category
curl "http://localhost:4800/api/feed?category=philosophy&limit=5"

# Get passage
curl http://localhost:4800/api/passages/{id}

# Like passage
curl -X POST http://localhost:4800/api/passages/{id}/like \
  -H "Content-Type: application/json" \
  -d '{"increment": true}'

# Get author
curl http://localhost:4800/api/authors/marcus-aurelius

# Get work
curl http://localhost:4800/api/works/meditations

# Get categories
curl http://localhost:4800/api/categories
```

### Frontend Testing

**Browser Console Tests:**
```javascript
// Test API connection
fetch('http://localhost:4800/api/feed?limit=3')
  .then(r => r.json())
  .then(console.log);

// Test localStorage
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test'));

// Test infinite scroll trigger
window.scrollTo(0, document.body.scrollHeight);
```

### Performance Benchmarks

- Feed load: < 200ms for 20 passages
- Time to interactive: < 2 seconds
- Lighthouse score: > 90 (Performance)
- Scroll smoothness: 60fps

---

## Appendix A: Environment Variables

**File: `.env`**
```bash
# Database
NEON_DATABASE_URL=postgresql://...

# Server
PORT=4800
NODE_ENV=development

# Future (Phase 2)
# JWT_SECRET=...
# REDIS_URL=...
```

---

## Appendix B: PM2 Ecosystem Config

**File: `ecosystem.config.js`**
```javascript
module.exports = {
  apps: [{
    name: 'doomscrolls-api',
    script: 'server/index.ts',
    interpreter: 'bun',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 4800,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4800,
    },
  }],
};
```

---

## Appendix C: Nginx Configuration

**File: `/etc/nginx/sites-available/doomscrolls`**
```nginx
server {
    listen 80;
    server_name doomscrolls.app www.doomscrolls.app;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name doomscrolls.app www.doomscrolls.app;

    ssl_certificate /etc/letsencrypt/live/doomscrolls.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/doomscrolls.app/privkey.pem;

    # API proxy
    location /api {
        proxy_pass http://localhost:4800;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static webapp
    location / {
        root /aiprojects/doomscrolls/webapp/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

---

*End of Phase 1 Coding Plan*
