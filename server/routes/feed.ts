import { Hono } from 'hono';
import { generateFeed, generateFollowingFeed, generatePersonalizedFeed } from '../services/feed-algorithm';
import { optionalAuth, requireAuth, getCurrentUser } from '../middleware/auth';
import { sql } from '../db/client';
import { formatPassage } from '../services/formatters';

const feed = new Hono();

// GET /api/feed?category=philosophy&limit=20&cursor=xxx
feed.get('/', optionalAuth, async (c) => {
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const cursor = c.req.query('cursor') || null;
  const currentUser = getCurrentUser(c);

  // If user is logged in and has enough signals, use personalized feed
  if (currentUser) {
    const result = await generatePersonalizedFeed({
      userId: currentUser.userId,
      category,
      limit,
      cursor,
    });
    return c.json(result);
  }

  // Anonymous users get base feed
  const result = await generateFeed({
    category,
    limit,
    cursor,
  });

  return c.json(result);
});

// GET /api/feed/following - Feed from followed authors
feed.get('/following', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const cursor = c.req.query('cursor') || null;

  const result = await generateFollowingFeed({
    userId: currentUser.userId,
    limit,
    cursor,
  });

  return c.json(result);
});

// GET /api/feed/for-you - Explicitly personalized feed (for logged-in users)
feed.get('/for-you', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const cursor = c.req.query('cursor') || null;

  const result = await generatePersonalizedFeed({
    userId: currentUser.userId,
    limit,
    cursor,
  });

  return c.json(result);
});

export { feed };
