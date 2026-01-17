# Doomscrolls:Literature - Bootstrap Algorithm Strategy (v6)

**Version:** 6.0
**Last Updated:** January 17, 2026

**Changes from v3:** 
- Introduced three-score hierarchy: `resonance_score` -> `preference_score` -> `personalization_score`
- Replaced discrete user states with gradual transitions (blended corpus + shifting weights)
- Made tier cutoffs derived from continuous `resonance_score` (not hardcoded)
- Added admin-configurable weights for all scoring dimensions
- Added Tier Statistics Dashboard with live preview
- Reorganized schematics to reflect new architecture

**Changes in v4:**
- Added detailed clarification of how `preference_score` works (discrete signals vs. embeddings)
- Added `userSignals` data structure documentation
- Added `tasteVector` computation explanation
- Reordered implementation to **validation-first approach** (Phase 0: validate external signals before building full pipeline)
- Added validation script and decision framework for Goodreads/Kindle signal viability

**Changes in v5:**
- Added comprehensive **Passage Matching Techniques** section explaining how to match Goodreads quotes to corpus
- Four approaches documented: Fuzzy String Matching, PostgreSQL Trigram, Embedding Similarity, Hybrid
- Added recommended hybrid matching algorithm with code
- Added PostgreSQL `pg_trgm` setup instructions

**Changes in v6:**
- Added **MVP Priority Improvements** section with 5 "Do Now" items:
  1. Persistent `sample_key` column for fast indexed sampling (replaces `ORDER BY RANDOM()`)
  2. Missing-value handling with weight renormalization and confidence penalty
  3. Bartlett's Quotations matching for pipeline validation
  4. Wikisource Featured Texts as high-precision quality signal
  5. Dynamic cutoffs architecture (config-driven + computed column cache)
- Added **Future Possibilities** section with deferred improvements
- Updated resonance score formula with proper missing-value handling
- Added schema changes for `sample_key` and `bartletts_match`

---

## The Core Problem

You have 10.3 million passages, but "random great author" often means narrative connective tissue--"He walked down the hall and opened the door"--not insight. The goal: surface the *gems* before personalization kicks in, making first impressions consistently strong so new users stick around long enough to generate signals.

---

## The Three-Score Hierarchy

This is the conceptual foundation of v4. Three distinct scores work together:

```
+-----------------------------------------------------------------------------+
|                           THREE-SCORE HIERARCHY                              |
+-----------------------------------------------------------------------------+

+-----------------------------------------------------------------------------+
|                                                                              |
|   +-------------------------+         +-------------------------+            |
|   |     resonance_score     |         |    preference_score     |            |
|   |    (intrinsic quality)  |         |   (user-specific fit)   |            |
|   |                         |         |                         |            |
|   |  "How inherently        |         |  "How well does this    |            |
|   |   quotable/interesting  |         |   match THIS user's     |            |
|   |   is this passage?"     |         |   demonstrated taste?"  |            |
|   |                         |         |                         |            |
|   |  Computed: Batch        |         |  Computed: Real-time    |            |
|   |  Stored: Yes (chunks)   |         |  Stored: No (ephemeral) |            |
|   |  Range: 0-100           |         |  Range: 0-10            |            |
|   +-----------+-------------+         +-----------+-------------+            |
|               |                                   |                          |
|               |         +-----------------+       |                          |
|               +-------->|  WEIGHTED BLEND |<------+                          |
|                         |                 |                                  |
|                         |  Weights shift  |                                  |
|                         |  based on user  |                                  |
|                         |  signal count   |                                  |
|                         +--------+--------+                                  |
|                                  |                                           |
|                                  v                                           |
|                    +-------------------------+                               |
|                    |  personalization_score  |                               |
|                    |     (final ranking)     |                               |
|                    |                         |                               |
|                    |  "What should we show   |                               |
|                    |   THIS user RIGHT NOW?" |                               |
|                    |                         |                               |
|                    |  Computed: Real-time    |                               |
|                    |  Used for: Feed ranking |                               |
|                    +-------------------------+                               |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Score Definitions

| Score | Scope | Stored? | When Computed | Range |
|-------|-------|---------|---------------|-------|
| **`resonance_score`** | Per passage (intrinsic) | Yes, in `chunks` | Batch job when weights change | 0-100 |
| **`preference_score`** | Per passage x per user | No, ephemeral | Real-time during feed request | 0-10 |
| **`personalization_score`** | Per passage x per user | No, ephemeral | Real-time, weighted blend | 0-100 |
| **`quality_tier`** | Per passage (derived) | Yes, computed column | Auto-derived from resonance_score | S/A/B/C |

### The Formula

```typescript
// Final score is a weighted average of resonance and preference
personalization_score = (
  (resonance_score * resonance_weight) + 
  (preference_score_normalized * preference_weight)
) / (resonance_weight + preference_weight)

// Where preference_score is normalized to 0-100 scale
preference_score_normalized = (preference_score / 10) * 100
```

---

## Resonance Score (Intrinsic Quality)

### What It Measures

The `resonance_score` answers: **"Is this passage inherently interesting, quotable, and standalone--regardless of who's reading it?"**

This is computed once per passage (in batch) and stored. It doesn't depend on any user.

### Input Dimensions

```
+-----------------------------------------------------------------------------+
|                      RESONANCE SCORE DIMENSIONS                              |
+-----------------------------------------------------------------------------+
|                                                                              |
|  DIMENSION                    |  WHAT IT CAPTURES                | DEFAULT  |
|  -----------------------------|----------------------------------|----------|
|  wikiquote_match              |  Already curated as notable      |    25    |
|  goodreads_count              |  Reader favorites                |    15    |
|  kindle_highlights            |  Real-world resonance            |    15    |
|  llm_score                    |  AI-judged quality (0-10)        |    20    |
|  manual_curation              |  Human expert selection          |    10    |
|  embedding_cluster_quality    |  "Lives near wisdom"             |    10    |
|  heuristic_score              |  Self-containedness signals      |     5    |
|  -----------------------------|----------------------------------|----------|
|                               |                          TOTAL:  |   100    |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Computation Formula

```typescript
interface ResonanceConfig {
  weights: {
    wikiquote_match: number;           // Default: 25
    goodreads_count: number;           // Default: 15
    kindle_highlights: number;         // Default: 15
    llm_score: number;                 // Default: 20
    manual_curation: number;           // Default: 10
    embedding_cluster_quality: number; // Default: 10
    heuristic_score: number;           // Default: 5
    bartletts_match: number;           // Default: 15 (NEW)
    wikisource_featured: number;       // Default: 10 (NEW)
  };
  cutoffs: {
    s_tier: number;  // Default: 80
    a_tier: number;  // Default: 60
    b_tier: number;  // Default: 40
  };
}

function computeResonanceScore(passage: Passage, config: ResonanceConfig): number {
  const w = config.weights;
  
  // Define normalization for each signal
  const signalDefinitions = {
    wikiquote_match: { 
      value: passage.wikiquote_match ? 1 : 0, 
      present: passage.wikiquote_match !== null 
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
    bartletts_match: { 
      value: passage.bartletts_match ? 1 : 0, 
      present: passage.bartletts_match !== null 
    },
    wikisource_featured: { 
      value: passage.wikisource_featured ? 1 : 0, 
      present: passage.wikisource_featured !== null 
    },
  };
  
  // === MISSING-VALUE HANDLING ===
  // Only sum over signals that are PRESENT, then renormalize
  let weightedSum = 0;
  let presentWeightSum = 0;
  let signalCount = 0;
  
  for (const [signal, weight] of Object.entries(w)) {
    const def = signalDefinitions[signal];
    if (def && def.present) {
      weightedSum += def.value * weight;
      presentWeightSum += weight;
      signalCount++;
    }
  }
  
  // Renormalize over present signals only
  const rawScore = presentWeightSum > 0 
    ? (weightedSum / presentWeightSum) * 100 
    : 50;  // Default to midpoint if no signals
  
  // === CONFIDENCE PENALTY ===
  // Passages with fewer signals regress toward the mean
  // Full confidence at 4+ signals, partial confidence below
  const minSignalsForFullConfidence = 4;
  const confidenceFactor = Math.min(signalCount / minSignalsForFullConfidence, 1);
  
  // Blend raw score with mean (50) based on confidence
  const finalScore = (rawScore * confidenceFactor) + (50 * (1 - confidenceFactor));
  
  return finalScore;
}
```

**Why this matters:**
- Old approach: Missing values defaulted to 0.5, inflating scores for sparse passages
- New approach: Only count signals that exist, then apply confidence penalty
- Result: S-tier passages have both high scores AND multiple corroborating signals

### Tier Derivation

