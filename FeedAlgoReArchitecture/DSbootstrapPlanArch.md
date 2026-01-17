# Doomscrolls Bootstrap Algorithm - Comprehensive Architectural Plan

**Document Purpose:** Complete architectural specification for Claude Code to implement the bootstrap/cold-start algorithm. This document contains ALL working logic, formulas, default values, and system integration details. Claude Code should use this as the authoritative source and examine the existing codebase to determine implementation specifics.

**Reference:** `doomscrolls-bootstrap-strategy-v6.md` contains the full product strategy and rationale.

---

## Table of Contents

1. Executive Summary
2. System Architecture Overview
3. The Three-Score Hierarchy
4. Database Schema Changes
5. Resonance Score System
6. Preference Score System
7. Personalization Score System
8. Gradual User State Transitions
9. Feed Algorithm Integration
10. Signal Collection & Matching
11. Admin Dashboard Requirements
12. Implementation Phases
13. Testing & Validation

---

## Executive Summary

### The Problem

We have 10.3M passages from 17,291 works. Random sampling surfaces "connective tissue" prose ("He walked down the hall and opened the door") rather than gems. New users see mediocre content and churn before generating enough engagement signals for personalization to help.

### The Solution

Implement a **three-score hierarchy** that:
1. Pre-computes intrinsic quality scores (resonance_score) for all passages
2. Computes user-specific fit (preference_score) in real-time
3. Blends them into a final personalization_score with weights that shift based on user engagement

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Feed response time | ~3-5s (ORDER BY RANDOM) | <200ms |
| S-tier passage quality | N/A | Consistently quotable on manual review |
| New user session length | Baseline | +20% |
| Like rate in first 10 scrolls | Baseline | >5% |

---

## The Three-Score Hierarchy

### Score Definitions

| Score | Scope | Stored? | When Computed | Range | Purpose |
|-------|-------|---------|---------------|-------|---------|
| resonance_score | Per passage (intrinsic) | Yes, in chunks | Batch job | 0-100 | "Is this passage inherently quotable/interesting?" |
| preference_score | Per passage x per user | No, ephemeral | Real-time per request | 0-10 | "Does this match what THIS user likes?" |
| personalization_score | Per passage x per user | No, ephemeral | Real-time per request | 0-100 | "What should we show THIS user RIGHT NOW?" |
| quality_tier | Per passage (derived) | Yes, computed column | Auto-derived | S/A/B/C | Bucketed version of resonance_score for sampling |

### The Blending Formula

```
personalization_score = (resonance_score * resonance_weight) + (preference_score_normalized * preference_weight)
preference_score_normalized = (preference_score / 10) * 100
```

Weights are determined by user's signal count (see Gradual Transitions section).

---

## Database Schema Changes

### New Columns on chunks Table

```sql
-- RESONANCE SCORE INFRASTRUCTURE
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

-- SIGNAL COLUMNS
ALTER TABLE chunks ADD COLUMN wikiquote_match BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN bartletts_match BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN goodreads_count INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN kindle_highlight_count INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN wikisource_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN llm_quality_score FLOAT;
ALTER TABLE chunks ADD COLUMN manually_curated BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN cluster_quality FLOAT;
ALTER TABLE chunks ADD COLUMN heuristic_score FLOAT;

-- PERFORMANCE: SAMPLE_KEY FOR FAST INDEXED SAMPLING
ALTER TABLE chunks ADD COLUMN sample_key FLOAT DEFAULT random();

-- INDEXES
CREATE INDEX idx_chunks_resonance_score ON chunks(resonance_score);
CREATE INDEX idx_chunks_quality_tier ON chunks(quality_tier);
CREATE INDEX idx_chunks_sample_key ON chunks(sample_key);
CREATE INDEX idx_chunks_tier_sample_key ON chunks(quality_tier, sample_key);
CREATE INDEX idx_chunks_tier_author ON chunks(quality_tier, author_id);

-- BACKFILL
UPDATE chunks SET sample_key = random() WHERE sample_key IS NULL;
UPDATE chunks SET wikiquote_match = TRUE WHERE source = 'wikiquote';
```

### New Configuration Tables

