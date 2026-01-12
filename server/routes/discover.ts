import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';

const discover = new Hono();

// GET /api/discover/authors - Featured authors
discover.get('/authors', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

  const authors = await sql`
    SELECT id, name, slug, era, primary_genre, chunk_count
    FROM authors
    WHERE chunk_count > 100
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return c.json({ authors });
});

// GET /api/discover/popular - Most liked passages
discover.get('/popular', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

  const passages = await sql`
    SELECT
      c.id, c.text, c.type,
      c.author_id, a.name as author_name, a.slug as author_slug,
      c.work_id, w.title as work_title, w.slug as work_slug,
      cs.like_count
    FROM chunk_stats cs
    JOIN chunks c ON cs.chunk_id = c.id
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    WHERE cs.like_count > 0
    ORDER BY cs.like_count DESC
    LIMIT ${limit}
  `;

  return c.json({ passages: passages.map(formatPassage) });
});

// GET /api/discover/works - Featured works
discover.get('/works', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '5'), 20);

  // Check if we have curated works
  const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
  const hasCuratedWorks = parseInt(curatedCount.count) > 0;

  let works;
  if (hasCuratedWorks) {
    works = await sql`
      SELECT w.id, w.title, w.slug, w.year, w.type, w.chunk_count,
             a.name as author_name, a.slug as author_slug
      FROM works w
      JOIN curated_works cw ON w.id = cw.work_id
      JOIN authors a ON w.author_id = a.id
      ORDER BY cw.priority DESC, RANDOM()
      LIMIT ${limit}
    `;
  } else {
    works = await sql`
      SELECT w.id, w.title, w.slug, w.year, w.type, w.chunk_count,
             a.name as author_name, a.slug as author_slug
      FROM works w
      JOIN authors a ON w.author_id = a.id
      WHERE w.chunk_count > 50
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
  }

  return c.json({ works });
});

export { discover };
