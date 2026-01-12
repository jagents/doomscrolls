import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';

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

export { passages };