```sql
-- RESONANCE SCORE CONFIGURATION
CREATE TABLE resonance_config (
  id SERIAL PRIMARY KEY,
  weight_wikiquote INTEGER DEFAULT 25,
  weight_bartletts INTEGER DEFAULT 15,
  weight_wikisource INTEGER DEFAULT 10,
  weight_goodreads INTEGER DEFAULT 15,
  weight_kindle INTEGER DEFAULT 15,
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
INSERT INTO resonance_config (id) VALUES (1);

-- PREFERENCE SCORE CONFIGURATION
CREATE TABLE preference_config (
  id SERIAL PRIMARY KEY,
  boost_followed_author FLOAT DEFAULT 3.0,
  boost_liked_author FLOAT DEFAULT 1.5,
  boost_liked_category FLOAT DEFAULT 1.3,
  boost_bookmarked_work FLOAT DEFAULT 1.2,
  boost_bookmarked_author FLOAT DEFAULT 1.15,
  boost_era_match FLOAT DEFAULT 1.1,
  boost_embedding_similarity FLOAT DEFAULT 0.5,
  boost_popularity FLOAT DEFAULT 0.3,
  boost_exploration_random FLOAT DEFAULT 0.3,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO preference_config (id) VALUES (1);

-- PERSONALIZATION BLEND CONFIGURATION
CREATE TABLE personalization_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL,
  resonance_weight FLOAT NOT NULL,
  preference_weight FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signal_threshold)
);
INSERT INTO personalization_blend_config (signal_threshold, resonance_weight, preference_weight) VALUES
  (0, 0.9, 0.1),
  (3, 0.7, 0.3),
  (6, 0.5, 0.5),
  (11, 0.3, 0.7),
  (20, 0.2, 0.8);

-- CORPUS BLEND CONFIGURATION
CREATE TABLE corpus_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL,
  curated_ratio FLOAT NOT NULL,
  full_corpus_ratio FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signal_threshold)
);
INSERT INTO corpus_blend_config (signal_threshold, curated_ratio, full_corpus_ratio) VALUES
  (0, 1.0, 0.0),
  (1, 0.8, 0.2),
  (2, 0.6, 0.4),
  (3, 0.4, 0.6),
  (5, 0.2, 0.8),
  (10, 0.0, 1.0);

-- TIER SAMPLING CONFIGURATION
CREATE TABLE tier_sampling_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL,
  s_tier_ratio FLOAT NOT NULL,
  a_tier_ratio FLOAT NOT NULL,
  b_tier_ratio FLOAT NOT NULL,
  c_tier_ratio FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signal_threshold)
);
INSERT INTO tier_sampling_config (signal_threshold, s_tier_ratio, a_tier_ratio, b_tier_ratio, c_tier_ratio) VALUES
  (0, 0.50, 0.35, 0.12, 0.03),
  (3, 0.40, 0.35, 0.20, 0.05),
  (6, 0.30, 0.30, 0.30, 0.10),
  (11, 0.20, 0.25, 0.35, 0.20),
  (20, 0.15, 0.20, 0.35, 0.30);

-- EXPLOIT/EXPLORE CONFIGURATION
CREATE TABLE exploit_explore_config (
  id SERIAL PRIMARY KEY,
  exploit_ratio FLOAT DEFAULT 0.7,
  explore_ratio FLOAT DEFAULT 0.3,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO exploit_explore_config (id) VALUES (1);
```

---

## Resonance Score System

### Signal Definitions & Normalization

| Signal | Column | Normalization | Present Condition | Default Weight |
|--------|--------|---------------|-------------------|----------------|
| Wikiquote source | wikiquote_match | Boolean: 1/0 | IS NOT NULL | 25 |
| Bartlett's match | bartletts_match | Boolean: 1/0 | IS NOT NULL | 15 |
| Wikisource featured | wikisource_featured | Boolean: 1/0 | IS NOT NULL | 10 |
| Goodreads count | goodreads_count | min(count/1000, 1) | > 0 | 15 |
| Kindle highlights | kindle_highlight_count | min(count/500, 1) | > 0 | 15 |
| LLM quality | llm_quality_score | score/10 | IS NOT NULL | 20 |
| Manual curation | manually_curated | Boolean: 1/0 | IS NOT NULL | 10 |
| Cluster quality | cluster_quality | Already 0-1 | IS NOT NULL | 10 |
| Heuristic score | heuristic_score | Already 0-1 | IS NOT NULL | 10 |

### Computation Algorithm (TypeScript)

```typescript
function computeResonanceScore(passage, config) {
  const signalDefinitions = {
    wikiquote_match: { 
      value: passage.wikiquote_match ? 1 : 0, 
      present: passage.wikiquote_match !== null 
    },
    bartletts_match: { 
      value: passage.bartletts_match ? 1 : 0, 
      present: passage.bartletts_match !== null 
    },
    wikisource_featured: { 
      value: passage.wikisource_featured ? 1 : 0, 
      present: passage.wikisource_featured !== null 
    },
    goodreads_count: { 
      value: Math.min(passage.goodreads_count / 1000, 1), 
      present: passage.goodreads_count !== null && passage.goodreads_count > 0 
    },
    kindle_highlights: { 
      value: Math.min(passage.kindle_highlights / 500, 1), 
      present: passage.kindle_highlights !== null && passage.kindle_highlights > 0 
    },
    llm_score: { 
      value: (passage.llm_score || 0) / 10, 
      present: passage.llm_score !== null 
    },
    manual_curation: { 
      value: passage.manually_curated ? 1 : 0, 
      present: passage.manually_curated !== null 
    },
    embedding_cluster_quality: { 
      value: passage.cluster_quality || 0, 
      present: passage.cluster_quality !== null 
    },
    heuristic_score: { 
      value: passage.heuristic_score || 0, 
      present: passage.heuristic_score !== null 
    },
  };
  
  // STEP 1: Sum only over PRESENT signals
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
  
  // STEP 2: Renormalize over present signals
  const rawScore = presentWeightSum > 0 
    ? (weightedSum / presentWeightSum) * 100 
    : 50;
  
  // STEP 3: Apply confidence penalty
  const confidenceFactor = Math.min(signalCount / config.minSignalsForFullConfidence, 1);
  const finalScore = (rawScore * confidenceFactor) + (50 * (1 - confidenceFactor));
  
  return { score: finalScore, signalCount };
}
```