Tiers are **derived from** `resonance_score`, not assigned separately:

```sql
-- Computed column approach (PostgreSQL)
ALTER TABLE chunks ADD COLUMN resonance_score FLOAT;
ALTER TABLE chunks ADD COLUMN quality_tier VARCHAR(1) GENERATED ALWAYS AS (
  CASE 
    WHEN resonance_score >= 80 THEN 'S'
    WHEN resonance_score >= 60 THEN 'A'
    WHEN resonance_score >= 40 THEN 'B'
    ELSE 'C'
  END
) STORED;

CREATE INDEX idx_chunks_quality_tier ON chunks(quality_tier);
CREATE INDEX idx_chunks_resonance_score ON chunks(resonance_score);
```

**Benefits of this approach:**
- Tiers always stay in sync with scores
- Changing cutoffs (80->75) doesn't require recomputing scores
- Can query by tier (fast) or by score range (flexible)
- No "cliff" at tier boundaries for sampling

---

## Preference Score (User-Specific Fit)

### What It Measures

The `preference_score` answers: **"How well does this passage match what this specific user has shown they like?"**

This is computed real-time for each candidate passage during feed generation.

### Important Clarification: Discrete Signals vs. Embeddings

The `preference_score` is **primarily based on discrete signal lookups**, not embedding similarity. Most of the score comes from checking if the user has interacted with this author, category, work, or era before. Embedding similarity is only a small component (0.5 max out of ~10 total).

**Why this matters:** The preference_score is fast to compute because it's mostly lookups against pre-aggregated user data, not vector math on every candidate.

### The userSignals Data Structure

Before computing preference scores, we load the user's interaction history into a `userSignals` object:

```typescript
interface UserSignals {
  // === EXPLICIT ACTIONS ===
  followedAuthors: number[];      // [author_id, author_id, ...]
  
  // === AGGREGATED FROM LIKES TABLE ===
  likedAuthors: { [author_id: number]: number };  // { 42: 5, 17: 3 } = liked 5 passages by author 42
  likedCategories: string[];      // ['Philosophy', 'Poetry'] - categories they've liked from
  
  // === AGGREGATED FROM BOOKMARKS TABLE ===
  bookmarkedWorks: number[];      // [work_id, work_id, ...]
  bookmarkedAuthors: number[];    // [author_id, ...]
  
  // === INFERRED FROM HISTORY ===
  preferredEras: string[];        // ['Victorian', 'Ancient'] - derived from liked passages
  
  // === EMBEDDING-BASED (computed separately, updated on like/bookmark) ===
  tasteVector: number[] | null;   // Average embedding of their liked passages (1536 dims)
  
  // === COUNTS FOR BLEND WEIGHT CALCULATION ===
  likeCount: number;
  bookmarkCount: number;
}
```

This object is loaded once per feed request and reused for scoring all candidate passages.

### How tasteVector Works

The `tasteVector` is the **average embedding of all passages the user has liked**. It represents their "semantic center of gravity" in the embedding space.

```typescript
async function computeTasteVector(userId: number): Promise<number[] | null> {
  const likedPassages = await db.query(`
    SELECT c.embedding 
    FROM likes l 
    JOIN chunks c ON l.chunk_id = c.id 
    WHERE l.user_id = $1 AND c.embedding IS NOT NULL
  `, [userId]);
  
  if (likedPassages.length === 0) return null;
  
  // Average all embeddings (1536 dimensions)
  const tasteVector = new Array(1536).fill(0);
  for (const p of likedPassages) {
    for (let i = 0; i < 1536; i++) {
      tasteVector[i] += p.embedding[i];
    }
  }
  for (let i = 0; i < 1536; i++) {
    tasteVector[i] /= likedPassages.length;
  }
  
  return tasteVector;
}
```

During preference scoring, we compute cosine similarity between the user's taste vector and each candidate passage's embedding. But note: this only contributes **0-0.5 points** out of a ~10 point max score. The discrete signals (followed author +3.0, liked author +1.5, etc.) dominate.

### Input Dimensions

```
+-----------------------------------------------------------------------------+
|                      PREFERENCE SCORE DIMENSIONS                             |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SIGNAL                       |  WHAT IT CAPTURES                | DEFAULT  |
|  -----------------------------|----------------------------------|----------|
|  followed_author              |  Explicit interest declaration   |   +3.0   |
|  liked_author_history         |  Implicit author preference      |   +1.5   |
|  liked_category               |  Topic/genre preference          |   +1.3   |
|  bookmarked_work              |  Deep engagement with work       |   +1.2   |
|  bookmarked_author            |  Author-level bookmark signal    |   +1.15  |
|  era_match                    |  Prefers certain time periods    |   +1.1   |
|  embedding_similarity         |  Semantic match to taste vector  |   +0-0.5 |
|  popularity_normalized        |  Social proof (like count)       |   +0-0.3 |
|  exploration_random           |  Serendipity factor              |   +0-0.3 |
|  -----------------------------|----------------------------------|----------|
|                               |                       MAX TOTAL: |    ~10   |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Computation Formula

```typescript
interface PreferenceConfig {
  boosts: {
    followed_author: number;       // Default: 3.0
    liked_author: number;          // Default: 1.5
    liked_category: number;        // Default: 1.3
    bookmarked_work: number;       // Default: 1.2
    bookmarked_author: number;     // Default: 1.15
    era_match: number;             // Default: 1.1
    embedding_similarity: number;  // Default: 0.5
    popularity: number;            // Default: 0.3
    exploration_random: number;    // Default: 0.3
  };
}

function computePreferenceScore(
  passage: Passage, 
  userSignals: UserSignals,
  config: PreferenceConfig
): number {
  let score = 0;
  const b = config.boosts;
  
  // Explicit follows
  if (userSignals.followedAuthors.includes(passage.author_id)) {
    score += b.followed_author;
  }
  
  // Liked author history
  const authorLikeCount = userSignals.likedAuthors[passage.author_id] || 0;
  if (authorLikeCount > 0) {
    score += b.liked_author * Math.min(authorLikeCount / 5, 1);
  }
  
  // Category preference
  if (userSignals.likedCategories.includes(passage.category)) {
    score += b.liked_category;
  }
  
  // Bookmark signals
  if (userSignals.bookmarkedWorks.includes(passage.work_id)) {
    score += b.bookmarked_work;
  }
  if (userSignals.bookmarkedAuthors.includes(passage.author_id)) {
    score += b.bookmarked_author;
  }
  
  // Era match
  if (userSignals.preferredEras.includes(passage.era)) {
    score += b.era_match;
  }
  
  // Embedding similarity to taste vector
  if (userSignals.tasteVector && passage.embedding) {
    const similarity = cosineSimilarity(userSignals.tasteVector, passage.embedding);
    score += similarity * b.embedding_similarity;
  }
  
  // Popularity (normalized)
  const popularityNorm = Math.min(passage.like_count / 100, 1);
  score += popularityNorm * b.popularity;
  
  // Exploration randomness
  score += Math.random() * b.exploration_random;
  
  return score;
}
```

---

## Personalization Score (Final Ranking)

### What It Measures

The `personalization_score` is the **final combined score** used to rank passages for a specific user. It blends intrinsic quality (resonance) with user fit (preference).

### The Key Insight: Weights Shift Based on User Maturity

```
+-----------------------------------------------------------------------------+
|                    PERSONALIZATION BLEND WEIGHTS                             |
|                    (Shift based on signal count)                             |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SIGNAL COUNT    |  RESONANCE WT  |  PREFERENCE WT  |  RATIONALE            |
|  ----------------|----------------|-----------------|------------------------|
|  0-2 (bootstrap) |      90%       |       10%       |  We don't know user   |
|  3-5             |      70%       |       30%       |  Starting to learn    |
|  6-10            |      50%       |       50%       |  Balanced             |
|  11-20           |      30%       |       70%       |  Trust user signals   |
|  20+             |      20%       |       80%       |  Fully personalized   |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Computation Formula

