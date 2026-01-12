import { Hono } from 'hono';
import { getDatasetStats, getFeedStats, getPhase2Stats } from '../services/admin-stats';
import { getFeedConfig, updateFeedConfig, FeedAlgorithmConfig } from '../services/config';

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
  const updates: Partial<FeedAlgorithmConfig> = {};

  // ============================================================================
  // DIVERSITY SETTINGS
  // ============================================================================
  if (typeof body.maxAuthorRepeat === 'number' && body.maxAuthorRepeat >= 1 && body.maxAuthorRepeat <= 100) {
    updates.maxAuthorRepeat = body.maxAuthorRepeat;
  }
  if (typeof body.maxWorkRepeat === 'number' && body.maxWorkRepeat >= 1 && body.maxWorkRepeat <= 100) {
    updates.maxWorkRepeat = body.maxWorkRepeat;
  }

  // ============================================================================
  // LENGTH FILTER SETTINGS
  // ============================================================================
  if (typeof body.minLength === 'number' && body.minLength >= 1 && body.minLength <= 10000) {
    updates.minLength = body.minLength;
  }
  if (typeof body.maxLength === 'number' && body.maxLength >= 1 && body.maxLength <= 10000) {
    updates.maxLength = body.maxLength;
  }

  // ============================================================================
  // LENGTH DIVERSITY SETTINGS
  // ============================================================================
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

  // ============================================================================
  // PERSONALIZATION MASTER SETTINGS
  // ============================================================================
  if (typeof body.enablePersonalization === 'boolean') {
    updates.enablePersonalization = body.enablePersonalization;
  }
  if (typeof body.minSignalsForPersonalization === 'number' && body.minSignalsForPersonalization >= 0 && body.minSignalsForPersonalization <= 100) {
    updates.minSignalsForPersonalization = body.minSignalsForPersonalization;
  }
  if (typeof body.fullCorpusForLoggedIn === 'boolean') {
    updates.fullCorpusForLoggedIn = body.fullCorpusForLoggedIn;
  }

  // ============================================================================
  // SIGNAL WEIGHTS - Account-required
  // ============================================================================
  if (typeof body.followedAuthorBoost === 'number' && body.followedAuthorBoost >= 0 && body.followedAuthorBoost <= 10) {
    updates.followedAuthorBoost = body.followedAuthorBoost;
  }

  // ============================================================================
  // SIGNAL WEIGHTS - Device-based (work without account)
  // ============================================================================
  if (typeof body.likedAuthorBoost === 'number' && body.likedAuthorBoost >= 0 && body.likedAuthorBoost <= 10) {
    updates.likedAuthorBoost = body.likedAuthorBoost;
  }
  if (typeof body.likedCategoryBoost === 'number' && body.likedCategoryBoost >= 0 && body.likedCategoryBoost <= 10) {
    updates.likedCategoryBoost = body.likedCategoryBoost;
  }
  if (typeof body.bookmarkedWorkBoost === 'number' && body.bookmarkedWorkBoost >= 0 && body.bookmarkedWorkBoost <= 10) {
    updates.bookmarkedWorkBoost = body.bookmarkedWorkBoost;
  }
  if (typeof body.bookmarkedAuthorBoost === 'number' && body.bookmarkedAuthorBoost >= 0 && body.bookmarkedAuthorBoost <= 10) {
    updates.bookmarkedAuthorBoost = body.bookmarkedAuthorBoost;
  }

  // ============================================================================
  // SIGNAL WEIGHTS - Derived signals
  // ============================================================================
  if (typeof body.similarEraBoost === 'number' && body.similarEraBoost >= 0 && body.similarEraBoost <= 10) {
    updates.similarEraBoost = body.similarEraBoost;
  }
  if (typeof body.popularityBoost === 'number' && body.popularityBoost >= 0 && body.popularityBoost <= 10) {
    updates.popularityBoost = body.popularityBoost;
  }

  // ============================================================================
  // ALGORITHM TUNING
  // ============================================================================
  if (typeof body.baseRandomWeight === 'number' && body.baseRandomWeight >= 0 && body.baseRandomWeight <= 1) {
    updates.baseRandomWeight = body.baseRandomWeight;
  }
  if (typeof body.personalizationWeight === 'number' && body.personalizationWeight >= 0 && body.personalizationWeight <= 1) {
    updates.personalizationWeight = body.personalizationWeight;
  }
  if (typeof body.recencyPenalty === 'number' && body.recencyPenalty >= 0 && body.recencyPenalty <= 1) {
    updates.recencyPenalty = body.recencyPenalty;
  }

  // ============================================================================
  // EMBEDDING-BASED PERSONALIZATION
  // ============================================================================
  if (typeof body.enableEmbeddingSimilarity === 'boolean') {
    updates.enableEmbeddingSimilarity = body.enableEmbeddingSimilarity;
  }
  if (typeof body.embeddingSimilarityWeight === 'number' && body.embeddingSimilarityWeight >= 0 && body.embeddingSimilarityWeight <= 1) {
    updates.embeddingSimilarityWeight = body.embeddingSimilarityWeight;
  }
  if (typeof body.minLikesForTasteVector === 'number' && body.minLikesForTasteVector >= 1 && body.minLikesForTasteVector <= 100) {
    updates.minLikesForTasteVector = body.minLikesForTasteVector;
  }
  if (typeof body.tasteVectorRefreshHours === 'number' && body.tasteVectorRefreshHours >= 0.1 && body.tasteVectorRefreshHours <= 168) {
    updates.tasteVectorRefreshHours = body.tasteVectorRefreshHours;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid configuration values provided' }, 400);
  }

  const config = await updateFeedConfig(updates);
  return c.json({ config, message: 'Configuration updated successfully' });
});

export { admin };
