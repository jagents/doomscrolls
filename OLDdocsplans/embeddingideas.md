# Doomscrolls Embedding Strategy

**Created:** January 12, 2026
**Status:** Planning (Parallel Workstream)
**Dependency:** Can run independently of Phase 2 auth/lists work

---

## 1. What Embeddings Enable

### Use Cases

| Use Case | Description | Priority |
|----------|-------------|----------|
| **Semantic Search** | Find passages by meaning, not just keywords. "passages about facing death" finds content without literal word match | High |
| **"More Like This"** | Given a liked passage, find semantically similar ones | High |
| **Personalization Input** | User's liked passages create a "taste vector" - find content close to it | High |
| **Author Similarity** | "Authors similar to Marcus Aurelius" based on writing style/themes | Medium |
| **Work Similarity** | "Books like Meditations" for recommendations | Medium |
| **Duplicate Detection** | Find near-duplicate passages across different sources | Low |
| **Clustering/Topics** | Auto-discover themes across the corpus | Low |

### How Embeddings Improve the Algorithm

```
Current Phase 1 Algorithm:
┌─────────────────────────────────────────┐
│ Random selection + diversity filters    │
│ (No understanding of content meaning)   │
└─────────────────────────────────────────┘

With Embeddings:
┌─────────────────────────────────────────┐
│ 1. User likes passages A, B, C          │
│ 2. Compute centroid of A, B, C vectors  │
│ 3. Find passages near centroid          │
│ 4. Blend: 70% similar + 30% exploration │
└─────────────────────────────────────────┘
```

---

## 2. What to Embed

### Entity Types

| Entity | Count | Embed? | Notes |
|--------|-------|--------|-------|
| **Chunks (Passages)** | 10.3M | Yes (prioritized) | Core content - embed all |
| **Works** | 17K | Yes | Aggregate or use title+description |
| **Authors** | 7.6K | Yes | Aggregate from works or use bio |

### Chunk Embedding Strategy

Each passage gets its own embedding vector:
```
chunk_id: "abc123"
text: "The happiness of your life depends upon the quality of your thoughts."
embedding: [0.023, -0.041, 0.089, ...] (1536 dimensions)
```

### Work Embedding Strategy

Option A: **Aggregate from chunks**
- Average all chunk embeddings for that work
- Pros: Captures full content
- Cons: Expensive to compute, may blur distinct themes

Option B: **Title + Description**
- Embed: "{title} by {author}. {description}"
- Pros: Fast, captures essence
- Cons: Missing nuance

**Recommendation:** Start with Option B, upgrade to A later if needed.

### Author Embedding Strategy

Option A: **Aggregate from works**
- Average all work embeddings
- Represents author's overall style/themes

Option B: **Bio-based**
- Embed the AI-generated bio
- Captures what author is known for

**Recommendation:** Use bio-based (Option B) once bios are generated.

---

## 3. Embedding Model Options

### Comparison

| Model | Dimensions | Cost per 1M tokens | Quality | Speed |
|-------|------------|-------------------|---------|-------|
| OpenAI text-embedding-3-small | 1536 | $0.02 | Good | Fast |
| OpenAI text-embedding-3-large | 3072 | $0.13 | Excellent | Fast |
| Voyage AI voyage-2 | 1024 | $0.10 | Excellent for retrieval | Fast |
| Cohere embed-english-v3.0 | 1024 | $0.10 | Good | Fast |
| all-MiniLM-L6-v2 (local) | 384 | Free | Decent | Slower |

### Recommendation

**Primary:** `text-embedding-3-small` (OpenAI)
- Best cost/quality ratio
- 1536 dimensions is standard
- Can reduce to 512 or 256 dimensions if storage is concern
- Well-documented, reliable API

**Cost Estimate for 10.3M chunks:**
- Average chunk: ~100 tokens
- Total: ~1B tokens
- Cost: ~$20 one-time embedding generation

---

## 4. Storage Options