### Tier Distribution Targets

| Tier | Score Range | Target % | Target Count (~10.3M) |
|------|-------------|----------|----------------------|
| S | >= 80 | 0.5-2% | 50K-200K |
| A | 60-79 | 3-10% | 300K-1M |
| B | 40-59 | 15-25% | 1.5M-2.5M |
| C | < 40 | 60-80% | 6M-8M |

---

## Preference Score System

### User Signals Data Structure

```typescript
interface UserSignals {
  followedAuthors: number[];
  likedAuthors: { [author_id: number]: number };  // author_id -> like count
  likedCategories: string[];
  bookmarkedWorks: number[];
  bookmarkedAuthors: number[];
  preferredEras: string[];
  tasteVector: number[] | null;  // Average embedding of liked passages
  likeCount: number;
  bookmarkCount: number;
  signalCount: number;  // likeCount + bookmarkCount
}
```

### Signal Boosts (Defaults)

| Signal | Default Boost | Notes |
|--------|---------------|-------|
| followed_author | +3.0 | Explicit follow |
| liked_author | +1.5 | Scaled by min(likeCount/5, 1) |
| liked_category | +1.3 | Category match |
| bookmarked_work | +1.2 | Work bookmark |
| bookmarked_author | +1.15 | Author bookmark |
| era_match | +1.1 | Era preference |
| embedding_similarity | +0.5 | Cosine similarity to taste vector |
| popularity | +0.3 | Normalized by min(like_count/100, 1) |
| exploration_random | +0.3 | Random for serendipity |

### Computation Algorithm

```typescript
function computePreferenceScore(passage, userSignals, config) {
  let score = 0;
  const b = config.boosts;
  
  if (userSignals.followedAuthors.includes(passage.author_id)) {
    score += b.followed_author;
  }
  
  const authorLikeCount = userSignals.likedAuthors[passage.author_id] || 0;
  if (authorLikeCount > 0) {
    score += b.liked_author * Math.min(authorLikeCount / 5, 1);
  }
  
  if (userSignals.likedCategories.includes(passage.category)) {
    score += b.liked_category;
  }
  
  if (userSignals.bookmarkedWorks.includes(passage.work_id)) {
    score += b.bookmarked_work;
  }
  
  if (userSignals.bookmarkedAuthors.includes(passage.author_id)) {
    score += b.bookmarked_author;
  }
  
  if (userSignals.preferredEras.includes(passage.era)) {
    score += b.era_match;
  }
  
  if (userSignals.tasteVector && passage.embedding) {
    const similarity = cosineSimilarity(userSignals.tasteVector, passage.embedding);
    score += similarity * b.embedding_similarity;
  }
  
  const popularityNorm = Math.min((passage.like_count || 0) / 100, 1);
  score += popularityNorm * b.popularity;
  
  score += Math.random() * b.exploration_random;
  
  return score;  // Range: 0-10
}
```

### Taste Vector Computation

```typescript
async function computeTasteVector(userId) {
  const likedPassages = await db.query(`
    SELECT c.embedding FROM likes l 
    JOIN chunks c ON l.chunk_id = c.id 
    WHERE l.user_id = $1 AND c.embedding IS NOT NULL
  `, [userId]);
  
  if (likedPassages.length === 0) return null;
  
  const dims = likedPassages[0].embedding.length;
  const tasteVector = new Array(dims).fill(0);
  
  for (const p of likedPassages) {
    for (let i = 0; i < dims; i++) {
      tasteVector[i] += p.embedding[i];
    }
  }
  for (let i = 0; i < dims; i++) {
    tasteVector[i] /= likedPassages.length;
  }
  
  return tasteVector;
}
```

---

## Personalization Score System

### Blend Weights by Signal Count

| Signal Count | Resonance Weight | Preference Weight | Rationale |
|--------------|------------------|-------------------|-----------|
| 0-2 | 90% | 10% | Cold start - trust quality floor |
| 3-5 | 70% | 30% | Starting to learn user |
| 6-10 | 50% | 50% | Balanced |
| 11-20 | 30% | 70% | Trust user signals |
| 20+ | 20% | 80% | Fully personalized |

### Computation

```typescript
function getBlendWeights(signalCount, config) {
  const sortedConfig = [...config].sort((a, b) => b.signal_threshold - a.signal_threshold);
  for (const row of sortedConfig) {
    if (signalCount >= row.signal_threshold) {
      return { resonance: row.resonance_weight, preference: row.preference_weight };
    }
  }
  return { resonance: config[0].resonance_weight, preference: config[0].preference_weight };
}

function computePersonalizationScore(passage, userSignals, preferenceConfig, blendConfig) {
  const resonance = passage.resonance_score;
  const preference = computePreferenceScore(passage, userSignals, preferenceConfig);
  const preferenceNormalized = (preference / 10) * 100;
  const weights = getBlendWeights(userSignals.signalCount, blendConfig);
  
  return (resonance * weights.resonance) + (preferenceNormalized * weights.preference);
}
```

---

## Gradual User State Transitions

