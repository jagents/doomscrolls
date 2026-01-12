import { sql } from '../db/client';
import { formatPassage } from './formatters';
import { getFeedConfig, FeedAlgorithmConfig } from './config';
import type { FeedOptions, FeedResponse, CursorData, PersonalizedFeedOptions, FollowingFeedOptions } from '../types';

// Types for anonymous personalization
export interface AnonymousSignals {
  likedChunkIds: string[];
  bookmarkedChunkIds: string[];
  likedAuthorIds?: string[];
  likedCategoryIds?: string[];
}

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function decodeCursor(cursor: string): CursorData {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return { recentAuthors: [], recentWorks: [], offset: 0 };
  }
}

// Shuffle array in place (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Calculate how many of each length bucket we need
function calculateBucketCounts(limit: number, config: FeedAlgorithmConfig): { short: number; medium: number; long: number } {
  const totalRatio = config.shortRatio + config.mediumRatio + config.longRatio;
  if (totalRatio === 0) {
    return { short: Math.ceil(limit / 3), medium: Math.ceil(limit / 3), long: Math.ceil(limit / 3) };
  }

  const short = Math.round((config.shortRatio / totalRatio) * limit);
  const long = Math.round((config.longRatio / totalRatio) * limit);
  const medium = limit - short - long; // Remainder goes to medium

  return { short, medium, long };
}

// Query passages for a specific length range
async function queryPassagesByLength(
  minLen: number,
  maxLen: number,
  limit: number,
  category: string | undefined,
  cursorData: CursorData,
  hasCuratedWorks: boolean
): Promise<any[]> {
  if (limit <= 0) return [];

  if (category && category !== 'for-you') {
    if (hasCuratedWorks) {
      return sql`
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN curated_works cw ON c.work_id = cw.work_id
        JOIN work_categories wc ON c.work_id = wc.work_id
        JOIN categories cat ON wc.category_id = cat.id
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE cat.slug = ${category}
          AND LENGTH(c.text) BETWEEN ${minLen} AND ${maxLen}
          ${cursorData.recentAuthors.length > 0
            ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
            : sql``}
          ${cursorData.recentWorks.length > 0
            ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
            : sql``}
        ORDER BY RANDOM()
        LIMIT ${limit}
      `;
    } else {
      return sql`
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN work_categories wc ON c.work_id = wc.work_id
        JOIN categories cat ON wc.category_id = cat.id
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE cat.slug = ${category}
          AND LENGTH(c.text) BETWEEN ${minLen} AND ${maxLen}
        ORDER BY RANDOM()
        LIMIT ${limit}
      `;
    }
  } else {
    if (hasCuratedWorks) {
      return sql`
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN curated_works cw ON c.work_id = cw.work_id
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE LENGTH(c.text) BETWEEN ${minLen} AND ${maxLen}
          ${cursorData.recentAuthors.length > 0
            ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
            : sql``}
          ${cursorData.recentWorks.length > 0
            ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
            : sql``}
        ORDER BY RANDOM()
        LIMIT ${limit}
      `;
    } else {
      return sql`
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE LENGTH(c.text) BETWEEN ${minLen} AND ${maxLen}
          AND w.chunk_count > 10
          ${cursorData.recentAuthors.length > 0
            ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
            : sql``}
          ${cursorData.recentWorks.length > 0
            ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
            : sql``}
        ORDER BY RANDOM()
        LIMIT ${limit}
      `;
    }
  }
}