### Option A: pgvector (PostgreSQL Extension)

**Pros:**
- Keep everything in one database (Neon supports pgvector)
- No additional infrastructure
- Familiar SQL queries
- Transactional consistency

**Cons:**
- Slower than dedicated vector DBs at scale
- Limited to ~1M vectors for good performance without tuning

**Setup:**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add column to chunks
ALTER TABLE chunks ADD COLUMN embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);  -- Tune based on data size
```

**Query Example:**
```sql
-- Find 10 most similar passages to a given embedding
SELECT id, text, 1 - (embedding <=> $1) as similarity
FROM chunks
ORDER BY embedding <=> $1
LIMIT 10;
```

### Option B: Dedicated Vector Database (Pinecone/Qdrant)

**Pros:**
- Built for vector search at scale
- Faster queries
- Better filtering capabilities
- Managed infrastructure (Pinecone)

**Cons:**
- Additional service to manage
- Data sync complexity
- Extra cost

### Recommendation

**Start with pgvector** (Neon supports it)
- Simpler architecture
- Good enough for 10M vectors with proper indexing
- Can migrate to dedicated vector DB later if needed

---

## 5. Database Schema for Embeddings

```sql
-- =============================================================================
-- EMBEDDING SCHEMA (pgvector)
-- =============================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Chunk embeddings (main table modification)
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- Work embeddings (separate table for flexibility)
CREATE TABLE work_embeddings (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Author embeddings
CREATE TABLE author_embeddings (
  author_id TEXT PRIMARY KEY REFERENCES authors(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User taste vectors (computed from liked passages)
CREATE TABLE user_taste_vectors (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  taste_vector vector(1536) NOT NULL,
  based_on_count INTEGER NOT NULL,  -- Number of likes used to compute
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for similarity search
CREATE INDEX idx_chunks_embedding ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);

CREATE INDEX idx_work_embeddings ON work_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_author_embeddings ON author_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## 6. Embedding Generation Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Chunks     │────▶│   Batching   │────▶│   OpenAI     │    │
│  │  (10.3M)     │     │  (100/batch) │     │   API        │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│                                                    │             │
│                                                    ▼             │
│                                            ┌──────────────┐     │
│                                            │   Store in   │     │
│                                            │   pgvector   │     │
│                                            └──────────────┘     │
│                                                                  │
│  Rate Limiting: 3000 RPM (OpenAI), ~50 chunks/second            │
│  Estimated Time: 10.3M / 50 = ~57 hours                         │
│  Can parallelize with multiple API keys                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Batch Processing Script

```typescript
// scripts/generate-embeddings.ts

import OpenAI from 'openai';
import { sql } from '../server/db/client';

const openai = new OpenAI();
const BATCH_SIZE = 100;
const MODEL = 'text-embedding-3-small';

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

async function processChunks() {
  // Get chunks without embeddings
  const chunks = await sql`
    SELECT id, text FROM chunks
    WHERE embedding IS NULL
    ORDER BY id
    LIMIT 10000
  `;

  console.log(`Processing ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    try {
      const embeddings = await embedBatch(texts);

      // Store embeddings
      for (let j = 0; j < batch.length; j++) {
        await sql`
          UPDATE chunks
          SET embedding = ${JSON.stringify(embeddings[j])}::vector,
              embedding_model = ${MODEL},
              embedded_at = NOW()
          WHERE id = ${batch[j].id}
        `;
      }

      console.log(`Processed ${i + batch.length}/${chunks.length}`);

      // Rate limit: ~50/sec to stay under 3000 RPM
      await sleep(2000);
    } catch (error) {
      console.error(`Batch ${i} failed:`, error);
      // Retry logic here
    }
  }
}

// Run with: npx tsx scripts/generate-embeddings.ts
processChunks();
```

### Prioritization Strategy

Generate embeddings in this order:
1. **Curated works chunks first** (~500K) - used in Phase 1 feed
2. **Most liked chunks** - high engagement content
3. **Works with most readers** - popular content
4. **Remaining chunks** - background job

---

## 7. API Endpoints Using Embeddings

### Semantic Search

```typescript
// GET /api/search/semantic?q=facing mortality with courage

async function semanticSearch(query: string, limit: number = 20) {
  // 1. Embed the query
  const queryEmbedding = await embedText(query);

  // 2. Find similar chunks
  const results = await sql`
    SELECT
      c.id, c.text,
      a.name as author_name, a.slug as author_slug,
      w.title as work_title, w.slug as work_slug,
      1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `;

  return results;
}
```

### "More Like This"

```typescript
// GET /api/passages/:id/similar

async function findSimilar(chunkId: string, limit: number = 10) {
  // Get the chunk's embedding
  const [chunk] = await sql`
    SELECT embedding FROM chunks WHERE id = ${chunkId}
  `;

  if (!chunk?.embedding) {
    throw new Error('Chunk has no embedding');
  }

  // Find similar, excluding the original
  const similar = await sql`
    SELECT
      c.id, c.text,
      a.name as author_name,
      w.title as work_title,
      1 - (c.embedding <=> ${chunk.embedding}) as similarity
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id != ${chunkId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${chunk.embedding}
    LIMIT ${limit}
  `;

  return similar;
}
```

### Personalized Feed (Embedding-Enhanced)

```typescript
// Enhanced feed algorithm using user taste vector

async function getPersonalizedFeed(userId: string, limit: number = 20) {
  // 1. Get or compute user's taste vector
  const tasteVector = await getUserTasteVector(userId);

  if (!tasteVector) {
    // Fall back to non-personalized feed
    return getBaseFeed(limit);
  }

  // 2. Find chunks similar to taste vector, with diversity
  const results = await sql`
    WITH candidates AS (
      SELECT
        c.*,
        a.name as author_name, a.slug as author_slug,
        w.title as work_title, w.slug as work_slug,
        1 - (c.embedding <=> ${tasteVector}::vector) as similarity,
        ROW_NUMBER() OVER (PARTITION BY c.author_id ORDER BY RANDOM()) as author_rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      WHERE c.embedding IS NOT NULL
        AND LENGTH(c.text) BETWEEN 50 AND 1000
    )
    SELECT * FROM candidates
    WHERE author_rank <= 2  -- Max 2 per author for diversity
    ORDER BY similarity DESC
    LIMIT ${limit}
  `;

  return results;
}

async function getUserTasteVector(userId: string): Promise<number[] | null> {
  // Check cache
  const [cached] = await sql`
    SELECT taste_vector FROM user_taste_vectors WHERE user_id = ${userId}
  `;

  if (cached) {
    return cached.taste_vector;
  }

  // Compute from liked passages
  const liked = await sql`
    SELECT c.embedding
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    WHERE ul.user_id = ${userId}
      AND c.embedding IS NOT NULL
    LIMIT 100
  `;

  if (liked.length < 5) {
    return null; // Not enough data
  }

  // Average the embeddings (centroid)
  const centroid = averageVectors(liked.map(l => l.embedding));

  // Cache it
  await sql`
    INSERT INTO user_taste_vectors (user_id, taste_vector, based_on_count)
    VALUES (${userId}, ${JSON.stringify(centroid)}::vector, ${liked.length})
    ON CONFLICT (user_id) DO UPDATE SET
      taste_vector = ${JSON.stringify(centroid)}::vector,
      based_on_count = ${liked.length},
      updated_at = NOW()
  `;

  return centroid;
}
```

---

## 8. Frontend Integration

### "More Like This" Button

```tsx
// Add to PassageCard actions
<button onClick={() => openSimilarModal(passage.id)}>
  <Sparkles className="w-4 h-4" />
  More like this
</button>

// SimilarPassagesModal
function SimilarPassagesModal({ chunkId, onClose }) {
  const { data: similar } = useQuery(['similar', chunkId], () =>
    api.getSimilarPassages(chunkId)
  );

  return (
    <Modal onClose={onClose}>
      <h2>Similar Passages</h2>
      {similar?.map(passage => (
        <PassageCard key={passage.id} passage={passage} />
      ))}
    </Modal>
  );
}
```

### Semantic Search Toggle

```tsx
// SearchBar with semantic toggle
function SearchBar() {
  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState(true);

  const search = () => {
    if (semantic) {
      navigate(`/search?q=${query}&mode=semantic`);
    } else {
      navigate(`/search?q=${query}&mode=keyword`);
    }
  };

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <label>
        <input type="checkbox" checked={semantic} onChange={e => setSemantic(e.target.checked)} />
        Semantic search
      </label>
    </div>
  );
}
```

---

## 9. Implementation Steps

### Phase A: Infrastructure (Day 1-2)

- [ ] Enable pgvector extension on Neon
- [ ] Add embedding columns to schema
- [ ] Create indexes
- [ ] Test with small batch

### Phase B: Batch Generation (Day 3-7)

- [ ] Write embedding generation script
- [ ] Process curated works chunks first (~500K)
- [ ] Monitor costs and rate limits
- [ ] Run background job for remaining chunks

### Phase C: Search Integration (Day 8-9)

- [ ] Create semantic search endpoint
- [ ] Add to existing search (keyword + semantic hybrid)
- [ ] Frontend toggle for search mode

### Phase D: Similarity Features (Day 10-11)

- [ ] Create "similar passages" endpoint
- [ ] Add "More like this" to PassageCard
- [ ] Build similar passages modal

### Phase E: Personalization Integration (Day 12-14)

- [ ] Create user taste vector computation
- [ ] Integrate into feed algorithm
- [ ] Add embedding weight to admin config
- [ ] Test with real user data

---

## 10. Cost & Performance Estimates

### One-Time Embedding Costs

| Content | Count | Tokens | Cost |
|---------|-------|--------|------|
| Chunks | 10.3M | ~1B | $20 |
| Works | 17K | ~1.7M | $0.03 |
| Authors | 7.6K | ~760K | $0.02 |
| **Total** | | | **~$20** |

### Ongoing Costs

| Operation | Frequency | Cost |
|-----------|-----------|------|
| New chunk embeddings | Rare (corpus stable) | Negligible |
| Query embeddings | Per search | ~$0.0001/search |
| Taste vector updates | Per user/day | ~$0.0001/user |

### Performance

| Operation | Expected Latency |
|-----------|------------------|
| Semantic search (10M vectors) | 50-200ms with ivfflat index |
| Similar passages | 20-50ms |
| Taste vector computation | 100-300ms |

---

## 11. Future Enhancements

### Hybrid Search

Combine keyword (BM25) + semantic for best results:
```sql
-- Reciprocal Rank Fusion
WITH keyword_results AS (
  SELECT id, ts_rank(search_vector, query) as score
  FROM chunks, plainto_tsquery($1) query
  WHERE search_vector @@ query
  LIMIT 100
),
semantic_results AS (
  SELECT id, 1 - (embedding <=> $2::vector) as score
  FROM chunks
  ORDER BY embedding <=> $2::vector
  LIMIT 100
),
combined AS (
  SELECT id,
    COALESCE(k.score, 0) * 0.3 + COALESCE(s.score, 0) * 0.7 as final_score
  FROM keyword_results k
  FULL OUTER JOIN semantic_results s USING (id)
)
SELECT * FROM combined ORDER BY final_score DESC LIMIT 20;
```

### Clustering for Discovery

Use embeddings to auto-discover themes:
- K-means clustering on chunk embeddings
- Label clusters with most representative passages
- Create "Explore by Theme" feature

### Cross-Lingual Search

If corpus expands to multiple languages:
- Use multilingual embedding model
- Search in English, find passages in any language

---

*End of Embedding Strategy Document*
