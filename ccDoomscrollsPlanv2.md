# Doomscrolls Phase 2 Coding Plan

**Created:** January 12, 2026
**Status:** Planning
**Prerequisite:** Phase 1 MVP (Completed)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase 1 Completion Status](#2-phase-1-completion-status)
3. [Phase 2 Feature Overview](#3-phase-2-feature-overview)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Authentication System](#5-authentication-system)
6. [API Endpoints - New & Modified](#6-api-endpoints---new--modified)
7. [Personalized Feed Algorithm](#7-personalized-feed-algorithm)
8. [User Lists Feature](#8-user-lists-feature)
9. [Full Work Reader](#9-full-work-reader)
10. [Search Implementation](#10-search-implementation)
11. [Author Enrichment](#11-author-enrichment)
12. [Frontend Changes](#12-frontend-changes)
13. [Admin Dashboard Updates](#13-admin-dashboard-updates)
14. [Implementation Order](#14-implementation-order)
15. [Migration Strategy](#15-migration-strategy)

---

## 1. Executive Summary

### Goal
Extend Doomscrolls from anonymous browsing to a full-featured platform with user accounts, personalization, lists, full-work reading, and search.

### Key Deliverables
1. **User Authentication** - Email/password signup, JWT tokens, session management
2. **Data Sync** - Likes, bookmarks, follows synced to database for logged-in users
3. **Personalized Feed** - Algorithm learns from user behavior + embedding similarity
4. **Lists** - User-created and curated editorial collections
5. **Full Work Reader** - Sequential reading mode with progress tracking
6. **Search** - Hybrid keyword + semantic search (with graceful fallback)
7. **Author Enrichment** - AI-generated bios and profile images
8. **Following** - Follow authors, see their content in dedicated tab
9. **"More Like This"** - Vector similarity for passage discovery
10. **Taste Vectors** - Personalization via centroid of liked passage embeddings

### Tech Additions
- **Auth:** bcrypt for password hashing, jose for JWT
- **Search:** PostgreSQL full-text search (tsvector/tsquery) + pgvector semantic search
- **AI:** Claude API for author bio generation
- **Images:** Placeholder avatars or Wikipedia image scraping
- **Embeddings:** pgvector for vector similarity (embeddings generated separately)

### Embedding Integration Note

Embeddings are being generated as a **parallel workstream**. Phase 2 features should:
- **Consume** embeddings when available (chunk.embedding IS NOT NULL)
- **Fallback gracefully** to keyword search / random selection when NULL
- **NOT generate** embeddings - just use them

Assumed schema on chunks table (being populated separately):
```sql
embedding vector(1536)      -- OpenAI text-embedding-3-small
embedding_model TEXT        -- Model used for generation
embedded_at TIMESTAMPTZ     -- When embedding was created
```

---

## 2. Phase 1 Completion Status

### Completed Features (v1)

| Feature | Status | Notes |
|---------|--------|-------|
| Hono API Server | ✅ | Port 4800, all routes working |
| PostgreSQL Connection | ✅ | Neon serverless |
| Feed Algorithm | ✅ | Diversity protection, length buckets |
| Rate Limiting | ✅ | In-memory, 1000/day per device |
| React Web App | ✅ | Twitter-style layout |
| Zustand Stores | ✅ | localStorage persistence |
| Infinite Scroll | ✅ | IntersectionObserver |
| Like/Bookmark | ✅ | Optimistic UI (local only) |
| Theme Toggle | ✅ | Dark/Light modes |
| Category Filtering | ✅ | 13 categories |
| Admin Dashboard | ✅ | Stats, config, algorithm settings |

### Phase 1 Limitations Being Addressed

| Limitation | Phase 2 Solution |
|------------|------------------|
| Anonymous only | User accounts with email/password |
| Likes/bookmarks local only | Sync to database when logged in |
| No personalization | Algorithm learns from user behavior + taste vectors |
| Curated works only | Open to full 10.3M corpus |
| No search | Hybrid keyword + semantic search |
| No author bios | AI-generated biographies |
| No sequential reading | Full work reader mode |
| No "similar content" | "More Like This" via embeddings |
| Random feed only | Embedding-enhanced personalization |

---

## 3. Phase 2 Feature Overview

### Feature Dependency Graph

```
                    ┌─────────────────┐
                    │  User Accounts  │
                    │  (Foundation)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Data Sync    │   │   Following   │   │    Lists      │
│ (likes/marks) │   │   (authors)   │   │ (user/curated)│
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        ▼                   ▼
┌─────────────────────────────────────┐
│      Personalized Algorithm         │
│  (uses likes, follows, behavior)    │
└─────────────────────────────────────┘

Independent Features (no auth required for viewing):
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Search     │   │  Full Work    │   │    Author     │
│               │   │    Reader     │   │  Enrichment   │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Feature Breakdown

| Feature | Backend Work | Frontend Work | Database Work |
|---------|--------------|---------------|---------------|
| User Accounts | Auth routes, JWT middleware | Login/signup forms, auth state | users table |
| Data Sync | Sync endpoints | Merge local → server | user_likes, user_bookmarks |
| Following | Follow API, following feed | Follow button, Following tab | user_follows |
| Lists | CRUD API for lists | List UI, add-to-list modal | lists, list_chunks |
| Personalization | Algorithm rewrite | None (transparent to UI) | None (uses existing) |
| Full Work Reader | Chunk pagination API | Reader component, progress | None |
| Search | Search endpoint, FTS setup | Search bar, results page | tsvector indexes |
| Author Enrichment | Bio generation job | Bio display, images | authors table update |

---

## 4. Database Schema Changes

### New Tables

```sql
-- =============================================================================
-- PHASE 2 SCHEMA ADDITIONS
-- =============================================================================

-- User accounts
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);

-- User likes (replaces localStorage for logged-in users)
CREATE TABLE user_likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chunk_id)
);

CREATE INDEX idx_user_likes_user ON user_likes(user_id);
CREATE INDEX idx_user_likes_chunk ON user_likes(chunk_id);

-- User bookmarks
CREATE TABLE user_bookmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chunk_id)
);

CREATE INDEX idx_user_bookmarks_user ON user_bookmarks(user_id);

-- Author follows
CREATE TABLE user_follows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, author_id)
);

CREATE INDEX idx_user_follows_user ON user_follows(user_id);
CREATE INDEX idx_user_follows_author ON user_follows(author_id);

-- User-created and curated lists
CREATE TABLE lists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL for curated/editorial lists
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  is_curated BOOLEAN DEFAULT FALSE,  -- TRUE for editorial lists
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_lists_slug ON lists(slug);
CREATE INDEX idx_lists_curated ON lists(is_curated) WHERE is_curated = TRUE;

-- List contents (chunks in a list)
CREATE TABLE list_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,  -- Optional user note about why they added this
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, chunk_id)
);

CREATE INDEX idx_list_chunks_list ON list_chunks(list_id);
CREATE INDEX idx_list_chunks_position ON list_chunks(list_id, position);

-- Reading progress (for full work reader)
CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  current_chunk_index INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, work_id)
);

CREATE INDEX idx_reading_progress_user ON reading_progress(user_id);

-- Session/refresh tokens (for JWT refresh)
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- User reading stats (aggregated for performance)
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  passages_read INTEGER DEFAULT 0,
  passages_liked INTEGER DEFAULT 0,
  passages_bookmarked INTEGER DEFAULT 0,
  authors_explored INTEGER DEFAULT 0,
  works_explored INTEGER DEFAULT 0,
  total_reading_time_seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User taste vectors (computed from liked passage embeddings)
-- Requires pgvector extension
CREATE TABLE user_taste_vectors (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  taste_vector vector(1536) NOT NULL,
  based_on_count INTEGER NOT NULL,    -- Number of liked passages used
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema Modifications to Existing Tables

```sql
-- Add AI-generated bio and image to authors
ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio_generated_at TIMESTAMPTZ;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add full-text search vectors
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE authors ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE works ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_search ON chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_authors_search ON authors USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_works_search ON works USING GIN(search_vector);

-- Populate search vectors (run as migration)
UPDATE chunks SET search_vector = to_tsvector('english', text);
UPDATE authors SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(bio, ''));
UPDATE works SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''));

-- Create triggers to auto-update search vectors
CREATE OR REPLACE FUNCTION update_chunk_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chunk_search_update BEFORE INSERT OR UPDATE ON chunks
FOR EACH ROW EXECUTE FUNCTION update_chunk_search_vector();
```

---

## 5. Authentication System

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Signup:                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Email +  │───▶│ Validate │───▶│  Hash    │───▶│  Create  │  │
│  │ Password │    │  Input   │    │ Password │    │   User   │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                        │         │
│  Login:                                                ▼         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Email +  │───▶│  Lookup  │───▶│  Verify  │───▶│  Issue   │  │
│  │ Password │    │   User   │    │   Hash   │    │   JWT    │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                        │         │
│  Protected Routes:                                     ▼         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Request  │───▶│  Extract │───▶│  Verify  │───▶│  Attach  │  │
│  │ + Token  │    │   JWT    │    │   JWT    │    │ User Ctx │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Strategy

**Access Token:**
- Short-lived (15 minutes)
- Contains: user_id, email, display_name
- Stored in memory (not localStorage for security)

**Refresh Token:**
- Long-lived (7 days)
- Stored in httpOnly cookie
- Hash stored in database for revocation
- Used to get new access tokens

### Implementation Files

```
server/
├── services/
│   └── auth.ts              # Password hashing, JWT signing/verification
├── middleware/
│   └── auth.ts              # JWT verification middleware
├── routes/
│   └── auth.ts              # /api/auth/* routes
└── types/
    └── auth.ts              # Auth-related types
```

### Auth Service (`server/services/auth.ts`)

```typescript
import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateAccessToken(user: { id: string; email: string }): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(secret);
}

export async function generateRefreshToken(user: { id: string }): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
  return new SignJWT({ userId: user.id, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string }> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return { userId: payload.userId as string, email: payload.email as string };
}
```

### Auth Routes (`server/routes/auth.ts`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Create new account | No |
| POST | `/api/auth/login` | Login, get tokens | No |
| POST | `/api/auth/logout` | Revoke refresh token | Yes |
| POST | `/api/auth/refresh` | Get new access token | Refresh cookie |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/me` | Update profile | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |

### Auth Middleware (`server/middleware/auth.ts`)

```typescript
import { Context, Next } from 'hono';
import { verifyAccessToken } from '../services/auth';

// Required auth - returns 401 if not authenticated
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const user = await verifyAccessToken(token);
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

// Optional auth - attaches user if token present, continues either way
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const user = await verifyAccessToken(token);
      c.set('user', user);
    } catch {
      // Invalid token, continue as anonymous
    }
  }
  await next();
}
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- No common passwords (check against list)

