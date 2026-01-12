import { Hono } from 'hono';
import { getDatasetStats, getFeedStats, getPhase2Stats } from '../services/admin-stats';
import { getFeedConfig, updateFeedConfig } from '../services/config';

const admin = new Hono();

// GET /api/admin/stats - Combined dataset and feed statistics
admin.get('/stats', async (c) => {
  const [dataset, feed, phase2] = await Promise.all([
    getDatasetStats(),
    getFeedStats(),
    getPhase2Stats(),
  ]);

  return c.json({
    dataset,
    feed,
    phase2,
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
  const updates: Record<string, number | boolean> = {};

  // Diversity settings
  if (typeof body.maxAuthorRepeat === 'number' && body.maxAuthorRepeat >= 1 && body.maxAuthorRepeat <= 100) {
    updates.maxAuthorRepeat = body.maxAuthorRepeat;
  }
  if (typeof body.maxWorkRepeat === 'number' && body.maxWorkRepeat >= 1 && body.maxWorkRepeat <= 100) {
    updates.maxWorkRepeat = body.maxWorkRepeat;
  }

  // Length filter settings
  if (typeof body.minLength === 'number' && body.minLength >= 1 && body.minLength <= 10000) {
    updates.minLength = body.minLength;
  }
  if (typeof body.maxLength === 'number' && body.maxLength >= 1 && body.maxLength <= 10000) {
    updates.maxLength = body.maxLength;
  }

  // Length diversity settings
  if (typeof body.lengthDiversityEnabled === 'boolean') {
    updates.lengthDiversityEnabled = body.lengthDiversityEnabled;
  }
  if (typeof body.shortMaxLength === 'number' && body.shortMaxLength >= 10 && body.shortMaxLength <= 5000) {
    updates.shortMaxLength = body.shortMaxLength;
  }
  if (typeof body.longMinLength === 'number' && body.longMinLength >= 50 && body.longMinLength <= 5000) {
    updates.longMinLength = body.longMinLength;
  }
  if (typeof body.shortRatio === 'number' && body.shortRatio >= 0 && body.shortRatio <= 100) {
    updates.shortRatio = body.shortRatio;
  }
  if (typeof body.mediumRatio === 'number' && body.mediumRatio >= 0 && body.mediumRatio <= 100) {
    updates.mediumRatio = body.mediumRatio;
  }
  if (typeof body.longRatio === 'number' && body.longRatio >= 0 && body.longRatio <= 100) {
    updates.longRatio = body.longRatio;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid configuration values provided' }, 400);
  }

  const config = await updateFeedConfig(updates);
  return c.json({ config, message: 'Configuration updated successfully' });
});

export { admin };
