# Doomscrolls Feed Algorithm Rearchitecture - Implementation Plan v1

**Generated:** 2026-01-17
**Author:** Claude Code
**Status:** PENDING REVIEW

---

## Executive Summary

This document provides a detailed implementation plan for the three-score hierarchy feed algorithm described in `DSbootstrapPlanArch.md`. The plan is based on thorough analysis of the existing codebase and considers:

- Current system architecture and constraints
- Embedding generation in progress (88.3% complete)
- Server resource availability
- Multi-platform requirements (backend/webapp first, then native apps)

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
1. **24 instances of `ORDER BY RANDOM()`** - causes full table scan on 10.3M rows (~3-5 seconds each)
2. **No quality scoring** - all passages equally likely to appear
3. **Basic personalization** - signal-based boosts exist but no resonance/preference blend
4. **Binary user state** - either anonymous (curated works) or logged-in (full corpus)

**Current Query Structure (typical):**
```sql
SELECT c.id, c.text, c.type, ...
FROM chunks c
JOIN authors a ON c.author_id = a.id
LEFT JOIN works w ON c.work_id = w.id
WHERE LENGTH(c.text) BETWEEN 10 AND 1000
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

---

## 2. Database Schema Changes

### 2.1 New Columns on `chunks` Table

```sql
-- PERFORMANCE: sample_key for fast indexed sampling
ALTER TABLE chunks ADD COLUMN sample_key FLOAT;

-- QUALITY: resonance_score and derived tier
ALTER TABLE chunks ADD COLUMN resonance_score FLOAT;
ALTER TABLE chunks ADD COLUMN quality_tier VARCHAR(1) GENERATED ALWAYS AS (
  CASE
    WHEN resonance_score >= 80 THEN 'S'
    WHEN resonance_score >= 60 THEN 'A'
    WHEN resonance_score >= 40 THEN 'B'
    ELSE 'C'
  END
) STORED;
ALTER TABLE chunks ADD COLUMN signal_count INTEGER DEFAULT 0;

-- QUALITY SIGNALS (for resonance computation)
ALTER TABLE chunks ADD COLUMN wikiquote_match BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN bartletts_match BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN goodreads_count INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN wikisource_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN llm_quality_score FLOAT;
ALTER TABLE chunks ADD COLUMN manually_curated BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN cluster_quality FLOAT;
ALTER TABLE chunks ADD COLUMN heuristic_score FLOAT;

-- INDEXES
CREATE INDEX idx_chunks_sample_key ON chunks(sample_key);
CREATE INDEX idx_chunks_quality_tier ON chunks(quality_tier);
CREATE INDEX idx_chunks_resonance_score ON chunks(resonance_score);
CREATE INDEX idx_chunks_tier_sample_key ON chunks(quality_tier, sample_key);
```

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

### 2.3 Migration Strategy

**File to create:** `server/db/migrate-feed-algorithm.ts`

```typescript
export async function migrateFeedAlgorithm() {
  // 1. Add columns (if not exist)
  // 2. Create config tables (if not exist)
  // 3. Create indexes
  // 4. Backfill sample_key with random values
  // 5. Backfill wikiquote_match from source column
}
```

**Backfill Operations:**
```sql
-- Backfill sample_key (one-time, ~30 min for 10.3M rows)
UPDATE chunks SET sample_key = random() WHERE sample_key IS NULL;

-- Backfill wikiquote_match from existing source data
UPDATE chunks SET wikiquote_match = TRUE WHERE source = 'wikiquote';
```

---

## 3. Implementation Phases

### Phase 0: Performance Foundation (Priority: CRITICAL)

**Goal:** Replace `ORDER BY RANDOM()` with indexed sampling. This alone will drop feed latency from 3-5s to <200ms.

**Files to Modify:**
- `server/services/feed-algorithm.ts` - Replace 24 instances of ORDER BY RANDOM()
- `server/db/migrate-feed-algorithm.ts` - New migration file

**Changes:**

1. Add `sample_key` column and index
2. Backfill sample_key with random values
3. Create new sampling function:

```typescript
// NEW: Fast sampling with sample_key
async function sampleFromTier(
  tier: string | null,  // null = any tier
  limit: number,
  excludeIds: string[] = []
): Promise<Passage[]> {
  const startKey = Math.random();
  const exclusionClause = excludeIds.length > 0
    ? sql`AND id NOT IN ${sql(excludeIds)}`
    : sql``;
  const tierClause = tier
    ? sql`AND quality_tier = ${tier}`
    : sql``;

  let results = await sql`
    SELECT * FROM chunks
    WHERE sample_key >= ${startKey}
      ${tierClause}
      ${exclusionClause}
    ORDER BY sample_key
    LIMIT ${limit}
  `;

  // Wrap around if needed
  if (results.length < limit) {
    const remaining = limit - results.length;
    const existingIds = results.map(r => r.id);
    const wrapResults = await sql`
      SELECT * FROM chunks
      WHERE sample_key < ${startKey}
        ${tierClause}
        AND id NOT IN ${sql([...excludeIds, ...existingIds])}
      ORDER BY sample_key
      LIMIT ${remaining}
    `;
    results = [...results, ...wrapResults];
  }

  return results;
}
```

4. Replace all 24 `ORDER BY RANDOM()` instances with sample_key queries

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
2. Enable pg_trgm extension (if not already)
3. Match quotes to corpus using trigram similarity
4. Update `bartletts_match = TRUE` for matches

**SQL Setup:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_chunks_text_trgm ON chunks USING GIN (text gin_trgm_ops);
```

