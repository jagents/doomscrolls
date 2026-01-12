import { Hono } from 'hono';
import { generateFeed } from '../services/feed-algorithm';

const feed = new Hono();

// GET /api/feed?category=philosophy&limit=20&cursor=xxx
feed.get('/', async (c) => {
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const cursor = c.req.query('cursor') || null;

  const result = await generateFeed({
    category,
    limit,
    cursor,
  });

  return c.json(result);
});

export { feed };