---

## 6. API Endpoints - New & Modified

### New Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update profile |

#### User Data Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/likes` | Get user's liked passages |
| POST | `/api/user/likes/sync` | Sync local likes to server |
| GET | `/api/user/bookmarks` | Get user's bookmarks |
| POST | `/api/user/bookmarks/sync` | Sync local bookmarks to server |
| GET | `/api/user/stats` | Get reading statistics |

#### Following
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/following` | List followed authors |
| POST | `/api/authors/:slug/follow` | Follow an author |
| DELETE | `/api/authors/:slug/follow` | Unfollow an author |
| GET | `/api/feed/following` | Feed from followed authors |

#### Lists
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lists` | Get user's lists |
| POST | `/api/lists` | Create new list |
| GET | `/api/lists/:slug` | Get list details |
| PUT | `/api/lists/:slug` | Update list |
| DELETE | `/api/lists/:slug` | Delete list |
| POST | `/api/lists/:slug/chunks` | Add passage to list |
| DELETE | `/api/lists/:slug/chunks/:chunkId` | Remove passage |
| PUT | `/api/lists/:slug/chunks/reorder` | Reorder passages |
| GET | `/api/lists/curated` | Get curated editorial lists |

#### Full Work Reader
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/works/:slug/read` | Get work reading data |
| GET | `/api/works/:slug/chunks` | Get chunks with pagination |
| POST | `/api/works/:slug/progress` | Update reading progress |
| GET | `/api/user/reading` | Get works in progress |

#### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Unified hybrid search (keyword + semantic) |
| GET | `/api/search/passages` | Search passages only |
| GET | `/api/search/authors` | Search authors only |
| GET | `/api/search/works` | Search works only |

#### Similar Passages (Embedding-Based)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passages/:id/similar` | Find similar passages (embedding or fallback) |

#### Embedding Status (Admin/Debug)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/embeddings/status` | Embedding coverage stats |

### Modified Endpoints

| Endpoint | Modification |
|----------|--------------|
| `GET /api/feed` | Add personalization for logged-in users |
| `POST /api/passages/:id/like` | Save to user_likes if authenticated |
| `GET /api/authors/:slug` | Include bio, image_url, is_following |
| `GET /api/admin/stats` | Add user statistics |

---

## 7. Personalized Feed Algorithm

### Algorithm Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEED GENERATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Base Pool Selection                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • For anonymous: curated_works only (Phase 1 behavior)      ││
│  │ • For logged-in: full corpus (10.3M chunks)                 ││
│  │ • Apply min/max length filters from config                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 2: Diversity Constraints (from admin config)              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Exclude recently seen authors (maxAuthorRepeat)           ││
│  │ • Exclude recently seen works (maxWorkRepeat)               ││
│  │ • Apply length diversity buckets if enabled                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 3: Personalization (logged-in users only)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Boost followed authors (high weight)                      ││
│  │ • Boost liked authors/categories (medium weight)            ││
│  │ • Boost similar works to bookmarked (low weight)            ││
│  │ • Decay: recently shown content penalized                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 4: Embedding Similarity (when available)                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Compute user's "taste vector" from liked passages         ││
│  │ • Boost chunks similar to taste vector                      ││
│  │ • Fallback: skip this layer if embeddings unavailable       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 5: Scoring & Ranking                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ final_score = base_random * (1 + personalization_boost)     ││
│  │             * (1 + embedding_similarity * embedding_weight) ││
│  │ ORDER BY final_score DESC                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Personalization Signals

