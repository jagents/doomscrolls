# Doomscrolls Feed Algorithm Rearchitecture - Implementation Plan v2

**Generated:** 2026-01-17
**Author:** Claude Code
**Version:** 2.0 (incorporates CODEX review feedback)
**Status:** PENDING APPROVAL

---

## Changelog from v1

| Change | Reason |
|--------|--------|
| Signal columns now nullable (NULL = unknown) | Fixes resonance scoring corruption |
| quality_tier handles NULL resonance_score | Prevents unknown rows being marked C-tier |
| Cluster quality redesigned for scale | 10M embeddings won't fit in memory |
| sample_key gets DEFAULT + NOT NULL after backfill | New rows would be excluded otherwise |
| Sampling queries include all constraints | Preserves length, type, work size filters |
| Both generateFeed AND generatePersonalizedFeed updated | Logged-in users use personalized path |
| Added preference_config table | Per strategy spec requirement |
| Config integration with existing app_config documented | Avoids cache/system conflicts |
| Type diversity + tier sampling interaction explained | Preserves existing type bucket logic |
| Bartlett's author mapping strategy added | Needed for quote matching |
| Preference score scale documented (0-10) | Clarifies normalization |
| pgvector ivfflat index added | For taste vector similarity queries |
| ORDER BY RANDOM count corrected to 21 | Accuracy fix |
| chunk_stats limitation noted | Popularity signal is empty |

---

## Executive Summary

This document provides a detailed implementation plan for the three-score hierarchy feed algorithm described in `DSbootstrapPlanArch.md`. The plan is based on thorough analysis of the existing codebase and considers:

- Current system architecture and constraints
- Embedding generation in progress (88.3% complete)
- Server resource availability
- Multi-platform requirements (backend/webapp first, then native apps)

**Decisions Confirmed:**
- Goodreads scraping: YES (will implement)
- LLM quality scoring: YES (~$35-50 budget approved)
- A/B testing: NO (not needed at this stage)
- Rollout: All at once (no users currently)

---

## 1. System Assessment

### 1.1 Server Resource Status

| Resource | Current | Available | Assessment |
|----------|---------|-----------|------------|
| RAM | 11GB used | ~4GB free | Tight but workable |
| CPU | 87% utilization | Limited | Embedding workers running |
| Swap | 351MB used | 1.7GB free | Healthy |

**Embedding Workers Running:**
- `embed-lower.ts`: Processing chunks with `id < '7c2ca8ca-d5ab-4312-9c28-edc3a6b05c03'`
- `embed-upper.ts`: Processing chunks with `id >= '7c2ca8ca-d5ab-4312-9c28-edc3a6b05c03'`

**Recommendation:** We can proceed with development work in parallel. Batch jobs for resonance score computation should wait until embeddings complete OR run during off-peak hours with lower resource allocation.

### 1.2 Embedding Progress

```
Total chunks:     10,302,862
Embedded:          9,097,100 (88.30%)
Remaining:         1,205,762 (11.70%)
```

**Estimated completion:** ~24-48 hours at current rate

**Compatibility:** The new algorithm can be built to work with partial embeddings:
- Resonance score computation: Can use `embedding IS NOT NULL` filter for cluster quality signal
- Preference score: embedding_similarity component only activates when both taste vector AND passage embedding exist
- Feed algorithm: Will gracefully degrade for unembedded passages

### 1.3 Current Feed Algorithm Analysis

**File:** `server/services/feed-algorithm.ts` (1,122 lines)

**Key Issues Identified:**
1. **21 instances of `ORDER BY RANDOM()`** - causes full table scan on 10.3M rows (~3-5 seconds each)
2. **No quality scoring** - all passages equally likely to appear
3. **Basic personalization** - signal-based boosts exist but no resonance/preference blend
4. **Binary user state** - either anonymous (curated works) or logged-in (full corpus)
5. **Two code paths** - `generateFeed` (anonymous) and `generatePersonalizedFeed` (logged-in) both need updating

**Current Query Structure (typical):**
```sql
SELECT c.id, c.text, c.type, ...
FROM chunks c
JOIN authors a ON c.author_id = a.id
LEFT JOIN works w ON c.work_id = w.id
WHERE LENGTH(c.text) BETWEEN 10 AND 1000
  AND w.chunk_count > 10              -- Important: filters tiny works
  AND c.author_id NOT IN (recent_authors)
  AND c.work_id NOT IN (recent_works)
ORDER BY RANDOM()   -- THIS IS THE BOTTLENECK
LIMIT 20
```

**What to Preserve:**
- Cursor-based pagination structure (`CursorData` interface)
- Diversity enforcement logic (author/work recency, length buckets, type buckets)
- Existing personalization signal collection (likes, bookmarks, follows)
- Admin configuration system (`app_config` table + in-memory cache)
- Feed endpoint contracts (`GET /api/feed`, `/api/feed/following`, `/api/feed/for-you`)
- `w.chunk_count > 10` filter for full corpus access

### 1.4 Current Preference Score Scale

The existing personalization uses additive boosts:

| Signal | Boost Value |
|--------|-------------|
| followedAuthorBoost | 3.0 |
| likedAuthorBoost | 1.5 |
| likedCategoryBoost | 1.3 |
| bookmarkedWorkBoost | 1.2 |
| bookmarkedAuthorBoost | 1.15 |
| similarEraBoost | 1.1 |
| popularityBoost | 0.3 |
| baseRandomWeight | 0.3 |

**Maximum theoretical score:** ~9.85 (all signals active)
**Practical range:** 0-10

This confirms preference scores are on a 0-10 scale for normalization purposes.

### 1.5 Known Data Limitations

**chunk_stats table is effectively empty:**
```
chunk_stats rows: 4 (out of 10.3M passages)
```

This means the `popularityBoost` signal based on `like_count` is currently a no-op for 99.99% of passages. Options:
1. Backfill from `user_likes` table aggregation
2. Treat popularity as zero until organic engagement accumulates
3. Defer popularity signal to later phase

**Recommendation:** Option 2 for now - popularity will naturally populate as users engage.

---

## 2. Database Schema Changes

### 2.1 New Columns on `chunks` Table

