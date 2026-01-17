# Doomscrolls Documentation v4

**Version:** 4.0 (Phase 2 + Algorithm Deep Dive + Embeddings)
**Last Updated:** January 17, 2026
**Changes from v3:** Significantly expanded feed algorithm documentation, added embeddings section

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Guide](#2-user-guide)
3. [Feed Algorithm (Deep Dive)](#3-feed-algorithm-deep-dive)
4. [Embeddings & Similarity](#4-embeddings--similarity)
5. [User Accounts](#5-user-accounts)
6. [Social Features](#6-social-features)
7. [Content Discovery](#7-content-discovery)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Legal & Compliance](#9-legal--compliance)
10. [Technical Reference](#10-technical-reference)
11. [Glossary](#11-glossary)

---

## 1. Overview

### What is Doomscrolls?

Doomscrolls transforms the addictive "infinite scroll" experience of social media into something meaningful: an endless stream of humanity's greatest writings. Instead of scrolling through fleeting tweets and status updates, users encounter passages from classical literature, philosophy, poetry, and wisdom texts.

### Core Value Proposition

> "If you're going to scroll, scroll through wisdom."

### Key Features

| Feature | Description |
|---------|-------------|
| Infinite Feed | Endless stream of curated literary passages |
| Smart Diversity | Mix of content types, lengths, authors, and works |
| Personalization | Feed learns from your likes and bookmarks |
| User Accounts | Sync data across devices, follow authors |
| Reading Lists | Create and share custom collections |
| Work Reader | Read complete works passage-by-passage |
| Dark/Light Mode | Toggle between themes |

### Content Library

| Metric | Value |
|--------|-------|
| Total Passages | 10.3 million |
| Works | 17,291 |
| Authors | 7,664 |
| Curated Works (Featured) | 153 |
| Categories | 13 |

---

## 2. User Guide

### 2.1 Getting Started

1. **Open Doomscrolls** at `http://localhost:4800` (or your deployment URL)
2. **Start Scrolling** - passages load automatically as you scroll
3. **Create Account** (optional) - sync data and access more features

### 2.2 Main Feed

The feed presents a curated stream of passages in a Twitter-style layout.

#### Feed Layout
```
+---------------------------------------------------------------------+
|  [Left Sidebar]    |    [Main Feed]       |  [Right Sidebar]        |
|  275px             |    max 600px         |  300px                  |
|                    |                      |                         |
|  - Home            |  +----------------+  |  Discover Authors       |
|  - Explore         |  | PassageCard    |  |  - Featured authors     |
|  - Bookmarks       |  | ...            |  |                         |
|  - Lists           |  +----------------+  |  Categories             |
|  - Profile         |  +----------------+  |  - Browse by topic      |
|  - Theme Toggle    |  | PassageCard    |  |                         |
|  - Admin           |  | ...            |  |  -------------------    |
|                    |  +----------------+  |  Footer: Legal links    |
+---------------------------------------------------------------------+
```

#### Passage Card Anatomy
```
+-----------------------------------------------------+
| [MA]  Marcus Aurelius . Meditations                 |
|       ---------------------------------------------  |
|       The happiness of your life depends upon       |
|       the quality of your thoughts...               |
|       ---------------------------------------------  |
|       [heart 42]      [bookmark]       [share]      |
+-----------------------------------------------------+
```

- **Avatar**: Circular with author initials
- **Author name**: Bold, clickable (opens author page)
- **Work title**: Secondary text, clickable (opens work page)
- **Passage text**: The literary content
- **Like button**: Heart icon with count
- **Bookmark button**: Save for later
- **Share button**: Share via native share or clipboard

### 2.3 Interactions

#### Liking Passages
- Click the heart icon to like
- Like count updates immediately
- Liked passages influence your personalized feed
- Works without account (stored locally)
- With account: synced across devices

#### Bookmarking Passages
- Click the bookmark icon to save
- Access bookmarks from sidebar menu
- Bookmarked passages influence personalization
- Works without account (stored locally)
- With account: synced across devices

#### Sharing Passages
- Click the share icon
- Uses native share API on mobile
- Falls back to clipboard on desktop
- Generates shareable link

### 2.4 Navigation

| Destination | How to Access |
|-------------|---------------|
| Home Feed | Click "Home" in sidebar or Doomscrolls logo |
| Explore | Click "Explore" in sidebar |
| Author Page | Click author name on any passage |
| Work Page | Click work title on any passage |
| Bookmarks | Click "Bookmarks" in sidebar |
| Lists | Click "Lists" in sidebar |
| Profile | Click "Profile" in sidebar (requires account) |
| Admin | Click "Admin" in sidebar |

### 2.5 Theme Toggle

- Click the sun/moon icon in the sidebar
- Toggles between Dark Mode (default) and Light Mode
- Preference saved to localStorage

---

## 3. Feed Algorithm (Deep Dive)

This section provides comprehensive technical documentation of the feed algorithm, including the sampling strategy, personalization scoring, diversity enforcement, and pagination system.

### 3.1 Algorithm Architecture Overview

The Doomscrolls feed algorithm uses a **multi-stage pipeline** that combines randomized sampling with diversity constraints and optional personalization scoring:

```
+------------------+     +-------------------+     +------------------+
|  1. Candidate    | --> |  2. Diversity     | --> |  3. Personal-    |
|     Sampling     |     |     Filtering     |     |     ization      |
+------------------+     +-------------------+     +------------------+
        |                        |                        |
   Random SQL            Length/Type Buckets        Score & Rank
   ORDER BY RANDOM()     Author/Work Exclusion      70/30 Split
```

**Key Design Principles:**
- **Random Sampling Over Ranking**: Uses `ORDER BY RANDOM()` for uniform corpus exploration
- **Post-Query Filtering**: Content type diversity applied in-memory after SQL fetch
- **Oversample & Score**: Personalization fetches 5x candidates, scores them, then selects
- **Cursor-Based Diversity**: Sliding window prevents author/work repetition
- **Configurable Everything**: All parameters adjustable via Admin Dashboard

### 3.2 Stage 1: Candidate Sampling

#### Base Query Strategy

The algorithm retrieves candidates using randomized SQL queries with configurable constraints:

```sql
SELECT
  c.id, c.text, c.type,
  c.author_id, a.name as author_name, a.slug as author_slug,
  c.work_id, w.title as work_title, w.slug as work_slug,
  COALESCE(cs.like_count, 0) as like_count
FROM chunks c
JOIN authors a ON c.author_id = a.id
LEFT JOIN works w ON c.work_id = w.id
LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
WHERE LENGTH(c.text) BETWEEN {minLength} AND {maxLength}
  AND w.chunk_count > 10
  AND c.author_id NOT IN ({recentAuthors})
  AND c.work_id NOT IN ({recentWorks})
ORDER BY RANDOM()
LIMIT {limit}
```

#### Three Query Modes

The algorithm selects different query patterns based on user state and category:

| Mode | Trigger Condition | Joins | Corpus |
|------|-------------------|-------|--------|
| **Curated + Category** | Category selected, anonymous user | `curated_works`, `work_categories`, `categories` | 153 curated works |
| **Full + Category** | Category selected, logged-in user | `work_categories`, `categories` | 17,291 works |
| **Curated Only** | No category, anonymous user | `curated_works` | 153 curated works |
| **Full Corpus** | No category, logged-in user | None | 17,291 works |

#### Corpus Access Rules

| User State | Corpus Access | Work Filter |
|------------|--------------|-------------|
| Anonymous | Curated works only | `JOIN curated_works` |
| Logged-in | Full 10.3M passages | `WHERE w.chunk_count > 10` |

The `chunk_count > 10` filter for logged-in users ensures only substantial works appear (avoiding single-page fragments).

### 3.3 Stage 2: Diversity Enforcement

Diversity is enforced through four independent mechanisms that can be combined:

#### 3.3.1 Author Diversity (Recency-Based)

**Purpose**: Prevent the same author from appearing in consecutive feed batches.

**Mechanism**: The cursor tracks the last N author IDs. These are excluded from subsequent queries.

```typescript
// Cursor stores recent authors
cursorData.recentAuthors = ['author-uuid-1', 'author-uuid-2', ...];  // up to 20

// SQL filter
WHERE c.author_id NOT IN (${recentAuthors})
```

**Configuration**:
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `maxAuthorRepeat` | 1-50 | 20 | Exclude last N authors |

**Effect**: With default setting, an author can appear at most once per 20 passages.

#### 3.3.2 Work Diversity (Recency-Based)

**Purpose**: Prevent the same work from appearing in consecutive feed batches.

**Mechanism**: Identical to author diversity but tracking work IDs.

```typescript
// Cursor stores recent works
cursorData.recentWorks = ['work-uuid-1', 'work-uuid-2', ...];  // up to 10

// SQL filter
WHERE c.work_id NOT IN (${recentWorks})
```

**Configuration**:
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `maxWorkRepeat` | 1-100 | 10 | Exclude last N works |

#### 3.3.3 Length Diversity (Bucket-Based)

**Purpose**: Ensure feed contains a mix of short quotes, medium excerpts, and longer passages.

**Mechanism**: Three parallel queries fetch passages from distinct length ranges, then shuffle together.

**Length Buckets**:

| Bucket | Character Range | Default Target | Typical Content |
|--------|-----------------|----------------|-----------------|
| Short | 10 - 150 chars | 30% | Quotes, aphorisms, sayings |
| Medium | 151 - 499 chars | 40% | Standard excerpts, paragraphs |
| Long | 500 - 1000 chars | 30% | Immersive reads, full sections |

**Algorithm**:
```typescript
// Calculate counts per bucket for a 20-item fetch
const totalRatio = shortRatio + mediumRatio + longRatio;  // 100
const shortCount = Math.round((30/100) * 20);  // 6
const longCount = Math.round((30/100) * 20);   // 6
const mediumCount = 20 - 6 - 6;                // 8 (remainder)

// Execute three parallel queries
const [shortPassages, mediumPassages, longPassages] = await Promise.all([
  queryPassagesByLength(10, 150, 6, ...),
  queryPassagesByLength(151, 499, 8, ...),
  queryPassagesByLength(500, 1000, 6, ...),
]);

// Combine and shuffle
passages = shuffle([...shortPassages, ...mediumPassages, ...longPassages]);
```

**Configuration**:
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `lengthDiversityEnabled` | bool | true | Master switch |
| `shortMaxLength` | 10-500 | 150 | Upper bound for "short" |
| `longMinLength` | 200-2000 | 500 | Lower bound for "long" |
| `shortRatio` | 0-100 | 30 | Target % short passages |
| `mediumRatio` | 0-100 | 40 | Target % medium passages |
| `longRatio` | 0-100 | 30 | Target % long passages |

#### 3.3.4 Content Type Diversity (Bucket-Based)

**Purpose**: Ensure feed contains a mix of prose, quotes, poetry, and speeches.

**Type Groupings**:

| Type Group | Database Values | Examples | Default Target |
|------------|-----------------|----------|----------------|
| Prose | `null`, `passage`, `section`, `chapter` | Novel excerpts, essay paragraphs | 20% |
| Quote | `quote`, `saying` | Wisdom quotes, aphorisms | 45% |
| Poetry | `verse`, `poem`, `verse_group` | Poems, stanzas, verses | 30% |
| Speech | `speech` | Famous orations | 5% |

**Algorithm**:
```typescript
// Step 1: Fetch large sample (15x limit, up to 300)
const sampleSize = Math.min(limit * 15, 300);
const candidates = await fetchRandomPassages(sampleSize);

// Step 2: Categorize in-memory
const buckets = { prose: [], quote: [], poetry: [], speech: [] };
for (const passage of candidates) {
  if (['speech'].includes(passage.type)) buckets.speech.push(passage);
  else if (['verse', 'poem', 'verse_group'].includes(passage.type)) buckets.poetry.push(passage);
  else if (['quote', 'saying'].includes(passage.type)) buckets.quote.push(passage);
  else buckets.prose.push(passage);  // null or passage/section/chapter
}

// Step 3: Fill quotas in priority order (rare types first)
const result = [];
result.push(...buckets.speech.slice(0, speechQuota));    // 5% = 1 item
result.push(...buckets.poetry.slice(0, poetryQuota));    // 30% = 6 items
result.push(...buckets.quote.slice(0, quoteQuota));      // 45% = 9 items
result.push(...buckets.prose.slice(0, proseQuota));      // 20% = 4 items

// Step 4: Fill shortfalls with prose (most abundant)
while (result.length < limit && buckets.prose.length > 0) {
  result.push(buckets.prose.shift());
}

return shuffle(result);
```

**Why In-Memory?**: Content type diversity is applied post-fetch because:
1. Type distribution varies significantly by category
2. In-memory categorization is faster than complex SQL CASE statements
3. Allows graceful fallback when rare types are unavailable

**Configuration**:
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `typeDiversityEnabled` | bool | true | Master switch |
| `proseRatio` | 0-100 | 20 | Target % prose |
| `quoteRatio` | 0-100 | 45 | Target % quotes |
| `poetryRatio` | 0-100 | 30 | Target % poetry |
| `speechRatio` | 0-100 | 5 | Target % speeches |

**Note**: Curated works have limited type diversity (~99% prose), so type diversity is most effective for logged-in users with full corpus access.

### 3.4 Stage 3: Personalization

#### When Personalization Activates

Personalization requires:
1. `enablePersonalization` config is `true` (default)
2. User has at least `minSignalsForPersonalization` interactions (default: 3)
3. User is either logged-in OR has local storage signals

#### Signal Collection

The algorithm collects behavioral signals from two sources:

**For Logged-In Users** (server-side):
```sql
-- Liked authors (top 30 by frequency)
SELECT author_id, COUNT(*) as like_count
FROM likes l
JOIN chunks c ON l.chunk_id = c.id
WHERE l.user_id = {userId}
GROUP BY author_id
ORDER BY like_count DESC LIMIT 30;

-- Followed authors (explicit follows)
SELECT author_id FROM follows WHERE user_id = {userId};

-- Liked categories (top 10)
SELECT wc.category_id, COUNT(*) as like_count
FROM likes l
JOIN chunks c ON l.chunk_id = c.id
JOIN work_categories wc ON c.work_id = wc.work_id
WHERE l.user_id = {userId}
GROUP BY wc.category_id
ORDER BY like_count DESC LIMIT 10;

-- Bookmarked works (top 20)
-- Bookmarked authors (top 20)
-- Preferred eras (top 5)
```

**For Anonymous Users** (client-provided):
```typescript
// Client sends in request body
{
  likedChunkIds: ['uuid1', 'uuid2', ...],
  bookmarkedChunkIds: ['uuid3', 'uuid4', ...]
}

// Server derives signals from chunk metadata
const signals = await deriveSignalsFromChunks(likedChunkIds, bookmarkedChunkIds);
```

#### Signal Types and Boost Weights

| Signal | Source | Default Boost | Description |
|--------|--------|---------------|-------------|
| **Followed Author** | Account | 3.0x | Authors you explicitly follow |
| **Liked Author** | Device | 1.5x | Authors whose passages you've liked |
| **Liked Category** | Device | 1.3x | Categories you engage with |
| **Bookmarked Work** | Device | 1.2x | Works you've bookmarked from |
| **Bookmarked Author** | Device | 1.15x | Authors you've bookmarked |
| **Similar Era** | Derived | 1.1x | Time periods matching preferences |
| **Popularity** | Global | 0.3x | Normalized like count |

#### Scoring Algorithm

Each candidate passage receives a score based on signal matches:

```typescript
function calculatePassageScore(passage, signals, config, maxLikeCount): number {
  // Base exploration component (random factor)
  let score = config.baseRandomWeight * Math.random();  // 0.3 * rand(0,1)

  // Account-required signal (highest priority)
  if (signals.followedAuthorIds.includes(passage.author_id)) {
    score += config.followedAuthorBoost;  // +3.0
  }

  // Device-based signals
  if (signals.likedAuthorIds.includes(passage.author_id)) {
    score += config.likedAuthorBoost;  // +1.5
  }

  const matchingCategories = passage.category_ids.filter(
    id => signals.likedCategoryIds.includes(id)
  );
  if (matchingCategories.length > 0) {
    score += config.likedCategoryBoost * Math.min(matchingCategories.length, 2);  // +1.3 to +2.6
  }

  if (signals.bookmarkedWorkIds.includes(passage.work_id)) {
    score += config.bookmarkedWorkBoost;  // +1.2
  }

  if (signals.bookmarkedAuthorIds.includes(passage.author_id)) {
    score += config.bookmarkedAuthorBoost;  // +1.15
  }

  // Derived signals
  if (passage.author_era && signals.preferredEras.includes(passage.author_era)) {
    score += config.similarEraBoost;  // +1.1
  }

  // Popularity (normalized to 0-1 range)
  if (maxLikeCount > 0 && passage.like_count > 0) {
    const normalizedPopularity = passage.like_count / maxLikeCount;
    score += config.popularityBoost * normalizedPopularity;  // +0 to +0.3
  }

  return score;
}
```

**Score Ranges**:
| Scenario | Score Range |
|----------|-------------|
| No signal matches | 0.0 - 0.3 (random only) |
| Liked author match | 1.5 - 1.8 |
| Followed author match | 3.0 - 3.3 |
| Multiple signals (stacked) | Up to ~8.0 |

#### Exploitation vs. Exploration

After scoring, the algorithm balances personalized content with random discovery:

```typescript
// Oversample candidates (5x the requested limit)
const candidates = await fetchCandidates(limit * 5);

// Score all candidates
const scoredPassages = candidates.map(p => ({
  ...p,
  score: calculatePassageScore(p, signals, config, maxLikeCount)
}));

// Sort by score descending
scoredPassages.sort((a, b) => b.score - a.score);

// Split: 70% top-scored (exploitation), 30% random from rest (exploration)
const personalizedCount = Math.round(limit * config.personalizationWeight);  // 14 of 20
const randomCount = limit - personalizedCount;  // 6 of 20

const topScored = scoredPassages.slice(0, personalizedCount);
const remaining = scoredPassages.slice(personalizedCount);
const randomPicks = shuffle(remaining).slice(0, randomCount);

// Final shuffle to interleave
return shuffle([...topScored, ...randomPicks]);
```

**Why 70/30?**: This ratio ensures users see content they'll likely enjoy while still discovering new authors and topics they haven't engaged with yet.

### 3.5 Cursor & Pagination

#### Cursor Structure

The cursor encodes pagination state as base64 JSON:

```typescript
interface CursorData {
  recentAuthors: string[];   // Last 20 author UUIDs
  recentWorks: string[];     // Last 10 work UUIDs
  offset: number;            // Total passages returned (informational)
}

// Encoding
function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

// Decoding
function decodeCursor(cursor: string): CursorData {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return { recentAuthors: [], recentWorks: [], offset: 0 };
  }
}
```

#### Pagination Flow

```
Request 1: GET /api/feed?limit=20
  -> cursorData = { recentAuthors: [], recentWorks: [], offset: 0 }
  <- Returns 20 passages + nextCursor

Request 2: GET /api/feed?limit=20&cursor=eyJyZWNl...
  -> cursorData decoded: { recentAuthors: [20 ids], recentWorks: [10 ids], offset: 20 }
  -> SQL excludes those authors/works
  <- Returns 20 new passages + nextCursor

... continues infinitely
```

#### Cursor Update Logic

```typescript
// After fetching passages, update cursor state
const newRecentAuthors = [
  ...cursorData.recentAuthors,
  ...passages.map(p => p.author_id),
].slice(-config.maxAuthorRepeat);  // Keep only last 20

const newRecentWorks = [
  ...cursorData.recentWorks,
  ...passages.filter(p => p.work_id).map(p => p.work_id),
].slice(-config.maxWorkRepeat);  // Keep only last 10

const nextCursor = encodeCursor({
  recentAuthors: newRecentAuthors,
  recentWorks: newRecentWorks,
  offset: cursorData.offset + passages.length,
});
```

#### "Has More" Detection

```typescript
// Consider "has more" if we got at least 50% of requested
hasMore: passages.length >= limit * 0.5
```

This prevents false positives when the corpus is nearly exhausted.

### 3.6 Categories

Browse passages by category using the horizontal tabs above the feed.

| Category | Description | Icon |
|----------|-------------|------|
| For You | Personalized feed based on your activity | Sparkles |
| Philosophy | Wisdom from Plato, Aristotle, Nietzsche | Brain |
| Poetry | Verses from Shakespeare, Dickinson, Whitman | Feather |
| Fiction | Passages from Tolstoy, Austen, Dostoevsky | Book |
| Stoicism | Marcus Aurelius, Seneca, Epictetus | Mountain |
| Religion & Spirituality | Sacred texts and spiritual wisdom | Sun |
| Essays | Montaigne, Emerson, Thoreau | Pen |
| Drama | Shakespeare's plays and theatrical works | Theater |
| History | Chronicles of human civilization | Scroll |
| Russian Literature | The great Russian masters | Star |
| Ancient | Works from antiquity | Pillar |
| Medieval | Middle Ages literature | Castle |
| Modern | Contemporary classics | Building |
| Romanticism | Emotion and nature celebrated | Heart |

**How Categories Work:**
- Click a category tab to filter the feed
- Feed shows only passages from works in that category
- "For You" shows personalized content across all categories
- Categories are based on work classification, not individual passages
- Category filter is applied via SQL JOIN with `work_categories` table

### 3.7 Feed Endpoints

| Endpoint | Auth Required | Description |
|----------|---------------|-------------|
| `GET /api/feed` | No | Base feed (curated for anon, full corpus for auth) |
| `GET /api/feed?category={slug}` | No | Category-filtered feed |
| `GET /api/feed/following` | Yes | Only passages from followed authors |
| `GET /api/feed/for-you` | Yes | Explicitly personalized feed |

### 3.8 Configuration Summary

All feed algorithm settings are stored in the `app_config` table and cached in server memory.

**File Reference**: `server/services/feed-algorithm.ts` (1,122 lines), `server/services/config.ts` (146 lines)

---

## 4. Embeddings & Similarity

This section documents the embedding system that powers similarity search and will enable future personalization features.

### 4.1 Overview

Doomscrolls uses **OpenAI's text-embedding-3-small** model to generate 1536-dimensional vector embeddings for each passage. These embeddings enable:

1. **Semantic Similarity Search**: Find passages with similar meaning, not just keywords
2. **Similar Passages Feature**: "More like this" recommendations
3. **Future: Taste Vectors**: Personalized feed based on embedding similarity to liked content
4. **Future: Hybrid Search**: Combine keyword and semantic search

### 4.2 Embedding Generation

#### Generation Scripts

Three scripts handle embedding generation with different strategies:

| Script | Purpose | Batch Size | Use Case |
|--------|---------|------------|----------|
| `scripts/generate-embeddings.ts` | Single-worker sequential | 500 | Standard generation |
| `scripts/embed-lower.ts` | Parallel worker (lower IDs) | 250 | 2x throughput |
| `scripts/embed-upper.ts` | Parallel worker (upper IDs) | 250 | 2x throughput |

#### Processing Pipeline

```
+----------------+     +------------------+     +------------------+
| 1. Fetch       | --> | 2. Call OpenAI   | --> | 3. Store in DB   |
|    Unembedded  |     |    Embeddings    |     |    (pgvector)    |
+----------------+     +------------------+     +------------------+

Query: SELECT id, text FROM chunks WHERE embedding IS NULL LIMIT 500
  |
  v
Truncate text to 8000 chars (API safety)
  |
  v
Call: openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
  |
  v
UPDATE chunks SET embedding = $1, embedding_model = 'text-embedding-3-small', embedded_at = NOW()
```

#### Batching & Rate Limiting

**Main Script Configuration**:
- Batch size: 500 chunks per API call
- Batches per cycle: 20 (10,000 chunks then pause)
- Pause between batches: 50ms
- Pause between cycles: 1000ms

**Rate Limit Handling**:
```typescript
// On 429 (Rate Limit)
if (error.status === 429) {
  const retryAfter = error.headers?.['retry-after'] || 60;
  await sleep(retryAfter * 1000);
}

// On other errors
await sleep(5000);  // 5 second delay
```

**Estimated Throughput**:
| Configuration | Chunks/Minute | Time for 10.3M |
|--------------|---------------|----------------|
| Single worker | ~600 | ~6 days |
| Dual workers | ~1,200 | ~3 days |

#### Database Schema

```sql
-- Added to chunks table (Phase 2 migration)
ALTER TABLE chunks ADD COLUMN embedding VECTOR(1536);
ALTER TABLE chunks ADD COLUMN embedding_model TEXT;
ALTER TABLE chunks ADD COLUMN embedded_at TIMESTAMPTZ;

-- Index for similarity search (pgvector)
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops);
```

### 4.3 Similar Passages

#### Endpoint

```
GET /api/passages/:id/similar?limit=10
```

#### Algorithm

```typescript
async function getSimilarPassages(passageId: string, limit: number) {
  // Step 1: Get source passage with embedding
  const source = await sql`
    SELECT id, text, embedding FROM chunks WHERE id = ${passageId}
  `;

  // Step 2: Try embedding-based similarity
  if (source.embedding) {
    const similar = await sql`
      SELECT
        c.id, c.text, c.type,
        a.name as author_name, w.title as work_title,
        1 - (c.embedding <=> ${source.embedding}) as similarity
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      WHERE c.id != ${passageId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${source.embedding}
      LIMIT ${limit}
    `;
    return { passages: similar, method: 'embedding' };
  }

  // Step 3: Fallback to metadata-based similarity
  const fallback = await sql`
    SELECT c.*, a.name as author_name, w.title as work_title
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id != ${passageId}
      AND (c.author_id = ${source.author_id} OR c.work_id = ${source.work_id})
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;
  return { passages: fallback, method: 'fallback' };
}
```

#### pgvector Distance Operators

| Operator | Distance Type | Use Case |
|----------|--------------|----------|
| `<=>` | L2 (Euclidean) | Default similarity |
| `<->` | Cosine | Normalized comparison |
| `<#>` | Inner Product | Magnitude-aware |

### 4.4 Taste Vectors (Planned)

#### Concept

A **taste vector** is a user-specific embedding representing their literary preferences, computed as the average of embeddings from passages they've liked.

#### Database Schema (Implemented)

```sql
CREATE TABLE user_taste_vectors (
  user_id TEXT PRIMARY KEY,
  taste_vector VECTOR(1536),
  based_on_count INTEGER,
  updated_at TIMESTAMPTZ
);
```

#### Planned Computation

```typescript
async function computeTasteVector(userId: string) {
  // Get embeddings of all liked passages
  const likedEmbeddings = await sql`
    SELECT c.embedding
    FROM likes l
    JOIN chunks c ON l.chunk_id = c.id
    WHERE l.user_id = ${userId}
      AND c.embedding IS NOT NULL
  `;

  if (likedEmbeddings.length < config.minLikesForTasteVector) {
    return null;  // Not enough data
  }

  // Compute average embedding (element-wise mean)
  const tasteVector = averageVectors(likedEmbeddings.map(r => r.embedding));

  // Store in database
  await sql`
    INSERT INTO user_taste_vectors (user_id, taste_vector, based_on_count, updated_at)
    VALUES (${userId}, ${tasteVector}, ${likedEmbeddings.length}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      taste_vector = EXCLUDED.taste_vector,
      based_on_count = EXCLUDED.based_on_count,
      updated_at = NOW()
  `;

  return tasteVector;
}
```

#### Planned Feed Integration

```typescript
// In calculatePassageScore(), add embedding similarity
if (config.enableEmbeddingSimilarity && userTasteVector && passage.embedding) {
  const similarity = 1 - vectorDistance(userTasteVector, passage.embedding);
  score += config.embeddingSimilarityWeight * similarity;  // +0 to +0.5
}
```

#### Configuration (Prepared)

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `enableEmbeddingSimilarity` | bool | true | Master switch |
| `embeddingSimilarityWeight` | 0-100% | 50% | Weight in feed scoring |
| `minLikesForTasteVector` | 1-50 | 5 | Min likes to compute vector |
| `tasteVectorRefreshHours` | 0.5-168 | 1 | Recompute interval |

### 4.5 Hybrid Search (Planned)

#### Current Search

The search endpoint currently uses PostgreSQL full-text search only:

```sql
SELECT * FROM chunks
WHERE search_vector @@ plainto_tsquery('english', ${query})
ORDER BY ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC
LIMIT 20
```

#### Planned Hybrid Search

```typescript
async function hybridSearch(query: string, mode: 'keyword' | 'semantic' | 'hybrid') {
  // Embed the query
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  if (mode === 'semantic') {
    // Pure semantic search
    return sql`
      SELECT *, 1 - (embedding <=> ${queryEmbedding}) as score
      FROM chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${queryEmbedding}
      LIMIT 20
    `;
  }

  if (mode === 'hybrid') {
    // Combine keyword + semantic scores
    return sql`
      SELECT *,
        0.5 * ts_rank(search_vector, plainto_tsquery('english', ${query})) +
        0.5 * (1 - (embedding <=> ${queryEmbedding})) as score
      FROM chunks
      WHERE search_vector @@ plainto_tsquery('english', ${query})
        AND embedding IS NOT NULL
      ORDER BY score DESC
      LIMIT 20
    `;
  }
}
```

### 4.6 Embedding Status & Monitoring

#### Admin Dashboard Display

The Admin Dashboard (Users tab) shows embedding progress:
- **Progress Bar**: Passages with embeddings / total passages
- **Percentage**: Completion percentage
- **Real-time Updates**: Refreshes periodically

#### Monitoring Queries

```sql
-- Total progress
SELECT
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as embedded,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE embedding IS NOT NULL) / COUNT(*), 2) as percent
FROM chunks;

-- Embedding by source
SELECT source, COUNT(*) FILTER (WHERE embedding IS NOT NULL) as embedded, COUNT(*) as total
FROM chunks
GROUP BY source
ORDER BY total DESC;

-- Recent embedding rate
SELECT
  DATE_TRUNC('hour', embedded_at) as hour,
  COUNT(*) as count
FROM chunks
WHERE embedded_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### 4.7 Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Embedding Generation | In Progress | Scripts ready, processing 10.3M passages |
| Database Schema | Complete | pgvector enabled, columns added |
| Similar Passages | Complete | Endpoint working with fallback |
| Taste Vector Table | Complete | Schema ready, computation not implemented |
| Taste Vector Computation | Planned | Algorithm designed, not coded |
| Feed Personalization | Planned | Config ready, integration not coded |
| Semantic Search | Planned | Endpoint exists, semantic path not implemented |
| Hybrid Search | Planned | Design complete, not implemented |

---

## 5. User Accounts

### 5.1 Registration

**To create an account:**
1. Click "Sign Up" in the header or sidebar
2. Enter email address
3. Enter password (min 8 characters)
4. Optionally enter display name
5. Click "Create Account"

**Benefits of an account:**
- Sync likes and bookmarks across devices
- Follow authors
- Create reading lists
- Track reading progress
- Access full corpus (10.3M passages)
- Personalized "For You" feed

### 5.2 Login/Logout

**To log in:**
1. Click "Log In" in the header
2. Enter email and password
3. Click "Log In"

**To log out:**
1. Click your profile in the sidebar
2. Click "Log Out"

**Token Management:**
- Access tokens expire after 15 minutes
- Refresh tokens last 7 days
- Automatic token refresh on API calls

### 5.3 Profile Settings

**Access profile:**
1. Click "Profile" in sidebar (when logged in)

**Available settings:**
- Display Name: Your public name
- Change Password: Update your password

**User Stats displayed:**
- Total likes
- Total bookmarks
- Authors following
- Lists created
- Works in progress
- Works completed

### 5.4 Account Deletion

**To delete your account:**
1. Go to Profile page
2. Scroll to "Danger Zone" section at bottom
3. Click "Delete Account"
4. Confirm in the modal dialog
5. Account and all data deleted immediately

**Data deleted includes:**
- User account record
- All likes
- All bookmarks
- All reading lists
- Reading progress
- Author follows

**Important:** This action cannot be undone.

### 5.5 Data Sync

When you create an account, your local data syncs automatically:
- Existing likes -> synced to database
- Existing bookmarks -> synced to database
- New interactions -> saved to both local and server

---

## 6. Social Features

### 6.1 Following Authors

**To follow an author:**
1. Navigate to author page (click author name)
2. Click "Follow" button
3. Button changes to "Following"

**To unfollow:**
1. Navigate to author page
2. Click "Following" button
3. Confirms unfollow

**Following benefits:**
- Passages from followed authors get 3x boost in feed
- Access "Following" feed tab
- Follower count displayed on author page

### 6.2 Following Feed

**Access the Following feed:**
1. Log in to your account
2. Click "Following" tab in feed header

**How it works:**
- Shows only passages from authors you follow
- If no follows, suggests popular authors
- Same diversity rules apply (author, work, length)

### 6.3 Reading Lists

**Creating a list:**
1. Click "Lists" in sidebar
2. Click "Create List"
3. Enter name and description
4. Choose public or private
5. Click "Create"

**Adding passages to a list:**
1. On any passage, click the menu (...)
2. Select "Add to List"
3. Choose a list
4. Passage is added

**Managing lists:**
- View all your lists in Lists page
- Edit name/description
- Delete lists
- Remove passages
- Make public/private

**Curated Lists:**
- Admin-created featured lists
- Available to all users
- Cannot be modified by users

**Note:** Lists can be accessed by either ID (UUID) or slug in URLs.

### 6.4 Sharing Passages

**Share options:**
1. Click share button on passage
2. Mobile: Native share sheet appears
3. Desktop: Link copied to clipboard

**Share format:**
- Direct link to passage page
- Preview shows passage text and author

---

## 7. Content Discovery

### 7.1 Author Pages

**Access**: Click any author name

**Page contents:**
- Author name and avatar
- Life dates (birth/death years)
- Era (Ancient, Medieval, Modern, etc.)
- Nationality
- Primary genre
- Follower count
- Follow/Unfollow button
- List of works
- Random passages from author

### 7.2 Work Pages

**Access**: Click any work title

**Page contents:**
- Work title
- Author (clickable)
- Year published
- Type (novel, poem, play, etc.)
- Genre
- Passage count
- "Read" button for sequential reading
- Paginated list of passages

### 7.3 Work Reader

**Sequential reading experience:**
1. Navigate to work page
2. Click "Read" or "Continue Reading"
3. Passages shown one at a time
4. Use arrows or swipe to navigate
5. Progress saved automatically

**Progress tracking:**
- Current position saved
- Percentage complete shown
- Resume where you left off
- Mark as completed when finished

### 7.4 Similar Passages

**Finding similar content:**
1. Click on a passage to open detail view
2. Scroll down to "Similar Passages"
3. Shows up to 10 related passages

**How similarity works:**
- Uses embedding vectors when available (semantic similarity)
- Falls back to same author/work when embeddings unavailable
- Considers content meaning, not just metadata
- Returns similarity score (0-1) when using embeddings

### 7.5 Search

**Using search:**
1. Click search icon in header
2. Enter search query
3. Results show passages, authors, and works

**Search capabilities:**
- Full-text search of passage content
- Author name search
- Work title search
- Hybrid search (keyword + semantic) planned when embeddings complete

### 7.6 Discover Panel

**Right sidebar features:**

**Discover Authors:**
- 5 randomly selected featured authors
- Click to explore their works
- Refreshes periodically

**Popular Passages:**
- Most liked passages
- Updated in real-time

**Categories:**
- Quick access to all categories
- Work counts displayed

**Footer:**
- Legal links (Privacy Policy, Terms of Service)
- Copyright notice
- Format: "Scroll with purpose. Privacy . Terms (C) 2026 DDP"

---

## 8. Admin Dashboard

**Access**: `http://localhost:4800/admin`

### 8.1 Dashboard Overview

The admin dashboard provides monitoring and configuration across four tabs:
- Dataset: Corpus statistics
- Feed Stats: Engagement metrics
- Users: Phase 2 user data
- Algorithm: Configuration controls

### 8.2 Dataset Tab

**Corpus Statistics:**
| Metric | Description |
|--------|-------------|
| Total Passages | Number of chunks in database (approximate*) |
| Works | Number of literary works |
| Authors | Number of authors |
| Curated Works | Works selected for main feed |

*Note: Passage count uses PostgreSQL's `pg_class.reltuples` for performance (exact counts on 10M+ rows would take 30+ seconds).

**Category Breakdown:**
- Lists all 13 categories
- Shows work count per category
- Category icons displayed

### 8.3 Feed Stats Tab

**Engagement Metrics:**
| Metric | Description |
|--------|-------------|
| Total Likes | Sum of all passage likes |
| Total Views | Sum of all passage views |

**Top Passages:**
- Top 10 most liked passages
- Shows text preview, author, work
- Like count displayed

### 8.4 Users Tab

**User Statistics:**
| Metric | Description |
|--------|-------------|
| Total Users | Registered accounts |
| Active This Week | Users active in last 7 days |
| Users with Likes | Users who have liked passages |
| Users Following | Users following at least one author |

**Embeddings Progress:**
- Processing progress bar
- Passages with embeddings / total
- Percentage complete

**Lists Statistics:**
| Metric | Description |
|--------|-------------|
| Total Lists | All user-created lists |
| Curated | Admin-created featured lists |
| Passages Saved | Total passages across all lists |

**Top Followed Authors:**
- Authors with most followers
- Follower count displayed

### 8.5 Algorithm Tab

All feed algorithm settings with real-time controls.

#### Content Diversity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Author Diversity | 1-50 | 20 | Max 1 appearance per N passages |
| Work Diversity | 1-100 | 10 | Max 1 appearance per N passages |
| Min Length | 1-500 | 10 | Minimum passage characters |
| Max Length | 100-5000 | 1000 | Maximum passage characters |

#### Length Diversity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for length diversity |
| Short Max | 10-500 | 150 | Upper bound for "short" passages |
| Long Min | 200-2000 | 500 | Lower bound for "long" passages |
| Short % | 0-100 | 30 | Target percentage short passages |
| Medium % | 0-100 | 40 | Target percentage medium passages |
| Long % | 0-100 | 30 | Target percentage long passages |

**Visual indicator:**
- Color-coded bar showing distribution
- Green = Short, Yellow = Medium, Blue = Long
- Total percentage shown (should equal 100%)

#### Content Type Mix Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for type diversity |
| Prose % | 0-100 | 20 | Novels, passages, chapters |
| Quote % | 0-100 | 45 | Quotes, sayings, aphorisms |
| Poetry % | 0-100 | 30 | Verses, poems, stanzas |
| Speech % | 0-100 | 5 | Famous speeches, orations |

**Visual indicator:**
- Color-coded bar showing distribution
- Indigo = Prose, Amber = Quote, Pink = Poetry, Emerald = Speech
- Total percentage shown

#### Personalization Section

**Master Settings:**
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Master switch for personalization |
| Min Signals | 0-50 | 3 | Likes/bookmarks before activating |
| Full Corpus | on/off | on | All 10.3M passages for logged-in |

**Signal Weights (Account-Required):**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Followed Author | 0-10x | 3.0x | Boost for followed authors |

**Signal Weights (Device-Based):**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Liked Author | 0-5x | 1.5x | Authors you've liked |
| Liked Category | 0-5x | 1.3x | Categories you engage with |
| Bookmarked Work | 0-5x | 1.2x | Works you've bookmarked |
| Bookmarked Author | 0-5x | 1.15x | Authors you've bookmarked |

**Derived Signals:**
| Signal | Range | Default | Description |
|--------|-------|---------|-------------|
| Similar Era | 0-5x | 1.1x | Matching time periods |
| Popularity | 0-2x | 0.3x | Based on like count |

#### Algorithm Tuning Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Exploration | 0-100% | 30% | Random discovery weight |
| Exploitation | 0-100% | 70% | Personalized content weight |
| Recency Penalty | 0-100% | 50% | Penalty for recent content |

**Visual indicator:**
- Bar showing Exploration (blue) vs Exploitation (accent color)
- Percentages displayed

#### Embedding Similarity Section

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Enable Toggle | on/off | on | Use embedding similarity |
| Similarity Weight | 0-100% | 50% | Weight in scoring |
| Min Likes | 1-50 | 5 | Likes for taste vector |
| Refresh Hours | 0.5-168 | 1 | Recompute interval |

### 8.6 Saving Configuration

- Changes are tracked (button shows "Save Changes" when modified)
- Click "Save Changes" to persist to database
- Configuration cached in server memory
- Applies immediately to new feed requests
- Page shows "No Changes" when config matches saved version

---

## 9. Legal & Compliance

### 9.1 Overview

Doomscrolls implements app store compliance features required for iOS App Store, Google Play Store, and Chrome Web Store submission.

### 9.2 Legal Documents

**Privacy Policy:**
- URL: `/legal/privacy`
- Describes data collection, usage, and retention
- Required for all app stores

**Terms of Service:**
- URL: `/legal/terms`
- Defines acceptable use and user responsibilities
- Required for all app stores

**Footer Display:**
- Located in right sidebar
- Format: "Scroll with purpose. Privacy . Terms (C) 2026 DDP"
- Links open in new browser tab

### 9.3 Account Deletion

Required by Apple since 2022 for any app with user accounts.

**In-App Deletion:**
- Located in Profile page under "Danger Zone"
- Shows confirmation modal listing all data to be deleted
- Warns that action cannot be undone
- Executes via `DELETE /api/auth/me`

**Data Deleted:**
- User account
- All likes
- All bookmarks
- All reading lists (and contents)
- Reading progress
- Author follows
- Refresh tokens

### 9.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/legal/privacy` | GET | Privacy Policy HTML |
| `/legal/terms` | GET | Terms of Service HTML |
| `/api/auth/me` | DELETE | Delete user account (auth required) |

### 9.5 Native App Implementation

For iOS, Android, and Chrome extension implementations, see:
- `/store-compliance/AuditDoomscrollsPlan.md` - Implementation guide
- `/store-compliance/IMPLEMENTATION_NOTES.md` - Code patterns

**Key Requirements by Platform:**

| Platform | Legal Links | Account Deletion | Icon Size |
|----------|-------------|------------------|-----------|
| Web | Footer (done) | Profile page (done) | favicon |
| iOS | Settings/About | In-app required (Apple policy) | 1024x1024 |
| Android | Settings/About | In-app + web URL (Google policy) | 512x512 |
| Chrome | Popup footer | Link to web app | 128x128 |

### 9.6 Provenance, Rights, and Takedown Metadata (Additive)

As of Jan 14, 2026, Doomscrolls includes additive metadata tables that store rights/provenance hints and takedown state without altering core content tables.

**Why this matters (compliance and legal)**
- Provides an explicit `rights_basis` per work to document the assumed rights model (e.g., public domain vs unknown).
- Enables a `takedown_status` flag for takedown requests without deleting content, while keeping a reversible audit trail.
- Adds stable `source_url` and `full_text_url` provenance links for attribution and legal review.

**Current limitations**
- Rights values are heuristic defaults based on source; they are not a legal determination.
- Takedown workflow is not yet exposed in the admin UI; only the data layer is present.

---

## 10. Technical Reference

### 10.1 API Base URL

```
http://localhost:4800/api
```

### 10.2 Authentication

**Headers:**
```
Authorization: Bearer <access_token>
X-Device-ID: <uuid>
Content-Type: application/json
```

**Token flow:**
1. Login -> receive access token + refresh token (cookie)
2. Access token expires in 15 minutes
3. Refresh endpoint returns new access token
4. Refresh token expires in 7 days

### 10.3 Rate Limiting

- 1000 requests per day per device ID
- Resets at midnight UTC
- Returns 429 when exceeded

### 10.4 Pagination

**Cursor-based pagination:**
```
GET /api/feed?cursor=<base64>&limit=20
```

Response:
```json
{
  "passages": [...],
  "nextCursor": "<base64>",
  "hasMore": true
}
```

### 10.5 Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common codes:
- `UNAUTHORIZED` - Invalid or missing token
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `VALIDATION_ERROR` - Invalid input

### 10.6 Additive Metadata Tables (MVP)

These tables were added to support MVP rights/provenance, dedup, and QA without touching `authors`, `works`, or `chunks`.

**Tables and key fields**
- `work_metadata_aug`
  - `rights_basis`: `pd_assumed` or `unknown` by source
  - `takedown_status`: default `active`
  - `edition_label`: user-facing edition tag (e.g., `KJV`, `Standard Ebooks`)
  - `edition_source`: same as `works.source`
  - `source_url`, `full_text_url`: derived canonical source links
  - `canonical_work_id`: normalized (author, title) grouping hint
- `chunk_hashes`
  - `hash`: SHA-256 of normalized chunk text (lowercase + collapsed whitespace)
- `qa_flags`
  - `issue`: `too_short`, `too_long`, `empty_text`
  - `details`: stored rule for the flag

**How these are useful (product + future features)**
- **Attribution UX**: show `edition_label`, `source_url`, and `full_text_url` under passages and in work pages.
- **Source filtering**: allow users to filter by edition/source or show "source badges."
- **Canonical grouping**: group works that are the same title/author across sources for cleaner discovery pages.
- **Exact-duplicate detection**: use `chunk_hashes` to detect exact repeats and reduce feed redundancy.
- **QA gating**: filter or down-rank `qa_flags` items to improve feed quality.
- **Takedown workflows**: `takedown_status` can power removals without deleting source data.

**Notes**
- All fields are additive; no existing IDs or text were altered.

### 10.7 Key File References

| File | Purpose | Lines |
|------|---------|-------|
| `server/services/feed-algorithm.ts` | Feed algorithm implementation | 1,122 |
| `server/services/config.ts` | Configuration management | 146 |
| `server/routes/feed.ts` | Feed API endpoints | 76 |
| `server/routes/passages.ts` | Passage & similarity endpoints | ~200 |
| `server/routes/search.ts` | Search endpoints | ~150 |
| `server/db/migrate-phase2.ts` | Phase 2 schema (embeddings, taste vectors) | ~100 |
| `scripts/generate-embeddings.ts` | Main embedding generation | ~200 |
| `scripts/embed-lower.ts` | Parallel worker (lower IDs) | ~150 |
| `scripts/embed-upper.ts` | Parallel worker (upper IDs) | ~150 |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| Passage | A text excerpt from a work (10-1000 characters) |
| Chunk | Database term for a passage |
| Work | A book, poem, play, or other literary work |
| Curated Works | Hand-selected works included in featured feed |
| Feed | The infinite scroll stream of passages |
| Cursor | Pagination token encoding position + diversity state |
| Diversity | Algorithm constraint preventing repetition |
| Base Algorithm | Global feed settings that apply to all users |
| Personalization | User-specific feed adjustments based on behavior |
| Signal | User action that influences personalization |
| Boost | Multiplier applied to passage score |
| Exploration | Random content for discovery (30% default) |
| Exploitation | Personalized content based on preferences (70% default) |
| Taste Vector | Average embedding of user's liked passages |
| Embedding | 1536-dimensional vector representation of passage content |
| pgvector | PostgreSQL extension for vector similarity search |
| Similarity Score | 0-1 measure of semantic closeness between passages |
| Hybrid Search | Combined keyword + semantic search |
| Compliance | App store requirements (privacy, terms, deletion) |

---

*Document maintained by the Doomscrolls development team.*