| Signal | Source | Weight | Computation |
|--------|--------|--------|-------------|
| **Followed Author** | user_follows | 3.0x | Direct match |
| **Liked Author** | user_likes → author | 1.5x | Count likes per author |
| **Liked Category** | user_likes → category | 1.3x | Count likes per category |
| **Bookmarked Work** | user_bookmarks → work | 1.2x | Same work or same author |
| **Similar Era** | Derived | 1.1x | Ancient/Medieval/Modern preference |
| **Embedding Similarity** | Taste vector | 1.0-2.0x | Cosine similarity to taste vector |

### Taste Vector System (Embedding-Based Personalization)

The taste vector is the centroid (average) of a user's liked passage embeddings:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASTE VECTOR COMPUTATION                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User likes passages: [P1, P2, P3, P4, P5]                       │
│                                                                  │
│  P1.embedding = [0.1, 0.2, -0.3, ...]                            │
│  P2.embedding = [0.2, 0.1, -0.2, ...]                            │
│  P3.embedding = [0.15, 0.25, -0.1, ...]                          │
│  ...                                                             │
│                                                                  │
│  taste_vector = average([P1, P2, P3, P4, P5].embeddings)         │
│               = [0.15, 0.18, -0.2, ...]                          │
│                                                                  │
│  Cache in user_taste_vectors table for performance               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE user_taste_vectors (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  taste_vector vector(1536) NOT NULL,
  based_on_count INTEGER NOT NULL,    -- Number of liked passages used
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Taste Vector Service:**
```typescript
// server/services/taste-vector.ts

export async function getUserTasteVector(userId: string): Promise<number[] | null> {
  // Check cache first
  const [cached] = await sql`
    SELECT taste_vector, based_on_count, updated_at
    FROM user_taste_vectors
    WHERE user_id = ${userId}
  `;

  // Return cached if fresh (updated within last hour)
  if (cached && isRecent(cached.updated_at, 3600)) {
    return cached.taste_vector;
  }

  // Compute from liked passages that have embeddings
  const likedEmbeddings = await sql`
    SELECT c.embedding
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    WHERE ul.user_id = ${userId}
      AND c.embedding IS NOT NULL  -- Only use embedded chunks
    ORDER BY ul.created_at DESC
    LIMIT 100  -- Use most recent 100 likes
  `;

  // Need minimum likes to compute meaningful taste vector
  if (likedEmbeddings.length < 5) {
    return null;  // Not enough data - fall back to non-embedding personalization
  }

  // Compute centroid (average of all embeddings)
  const tasteVector = computeCentroid(likedEmbeddings.map(l => l.embedding));

  // Cache it
  await sql`
    INSERT INTO user_taste_vectors (user_id, taste_vector, based_on_count)
    VALUES (${userId}, ${JSON.stringify(tasteVector)}::vector, ${likedEmbeddings.length})
    ON CONFLICT (user_id) DO UPDATE SET
      taste_vector = EXCLUDED.taste_vector,
      based_on_count = EXCLUDED.based_on_count,
      updated_at = NOW()
  `;

  return tasteVector;
}

function computeCentroid(vectors: number[][]): number[] {
  const dims = vectors[0].length;
  const centroid = new Array(dims).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dims; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}
```

**Integration into Feed Algorithm:**
```typescript
// In feed-algorithm.ts

async function generatePersonalizedFeed(userId: string, options: FeedOptions) {
  // Get user's taste vector (may be null if not enough likes or no embeddings)
  const tasteVector = await getUserTasteVector(userId);
  const config = await getConfig();

  if (tasteVector && config.enableEmbeddingSimilarity) {
    // Use embedding-enhanced feed
    return generateEmbeddingEnhancedFeed(userId, tasteVector, options);
  } else {
    // Fall back to signal-based personalization (follows, likes, etc.)
    return generateSignalBasedFeed(userId, options);
  }
}

async function generateEmbeddingEnhancedFeed(
  userId: string,
  tasteVector: number[],
  options: FeedOptions
) {
  const { limit } = options;
  const config = await getConfig();

  // Query chunks with embedding similarity score
  const results = await sql`
    WITH candidates AS (
      SELECT
        c.*,
        a.name as author_name, a.slug as author_slug,
        w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        -- Embedding similarity (0-1 range)
        CASE
          WHEN c.embedding IS NOT NULL
          THEN 1 - (c.embedding <=> ${JSON.stringify(tasteVector)}::vector)
          ELSE 0.5  -- Neutral score for chunks without embeddings
        END as embedding_similarity,
        -- Check if followed author
        CASE WHEN uf.author_id IS NOT NULL THEN 1 ELSE 0 END as is_followed,
        -- Diversity: rank within author
        ROW_NUMBER() OVER (PARTITION BY c.author_id ORDER BY RANDOM()) as author_rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      LEFT JOIN user_follows uf ON uf.author_id = c.author_id AND uf.user_id = ${userId}
      WHERE LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
    )
    SELECT *,
      -- Final scoring formula
      (
        RANDOM() * 0.3  -- Base randomness (exploration)
        + embedding_similarity * ${config.embeddingSimilarityWeight}
        + is_followed * ${config.followedAuthorBoost}
      ) as final_score
    FROM candidates
    WHERE author_rank <= 2  -- Max 2 per author for diversity
    ORDER BY final_score DESC
    LIMIT ${limit}
  `;

  return formatFeedResponse(results);
}
```

### Following Feed

Separate endpoint `/api/feed/following` that:
1. Only shows content from followed authors
2. Applies same diversity rules (not all same author)
3. Falls back to suggesting authors to follow if empty

### Algorithm Configuration (Admin Dashboard)

New settings to add:
```typescript
interface PersonalizationConfig {
  // Existing
  enablePersonalization: boolean;      // Master toggle
  followedAuthorBoost: number;         // Default: 3.0
  likedAuthorBoost: number;            // Default: 1.5
  likedCategoryBoost: number;          // Default: 1.3
  bookmarkedWorkBoost: number;         // Default: 1.2
  minSignalsForPersonalization: number; // Default: 5 (likes before activating)
  fullCorpusForLoggedIn: boolean;      // Default: true

  // New: Embedding-based settings
  enableEmbeddingSimilarity: boolean;  // Default: true (auto-disabled if no embeddings)
  embeddingSimilarityWeight: number;   // Default: 0.5 (how much embedding affects score)
  minLikesForTasteVector: number;      // Default: 5 (minimum likes to compute taste)
  tasteVectorRefreshHours: number;     // Default: 1 (how often to recompute)
}
```

### Graceful Fallback Chain

```
1. Try embedding-enhanced personalization
   └─ Requires: user logged in + 5+ likes with embeddings
   └─ Falls back to...

2. Signal-based personalization
   └─ Requires: user logged in + any likes/follows
   └─ Falls back to...

3. Category-filtered feed
   └─ Requires: category selected
   └─ Falls back to...

4. Base random feed (Phase 1 behavior)
   └─ Always works
```

---

## 8. User Lists Feature

### List Types

| Type | Owner | Visibility | Examples |
|------|-------|------------|----------|
| **Curated** | System (user_id=NULL) | Public | "Stoic Essentials", "Love Letters" |
| **User Public** | User | Public | Shareable collections |
| **User Private** | User | Private | Personal reading lists |

### List Operations

**Create List:**
```typescript
POST /api/lists
{
  name: "My Favorites",
  description: "Passages that moved me",
  is_public: false
}
```

**Add to List:**
```typescript
POST /api/lists/:slug/chunks
{
  chunk_id: "abc123",
  note: "This reminded me of..."  // Optional
}
```

**Reorder:**
```typescript
PUT /api/lists/:slug/chunks/reorder
{
  order: ["chunk1", "chunk2", "chunk3"]  // New order
}
```

### Frontend Components

```
webapp/src/
├── components/
│   ├── lists/
│   │   ├── ListCard.tsx           # List preview card
│   │   ├── ListDetail.tsx         # Full list view
│   │   ├── AddToListModal.tsx     # Modal to add passage to list
│   │   ├── CreateListModal.tsx    # Create new list
│   │   └── ListPassageCard.tsx    # Passage in list context (with note)
├── pages/
│   ├── ListsPage.tsx              # Browse lists
│   ├── ListPage.tsx               # Single list view
│   └── MyListsPage.tsx            # User's lists
```

### Curated Lists (Seed Data)

```typescript
const CURATED_LISTS = [
  {
    name: "Stoic Essentials",
    slug: "stoic-essentials",
    description: "Core teachings from Marcus Aurelius, Seneca, and Epictetus",
    is_curated: true,
  },
  {
    name: "Love & Longing",
    slug: "love-and-longing",
    description: "The most beautiful passages about love",
    is_curated: true,
  },
  {
    name: "On Death & Mortality",
    slug: "on-death-mortality",
    description: "Wisdom about life's inevitable end",
    is_curated: true,
  },
  {
    name: "Nature's Beauty",
    slug: "natures-beauty",
    description: "Romantic and transcendentalist nature writing",
    is_curated: true,
  },
  {
    name: "Philosophical Humor",
    slug: "philosophical-humor",
    description: "Wit and wisdom from the great thinkers",
    is_curated: true,
  },
];
```

---

## 9. Full Work Reader

### Reading Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Meditations                              47 of 312   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                                                                  │
│    "Begin each day by telling yourself: Today I shall be        │
│     meeting with interference, ingratitude, insolence,          │
│     disloyalty, ill-will, and selfishness – all of them         │
│     due to the offenders' ignorance of what is good or          │
│     evil."                                                       │
│                                                                  │
│                                                                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ◀ Previous                                          Next ▶     │
│  ─────────────────────────────○──────────────────────────────── │
│                          15% complete                            │
└─────────────────────────────────────────────────────────────────┘
```

### API Design

**Get Work for Reading:**
```typescript
GET /api/works/:slug/read

Response:
{
  work: { id, title, slug, author, year, ... },
  totalChunks: 312,
  userProgress: {
    currentIndex: 46,
    lastReadAt: "2026-01-12T...",
    completed: false
  }
}
```

**Get Chunks (Paginated):**
```typescript
GET /api/works/:slug/chunks?start=45&limit=10

Response:
{
  chunks: [
    { id, text, position_index, type },
    ...
  ],
  total: 312,
  hasMore: true
}
```

**Update Progress:**
```typescript
POST /api/works/:slug/progress
{
  currentIndex: 47
}
```

### Frontend Components

```
webapp/src/
├── components/
│   ├── reader/
│   │   ├── WorkReader.tsx         # Full-screen reader
│   │   ├── ReaderNavigation.tsx   # Previous/Next buttons
│   │   ├── ProgressBar.tsx        # Visual progress indicator
│   │   ├── ChunkDisplay.tsx       # Single chunk display
│   │   └── ReaderSettings.tsx     # Font size, theme, etc.
├── pages/
│   └── ReadPage.tsx               # /read/:workSlug route
```

### Features

- **Swipe Navigation:** Swipe left/right for next/previous
- **Keyboard Navigation:** Arrow keys, j/k for vim users
- **Progress Persistence:** Auto-save position (logged-in users)
- **Reading Mode:** Distraction-free, no sidebars
- **Table of Contents:** Jump to specific chapters if available
- **Font Controls:** Size, serif/sans-serif toggle

---

## 10. Search Implementation

### Hybrid Search Strategy

Search uses **both keyword and semantic** approaches with graceful fallback:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID SEARCH PIPELINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Query: "passages about facing death with courage"               │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         ▼                                         ▼              │
│  ┌─────────────────┐                    ┌─────────────────┐     │
│  │ Keyword Search  │                    │ Semantic Search │     │
│  │ (tsvector/BM25) │                    │ (pgvector)      │     │
│  │ Always works    │                    │ If embedding    │     │
│  │                 │                    │ available       │     │
│  └────────┬────────┘                    └────────┬────────┘     │
│           │                                      │               │
│           └──────────────┬───────────────────────┘               │
│                          ▼                                       │
│               ┌─────────────────────┐                            │
│               │ Reciprocal Rank     │                            │
│               │ Fusion (RRF)        │                            │
│               │ Combine & Re-rank   │                            │
│               └─────────────────────┘                            │
│                                                                  │
│  Fallback: If no embeddings → keyword-only search                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### PostgreSQL Full-Text Search (Keyword)

**Index Setup:**
```sql
-- Already added in schema section
CREATE INDEX idx_chunks_search ON chunks USING GIN(search_vector);
CREATE INDEX idx_authors_search ON authors USING GIN(search_vector);
CREATE INDEX idx_works_search ON works USING GIN(search_vector);
```

### Semantic Search (Embeddings)

**Index Setup (pgvector):**
```sql
-- Assumed to exist (created during embedding generation)
CREATE INDEX idx_chunks_embedding ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);
```

**Semantic Search Query:**
```sql
-- Find semantically similar passages
-- Only searches chunks WITH embeddings
SELECT
  c.id, c.text,
  a.name as author_name,
  w.title as work_title,
  1 - (c.embedding <=> $1::vector) as similarity