### Corpus Blending (Curated vs Full)

| Signals | Curated Works | Full Corpus |
|---------|---------------|-------------|
| 0 | 100% | 0% |
| 1 | 80% | 20% |
| 2 | 60% | 40% |
| 3 | 40% | 60% |
| 5 | 20% | 80% |
| 10+ | 0% | 100% |

### Tier Sampling Weights

| Signals | S-Tier | A-Tier | B-Tier | C-Tier |
|---------|--------|--------|--------|--------|
| 0-2 | 50% | 35% | 12% | 3% |
| 3-5 | 40% | 35% | 20% | 5% |
| 6-10 | 30% | 30% | 30% | 10% |
| 11-20 | 20% | 25% | 35% | 20% |
| 20+ | 15% | 20% | 35% | 30% |

---

## Feed Algorithm Integration

### Complete Feed Flow

```
FEED REQUEST: GET /api/feed?limit=20

STEP 1: LOAD USER STATE
- Load user signals (likes, bookmarks, follows)
- Compute signalCount = likeCount + bookmarkCount
- Load or compute taste vector if user has likes

STEP 2: LOAD CONFIGURATION
- Load resonance_config, preference_config
- Load personalization_blend_config
- Load corpus_blend_config, tier_sampling_config
- Load exploit_explore_config

STEP 3: DETERMINE SAMPLING PARAMETERS
Based on signalCount, look up:
- corpusBlend: { curated: X, full: Y }
- tierWeights: { S: X, A: Y, B: Z, C: W }
- blendWeights: { resonance: X, preference: Y }

STEP 4: CANDIDATE SAMPLING (5x oversample)
targetCount = limit * 5 = 100 candidates
curatedCount = targetCount * corpusBlend.curated
fullCorpusCount = targetCount * corpusBlend.full

For CURATED portion:
  Sample from curated_works JOIN chunks
  Use tier weights for distribution
  Use sample_key for fast indexed sampling

For FULL CORPUS portion:
  Sample from chunks directly
  Use tier weights for distribution
  Use sample_key for fast indexed sampling

STEP 5: SCORE ALL CANDIDATES
For each candidate:
  resonance = candidate.resonance_score
  preference = computePreferenceScore(candidate, user)
  personalization = blend(resonance, preference, weights)

STEP 6: EXPLOIT/EXPLORE SELECTION (70/30 default)
Sort candidates by personalization_score (desc)
exploitCount = limit * 0.7 = 14
exploreCount = limit * 0.3 = 6
exploitPassages = top N by score
explorePassages = random N from remaining

STEP 7: DIVERSITY ENFORCEMENT
- Author diversity: max 1 passage per author per 20
- Work diversity: max 1 passage per work per 10
- Length diversity: 30% short, 40% medium, 30% long
- Type diversity: 45% quote, 30% poetry, 20% prose, 5% speech

STEP 8: RETURN 20 PASSAGES
```

### Fast Sampling with sample_key

**CRITICAL: Replace all ORDER BY RANDOM() with sample_key queries.**

```typescript
async function sampleFromTier(tier, limit, excludeIds = []) {
  const startKey = Math.random();
  const exclusionClause = excludeIds.length > 0 
    ? `AND id NOT IN (${excludeIds.join(',')})` 
    : '';
  
  let results = await db.query(`
    SELECT * FROM chunks
    WHERE quality_tier = $1 AND sample_key >= $2 ${exclusionClause}
    ORDER BY sample_key
    LIMIT $3
  `, [tier, startKey, limit]);
  
  // Wrap around if needed
  if (results.length < limit) {
    const remaining = limit - results.length;
    const existingIds = results.map(r => r.id);
    const allExcluded = [...excludeIds, ...existingIds];
    
    const wrapResults = await db.query(`
      SELECT * FROM chunks
      WHERE quality_tier = $1 AND sample_key < $2
        AND id NOT IN (${allExcluded.join(',')})
      ORDER BY sample_key
      LIMIT $3
    `, [tier, startKey, remaining]);
    
    results = [...results, ...wrapResults];
  }
  
  return results;
}
```

**Performance comparison:**

| Method | 10.3M rows | Uses Index? |
|--------|------------|-------------|
| ORDER BY RANDOM() LIMIT 20 | ~3-5 seconds | No |
| WHERE sample_key >= $x ORDER BY sample_key LIMIT 20 | ~5-20ms | Yes |

---

## Signal Collection & Matching

### Bartlett's Familiar Quotations

**Source:** Project Gutenberg ebook #27635 (public domain)
**URL:** https://www.gutenberg.org/ebooks/27635

```typescript
async function matchBartlettsToCorpus() {
  const bartlettsQuotes = await parseBartletts(); // Download and parse
  let matched = 0, total = 0;
  
  for (const { author, quote } of bartlettsQuotes) {
    total++;
    
    // Find matching author
    const authorMatch = await db.query(`
      SELECT id FROM authors 
      WHERE similarity(name, $1) > 0.5
      ORDER BY similarity(name, $1) DESC
      LIMIT 1
    `, [author]);
    
    if (!authorMatch.length) continue;
    
    // Find matching passage
    const passageMatch = await db.query(`
      SELECT id, similarity(text, $1) as sim
      FROM chunks
      WHERE author_id = $2 AND similarity(text, $1) > 0.5
      ORDER BY sim DESC
      LIMIT 1
    `, [quote, authorMatch[0].id]);
    
    if (passageMatch.length && passageMatch[0].sim > 0.6) {
      matched++;
      await db.query(`UPDATE chunks SET bartletts_match = TRUE WHERE id = $1`, [passageMatch[0].id]);
    }
  }
  
  console.log(`Matched ${matched}/${total} = ${(matched/total*100).toFixed(1)}%`);
}
```

