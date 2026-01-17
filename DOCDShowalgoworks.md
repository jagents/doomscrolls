# Doomscrolls Feed Algorithm

**A comprehensive guide to how the feed algorithm works**

Last Updated: January 17, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Algorithm Architecture](#2-algorithm-architecture)
3. [Stage 1: Candidate Sampling](#3-stage-1-candidate-sampling)
4. [Stage 2: Diversity Enforcement](#4-stage-2-diversity-enforcement)
5. [Stage 3: Personalization](#5-stage-3-personalization)
6. [Cursor & Pagination](#6-cursor--pagination)
7. [Embeddings & Similarity](#7-embeddings--similarity)
8. [Default Configuration](#8-default-configuration)
9. [Admin Dashboard](#9-admin-dashboard)
10. [Future Plans](#10-future-plans)

---

## 1. Overview

The Doomscrolls feed algorithm determines which passages appear in a user's infinite scroll feed. It balances several competing goals:

- **Diversity**: Prevent repetitive content (same author, same work, same length, same type)
- **Personalization**: Show content aligned with user preferences
- **Discovery**: Introduce users to new authors and topics
- **Quality**: Surface engaging content from the 10.3M passage corpus

### Key Design Decisions

| Decision | Approach | Rationale |
|----------|----------|-----------|
| Sampling | Random (`ORDER BY RANDOM()`) | Uniform corpus exploration, no cold-start problem |
| Diversity | Cursor-based exclusion + bucket sampling | Guaranteed variety without complex ranking |
| Personalization | Oversample & score | Preserves diversity while surfacing preferred content |
| Exploration | 30% random injection | Prevents filter bubbles |

---

## 2. Algorithm Architecture

The feed algorithm uses a **three-stage pipeline**:

```
+------------------+     +-------------------+     +------------------+
|  1. CANDIDATE    | --> |  2. DIVERSITY     | --> |  3. PERSONAL-    |
|     SAMPLING     |     |     FILTERING     |     |     IZATION      |
+------------------+     +-------------------+     +------------------+
        |                        |                        |
   Random SQL            Length Buckets             Score Candidates
   Corpus Selection      Type Buckets               Rank by Signals
   Category Filter       Author Exclusion          70/30 Split
   Length Filter         Work Exclusion            Final Shuffle
```

### Data Flow

```
Request: GET /api/feed?limit=20&category=philosophy

    [1] Candidate Sampling
        - Query: SELECT ... ORDER BY RANDOM() LIMIT 100 (5x oversample)
        - Filters: category, length, excluded authors/works
        |
        v
    [2] Diversity Filtering
        - Length buckets: 6 short + 8 medium + 6 long = 20
        - Type buckets: 1 speech + 6 poetry + 9 quotes + 4 prose = 20
        - Recent author/work exclusion via cursor
        |
        v
    [3] Personalization (if signals available)
        - Score each candidate based on user signals
        - Select top 14 by score (70%)
        - Select 6 random from remainder (30%)
        - Shuffle together
        |
        v
Response: { passages: [...20 items], nextCursor: "...", hasMore: true }
```

---

## 3. Stage 1: Candidate Sampling

### Base Query

The algorithm retrieves candidates using randomized SQL:

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
WHERE LENGTH(c.text) BETWEEN 10 AND 1000
  AND w.chunk_count > 10
  AND c.author_id NOT IN (recent_author_ids)
  AND c.work_id NOT IN (recent_work_ids)
ORDER BY RANDOM()
LIMIT 100
```

### Corpus Access by User Type

| User Type | Corpus | Filter | Passage Count |
|-----------|--------|--------|---------------|
| Anonymous | Curated works only | `JOIN curated_works` | ~500K from 153 works |
| Logged-in | Full corpus | `WHERE w.chunk_count > 10` | 10.3M from 17,291 works |

**Why curated for anonymous?** Ensures first-time users see high-quality, representative content. The 153 curated works are hand-selected classics.

**Why `chunk_count > 10`?** Filters out fragmentary works (single pages, partial imports) that would provide poor reading experiences.

### Query Modes

The algorithm selects different query patterns:

```
                        +------------------+
                        | Category Filter? |
                        +--------+---------+
                                 |
              +------------------+------------------+
              |                                     |
         [Yes: Category]                    [No: All Categories]
              |                                     |
    +---------+---------+              +-----------+-----------+
    |                   |              |                       |
[Anonymous]        [Logged-in]    [Anonymous]            [Logged-in]
    |                   |              |                       |
Curated +          Full +          Curated              Full Corpus
Category           Category          Only               (no filter)
```

**Mode 1: Curated + Category** (anonymous + category selected)
```sql
JOIN curated_works cw ON c.work_id = cw.work_id
JOIN work_categories wc ON c.work_id = wc.work_id
JOIN categories cat ON wc.category_id = cat.id
WHERE cat.slug = 'philosophy'
```

**Mode 2: Full + Category** (logged-in + category selected)
```sql
JOIN work_categories wc ON c.work_id = wc.work_id
JOIN categories cat ON wc.category_id = cat.id
WHERE cat.slug = 'philosophy'
  AND w.chunk_count > 10
```

**Mode 3: Curated Only** (anonymous + no category)
```sql
JOIN curated_works cw ON c.work_id = cw.work_id
```

**Mode 4: Full Corpus** (logged-in + no category)
```sql
WHERE w.chunk_count > 10
-- No additional joins needed
```

---

## 4. Stage 2: Diversity Enforcement

Four independent diversity mechanisms ensure variety:

### 4.1 Author Diversity (Recency-Based)

**Goal**: Prevent the same author from appearing in consecutive feed batches.

**Mechanism**: The cursor tracks the last N author IDs, excluded from subsequent queries.

```typescript
// Stored in cursor
recentAuthors: ['uuid-1', 'uuid-2', ..., 'uuid-20']

// Applied in SQL WHERE clause
AND c.author_id NOT IN (${recentAuthors})
```

**Default**: `maxAuthorRepeat = 20` (an author can appear at most once per 20 passages)

### 4.2 Work Diversity (Recency-Based)

**Goal**: Prevent the same work from dominating the feed.

**Mechanism**: Same as author diversity but tracking work IDs.

```typescript
// Stored in cursor
recentWorks: ['uuid-1', 'uuid-2', ..., 'uuid-10']

// Applied in SQL WHERE clause
AND c.work_id NOT IN (${recentWorks})
```

**Default**: `maxWorkRepeat = 10` (a work can appear at most once per 10 passages)

### 4.3 Length Diversity (Bucket-Based)

**Goal**: Mix short quotes, medium excerpts, and long immersive reads.

**Length Buckets**:

| Bucket | Range | Default % | Typical Content |
|--------|-------|-----------|-----------------|
| Short | 10-150 chars | 30% | Quotes, aphorisms, sayings |
| Medium | 151-499 chars | 40% | Paragraphs, excerpts |
| Long | 500-1000 chars | 30% | Full sections, immersive reads |

**Mechanism**: Three parallel queries, one per bucket:

```typescript
// For a 20-item fetch with 30/40/30 ratios:
const shortCount = Math.round(0.30 * 20);   // 6
const mediumCount = Math.round(0.40 * 20);  // 8
const longCount = 20 - 6 - 8;               // 6

const [short, medium, long] = await Promise.all([
  queryByLength(10, 150, 6),
  queryByLength(151, 499, 8),
  queryByLength(500, 1000, 6),
]);

return shuffle([...short, ...medium, ...long]);
```

### 4.4 Content Type Diversity (Bucket-Based)

**Goal**: Mix prose, quotes, poetry, and speeches.

**Type Groupings**:

| Group | Database Values | Default % |
|-------|-----------------|-----------|
| Prose | `null`, `passage`, `section`, `chapter` | 20% |
| Quote | `quote`, `saying` | 45% |
| Poetry | `verse`, `poem`, `verse_group` | 30% |
| Speech | `speech` | 5% |

**Mechanism**: Post-query in-memory categorization:

```typescript
// Step 1: Fetch large sample (15x limit, max 300)
const candidates = await fetchRandom(Math.min(limit * 15, 300));

// Step 2: Categorize
const buckets = { prose: [], quote: [], poetry: [], speech: [] };
for (const p of candidates) {
  if (p.type === 'speech') buckets.speech.push(p);
  else if (['verse', 'poem', 'verse_group'].includes(p.type)) buckets.poetry.push(p);
  else if (['quote', 'saying'].includes(p.type)) buckets.quote.push(p);
  else buckets.prose.push(p);
}

// Step 3: Fill quotas (rare types first)
const result = [];
result.push(...buckets.speech.slice(0, 1));    // 5% of 20 = 1
result.push(...buckets.poetry.slice(0, 6));    // 30% of 20 = 6
result.push(...buckets.quote.slice(0, 9));     // 45% of 20 = 9
result.push(...buckets.prose.slice(0, 4));     // 20% of 20 = 4

// Step 4: Fill shortfalls with prose
while (result.length < limit && buckets.prose.length > 0) {
  result.push(buckets.prose.shift());
}
```

**Why in-memory?** Type distribution varies by category. In-memory sorting is faster than complex SQL CASE statements and allows graceful fallback when rare types are unavailable.

**Note**: Curated works are ~99% prose, so type diversity is most effective for logged-in users with full corpus access.

---

## 5. Stage 3: Personalization

### When Does Personalization Activate?

Personalization requires ALL of:
1. `enablePersonalization` config is `true` (default: true)
2. User has at least `minSignalsForPersonalization` interactions (default: 3)
3. User is logged-in OR has client-provided local signals

### Signal Collection

**For Logged-In Users** (server queries user's history):

| Signal | Query | Limit |
|--------|-------|-------|
| Liked Authors | Top authors by like count | 30 |
| Followed Authors | Explicit follows | All |
| Liked Categories | Top categories by engagement | 10 |
| Bookmarked Works | Top works by bookmark count | 20 |
| Bookmarked Authors | Top authors by bookmark count | 20 |
| Preferred Eras | Eras of liked passages | 5 |

**For Anonymous Users** (client sends local storage):
```json
{
  "likedChunkIds": ["uuid1", "uuid2", ...],
  "bookmarkedChunkIds": ["uuid3", "uuid4", ...]
}
```
Server derives author/work/era signals from chunk metadata.

### Signal Weights

| Signal | Type | Default Boost | Description |
|--------|------|---------------|-------------|
| Followed Author | Account | **3.0x** | Highest priority - explicit interest |
| Liked Author | Device | 1.5x | Authors you've engaged with |
| Liked Category | Device | 1.3x | Categories you prefer |
| Bookmarked Work | Device | 1.2x | Works you've saved from |
| Bookmarked Author | Device | 1.15x | Authors you've bookmarked |
| Similar Era | Derived | 1.1x | Matching time periods |
| Popularity | Global | 0.3x | Normalized like count |

### Scoring Algorithm

```typescript
function calculatePassageScore(passage, signals, config, maxLikeCount): number {
  // Base: random exploration component
  let score = config.baseRandomWeight * Math.random();  // 0.3 * [0,1)

  // Account signal (strongest)
  if (signals.followedAuthorIds.includes(passage.author_id)) {
    score += config.followedAuthorBoost;  // +3.0
  }

  // Device signals
  if (signals.likedAuthorIds.includes(passage.author_id)) {
    score += config.likedAuthorBoost;  // +1.5
  }

  const matchingCategories = passage.category_ids.filter(
    id => signals.likedCategoryIds.includes(id)
  );
  if (matchingCategories.length > 0) {
    score += config.likedCategoryBoost * Math.min(matchingCategories.length, 2);
  }

  if (signals.bookmarkedWorkIds.includes(passage.work_id)) {
    score += config.bookmarkedWorkBoost;  // +1.2
  }

  if (signals.bookmarkedAuthorIds.includes(passage.author_id)) {
    score += config.bookmarkedAuthorBoost;  // +1.15
  }

  // Derived signals
  if (signals.preferredEras.includes(passage.author_era)) {
    score += config.similarEraBoost;  // +1.1
  }

  // Popularity (0-1 normalized)
  if (maxLikeCount > 0 && passage.like_count > 0) {
    score += config.popularityBoost * (passage.like_count / maxLikeCount);
  }

  return score;
}
```

### Score Examples

| Scenario | Approximate Score |
|----------|-------------------|
| No signals match | 0.0 - 0.3 |
| Liked author only | 1.5 - 1.8 |
| Followed author only | 3.0 - 3.3 |
| Followed + liked category | 4.3 - 4.6 |
| Multiple signals stacked | Up to ~8.0 |

### Exploitation vs. Exploration (70/30 Split)

After scoring all candidates, the algorithm balances personalization with discovery:

```typescript
// Oversample: fetch 5x the requested limit
const candidates = await fetchCandidates(limit * 5);  // 100 for limit=20

// Score all candidates
const scored = candidates.map(p => ({
  ...p,
  score: calculatePassageScore(p, signals, config, maxLikeCount)
}));

// Sort by score descending
scored.sort((a, b) => b.score - a.score);

// Split: 70% personalized, 30% random
const exploitCount = Math.round(limit * 0.7);  // 14
const exploreCount = limit - exploitCount;      // 6

const topScored = scored.slice(0, exploitCount);           // Top 14
const remaining = scored.slice(exploitCount);               // Remaining 86
const randomPicks = shuffle(remaining).slice(0, exploreCount);  // Random 6

// Final shuffle to interleave
return shuffle([...topScored, ...randomPicks]);
```

**Why 70/30?**
- 70% ensures users see content aligned with their tastes
- 30% prevents filter bubbles and introduces new authors/topics
- Final shuffle prevents predictable ordering (all "good" content at top)

---

## 6. Cursor & Pagination

### Cursor Structure

The cursor encodes pagination state as base64 JSON:

```typescript
interface CursorData {
  recentAuthors: string[];   // Last 20 author UUIDs
  recentWorks: string[];     // Last 10 work UUIDs
  offset: number;            // Total passages returned (informational)
}
```

### Encoding/Decoding

```typescript
function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor: string): CursorData {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return { recentAuthors: [], recentWorks: [], offset: 0 };
  }
}
```

### Pagination Flow

```
Request 1: GET /api/feed?limit=20
  |
  +-> Decode: { recentAuthors: [], recentWorks: [], offset: 0 }
  |
  +-> Fetch 20 passages (no exclusions)
  |
  +-> Encode new cursor:
      {
        recentAuthors: [20 author IDs from results],
        recentWorks: [up to 10 work IDs from results],
        offset: 20
      }
  |
  +-> Response: { passages: [...], nextCursor: "eyJyZWNl...", hasMore: true }

Request 2: GET /api/feed?limit=20&cursor=eyJyZWNl...
  |
  +-> Decode: { recentAuthors: [20 IDs], recentWorks: [10 IDs], offset: 20 }
  |
  +-> Fetch 20 passages, excluding those authors/works
  |
  +-> Update cursor (sliding window):
      recentAuthors = [...old20, ...new20].slice(-20)  // Keep last 20
      recentWorks = [...old10, ...new10].slice(-10)    // Keep last 10
  |
  +-> Response: { passages: [...], nextCursor: "eyJuZXd...", hasMore: true }

... continues infinitely
```

### Cursor Update Logic

```typescript
const newRecentAuthors = [
  ...cursorData.recentAuthors,
  ...passages.map(p => p.author_id),
].slice(-config.maxAuthorRepeat);  // Sliding window, keep last 20

const newRecentWorks = [
  ...cursorData.recentWorks,
  ...passages.filter(p => p.work_id).map(p => p.work_id),
].slice(-config.maxWorkRepeat);  // Sliding window, keep last 10

const nextCursor = encodeCursor({
  recentAuthors: newRecentAuthors,
  recentWorks: newRecentWorks,
  offset: cursorData.offset + passages.length,
});
```

### "Has More" Detection

```typescript
hasMore: passages.length >= limit * 0.5
```

If we got less than 50% of requested, we're likely exhausting available content (rare with 10.3M passages).

---

## 7. Embeddings & Similarity

### Current State

Embeddings are being generated for all 10.3M passages using OpenAI's `text-embedding-3-small` model (1536 dimensions). This enables semantic similarity features.

### Similar Passages (Implemented)

When viewing a passage detail, "Similar Passages" uses embeddings if available:

```sql
-- Embedding-based (when available)
SELECT c.*, 1 - (c.embedding <=> source.embedding) as similarity
FROM chunks c
WHERE c.id != source_id
  AND c.embedding IS NOT NULL
ORDER BY c.embedding <=> source.embedding
LIMIT 10;

-- Fallback (no embedding)
SELECT c.*
FROM chunks c
WHERE c.author_id = source.author_id
   OR c.work_id = source.work_id
ORDER BY RANDOM()
LIMIT 10;
```

### Taste Vectors (Planned)

A **taste vector** represents a user's literary preferences as the average embedding of their liked passages:

```typescript
// Planned computation
async function computeTasteVector(userId: string) {
  const liked = await sql`
    SELECT c.embedding FROM likes l
    JOIN chunks c ON l.chunk_id = c.id
    WHERE l.user_id = ${userId} AND c.embedding IS NOT NULL
  `;

  if (liked.length < 5) return null;  // Need minimum data

  return averageVectors(liked.map(r => r.embedding));
}
```

**Planned feed integration**:
```typescript
// In calculatePassageScore(), if taste vector exists:
if (config.enableEmbeddingSimilarity && userTasteVector && passage.embedding) {
  const similarity = 1 - vectorDistance(userTasteVector, passage.embedding);
  score += config.embeddingSimilarityWeight * similarity;  // +0 to +0.5
}
```

### Hybrid Search (Planned)

Combine keyword and semantic search:

```sql
-- Hybrid: keyword + semantic
SELECT *,
  0.5 * ts_rank(search_vector, query) +
  0.5 * (1 - (embedding <=> query_embedding)) as score
FROM chunks
WHERE search_vector @@ query
  AND embedding IS NOT NULL
ORDER BY score DESC
LIMIT 20;
```

---

## 8. Default Configuration

All settings with their default values:

### Content Constraints

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `minLength` | 10 | 1-500 | Minimum passage characters |
| `maxLength` | 1000 | 100-5000 | Maximum passage characters |

### Diversity Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `maxAuthorRepeat` | 20 | 1-50 | Max 1 author appearance per N passages |
| `maxWorkRepeat` | 10 | 1-100 | Max 1 work appearance per N passages |

### Length Diversity

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `lengthDiversityEnabled` | true | bool | Master switch |
| `shortMaxLength` | 150 | 10-500 | Upper bound for "short" |
| `longMinLength` | 500 | 200-2000 | Lower bound for "long" |
| `shortRatio` | 30 | 0-100 | Target % short passages |
| `mediumRatio` | 40 | 0-100 | Target % medium passages |
| `longRatio` | 30 | 0-100 | Target % long passages |

### Content Type Diversity

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `typeDiversityEnabled` | true | bool | Master switch |
| `proseRatio` | 20 | 0-100 | Target % prose |
| `quoteRatio` | 45 | 0-100 | Target % quotes |
| `poetryRatio` | 30 | 0-100 | Target % poetry |
| `speechRatio` | 5 | 0-100 | Target % speeches |

### Personalization

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `enablePersonalization` | true | bool | Master switch |
| `minSignalsForPersonalization` | 3 | 0-50 | Min likes/bookmarks to activate |
| `fullCorpusForLoggedIn` | true | bool | Full 10.3M for logged-in users |

### Signal Weights

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `followedAuthorBoost` | 3.0 | 0-10 | Followed author boost |
| `likedAuthorBoost` | 1.5 | 0-5 | Liked author boost |
| `likedCategoryBoost` | 1.3 | 0-5 | Liked category boost |
| `bookmarkedWorkBoost` | 1.2 | 0-5 | Bookmarked work boost |
| `bookmarkedAuthorBoost` | 1.15 | 0-5 | Bookmarked author boost |
| `similarEraBoost` | 1.1 | 0-5 | Similar era boost |
| `popularityBoost` | 0.3 | 0-2 | Popularity boost |

### Algorithm Tuning

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `baseRandomWeight` | 0.3 | 0-1 | Random exploration base |
| `personalizationWeight` | 0.7 | 0-1 | Exploitation ratio |
| `recencyPenalty` | 0.5 | 0-1 | Penalty for recent content |

### Embedding Similarity (Planned)

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `enableEmbeddingSimilarity` | true | bool | Use embedding similarity |
| `embeddingSimilarityWeight` | 0.5 | 0-1 | Weight in feed scoring |
| `minLikesForTasteVector` | 5 | 1-50 | Min likes to compute taste vector |
| `tasteVectorRefreshHours` | 1 | 0.5-168 | Refresh interval |

---

## 9. Admin Dashboard

### Accessing the Dashboard

URL: `http://localhost:4800/admin` (or deployment URL)

Navigate to the **Algorithm** tab for feed configuration.

### Dashboard Layout

```
+------------------------------------------------------------------+
|  ADMIN DASHBOARD                                                  |
+------------------------------------------------------------------+
|  [Dataset]  [Feed Stats]  [Users]  [Algorithm]                   |
+------------------------------------------------------------------+
|                                                                   |
|  CONTENT DIVERSITY                                                |
|  +------------------------------------------------------------+  |
|  | Author Diversity    [====|====] 20                          |  |
|  | Work Diversity      [==|======] 10                          |  |
|  | Min Length          [|========] 10                          |  |
|  | Max Length          [========|] 1000                        |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  LENGTH DIVERSITY                              [x] Enabled        |
|  +------------------------------------------------------------+  |
|  | Short Max Length    [===|=====] 150                         |  |
|  | Long Min Length     [=====|===] 500                         |  |
|  |                                                              |  |
|  | Distribution:                                                |  |
|  | Short  [====|=====] 30%                                     |  |
|  | Medium [=====|====] 40%                                     |  |
|  | Long   [====|=====] 30%                                     |  |
|  |                                                              |  |
|  | [GREEN===30%===][YELLOW===40%===][BLUE===30%===] = 100%     |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  CONTENT TYPE MIX                              [x] Enabled        |
|  +------------------------------------------------------------+  |
|  | Prose   [==|=======] 20%                                    |  |
|  | Quote   [=====|====] 45%                                    |  |
|  | Poetry  [====|=====] 30%                                    |  |
|  | Speech  [|=========] 5%                                     |  |
|  |                                                              |  |
|  | [INDIGO=20%][AMBER====45%====][PINK==30%==][EMERALD=5%]     |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  PERSONALIZATION                               [x] Enabled        |
|  +------------------------------------------------------------+  |
|  | Min Signals         [===|=====] 3                           |  |
|  | Full Corpus         [x] Enabled for logged-in users         |  |
|  |                                                              |  |
|  | Signal Weights:                                              |  |
|  | Followed Author     [======|==] 3.0x                        |  |
|  | Liked Author        [===|=====] 1.5x                        |  |
|  | Liked Category      [===|=====] 1.3x                        |  |
|  | Bookmarked Work     [===|=====] 1.2x                        |  |
|  | Bookmarked Author   [===|=====] 1.15x                       |  |
|  | Similar Era         [==|======] 1.1x                        |  |
|  | Popularity          [=|=======] 0.3x                        |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  ALGORITHM TUNING                                                 |
|  +------------------------------------------------------------+  |
|  | Exploration         [====|=====] 30%                        |  |
|  | Exploitation        [======|===] 70%                        |  |
|  | Recency Penalty     [=====|====] 50%                        |  |
|  |                                                              |  |
|  | [BLUE===30%===][ACCENT======70%======]                      |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  EMBEDDING SIMILARITY                          [x] Enabled        |
|  +------------------------------------------------------------+  |
|  | Similarity Weight   [=====|====] 50%                        |  |
|  | Min Likes           [=|=======] 5                           |  |
|  | Refresh Hours       [|========] 1                           |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  [No Changes]  or  [Save Changes]                                 |
|                                                                   |
+------------------------------------------------------------------+
```

### Section Details

#### Content Diversity Section

Controls basic diversity constraints:

- **Author Diversity** (1-50): After showing an author, exclude them for next N passages
- **Work Diversity** (1-100): After showing a work, exclude it for next N passages
- **Min Length** (1-500): Filter out passages shorter than this
- **Max Length** (100-5000): Filter out passages longer than this

#### Length Diversity Section

Controls passage length distribution:

- **Enable Toggle**: Turn length diversity on/off
- **Short Max Length**: Upper bound for "short" bucket
- **Long Min Length**: Lower bound for "long" bucket
- **Short/Medium/Long %**: Target percentages (should sum to 100%)
- **Visual Bar**: Color-coded distribution preview (Green/Yellow/Blue)

#### Content Type Mix Section

Controls content type distribution:

- **Enable Toggle**: Turn type diversity on/off
- **Prose/Quote/Poetry/Speech %**: Target percentages (should sum to 100%)
- **Visual Bar**: Color-coded distribution preview (Indigo/Amber/Pink/Emerald)

#### Personalization Section

Controls user personalization:

- **Enable Toggle**: Turn personalization on/off globally
- **Min Signals**: Minimum likes/bookmarks before personalization activates
- **Full Corpus**: Whether logged-in users get all 10.3M passages
- **Signal Weight Sliders**: Adjust boost for each signal type

#### Algorithm Tuning Section

Fine-tune the algorithm behavior:

- **Exploration**: Percentage of random content (discovery)
- **Exploitation**: Percentage of personalized content (relevance)
- **Recency Penalty**: Penalty for recently seen content
- **Visual Bar**: Shows exploration/exploitation split

#### Embedding Similarity Section

Configure embedding-based personalization (when implemented):

- **Enable Toggle**: Use taste vectors for personalization
- **Similarity Weight**: How much embedding similarity affects score
- **Min Likes**: Minimum likes to compute taste vector
- **Refresh Hours**: How often to recompute taste vectors

### Saving Configuration

- Changes are tracked automatically
- Button shows **"Save Changes"** when modifications exist
- Button shows **"No Changes"** when config matches saved version
- Click "Save Changes" to persist to database
- Configuration is cached in server memory
- Changes apply immediately to new feed requests

### Configuration Storage

Configuration is stored in the `app_config` table:

```sql
INSERT INTO app_config (key, value)
VALUES ('feed_algorithm', '{
  "maxAuthorRepeat": 20,
  "maxWorkRepeat": 10,
  "shortRatio": 30,
  ...
}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

On server startup, configuration is loaded and cached:

```typescript
let cachedConfig: FeedAlgorithmConfig | null = null;

async function getConfig(): Promise<FeedAlgorithmConfig> {
  if (cachedConfig) return cachedConfig;

  const result = await sql`
    SELECT value FROM app_config WHERE key = 'feed_algorithm'
  `;

  cachedConfig = { ...DEFAULT_CONFIG, ...result[0]?.value };
  return cachedConfig;
}
```

---

## 10. Future Plans

### Short-Term (In Progress)

| Feature | Status | Description |
|---------|--------|-------------|
| Embedding Generation | In Progress | Processing 10.3M passages with OpenAI |
| Similar Passages | Complete | Embedding-based with fallback |

### Medium-Term (Planned)

| Feature | Status | Description |
|---------|--------|-------------|
| Taste Vector Computation | Planned | Average embedding of liked passages |
| Taste Vector in Scoring | Planned | Embedding similarity boost in feed |
| Semantic Search | Planned | Search by meaning, not just keywords |
| Hybrid Search | Planned | Keyword + semantic combined |

### Long-Term (Future)

| Feature | Status | Description |
|---------|--------|-------------|
| A/B Testing | Future | Test algorithm variations |
| Real-time Personalization | Future | Update signals during session |
| Collaborative Filtering | Future | "Users like you also liked..." |
| Domain-Specific Embeddings | Future | Philosophy vs poetry optimized |
| Engagement Prediction | Future | Predict likelihood of like/bookmark |

### Implementation Roadmap

```
Jan 2026:  [DONE] Feed algorithm v1 (diversity + personalization)
           [DONE] Admin dashboard configuration
           [IN PROGRESS] Embedding generation (10.3M passages)

Feb 2026:  [ ] Taste vector computation
           [ ] Embedding similarity in feed scoring
           [ ] Semantic search endpoint

Mar 2026:  [ ] Hybrid search
           [ ] A/B testing framework
           [ ] Engagement analytics

Q2 2026:   [ ] Collaborative filtering
           [ ] Real-time signal updates
           [ ] Advanced embedding models
```

---

## File References

| File | Purpose |
|------|---------|
| `server/services/feed-algorithm.ts` | Main algorithm implementation (1,122 lines) |
| `server/services/config.ts` | Configuration management (146 lines) |
| `server/routes/feed.ts` | Feed API endpoints (76 lines) |
| `server/routes/passages.ts` | Similar passages endpoint |
| `scripts/generate-embeddings.ts` | Embedding generation script |

---

*This document describes the Doomscrolls feed algorithm as of January 2026.*