export async function generateFeed(options: FeedOptions): Promise<FeedResponse> {
  const { category, limit, cursor } = options;

  // Get config from database
  const config = await getFeedConfig();

  const cursorData = cursor ? decodeCursor(cursor) : {
    recentAuthors: [],
    recentWorks: [],
    offset: 0
  };

  // Check if we have curated works
  const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
  const hasCuratedWorks = parseInt(curatedCount.count) > 0;

  let passages: any[];

  if (config.lengthDiversityEnabled) {
    // Query each length bucket separately and combine
    const buckets = calculateBucketCounts(limit, config);

    // Define length ranges for each bucket
    const shortMin = config.minLength;
    const shortMax = config.shortMaxLength;
    const mediumMin = config.shortMaxLength + 1;
    const mediumMax = config.longMinLength - 1;
    const longMin = config.longMinLength;
    const longMax = config.maxLength;

    // Query all buckets in parallel
    const [shortPassages, mediumPassages, longPassages] = await Promise.all([
      queryPassagesByLength(shortMin, shortMax, buckets.short, category, cursorData, hasCuratedWorks),
      queryPassagesByLength(mediumMin, mediumMax, buckets.medium, category, cursorData, hasCuratedWorks),
      queryPassagesByLength(longMin, longMax, buckets.long, category, cursorData, hasCuratedWorks),
    ]);

    // Combine and shuffle
    passages = shuffle([...shortPassages, ...mediumPassages, ...longPassages]);
  } else {
    // Original behavior: single query with min/max length
    passages = await queryPassagesByLength(
      config.minLength,
      config.maxLength,
      limit,
      category,
      cursorData,
      hasCuratedWorks
    );
  }

  // Build next cursor with recent author/work IDs for diversity
  const newRecentAuthors = [
    ...cursorData.recentAuthors,
    ...passages.map((p: any) => p.author_id),
  ].slice(-config.maxAuthorRepeat);

  const newRecentWorks = [
    ...cursorData.recentWorks,
    ...passages.filter((p: any) => p.work_id).map((p: any) => p.work_id),
  ].slice(-config.maxWorkRepeat);

  const nextCursor = passages.length > 0 ? encodeCursor({
    recentAuthors: newRecentAuthors,
    recentWorks: newRecentWorks,
    offset: cursorData.offset + passages.length,
  }) : null;

  return {
    passages: passages.map(formatPassage),
    nextCursor,
    hasMore: passages.length >= limit * 0.5, // Has more if we got at least half
  };
}

// Generate feed from followed authors only
export async function generateFollowingFeed(options: FollowingFeedOptions): Promise<FeedResponse> {
  const { userId, limit, cursor } = options;

  const config = await getFeedConfig();

  const cursorData = cursor ? decodeCursor(cursor) : {
    recentAuthors: [],
    recentWorks: [],
    offset: 0
  };

  // Get followed author IDs
  const followedAuthors = await sql`
    SELECT author_id FROM user_follows WHERE user_id = ${userId}
  `;

  if (followedAuthors.length === 0) {
    // No followed authors - return empty with suggestions
    const suggestedAuthors = await sql`
      SELECT id, name, slug, era, primary_genre
      FROM authors
      WHERE chunk_count > 100
      ORDER BY RANDOM()
      LIMIT 5
    `;

    return {
      passages: [],
      nextCursor: null,
      hasMore: false,
      suggestedAuthors,
    };
  }

  const authorIds = followedAuthors.map((f: any) => f.author_id);

  // Query passages from followed authors
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
    WHERE c.author_id = ANY(${authorIds})
      AND LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
      ${cursorData.recentAuthors.length > 0
        ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
        : sql``}
      ${cursorData.recentWorks.length > 0
        ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
        : sql``}
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  // Build next cursor
  const newRecentAuthors = [
    ...cursorData.recentAuthors,
    ...passages.map((p: any) => p.author_id),
  ].slice(-config.maxAuthorRepeat);

  const newRecentWorks = [
    ...cursorData.recentWorks,
    ...passages.filter((p: any) => p.work_id).map((p: any) => p.work_id),
  ].slice(-config.maxWorkRepeat);

  const nextCursor = passages.length > 0 ? encodeCursor({
    recentAuthors: newRecentAuthors,
    recentWorks: newRecentWorks,
    offset: cursorData.offset + passages.length,
  }) : null;

  return {
    passages: passages.map(formatPassage),
    nextCursor,
    hasMore: passages.length >= limit * 0.5,
  };
}

/**
 * Collect user signals for personalization
 * Returns arrays of author IDs, category IDs, work IDs based on user behavior
 */