**Matching Query:**
```sql
SELECT id, text, similarity(text, $1) as sim
FROM chunks
WHERE author_id = $2 AND similarity(text, $1) > 0.5
ORDER BY sim DESC LIMIT 1
```

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

**Estimated effort:** 1 day
**Can run in parallel with embeddings:** YES

---

### Phase 4: Resonance Score Computation

**Goal:** Compute resonance scores for all passages.

**Dependency:** Phases 1-3 complete (heuristic scores, Bartlett's, Wikisource)

**Files to Create:**
- `scripts/compute-resonance-scores.ts`

**Algorithm:**
```typescript
function computeResonanceScore(passage: Passage, config: ResonanceConfig): { score: number; signalCount: number } {
  const signalDefinitions = {
    wikiquote_match: { value: passage.wikiquote_match ? 1 : 0, present: passage.wikiquote_match !== null },
    bartletts_match: { value: passage.bartletts_match ? 1 : 0, present: passage.bartletts_match !== null },
    wikisource_featured: { value: passage.wikisource_featured ? 1 : 0, present: passage.wikisource_featured !== null },
    goodreads_count: { value: Math.min(passage.goodreads_count / 1000, 1), present: passage.goodreads_count > 0 },
    llm_quality_score: { value: (passage.llm_quality_score || 0) / 10, present: passage.llm_quality_score !== null },
    manually_curated: { value: passage.manually_curated ? 1 : 0, present: passage.manually_curated !== null },
    cluster_quality: { value: passage.cluster_quality || 0, present: passage.cluster_quality !== null },
    heuristic_score: { value: passage.heuristic_score || 0, present: passage.heuristic_score !== null },
  };

  // Sum only over PRESENT signals, then renormalize
  let weightedSum = 0;
  let presentWeightSum = 0;
  let signalCount = 0;

  for (const [signal, weight] of Object.entries(config.weights)) {
    const def = signalDefinitions[signal];
    if (def && def.present) {
      weightedSum += def.value * weight;
      presentWeightSum += weight;
      signalCount++;
    }
  }

  const rawScore = presentWeightSum > 0 ? (weightedSum / presentWeightSum) * 100 : 50;

  // Apply confidence penalty for sparse signals
  const confidenceFactor = Math.min(signalCount / config.minSignalsFullConfidence, 1);
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

**Goal:** Integrate three-score hierarchy into feed endpoint.

**Files to Modify:**
- `server/services/feed-algorithm.ts` (major rewrite)
- `server/services/config.ts` (extend configuration)
- `server/routes/feed.ts` (minor - load new config)

**New Algorithm Flow:**

```typescript
async function generateFeed(options: FeedOptions): Promise<FeedResponse> {
  // 1. LOAD USER STATE
  const userSignals = await loadUserSignals(options.userId);
  const signalCount = userSignals.likeCount + userSignals.bookmarkCount;

  // 2. LOAD CONFIGURATION
  const config = await loadAllConfig();  // resonance, preference, blend configs

  // 3. DETERMINE SAMPLING PARAMETERS
  const corpusBlend = getCorpusBlend(signalCount, config.corpusBlend);
  const tierWeights = getTierWeights(signalCount, config.tierSampling);
  const blendWeights = getBlendWeights(signalCount, config.personalizationBlend);

  // 4. CANDIDATE SAMPLING (5x oversample)
  const targetCount = options.limit * 5;
  const candidates = await sampleCandidates(targetCount, corpusBlend, tierWeights, options);

  // 5. SCORE ALL CANDIDATES
  const scored = candidates.map(passage => ({
    ...passage,
    preferenceScore: computePreferenceScore(passage, userSignals, config.preference),
    personalizationScore: computePersonalizationScore(
      passage.resonance_score,
      computePreferenceScore(passage, userSignals, config.preference),
      blendWeights
    )
  }));

  // 6. EXPLOIT/EXPLORE SELECTION
  scored.sort((a, b) => b.personalizationScore - a.personalizationScore);
  const exploitCount = Math.floor(options.limit * config.exploitExplore.exploit_ratio);
  const exploreCount = options.limit - exploitCount;

  const exploit = scored.slice(0, exploitCount);
  const explorePool = scored.slice(exploitCount);
  const explore = shuffle(explorePool).slice(0, exploreCount);

  let selected = [...exploit, ...explore];

  // 7. APPLY EXISTING DIVERSITY ENFORCEMENT (PRESERVE)
  selected = applyDiversityRules(selected, options.limit, cursorData, config);

  // 8. RETURN
  return {
    passages: selected.map(formatPassage),
    nextCursor: encodeCursor(updateCursor(cursorData, selected)),
    hasMore: true
  };
}

function computePersonalizationScore(
  resonance: number,
  preference: number,
  weights: { resonance: number; preference: number }
): number {
  const preferenceNormalized = (preference / 10) * 100;  // Scale 0-10 to 0-100
  return (resonance * weights.resonance) + (preferenceNormalized * weights.preference);
}
```

**Key Changes:**
1. Replace `ORDER BY RANDOM()` with tier-weighted `sample_key` sampling
2. Add resonance score to candidate selection criteria
3. Implement gradual blend weights based on signal count
4. Preserve existing diversity rules

**Estimated effort:** 3-5 days
**Should wait for:** Phase 0 (sample_key), Phase 4 (resonance scores)

---

### Phase 6: Cluster Quality Computation

**Goal:** Compute embedding-based cluster quality scores.

**Dependency:** Embeddings 100% complete

**Files to Create:**
- `scripts/compute-cluster-quality.ts`

**Algorithm:**
1. Load all embeddings into memory (or use pgvector extension for similarity)
2. Run K-means clustering (K=1000)
3. For each cluster, compute "gold density" = % of passages that are wikiquote OR curated
4. Assign cluster quality to each passage based on its cluster's gold density

**Alternative (simpler):** Use pgvector KNN to compute "average gold proximity":
```sql
-- For each passage, find 100 nearest neighbors
-- Count how many are wikiquote_match = true OR manually_curated = true
-- cluster_quality = gold_neighbor_count / 100
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
2. **Tier Statistics Dashboard** - Live preview of tier distribution
3. **Personalization Blend Configuration** - By signal count table
4. **Tier Sampling Configuration** - By signal count table
5. **Corpus Blend Configuration** - Curated vs full ratio

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

**Add embedding similarity to preference score:**

```typescript
// In computePreferenceScore()
if (userSignals.tasteVector && passage.embedding) {
  const similarity = cosineSimilarity(userSignals.tasteVector, passage.embedding);
  score += similarity * config.embeddingSimilarityBoost;  // default: 0.5
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
```

### 6.3 Manual Review

Sample 20 passages from each tier and manually assess:
- S-tier: Should feel "quotable", standalone, insightful
- C-tier: Should feel like "connective tissue" prose

---

## 7. Rollout Plan

### 7.1 Feature Flags

Add to `app_config`:
```json
{
  "newAlgorithmEnabled": false,
  "newAlgorithmPercentage": 0
}
```

### 7.2 Gradual Rollout

1. **Week 1:** Internal testing (0% users)
2. **Week 2:** 5% of users
3. **Week 3:** 25% of users
4. **Week 4:** 50% of users
5. **Week 5:** 100% of users

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
| `server/services/feed-algorithm.ts` | Major rewrite - new algorithm |
| `server/services/config.ts` | Extended configuration types |
| `server/routes/admin.ts` | New config endpoints |
| `webapp/app/admin/*` | New admin panels |

---

## 10. Questions/Decisions Needed

1. **Goodreads scraping:** Do we want to pursue Goodreads signal collection? Higher effort but valuable signal.

2. **LLM quality scoring:** Budget for Gemini Flash scoring (~$35-50 for 2M passages)? Can defer.

3. **A/B testing infrastructure:** Do we want to build A/B testing for algorithm variants?

4. **Rollout strategy:** Gradual % rollout vs. feature flag toggle?

5. **Embedding wait:** Start cluster_quality after embeddings complete, or use simpler heuristic?

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| sample_key backfill slow | Medium | Medium | Run overnight, batch updates |
| Resonance scores bias toward wikiquote | Medium | Low | Monitor tier distribution, adjust weights |
| Feed latency regression | Low | High | Test thoroughly, feature flag rollback |
| Memory pressure from batch jobs | Medium | Low | Schedule off-peak, limit batch sizes |
| Breaking existing personalization | Low | Medium | Preserve signal collection logic |

---

## Appendix A: Current Feed Algorithm Location Reference

| Component | File | Line Range |
|-----------|------|------------|
| Feed endpoints | `server/routes/feed.ts` | 1-75 |
| Main algorithm | `server/services/feed-algorithm.ts` | 1-1122 |
| Configuration | `server/services/config.ts` | 1-146 |
| Admin endpoints | `server/routes/admin.ts` | 23-160+ |
| Embedding generation | `scripts/generate-embeddings.ts` | 1-209 |
| Parallel workers | `scripts/embed-lower.ts`, `embed-upper.ts` | 1-169 each |
| DB client | `server/db/client.ts` | 1-24 |
| Phase 2 migration | `server/db/migrate-phase2.ts` | 1-200+ |

---

**END OF PLAN - AWAITING REVIEW**