**Success Metric:** >40% match rate

### Wikisource Featured Texts

**Source:** https://en.wikisource.org/wiki/Wikisource:Featured_texts (~200 works)

```typescript
async function matchWikisourceFeatured() {
  const featuredWorks = await fetchWikisourceFeatured(); // Scrape list
  let matched = 0;
  
  for (const { title } of featuredWorks) {
    const workMatch = await db.query(`
      SELECT id FROM works
      WHERE similarity(title, $1) > 0.6
      ORDER BY similarity(title, $1) DESC
      LIMIT 1
    `, [title]);
    
    if (workMatch.length) {
      matched++;
      await db.query(`UPDATE chunks SET wikisource_featured = TRUE WHERE work_id = $1`, [workMatch[0].id]);
    }
  }
  
  console.log(`Matched ${matched}/${featuredWorks.length} works`);
}
```

### Heuristic Score Computation

```typescript
function computeHeuristicScore(text) {
  let score = 0.5;
  const trimmed = text.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  const firstChar = trimmed[0];
  
  // RED FLAGS (decrease score)
  if (['And', 'But', 'Then', 'So', 'Or', 'Yet', 'For'].includes(firstWord)) score -= 0.15;
  if (['He', 'She', 'They', 'It', 'His', 'Her', 'Their'].includes(firstWord)) score -= 0.12;
  if (firstChar && firstChar === firstChar.toLowerCase() && /[a-z]/.test(firstChar)) score -= 0.1;
  if (/said|asked|replied|exclaimed|whispered/i.test(text)) score -= 0.08;
  if (/^(CHAPTER|PART|BOOK|SECTION)\s+[IVXLCDM\d]+/i.test(trimmed)) score -= 0.3;
  if (/\[\d+\]|\(\d+\)|^\d+\.?\s/.test(trimmed)) score -= 0.1;
  const lastChar = trimmed[trimmed.length - 1];
  if (!['.', '!', '?', '"', "'", ')'].includes(lastChar)) score -= 0.1;
  
  // GREEN FLAGS (increase score)
  if (firstChar && firstChar === firstChar.toUpperCase() && /[A-Z]/.test(firstChar)) score += 0.05;
  if (/\b(One|We|Man|Men|All|Every|None|No one)\b/.test(text)) score += 0.08;
  if (/^(Let|Do|Be|Consider|Remember|Never|Always|Know)\b/.test(trimmed)) score += 0.1;
  if (text.length < 200 && text.split(/\s+/).length < 40) score += 0.05;
  
  const abstractNouns = ['truth', 'beauty', 'wisdom', 'love', 'death', 'life', 'soul', 'virtue', 'nature', 'time'];
  const abstractCount = abstractNouns.filter(noun => new RegExp(`\\b${noun}\\b`, 'i').test(text)).length;
  score += Math.min(abstractCount * 0.03, 0.12);
  
  return Math.max(0, Math.min(1, score));
}
```

### PostgreSQL Trigram Setup

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_chunks_text_trgm ON chunks USING GIN (text gin_trgm_ops);
```

---

## Admin Dashboard Requirements

### Resonance Score Configuration Panel

- Sliders for each signal weight (sum should ~100)
- Sliders for tier cutoffs (S>=80, A>=60, B>=40)
- "Save Config" button
- "Recompute Scores" button (triggers batch job, ~15 min for 10.3M)

### Tier Statistics Dashboard

Display for each tier (from sample):
- Count and % of total
- Average score
- Average signal count
- % with each signal type (Wikiquote, Bartlett's, etc.)
- Score distribution histogram with cutoff lines

### Preference Score Configuration Panel

- Sliders for each boost value

### Personalization Blend Configuration

- Table showing signal thresholds and resonance/preference weights
- Exploit/explore ratio slider

### Corpus & Tier Sampling Configuration

- Table showing curated/full ratio by signal count
- Table showing S/A/B/C ratio by signal count

---

## Implementation Phases

### Phase 0: Validation (Week 1)

1. Download Bartlett's from Gutenberg, parse into quotes
2. Run matching against corpus with trigram similarity
3. Measure match rate (target: >40%)
4. Manual review of 20 matched passages

### Phase 1: Database Foundation (Week 1-2)

1. Add sample_key column + indexes
2. Backfill sample_key with random values
3. Add all resonance infrastructure columns
4. Create configuration tables with defaults
5. Enable pg_trgm extension
6. Update feed queries to use sample_key

### Phase 2: Signal Collection (Week 2-3)

1. Bartlett's matching batch job
2. Wikisource featured matching batch job
3. Heuristic score computation batch job
4. Backfill wikiquote_match from source column

### Phase 3: Resonance Score Computation (Week 3-4)

1. Implement computeResonanceScore function
2. Run batch job for all chunks
3. Verify tier distribution
4. Adjust weights/cutoffs if needed

### Phase 4: Feed Algorithm Integration (Week 4-5)

1. Implement user signals loading
2. Implement preference score computation
3. Implement personalization score blending
4. Implement tier-based sampling with weights
5. Implement corpus blending
6. Integrate with existing diversity enforcement

### Phase 5: Admin Dashboard (Week 5-6)

1. All configuration panels
2. Tier statistics dashboard
3. Batch job triggering

---

## Testing & Validation

### Manual Validation Queries

```sql
-- Tier distribution
SELECT quality_tier, COUNT(*), ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct,
       ROUND(AVG(resonance_score), 2) as avg_score, ROUND(AVG(signal_count), 2) as avg_signals
