import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';

const works = new Hono();

// GET /api/works/:slug
works.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [work] = await sql`
    SELECT w.*, a.name as author_name, a.slug as author_slug
    FROM works w
    JOIN authors a ON w.author_id = a.id
    WHERE w.slug = ${slug}
  `;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  return c.json(work);
});

// GET /api/works/:slug/passages?limit=20&offset=0
works.get('/:slug/passages', async (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const [work] = await sql`SELECT id, title FROM works WHERE slug = ${slug}`;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  const passages = await sql`
    SELECT
      c.id, c.text, c.type, c.position_index,
      c.author_id, a.name as author_name, a.slug as author_slug,
      c.work_id, w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.work_id = ${work.id}
    ORDER BY c.position_index ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countResult] = await sql`SELECT COUNT(*) as total FROM chunks WHERE work_id = ${work.id}`;

  return c.json({
    passages: passages.map(formatPassage),
    work: { id: work.id, title: work.title, slug },
    total: parseInt(countResult.total),
    limit,
    offset
  });
});

export { works };
