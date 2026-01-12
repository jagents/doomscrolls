import { sql } from '../db/client';

export interface FeedAlgorithmConfig {
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
}

const DEFAULT_CONFIG: FeedAlgorithmConfig = {
  maxAuthorRepeat: 20,
  maxWorkRepeat: 10,
  minLength: 10,
  maxLength: 1000,
  // Length diversity defaults
  lengthDiversityEnabled: true,
  shortMaxLength: 150,
  longMinLength: 500,
  shortRatio: 30,
  mediumRatio: 40,
  longRatio: 30,
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
    cachedConfig = row.value as FeedAlgorithmConfig;
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
