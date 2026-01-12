import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';

const search = new Hono();

// Cache for embeddings availability check
let embeddingsAvailableCache: { value: boolean; timestamp: number } | null = null;

async function checkEmbeddingsAvailable(): Promise<boolean> {
  const now = Date.now();
  // Cache for 5 minutes
  if (embeddingsAvailableCache && now - embeddingsAvailableCache.timestamp < 300000) {
    return embeddingsAvailableCache.value;
  }

  try {
    const [result] = await sql`
      SELECT EXISTS(
        SELECT 1 FROM chunks WHERE embedding IS NOT NULL LIMIT 1
      ) as has_embeddings
    `;
    embeddingsAvailableCache = { value: result.has_embeddings, timestamp: now };
    return result.has_embeddings;
  } catch {
    embeddingsAvailableCache = { value: false, timestamp: now };
    return false;
  }
}

// GET /api/search - Unified search across all entities
search.get('/', async (c) => {
  const query = c.req.query('q');
  const mode = c.req.query('mode') || 'hybrid'; // keyword, semantic, hybrid
  const types = c.req.query('type')?.split(',') || ['authors', 'works', 'passages'];
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }

  const startTime = Date.now();
  const embeddingsAvailable = await checkEmbeddingsAvailable();

  // Determine actual mode based on embeddings availability
  let actualMode = mode;
  if (mode === 'semantic' && !embeddingsAvailable) {
    actualMode = 'keyword';
  }
  if (mode === 'hybrid' && !embeddingsAvailable) {
    actualMode = 'keyword';
  }

  const results: {
    authors: any[];
    works: any[];
    passages: any[];
  } = {
    authors: [],
    works: [],
    passages: [],
  };

  // Search authors
  if (types.includes('authors')) {
    const authors = await sql`
      SELECT
        id, name, slug, era, primary_genre, chunk_count,
        ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
      FROM authors
      WHERE search_vector @@ plainto_tsquery('english', ${query})
         OR name ILIKE ${'%' + query + '%'}
      ORDER BY rank DESC, chunk_count DESC
      LIMIT ${limit}
    `;

    results.authors = authors.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      era: a.era,
      primaryGenre: a.primary_genre,
      chunkCount: a.chunk_count,
      score: a.rank,
    }));
  }

  // Search works
  if (types.includes('works')) {
    const works = await sql`
      SELECT
        w.id, w.title, w.slug, w.year, w.type,
        a.name as author_name, a.slug as author_slug,
        ts_rank(w.search_vector, plainto_tsquery('english', ${query})) as rank
      FROM works w
      JOIN authors a ON w.author_id = a.id
      WHERE w.search_vector @@ plainto_tsquery('english', ${query})
         OR w.title ILIKE ${'%' + query + '%'}
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    results.works = works.map((w) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      year: w.year,
      type: w.type,
      authorName: w.author_name,
      authorSlug: w.author_slug,
      score: w.rank,
    }));
  }

  // Search passages
  if (types.includes('passages')) {
    if (actualMode === 'keyword') {
      // Keyword-only search
      const passages = await sql`
        SELECT
          c.id, c.text, c.type,
          a.id as author_id, a.name as author_name, a.slug as author_slug,
          w.id as work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count,
          ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE c.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;

      results.passages = passages.map((p) => ({
        ...formatPassage(p),
        score: p.rank,
      }));
    } else {
      // Hybrid search (keyword + semantic) when embeddings available
      // For now, use keyword search until we have query embedding capability
      // TODO: Add semantic search when OpenAI embedding API is integrated
      const passages = await sql`
        SELECT
          c.id, c.text, c.type,
          a.id as author_id, a.name as author_name, a.slug as author_slug,
          w.id as work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count,
          ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE c.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;

      results.passages = passages.map((p) => ({
        ...formatPassage(p),
        score: p.rank,
      }));
    }
  }

  const searchTime = Date.now() - startTime;

  return c.json({
    query,
    mode: actualMode,
    embeddingsAvailable,
    results,
    totalResults:
      results.authors.length + results.works.length + results.passages.length,
    searchTime,
  });
});

// GET /api/search/passages - Search passages only with more options
search.get('/passages', async (c) => {
  const query = c.req.query('q');
  const authorSlug = c.req.query('author');
  const workSlug = c.req.query('work');
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }

  let passages;

  if (authorSlug) {
    // Search within author
    passages = await sql`
      SELECT
        c.id, c.text, c.type,
        a.id as author_id, a.name as author_name, a.slug as author_slug,
        w.id as work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      WHERE a.slug = ${authorSlug}
        AND c.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (workSlug) {
    // Search within work
    passages = await sql`
      SELECT
        c.id, c.text, c.type,
        a.id as author_id, a.name as author_name, a.slug as author_slug,
        w.id as work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      WHERE w.slug = ${workSlug}
        AND c.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (category) {
    // Search within category
    passages = await sql`
      SELECT
        c.id, c.text, c.type,
        a.id as author_id, a.name as author_name, a.slug as author_slug,
        w.id as work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      JOIN work_categories wc ON c.work_id = wc.work_id
      JOIN categories cat ON wc.category_id = cat.id
      WHERE cat.slug = ${category}
        AND c.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    // Global search
    passages = await sql`
      SELECT
        c.id, c.text, c.type,
        a.id as author_id, a.name as author_name, a.slug as author_slug,
        w.id as work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ts_rank(c.search_vector, plainto_tsquery('english', ${query})) as rank
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      WHERE c.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  return c.json({
    query,
    passages: passages.map((p) => ({
      ...formatPassage(p),
      score: p.rank,
    })),
    limit,
    offset,
  });
});

// GET /api/search/authors - Search authors only
search.get('/authors', async (c) => {
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }

  const authors = await sql`
    SELECT
      id, name, slug, era, primary_genre, chunk_count, bio, image_url,
      ts_rank(search_vector, plainto_tsquery('english', ${query})) as rank
    FROM authors
    WHERE search_vector @@ plainto_tsquery('english', ${query})
       OR name ILIKE ${'%' + query + '%'}
    ORDER BY rank DESC, chunk_count DESC
    LIMIT ${limit}
  `;

  return c.json({
    query,
    authors: authors.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      era: a.era,
      primaryGenre: a.primary_genre,
      chunkCount: a.chunk_count,
      bio: a.bio,
      imageUrl: a.image_url,
      score: a.rank,
    })),
  });
});

// GET /api/search/works - Search works only
search.get('/works', async (c) => {
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!query || query.trim().length < 2) {
    return c.json({ error: 'Query must be at least 2 characters' }, 400);
  }

  const works = await sql`
    SELECT
      w.id, w.title, w.slug, w.year, w.type, w.genre, w.chunk_count,
      a.name as author_name, a.slug as author_slug,
      ts_rank(w.search_vector, plainto_tsquery('english', ${query})) as rank
    FROM works w
    JOIN authors a ON w.author_id = a.id
    WHERE w.search_vector @@ plainto_tsquery('english', ${query})
       OR w.title ILIKE ${'%' + query + '%'}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return c.json({
    query,
    works: works.map((w) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      year: w.year,
      type: w.type,
      genre: w.genre,
      chunkCount: w.chunk_count,
      authorName: w.author_name,
      authorSlug: w.author_slug,
      score: w.rank,
    })),
  });
});

export { search };