FROM chunks WHERE resonance_score IS NOT NULL
GROUP BY quality_tier ORDER BY quality_tier;

-- S-tier sample for review
SELECT id, text, resonance_score, signal_count, bartletts_match, wikisource_featured, heuristic_score
FROM chunks WHERE quality_tier = 'S' ORDER BY random() LIMIT 20;

-- C-tier sample for review
SELECT id, text, resonance_score, signal_count
FROM chunks WHERE quality_tier = 'C' ORDER BY random() LIMIT 20;
```

### Success Criteria

- Feed response time <200ms
- S-tier passages feel quotable on manual review
- C-tier passages feel like "connective tissue"
- Tier distribution matches targets

---

## Questions for Claude Code to Resolve

1. Where is the current feed endpoint? What's the existing sampling/ranking logic?
2. Is pg_trgm extension enabled?
3. What's the batch job infrastructure? (Scripts? Job queue? Cron?)
4. How is configuration managed? (Env vars? DB? Config files?)
5. Does curated_works table exist? How is it populated?
6. What's the current diversity enforcement logic?
7. Are there existing feed tests?
8. What's the deployment process for schema migrations?
9. What ORM/query builder is used?
10. Where are embeddings stored? Column type? Dimensions?

---

## Summary Checklist

### Database Changes
- [ ] Add sample_key column + indexes
- [ ] Add resonance_score column
- [ ] Add quality_tier computed column
- [ ] Add signal_count column
- [ ] Add bartletts_match, wikisource_featured, heuristic_score columns
- [ ] Create all config tables
- [ ] Enable pg_trgm extension
- [ ] Create trigram index on chunk text

### Batch Jobs
- [ ] Bartlett's matching job
- [ ] Wikisource featured matching job
- [ ] Heuristic score computation job
- [ ] Resonance score computation job
- [ ] sample_key backfill job

### Feed Algorithm
- [ ] Replace ORDER BY RANDOM with sample_key
- [ ] Implement tier-based sampling
- [ ] Implement corpus blending
- [ ] Implement user signals loading
- [ ] Implement preference score computation
- [ ] Implement personalization score blending
- [ ] Implement exploit/explore split
- [ ] Preserve existing diversity enforcement

### Admin Dashboard
- [ ] Resonance score configuration panel
- [ ] Tier statistics dashboard
- [ ] Preference score configuration panel
- [ ] Personalization blend configuration panel
- [ ] Corpus & tier sampling configuration panel

---

## CRITICAL: Current System vs New System

### What This Replaces

Claude Code MUST understand: this is a **fundamental rearchitecture** of the feed algorithm, not incremental changes.

**CURRENT SYSTEM (to be replaced):**
```
Feed Request
    |
    v
Random sampling from chunks table (ORDER BY RANDOM())
    |
    v
Some diversity filtering
    |
    v
Return passages
```

Problems with current system:
- ORDER BY RANDOM() is O(n) - scans entire 10.3M row table
- No quality filtering - "He walked down the hall" is equally likely as profound insights
- No user personalization beyond basic filters
- Response time: 3-5 seconds

**NEW SYSTEM (to implement):**
```
Feed Request
    |
    v
Load user signals + compute signal count
    |
    v
Look up blend weights based on signal count (config tables)
    |
    v
Tier-weighted sampling using sample_key index (O(log n))
    |
    v
Score candidates: resonance (stored) + preference (computed)
    |
    v
Exploit/explore selection
    |
    v
Diversity enforcement (PRESERVE existing logic)
    |
    v