```typescript
interface PersonalizationConfig {
  blendBySignalCount: {
    [threshold: number]: { resonance: number; preference: number };
  };
}

function getBlendWeights(
  signalCount: number, 
  config: PersonalizationConfig
): { resonance: number; preference: number } {
  const thresholds = Object.keys(config.blendBySignalCount)
    .map(Number)
    .sort((a, b) => b - a);
  
  for (const threshold of thresholds) {
    if (signalCount >= threshold) {
      return config.blendBySignalCount[threshold];
    }
  }
  return config.blendBySignalCount[0];
}

function computePersonalizationScore(
  passage: Passage,
  userSignals: UserSignals,
  resonanceConfig: ResonanceConfig,
  preferenceConfig: PreferenceConfig,
  personalizationConfig: PersonalizationConfig
): number {
  // Get the stored resonance score (0-100)
  const resonance = passage.resonance_score;
  
  // Compute preference score (0-10), then normalize to 0-100
  const preference = computePreferenceScore(passage, userSignals, preferenceConfig);
  const preferenceNormalized = (preference / 10) * 100;
  
  // Get blend weights based on user's signal count
  const signalCount = userSignals.likeCount + userSignals.bookmarkCount;
  const weights = getBlendWeights(signalCount, personalizationConfig);
  
  // Weighted average
  const personalizationScore = (
    (resonance * weights.resonance) + 
    (preferenceNormalized * weights.preference)
  );
  
  return personalizationScore;
}
```

---

## Gradual User State Transitions

### The Problem with Discrete States (v3)

In v3, users jumped between discrete states:
- Anonymous -> Bootstrap -> Personalized

This could feel **jarring** -- a user goes from seeing only curated works to suddenly getting the full 10.3M corpus.

### The v4 Solution: Gradual Blending

Instead of hard cutoffs, we use **two gradual mechanisms**:

#### Mechanism A: Corpus Blending

The ratio of curated works vs. full corpus shifts gradually:

```
+-----------------------------------------------------------------------------+
|                        CORPUS BLEND (by signal count)                        |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SIGNALS   |  CURATED WORKS  |  FULL CORPUS  |  VISUAL                      |
|  ----------|-----------------|---------------|------------------------------|
|  0         |     100%        |      0%       |  ####################        |
|  1         |      80%        |     20%       |  ################----        |
|  2         |      60%        |     40%       |  ############--------        |
|  3         |      40%        |     60%       |  ########------------        |
|  5         |      20%        |     80%       |  ####----------------        |
|  10+       |       0%        |    100%       |  --------------------        |
|                                                                              |
+-----------------------------------------------------------------------------+
```

#### Mechanism B: Tier Weight Shifting

Even within each corpus, the tier sampling weights shift:

```
+-----------------------------------------------------------------------------+
|                     TIER SAMPLING WEIGHTS (by signal count)                  |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SIGNALS   |  S-TIER  |  A-TIER  |  B-TIER  |  C-TIER  |  RATIONALE         |
|  ----------|----------|----------|----------|----------|---------------------|
|  0-2       |   50%    |   35%    |   12%    |    3%    |  Very conservative  |
|  3-5       |   40%    |   35%    |   20%    |    5%    |  Opening up slightly|
|  6-10      |   30%    |   30%    |   30%    |   10%    |  Trust personalizatn|
|  11-20     |   20%    |   25%    |   35%    |   20%    |  User knows what    |
|  20+       |   15%    |   20%    |   35%    |   30%    |  they want          |
|                                                                              |
+-----------------------------------------------------------------------------+
```

**Key insight:** As users engage more, we trust personalization to surface gems from lower tiers that match their specific taste--rather than relying on the universal quality floor.

### Combined Visual: The User Journey

```
+-----------------------------------------------------------------------------+
|                    USER JOURNEY: GRADUAL PERSONALIZATION                     |
+-----------------------------------------------------------------------------+

 FIRST VISIT              BUILDING SIGNALS           FULLY PERSONALIZED
 (0 signals)              (3-10 signals)             (20+ signals)
      |                        |                           |
      v                        v                           v
+-------------+          +-------------+          +-------------+
| RESONANCE   |          | RESONANCE   |          | RESONANCE   |
| DOMINATES   |          | + PREFERENCE|          | PREFERENCE  |
|             |          | BALANCED    |          | DOMINATES   |
|  90% / 10%  |   --->   |  50% / 50%  |   --->   |  20% / 80%  |
+-------------+          +-------------+          +-------------+
      |                        |                           |
      v                        v                           v
+-------------+          +-------------+          +-------------+
| CORPUS:     |          | CORPUS:     |          | CORPUS:     |
| 100% curated|          | 40% curated |          | 100% full   |
| 0% full     |          | 60% full    |          | 0% curated  |
+-------------+          +-------------+          +-------------+
      |                        |                           |
      v                        v                           v
+-------------+          +-------------+          +-------------+
| TIERS:      |          | TIERS:      |          | TIERS:      |
| S:50 A:35   |          | S:30 A:30   |          | S:15 A:20   |
| B:12 C:3    |          | B:30 C:10   |          | B:35 C:30   |
+-------------+          +-------------+          +-------------+
      |                        |                           |
      v                        v                           v

 "This app has           "These feel             "This knows my
  great quotes!"          like gems"              taste perfectly"
```

**The experience feels smooth:** There's never a moment where the feed suddenly "changes." Quality gradually relaxes as personalization takes over.

---

## Admin Dashboard: Score Configuration

### Resonance Score Configuration Panel

```
+-----------------------------------------------------------------------------+
|                        RESONANCE SCORE CONFIGURATION                         |
+-----------------------------------------------------------------------------+
|                                                                              |
|  DIMENSION WEIGHTS (adjust sliders, must sum to 100)                         |
|  +------------------------------------------------------------------------+  |
|  |  Wikiquote Match        ========================............  25      |  |
|  |  Goodreads Count        ==============......................  15      |  |
|  |  Kindle Highlights      ==============......................  15      |  |
|  |  LLM Score              ====================................  20      |  |
|  |  Manual Curation        ==========..........................  10      |  |
|  |  Embedding Cluster      ==========..........................  10      |  |
|  |  Heuristic Score        =====...............................   5      |  |
|  +------------------------------------------------------------------------+  |
|                                                                 Total: 100   |
|                                                                              |
|  TIER CUTOFFS                                                                |
|  +------------------------------------------------------------------------+  |
|  |  S-Tier (>=)   [========|==================] 80                        |  |
|  |  A-Tier (>=)   [========|============] 60                              |  |
|  |  B-Tier (>=)   [========|======] 40                                    |  |
|  |  C-Tier       (everything below B-Tier cutoff)                         |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|                                         [Recompute Scores]  [Save Config]    |
|                                                                              |
|  NOTE: "Recompute Scores" is a batch operation that updates 10.3M passages.  |
|        Estimated time: ~15 minutes. Changes apply after completion.          |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Tier Statistics Dashboard (Live Preview)

This panel shows what each tier looks like under the current configuration. **Stats update automatically when you adjust weights or cutoffs** (computed from a 100K sample).

```
+-----------------------------------------------------------------------------+
|                         TIER PREVIEW (Live Statistics)                       |
+-----------------------------------------------------------------------------+
|                                                                              |
|  With current weights and cutoffs:                                           |
|                                                                              |
|  +------------+----------+----------+----------+----------+                  |
|  |            |  S-TIER  |  A-TIER  |  B-TIER  |  C-TIER  |                  |
|  |            |  (>=80)  |  (60-79) |  (40-59) |  (<40)   |                  |
|  +------------+----------+----------+----------+----------+                  |
|  | COUNT      |  52,341  |  487,229 | 1,893,456| 7,869,836|                  |
|  | % of total |   0.5%   |   4.7%   |  18.4%   |  76.4%   |                  |
|  +------------+----------+----------+----------+----------+                  |
|  | Avg Score  |   87.3   |   68.4   |   48.2   |   21.7   |                  |
|  +------------+----------+----------+----------+----------+                  |
|  | % Wikiquote|   89.2%  |   12.3%  |    1.1%  |    0.0%  |                  |
|  | % Goodreads|   34.1%  |    8.7%  |    0.4%  |    0.0%  |                  |
|  | % Kindle   |   28.4%  |    5.2%  |    0.2%  |    0.0%  |                  |
|  | % Curated  |   15.3%  |    2.1%  |    0.1%  |    0.0%  |                  |
|  | Avg LLM    |    8.4   |    6.8   |    5.2   |    3.1   |                  |
|  | Avg Heuris |    0.91  |    0.72  |    0.54  |    0.31  |                  |
|  +------------+----------+----------+----------+----------+                  |
|                                                                              |
|  INSIGHTS:                                                                   |
|  * S-Tier has 52K passages -- sufficient for cold-start diversity            |
|  * S-Tier is 89% Wikiquote -- expected, as Wikiquote has highest weight      |
|  * C-Tier is 76% of corpus -- expected for "random prose" filtering          |
|  * Avg LLM score drops cleanly across tiers -- weights are well-calibrated   |
|                                                                              |
+-----------------------------------------------------------------------------+
|  SCORE DISTRIBUTION (histogram)                                              |
|  +------------------------------------------------------------------------+  |
|  |     #                                                                  |  |
|  |     #                                                                  |  |
|  |     #                                           C    B    A    S       |  |
|  |     ##                                          <----|----|----|---->  |  |
|  |    ####                                              40   60   80      |  |
|  |   ######..                                                             |  |
|  |  ##########....                                                        |  |
|  |  -------------------------------------------------------------------   |  |
|  |  0    10   20   30   40   50   60   70   80   90   100                 |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  The histogram shows most passages cluster in 10-30 range (narrative prose). |
|  The cutoff lines show where tier boundaries fall.                           |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Preference Score Configuration Panel

