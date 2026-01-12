import { sql } from '../db/client';

export interface FeedAlgorithmConfig {
  // Diversity settings
  maxAuthorRepeat: number;
  maxWorkRepeat: number;
  minLength: number;
  maxLength: number;

  // Length diversity settings
  lengthDiversityEnabled: boolean;
  shortMaxLength: number;      // Passages <= this are "short"
  longMinLength: number;       // Passages >= this are "long"
  shortRatio: number;          // Target % short (0-100)
  mediumRatio: number;         // Target % medium (0-100)
  longRatio: number;           // Target % long (0-100)

  // Personalization master settings
  enablePersonalization: boolean;
  minSignalsForPersonalization: number;  // Min likes/bookmarks before enabling
  fullCorpusForLoggedIn: boolean;        // Use full corpus instead of curated

  // Signal weights (multipliers, 1.0 = neutral)
  // Account-required signals
  followedAuthorBoost: number;           // Boost for followed authors (default: 3.0)

  // Device-based signals (work without account)
  likedAuthorBoost: number;              // Boost for authors user has liked (default: 1.5)
  likedCategoryBoost: number;            // Boost for categories user likes (default: 1.3)
  bookmarkedWorkBoost: number;           // Boost for bookmarked works (default: 1.2)
  bookmarkedAuthorBoost: number;         // Boost for authors of bookmarked works (default: 1.15)

  // Derived signals
  similarEraBoost: number;               // Boost for similar era preference (default: 1.1)
  popularityBoost: number;               // Boost based on like_count (default: 0.3)

  // Algorithm tuning
  baseRandomWeight: number;              // Exploration factor (default: 0.3)
  personalizationWeight: number;         // Exploitation factor (default: 0.7)
  recencyPenalty: number;                // Penalty for recently shown content (default: 0.5)

  // Embedding-based personalization
  enableEmbeddingSimilarity: boolean;    // Use taste vectors when available
  embeddingSimilarityWeight: number;     // Weight for embedding similarity (default: 0.5)
  minLikesForTasteVector: number;        // Min likes to compute taste vector (default: 5)
  tasteVectorRefreshHours: number;       // How often to recompute taste vector (default: 1)
}

const DEFAULT_CONFIG: FeedAlgorithmConfig = {
  // Diversity
  maxAuthorRepeat: 20,
  maxWorkRepeat: 10,
  minLength: 10,
  maxLength: 1000,

  // Length diversity
  lengthDiversityEnabled: true,
  shortMaxLength: 150,
  longMinLength: 500,
  shortRatio: 30,
  mediumRatio: 40,
  longRatio: 30,

  // Personalization master settings
  enablePersonalization: true,
  minSignalsForPersonalization: 3,
  fullCorpusForLoggedIn: true,

  // Signal weights
  followedAuthorBoost: 3.0,
  likedAuthorBoost: 1.5,
  likedCategoryBoost: 1.3,
  bookmarkedWorkBoost: 1.2,
  bookmarkedAuthorBoost: 1.15,
  similarEraBoost: 1.1,
  popularityBoost: 0.3,

  // Algorithm tuning
  baseRandomWeight: 0.3,
  personalizationWeight: 0.7,
  recencyPenalty: 0.5,

  // Embedding settings
  enableEmbeddingSimilarity: true,
  embeddingSimilarityWeight: 0.5,
  minLikesForTasteVector: 5,
  tasteVectorRefreshHours: 1,
};

// Cache config in memory for performance
let cachedConfig: FeedAlgorithmConfig | null = null;

export async function getFeedConfig(): Promise<FeedAlgorithmConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const [row] = await sql`
    SELECT value FROM app_config WHERE key = 'feed_algorithm'
  `;

  if (row) {
    // Merge stored config with defaults to get any new fields
    cachedConfig = { ...DEFAULT_CONFIG, ...(row.value as Partial<FeedAlgorithmConfig>) };
    return cachedConfig;
  }

  return DEFAULT_CONFIG;
}

export async function updateFeedConfig(config: Partial<FeedAlgorithmConfig>): Promise<FeedAlgorithmConfig> {
  const current = await getFeedConfig();
  const updated = { ...current, ...config };

  await sql`
    INSERT INTO app_config (key, value, updated_at)
    VALUES ('feed_algorithm', ${sql.json(updated)}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = ${sql.json(updated)},
      updated_at = NOW()
  `;

  // Clear cache
  cachedConfig = updated;

  return updated;
}

export function clearConfigCache() {
  cachedConfig = null;
}