FROM chunks c
JOIN authors a ON c.author_id = a.id
LEFT JOIN works w ON c.work_id = w.id
WHERE c.embedding IS NOT NULL  -- Graceful: only use embedded chunks
ORDER BY c.embedding <=> $1::vector
LIMIT 50;
```

### Hybrid Search Query (Combined)

```sql
-- Reciprocal Rank Fusion: combine keyword + semantic results
WITH keyword_results AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, query) DESC) as kw_rank
  FROM chunks, plainto_tsquery('english', $1) query
  WHERE search_vector @@ query
  LIMIT 100
),
semantic_results AS (
  -- Only runs if we have a query embedding
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY embedding <=> $2::vector) as sem_rank
  FROM chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $2::vector
  LIMIT 100
),
combined AS (
  SELECT
    COALESCE(k.id, s.id) as id,
    -- RRF formula: 1/(k+rank) where k=60 is standard
    COALESCE(1.0/(60 + k.kw_rank), 0) +
    COALESCE(1.0/(60 + s.sem_rank), 0) as rrf_score
  FROM keyword_results k
  FULL OUTER JOIN semantic_results s ON k.id = s.id
)
SELECT c.*, combined.rrf_score
FROM combined
JOIN chunks c ON combined.id = c.id
ORDER BY rrf_score DESC
LIMIT 20;
```

### Search Service Implementation

```typescript
// server/services/search.ts