```sql
-- PERFORMANCE: sample_key for fast indexed sampling
-- Step 1: Add column without default (for backfill)
ALTER TABLE chunks ADD COLUMN sample_key FLOAT;

-- QUALITY: resonance_score and derived tier
ALTER TABLE chunks ADD COLUMN resonance_score FLOAT;

-- FIXED: Handle NULL resonance_score properly
ALTER TABLE chunks ADD COLUMN quality_tier VARCHAR(1) GENERATED ALWAYS AS (
  CASE
    WHEN resonance_score IS NULL THEN NULL
    WHEN resonance_score >= 80 THEN 'S'
    WHEN resonance_score >= 60 THEN 'A'
    WHEN resonance_score >= 40 THEN 'B'
    ELSE 'C'
  END
) STORED;

ALTER TABLE chunks ADD COLUMN signal_count INTEGER DEFAULT 0;

-- QUALITY SIGNALS (for resonance computation)
-- FIXED: All nullable - NULL means "not evaluated", FALSE means "evaluated but not matched"
ALTER TABLE chunks ADD COLUMN wikiquote_match BOOLEAN;      -- NULL = unknown
ALTER TABLE chunks ADD COLUMN bartletts_match BOOLEAN;      -- NULL = unknown
ALTER TABLE chunks ADD COLUMN goodreads_count INTEGER;      -- NULL = unknown, 0 = evaluated but none
ALTER TABLE chunks ADD COLUMN wikisource_featured BOOLEAN;  -- NULL = unknown
ALTER TABLE chunks ADD COLUMN llm_quality_score FLOAT;      -- NULL = not scored
ALTER TABLE chunks ADD COLUMN manually_curated BOOLEAN;     -- NULL = unknown
ALTER TABLE chunks ADD COLUMN cluster_quality FLOAT;        -- NULL = not computed
ALTER TABLE chunks ADD COLUMN heuristic_score FLOAT;        -- NULL = not computed

-- INDEXES
CREATE INDEX idx_chunks_sample_key ON chunks(sample_key) WHERE sample_key IS NOT NULL;
CREATE INDEX idx_chunks_quality_tier ON chunks(quality_tier) WHERE quality_tier IS NOT NULL;
CREATE INDEX idx_chunks_resonance_score ON chunks(resonance_score) WHERE resonance_score IS NOT NULL;
CREATE INDEX idx_chunks_tier_sample_key ON chunks(quality_tier, sample_key)
  WHERE quality_tier IS NOT NULL AND sample_key IS NOT NULL;

-- EMBEDDING INDEX for taste vector similarity
CREATE INDEX idx_chunks_embedding_cosine ON chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  WHERE embedding IS NOT NULL;
```

**Why nullable signal columns?**

| Value | Meaning |
|-------|---------|
| `NULL` | Signal not evaluated for this passage |
| `FALSE` | Evaluated, confirmed NOT a match |
| `TRUE` | Evaluated, confirmed IS a match |

This distinction is critical for the resonance scoring algorithm, which only considers signals that have been evaluated.

**Why `sample_key`?**

| Method | Query Time (10.3M rows) | Uses Index |
|--------|-------------------------|------------|
| `ORDER BY RANDOM() LIMIT 20` | 3-5 seconds | No |
| `WHERE sample_key >= $x ORDER BY sample_key LIMIT 20` | 5-20ms | Yes |

### 2.2 New Configuration Tables

```sql
-- Resonance score weight configuration
CREATE TABLE resonance_config (
  id SERIAL PRIMARY KEY,
  weight_wikiquote INTEGER DEFAULT 25,
  weight_bartletts INTEGER DEFAULT 15,
  weight_wikisource INTEGER DEFAULT 10,
  weight_goodreads INTEGER DEFAULT 15,
  weight_llm INTEGER DEFAULT 20,
  weight_curation INTEGER DEFAULT 10,
  weight_cluster INTEGER DEFAULT 10,
  weight_heuristic INTEGER DEFAULT 10,
  cutoff_s_tier INTEGER DEFAULT 80,
  cutoff_a_tier INTEGER DEFAULT 60,
  cutoff_b_tier INTEGER DEFAULT 40,
  min_signals_full_confidence INTEGER DEFAULT 4,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Preference score weight configuration (per strategy spec)
CREATE TABLE preference_config (
  id SERIAL PRIMARY KEY,
  followed_author_boost FLOAT DEFAULT 3.0,
  liked_author_boost FLOAT DEFAULT 1.5,
  liked_category_boost FLOAT DEFAULT 1.3,
  bookmarked_work_boost FLOAT DEFAULT 1.2,
  bookmarked_author_boost FLOAT DEFAULT 1.15,
  similar_era_boost FLOAT DEFAULT 1.1,
  popularity_boost FLOAT DEFAULT 0.3,
  embedding_similarity_boost FLOAT DEFAULT 0.5,
  base_random_weight FLOAT DEFAULT 0.3,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Personalization blend by signal count
CREATE TABLE personalization_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL UNIQUE,
  resonance_weight FLOAT NOT NULL,
  preference_weight FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default blend weights
INSERT INTO personalization_blend_config (signal_threshold, resonance_weight, preference_weight) VALUES
  (0, 0.9, 0.1),   -- Cold start: 90% quality, 10% preference
  (3, 0.7, 0.3),
  (6, 0.5, 0.5),   -- Balanced
  (11, 0.3, 0.7),
  (20, 0.2, 0.8);  -- Fully personalized

-- Corpus blend (curated vs full) by signal count
CREATE TABLE corpus_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL UNIQUE,
  curated_ratio FLOAT NOT NULL,
  full_corpus_ratio FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO corpus_blend_config (signal_threshold, curated_ratio, full_corpus_ratio) VALUES
  (0, 1.0, 0.0),
  (1, 0.8, 0.2),
  (2, 0.6, 0.4),
  (3, 0.4, 0.6),
  (5, 0.2, 0.8),
  (10, 0.0, 1.0);

-- Tier sampling weights by signal count
CREATE TABLE tier_sampling_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL UNIQUE,
  s_tier_ratio FLOAT NOT NULL,
  a_tier_ratio FLOAT NOT NULL,
  b_tier_ratio FLOAT NOT NULL,
  c_tier_ratio FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO tier_sampling_config (signal_threshold, s_tier_ratio, a_tier_ratio, b_tier_ratio, c_tier_ratio) VALUES
  (0, 0.50, 0.35, 0.12, 0.03),   -- New users: heavy S/A tier
  (3, 0.40, 0.35, 0.20, 0.05),
  (6, 0.30, 0.30, 0.30, 0.10),
  (11, 0.20, 0.25, 0.35, 0.20),
  (20, 0.15, 0.20, 0.35, 0.30);  -- Engaged users: personalization finds gems in lower tiers

-- Exploit/explore ratio
CREATE TABLE exploit_explore_config (
  id SERIAL PRIMARY KEY,
  exploit_ratio FLOAT DEFAULT 0.7,
  explore_ratio FLOAT DEFAULT 0.3,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Configuration System Integration

The existing system uses:
- `app_config` table with JSON values
- In-memory cache in `server/services/config.ts`
- `getFeedConfig()` and `updateFeedConfig()` functions

**Integration Strategy:**

1. **New tables are separate from `app_config`** - Different data structure (relational vs JSON)
2. **Add parallel cache layer** for new tables:

```typescript
// In server/services/config.ts

