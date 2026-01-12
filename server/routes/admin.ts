import { Hono } from 'hono';
import { getDatasetStats, getFeedStats } from '../services/admin-stats';
import { getFeedConfig, updateFeedConfig } from '../services/config';

const admin = new Hono();

// GET /api/admin/stats - Combined dataset and feed statistics
admin.get('/stats', async (c) => {
  const [dataset, feed] = await Promise.all([
    getDatasetStats(),
    getFeedStats()
  ]);

  return c.json({
    dataset,
    feed,
    timestamp: new Date().toISOString()
  });
});

// GET /api/admin/config - Current algorithm configuration
admin.get('/config', async (c) => {
  const config = await getFeedConfig();
  return c.json({ config });
});

// PUT /api/admin/config - Update algorithm configuration
admin.put('/config', async (c) => {
  const body = await c.req.json();

  // Validate input
  const updates: Record<string, number> = {};

  if (typeof body.maxAuthorRepeat === 'number' && body.maxAuthorRepeat >= 1 && body.maxAuthorRepeat <= 100) {
    updates.maxAuthorRepeat = body.maxAuthorRepeat;
  }
  if (typeof body.maxWorkRepeat === 'number' && body.maxWorkRepeat >= 1 && body.maxWorkRepeat <= 100) {
    updates.maxWorkRepeat = body.maxWorkRepeat;
  }
  if (typeof body.minLength === 'number' && body.minLength >= 1 && body.minLength <= 10000) {
    updates.minLength = body.minLength;
  }
  if (typeof body.maxLength === 'number' && body.maxLength >= 1 && body.maxLength <= 10000) {
    updates.maxLength = body.maxLength;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid configuration values provided' }, 400);
  }

  const config = await updateFeedConfig(updates);
  return c.json({ config, message: 'Configuration updated successfully' });
});

export { admin };