Return passages
```

### What to REPLACE

| Component | Current | New |
|-----------|---------|-----|
| **Sampling method** | ORDER BY RANDOM() | sample_key range query |
| **Quality filtering** | None or basic | Tier-based (S/A/B/C) with configurable weights |
| **Candidate selection** | Random | Weighted by resonance_score + preference_score |
| **User state** | Binary (new/returning) or none | Continuous signal count with gradual transitions |
| **Configuration** | Hardcoded | Database tables with admin UI |

### What to PRESERVE

| Component | Notes |
|-----------|-------|
| **Diversity enforcement** | Keep existing author/work/length/type diversity rules |
| **Feed API contract** | Same endpoint, same response format |
| **Existing tables** | chunks, works, authors, likes, bookmarks - add columns, don't restructure |
| **Cursor/pagination** | Keep existing pagination mechanism |

### Key Integration Points

Claude Code should find and modify these areas:

1. **Feed endpoint** (likely `/api/feed` or similar)
   - This is where sampling happens
   - Replace the sampling query
   - Add user signal loading
   - Add scoring logic

2. **Database queries**
   - Find all `ORDER BY RANDOM()` usage
   - Replace with sample_key queries

3. **User session/state**
   - Find where user data is loaded
   - Add signal count computation
   - Add taste vector computation (if embeddings available)

4. **Configuration**
   - Find where config is currently managed
   - Add new config tables or integrate with existing pattern

---

## PRIORITY: Goodreads Signal Collection

Goodreads is the **most valuable external signal** - it represents real-world crowdsourced quality judgments from millions of readers. This is higher priority than Bartlett's (which is historical/static).

### Why Goodreads Matters

- **Recency**: Actively updated, reflects current reader interest
- **Scale**: Millions of quotes with like counts
- **Crowdsourced**: Not editorial judgment, but aggregate user preference
- **Coverage**: Spans all eras and genres

### Goodreads Scraping Strategy

**Phase 1: Validation (Do First)**

```typescript
// Test with top 10 authors to validate match rate
const testAuthors = [
  'Marcus Aurelius', 'William Shakespeare', 'Jane Austen',
  'Charles Dickens', 'Oscar Wilde', 'Mark Twain',
  'Friedrich Nietzsche', 'Leo Tolstoy', 'Virginia Woolf', 'Plato'
];

async function validateGoodreadsSignal() {
  const results = { totalQuotes: 0, matchedQuotes: 0, sampleMatches: [] };
  
  for (const author of testAuthors) {
    const quotes = await scrapeGoodreadsQuotes(author, { limit: 100 });
    results.totalQuotes += quotes.length;
    
    for (const quote of quotes) {
      const match = await fuzzyMatchCorpus(quote.text, quote.author);
      if (match && match.similarity > 0.6) {
        results.matchedQuotes++;
        // Store the like count from Goodreads
        await db.query(`UPDATE chunks SET goodreads_count = $1 WHERE id = $2`, 
          [quote.likes, match.id]);
      }
    }
  }
  
  console.log(`Match rate: ${(results.matchedQuotes/results.totalQuotes*100).toFixed(1)}%`);
  return results;
}
```

**Phase 2: Full Scrape (After Validation)**

If validation shows >30% match rate, proceed with full scrape:

1. Get list of all authors in your corpus (~2,500 unique authors)
2. For each author, scrape their Goodreads quotes page
3. Store: quote text, like count, author attribution
4. Match against corpus using trigram similarity
5. Update `goodreads_count` column with like counts

**Scraping Considerations:**

- Goodreads rate limits: Be respectful, add delays
- Quote pages: `https://www.goodreads.com/author/quotes/{author_id}`
- Like counts are the key signal (not just presence)
- Some quotes may be misattributed - filter by author match

**Data to Extract:**

```typescript
interface GoodreadsQuote {
  text: string;
  author: string;
  likes: number;  // This is the valuable signal
  tags: string[]; // Optional: could inform categories
}
```

### Goodreads Weight Justification