interface SearchOptions {
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid';  // Default: hybrid
  types: ('authors' | 'works' | 'passages')[];
  limit: number;
}

export async function search(options: SearchOptions) {
  const { query, mode, types, limit } = options;

  // Get query embedding for semantic search
  let queryEmbedding: number[] | null = null;
  if (mode !== 'keyword') {
    try {
      queryEmbedding = await getQueryEmbedding(query);
    } catch (error) {
      console.warn('Failed to get query embedding, falling back to keyword');
      // Continue with keyword-only
    }
  }

  // Check if we have any embeddings in DB
  const hasEmbeddings = await checkEmbeddingsExist();

  // Determine actual search mode
  const actualMode =
    mode === 'keyword' ? 'keyword' :
    (!queryEmbedding || !hasEmbeddings) ? 'keyword' :  // Fallback
    mode;

  if (actualMode === 'keyword') {
    return keywordSearch(query, types, limit);
  } else if (actualMode === 'semantic') {
    return semanticSearch(queryEmbedding!, types, limit);
  } else {
    return hybridSearch(query, queryEmbedding!, types, limit);
  }
}

async function checkEmbeddingsExist(): Promise<boolean> {
  // Cache this check - only need to verify once per session
  const [result] = await sql`
    SELECT EXISTS(
      SELECT 1 FROM chunks WHERE embedding IS NOT NULL LIMIT 1
    ) as has_embeddings
  `;
  return result.has_embeddings;
}
```

### Search API

**Unified Search:**
```typescript
GET /api/search?q=marcus+aurelius&mode=hybrid&type=all&limit=20

Response:
{
  query: "marcus aurelius",
  mode: "hybrid",  // Actual mode used (may fallback to "keyword")
  embeddingsAvailable: true,  // Let frontend know
  results: {
    authors: [
      { id, name, slug, era, score }
    ],
    works: [
      { id, title, slug, authorName, score }
    ],
    passages: [
      { id, text, authorName, workTitle, score }
    ]
  },
  totalResults: 47,
  searchTime: 42  // ms
}
```

### Frontend Components

```
webapp/src/
├── components/
│   ├── search/
│   │   ├── SearchBar.tsx          # Input with typeahead
│   │   ├── SearchResults.tsx      # Results display
│   │   ├── SearchFilters.tsx      # Filter by type
│   │   ├── SearchModeToggle.tsx   # Keyword/Semantic toggle
│   │   └── SearchHighlight.tsx    # Highlight matching text
├── pages/
│   └── SearchPage.tsx             # /search route
```

### Search UX

1. **Search Bar:** In left sidebar, expands on focus
2. **Instant Results:** Typeahead as user types (debounced 300ms)
3. **Result Types:** Authors, Works, Passages with tabs
4. **Search Mode:** Toggle between keyword/semantic (show if embeddings available)
5. **Click to Navigate:** Results link to respective pages
6. **Recent Searches:** Show recent searches for logged-in users
7. **Fallback Indicator:** Show "Keyword search (semantic coming soon)" if no embeddings

---

## 10.5 "More Like This" Feature

### Overview

Allow users to discover similar passages based on embedding similarity. Works today with graceful fallback.

### API Endpoint

```typescript
GET /api/passages/:id/similar?limit=10

Response:
{
  passage: { id, text, authorName, workTitle },  // Original passage
  similar: [
    {
      id: "chunk-456",
      text: "Similar passage text...",
      authorName: "Seneca",
      workTitle: "Letters from a Stoic",
      similarity: 0.89  // Cosine similarity score
    },
    ...
  ],
  method: "embedding" | "fallback",  // Which method was used
  embeddingsAvailable: true
}
```

### Implementation

```typescript
// server/services/similar-passages.ts