```
+-----------------------------------------------------------------------------+
|                       PREFERENCE SCORE CONFIGURATION                         |
+-----------------------------------------------------------------------------+
|                                                                              |
|  SIGNAL BOOSTS (adjust the weight of each user signal)                       |
|  +------------------------------------------------------------------------+  |
|  |  Followed Author         ==============================......  3.0    |  |
|  |  Liked Author History    ===============.....................  1.5    |  |
|  |  Liked Category          =============.......................  1.3    |  |
|  |  Bookmarked Work         ============........................  1.2    |  |
|  |  Bookmarked Author       ===========.........................  1.15   |  |
|  |  Era Match               ===========.........................  1.1    |  |
|  |  Embedding Similarity    =====...............................  0.5    |  |
|  |  Popularity (normalized) ===.................................  0.3    |  |
|  |  Exploration Randomness  ===.................................  0.3    |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|                                                             [Save Config]    |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Personalization Blend Configuration Panel

```
+-----------------------------------------------------------------------------+
|                    PERSONALIZATION BLEND CONFIGURATION                       |
+-----------------------------------------------------------------------------+
|                                                                              |
|  How to blend resonance (intrinsic quality) vs preference (user fit)         |
|  based on how many signals the user has generated.                           |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |  SIGNALS  |  RESONANCE WEIGHT       |  PREFERENCE WEIGHT               |  |
|  +-----------+-------------------------+----------------------------------+  |
|  |  0-2      |  ====================.. 90%  |  ==..................... 10% |  |
|  |  3-5      |  ==============........ 70%  |  ======................. 30% |  |
|  |  6-10     |  ==========............ 50%  |  ==========............. 50% |  |
|  |  11-20    |  ======................ 30%  |  ==============......... 70% |  |
|  |  20+      |  ====.................. 20%  |  ================....... 80% |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  TIP: Higher resonance weight = quality floor matters more (for new users)   |
|  TIP: Higher preference weight = user taste matters more (for engaged users) |
|                                                                              |
|  EXPLOIT / EXPLORE RATIO                                                     |
|  +------------------------------------------------------------------------+  |
|  |  Exploitation %  ============================..............  70%      |  |
|  |  Exploration %   ============.............................. 30%       |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  TIP: Exploitation = Top-scored passages by personalization_score            |
|  TIP: Exploration = Random selection (prevents filter bubbles)               |
|                                                                              |
|                                                             [Save Config]    |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Corpus Blend Configuration Panel

```
+-----------------------------------------------------------------------------+
|                      CORPUS BLEND CONFIGURATION                              |
+-----------------------------------------------------------------------------+
|                                                                              |
|  How to blend curated works (153 works, ~500K passages) vs full corpus       |
|  (17,291 works, 10.3M passages) based on user signal count.                  |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |  SIGNALS  |  CURATED WORKS          |  FULL CORPUS                    |  |
|  +-----------+-------------------------+----------------------------------+  |
|  |  0        |  ====================.. 100% |  ...................... 0%  |  |
|  |  1        |  ================...... 80%  |  ====.................. 20% |  |
|  |  2        |  ============.......... 60%  |  ========.............. 40% |  |
|  |  3        |  ========.............. 40%  |  ============.......... 60% |  |
|  |  5        |  ====.................. 20%  |  ================...... 80% |  |
|  |  10+      |  ...................... 0%   |  ====================.. 100%|  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  TIP: Curated works are hand-selected high-quality works (safety net)        |
|  TIP: Full corpus offers more variety but requires quality filtering         |
|                                                                              |
|                                                             [Save Config]    |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Tier Sampling Configuration Panel

```
+-----------------------------------------------------------------------------+
|                      TIER SAMPLING CONFIGURATION                             |
+-----------------------------------------------------------------------------+
|                                                                              |
|  What percentage of each tier to sample, based on user signal count.         |
|  (Applies to passages from full corpus only; curated works are pre-filtered.)|
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |  SIGNALS  |  S-TIER  |  A-TIER  |  B-TIER  |  C-TIER  |  TOTAL        |  |
|  +-----------+----------+----------+----------+----------+---------------+  |
|  |  0-2      |   50%    |   35%    |   12%    |    3%    |   100%        |  |
|  |  3-5      |   40%    |   35%    |   20%    |    5%    |   100%        |  |
|  |  6-10     |   30%    |   30%    |   30%    |   10%    |   100%        |  |
|  |  11-20    |   20%    |   25%    |   35%    |   20%    |   100%        |  |
|  |  20+      |   15%    |   20%    |   35%    |   30%    |   100%        |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  TIP: New users see mostly S/A tier (quality floor)                          |
|  TIP: Engaged users see more B/C tier (personalization finds their gems)     |
|                                                                              |
|                                                             [Save Config]    |
|                                                                              |
+-----------------------------------------------------------------------------+
```

---

## Complete Feed Algorithm (v4)

### Overview Schematic

```
+-----------------------------------------------------------------------------+
|                         FEED REQUEST ARRIVES                                 |
|                    GET /api/feed?limit=20&category=...                       |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    STEP 1: COMPUTE USER MATURITY                             |
+-----------------------------------------------------------------------------+
|                                                                              |
|   signalCount = count(likes) + count(bookmarks)                              |
|                                                                              |
|   Determines:                                                                |
|   * Corpus blend ratio (curated vs full)                                     |
|   * Tier sampling weights                                                    |
|   * Personalization blend (resonance vs preference weights)                  |
|                                                                              |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    STEP 2: CANDIDATE SAMPLING                                |
+-----------------------------------------------------------------------------+
|                                                                              |
|   2a. Determine corpus split:                                                |
|       curatedCount = limit x corpusBlend.curated                             |
|       fullCorpusCount = limit x corpusBlend.full                             |
|                                                                              |
|   2b. Sample from curated works (if curatedCount > 0):                       |
|       SELECT * FROM chunks                                                   |
|       JOIN curated_works ON chunks.work_id = curated_works.work_id           |
|       WHERE quality_tier IN (weighted by tier sampling config)               |
|       ORDER BY RANDOM() LIMIT curatedCount x 5  (5x oversample)              |
|                                                                              |
|   2c. Sample from full corpus (if fullCorpusCount > 0):                      |
|       SELECT * FROM chunks                                                   |
|       WHERE quality_tier IN (weighted by tier sampling config)               |
|       ORDER BY RANDOM() LIMIT fullCorpusCount x 5  (5x oversample)           |
|                                                                              |
|   2d. Combine candidates: curated + fullCorpus                               |
|                                                                              |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    STEP 3: SCORE ALL CANDIDATES                              |
+-----------------------------------------------------------------------------+
|                                                                              |
|   For each candidate passage:                                                |
|                                                                              |
|   // resonance_score is pre-computed and stored                              |
|   resonance = passage.resonance_score;  // 0-100                             |
|                                                                              |
|   // preference_score computed in real-time                                  |
|   preference = computePreferenceScore(passage, userSignals);  // 0-10        |
|   preferenceNormalized = (preference / 10) x 100;  // 0-100                  |
|                                                                              |
|   // Get blend weights based on user maturity                                |
|   weights = getBlendWeights(signalCount);  // e.g. {resonance: 0.5, pref: 0.5}
|                                                                              |
|   // Compute final personalization_score                                     |
|   personalization_score = (resonance x weights.resonance) +                  |
|                           (preferenceNormalized x weights.preference);       |
|                                                                              |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    STEP 4: EXPLOIT/EXPLORE SELECTION                         |
+-----------------------------------------------------------------------------+
|                                                                              |
|   Sort all candidates by personalization_score (descending)                  |
|                                                                              |
|   exploitCount = limit x exploitRatio;  // e.g., 14 of 20                    |
|   exploreCount = limit x exploreRatio;  // e.g., 6 of 20                     |
|                                                                              |
|   exploitPassages = candidates.slice(0, exploitCount);                       |
|   explorePassages = randomSample(candidates.slice(exploitCount), exploreCount);
|                                                                              |
|   selected = [...exploitPassages, ...explorePassages];                       |
|                                                                              |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                    STEP 5: DIVERSITY ENFORCEMENT                             |
+-----------------------------------------------------------------------------+
|                                                                              |
|   Apply existing diversity rules:                                            |
|   * Author diversity: Max 1 per 20 passages                                  |
|   * Work diversity: Max 1 per 10 passages                                    |
|   * Length diversity: 30/40/30 split (short/medium/long)                     |
|   * Type diversity: 45% quote, 30% poetry, 20% prose, 5% speech              |
|   * Cursor tracking: Exclude recently shown author/work IDs                  |
|                                                                              |
+-----------------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------------+
|                         FINAL SHUFFLE & RETURN                               |
|                    20 high-quality, diverse, personalized passages           |
+-----------------------------------------------------------------------------+
```

---

## Database Schema Changes

### New Columns on `chunks` Table

```sql
-- Resonance score (computed in batch, stored)
ALTER TABLE chunks ADD COLUMN resonance_score FLOAT;

