import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';
import { optionalAuth, getCurrentUser } from '../middleware/auth';

const passages = new Hono();

// GET /api/passages/:id
passages.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [passage] = await sql`
    SELECT
      c.id, c.text, c.type, c.char_count, c.word_count,
      c.author_id, a.name as author_name, a.slug as author_slug,
      c.work_id, w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.id = ${id}
  `;

  if (!passage) {
    return c.json({ error: 'Passage not found' }, 404);
  }

  return c.json(formatPassage(passage));
});

// POST /api/passages/:id/like
passages.post('/:id/like', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const increment = body.increment;

  // Verify chunk exists
  const [chunk] = await sql`SELECT id FROM chunks WHERE id = ${id}`;
  if (!chunk) {
    return c.json({ error: 'Passage not found' }, 404);
  }

  if (increment) {
    await sql`
      INSERT INTO chunk_stats (chunk_id, like_count)
      VALUES (${id}, 1)
      ON CONFLICT (chunk_id)
      DO UPDATE SET like_count = chunk_stats.like_count + 1, updated_at = NOW()
    `;
  } else {
    await sql`
      UPDATE chunk_stats
      SET like_count = GREATEST(0, like_count - 1), updated_at = NOW()
      WHERE chunk_id = ${id}
    `;
  }

  const [stats] = await sql`
    SELECT like_count FROM chunk_stats WHERE chunk_id = ${id}
  `;

  return c.json({ like_count: parseInt(stats?.like_count) || 0 });
});

// GET /api/passages/:id/similar - Find similar passages
passages.get('/:id/similar', async (c) => {
  const id = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 20);

  // Get the source passage
  const [source] = await sql`
    SELECT c.id, c.text, c.author_id, c.work_id, c.embedding,
           a.name as author_name, a.slug as author_slug,
           w.title as work_title, w.slug as work_slug
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE c.id = ${id}
  `;

  if (!source) {
    return c.json({ error: 'Passage not found' }, 404);
  }

  let similar;
  let method: 'embedding' | 'fallback' = 'fallback';

  // Try embedding-based similarity if available
  if (source.embedding) {
    try {
      similar = await sql`
        SELECT
          c.id, c.text, c.type,
          a.id as author_id, a.name as author_name, a.slug as author_slug,
          w.id as work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count,
          1 - (c.embedding <=> ${source.embedding}) as similarity
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE c.id != ${id}
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${source.embedding}
        LIMIT ${limit}
      `;
      method = 'embedding';
    } catch (error) {
      // Fallback if embedding query fails
      console.error('Embedding similarity failed:', error);
    }
  }

  // Fallback: same author or work
  if (!similar || similar.length === 0) {
    similar = await sql`
      SELECT
        c.id, c.text, c.type,
        a.id as author_id, a.name as author_name, a.slug as author_slug,
        w.id as work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        0.5 as similarity
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      WHERE c.id != ${id}
        AND (c.author_id = ${source.author_id} OR c.work_id = ${source.work_id})
        AND LENGTH(c.text) BETWEEN 50 AND 1000
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    method = 'fallback';
  }

  // Check if embeddings are available in general
  const [embeddingCheck] = await sql`
    SELECT EXISTS(SELECT 1 FROM chunks WHERE embedding IS NOT NULL LIMIT 1) as available
  `;

  return c.json({
    passage: {
      id: source.id,
      text: source.text,
      author: { name: source.author_name, slug: source.author_slug },
      work: source.work_title ? { title: source.work_title, slug: source.work_slug } : null,
    },
    similar: similar.map((p: any) => ({
      ...formatPassage(p),
      similarity: parseFloat(p.similarity).toFixed(3),
    })),
    method,
    embeddingsAvailable: embeddingCheck.available,
  });
});

export { passages };