export async function findSimilarPassages(
  chunkId: string,
  limit: number = 10
): Promise<SimilarPassagesResult> {

  // Get the source passage
  const [source] = await sql`
    SELECT id, text, embedding, author_id, work_id
    FROM chunks WHERE id = ${chunkId}
  `;

  if (!source) {
    throw new NotFoundError('Passage not found');
  }

  // Try embedding-based similarity first
  if (source.embedding) {
    const similar = await sql`
      SELECT
        c.id, c.text,
        a.name as author_name, a.slug as author_slug,
        w.title as work_title, w.slug as work_slug,
        1 - (c.embedding <=> ${source.embedding}) as similarity
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      WHERE c.id != ${chunkId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${source.embedding}
      LIMIT ${limit}
    `;

    return {
      passage: formatPassage(source),
      similar: similar.map(formatPassage),
      method: 'embedding',
      embeddingsAvailable: true
    };
  }

  // Fallback: same author or random from same category
  const fallback = await sql`
    SELECT
      c.id, c.text,
      a.name as author_name, a.slug as author_slug,
      w.title as work_title, w.slug as work_slug,
      0.5 as similarity  -- Placeholder score
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id != ${chunkId}
      AND (
        c.author_id = ${source.author_id}  -- Same author
        OR c.work_id = ${source.work_id}   -- Same work
      )
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return {
    passage: formatPassage(source),
    similar: fallback.map(formatPassage),
    method: 'fallback',
    embeddingsAvailable: false
  };
}
```

### Frontend Component

```tsx
// webapp/src/components/feed/SimilarPassagesModal.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { PassageCard } from './PassageCard';
import { Modal } from '../shared/Modal';

interface Props {
  passageId: string;
  onClose: () => void;
}

export function SimilarPassagesModal({ passageId, onClose }: Props) {
  const { data, isLoading } = useQuery(
    ['similar', passageId],
    () => api.getSimilarPassages(passageId)
  );

  return (
    <Modal onClose={onClose} title="More Like This">
      {isLoading && <div className="p-4">Finding similar passages...</div>}

      {data && (
        <>
          {/* Show method indicator */}
          {data.method === 'fallback' && (
            <div className="px-4 py-2 bg-secondary text-sm text-secondary">
              Showing related passages. Smarter recommendations coming soon!
            </div>
          )}

          {/* Similar passages */}
          <div className="divide-y divide-border">
            {data.similar.map(passage => (
              <PassageCard key={passage.id} passage={passage} compact />
            ))}
          </div>

          {data.similar.length === 0 && (
            <div className="p-4 text-center text-secondary">
              No similar passages found yet.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
```

### Add to PassageCard Actions

```tsx
// In PassageCard.tsx - add new action button

import { Sparkles } from 'lucide-react';

// In actions section:
<button
  onClick={() => setShowSimilarModal(true)}
  className="flex items-center text-secondary hover:text-accent transition-colors group"
  title="More like this"
>
  <div className="p-2 rounded-full group-hover:bg-accent/10 transition-colors">
    <Sparkles className="w-[18px] h-[18px]" />
  </div>
</button>

{showSimilarModal && (
  <SimilarPassagesModal
    passageId={passage.id}
    onClose={() => setShowSimilarModal(false)}
  />
)}
```

### UX Considerations

1. **Loading State:** Show spinner while fetching similar passages
2. **Empty State:** "No similar passages found" with suggestion to like more
3. **Fallback Indicator:** Subtle message when using non-embedding fallback
4. **Similarity Scores:** Optionally show "89% similar" badges (when embedding-based)

---

## 11. Author Enrichment

### AI-Generated Biographies

**Generation Strategy:**
1. Batch job runs on authors without bios
2. Use Claude API to generate 2-3 paragraph bio
3. Store in `authors.bio` column
4. Track generation timestamp for refresh

**Bio Generation Prompt:**
```
Write a concise, engaging biography (2-3 paragraphs, ~150 words) for {author_name}.

Include:
- Birth/death years: {birth_year} - {death_year}
- Nationality: {nationality}
- Era: {era}
- Notable works: {work_titles}

Focus on:
- Their literary significance and influence
- Key themes in their writing
- Why modern readers should explore their work

Style: Accessible, informative, inspiring. Avoid academic jargon.
```

**Generation Service:**
```typescript
// server/services/author-enrichment.ts
import Anthropic from '@anthropic-ai/sdk';

export async function generateAuthorBio(author: Author): Promise<string> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',  // Fast and cheap for this task
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: buildBioPrompt(author)
    }]
  });

  return message.content[0].text;
}

export async function enrichAuthorsJob(limit: number = 100) {
  const authors = await sql`
    SELECT * FROM authors
    WHERE bio IS NULL
    ORDER BY chunk_count DESC
    LIMIT ${limit}
  `;

  for (const author of authors) {
    try {
      const bio = await generateAuthorBio(author);
      await sql`
        UPDATE authors
        SET bio = ${bio}, bio_generated_at = NOW()
        WHERE id = ${author.id}
      `;
      console.log(`Generated bio for ${author.name}`);

      // Rate limit: 1 per second
      await sleep(1000);
    } catch (error) {
      console.error(`Failed to generate bio for ${author.name}:`, error);
    }
  }
}
```

### Author Images

**Options (in order of preference):**

1. **Wikipedia Images:**
   - Many authors have Wikipedia pages with portraits
   - Use Wikipedia API to fetch image URL
   - Respect licensing (most are public domain)

2. **Placeholder Avatars:**
   - Generate unique avatars based on author name
   - Use services like UI Avatars or DiceBear
   - Example: `https://ui-avatars.com/api/?name=Marcus+Aurelius&background=random`

3. **AI-Generated (Future):**
   - Use image generation for authors without photos
   - Requires careful prompt engineering

**Implementation:**
```typescript
// server/services/author-images.ts

export function getAuthorImageUrl(author: Author): string {
  // If we have a stored image, use it
  if (author.image_url) {
    return author.image_url;
  }

  // Fallback to generated placeholder
  const encodedName = encodeURIComponent(author.name);
  return `https://ui-avatars.com/api/?name=${encodedName}&background=1d9bf0&color=fff&size=200`;
}

export async function fetchWikipediaImage(authorName: string): Promise<string | null> {
  // Wikipedia API call to get image
  // Store in authors.image_url if found
}
```

---

## 12. Frontend Changes

### New Components

```
webapp/src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   ├── AuthModal.tsx         # Login/signup in modal
│   │   ├── ProtectedRoute.tsx    # Route guard
│   │   └── UserMenu.tsx          # Dropdown for logged-in user
│   ├── lists/
│   │   ├── ListCard.tsx
│   │   ├── ListDetail.tsx
│   │   ├── AddToListModal.tsx
│   │   └── CreateListModal.tsx
│   ├── reader/
│   │   ├── WorkReader.tsx
│   │   ├── ReaderNavigation.tsx
│   │   └── ProgressBar.tsx
│   ├── search/
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   └── SearchFilters.tsx
│   └── shared/
│       ├── FollowButton.tsx
│       └── AuthorAvatar.tsx      # Shows image or placeholder
```

### New Pages

```
webapp/src/pages/
├── LoginPage.tsx
├── SignupPage.tsx
├── SearchPage.tsx
├── ReadPage.tsx                  # Full work reader
├── ListsPage.tsx                 # Browse curated lists
├── ListPage.tsx                  # Single list
├── MyListsPage.tsx               # User's lists (auth required)
└── SettingsPage.tsx              # User settings (auth required)
```

### Modified Components

| Component | Changes |
|-----------|---------|
| `LeftSidebar` | Add search bar, sign in button, user menu |
| `TopBar` | Add "Following" tab |
| `PassageCard` | Add "Add to List" action |
| `AuthorPage` | Show bio, image, follow button, follower count |
| `WorkPage` | Add "Read Full Work" button |

### State Management Updates

```typescript
// store/authStore.ts - NEW
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// store/userStore.ts - MODIFIED
interface UserState {
  // Existing
  likes: string[];
  bookmarks: string[];
  theme: 'light' | 'dark';

  // New
  following: string[];                 // Author IDs being followed
  lists: List[];                       // User's lists (summary)
  syncStatus: 'synced' | 'pending' | 'error';