// Existing cache
let cachedFeedConfig: FeedAlgorithmConfig | null = null;

// NEW: Caches for new config tables
let cachedResonanceConfig: ResonanceConfig | null = null;
let cachedPreferenceConfig: PreferenceConfig | null = null;
let cachedBlendConfigs: BlendConfigs | null = null;

export async function getResonanceConfig(): Promise<ResonanceConfig> {
  if (cachedResonanceConfig) return cachedResonanceConfig;
  const [row] = await sql`SELECT * FROM resonance_config LIMIT 1`;
  cachedResonanceConfig = row || DEFAULT_RESONANCE_CONFIG;
  return cachedResonanceConfig;
}

export function clearAllConfigCaches() {
  cachedFeedConfig = null;
  cachedResonanceConfig = null;
  cachedPreferenceConfig = null;
  cachedBlendConfigs = null;
}
```

3. **Extend admin endpoints** in `server/routes/admin.ts`:
   - `GET /api/admin/resonance-config`
   - `PUT /api/admin/resonance-config`
   - `GET /api/admin/blend-config`
   - `PUT /api/admin/blend-config`
   - etc.

4. **Cache invalidation on update** - Each PUT endpoint calls `clearAllConfigCaches()`

### 2.4 Migration Strategy

**File to create:** `server/db/migrate-feed-algorithm.ts`

```typescript
export async function migrateFeedAlgorithm() {
  console.log('Starting feed algorithm migration...');

  // 1. Add columns (if not exist)
  await addColumnsIfNotExist();

  // 2. Create config tables (if not exist)
  await createConfigTables();

  // 3. Create indexes (use CONCURRENTLY for production)
  await createIndexes();

  // 4. Backfill sample_key in batches
  await backfillSampleKey();

  // 5. Set sample_key default and NOT NULL
  await sql`ALTER TABLE chunks ALTER COLUMN sample_key SET DEFAULT random()`;
  await sql`ALTER TABLE chunks ALTER COLUMN sample_key SET NOT NULL`;

  // 6. Backfill wikiquote_match from source column
  await sql`UPDATE chunks SET wikiquote_match = TRUE WHERE source = 'wikiquote'`;

  console.log('Migration complete!');
}