-- Quality tier (derived from resonance_score)
-- NOTE: This uses DEFAULT cutoffs for indexing. Actual tier assignment at query time
-- can use config-driven cutoffs that differ from these defaults.
ALTER TABLE chunks ADD COLUMN quality_tier VARCHAR(1) GENERATED ALWAYS AS (
  CASE 
    WHEN resonance_score >= 80 THEN 'S'
    WHEN resonance_score >= 60 THEN 'A'
    WHEN resonance_score >= 40 THEN 'B'
    ELSE 'C'
  END
) STORED;

-- External signal columns (for resonance score computation)
ALTER TABLE chunks ADD COLUMN wikiquote_match BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN goodreads_count INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN kindle_highlight_count INTEGER DEFAULT 0;
ALTER TABLE chunks ADD COLUMN llm_quality_score FLOAT;  -- 0-10 from LLM scoring
ALTER TABLE chunks ADD COLUMN manually_curated BOOLEAN DEFAULT FALSE;
ALTER TABLE chunks ADD COLUMN cluster_quality FLOAT;  -- 0-1 from embedding analysis
ALTER TABLE chunks ADD COLUMN heuristic_score FLOAT;  -- 0-1 from self-containedness checks

-- NEW in v6: Additional quality signals
ALTER TABLE chunks ADD COLUMN bartletts_match BOOLEAN DEFAULT FALSE;  -- Matched to Bartlett's Quotations
ALTER TABLE chunks ADD COLUMN wikisource_featured BOOLEAN DEFAULT FALSE;  -- From a Wikisource featured work
ALTER TABLE chunks ADD COLUMN signal_count INTEGER DEFAULT 0;  -- Count of present signals (for confidence)

-- NEW in v6: Persistent sample_key for fast indexed sampling
-- This replaces ORDER BY RANDOM() which can't use indexes
ALTER TABLE chunks ADD COLUMN sample_key FLOAT DEFAULT random();

-- Indexes for efficient querying
CREATE INDEX idx_chunks_resonance_score ON chunks(resonance_score);
CREATE INDEX idx_chunks_quality_tier ON chunks(quality_tier);

-- NEW in v6: Index for sample_key based sampling (CRITICAL for performance)
CREATE INDEX idx_chunks_sample_key ON chunks(sample_key);
CREATE INDEX idx_chunks_tier_sample_key ON chunks(quality_tier, sample_key);