  // New methods
  syncToServer: () => Promise<void>;   // Upload local data
  fetchFromServer: () => Promise<void>; // Download server data
  mergeData: (serverData: UserData) => void;  // Merge local + server
}
```

### Route Updates

```typescript
// App.tsx routes
<Routes>
  {/* Existing */}
  <Route path="/" element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="explore" element={<ExplorePage />} />
    <Route path="bookmarks" element={<BookmarksPage />} />
    <Route path="author/:slug" element={<AuthorPage />} />
    <Route path="work/:slug" element={<WorkPage />} />
    <Route path="passage/:id" element={<PassagePage />} />
    <Route path="admin" element={<AdminPage />} />

    {/* New Phase 2 routes */}
    <Route path="login" element={<LoginPage />} />
    <Route path="signup" element={<SignupPage />} />
    <Route path="search" element={<SearchPage />} />
    <Route path="lists" element={<ListsPage />} />
    <Route path="list/:slug" element={<ListPage />} />

    {/* Auth-required routes */}
    <Route element={<ProtectedRoute />}>
      <Route path="my-lists" element={<MyListsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Route>

  {/* Full-screen reader (no layout) */}
  <Route path="read/:slug" element={<ReadPage />} />
</Routes>
```

---

## 13. Admin Dashboard Updates

### New Tab: Users

| Metric | Description |
|--------|-------------|
| Total Users | Count of registered users |
| Active Users (24h) | Users with activity in last 24h |
| New Signups (7d) | Registrations in last week |
| Most Followed Authors | Top 10 by follower count |
| Most Active Users | Top users by interactions |

### Algorithm Tab Updates

Add personalization settings:
- Enable/disable personalization toggle
- Followed author boost slider (1.0 - 5.0)
- Liked author boost slider (1.0 - 3.0)
- Liked category boost slider (1.0 - 2.0)
- Minimum signals for personalization (1-20)
- Full corpus toggle for logged-in users

**Embedding Settings (new section):**
- Enable/disable embedding similarity toggle
- Embedding similarity weight slider (0.0 - 1.0)
- Minimum likes for taste vector (1-20)
- Taste vector refresh interval (hours)
- Status indicator: "X% of chunks have embeddings"

### New Tab: Embeddings

| Metric | Description |
|--------|-------------|
| Total Chunks | 10.3M |
| Chunks with Embeddings | X (Y%) |
| Embedding Model | text-embedding-3-small |
| Last Embedded At | timestamp |
| Users with Taste Vectors | count |

Visual progress bar showing embedding coverage.

### New Tab: Lists

| Feature | Description |
|---------|-------------|
| Curated Lists | Create/edit editorial lists |
| List Statistics | Views, saves per list |
| Popular User Lists | Most followed public lists |

### API Additions

```typescript
// Admin stats additions
GET /api/admin/stats
{
  // Existing
  dataset: { ... },
  feed: { ... },

  // New
  users: {
    total: number,
    active24h: number,
    newSignups7d: number,
    topFollowedAuthors: Array<{ author, followerCount }>,
  },
  lists: {
    totalCurated: number,
    totalUserPublic: number,
    mostPopular: Array<{ list, saveCount }>,
  }
}
```

---

## 14. Implementation Order

### Sprint 1: Foundation (Auth + Database)

**Day 1-2: Database Schema**
- [ ] Create migration script for all new tables
- [ ] Add search vector columns and indexes
- [ ] Run migrations on Neon
- [ ] Verify schema with test queries

**Day 3-4: Authentication Backend**
- [ ] Install bcrypt, jose dependencies
- [ ] Implement auth service (hash, JWT functions)
- [ ] Create auth routes (signup, login, logout, refresh)
- [ ] Implement auth middleware (required, optional)
- [ ] Test with curl/Postman

**Day 5: Authentication Frontend**
- [ ] Create authStore (Zustand)
- [ ] Build LoginForm, SignupForm components
- [ ] Build AuthModal for in-app login
- [ ] Add sign in button to LeftSidebar
- [ ] Implement ProtectedRoute wrapper

### Sprint 2: Data Sync + Following

**Day 6-7: User Data Sync**
- [ ] Create user data routes (likes, bookmarks)
- [ ] Implement sync endpoint (merge local → server)
- [ ] Update userStore with sync logic
- [ ] Add sync status indicator
- [ ] Handle conflicts (server wins for now)

**Day 8-9: Following Feature**
- [ ] Create follow routes (follow, unfollow, list following)
- [ ] Implement FollowButton component
- [ ] Add Following tab to TopBar
- [ ] Create following feed endpoint
- [ ] Show follower count on AuthorPage

### Sprint 3: Personalization + Full Corpus

**Day 10-11: Algorithm Update**
- [ ] Refactor feed algorithm for personalization
- [ ] Add user signals to scoring
- [ ] Open full corpus for logged-in users
- [ ] Add personalization config to admin
- [ ] Test with various user profiles

**Day 12: Algorithm Tuning**
- [ ] Add admin controls for boost values
- [ ] Implement A/B testing infrastructure (optional)
- [ ] Monitor query performance
- [ ] Add caching for user signals

### Sprint 4: Lists

**Day 13-14: Lists Backend**
- [ ] Create lists CRUD routes
- [ ] Create list_chunks routes
- [ ] Seed curated lists
- [ ] Add lists to admin dashboard

**Day 15-16: Lists Frontend**
- [ ] Build ListCard, ListDetail components
- [ ] Build AddToListModal
- [ ] Build CreateListModal
- [ ] Create ListsPage, ListPage, MyListsPage
- [ ] Add "Add to List" action to PassageCard

### Sprint 5: Full Work Reader

**Day 17-18: Reader Backend**
- [ ] Create reading endpoints (work/read, chunks pagination)
- [ ] Create progress tracking routes
- [ ] Test with various works

**Day 19-20: Reader Frontend**
- [ ] Build WorkReader component
- [ ] Build ReaderNavigation, ProgressBar
- [ ] Implement swipe/keyboard navigation
- [ ] Add settings (font size, theme)
- [ ] Add "Read Full Work" to WorkPage

### Sprint 6: Search + Embeddings Integration

**Day 21-22: Search Backend**
- [ ] Populate search vectors (keyword - migration)
- [ ] Create hybrid search service (keyword + semantic with fallback)
- [ ] Create search routes (unified, by type)
- [ ] Add embedding status check endpoint
- [ ] Optimize queries, add limits
- [ ] Test search quality (both modes)

**Day 23: Search Frontend**
- [ ] Build SearchBar with typeahead
- [ ] Build SearchResults with tabs
- [ ] Add search mode toggle (keyword/semantic)
- [ ] Create SearchPage
- [ ] Add SearchBar to LeftSidebar
- [ ] Show fallback indicator when embeddings unavailable

**Day 24: "More Like This" + Taste Vectors**
- [ ] Create similar passages endpoint (with fallback)
- [ ] Add taste vector table and service
- [ ] Integrate taste vector into feed algorithm
- [ ] Build SimilarPassagesModal component
- [ ] Add sparkles button to PassageCard
- [ ] Add embedding settings to admin dashboard

### Sprint 7: Author Enrichment + Polish

**Day 25-26: Author Bios**
- [ ] Create bio generation service
- [ ] Run enrichment job for top authors
- [ ] Display bios on AuthorPage
- [ ] Add image URL handling

**Day 27-28: Polish**
- [ ] Error handling across all new features
- [ ] Loading states and skeletons
- [ ] Responsive design check
- [ ] Performance optimization
- [ ] Verify embedding fallbacks work correctly

**Day 29: Testing + Documentation**
- [ ] End-to-end testing of all flows
- [ ] Test with 0%, 50%, 100% embedding coverage
- [ ] Update API documentation
- [ ] Update user documentation
- [ ] Deploy to production

---

## 15. Migration Strategy

### Database Migrations

Run in order:
1. `001_users_and_auth.sql` - User accounts, tokens
2. `002_user_data.sql` - Likes, bookmarks, follows
3. `003_lists.sql` - Lists and list_chunks
4. `004_reading_progress.sql` - Reading tracking
5. `005_search_vectors.sql` - Full-text search setup
6. `006_author_enrichment.sql` - Bio and image columns

### Local Data Migration

When user signs up/logs in:
1. Check localStorage for existing likes/bookmarks
2. Prompt: "We found X likes and Y bookmarks. Sync to your account?"
3. On confirm, POST to sync endpoints
4. Clear localStorage after successful sync
5. From then on, all data goes to server

### Rollback Plan

Each migration has corresponding down migration:
```bash
# If something breaks
npm run db:migrate:down 006  # Revert author enrichment
npm run db:migrate:down 005  # Revert search
# etc.
```

### Feature Flags

```typescript
// server/config/features.ts
export const FEATURES = {
  AUTH_ENABLED: true,
  PERSONALIZATION_ENABLED: true,
  FULL_CORPUS_FOR_LOGGED_IN: true,
  LISTS_ENABLED: true,
  SEARCH_ENABLED: true,
  READER_ENABLED: true,
  AUTHOR_BIOS_ENABLED: true,
};
```

Can disable features without code changes if issues arise.

---

## Appendix A: Environment Variables

**New variables for Phase 2:**
```bash
# Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=different-secret-key-min-32-chars

# Claude API (for author bios)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: OAuth providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Appendix B: Dependencies to Add

```bash
# Backend
npm install bcrypt jose @anthropic-ai/sdk

# Types
npm install -D @types/bcrypt
```

---

## Appendix C: API Response Formats

### Auth Responses

**Login Success:**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```

**Auth Error:**
```json
{
  "error": "invalid_credentials",
  "message": "Email or password is incorrect"
}
```

### List Response

```json
{
  "list": {
    "id": "list-123",
    "name": "Stoic Essentials",
    "slug": "stoic-essentials",
    "description": "Core teachings...",
    "isPublic": true,
    "isCurated": true,
    "chunkCount": 47,
    "createdAt": "2026-01-12T..."
  },
  "chunks": [
    {
      "id": "chunk-456",
      "text": "The happiness...",
      "author": { "name": "Marcus Aurelius", "slug": "marcus-aurelius" },
      "work": { "title": "Meditations", "slug": "meditations" },
      "position": 0,
      "note": null
    }
  ]
}
```

### Search Response

```json
{
  "query": "marcus aurelius",
  "results": {
    "authors": [
      { "id": "auth-1", "name": "Marcus Aurelius", "slug": "marcus-aurelius", "rank": 0.95 }
    ],
    "works": [
      { "id": "work-1", "title": "Meditations", "slug": "meditations", "authorName": "Marcus Aurelius", "rank": 0.88 }
    ],
    "passages": [
      { "id": "chunk-1", "text": "Begin each day...", "authorName": "Marcus Aurelius", "workTitle": "Meditations", "rank": 0.72 }
    ]
  },
  "totalResults": 47,
  "searchTime": 42
}
```

---

## Appendix D: Embedding Integration Strategy

### Assumed Schema (Populated Separately)

The embedding generation is running as a **parallel workstream**. This plan assumes the following columns exist on the `chunks` table:

```sql
-- Added by embedding generation job (not by Phase 2 code)
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- pgvector index (created when embeddings start populating)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);
```

### Graceful Fallback Strategy

All embedding-consuming features must work when embeddings are partially or fully unavailable:

| Feature | With Embeddings | Fallback (No Embeddings) |
|---------|-----------------|--------------------------|
| **Search** | Hybrid (keyword + semantic) | Keyword-only (tsvector) |
| **"More Like This"** | Vector similarity | Same author/work random |
| **Taste Vector** | Centroid of liked embeddings | Skip, use signal-based |
| **Feed Personalization** | Embedding similarity boost | Author/category boost only |

### Implementation Pattern

```typescript
// Pattern for all embedding-consuming services

