import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';
import { optionalAuth, requireAuth, getCurrentUser } from '../middleware/auth';

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

// GET /api/works/:slug/read - Get work for reading mode
works.get('/:slug/read', optionalAuth, async (c) => {
  const slug = c.req.param('slug');
  const currentUser = getCurrentUser(c);

  const [work] = await sql`
    SELECT w.*, a.name as author_name, a.slug as author_slug
    FROM works w
    JOIN authors a ON w.author_id = a.id
    WHERE w.slug = ${slug}
  `;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  // Get total chunks for this work
  const [countResult] = await sql`
    SELECT COUNT(*) as total FROM chunks WHERE work_id = ${work.id}
  `;
  const totalChunks = parseInt(countResult.total);

  // Get user's reading progress if logged in
  let userProgress = null;
  if (currentUser) {
    const [progress] = await sql`
      SELECT current_chunk_index, total_chunks, last_read_at, completed_at
      FROM reading_progress
      WHERE user_id = ${currentUser.userId} AND work_id = ${work.id}
    `;

    if (progress) {
      userProgress = {
        currentIndex: progress.current_chunk_index,
        totalChunks: progress.total_chunks,
        lastReadAt: progress.last_read_at,
        completedAt: progress.completed_at,
        percentComplete: Math.round((progress.current_chunk_index / progress.total_chunks) * 100),
      };
    }
  }

  return c.json({
    work: {
      id: work.id,
      title: work.title,
      slug: work.slug,
      year: work.year,
      type: work.type,
      genre: work.genre,
      author: {
        name: work.author_name,
        slug: work.author_slug,
      },
    },
    totalChunks,
    userProgress,
  });
});

// GET /api/works/:slug/chunks - Get chunks for reading with pagination
works.get('/:slug/chunks', async (c) => {
  const slug = c.req.param('slug');
  const start = parseInt(c.req.query('start') || '0');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

  const [work] = await sql`SELECT id FROM works WHERE slug = ${slug}`;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  const chunks = await sql`
    SELECT id, text, type, position_index
    FROM chunks
    WHERE work_id = ${work.id}
    ORDER BY position_index ASC
    LIMIT ${limit} OFFSET ${start}
  `;

  const [countResult] = await sql`
    SELECT COUNT(*) as total FROM chunks WHERE work_id = ${work.id}
  `;
  const total = parseInt(countResult.total);

  return c.json({
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      type: chunk.type,
      index: chunk.position_index,
    })),
    total,
    hasMore: start + chunks.length < total,
    start,
    limit,
  });
});

// POST /api/works/:slug/progress - Update reading progress
works.post('/:slug/progress', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  const currentUser = getCurrentUser(c);

  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const body = await c.req.json();
  const { currentIndex } = body;

  if (typeof currentIndex !== 'number' || currentIndex < 0) {
    return c.json({ error: 'currentIndex must be a non-negative number' }, 400);
  }

  const [work] = await sql`SELECT id FROM works WHERE slug = ${slug}`;

  if (!work) {
    return c.json({ error: 'Work not found' }, 404);
  }

  // Get total chunks
  const [countResult] = await sql`
    SELECT COUNT(*) as total FROM chunks WHERE work_id = ${work.id}
  `;
  const totalChunks = parseInt(countResult.total);

  // Determine if completed
  const completedAt = currentIndex >= totalChunks - 1 ? new Date() : null;

  await sql`
    INSERT INTO reading_progress (user_id, work_id, current_chunk_index, total_chunks, completed_at)
    VALUES (${currentUser.userId}, ${work.id}, ${currentIndex}, ${totalChunks}, ${completedAt})
    ON CONFLICT (user_id, work_id) DO UPDATE SET
      current_chunk_index = ${currentIndex},
      total_chunks = ${totalChunks},
      last_read_at = NOW(),
      completed_at = COALESCE(reading_progress.completed_at, ${completedAt})
  `;

  return c.json({
    success: true,
    currentIndex,
    totalChunks,
    percentComplete: Math.round((currentIndex / totalChunks) * 100),
    completed: !!completedAt,
  });
});

export { works };