-- Backfill sample_key for existing rows
UPDATE chunks SET sample_key = random() WHERE sample_key IS NULL;
```

### Fast Sampling with sample_key (Replaces ORDER BY RANDOM)

The `sample_key` column enables **indexed random sampling**, which is dramatically faster than `ORDER BY RANDOM()` on large tables.

**How it works:**

```typescript
async function sampleFromTier(
  tier: string, 
  limit: number, 
  cursor?: number
): Promise<Passage[]> {
  // Start from a random point if no cursor provided
  const startKey = cursor ?? Math.random();
  
  // First query: get passages after the cursor
  let results = await db.query(`
    SELECT * FROM chunks
    WHERE quality_tier = $1
      AND sample_key >= $2
    ORDER BY sample_key
    LIMIT $3
  `, [tier, startKey, limit]);
  
  // If we didn't get enough (hit end of range), wrap around
  if (results.length < limit) {
    const remaining = limit - results.length;
    const wrapResults = await db.query(`
      SELECT * FROM chunks
      WHERE quality_tier = $1
        AND sample_key < $2
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
| `ORDER BY RANDOM() LIMIT 20` | ~3-5 seconds | No (full scan + sort) |
| `WHERE sample_key >= $x ORDER BY sample_key LIMIT 20` | ~5-20ms | Yes |

**Why this works:**
- `sample_key` values are uniformly distributed 0-1
- The B-tree index on `sample_key` allows fast range scans
- Starting from a random point gives random-feeling results
- Wrap-around ensures you can always get N results

### New Configuration Tables

```sql
-- Resonance score weight configuration
CREATE TABLE resonance_config (
  id SERIAL PRIMARY KEY,
  weight_wikiquote INTEGER DEFAULT 25,
  weight_goodreads INTEGER DEFAULT 15,
  weight_kindle INTEGER DEFAULT 15,
  weight_llm INTEGER DEFAULT 20,
  weight_curation INTEGER DEFAULT 10,
  weight_cluster INTEGER DEFAULT 10,
  weight_heuristic INTEGER DEFAULT 5,
  cutoff_s_tier INTEGER DEFAULT 80,
  cutoff_a_tier INTEGER DEFAULT 60,
  cutoff_b_tier INTEGER DEFAULT 40,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Preference score boost configuration
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

-- Personalization blend configuration (by signal count)
CREATE TABLE personalization_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL,  -- e.g., 0, 3, 6, 11, 20
  resonance_weight FLOAT NOT NULL,     -- e.g., 0.9, 0.7, 0.5, 0.3, 0.2
  preference_weight FLOAT NOT NULL,    -- e.g., 0.1, 0.3, 0.5, 0.7, 0.8
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signal_threshold)
);

-- Insert defaults
INSERT INTO personalization_blend_config (signal_threshold, resonance_weight, preference_weight) VALUES
  (0, 0.9, 0.1),
  (3, 0.7, 0.3),
  (6, 0.5, 0.5),
  (11, 0.3, 0.7),
  (20, 0.2, 0.8);

-- Corpus blend configuration (by signal count)
CREATE TABLE corpus_blend_config (
  id SERIAL PRIMARY KEY,
  signal_threshold INTEGER NOT NULL,
  curated_ratio FLOAT NOT NULL,   -- e.g., 1.0, 0.8, 0.6, 0.4, 0.2, 0.0
  full_corpus_ratio FLOAT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(signal_threshold)
);

-- Insert defaults
INSERT INTO corpus_blend_config (signal_threshold, curated_ratio, full_corpus_ratio) VALUES
  (0, 1.0, 0.0),
  (1, 0.8, 0.2),
  (2, 0.6, 0.4),
  (3, 0.4, 0.6),
  (5, 0.2, 0.8),
  (10, 0.0, 1.0);

-- Tier sampling configuration (by signal count)
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

-- Insert defaults
INSERT INTO tier_sampling_config (signal_threshold, s_tier_ratio, a_tier_ratio, b_tier_ratio, c_tier_ratio) VALUES
  (0, 0.50, 0.35, 0.12, 0.03),
  (3, 0.40, 0.35, 0.20, 0.05),
  (6, 0.30, 0.30, 0.30, 0.10),
  (11, 0.20, 0.25, 0.35, 0.20),
  (20, 0.15, 0.20, 0.35, 0.30);
```

---

## MVP Priority Improvements (v6 Additions)

These are high-ROI, low-effort improvements that should be implemented for MVP:

### 1. Persistent sample_key Column (CRITICAL)

**Problem:** `ORDER BY RANDOM()` scans the entire table and cannot use indexes. On 10.3M rows, this takes 3-5 seconds per query.

**Solution:** Already documented above in schema section. Add `sample_key FLOAT` column with index, sample via range query.

**Effort:** 2-3 days
**Success metric:** Sampling queries drop from ~4s to <50ms

---

### 2. Missing-Value Handling with Confidence Penalty

**Problem:** Old formula defaulted missing values to midpoints (0.5), inflating scores for passages with sparse signals.

**Solution:** Already documented above in resonance score formula. Renormalize over present signals, apply confidence penalty.

**Effort:** 1-2 days
**Success metric:** S-tier passages have higher average `signal_count` than A-tier

---

### 3. Bartlett's Familiar Quotations Matching

**What it is:** Classic quote anthology (public domain on Project Gutenberg). ~10K curated quotes from pre-1920 authors.

**Why it's valuable:**
- Zero legal/scraping risk (public domain)
- High precision: if a quote is in Bartlett's, it's famous
- Validates your matching pipeline before tackling Goodreads
- Perfect overlap with your corpus timeframe

**Implementation:**

```typescript
// Step 1: Download and parse Bartlett's from Gutenberg
// Available at: https://www.gutenberg.org/ebooks/27635
async function parseBartletts(): Promise<Quote[]> {
  const text = await fetchGutenbergText(27635);
  const quotes: Quote[] = [];
  
  // Bartlett's has a consistent format:
  // Author name followed by quotes attributed to them
  // Parse with regex or line-by-line state machine
  
  // Example structure:
  // SHAKESPEARE, WILLIAM. 1564-1616.
  //   To be, or not to be...
  //   All the world's a stage...
  
  return quotes;
}

// Step 2: Match against corpus using trigram similarity
async function matchBartlettsToCorpus() {
  const bartlettsQuotes = await parseBartletts();
  let matched = 0;
  let total = 0;
  
  for (const quote of bartlettsQuotes) {
    total++;
    
    // Find the author in your DB
    const author = await db.query(`
      SELECT id FROM authors 
      WHERE name ILIKE $1 OR name_variants @> ARRAY[$1]
      LIMIT 1
    `, [quote.author]);
    
    if (!author) continue;
    
    // Try to match the quote
    const match = await db.query(`
      SELECT id, text, similarity(text, $1) as sim
      FROM chunks
      WHERE author_id = $2
        AND similarity(text, $1) > 0.5
      ORDER BY sim DESC
      LIMIT 1
    `, [quote.text, author.id]);
    
    if (match && match.sim > 0.6) {
      matched++;
      await db.query(`
        UPDATE chunks SET bartletts_match = TRUE WHERE id = $1
      `, [match.id]);
    }
  }
  
  console.log(`Matched ${matched}/${total} = ${(matched/total*100).toFixed(1)}%`);
}
```

**Effort:** 2-3 days
**Success metric:** >40% match rate validates your matching pipeline

---

### 4. Wikisource Featured Texts

**What it is:** Wikisource editors hand-select ~200 "featured" texts that meet quality standards.

**Why it's valuable:**
- Zero risk (public Wikimedia data)
- High precision (human-curated)
- Tiny effort for clean quality signal
- Boosts entire works, not just passages

**Implementation:**

```typescript
// Step 1: Fetch the featured texts list
// URL: https://en.wikisource.org/wiki/Wikisource:Featured_texts
async function fetchWikisourceFeatured(): Promise<Work[]> {
  const html = await fetch('https://en.wikisource.org/wiki/Wikisource:Featured_texts');
  const $ = cheerio.load(await html.text());
  
  const works: Work[] = [];
  
  // Parse the featured texts list
  // Format is typically: Title by Author
  $('div.featured-text a').each((i, el) => {
    const title = $(el).text();
    const href = $(el).attr('href');
    works.push({ title, wikisourceUrl: href });
  });
  
  return works;
}

// Step 2: Match to your works table
async function matchWikisourceFeatured() {
  const featuredWorks = await fetchWikisourceFeatured();
  let matched = 0;
  
  for (const work of featuredWorks) {
    // Try to find matching work by title
    const match = await db.query(`
      SELECT id FROM works
      WHERE similarity(title, $1) > 0.7
      ORDER BY similarity(title, $1) DESC
      LIMIT 1
    `, [work.title]);
    
    if (match) {
      matched++;
      // Mark all chunks from this work
      await db.query(`
        UPDATE chunks SET wikisource_featured = TRUE WHERE work_id = $1
      `, [match.id]);
    }
  }
  
  console.log(`Matched ${matched}/${featuredWorks.length} featured works`);
}
```

**Effort:** 2-3 days
**Success metric:** Most matched works land in S/A tier

---

### 5. Dynamic Cutoffs Architecture

**Problem:** The computed column uses hardcoded cutoffs. Changing cutoffs requires altering the column definition.

**Solution:** Hybrid approach:

1. **Computed column** uses default cutoffs (80/60/40) for **indexing**
2. **Query-time logic** uses config-driven cutoffs for **actual tier assignment**
3. If cutoffs drift far from defaults, run a batch job to refresh the computed column

```typescript
// At query time, use config-driven cutoffs instead of the computed column
async function getPassagesByTier(tier: string, limit: number) {
  const config = await getResonanceConfig();
  
  let minScore: number;
  let maxScore: number | null = null;
  
  switch (tier) {
    case 'S':
      minScore = config.cutoff_s_tier;  // e.g., 75 instead of default 80
      break;
    case 'A':
      minScore = config.cutoff_a_tier;
      maxScore = config.cutoff_s_tier;
      break;
    case 'B':
      minScore = config.cutoff_b_tier;
      maxScore = config.cutoff_a_tier;
      break;
    default:
      minScore = 0;
      maxScore = config.cutoff_b_tier;
  }
  
  // Query by score range, not by computed tier column
  // (Use computed tier column for index hint if cutoffs are close to defaults)
  return db.query(`
    SELECT * FROM chunks
    WHERE resonance_score >= $1
      ${maxScore ? 'AND resonance_score < $2' : ''}
    ORDER BY sample_key
    LIMIT $3
  `, maxScore ? [minScore, maxScore, limit] : [minScore, limit]);
}
```

**When to refresh computed column:**
- If S-tier cutoff drops below 70 or rises above 90
- As part of weekly maintenance job

**Effort:** 1 day
**Success metric:** Can change cutoffs in admin dashboard without schema migration

---

## Implementation Phases

### IMPORTANT: Validation-First Approach

Before building the full resonance_score pipeline, we should **validate that external signals actually work** for our corpus. If Goodreads quotes don't match well, or Kindle data is unavailable, we need to know that before investing in the full system.

### Phase 0: Signal Validation (Week 1) -- DO THIS FIRST

**Goal:** De-risk the external signals approach before building the full pipeline.

```
+-----------------------------------------------------------------------------+
|                    VALIDATION-FIRST WORKFLOW                                 |
+-----------------------------------------------------------------------------+

Step 1: Scrape Goodreads quotes for TOP 10 AUTHORS only
  - Marcus Aurelius, Shakespeare, Plato, Dickens, Austen, etc.
  - Maybe 500-1000 quotes total
  - Time: 1-2 days

Step 2: Fuzzy match against your corpus
  - How many matches? 50%? 80%? 10%?
  - What's the quality of matches?
  - Time: 1 day

Step 3: Manual review of matches
  - Are these actually good passages?
  - Would they make good S-tier candidates?
  - Time: 1 day

DECISION POINT:
  |
  +-- If >50% match rate and quality is good --> Proceed with full scrape
  |
  +-- If <20% match rate --> Goodreads signal is weak, lower weight to 5-10
  |
  +-- If matches are low quality --> Matching algorithm needs tuning
  |
  +-- If Kindle data unavailable --> Remove from model, redistribute weight
```

**Validation Script:**

```typescript
// Quick validation: scrape 10 authors, match against corpus
async function validateGoodreadsSignal() {
  const testAuthors = [
    'Marcus Aurelius', 'William Shakespeare', 'Jane Austen',
    'Charles Dickens', 'Plato', 'Oscar Wilde', 'Mark Twain',
    'Friedrich Nietzsche', 'Leo Tolstoy', 'Virginia Woolf'
  ];
  
  const results = {
    totalQuotes: 0,
    matchedQuotes: 0,
    sampleMatches: [],
  };
  
  for (const author of testAuthors) {
    const goodreadsQuotes = await scrapeGoodreadsQuotes(author, { limit: 100 });
    results.totalQuotes += goodreadsQuotes.length;
    
    for (const quote of goodreadsQuotes) {
      const match = await fuzzyMatchCorpus(quote.text, { threshold: 0.8 });
      if (match) {
        results.matchedQuotes++;
        if (results.sampleMatches.length < 20) {
          results.sampleMatches.push({
            goodreads: quote.text.slice(0, 100),
            corpus: match.text.slice(0, 100),
            similarity: match.similarity,
          });
        }
      }
    }
  }
  
  console.log(`Match rate: ${results.matchedQuotes}/${results.totalQuotes}`);
  console.log(`= ${(results.matchedQuotes/results.totalQuotes*100).toFixed(1)}%`);
  console.log('Sample matches:', results.sampleMatches);
  
  return results;
}
```

**What You Learn:**

| Outcome | Implication | Action |
|---------|-------------|--------|
| **High match rate (>50%)** | Goodreads is strong signal | Keep weight at 15, proceed with full scrape |
| **Medium match rate (20-50%)** | Goodreads is useful but limited | Lower weight to 10, still worth using |
| **Low match rate (<20%)** | Goodreads signal is weak | Lower weight to 5, prioritize LLM scoring |
| **Matches are bad quality** | Matching algorithm broken | Fix fuzzy matching before proceeding |
| **Kindle data unavailable** | Can't use Kindle signal | Remove from model, add weight to LLM |

**Also validate:**
- **Wikiquote overlap:** Do your 219K Wikiquote passages appear in other sources too? This validates cross-source matching.
- **Skip Kindle for now:** Too hard to get cleanly. Goodreads has some Kindle highlight data anyway.

### Passage Matching Techniques

How do you actually match a Goodreads quote to your corpus? Here are four approaches:

#### Approach 1: Fuzzy String Matching (Simplest)

Use a library like `fuzzball` (JS) or `rapidfuzz` (Python) to compare text similarity:

```typescript
import fuzz from 'fuzzball';

async function fuzzyMatchCorpus(
  goodreadsQuote: string, 
  authorId: number,
  threshold = 80
) {
  // Normalize the quote
  const normalized = goodreadsQuote
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim();
  
  // Search your corpus (LIMITED TO SAME AUTHOR)
  const candidates = await db.query(`
    SELECT id, text, author_id 
    FROM chunks 
    WHERE author_id = $1
    AND char_length(text) BETWEEN $2 AND $3
  `, [authorId, normalized.length * 0.5, normalized.length * 2]);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const chunk of candidates) {
    const chunkNormalized = chunk.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Token set ratio handles word reordering and partial matches
    const score = fuzz.token_set_ratio(normalized, chunkNormalized);
    
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { ...chunk, similarity: score };
    }
  }
  
  return bestMatch;
}
```

**Pros:** Simple, no setup required
**Cons:** Slow for large corpus, requires limiting candidates (by author, length)

#### Approach 2: PostgreSQL Trigram Index (Recommended for Validation)

PostgreSQL has built-in trigram similarity via `pg_trgm`. This is fast and handles typos/variations well.

**Setup:**

```sql
-- Enable the extension (one-time)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a trigram index on chunk text
CREATE INDEX idx_chunks_text_trgm ON chunks USING GIN (text gin_trgm_ops);
```

**Query:**

```sql
-- Fast similarity search using the index
SELECT id, text, similarity(text, $1) as sim
FROM chunks
WHERE author_id = $2                    -- ALWAYS limit to same author
  AND text % $1                         -- % operator uses trigram similarity