async function featureWithEmbeddings(input: Input): Promise<Result> {
  // 1. Check if embeddings are available
  const hasEmbeddings = await checkEmbeddingsExist();

  // 2. Check if specific item has embedding
  const itemHasEmbedding = input.embedding !== null;

  // 3. Branch based on availability
  if (hasEmbeddings && itemHasEmbedding) {
    return embeddingBasedImplementation(input);
  } else {
    return fallbackImplementation(input);
  }
}

// Cache the embeddings check (revalidate every 5 minutes)
let embeddingsExistCache: { value: boolean; timestamp: number } | null = null;

async function checkEmbeddingsExist(): Promise<boolean> {
  const now = Date.now();
  if (embeddingsExistCache && now - embeddingsExistCache.timestamp < 300000) {
    return embeddingsExistCache.value;
  }

  const [result] = await sql`
    SELECT EXISTS(
      SELECT 1 FROM chunks WHERE embedding IS NOT NULL LIMIT 1
    ) as exists
  `;

  embeddingsExistCache = { value: result.exists, timestamp: now };
  return result.exists;
}
```

### API Response Indicators

All embedding-consuming endpoints should indicate what method was used:

```typescript
interface ResponseWithMethod {
  // ... normal response fields
  meta: {
    method: 'embedding' | 'fallback';
    embeddingsAvailable: boolean;
    embeddingCoverage?: number;  // e.g., 0.45 for 45%
  }
}
```

This allows the frontend to:
1. Show appropriate UI (e.g., "Smarter recommendations coming soon")
2. Not break when embeddings become available
3. Provide transparency to users

### Testing Strategy

Test all features with three scenarios:
1. **0% embeddings:** All fallbacks active
2. **Partial embeddings:** Mix of embedding and fallback results
3. **100% embeddings:** Full embedding functionality

```bash
# Simulate no embeddings (for testing)
UPDATE chunks SET embedding = NULL WHERE embedding IS NOT NULL;

# Simulate partial embeddings
UPDATE chunks SET embedding = NULL WHERE random() > 0.5;
```

### Embedding Progress Tracking

Admin dashboard shows embedding status:

```typescript
// GET /api/admin/embeddings/status
{
  total: 10300000,
  embedded: 4500000,
  coverage: 0.437,  // 43.7%
  model: "text-embedding-3-small",
  lastEmbeddedAt: "2026-01-12T15:30:00Z",
  estimatedCompletion: "2026-01-13T08:00:00Z"  // Based on rate
}
```

---

*End of Phase 2 Planning Document*