async function collectUserSignals(userId: string) {
  // Get liked authors (authors the user has liked passages from)
  const likedAuthors = await sql`
    SELECT c.author_id, COUNT(*) as count
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    WHERE ul.user_id = ${userId}
    GROUP BY c.author_id
    ORDER BY count DESC
    LIMIT 30
  `;

  // Get followed authors
  const followedAuthors = await sql`
    SELECT author_id FROM user_follows WHERE user_id = ${userId}
  `;

  // Get liked categories (from works the user has liked)
  const likedCategories = await sql`
    SELECT wc.category_id, COUNT(*) as count
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    JOIN work_categories wc ON c.work_id = wc.work_id
    WHERE ul.user_id = ${userId}
    GROUP BY wc.category_id
    ORDER BY count DESC
    LIMIT 10
  `;

  // Get bookmarked works
  const bookmarkedWorks = await sql`
    SELECT DISTINCT c.work_id
    FROM user_bookmarks ub
    JOIN chunks c ON ub.chunk_id = c.id
    WHERE ub.user_id = ${userId} AND c.work_id IS NOT NULL
    LIMIT 20
  `;

  // Get authors of bookmarked works
  const bookmarkedAuthors = await sql`
    SELECT DISTINCT c.author_id
    FROM user_bookmarks ub
    JOIN chunks c ON ub.chunk_id = c.id
    WHERE ub.user_id = ${userId}
    LIMIT 20
  `;

  // Get preferred eras based on likes
  const preferredEras = await sql`
    SELECT a.era, COUNT(*) as count
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    JOIN authors a ON c.author_id = a.id
    WHERE ul.user_id = ${userId} AND a.era IS NOT NULL
    GROUP BY a.era
    ORDER BY count DESC
    LIMIT 5
  `;

  return {
    likedAuthorIds: likedAuthors.map((a: any) => a.author_id),
    followedAuthorIds: followedAuthors.map((f: any) => f.author_id),
    likedCategoryIds: likedCategories.map((c: any) => c.category_id),
    bookmarkedWorkIds: bookmarkedWorks.map((w: any) => w.work_id).filter(Boolean),
    bookmarkedAuthorIds: bookmarkedAuthors.map((a: any) => a.author_id),
    preferredEras: preferredEras.map((e: any) => e.era),
    totalSignals: likedAuthors.length + followedAuthors.length + bookmarkedWorks.length,
  };
}

/**
 * Collect anonymous signals from client-provided data
 */