ORDER BY sim DESC
LIMIT 5;

-- Or with a specific threshold
SELECT id, text, similarity(text, $1) as sim
FROM chunks
WHERE author_id = $2
  AND similarity(text, $1) > 0.4        -- 40% similarity threshold
ORDER BY sim DESC
LIMIT 1;
```

**In TypeScript:**

```typescript
async function findMatchingChunk(
  goodreadsQuote: string, 
  authorId: number,
  threshold = 0.4
): Promise<Match | null> {
  const results = await db.query(`
    SELECT id, text, similarity(text, $1) as sim
    FROM chunks
    WHERE author_id = $2
      AND similarity(text, $1) > $3
    ORDER BY sim DESC
    LIMIT 1
  `, [goodreadsQuote, authorId, threshold]);
  
  return results[0] || null;
}
```

**Pros:** Fast (uses index), built into Postgres, handles typos/variations
**Cons:** Trigram similarity can be weird with very short strings

#### Approach 3: Embedding Similarity (Most Semantically Robust)

If you already have embeddings, this handles paraphrasing and different editions:

```typescript
async function findMatchingChunkByEmbedding(
  goodreadsQuote: string, 
  authorId: number
): Promise<Match | null> {
  // 1. Embed the Goodreads quote
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: goodreadsQuote,
  });
  const quoteEmbedding = response.data[0].embedding;
  
  // 2. Find nearest neighbor in your corpus (same author)
  const results = await db.query(`
    SELECT id, text, 
           1 - (embedding <=> $1::vector) as similarity
    FROM chunks
    WHERE author_id = $2
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [quoteEmbedding, authorId]);
  
  // 3. Return best match if similarity is high enough
  if (results[0] && results[0].similarity > 0.85) {
    return results[0];
  }
  return null;
}
```

**Pros:** Handles paraphrasing, different editions, semantic equivalence
**Cons:** Requires embedding each Goodreads quote (API cost ~$0.0001/quote), might match "similar" but not "same"

#### Approach 4: Hybrid (Recommended for Production)

Combine approaches for best results -- try fast methods first, fall back to slower/more robust:

```typescript
async function findMatchingChunk(
  goodreadsQuote: string, 
  authorId: number
): Promise<Match | null> {
  
  // === STEP 1: Exact substring match (fastest) ===
  const exactMatch = await db.query(`
    SELECT id, text, 1.0 as similarity, 'exact' as match_type
    FROM chunks
    WHERE author_id = $1
      AND text ILIKE '%' || $2 || '%'
    LIMIT 1
  `, [authorId, goodreadsQuote.slice(0, 100)]);  // First 100 chars
  
  if (exactMatch[0]) return exactMatch[0];
  
  // === STEP 2: Trigram similarity (fast, handles variations) ===
  const trigramMatch = await db.query(`
    SELECT id, text, similarity(text, $1) as similarity, 'trigram' as match_type
    FROM chunks
    WHERE author_id = $2
      AND similarity(text, $1) > 0.4
    ORDER BY similarity(text, $1) DESC
    LIMIT 1
  `, [goodreadsQuote, authorId]);
  
  if (trigramMatch[0] && trigramMatch[0].similarity > 0.6) {
    return trigramMatch[0];
  }
  
  // === STEP 3: Embedding similarity (handles paraphrasing) ===
  const embedding = await getEmbedding(goodreadsQuote);
  const embeddingMatch = await db.query(`
    SELECT id, text, 
           1 - (embedding <=> $1::vector) as similarity,
           'embedding' as match_type
    FROM chunks
    WHERE author_id = $2
      AND embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT 1
  `, [embedding, authorId]);
  
  if (embeddingMatch[0] && embeddingMatch[0].similarity > 0.88) {
    return embeddingMatch[0];
  }
  
  // === NO MATCH FOUND ===
  return null;
}
```

#### The Critical Optimization: Filter by Author First

Goodreads quotes have author attribution. **Always filter by author first** to reduce search space:

```
Goodreads: "The only true wisdom is knowing you know nothing." - Socrates
                                                                    |
                                                                    v
Search only chunks WHERE author matches "Socrates" (or "Plato" for Socratic dialogues)
```

This reduces your search space from 10.3M passages to maybe 500-5000 per author.

#### Matching Thresholds

| Method | Threshold | Meaning |
|--------|-----------|---------|
| **Exact substring** | 100% | Quote appears verbatim in passage |
| **Trigram similarity** | >60% | Strong match, likely same passage |
| **Trigram similarity** | 40-60% | Possible match, needs review |
| **Embedding similarity** | >88% | Semantically equivalent |
| **Embedding similarity** | 80-88% | Similar content, might be paraphrase |

#### Recommended Approach for Validation Phase

Use **Approach 2 (PostgreSQL Trigram)** for the validation phase because:
- No extra API costs (unlike embeddings)
- Fast enough for 1000 quotes
- Built into Postgres, no external dependencies
- Good enough to validate if matches exist at all

Save the hybrid approach for production when you need maximum accuracy.

---

### Phase 1: Foundation (Week 2-3)

1. **Add resonance_score column** to chunks table
2. **Create configuration tables** for weights and cutoffs
3. **Build admin dashboard panels** for resonance score configuration
4. **Implement basic resonance score computation** using existing signals:
   - `wikiquote_match` (from source = 'wikiquote')
   - `heuristic_score` (from existing QA flags)
5. **Add quality_tier computed column**

### Phase 2: External Signals (Week 4-5)

Based on Phase 0 validation results, adjust weights accordingly:

6. **Scrape Goodreads quotes** for top 100 authors (if validation passed)
7. **Match to chunks** and populate `goodreads_count`
8. **Implement LLM scoring batch job** (Gemini Flash, ~$35-50)
9. **Populate llm_quality_score** for pre-filtered corpus
10. **Update resonance scores** with new signals

### Phase 3: Preference & Personalization (Week 6-7)

11. **Implement preference_score computation** in feed algorithm
12. **Implement personalization_score blending** with signal-based weights
13. **Add admin dashboard panels** for preference and blend configuration
14. **Implement gradual corpus blending** (curated vs full)
15. **Implement gradual tier weight shifting**

### Phase 4: Embedding Intelligence (Week 8-9)

16. **Complete embedding generation** (if not done)
17. **Run clustering analysis** (K-means, 1000 clusters)
18. **Compute cluster_quality** scores
19. **Update resonance scores** with embedding signal
20. **Implement taste vector computation** for preference_score

### Phase 5: Dashboard Polish (Week 10)

21. **Build Tier Statistics Dashboard** with live preview
22. **Add score distribution histogram**
23. **Add sanity check warnings** (e.g., "S-Tier too small")
24. **Implement "Recompute Scores" batch job** with progress tracking
25. **A/B testing infrastructure** for different weight configurations

---

## Success Metrics

Track these to validate the v4 improvements:

| Metric | What It Measures | Target |
|--------|------------------|--------|
| **Session length (first session)** | Initial engagement | +20% vs v3 |
| **Like rate in first 10 scrolls** | Quality perception | >5% |
| **Return rate (day 1)** | Stickiness | >40% |
| **Return rate (day 7)** | Long-term retention | >20% |
| **Time to first like/bookmark** | How quickly users engage | <30 seconds |
| **Bounce rate (<5 scrolls)** | Immediate quality | <20% |
| **Signal accumulation rate** | How fast users personalize | >1 signal/session |

### A/B Test Ideas

- **Resonance weight variations:** 90/10 vs 80/20 vs 70/30 for cold-start
- **Tier cutoff variations:** S-tier at 75 vs 80 vs 85
- **Corpus blend speed:** Fast (full corpus by 5 signals) vs slow (by 15 signals)
- **Wikiquote weight:** 25 vs 35 vs 15 (is it over/under-weighted?)

---

## Summary: What's New in v4

| v3 | v4 |
|----|-----|
| Discrete user states (anonymous, bootstrap, personalized) | **Gradual transitions** via blended corpus + shifting weights |
| Quality tiers assigned by criteria | **Quality tiers derived from continuous resonance_score** |
| Single scoring function | **Three-score hierarchy** (resonance -> preference -> personalization) |
| Fixed tier sampling weights | **Signal-count-based tier weight shifting** |
| Limited admin configurability | **Full admin dashboard** for all weights and cutoffs |
| No visibility into tier composition | **Tier Statistics Dashboard** with live preview |
| Hard cutoff at 3 signals | **Smooth blend** from first signal to 20+ |

The core insight: **separate intrinsic quality (resonance) from user fit (preference), then blend them based on how much we know about the user.** This creates a system that's both robust for cold-start AND responsive to individual taste.

---

## Appendix: Resonance Score Dimensions (Detailed)

This section preserves the detailed descriptions of each signal source from v3.

### Wikiquote Match (Default Weight: 25)

**What it is:** 219K curated quotes from notable figures--each one selected by editors as standalone and significant.

**Implementation:**
- All passages with `source = 'wikiquote'` get `wikiquote_match = TRUE`
- For passages from other sources, compute text overlap with Wikiquote entries
- If overlap >=80%, flag as `wikiquote_match = TRUE`

### Goodreads Count (Default Weight: 15)

**What it is:** User-submitted "favorite quotes" for books, plus "Popular Highlights" aggregated from Kindle readers.

**Implementation:**
- Scrape Goodreads quotes for top 100 authors
- Fuzzy match against your passages (80%+ overlap)
- Store match count in `goodreads_count`

### Kindle Highlights (Default Weight: 15)

**What it is:** Amazon aggregates passages that Kindle users highlight. Real-world signal of what resonates.

**Implementation:**
- Lower priority (no clean API)
- Can use Goodreads "Kindle Notes & Highlights" as proxy
- Store in `kindle_highlight_count`

### LLM Score (Default Weight: 20)

**What it is:** AI-judged quality on four dimensions: Insight, Standalone, Memorable, Beauty.

**Implementation:**
- Pre-filter corpus to ~1-2M candidates
- Run batch scoring with Gemini Flash (~$35-50)
- Store average of 4 dimensions as `llm_quality_score` (0-10)

### Manual Curation (Default Weight: 10)

**What it is:** Human expert selection via admin dashboard or "Would Tattoo It" test.

**Implementation:**
- `featured_passages` table with admin curation
- User "nominate" button -> admin review queue
- Set `manually_curated = TRUE` on approval

### Embedding Cluster Quality (Default Weight: 10)

**What it is:** "Passages that live near wisdom tend to be wise."

**Implementation:**
- Cluster embeddings (K-means, 1000 clusters)
- For each cluster, compute "gold density" (% Wikiquote + curated)
- Store cluster quality as `cluster_quality` (0-1)

### Heuristic Score (Default Weight: 5)

**What it is:** Self-containedness signals based on text patterns.

**Red flags (downrank):**
- Starts with conjunctions: "And", "But", "Then", "So"
- Heavy pronoun starts: "He", "She", "They"
- Dialogue fragments
- Structure noise: "CHAPTER IV", footnotes
- Doesn't end cleanly

**Green flags (boost):**
- Aphorism density (abstract nouns)
- Imperative voice
- Universal pronouns ("We", "One")
- Opening/closing lines of chapters

**Implementation:**
- Compute during ingestion or as batch job
- Store as `heuristic_score` (0-1)

---

## Future Possibilities (Post-MVP)

These improvements are valuable but should be deferred until after MVP ships and you have real user data.

### Log/Quantile Normalization for Count-Based Signals

**Current approach:** Hard divisors like `Math.min(goodreads_count / 1000, 1)` are arbitrary.

**Better approach:** After collecting Goodreads data, analyze the actual distribution:

```typescript
// Option 1: Log normalization
const normalized = Math.log1p(count) / Math.log1p(maxCount);

// Option 2: Percentile-based
const normalized = getPercentile(count, allCounts) / 100;
```

**When to implement:** After Goodreads data is collected and you can see the distribution.

**Effort:** S (1 day)

---

### Negative Signals (Hide Author)

**What it is:** Allow users to explicitly say "never show me this author."

**Implementation:**

```sql
-- New table for user preferences
CREATE TABLE user_hidden_authors (
  user_id INT REFERENCES users(id),
  author_id INT REFERENCES authors(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, author_id)
);

-- Add to feed query WHERE clause
SELECT * FROM chunks
WHERE author_id NOT IN (
  SELECT author_id FROM user_hidden_authors WHERE user_id = $1
)
-- ... rest of query
```

**UI:** Add "Hide this author" option to passage overflow menu.

**What to avoid:**
- Don't implement "skip speed" as a negative signal -- scroll speed is device-dependent and noisy
- Don't implement "not interested" on individual passages until you have more data on what users actually do with it

**When to implement:** After you have 100+ users with meaningful engagement.

**Effort:** M (1 week including UI)

---

### pgvector Retrieval for Taste-Based Candidate Generation

**Current approach:** Random sampling -> score with preference -> rank

**Upgrade:** For engaged users, include nearest neighbors to their taste vector in the candidate pool:

```typescript
async function getCandidatesForEngagedUser(
  userId: number,
  userSignals: UserSignals,
  limit: number
): Promise<Passage[]> {
  // Only use this for users with sufficient signals
  if (userSignals.signalCount < 10) {
    return getRandomCandidates(limit);
  }
  
  // Get 50% from taste vector neighbors
  const tasteNeighbors = await db.query(`
    SELECT * FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, [userSignals.tasteVector, Math.floor(limit * 0.5)]);
  
  // Get 50% from random sampling (for exploration)
  const randomCandidates = await getRandomCandidates(Math.ceil(limit * 0.5));
  
  return [...tasteNeighbors, ...randomCandidates];
}
```

**Prerequisites:**
- Embeddings must be complete for all passages
- pgvector index (IVFFlat or HNSW) must be built
- User must have sufficient likes to build a taste vector

**Risks:**
- ANN search on 10M vectors can be slow without proper indexing
- May create filter bubbles (mitigated by mixing with random candidates)

**When to implement:** After embeddings are complete AND you have users with 20+ signals.

**Effort:** M (1 week)

---

### Additional Deferred Improvements

| Improvement | Why Defer | Trigger to Start |
|-------------|-----------|------------------|
| **Type-aware tiering** (separate cutoffs per content type) | May not be needed; check tier composition first | If quotes dominate S-tier unfairly |
| **MMR diversity selection** (embedding-based diversity) | Current diversity rules probably sufficient | If users complain about repetitiveness |
| **Open Syllabus signal** (course adoption counts) | Useful but not critical | If you want "academic cred" signal |
| **OpenAlex citations** (scholarly attention) | Noisy signal; citations != quality | If you want author prestige signal |
| **Wikimedia pageviews** (popularity proxy) | Popularity != quality; use only for exploration | If exploration feels too random |
| **Multi-modal taste vectors** (per-category, recency-weighted) | Classic over-engineering; single vector works fine | If you have data showing single vector fails |

---

*Document maintained by the Doomscrolls development team.*
*v6 created January 17, 2026*