async function backfillSampleKey() {
  const BATCH_SIZE = 100000;
  let updated = 0;

  while (true) {
    const result = await sql`
      UPDATE chunks SET sample_key = random()
      WHERE id IN (
        SELECT id FROM chunks WHERE sample_key IS NULL LIMIT ${BATCH_SIZE}
      )
    `;

    if (result.count === 0) break;
    updated += result.count;
    console.log(`Backfilled ${updated} rows...`);

    // Brief pause to reduce lock contention
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Total backfilled: ${updated} rows`);
}
```

---

## 3. Implementation Phases

### Phase 0: Performance Foundation (Priority: CRITICAL)

**Goal:** Replace `ORDER BY RANDOM()` with indexed sampling. This alone will drop feed latency from 3-5s to <200ms.

**Files to Modify:**
- `server/services/feed-algorithm.ts` - Replace 21 instances of ORDER BY RANDOM()
- `server/db/migrate-feed-algorithm.ts` - New migration file

**Changes:**

1. Add `sample_key` column and index
2. Backfill sample_key with random values (in batches of 100K)
3. Set DEFAULT and NOT NULL after backfill
4. Create new sampling function with ALL existing constraints:

```typescript
// NEW: Fast sampling with sample_key - includes ALL existing constraints
async function samplePassages(options: {
  tier?: string | null;        // null = any tier (before resonance computed)
  limit: number;
  minLength: number;
  maxLength: number;
  typeGroup?: 'prose' | 'quote' | 'poetry' | 'speech';
  excludeAuthorIds: string[];
  excludeWorkIds: string[];
  requireCurated: boolean;     // true for anonymous users
  category?: string;
}): Promise<Passage[]> {
  const startKey = Math.random();

  // Build WHERE clauses
  const tierClause = options.tier
    ? sql`AND quality_tier = ${options.tier}`
    : sql``;  // Before resonance computed, quality_tier is NULL - skip filter

  const lengthClause = sql`AND LENGTH(c.text) BETWEEN ${options.minLength} AND ${options.maxLength}`;

  const typeClause = options.typeGroup
    ? buildTypeClause(options.typeGroup)
    : sql``;

  const authorExclude = options.excludeAuthorIds.length > 0
    ? sql`AND c.author_id NOT IN ${sql(options.excludeAuthorIds)}`
    : sql``;

  const workExclude = options.excludeWorkIds.length > 0
    ? sql`AND c.work_id NOT IN ${sql(options.excludeWorkIds)}`
    : sql``;

  // IMPORTANT: Preserve chunk_count filter for full corpus
  const workSizeClause = options.requireCurated
    ? sql``  // Curated works already filtered by JOIN
    : sql`AND w.chunk_count > 10`;

  const curatedJoin = options.requireCurated
    ? sql`JOIN curated_works cw ON c.work_id = cw.work_id`
    : sql``;

  const categoryJoin = options.category
    ? sql`JOIN work_categories wc ON c.work_id = wc.work_id
          JOIN categories cat ON wc.category_id = cat.id`
    : sql``;

  const categoryWhere = options.category
    ? sql`AND cat.slug = ${options.category}`
    : sql``;

  let results = await sql`
    SELECT
      c.id, c.text, c.type, c.resonance_score, c.quality_tier,
      c.author_id, a.name as author_name, a.slug as author_slug,
      c.work_id, w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    ${curatedJoin}
    ${categoryJoin}
    WHERE c.sample_key >= ${startKey}
      ${tierClause}
      ${lengthClause}
      ${typeClause}
      ${authorExclude}
      ${workExclude}
      ${workSizeClause}
      ${categoryWhere}
    ORDER BY c.sample_key
    LIMIT ${options.limit}
  `;

  // Wrap around if under-filled
  if (results.length < options.limit) {
    const remaining = options.limit - results.length;
    const existingIds = results.map(r => r.id);

    const wrapResults = await sql`
      SELECT
        c.id, c.text, c.type, c.resonance_score, c.quality_tier,
        c.author_id, a.name as author_name, a.slug as author_slug,
        c.work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      ${curatedJoin}
      ${categoryJoin}
      WHERE c.sample_key < ${startKey}
        AND c.id NOT IN ${sql(existingIds)}
        ${tierClause}
        ${lengthClause}
        ${typeClause}
        ${authorExclude}
        ${workExclude}
        ${workSizeClause}
        ${categoryWhere}
      ORDER BY c.sample_key
      LIMIT ${remaining}
    `;

    results = [...results, ...wrapResults];
  }

  // If STILL under-filled (very constrained query), retry with relaxed constraints
  if (results.length < options.limit * 0.5) {
    console.warn(`Sampling under-filled: got ${results.length}/${options.limit}`);
    // Could retry without tier constraint, or widen length range
  }

  return results;
}

function buildTypeClause(typeGroup: 'prose' | 'quote' | 'poetry' | 'speech') {
  const TYPE_GROUPS = {
    prose: [null, 'passage', 'section', 'chapter'],
    quote: ['quote', 'saying'],
    poetry: ['verse', 'poem', 'verse_group'],
    speech: ['speech'],
  };

  const types = TYPE_GROUPS[typeGroup];
  const hasNull = types.includes(null);
  const nonNullTypes = types.filter((t): t is string => t !== null);

  if (hasNull && nonNullTypes.length > 0) {
    return sql`AND (c.type IS NULL OR c.type IN ${sql(nonNullTypes)})`;
  } else if (hasNull) {
    return sql`AND c.type IS NULL`;
  } else {
    return sql`AND c.type IN ${sql(nonNullTypes)}`;
  }
}
```

5. Replace all 21 `ORDER BY RANDOM()` instances with sample_key queries
6. **Update BOTH `generateFeed` AND `generatePersonalizedFeed`** functions

**Estimated effort:** 2-3 days
**Can run in parallel with embeddings:** YES

---

### Phase 1: Heuristic Score Computation

**Goal:** Compute self-containedness heuristics for all passages.

**Files to Create:**
- `scripts/compute-heuristic-scores.ts`

**Heuristic Rules:**
```typescript
function computeHeuristicScore(text: string): number {
  let score = 0.5;  // Start at midpoint
  const trimmed = text.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  const firstChar = trimmed[0];

  // RED FLAGS (decrease score)
  if (['And', 'But', 'Then', 'So', 'Or', 'Yet', 'For'].includes(firstWord)) score -= 0.15;
  if (['He', 'She', 'They', 'It', 'His', 'Her', 'Their'].includes(firstWord)) score -= 0.12;
  if (firstChar && firstChar === firstChar.toLowerCase() && /[a-z]/.test(firstChar)) score -= 0.1;
  if (/said|asked|replied|exclaimed|whispered/i.test(text)) score -= 0.08;
  if (/^(CHAPTER|PART|BOOK|SECTION)\s+[IVXLCDM\d]+/i.test(trimmed)) score -= 0.3;
  const lastChar = trimmed[trimmed.length - 1];
  if (!['.', '!', '?', '"', "'", ')'].includes(lastChar)) score -= 0.1;

  // GREEN FLAGS (increase score)
  if (firstChar && firstChar === firstChar.toUpperCase() && /[A-Z]/.test(firstChar)) score += 0.05;
  if (/^(Let|Do|Be|Consider|Remember|Never|Always|Know)\b/.test(trimmed)) score += 0.1;
  if (text.length < 200) score += 0.05;  // Short = more likely standalone

  // Abstract nouns suggest wisdom content
  const abstractNouns = ['truth', 'beauty', 'wisdom', 'love', 'death', 'life', 'soul', 'virtue', 'nature', 'time'];
  const abstractCount = abstractNouns.filter(noun => new RegExp(`\\b${noun}\\b`, 'i').test(text)).length;
  score += Math.min(abstractCount * 0.03, 0.12);

  return Math.max(0, Math.min(1, score));  // Clamp to 0-1
}
```

**Batch Processing:**
- Process 10,000 chunks per batch
- ~1,000 batches total
- Estimated runtime: 1-2 hours

**Estimated effort:** 1 day
**Can run in parallel with embeddings:** YES

---

### Phase 2: External Signal Matching (Bartlett's)

**Goal:** Validate matching pipeline with public domain Bartlett's Quotations.

**Source:** Project Gutenberg #27635 (public domain)

**Files to Create:**
- `scripts/match-bartletts.ts`
- `data/bartletts/quotes.json`

**Process:**

1. Download and parse Bartlett's from Gutenberg
2. Extract author names and quotes
3. Enable pg_trgm extension (if not already)
4. **Map Bartlett's authors to database authors:**

```typescript
async function findAuthorMatch(bartlettsAuthorName: string): Promise<string | null> {
  // Use trigram similarity to find best author match
  const matches = await sql`
    SELECT id, name, similarity(name, ${bartlettsAuthorName}) as sim
    FROM authors
    WHERE similarity(name, ${bartlettsAuthorName}) > 0.4
    ORDER BY sim DESC
    LIMIT 1
  `;

  if (matches.length > 0 && matches[0].sim > 0.5) {
    return matches[0].id;
  }

  // Try normalized matching (last name only)
  const lastName = bartlettsAuthorName.split(/\s+/).pop();
  const lastNameMatches = await sql`
    SELECT id, name FROM authors
    WHERE name ILIKE ${'%' + lastName}
    LIMIT 5
  `;

  // Manual review for edge cases
  return lastNameMatches.length === 1 ? lastNameMatches[0].id : null;
}
```

5. Match quotes to corpus using trigram similarity (filtered by author first):

```sql
-- Only search within author's passages (much faster)
SELECT id, text, similarity(text, $1) as sim
FROM chunks
WHERE author_id = $2
  AND similarity(text, $1) > 0.5
ORDER BY sim DESC
LIMIT 1
```

6. Update `bartletts_match = TRUE` for matches, `FALSE` for author's other passages

**Note on trigram index:** By filtering by `author_id` first, we avoid needing a full-corpus trigram index. The per-author search space is small enough for inline similarity computation.

**Success metric:** >40% match rate validates the pipeline

**Estimated effort:** 2-3 days
**Can run in parallel with embeddings:** YES

---

### Phase 3: Wikisource Featured Matching

**Goal:** Mark passages from Wikisource featured works.

**Source:** https://en.wikisource.org/wiki/Wikisource:Featured_texts (~200 works)

**Files to Create:**
- `scripts/match-wikisource-featured.ts`

**Process:**
1. Scrape featured works list
2. Match work titles to `works` table using similarity
3. Update all chunks from matched works: `wikisource_featured = TRUE`
4. Update non-matched chunks from same authors: `wikisource_featured = FALSE`

**Estimated effort:** 1 day
**Can run in parallel with embeddings:** YES

---

### Phase 4: Resonance Score Computation

**Goal:** Compute resonance scores for all passages.

**Dependency:** Phases 1-3 complete (heuristic scores, Bartlett's, Wikisource)

**Files to Create:**
- `scripts/compute-resonance-scores.ts`

**Algorithm (FIXED: proper NULL handling):**
```typescript
function computeResonanceScore(passage: Passage, config: ResonanceConfig): { score: number; signalCount: number } {
  // FIXED: Only signals that have been EVALUATED count as present
  // NULL = not evaluated, FALSE = evaluated but not matched, TRUE = matched
  const signalDefinitions = {
    wikiquote_match: {
      value: passage.wikiquote_match === true ? 1 : 0,
      present: passage.wikiquote_match !== null  // FALSE counts as present (evaluated)
    },
    bartletts_match: {
      value: passage.bartletts_match === true ? 1 : 0,
      present: passage.bartletts_match !== null
    },
    wikisource_featured: {
      value: passage.wikisource_featured === true ? 1 : 0,
      present: passage.wikisource_featured !== null
    },
    goodreads_count: {
      value: Math.min((passage.goodreads_count || 0) / 1000, 1),
      present: passage.goodreads_count !== null  // 0 counts as present
    },
    llm_quality_score: {
      value: (passage.llm_quality_score || 0) / 10,
      present: passage.llm_quality_score !== null
    },
    manually_curated: {
      value: passage.manually_curated === true ? 1 : 0,
      present: passage.manually_curated !== null
    },
    cluster_quality: {
      value: passage.cluster_quality || 0,
      present: passage.cluster_quality !== null
    },
    heuristic_score: {
      value: passage.heuristic_score || 0,
      present: passage.heuristic_score !== null
    },
  };

  // Sum only over PRESENT signals, then renormalize
  let weightedSum = 0;
  let presentWeightSum = 0;
  let signalCount = 0;

  const weights = {
    wikiquote_match: config.weight_wikiquote,
    bartletts_match: config.weight_bartletts,
    wikisource_featured: config.weight_wikisource,
    goodreads_count: config.weight_goodreads,
    llm_quality_score: config.weight_llm,
    manually_curated: config.weight_curation,
    cluster_quality: config.weight_cluster,
    heuristic_score: config.weight_heuristic,
  };

  for (const [signal, weight] of Object.entries(weights)) {
    const def = signalDefinitions[signal as keyof typeof signalDefinitions];
    if (def && def.present) {
      weightedSum += def.value * weight;
      presentWeightSum += weight;
      signalCount++;
    }
  }

  // If no signals present, return NULL (don't assign arbitrary score)
  if (signalCount === 0) {
    return { score: null, signalCount: 0 };
  }

  const rawScore = (weightedSum / presentWeightSum) * 100;

  // Apply confidence penalty for sparse signals
  const confidenceFactor = Math.min(signalCount / config.min_signals_full_confidence, 1);
  const finalScore = (rawScore * confidenceFactor) + (50 * (1 - confidenceFactor));

  return { score: finalScore, signalCount };
}
```

**Batch Processing:**
- Process 50,000 chunks per batch
- ~200 batches total
- Estimated runtime: 15-30 minutes

**Estimated effort:** 1 day
**Should wait for embeddings:** Recommended (for cluster_quality signal)

---

### Phase 5: Feed Algorithm Integration

**Goal:** Integrate three-score hierarchy into BOTH feed endpoints.

**Files to Modify:**
- `server/services/feed-algorithm.ts` (major rewrite)
- `server/services/config.ts` (extend configuration)
- `server/routes/feed.ts` (minor - both paths use new algorithm)

**CRITICAL: Both Code Paths Need Updating**

The current codebase has two entry points:
- `generateFeed()` - Used for anonymous users
- `generatePersonalizedFeed()` - Used for logged-in users

Both must be updated to use the new algorithm. Recommend refactoring to single unified pipeline:

```typescript
// UNIFIED PIPELINE - replaces both generateFeed and generatePersonalizedFeed
async function generateFeedUnified(options: UnifiedFeedOptions): Promise<FeedResponse> {
  // 1. LOAD USER STATE (works for both anonymous and logged-in)
  const userSignals = options.userId
    ? await loadUserSignals(options.userId)
    : await loadAnonymousSignals(options.anonymousSignals);

  // Signal count definition (per strategy doc): likes + bookmarks
  const signalCount = userSignals.likeCount + userSignals.bookmarkCount;

  // 2. LOAD CONFIGURATION (with caching)
  const resonanceConfig = await getResonanceConfig();
  const preferenceConfig = await getPreferenceConfig();
  const blendConfigs = await getBlendConfigs();

  // 3. DETERMINE SAMPLING PARAMETERS BASED ON SIGNAL COUNT
  const corpusBlend = getCorpusBlend(signalCount, blendConfigs.corpus);
  const tierWeights = getTierWeights(signalCount, blendConfigs.tier);
  const blendWeights = getBlendWeights(signalCount, blendConfigs.personalization);

  // 4. CANDIDATE SAMPLING WITH TYPE DIVERSITY PRESERVED
  // This integrates tier sampling WITH the existing type bucket system
  const targetCount = options.limit * 5;
  const candidates = await sampleWithTierAndTypeDiversity(
    targetCount,
    corpusBlend,
    tierWeights,
    options
  );

  // 5. SCORE ALL CANDIDATES
  const scored = candidates.map(passage => {
    const preferenceScore = computePreferenceScore(passage, userSignals, preferenceConfig);
    const personalizationScore = computePersonalizationScore(
      passage.resonance_score ?? 50,  // Default to 50 if not yet computed
      preferenceScore,
      blendWeights
    );
    return { ...passage, preferenceScore, personalizationScore };
  });

  // 6. EXPLOIT/EXPLORE SELECTION
  scored.sort((a, b) => b.personalizationScore - a.personalizationScore);
  const exploitExplore = await getExploitExploreConfig();
  const exploitCount = Math.floor(options.limit * exploitExplore.exploit_ratio);
  const exploreCount = options.limit - exploitCount;

  const exploit = scored.slice(0, exploitCount);
  const explorePool = scored.slice(exploitCount);
  const explore = shuffle(explorePool).slice(0, exploreCount);

  let selected = shuffle([...exploit, ...explore]);

  // 7. APPLY AUTHOR/WORK DIVERSITY (existing cursor-based mechanism)
  // This is already handled in samplePassages via excludeAuthorIds/excludeWorkIds
  // Just update cursor for next request

  // 8. RETURN
  const cursorData = decodeCursor(options.cursor || '');
  return {
    passages: selected.map(formatPassage),
    nextCursor: encodeCursor(updateCursor(cursorData, selected)),
    hasMore: selected.length >= options.limit * 0.5,
    personalized: signalCount >= 3
  };
}
```

**Type Diversity + Tier Sampling Integration:**

The existing algorithm uses type buckets (prose/quote/poetry/speech). The new tier sampling must preserve this:

```typescript
async function sampleWithTierAndTypeDiversity(
  targetCount: number,
  corpusBlend: CorpusBlend,
  tierWeights: TierWeights,
  options: FeedOptions
): Promise<Passage[]> {
  const config = await getFeedConfig();

  // Calculate type bucket counts (existing logic)
  const typeCounts = calculateTypeBucketCounts(targetCount, config);
  // { prose: X, quote: Y, poetry: Z, speech: W }

  // For each type bucket, sample from tiers proportionally
  const results: Passage[] = [];

  for (const [typeGroup, count] of Object.entries(typeCounts)) {
    if (count <= 0) continue;

    // Sample this type from each tier according to tier weights
    const tierCounts = {
      S: Math.round(count * tierWeights.s_tier_ratio),
      A: Math.round(count * tierWeights.a_tier_ratio),
      B: Math.round(count * tierWeights.b_tier_ratio),
      C: count - /* sum of above */,
    };

    for (const [tier, tierCount] of Object.entries(tierCounts)) {
      if (tierCount <= 0) continue;

      const passages = await samplePassages({
        tier: tier as string,
        limit: tierCount,
        typeGroup: typeGroup as 'prose' | 'quote' | 'poetry' | 'speech',
        minLength: config.minLength,
        maxLength: config.maxLength,
        excludeAuthorIds: cursorData.recentAuthors,
        excludeWorkIds: cursorData.recentWorks,
        requireCurated: corpusBlend.curated_ratio > 0.5,
        category: options.category,
      });

      results.push(...passages);
    }
  }

  return shuffle(results);
}
```

**Preference Score Computation (0-10 scale):**

```typescript
function computePreferenceScore(
  passage: Passage,
  userSignals: UserSignals,
  config: PreferenceConfig
): number {
  let score = config.base_random_weight * Math.random();  // 0-0.3

  // Account-required signal (highest priority)
  if (userSignals.followedAuthorIds?.includes(passage.author_id)) {
    score += config.followed_author_boost;  // +3.0
  }

  // Device-based signals
  if (userSignals.likedAuthorIds?.includes(passage.author_id)) {
    score += config.liked_author_boost;  // +1.5
  }

  const matchingCategories = passage.category_ids?.filter(
    id => userSignals.likedCategoryIds?.includes(id)
  ) || [];
  if (matchingCategories.length > 0) {
    score += config.liked_category_boost * Math.min(matchingCategories.length, 2);  // +1.3 to +2.6
  }

  if (userSignals.bookmarkedWorkIds?.includes(passage.work_id)) {
    score += config.bookmarked_work_boost;  // +1.2
  }

  if (userSignals.bookmarkedAuthorIds?.includes(passage.author_id)) {
    score += config.bookmarked_author_boost;  // +1.15
  }

  // Era matching
  if (passage.author_era && userSignals.preferredEras?.includes(passage.author_era)) {
    score += config.similar_era_boost;  // +1.1
  }

  // Embedding similarity (if available)
  if (userSignals.tasteVector && passage.embedding) {
    const similarity = cosineSimilarity(userSignals.tasteVector, passage.embedding);
    score += similarity * config.embedding_similarity_boost;  // +0 to +0.5
  }

  // Note: popularity boost skipped if chunk_stats is empty
  // Will activate organically as users engage

  return score;  // Range: 0 to ~10
}

function computePersonalizationScore(
  resonance: number,  // 0-100
  preference: number, // 0-10
  weights: { resonance_weight: number; preference_weight: number }
): number {
  const preferenceNormalized = (preference / 10) * 100;  // Scale 0-10 to 0-100
  return (resonance * weights.resonance_weight) + (preferenceNormalized * weights.preference_weight);
}
```

**Estimated effort:** 3-5 days
**Should wait for:** Phase 0 (sample_key), Phase 4 (resonance scores)

---

### Phase 6: Cluster Quality Computation (REDESIGNED)

**Goal:** Compute embedding-based cluster quality scores at scale.

**Dependency:** Embeddings 100% complete

**Files to Create:**
- `scripts/compute-cluster-quality.ts`

**FIXED: Scalable Algorithm**

The original plan to load all 10M embeddings into memory (~60GB) is not feasible. New approach:

**Step 1: Sample-Based Clustering**
```typescript
// Sample 100K passages with embeddings for clustering
const SAMPLE_SIZE = 100000;
const K_CLUSTERS = 500;

async function sampleForClustering(): Promise<{ id: string; embedding: number[] }[]> {
  return sql`
    SELECT id, embedding
    FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY random()
    LIMIT ${SAMPLE_SIZE}
  `;
}
```

**Step 2: Run K-Means on Sample (in-memory, ~600MB)**
```typescript
import { kmeans } from 'ml-kmeans';

const samples = await sampleForClustering();
const embeddings = samples.map(s => s.embedding);

const result = kmeans(embeddings, K_CLUSTERS, {
  initialization: 'kmeans++',
  maxIterations: 100
});

// result.centroids = 500 centroids, each 1536 dimensions
// result.clusters = cluster assignment for each sample
```

**Step 3: Compute Gold Density Per Cluster**
```typescript
// For each cluster, what % of members are "gold" (wikiquote or curated)?
const clusterGoldDensity = new Map<number, number>();

for (let i = 0; i < K_CLUSTERS; i++) {
  const memberIds = samples
    .filter((_, idx) => result.clusters[idx] === i)
    .map(s => s.id);

  const goldCount = await sql`
    SELECT COUNT(*) FROM chunks
    WHERE id IN ${sql(memberIds)}
      AND (wikiquote_match = true OR manually_curated = true)
  `;

  clusterGoldDensity.set(i, goldCount / memberIds.length);
}
```

**Step 4: Store Centroids in Database**
```sql
CREATE TABLE cluster_centroids (
  cluster_id INTEGER PRIMARY KEY,
  centroid vector(1536) NOT NULL,
  gold_density FLOAT NOT NULL,
  member_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Step 5: Assign All Passages to Nearest Centroid (batch job)**
```typescript
// Process in batches of 10K
const BATCH_SIZE = 10000;

async function assignClusterQuality() {
  const centroids = await sql`SELECT * FROM cluster_centroids`;

  let processed = 0;
  while (true) {
    const batch = await sql`
      SELECT id, embedding FROM chunks
      WHERE embedding IS NOT NULL AND cluster_quality IS NULL
      LIMIT ${BATCH_SIZE}
    `;

    if (batch.length === 0) break;

    for (const passage of batch) {
      // Find nearest centroid using pgvector
      const nearest = await sql`
        SELECT cluster_id, gold_density,
               centroid <=> ${passage.embedding}::vector as distance
        FROM cluster_centroids
        ORDER BY centroid <=> ${passage.embedding}::vector
        LIMIT 1
      `;

      await sql`
        UPDATE chunks SET cluster_quality = ${nearest[0].gold_density}
        WHERE id = ${passage.id}
      `;
    }

    processed += batch.length;
    console.log(`Processed ${processed} passages...`);
  }
}
```

**Alternative: Simpler KNN Approach**

If clustering is too complex, use direct KNN:
```sql
-- For each passage, find 50 nearest neighbors and count gold
-- This is O(n * k) but can be indexed with ivfflat

UPDATE chunks c SET cluster_quality = (
  SELECT COUNT(*) FILTER (WHERE wikiquote_match = true OR manually_curated = true)::float / 50
  FROM (
    SELECT id, wikiquote_match, manually_curated
    FROM chunks c2
    WHERE c2.embedding IS NOT NULL AND c2.id != c.id
    ORDER BY c2.embedding <=> c.embedding
    LIMIT 50
  ) neighbors
)
WHERE c.embedding IS NOT NULL;
```

**Estimated effort:** 2-3 days
**Must wait for:** Embeddings complete

---

### Phase 7: Admin Dashboard Extension

**Goal:** Add UI for new configuration tables.

**Files to Modify:**
- `webapp/app/admin/page.tsx` (or equivalent admin components)
- `server/routes/admin.ts`

**New Panels:**
1. **Resonance Score Configuration** - Weight sliders, tier cutoffs
2. **Preference Score Configuration** - Boost value sliders
3. **Tier Statistics Dashboard** - Live preview of tier distribution
4. **Personalization Blend Configuration** - By signal count table
5. **Tier Sampling Configuration** - By signal count table
6. **Corpus Blend Configuration** - Curated vs full ratio

**Estimated effort:** 3-4 days

---

## 4. Embedding Integration Strategy

### 4.1 Current Embedding Usage

The `user_taste_vectors` table already exists:
```sql
CREATE TABLE IF NOT EXISTS user_taste_vectors (
  user_id TEXT PRIMARY KEY,
  taste_vector vector(1536),
  based_on_count INTEGER,
  updated_at TIMESTAMPTZ
);
```

But it's not being populated or used.

**pgvector dependency:** This table requires the pgvector extension, which is already enabled (embeddings are being generated). The embedding index added in Section 2.1 enables efficient similarity queries.

### 4.2 Integration Plan

**Add taste vector computation** (after embeddings complete):

```typescript
async function computeTasteVector(userId: string): Promise<number[] | null> {
  const likedEmbeddings = await sql`
    SELECT c.embedding FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    WHERE ul.user_id = ${userId} AND c.embedding IS NOT NULL
  `;

  if (likedEmbeddings.length < config.minLikesForTasteVector) return null;

  // Average all embeddings
  const dims = 1536;
  const tasteVector = new Array(dims).fill(0);
  for (const row of likedEmbeddings) {
    const emb = row.embedding;
    for (let i = 0; i < dims; i++) {
      tasteVector[i] += emb[i];
    }
  }
  for (let i = 0; i < dims; i++) {
    tasteVector[i] /= likedEmbeddings.length;
  }

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

### 4.3 Parallel Development Approach

| Component | Can Start Now | Depends on Embeddings |
|-----------|---------------|----------------------|
| sample_key infrastructure | YES | NO |
| Heuristic score computation | YES | NO |
| Bartlett's matching | YES | NO |
| Wikisource matching | YES | NO |
| Resonance score (partial) | YES | NO (cluster_quality later) |
| Feed algorithm rewrite | YES | NO |
| Cluster quality computation | NO | YES |
| Taste vector integration | NO | YES |

---

## 5. Multi-Platform Considerations

### 5.1 Backend/Webapp First

All changes are in the backend API layer:
- `/api/feed` - Same endpoint, new algorithm
- `/api/admin/config` - Extended configuration
- Database schema changes - Migration script

The webapp consumes the feed API without changes to its structure.

### 5.2 Native Apps (Apple, Android, Chrome)

**No changes required** to native apps for Phase 0-6. The API contract remains:

```typescript
interface FeedResponse {
  passages: Passage[];
  nextCursor: string;
  hasMore: boolean;
  personalized?: boolean;
}
```

**Future enhancements** (Phase 7+):
- Admin dashboard may need native versions
- Could add "Why this passage?" explanation endpoint

---

## 6. Testing Strategy

### 6.1 Performance Tests

```sql
-- Before/After: Feed query latency
EXPLAIN ANALYZE SELECT * FROM chunks
WHERE sample_key >= 0.5
ORDER BY sample_key
LIMIT 100;

-- Target: <50ms (currently 3-5s with ORDER BY RANDOM)
```

### 6.2 Quality Tests

```sql
-- Tier distribution should match targets
SELECT quality_tier,
       COUNT(*),
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM chunks
WHERE resonance_score IS NOT NULL
GROUP BY quality_tier;

-- Target: S=0.5-2%, A=3-10%, B=15-25%, C=60-80%

-- NULL tier count (before resonance computed)
SELECT COUNT(*) FROM chunks WHERE quality_tier IS NULL;
```

### 6.3 Manual Review

Sample 20 passages from each tier and manually assess:
- S-tier: Should feel "quotable", standalone, insightful
- C-tier: Should feel like "connective tissue" prose

---

## 7. Rollout Plan

**Simplified:** No gradual rollout needed (no current users).

### 7.1 Feature Flags

Add to `app_config`:
```json
{
  "newAlgorithmEnabled": true,
  "newAlgorithmPercentage": 100
}
```

### 7.2 Deployment Steps

1. Run migration script
2. Run batch jobs (heuristic scores, Bartlett's, resonance)
3. Deploy new algorithm code
4. Monitor feed response times

### 7.3 Metrics to Monitor

- Feed response time (target: <200ms, was 3-5s)
- First-10-scroll like rate (target: >5%)
- Session length for new users (target: +20%)
- Bounce rate (<5 scrolls) (target: <20%)

---

## 8. Implementation Timeline

| Phase | Duration | Dependencies | Can Parallel with Embeddings |
|-------|----------|--------------|------------------------------|
| 0: sample_key | 2-3 days | None | YES |
| 1: Heuristic scores | 1 day | None | YES |
| 2: Bartlett's matching | 2-3 days | pg_trgm enabled | YES |
| 3: Wikisource matching | 1 day | None | YES |
| 4: Resonance scores | 1 day | Phases 1-3 | YES (partial) |
| 5: Feed algorithm | 3-5 days | Phases 0, 4 | YES |
| 6: Cluster quality | 2-3 days | Embeddings 100% | NO |
| 7: Admin dashboard | 3-4 days | Phase 5 | YES |

**Total: ~16-21 days**

---

## 9. Files to Create/Modify Summary

### New Files

| File | Purpose |
|------|---------|
| `server/db/migrate-feed-algorithm.ts` | Database schema changes |
| `scripts/compute-heuristic-scores.ts` | Batch job: heuristic scoring |
| `scripts/match-bartletts.ts` | Batch job: Bartlett's matching |
| `scripts/match-wikisource-featured.ts` | Batch job: Wikisource matching |
| `scripts/compute-resonance-scores.ts` | Batch job: resonance scoring |
| `scripts/compute-cluster-quality.ts` | Batch job: embedding clusters |
| `scripts/compute-taste-vectors.ts` | Batch job: user taste vectors |
| `data/bartletts/quotes.json` | Parsed Bartlett's quotes |

### Modified Files

| File | Changes |
|------|---------|
| `server/services/feed-algorithm.ts` | Major rewrite - unified pipeline |
| `server/services/config.ts` | Extended configuration types + caches |
| `server/routes/admin.ts` | New config endpoints |
| `server/routes/feed.ts` | Both paths use unified algorithm |
| `webapp/app/admin/*` | New admin panels |

---

## 10. Decisions Confirmed

| Question | Answer |
|----------|--------|
| Goodreads scraping | YES - will implement |
| LLM quality scoring | YES - ~$35-50 budget approved |
| A/B testing | NO - not needed at this stage |
| Rollout strategy | All at once (no users) |

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| sample_key backfill slow | Medium | Medium | Batch in 100K chunks, run overnight |
| Resonance scores bias toward wikiquote | Medium | Low | Monitor tier distribution, adjust weights |
| Feed latency regression | Low | High | Test thoroughly before deploy |
| Memory pressure from batch jobs | Medium | Low | Schedule off-peak, limit batch sizes |
| Breaking existing personalization | Low | Medium | Preserve signal collection logic |
| Under-filled sampling queries | Medium | Medium | Retry with relaxed constraints |

---

## Appendix A: Current Feed Algorithm Location Reference

| Component | File | Line Range |
|-----------|------|------------|
| Feed endpoints | `server/routes/feed.ts` | 1-75 |
| Main algorithm | `server/services/feed-algorithm.ts` | 1-1122 |
| generateFeed | `server/services/feed-algorithm.ts` | ~430-600 |
| generatePersonalizedFeed | `server/services/feed-algorithm.ts` | ~925-1103 |
| Configuration | `server/services/config.ts` | 1-146 |
| Admin endpoints | `server/routes/admin.ts` | 23-160+ |
| Embedding generation | `scripts/generate-embeddings.ts` | 1-209 |
| Parallel workers | `scripts/embed-lower.ts`, `embed-upper.ts` | 1-169 each |
| DB client | `server/db/client.ts` | 1-24 |
| Phase 2 migration | `server/db/migrate-phase2.ts` | 1-200+ |

---

## Appendix B: Signal Count Definition

Per strategy document (`DSbootstrapPlanArch.md:330`):

```typescript
signalCount = likeCount + bookmarkCount
```

This counts raw likes and bookmarks, NOT unique authors/works. This differs from the current implementation which counts unique liked authors, so the implementation should be aligned.

---

**END OF PLAN v2 - READY FOR IMPLEMENTATION**