Default weight: **15** (same as Bartlett's + Wikisource combined)

Rationale:
- More current than Bartlett's (which is pre-1920)
- Larger scale than Wikisource featured (~200 works)
- Represents real user engagement, not editorial judgment
- Like counts provide gradation (not just binary match)

### Implementation Order Update

**Week 1: Validation**
1. sample_key column (performance foundation)
2. Goodreads validation scrape (10 authors, ~1000 quotes)
3. Measure match rate

**Week 2: Signal Collection** (based on validation results)
- If Goodreads match rate >30%: Full Goodreads scrape (priority)
- Bartlett's matching
- Wikisource matching
- Heuristic score computation

**Week 3-4: Scoring & Integration**
- Resonance score computation
- Feed algorithm changes
- Testing

---

## Revised Implementation Phases

### Phase 0: Foundation & Validation (Week 1)

**Day 1-2: Performance Foundation**
- Add sample_key column to chunks
- Create index on sample_key
- Backfill with random values
- Test: sampling query returns in <50ms

**Day 3-4: Goodreads Validation**
- Scrape quotes for top 10 authors (~1000 quotes)
- Run matching against corpus
- Measure match rate
- Decision point: If >30%, proceed with full scrape

**Day 5: Schema Setup**
- Add all signal columns to chunks
- Create all config tables with defaults
- Enable pg_trgm if not already enabled

### Phase 1: Signal Collection (Week 2)

**Priority order:**
1. **Goodreads full scrape** (if validation passed) - 2-3 days
   - Scrape all authors in corpus
   - Match and store like counts
   
2. **Wikiquote backfill** - 0.5 day
   - UPDATE chunks SET wikiquote_match = TRUE WHERE source = 'wikiquote'
   
3. **Heuristic score computation** - 1 day
   - Batch job across all chunks
   
4. **Bartlett's matching** - 1 day
   - Download, parse, match
   
5. **Wikisource featured** - 0.5 day
   - Scrape list, match works

### Phase 2: Resonance Score Computation (Week 3)

- Implement scoring function with all signals
- Run batch job (estimate: 15-30 min for 10.3M rows)
- Validate tier distribution
- Adjust weights if needed
- Manual review of S-tier and C-tier samples

### Phase 3: Feed Algorithm Rearchitecture (Week 3-4)

**This is the critical integration phase.**

1. **Find existing feed endpoint** - understand current flow
2. **Add user signal loading** - likes, bookmarks, follows
3. **Replace sampling** - ORDER BY RANDOM → sample_key + tier weights
4. **Add scoring** - preference_score computation
5. **Add blending** - personalization_score = blend(resonance, preference)
6. **Add exploit/explore** - 70/30 split
7. **Preserve diversity** - keep existing rules
8. **Test thoroughly** - response time, quality, edge cases

### Phase 4: Admin Dashboard (Week 5)

- Config panels for all tables
- Tier statistics dashboard
- Batch job triggers

---

## Feed Algorithm: Detailed Replacement Guide

### Current Code Pattern (to find and replace)

Look for patterns like:

```sql
-- FIND THIS PATTERN
SELECT * FROM chunks
WHERE [some filters]
ORDER BY RANDOM()
LIMIT 20;
```

```typescript
// OR THIS PATTERN
const passages = await db.query(`
  SELECT * FROM chunks
  ORDER BY RANDOM()
  LIMIT $1
`, [limit]);
```

### Replace With

```typescript
async function getFeed(userId: number, limit: number = 20) {
  // 1. Load user signals
  const userSignals = await loadUserSignals(userId);
  
  // 2. Load config (cache this)
  const config = await loadAllConfig();
  
  // 3. Determine sampling parameters based on signal count
  const corpusBlend = getCorpusBlend(userSignals.signalCount, config.corpusBlend);
  const tierWeights = getTierWeights(userSignals.signalCount, config.tierSampling);
  const blendWeights = getBlendWeights(userSignals.signalCount, config.personalizationBlend);
  
  // 4. Sample candidates (5x oversample for diversity filtering)
  const targetCount = limit * 5;
  const candidates = await sampleCandidates(
    targetCount, 
    corpusBlend, 
    tierWeights,
    config.curatedWorkIds  // if using curated works
  );
  
  // 5. Score all candidates
  const scored = candidates.map(passage => ({
    ...passage,
    preferenceScore: computePreferenceScore(passage, userSignals, config.preference),
    personalizationScore: computePersonalizationScore(
      passage.resonance_score,
      computePreferenceScore(passage, userSignals, config.preference),
      blendWeights
    )
  }));
  
  // 6. Exploit/explore selection
  scored.sort((a, b) => b.personalizationScore - a.personalizationScore);
  const exploitCount = Math.floor(limit * config.exploitExplore.exploit_ratio);
  const exploreCount = limit - exploitCount;
  
  const exploit = scored.slice(0, exploitCount);
  const explorePool = scored.slice(exploitCount);
  const explore = shuffleArray(explorePool).slice(0, exploreCount);
  
  let selected = [...exploit, ...explore];
  
  // 7. Apply diversity enforcement (KEEP EXISTING LOGIC)
  selected = applyDiversityRules(selected, limit);
  
  // 8. Final shuffle and return
  return shuffleArray(selected);
}
```

### Helper Functions Needed

```typescript
async function loadUserSignals(userId: number): Promise<UserSignals> {
  // Load from likes, bookmarks, follows tables
  // Compute signal count
  // Optionally compute taste vector
}

async function sampleCandidates(
  count: number,
  corpusBlend: { curated: number, full: number },
  tierWeights: { S: number, A: number, B: number, C: number },
  curatedWorkIds?: number[]
): Promise<Passage[]> {
  // Sample from each tier using sample_key
  // Blend curated and full corpus based on ratios
}

function computePersonalizationScore(
  resonance: number,
  preference: number,
  weights: { resonance: number, preference: number }
): number {
  const prefNormalized = (preference / 10) * 100;
  return (resonance * weights.resonance) + (prefNormalized * weights.preference);
}
```

---

## Summary: What Claude Code Must Do

### MUST Replace
1. All `ORDER BY RANDOM()` queries → sample_key queries
2. Random/basic sampling → tier-weighted sampling
3. No scoring → resonance + preference + personalization scoring
4. Binary user states → continuous signal-based transitions

### MUST Add
1. sample_key column and indexes
2. All signal columns (resonance_score, quality_tier, goodreads_count, etc.)
3. All config tables
4. User signal loading
5. Preference score computation
6. Personalization score blending
7. Exploit/explore selection

### MUST Preserve
1. Existing diversity enforcement rules
2. Feed API contract (endpoint, response format)
3. Existing table structures (add columns, don't restructure)
4. Pagination/cursor mechanism

### Batch Jobs to Create
1. Goodreads scraping + matching
2. Bartlett's matching
3. Wikisource matching
4. Heuristic score computation
5. Resonance score computation
6. sample_key backfill

### Admin UI to Create
1. Resonance config panel (weights, cutoffs)
2. Preference config panel (boosts)
3. Blend config panel (by signal count)
4. Tier sampling config panel
5. Tier statistics dashboard
