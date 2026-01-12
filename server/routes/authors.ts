import { Hono } from 'hono';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';
import { optionalAuth, requireAuth, getCurrentUser } from '../middleware/auth';

const authors = new Hono();

// GET /api/authors?limit=20&offset=0
authors.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const results = await sql`
    SELECT id, name, slug, birth_year, death_year, nationality, era,
           work_count, chunk_count, primary_genre
    FROM authors
    WHERE chunk_count > 0
    ORDER BY chunk_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countResult] = await sql`SELECT COUNT(*) as total FROM authors WHERE chunk_count > 0`;

  return c.json({
    authors: results,
    total: parseInt(countResult.total),
    limit,
    offset
  });
});

// GET /api/authors/:slug
authors.get('/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug');
  const currentUser = getCurrentUser(c);

  const [author] = await sql`
    SELECT * FROM authors WHERE slug = ${slug}
  `;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  const works = await sql`
    SELECT id, title, slug, year, type, genre, chunk_count
    FROM works
    WHERE author_id = ${author.id}
    ORDER BY year ASC NULLS LAST
  `;

  // Get follower count
  const [followerCount] = await sql`
    SELECT COUNT(*) as count FROM user_follows WHERE author_id = ${author.id}
  `;

  // Check if current user is following
  let isFollowing = false;
  if (currentUser) {
    const [follow] = await sql`
      SELECT id FROM user_follows
      WHERE user_id = ${currentUser.userId} AND author_id = ${author.id}
    `;
    isFollowing = !!follow;
  }

  return c.json({
    ...author,
    works,
    followerCount: parseInt(followerCount.count),
    isFollowing,
  });
});

// POST /api/authors/:slug/follow - Follow an author
authors.post('/:slug/follow', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  const currentUser = getCurrentUser(c);

  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const [author] = await sql`SELECT id FROM authors WHERE slug = ${slug}`;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  await sql`
    INSERT INTO user_follows (user_id, author_id)
    VALUES (${currentUser.userId}, ${author.id})
    ON CONFLICT (user_id, author_id) DO NOTHING
  `;

  const [followerCount] = await sql`
    SELECT COUNT(*) as count FROM user_follows WHERE author_id = ${author.id}
  `;

  return c.json({
    success: true,
    isFollowing: true,
    followerCount: parseInt(followerCount.count),
  });
});

// DELETE /api/authors/:slug/follow - Unfollow an author
authors.delete('/:slug/follow', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  const currentUser = getCurrentUser(c);

  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const [author] = await sql`SELECT id FROM authors WHERE slug = ${slug}`;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  await sql`
    DELETE FROM user_follows
    WHERE user_id = ${currentUser.userId} AND author_id = ${author.id}
  `;

  const [followerCount] = await sql`
    SELECT COUNT(*) as count FROM user_follows WHERE author_id = ${author.id}
  `;

  return c.json({
    success: true,
    isFollowing: false,
    followerCount: parseInt(followerCount.count),
  });
});

// GET /api/authors/:slug/passages?limit=20&offset=0
authors.get('/:slug/passages', async (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const [author] = await sql`SELECT id, name FROM authors WHERE slug = ${slug}`;

  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  const passages = await sql`
    SELECT
      c.id, c.text, c.type,
      c.author_id, a.name as author_name, a.slug as author_slug,
      c.work_id, w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE c.author_id = ${author.id}
      AND c.char_count BETWEEN 50 AND 1000
    ORDER BY RANDOM()
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({
    passages: passages.map(formatPassage),
    author: { id: author.id, name: author.name, slug },
    limit,
    offset
  });
});

export { authors };
