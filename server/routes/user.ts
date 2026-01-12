import { Hono } from 'hono';
import { sql } from '../db/client';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { formatPassage } from '../services/formatters';

const user = new Hono();

// All user routes require authentication
user.use('*', requireAuth);

// GET /api/user/likes - Get user's liked passages
user.get('/likes', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const likes = await sql`
    SELECT chunk_id, created_at as liked_at
    FROM user_likes
    WHERE user_id = ${currentUser.userId}
    ORDER BY created_at DESC
  `;

  return c.json({
    likes: likes.map((l) => ({
      chunkId: l.chunk_id,
      likedAt: l.liked_at,
    })),
  });
});

// POST /api/user/likes/sync - Sync local likes to server
user.post('/likes/sync', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const body = await c.req.json();
  const { chunkIds } = body;

  if (!Array.isArray(chunkIds)) {
    return c.json({ error: 'chunkIds must be an array' }, 400);
  }

  let synced = 0;

  for (const chunkId of chunkIds) {
    try {
      await sql`
        INSERT INTO user_likes (user_id, chunk_id)
        VALUES (${currentUser.userId}, ${chunkId})
        ON CONFLICT (user_id, chunk_id) DO NOTHING
      `;
      synced++;
    } catch (error) {
      // Ignore errors for individual items
    }
  }

  // Update user stats (ignore if table doesn't exist)
  try {
    await sql`
      UPDATE user_stats
      SET passages_liked = (
        SELECT COUNT(*) FROM user_likes WHERE user_id = ${currentUser.userId}
      ),
      updated_at = NOW()
      WHERE user_id = ${currentUser.userId}
    `;
  } catch (e) {
    // user_stats table may not exist
  }

  // Return all user's likes
  const allLikes = await sql`
    SELECT chunk_id, created_at as liked_at
    FROM user_likes
    WHERE user_id = ${currentUser.userId}
    ORDER BY created_at DESC
  `;

  return c.json({
    synced,
    likes: allLikes.map((l) => ({
      chunkId: l.chunk_id,
      likedAt: l.liked_at,
    })),
  });
});

// DELETE /api/user/likes/:chunkId - Unlike a passage
user.delete('/likes/:chunkId', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const chunkId = c.req.param('chunkId');

  await sql`
    DELETE FROM user_likes
    WHERE user_id = ${currentUser.userId} AND chunk_id = ${chunkId}
  `;

  return c.json({ success: true });
});

// GET /api/user/bookmarks - Get user's bookmarked passages
user.get('/bookmarks', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const bookmarks = await sql`
    SELECT chunk_id, created_at as bookmarked_at
    FROM user_bookmarks
    WHERE user_id = ${currentUser.userId}
    ORDER BY created_at DESC
  `;

  return c.json({
    bookmarks: bookmarks.map((b) => ({
      chunkId: b.chunk_id,
      bookmarkedAt: b.bookmarked_at,
    })),
  });
});

// POST /api/user/bookmarks/sync - Sync local bookmarks to server
user.post('/bookmarks/sync', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const body = await c.req.json();
  const { chunkIds } = body;

  if (!Array.isArray(chunkIds)) {
    return c.json({ error: 'chunkIds must be an array' }, 400);
  }

  let synced = 0;

  for (const chunkId of chunkIds) {
    try {
      await sql`
        INSERT INTO user_bookmarks (user_id, chunk_id)
        VALUES (${currentUser.userId}, ${chunkId})
        ON CONFLICT (user_id, chunk_id) DO NOTHING
      `;
      synced++;
    } catch (error) {
      // Ignore errors for individual items
    }
  }

  // Update user stats (ignore if table doesn't exist)
  try {
    await sql`
      UPDATE user_stats
      SET passages_bookmarked = (
        SELECT COUNT(*) FROM user_bookmarks WHERE user_id = ${currentUser.userId}
      ),
      updated_at = NOW()
      WHERE user_id = ${currentUser.userId}
    `;
  } catch (e) {
    // user_stats table may not exist
  }

  // Return all user's bookmarks
  const allBookmarks = await sql`
    SELECT chunk_id, created_at as bookmarked_at
    FROM user_bookmarks
    WHERE user_id = ${currentUser.userId}
    ORDER BY created_at DESC
  `;

  return c.json({
    synced,
    bookmarks: allBookmarks.map((b) => ({
      chunkId: b.chunk_id,
      bookmarkedAt: b.bookmarked_at,
    })),
  });
});

// DELETE /api/user/bookmarks/:chunkId - Remove bookmark
user.delete('/bookmarks/:chunkId', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const chunkId = c.req.param('chunkId');

  await sql`
    DELETE FROM user_bookmarks
    WHERE user_id = ${currentUser.userId} AND chunk_id = ${chunkId}
  `;

  return c.json({ success: true });
});

// GET /api/user/following - Get followed authors
user.get('/following', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const following = await sql`
    SELECT
      a.id, a.name, a.slug, a.era, a.primary_genre, a.chunk_count,
      a.bio, a.image_url,
      uf.created_at as followed_at
    FROM user_follows uf
    JOIN authors a ON uf.author_id = a.id
    WHERE uf.user_id = ${currentUser.userId}
    ORDER BY uf.created_at DESC
  `;

  return c.json({
    authors: following,
    total: following.length,
  });
});

// GET /api/user/stats - Get reading statistics
user.get('/stats', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const [stats] = await sql`
    SELECT * FROM user_stats WHERE user_id = ${currentUser.userId}
  `;

  // Get additional computed stats
  const [likeCount] = await sql`
    SELECT COUNT(*) as count FROM user_likes WHERE user_id = ${currentUser.userId}
  `;

  const [bookmarkCount] = await sql`
    SELECT COUNT(*) as count FROM user_bookmarks WHERE user_id = ${currentUser.userId}
  `;

  const [followCount] = await sql`
    SELECT COUNT(*) as count FROM user_follows WHERE user_id = ${currentUser.userId}
  `;

  const [readingCount] = await sql`
    SELECT COUNT(*) as count FROM reading_progress WHERE user_id = ${currentUser.userId}
  `;

  return c.json({
    stats: {
      passagesLiked: parseInt(likeCount.count),
      passagesBookmarked: parseInt(bookmarkCount.count),
      authorsFollowed: parseInt(followCount.count),
      worksInProgress: parseInt(readingCount.count),
      ...stats,
    },
  });
});

// GET /api/user/reading - Get works in progress
user.get('/reading', async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const reading = await sql`
    SELECT
      rp.*,
      w.title as work_title, w.slug as work_slug,
      a.name as author_name, a.slug as author_slug
    FROM reading_progress rp
    JOIN works w ON rp.work_id = w.id
    JOIN authors a ON w.author_id = a.id
    WHERE rp.user_id = ${currentUser.userId}
    ORDER BY rp.last_read_at DESC
  `;

  return c.json({
    reading: reading.map((r) => ({
      workId: r.work_id,
      workTitle: r.work_title,
      workSlug: r.work_slug,
      authorName: r.author_name,
      authorSlug: r.author_slug,
      currentChunkIndex: r.current_chunk_index,
      totalChunks: r.total_chunks,
      percentComplete: Math.round((r.current_chunk_index / r.total_chunks) * 100),
      lastReadAt: r.last_read_at,
      completedAt: r.completed_at,
    })),
  });
});

export { user };