async function collectAnonymousSignals(signals: AnonymousSignals) {
  if (signals.likedChunkIds.length === 0 && signals.bookmarkedChunkIds.length === 0) {
    return {
      likedAuthorIds: signals.likedAuthorIds || [],
      likedCategoryIds: signals.likedCategoryIds || [],
      bookmarkedWorkIds: [] as string[],
      bookmarkedAuthorIds: [] as string[],
      preferredEras: [] as string[],
      totalSignals: 0,
    };
  }

  const allChunkIds = Array.from(new Set([...signals.likedChunkIds, ...signals.bookmarkedChunkIds]));

  if (allChunkIds.length === 0) {
    return {
      likedAuthorIds: signals.likedAuthorIds || [],
      likedCategoryIds: signals.likedCategoryIds || [],
      bookmarkedWorkIds: [] as string[],
      bookmarkedAuthorIds: [] as string[],
      preferredEras: [] as string[],
      totalSignals: 0,
    };
  }

  // Get author and work info from liked/bookmarked chunks
  const chunkInfo = await sql`
    SELECT c.id, c.author_id, c.work_id, a.era
    FROM chunks c
    JOIN authors a ON c.author_id = a.id
    WHERE c.id = ANY(${allChunkIds})
  `;

  const likedChunkSet = new Set(signals.likedChunkIds);
  const bookmarkedChunkSet = new Set(signals.bookmarkedChunkIds);

  const likedAuthorIds: string[] = [];
  const bookmarkedWorkIds: string[] = [];
  const bookmarkedAuthorIds: string[] = [];
  const eras: string[] = [];

  for (const chunk of chunkInfo) {
    if (likedChunkSet.has(chunk.id)) {
      likedAuthorIds.push(chunk.author_id);
      if (chunk.era) eras.push(chunk.era);
    }
    if (bookmarkedChunkSet.has(chunk.id)) {
      if (chunk.work_id) bookmarkedWorkIds.push(chunk.work_id);
      bookmarkedAuthorIds.push(chunk.author_id);
    }
  }

  // Get liked categories from liked chunks
  let likedCategoryIds: string[] = signals.likedCategoryIds || [];
  if (signals.likedChunkIds.length > 0 && likedCategoryIds.length === 0) {
    const categories = await sql`
      SELECT DISTINCT wc.category_id
      FROM chunks c
      JOIN work_categories wc ON c.work_id = wc.work_id
      WHERE c.id = ANY(${signals.likedChunkIds})
    `;
    likedCategoryIds = categories.map((c: any) => c.category_id);
  }

  // Count era preferences
  const eraCounts = eras.reduce((acc, era) => {
    acc[era] = (acc[era] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const preferredEras = Object.entries(eraCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([era]) => era);

  return {
    likedAuthorIds: Array.from(new Set(likedAuthorIds)),
    likedCategoryIds: Array.from(new Set(likedCategoryIds)),
    bookmarkedWorkIds: Array.from(new Set(bookmarkedWorkIds)),
    bookmarkedAuthorIds: Array.from(new Set(bookmarkedAuthorIds)),
    preferredEras,
    totalSignals: signals.likedChunkIds.length + signals.bookmarkedChunkIds.length,
  };
}

/**
 * Calculate multi-variate score for a passage based on config weights
 */
function calculatePassageScore(
  passage: any,
  signals: {
    followedAuthorIds?: string[];
    likedAuthorIds: string[];
    likedCategoryIds: string[];
    bookmarkedWorkIds: string[];
    bookmarkedAuthorIds: string[];
    preferredEras: string[];
  },
  config: FeedAlgorithmConfig,
  maxLikeCount: number
): number {
  let score = config.baseRandomWeight * Math.random();

  // Account-required signal: followed author boost
  if (signals.followedAuthorIds && signals.followedAuthorIds.includes(passage.author_id)) {
    score += config.followedAuthorBoost;
  }

  // Device-based signals (work without account)
  if (signals.likedAuthorIds.includes(passage.author_id)) {
    score += config.likedAuthorBoost;
  }

  // Category boost
  if (passage.category_ids) {
    const categoryIds = Array.isArray(passage.category_ids) ? passage.category_ids : [passage.category_ids];
    const matchingCategories = categoryIds.filter((id: string) => signals.likedCategoryIds.includes(id));
    if (matchingCategories.length > 0) {
      score += config.likedCategoryBoost * Math.min(matchingCategories.length, 2);
    }
  }

  // Bookmarked work boost
  if (passage.work_id && signals.bookmarkedWorkIds.includes(passage.work_id)) {
    score += config.bookmarkedWorkBoost;
  }

  // Bookmarked author boost
  if (signals.bookmarkedAuthorIds.includes(passage.author_id)) {
    score += config.bookmarkedAuthorBoost;
  }

  // Era preference boost
  if (passage.author_era && signals.preferredEras.includes(passage.author_era)) {
    score += config.similarEraBoost;
  }

  // Popularity boost (normalized by max likes)
  if (maxLikeCount > 0 && passage.like_count > 0) {
    const normalizedPopularity = passage.like_count / maxLikeCount;
    score += config.popularityBoost * normalizedPopularity;
  }

  return score;
}

/**
 * Generate personalized feed with multi-variate scoring
 * Supports both logged-in users (userId) and anonymous users (deviceSignals)
 */
export async function generatePersonalizedFeed(options: PersonalizedFeedOptions & {
  deviceSignals?: AnonymousSignals;
}): Promise<FeedResponse> {
  const { userId, deviceSignals, category, limit, cursor } = options;

  const config = await getFeedConfig();

  // Check if personalization is enabled
  if (!config.enablePersonalization) {
    return generateFeed({ category, limit, cursor });
  }

  const cursorData = cursor ? decodeCursor(cursor) : {
    recentAuthors: [],
    recentWorks: [],
    offset: 0
  };

  // Collect signals based on whether user is logged in or anonymous
  let signals: {
    followedAuthorIds?: string[];
    likedAuthorIds: string[];
    likedCategoryIds: string[];
    bookmarkedWorkIds: string[];
    bookmarkedAuthorIds: string[];
    preferredEras: string[];
    totalSignals: number;
  };

  if (userId) {
    // Logged-in user: fetch from database
    signals = await collectUserSignals(userId);
  } else if (deviceSignals) {
    // Anonymous user: use client-provided signals
    signals = await collectAnonymousSignals(deviceSignals);
  } else {
    // No signals available: fall back to base feed
    return generateFeed({ category, limit, cursor });
  }

  // If not enough signals, fall back to base feed
  if (signals.totalSignals < config.minSignalsForPersonalization) {
    return generateFeed({ category, limit, cursor });
  }

  // Check if we have curated works
  const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
  const hasCuratedWorks = parseInt(curatedCount.count) > 0;
  const useFullCorpus = config.fullCorpusForLoggedIn && userId;

  // Query candidate passages with extra fields for scoring
  const fetchLimit = limit * 5; // Fetch more candidates for scoring
  let candidates;

  if (category && category !== 'for-you') {
    candidates = await sql`
      SELECT
        c.id, c.text, c.type,
        c.author_id, a.name as author_name, a.slug as author_slug, a.era as author_era,
        c.work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ARRAY_AGG(DISTINCT wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL) as category_ids
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      LEFT JOIN work_categories wc ON c.work_id = wc.work_id
      JOIN categories cat ON wc.category_id = cat.id
      WHERE cat.slug = ${category}
        AND LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
        ${cursorData.recentAuthors.length > 0
          ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
          : sql``}
        ${cursorData.recentWorks.length > 0
          ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
          : sql``}
      GROUP BY c.id, c.text, c.type, c.author_id, a.name, a.slug, a.era, c.work_id, w.title, w.slug, cs.like_count
      ORDER BY RANDOM()
      LIMIT ${fetchLimit}
    `;
  } else if (hasCuratedWorks && !useFullCorpus) {
    candidates = await sql`
      SELECT
        c.id, c.text, c.type,
        c.author_id, a.name as author_name, a.slug as author_slug, a.era as author_era,
        c.work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ARRAY_AGG(DISTINCT wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL) as category_ids
      FROM chunks c
      JOIN curated_works cw ON c.work_id = cw.work_id
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      LEFT JOIN work_categories wc ON c.work_id = wc.work_id
      WHERE LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
        ${cursorData.recentAuthors.length > 0
          ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
          : sql``}
        ${cursorData.recentWorks.length > 0
          ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
          : sql``}
      GROUP BY c.id, c.text, c.type, c.author_id, a.name, a.slug, a.era, c.work_id, w.title, w.slug, cs.like_count
      ORDER BY RANDOM()
      LIMIT ${fetchLimit}
    `;
  } else {
    // Full corpus
    candidates = await sql`
      SELECT
        c.id, c.text, c.type,
        c.author_id, a.name as author_name, a.slug as author_slug, a.era as author_era,
        c.work_id, w.title as work_title, w.slug as work_slug,
        COALESCE(cs.like_count, 0) as like_count,
        ARRAY_AGG(DISTINCT wc.category_id) FILTER (WHERE wc.category_id IS NOT NULL) as category_ids
      FROM chunks c
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
      LEFT JOIN work_categories wc ON c.work_id = wc.work_id
      WHERE LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
        AND (w.chunk_count > 10 OR c.author_id = ANY(${signals.followedAuthorIds || []}))
        ${cursorData.recentAuthors.length > 0
          ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
          : sql``}
        ${cursorData.recentWorks.length > 0
          ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
          : sql``}
      GROUP BY c.id, c.text, c.type, c.author_id, a.name, a.slug, a.era, c.work_id, w.title, w.slug, cs.like_count
      ORDER BY RANDOM()
      LIMIT ${fetchLimit}
    `;
  }

  // Find max like count for normalization
  const maxLikeCount = Math.max(...candidates.map((p: any) => p.like_count || 0), 1);

  // Score each candidate
  const scoredPassages = candidates.map((passage: any) => ({
    ...passage,
    score: calculatePassageScore(passage, signals, config, maxLikeCount),
  }));

  // Sort by score and take top results
  scoredPassages.sort((a: any, b: any) => b.score - a.score);

  // Apply personalization weight: mix of top-scored and random
  const personalizedCount = Math.round(limit * config.personalizationWeight);
  const randomCount = limit - personalizedCount;

  const topScored = scoredPassages.slice(0, personalizedCount);
  const remaining = scoredPassages.slice(personalizedCount);
  const randomPicks = shuffle([...remaining]).slice(0, randomCount);

  const passages = shuffle([...topScored, ...randomPicks]);

  // Build next cursor
  const newRecentAuthors = [
    ...cursorData.recentAuthors,
    ...passages.map((p: any) => p.author_id),
  ].slice(-config.maxAuthorRepeat);

  const newRecentWorks = [
    ...cursorData.recentWorks,
    ...passages.filter((p: any) => p.work_id).map((p: any) => p.work_id),
  ].slice(-config.maxWorkRepeat);

  const nextCursor = passages.length > 0 ? encodeCursor({
    recentAuthors: newRecentAuthors,
    recentWorks: newRecentWorks,
    offset: cursorData.offset + passages.length,
  }) : null;

  return {
    passages: passages.map(formatPassage),
    nextCursor,
    hasMore: passages.length >= limit * 0.5,
    personalized: true,
  };
}

/**
 * Generate anonymous personalized feed using device signals
 */
export async function generateAnonymousPersonalizedFeed(options: {
  deviceSignals: AnonymousSignals;
  category?: string;
  limit: number;
  cursor?: string | null;
}): Promise<FeedResponse> {
  return generatePersonalizedFeed({
    userId: undefined as any, // No user ID for anonymous
    deviceSignals: options.deviceSignals,
    category: options.category,
    limit: options.limit,
    cursor: options.cursor,
  });
}
