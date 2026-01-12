# Doomscrolls Documentation v1

**Version:** 1.0 (Phase 1 MVP)
**Last Updated:** January 12, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [For Users](#2-for-users)
3. [For Executives](#3-for-executives)
4. [For Software Architects](#4-for-software-architects)
5. [Future Roadmap](#5-future-roadmap)

---

## 1. Overview

### What is Doomscrolls?

Doomscrolls transforms the addictive "infinite scroll" experience of social media into something meaningful: an endless stream of humanity's greatest writings. Instead of scrolling through fleeting tweets and status updates, users encounter passages from classical literature, philosophy, poetry, and wisdom texts.

### The Problem We Solve

Modern social media exploits our psychological need for novelty and validation through infinite feeds of ephemeral content. Doomscrolls redirects this habit toward content with lasting value:

- **Same addictive mechanics** - infinite scroll, quick interactions, snackable content
- **Vastly different content** - curated passages from works that have stood the test of time
- **No engagement manipulation** - no ads, no algorithmic anger optimization, no FOMO

### Core Value Proposition

> "If you're going to scroll, scroll through wisdom."

---

## 2. For Users

### Getting Started

1. **Open Doomscrolls** at `http://localhost:4800` (or your deployment URL)
2. **Start Scrolling** - passages load automatically as you scroll
3. **Interact** with passages:
   - **Heart** a passage to save it to your likes
   - **Bookmark** to add to your reading list
   - **Share** to send to friends or social media

### Features

#### The Feed

The main feed presents a curated stream of passages from classical literature. Each passage shows:

- The text itself (50-1000 characters for readability)
- Author name (tap to see more from this author)
- Work title (tap to explore the complete work)
- Like count from all users

#### Categories

Browse passages by category using the tabs at the top:

| Category | Description |
|----------|-------------|
| Philosophy | Wisdom from Plato, Aristotle, Nietzsche, and more |
| Poetry | Verses from Shakespeare, Dickinson, Whitman |
| Fiction | Passages from Tolstoy, Austen, Dostoevsky |
| Stoicism | Marcus Aurelius, Seneca, Epictetus |
| Religion & Spirituality | Sacred texts and spiritual wisdom |
| Essays | Montaigne, Emerson, Thoreau |
| Drama | Shakespeare's plays and theatrical works |
| History | Chronicles of human civilization |
| Russian Literature | The great Russian masters |
| Ancient | Works from antiquity |
| Medieval | Middle Ages literature |
| Modern | Contemporary classics |
| Romanticism | Emotion and nature celebrated |

#### Author & Work Pages

- **Author Page**: View biography, all works, and random passages from that author
- **Work Page**: Explore a specific book, poem, or play with its passages

#### Your Library

- **Bookmarks**: Access your saved passages anytime
- **Likes**: View all passages you've hearted
- **Profile**: See your reading statistics

#### Theme

Toggle between **Dark Mode** (default) and **Light Mode** using the theme button in the sidebar.

### Tips for Best Experience

1. **Let it flow** - Don't actively search, let the feed surprise you
2. **Bookmark generously** - Save anything that resonates for later reflection
3. **Follow the threads** - Tap on authors/works to go deeper on what interests you
4. **Share the wisdom** - Use the share button to spread meaningful content

---

## 3. For Executives

### Business Summary

Doomscrolls is a content delivery platform that transforms passive scrolling into active engagement with classical literature. It represents a new category of "mindful social media" apps.

### Market Opportunity

- **Target Market**: 3.5B social media users globally
- **Niche Focus**: Users seeking meaningful digital experiences
- **Growing Segment**: Digital wellness is a $1.5B market growing 15%+ annually

### Unique Value

| Traditional Social Media | Doomscrolls |
|-------------------------|-------------|
| User-generated content | Curated classical literature |
| Algorithmic manipulation | Diversity-protected random selection |
| Ad-supported | Subscription potential |
| Engagement = time wasted | Engagement = wisdom gained |
| Creates anxiety | Creates calm |

### Content Library

| Metric | Value |
|--------|-------|
| Total Passages | 10.3 million |
| Works | 17,291 |
| Authors | 7,664 |
| Curated Works (Phase 1) | 153 |
| Categories | 13 |

Content sourced from public domain works via Project Gutenberg, Internet Archive, and other open sources.

### Platform Strategy

| Phase | Platform | Timeline |
|-------|----------|----------|
| Phase 1 | Web App | Implemented |
| Phase 2 | iOS App | Planned |
| Phase 3 | Android App | Planned |
| Phase 4 | Chrome Extension | Planned |

### Success Metrics (Phase 1)

- **Technical**: API response time <200ms, 99.9% uptime
- **Engagement**: Average session length, passages per session, return rate
- **Quality**: Bookmark rate, share rate, time-on-passage

### Monetization Options (Future)

1. **Freemium**: Basic access free, premium features subscription
2. **Premium Categories**: Exclusive curated collections
3. **Reading Insights**: Personal analytics and reading history
4. **Offline Mode**: Download passages for offline reading
5. **Ad-Free Guarantee**: Never sell user attention to advertisers

---

## 4. For Software Architects

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 20+ | JavaScript runtime |
| Language | TypeScript | Type safety |
| API Framework | Hono | Fast, lightweight HTTP framework |
| Database | Neon PostgreSQL | Serverless Postgres |
| Frontend | React 18 | UI library |
| Build Tool | Vite | Fast dev/build |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| State | Zustand | Lightweight state management |
| Routing | React Router v6 | Client-side routing |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  React SPA (webapp/dist)                                 │   │
│  │  - Components (Layout, Feed, PassageCard)               │   │
│  │  - Zustand Stores (feedStore, userStore)                │   │
│  │  - React Router (/, /explore, /author/:slug, etc.)      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER LAYER                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Hono Server (Port 4800)                                 │   │
│  │                                                          │   │
│  │  Middleware:                                             │   │
│  │  - CORS (multi-origin)                                  │   │
│  │  - Rate Limiting (1000/day per device)                  │   │
│  │  - Request Logging                                      │   │
│  │  - Error Handling                                       │   │
│  │                                                          │   │
│  │  Routes:                                                 │   │
│  │  - /api/feed         Feed algorithm                     │   │
│  │  - /api/passages     CRUD operations                    │   │
│  │  - /api/authors      Author lookup                      │   │
│  │  - /api/works        Work lookup                        │   │
│  │  - /api/categories   Category list                      │   │
│  │  - /api/discover     Featured content                   │   │
│  │  - /*                Static file serving                │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Neon PostgreSQL (Serverless)                            │   │
│  │                                                          │   │
│  │  Core Tables:                                            │   │
│  │  - chunks (10.3M rows) - passage text + metadata        │   │
│  │  - works (17K rows) - book/poem metadata                │   │
│  │  - authors (7.6K rows) - author info                    │   │
│  │                                                          │   │
│  │  Phase 1 Tables:                                         │   │
│  │  - chunk_stats - global like/view counts                │   │
│  │  - curated_works - selected works for feed              │   │
│  │  - categories - content categories                      │   │
│  │  - work_categories - many-to-many mapping               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Feed Request

```
1. User scrolls → IntersectionObserver triggers
2. feedStore.fetchMore() called
3. GET /api/feed?limit=20&cursor=xxx
4. Feed algorithm executes:
   a. Select from curated_works joined with chunks
   b. Apply diversity filter (exclude recent authors/works)
   c. Filter by text length (50-1000 chars)
   d. Random sort
   e. Build next cursor with recent IDs
5. Return { passages: [...], nextCursor, hasMore }
6. feedStore appends to passages array
7. React renders new PassageCard components
```

### Feed Algorithm Design

The feed algorithm ensures content diversity while maintaining engagement:

```typescript
// Diversity constraints
const CONSTRAINTS = {
  maxAuthorRepeat: 10,  // Same author max 1 in 10 passages
  maxWorkRepeat: 20,    // Same work max 1 in 20 passages
  minLength: 50,        // Minimum passage length
  maxLength: 1000,      // Maximum passage length
};

// Algorithm pseudocode
function generateFeed(cursor, limit):
  recentAuthors = cursor.recentAuthors or []
  recentWorks = cursor.recentWorks or []

  passages = SELECT FROM chunks
    JOIN curated_works ON work_id
    WHERE LENGTH(text) BETWEEN 50 AND 1000
      AND author_id NOT IN recentAuthors
      AND work_id NOT IN recentWorks
    ORDER BY RANDOM()
    LIMIT limit

  newCursor = {
    recentAuthors: last N author_ids,
    recentWorks: last N work_ids
  }

  return { passages, nextCursor: encode(newCursor) }
```

### State Management

**Client-Side (Zustand + localStorage):**

```typescript
// userStore - persisted to localStorage
{
  likes: string[],           // Passage IDs user has liked
  bookmarks: string[],       // Passage IDs user has bookmarked
  theme: 'light' | 'dark',   // UI theme preference
  selectedCategories: string[] // Preferred categories (future)
}

// feedStore - session state
{
  passages: Passage[],       // Currently loaded passages
  cursor: string | null,     // Pagination cursor
  isLoading: boolean,        // Loading state
  hasMore: boolean           // More content available
}
```

**Server-Side (PostgreSQL):**

```sql
-- Global statistics
chunk_stats: {
  chunk_id: string PRIMARY KEY,
  like_count: integer,
  view_count: integer,
  share_count: integer
}
```

### API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/health` | Health check + DB status | `{ status, database }` |
| GET | `/api/feed` | Paginated feed | `{ passages[], nextCursor, hasMore }` |
| GET | `/api/passages/:id` | Single passage | `{ id, text, author, work, like_count }` |
| POST | `/api/passages/:id/like` | Toggle like | `{ like_count }` |
| GET | `/api/authors` | List authors | `{ authors[], limit, offset }` |
| GET | `/api/authors/:slug` | Author detail + works | `{ ...author, works[] }` |
| GET | `/api/authors/:slug/passages` | Author's passages | `{ passages[] }` |
| GET | `/api/works/:slug` | Work detail | `{ ...work, author }` |
| GET | `/api/works/:slug/passages` | Work's passages | `{ passages[] }` |
| GET | `/api/categories` | All categories | `{ categories[] }` |
| GET | `/api/discover/authors` | Random featured authors | `{ authors[] }` |
| GET | `/api/discover/popular` | Most liked passages | `{ passages[] }` |

### Security Considerations

1. **Rate Limiting**: 1000 requests/day per device ID
2. **CORS**: Restricted to known origins
3. **Input Validation**: All user inputs sanitized
4. **No PII Storage**: Phase 1 stores no personal data
5. **SQL Injection**: Uses parameterized queries (postgres-js)

### Scalability Notes

**Current (Phase 1):**
- Single Node.js process
- In-memory rate limiting
- Neon serverless (auto-scales reads)

**Future Considerations:**
- Redis for rate limiting and caching
- Read replicas for database
- CDN for static assets
- Horizontal API scaling with load balancer

### Development Setup

```bash
# Clone and install
git clone <repo>
cd doomscrolls
npm install
cd webapp && npm install && cd ..

# Environment
cp .env.example .env
# Edit .env with NEON_DATABASE_URL

# Seed database
npm run db:seed

# Development
npm run dev            # API with watch
cd webapp && npm run dev  # Vite with HMR

# Production build
cd webapp && npm run build
npm start
```

---

## 5. Future Roadmap

### Phase 2: User Accounts

- User registration/login
- Cloud-synced likes and bookmarks
- Reading history
- Personal recommendations

### Phase 3: Mobile Apps

- Native iOS app (Swift/SwiftUI)
- Native Android app (Kotlin/Compose)
- Shared API backend

### Phase 4: Social Features

- Follow authors
- Share collections
- Community highlights
- Reading groups

### Phase 5: Premium Features

- Subscription model
- Advanced analytics
- Offline mode
- Exclusive collections
- API access for developers

### Phase 6: Chrome Extension

- New tab replacement
- Quick access popup
- Browser-integrated reading

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| Passage | A text excerpt from a work (50-1000 characters) |
| Chunk | Database term for a passage |
| Work | A book, poem, play, or other literary work |
| Curated Works | Hand-selected works included in Phase 1 feed |
| Feed | The infinite scroll stream of passages |
| Cursor | Pagination token encoding position + diversity state |

---

*Document maintained by the Doomscrolls development team.*
