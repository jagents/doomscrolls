# Doomscrolls Phase 2 Coding Plan

**Created:** January 12, 2026
**Last Updated:** January 12, 2026
**Status:** Phase 2 Implementation In Progress
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
8. [Content Diversity Features](#8-content-diversity-features)
9. [User Lists Feature](#9-user-lists-feature)
10. [Full Work Reader](#10-full-work-reader)
11. [Search Implementation](#11-search-implementation)
12. [Author Enrichment](#12-author-enrichment)
13. [Frontend Changes](#13-frontend-changes)
14. [Admin Dashboard Updates](#14-admin-dashboard-updates)
15. [Implementation Status](#15-implementation-status)
16. [Migration Strategy](#16-migration-strategy)

---

## 1. Executive Summary

### Goal
Extend Doomscrolls from anonymous browsing to a full-featured platform with user accounts, personalization, lists, full-work reading, and search.

### Key Deliverables
1. **User Authentication** - Email/password signup, JWT tokens, session management ✅ COMPLETE
2. **Data Sync** - Likes, bookmarks, follows synced to database for logged-in users ✅ COMPLETE
3. **Personalized Feed** - Algorithm learns from user behavior + embedding similarity ✅ COMPLETE
4. **Content Diversity** - Length diversity + Content type mix ✅ COMPLETE
5. **Lists** - User-created and curated editorial collections ✅ COMPLETE
6. **Full Work Reader** - Sequential reading mode with progress tracking ✅ COMPLETE
7. **Search** - Hybrid keyword + semantic search (with graceful fallback) ✅ COMPLETE
8. **Author Enrichment** - AI-generated bios and profile images (PLANNED)
9. **Following** - Follow authors, see their content in dedicated tab ✅ COMPLETE
10. **"More Like This"** - Vector similarity for passage discovery ✅ COMPLETE
11. **Taste Vectors** - Personalization via centroid of liked passage embeddings ✅ COMPLETE

### Tech Additions
- **Auth:** bcrypt for password hashing, jose for JWT
- **Search:** PostgreSQL full-text search (tsvector/tsquery) + pgvector semantic search
- **AI:** Claude API for author bio generation (planned)
- **Images:** Placeholder avatars or Wikipedia image scraping
- **Embeddings:** pgvector for vector similarity (embeddings generated separately)

### Embedding Integration Note

Embeddings are being generated as a **parallel workstream**. Phase 2 features:
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

| Limitation | Phase 2 Solution | Status |
|------------|------------------|--------|
| Anonymous only | User accounts with email/password | ✅ COMPLETE |
| Likes/bookmarks local only | Sync to database when logged in | ✅ COMPLETE |
| No personalization | Algorithm learns from user behavior + taste vectors | ✅ COMPLETE |
| Curated works only | Open to full 10.3M corpus | ✅ COMPLETE |
| No search | Hybrid keyword + semantic search | ✅ COMPLETE |
| No author bios | AI-generated biographies | PLANNED |
| No sequential reading | Full work reader mode | ✅ COMPLETE |
| No "similar content" | "More Like This" via embeddings | ✅ COMPLETE |
| Random feed only | Embedding-enhanced personalization | ✅ COMPLETE |
| No content variety | Length + Type diversity | ✅ COMPLETE |

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

Content Diversity (affects all feeds):
┌───────────────┐   ┌───────────────┐
│    Length     │   │  Content Type │
│   Diversity   │   │   Diversity   │
└───────────────┘   └───────────────┘
```

### Feature Breakdown

| Feature | Backend Work | Frontend Work | Database Work | Status |
|---------|--------------|---------------|---------------|--------|
| User Accounts | Auth routes, JWT middleware | Login/signup forms, auth state | users table | ✅ COMPLETE |
| Data Sync | Sync endpoints | Merge local → server | user_likes, user_bookmarks | ✅ COMPLETE |
| Following | Follow API, following feed | Follow button, Following tab | user_follows | ✅ COMPLETE |
| Lists | CRUD API for lists | List UI, add-to-list modal | lists, list_chunks | ✅ COMPLETE |
| Personalization | Algorithm rewrite | None (transparent to UI) | None (uses existing) | ✅ COMPLETE |
| Content Diversity | Algorithm enhancement | Admin UI controls | app_config JSONB | ✅ COMPLETE |
| Full Work Reader | Chunk pagination API | Reader component, progress | reading_progress | ✅ COMPLETE |
| Search | Search endpoint, FTS setup | Search bar, results page | tsvector indexes | ✅ COMPLETE |
| Author Enrichment | Bio generation job | Bio display, images | authors table update | PLANNED |

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
CREATE TABLE user_lists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL for curated/editorial lists
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_curated BOOLEAN DEFAULT FALSE,  -- TRUE for editorial lists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_lists_user ON user_lists(user_id);
CREATE INDEX idx_user_lists_curated ON user_lists(is_curated) WHERE is_curated = TRUE;

-- List contents (chunks in a list)
CREATE TABLE user_list_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  list_id TEXT NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, chunk_id)
);

CREATE INDEX idx_user_list_items_list ON user_list_items(list_id);

-- Reading progress (for full work reader)
CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  current_index INTEGER NOT NULL DEFAULT 0,
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

-- User taste vectors (computed from liked passage embeddings)
-- Requires pgvector extension
CREATE TABLE user_taste_vectors (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  taste_vector vector(1536) NOT NULL,
  based_on_count INTEGER NOT NULL,    -- Number of liked passages used
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application configuration (stores algorithm settings as JSONB)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
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

### JWT Strategy (IMPLEMENTED)

**Access Token:**
- Short-lived (15 minutes)
- Contains: user_id, email, display_name
- Stored in memory (not localStorage for security)

**Refresh Token:**
- Long-lived (7 days)
- Stored in httpOnly cookie
- Hash stored in database for revocation
- Used to get new access tokens

### Auth Routes (IMPLEMENTED)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Create new account | No |
| POST | `/api/auth/login` | Login, get tokens | No |
| POST | `/api/auth/logout` | Revoke refresh token | Yes |
| POST | `/api/auth/refresh` | Get new access token | Refresh cookie |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/me` | Update profile | Yes |
| POST | `/api/auth/change-password` | Change password | Yes |

---

## 6. API Endpoints - New & Modified

### New Endpoints (ALL IMPLEMENTED)

#### Authentication
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/auth/signup` | Create account | ✅ |
| POST | `/api/auth/login` | Login | ✅ |
| POST | `/api/auth/logout` | Logout | ✅ |
| POST | `/api/auth/refresh` | Refresh access token | ✅ |
| GET | `/api/auth/me` | Get current user | ✅ |
| PUT | `/api/auth/me` | Update profile | ✅ |

#### User Data Sync
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/user/likes` | Get user's liked passages | ✅ |
| POST | `/api/user/likes/sync` | Sync local likes to server | ✅ |
| DELETE | `/api/user/likes/:chunkId` | Remove like | ✅ |
| GET | `/api/user/bookmarks` | Get user's bookmarks | ✅ |
| POST | `/api/user/bookmarks/sync` | Sync local bookmarks to server | ✅ |
| DELETE | `/api/user/bookmarks/:chunkId` | Remove bookmark | ✅ |
| GET | `/api/user/stats` | Get reading statistics | ✅ |
| GET | `/api/user/reading` | Get reading progress | ✅ |

#### Following
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/user/following` | List followed authors | ✅ |
| POST | `/api/authors/:slug/follow` | Follow an author | ✅ |
| DELETE | `/api/authors/:slug/follow` | Unfollow an author | ✅ |
| GET | `/api/feed/following` | Feed from followed authors | ✅ |
| GET | `/api/feed/for-you` | Personalized feed | ✅ |

#### Lists
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/lists` | Get user's lists | ✅ |
| POST | `/api/lists` | Create new list | ✅ |
| GET | `/api/lists/:idOrSlug` | Get list details (accepts UUID or slug) | ✅ |
| PUT | `/api/lists/:idOrSlug` | Update list | ✅ |
| DELETE | `/api/lists/:idOrSlug` | Delete list | ✅ |
| POST | `/api/lists/:idOrSlug/passages` | Add passage to list | ✅ |
| POST | `/api/lists/:idOrSlug/chunks` | Add passage (alias) | ✅ |
| DELETE | `/api/lists/:idOrSlug/passages/:chunkId` | Remove passage | ✅ |
| GET | `/api/lists/curated` | Get curated editorial lists | ✅ |

#### Full Work Reader
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/works/:slug/read` | Get work reading data | ✅ |
| GET | `/api/works/:slug/chunks` | Get chunks with pagination | ✅ |
| POST | `/api/works/:slug/progress` | Update reading progress | ✅ |

#### Search
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/search` | Unified hybrid search | ✅ |

#### Similar Passages
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/passages/:id/similar` | Find similar passages | ✅ |

#### Discovery
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/discover/authors` | Random featured authors | ✅ |
| GET | `/api/discover/popular` | Most liked passages | ✅ |
| GET | `/api/discover/works` | Featured works | ✅ |

---

## 7. Personalized Feed Algorithm

### Algorithm Layers (IMPLEMENTED)

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
│  Layer 2: Content Type Diversity (NEW - Phase 2)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Query large sample (300 passages)                         ││
│  │ • Categorize by type: prose, quote, poetry, speech          ││
│  │ • Select to match target ratios                             ││
│  │ • Fill shortfalls with prose (most abundant)                ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 3: Length Diversity                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Short: minLength to shortMaxLength                        ││
│  │ • Medium: shortMaxLength+1 to longMinLength-1               ││
│  │ • Long: longMinLength to maxLength                          ││
│  │ • Target configurable ratios (default: 30/40/30)            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 4: Author/Work Diversity                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Exclude recently seen authors (maxAuthorRepeat)           ││
│  │ • Exclude recently seen works (maxWorkRepeat)               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 5: Personalization (logged-in users only)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Boost followed authors (3.0x)                             ││
│  │ • Boost liked authors (1.5x)                                ││
│  │ • Boost liked categories (1.3x)                             ││
│  │ • Boost bookmarked works/authors (1.2x/1.15x)               ││
│  │ • Boost similar era (1.1x)                                  ││
│  │ • Popularity boost based on like count (0.3x)               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 6: Embedding Similarity (when available)                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Compute user's "taste vector" from liked passages         ││
│  │ • Boost chunks similar to taste vector                      ││
│  │ • Fallback: skip this layer if embeddings unavailable       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  Layer 7: Final Scoring & Ranking                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ score = baseRandomWeight * random()                         ││
│  │       + followedAuthorBoost (if following)                  ││
│  │       + likedAuthorBoost (if liked author)                  ││
│  │       + likedCategoryBoost (if liked category)              ││
│  │       + bookmarkedWorkBoost (if bookmarked)                 ││
│  │       + bookmarkedAuthorBoost (if bookmarked author)        ││
│  │       + similarEraBoost (if preferred era)                  ││
│  │       + popularityBoost * (likes/maxLikes)                  ││
│  │ ORDER BY score DESC                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Personalization Signals (IMPLEMENTED)

| Signal | Source | Default Weight | Description |
|--------|--------|----------------|-------------|
| **Followed Author** | user_follows | 3.0x | Authors user explicitly follows |
| **Liked Author** | user_likes → author | 1.5x | Authors whose passages user liked |
| **Liked Category** | user_likes → category | 1.3x | Categories user engages with |
| **Bookmarked Work** | user_bookmarks → work | 1.2x | Works user has bookmarked |
| **Bookmarked Author** | user_bookmarks → author | 1.15x | Authors user has bookmarked |
| **Similar Era** | Derived | 1.1x | Ancient/Medieval/Modern preference |
| **Popularity** | chunk_stats.like_count | 0.3x | Normalized like count |

### Algorithm Configuration (IMPLEMENTED)

Full configuration interface in `server/services/config.ts`:

```typescript
interface FeedAlgorithmConfig {
  // Diversity settings
  maxAuthorRepeat: number;           // Default: 20
  maxWorkRepeat: number;             // Default: 10
  minLength: number;                 // Default: 10
  maxLength: number;                 // Default: 1000

  // Length diversity settings
  lengthDiversityEnabled: boolean;   // Default: true
  shortMaxLength: number;            // Default: 150
  longMinLength: number;             // Default: 500
  shortRatio: number;                // Default: 30
  mediumRatio: number;               // Default: 40
  longRatio: number;                 // Default: 30

  // Content type diversity settings
  typeDiversityEnabled: boolean;     // Default: true
  proseRatio: number;                // Default: 20
  quoteRatio: number;                // Default: 45
  poetryRatio: number;               // Default: 30
  speechRatio: number;               // Default: 5

  // Personalization master settings
  enablePersonalization: boolean;    // Default: true
  minSignalsForPersonalization: number;  // Default: 3
  fullCorpusForLoggedIn: boolean;    // Default: true

  // Signal weights
  followedAuthorBoost: number;       // Default: 3.0
  likedAuthorBoost: number;          // Default: 1.5
  likedCategoryBoost: number;        // Default: 1.3
  bookmarkedWorkBoost: number;       // Default: 1.2
  bookmarkedAuthorBoost: number;     // Default: 1.15
  similarEraBoost: number;           // Default: 1.1
  popularityBoost: number;           // Default: 0.3

  // Algorithm tuning
  baseRandomWeight: number;          // Default: 0.3
  personalizationWeight: number;     // Default: 0.7
  recencyPenalty: number;            // Default: 0.5

  // Embedding settings
  enableEmbeddingSimilarity: boolean; // Default: true
  embeddingSimilarityWeight: number;  // Default: 0.5
  minLikesForTasteVector: number;     // Default: 5
  tasteVectorRefreshHours: number;    // Default: 1
}
```

### Graceful Fallback Chain (IMPLEMENTED)

```
1. Try embedding-enhanced personalization
   └─ Requires: user logged in + 5+ likes with embeddings
   └─ Falls back to...

2. Signal-based personalization
   └─ Requires: user logged in + minSignalsForPersonalization likes/follows
   └─ Falls back to...

3. Category-filtered feed
   └─ Requires: category selected
   └─ Falls back to...

4. Base random feed (Phase 1 behavior)
   └─ Always works
```

---

## 8. Content Diversity Features

### 8.1 Length Diversity (IMPLEMENTED)

**Purpose:** Mix short, medium, and long passages for reading variety.

**Length Buckets:**
| Bucket | Range | Default Target |
|--------|-------|----------------|
| Short | minLength to shortMaxLength | 30% |
| Medium | shortMaxLength+1 to longMinLength-1 | 40% |
| Long | longMinLength to maxLength | 30% |

**Default Settings:**
- `shortMaxLength`: 150 characters
- `longMinLength`: 500 characters
- Total range: 10-1000 characters

**Implementation:**
- When enabled, queries each length bucket separately
- Combines results and shuffles for natural distribution
- If a bucket has insufficient results, other buckets fill in

### 8.2 Content Type Diversity (IMPLEMENTED)

**Purpose:** Mix different types of content (prose, quotes, poetry, speeches).

**Type Groups:**
| Type | Database Values | Examples |
|------|-----------------|----------|
| Prose | null, passage, section, chapter | Novel excerpts, essay paragraphs |
| Quote | quote, saying | Wisdom quotes, aphorisms |
| Poetry | verse, poem, verse_group | Poems, stanzas, verses |
| Speech | speech | Famous speeches, orations |

**Default Ratios:**
- Prose: 20%
- Quote: 45%
- Poetry: 30%
- Speech: 5%

**Technical Implementation:**

```typescript
// Content type groupings
const TYPE_GROUPS = {
  prose: [null, 'passage', 'section', 'chapter'],
  quote: ['quote', 'saying'],
  poetry: ['verse', 'poem', 'verse_group'],
  speech: ['speech'],
};
```

**Algorithm:**
1. Query large sample (300 passages) in single query
   - Single query is faster than parallel due to Neon connection pooling
   - Parallel queries serialize to ~5.5s vs ~1s for single query
2. Categorize each passage by type
3. Select from each bucket to match target ratios
4. Prioritize rare types (speech, poetry) over prose
5. Fill remaining slots with prose (most abundant)
6. Shuffle final result with Fisher-Yates algorithm

**Performance Notes:**
- Curated works are ~99% prose, <1% poetry/speech
- Algorithm queries 15x requested limit (max 300) to find rare types
- Targets are approximate due to content availability in curated set
- Full corpus (logged-in users) has more type variety

**Admin Dashboard Controls:**
- Enable/Disable toggle
- Individual sliders for each type (0-100%)
- Visual bar showing distribution
- Total percentage indicator

---

## 9. User Lists Feature (IMPLEMENTED)

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
  isPublic: false
}
```

**Add to List:**
```typescript
POST /api/lists/:id/passages
{
  chunkId: "abc123"
}
```

**List Response:**
```json
{
  "list": {
    "id": "list-123",
    "name": "Stoic Essentials",
    "description": "Core teachings...",
    "isPublic": true,
    "isCurated": true,
    "passageCount": 47,
    "createdAt": "2026-01-12T..."
  },
  "passages": [...]
}
```

---

## 10. Full Work Reader (IMPLEMENTED)

### Reading Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Meditations                              47 of 312   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    "Begin each day by telling yourself: Today I shall be        │
│     meeting with interference, ingratitude, insolence,          │
│     disloyalty, ill-will, and selfishness – all of them         │
│     due to the offenders' ignorance of what is good or          │
│     evil."                                                       │
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
    percentComplete: 15,
    completedAt: null
  }
}
```

**Get Chunks (Paginated):**
```typescript
GET /api/works/:slug/chunks?start=45&limit=10

Response:
{
  chunks: [
    { id, text, index, type },
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

---

## 11. Search Implementation (IMPLEMENTED)

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

### Search API

```typescript
GET /api/search?q=marcus+aurelius&limit=20

Response:
{
  query: "marcus aurelius",
  results: [
    { type: "author", author: {...}, score: 0.95 },
    { type: "work", work: {...}, score: 0.88 },
    { type: "passage", passage: {...}, score: 0.72 }
  ],
  total: 47,
  method: "hybrid" | "keyword"
}
```

---

## 12. "More Like This" Feature (IMPLEMENTED)

### Overview

Allow users to discover similar passages based on embedding similarity with graceful fallback.

### API Endpoint

```typescript
GET /api/passages/:id/similar?limit=10

Response:
{
  passage: { id, text, authorName, workTitle },
  similar: [
    {
      id: "chunk-456",
      text: "Similar passage text...",
      author: { name: "Seneca", slug: "seneca" },
      work: { title: "Letters from a Stoic", slug: "letters-stoic" },
      similarity: "0.89"
    },
    ...
  ],
  method: "embedding" | "fallback",
  embeddingsAvailable: true
}
```

### Implementation

**With Embeddings:**
- Query passages by vector similarity (cosine distance)
- Return similarity scores

**Fallback (No Embeddings):**
- Return passages from same author
- Return passages from same work
- Random selection from similar category

---

## 13. Author Enrichment (PLANNED)

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

### Author Images

**Options (in order of preference):**

1. **Wikipedia Images:** Many authors have Wikipedia pages with portraits
2. **Placeholder Avatars:** Generate unique avatars based on author name
3. **AI-Generated (Future):** Use image generation for authors without photos

---

## 14. Admin Dashboard Updates (IMPLEMENTED)

### Dashboard Tabs

#### Dataset Tab
- Total passages: 10.3M
- Works: 17K
- Authors: 7.6K
- Curated works: 153
- Category breakdown with work counts

#### Feed Stats Tab
- Total likes
- Total views
- Top 10 most liked passages

#### Users Tab (NEW)
- Total users
- Active this week
- Users with likes
- Users following
- Embedding processing progress
- Lists statistics
- Top followed authors

#### Algorithm Tab (EXPANDED)

**Content Diversity Section:**
| Setting | Range | Default |
|---------|-------|---------|
| Author Diversity | 1-50 | 20 |
| Work Diversity | 1-100 | 10 |
| Min Length | 1-500 | 10 |
| Max Length | 100-5000 | 1000 |

**Length Diversity Section:**
| Setting | Range | Default |
|---------|-------|---------|
| Enable Toggle | on/off | on |
| Short Max | 10-500 | 150 |
| Long Min | 200-2000 | 500 |
| Short % | 0-100 | 30 |
| Medium % | 0-100 | 40 |
| Long % | 0-100 | 30 |

Visual bar: Green (Short) / Yellow (Medium) / Blue (Long)

**Content Type Mix Section (NEW):**
| Setting | Range | Default |
|---------|-------|---------|
| Enable Toggle | on/off | on |
| Prose % | 0-100 | 20 |
| Quote % | 0-100 | 45 |
| Poetry % | 0-100 | 30 |
| Speech % | 0-100 | 5 |

Visual bar: Indigo (Prose) / Amber (Quote) / Pink (Poetry) / Emerald (Speech)

**Personalization Section:**
| Setting | Range | Default |
|---------|-------|---------|
| Enable Toggle | on/off | on |
| Min Signals | 0-50 | 3 |
| Full Corpus | on/off | on |

**Signal Weights:**
- Followed Author Boost: 0-10x (default: 3.0)
- Liked Author Boost: 0-5x (default: 1.5)
- Liked Category Boost: 0-5x (default: 1.3)
- Bookmarked Work Boost: 0-5x (default: 1.2)
- Bookmarked Author Boost: 0-5x (default: 1.15)
- Similar Era Boost: 0-5x (default: 1.1)
- Popularity Boost: 0-2x (default: 0.3)

**Algorithm Tuning:**
- Exploration (Random): 0-100% (default: 30%)
- Exploitation (Personalized): 0-100% (default: 70%)
- Recency Penalty: 0-100% (default: 50%)

Visual bar: Blue (Exploration) / Accent (Exploitation)

**Embedding Similarity Section:**
| Setting | Range | Default |
|---------|-------|---------|
| Enable Toggle | on/off | on |
| Similarity Weight | 0-100% | 50% |
| Min Likes | 1-50 | 5 |
| Refresh Hours | 0.5-168 | 1 |

---

## 15. Implementation Status

### Completed Features

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | ✅ COMPLETE | JWT with refresh tokens |
| User Data Sync | ✅ COMPLETE | Likes, bookmarks synced |
| Author Following | ✅ COMPLETE | Follow/unfollow, following feed |
| User Lists | ✅ COMPLETE | Create, manage, curated lists |
| Personalized Feed | ✅ COMPLETE | Multi-variate scoring |
| Length Diversity | ✅ COMPLETE | Short/medium/long buckets |
| Content Type Diversity | ✅ COMPLETE | Prose/quote/poetry/speech mix |
| Full Work Reader | ✅ COMPLETE | Sequential reading with progress |
| Search | ✅ COMPLETE | Hybrid keyword + semantic |
| Similar Passages | ✅ COMPLETE | Embedding + fallback |
| Taste Vectors | ✅ COMPLETE | Centroid-based personalization |
| Admin Dashboard | ✅ COMPLETE | All tabs and controls |

### Planned Features

| Feature | Status | Notes |
|---------|--------|-------|
| Author Bios | PLANNED | Claude API generation |
| Author Images | PLANNED | Wikipedia scraping or placeholders |

---

## 16. Migration Strategy

### Database Migrations

Run in order:
1. `001_users_and_auth.sql` - User accounts, tokens
2. `002_user_data.sql` - Likes, bookmarks, follows
3. `003_lists.sql` - Lists and list_items
4. `004_reading_progress.sql` - Reading tracking
5. `005_search_vectors.sql` - Full-text search setup
6. `006_author_enrichment.sql` - Bio and image columns (future)

### Local Data Migration

When user signs up/logs in:
1. Check localStorage for existing likes/bookmarks
2. Prompt: "We found X likes and Y bookmarks. Sync to your account?"
3. On confirm, POST to sync endpoints
4. From then on, all data goes to server (and local for offline)

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
  AUTHOR_BIOS_ENABLED: false,  // Not yet implemented
};
```

---

## Appendix A: Environment Variables

```bash
# Database
NEON_DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=different-secret-key-min-32-chars

# Claude API (for author bios - future)
ANTHROPIC_API_KEY=sk-ant-...

# Server
PORT=4800
```

---

## Appendix B: Key Files

### Server
- `server/app.ts` - Main server entry point
- `server/routes/index.ts` - Route registration
- `server/routes/feed.ts` - Feed endpoints
- `server/routes/auth.ts` - Authentication endpoints
- `server/routes/user.ts` - User data endpoints
- `server/routes/lists.ts` - Lists endpoints (supports id/slug lookup)
- `server/routes/works.ts` - Works and reader endpoints
- `server/routes/search.ts` - Search endpoint (flat results array)
- `server/routes/admin.ts` - Admin endpoints
- `server/services/feed-algorithm.ts` - Core feed algorithm
- `server/services/admin-stats.ts` - Admin statistics (uses pg_class for fast counts)
- `server/services/config.ts` - Configuration management
- `server/db/client.ts` - Database connection

### Webapp
- `webapp/src/App.tsx` - Main app with routing
- `webapp/src/pages/AdminPage.tsx` - Admin dashboard
- `webapp/src/services/api.ts` - API client
- `webapp/src/store/authStore.ts` - Authentication state
- `webapp/src/store/userStore.ts` - User data state
- `webapp/src/store/feedStore.ts` - Feed state

---

*End of Phase 2 Planning Document*
