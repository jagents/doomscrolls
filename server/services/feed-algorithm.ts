import { sql } from '../db/client';
import { formatPassage } from './formatters';
import { getFeedConfig, FeedAlgorithmConfig } from './config';
import type { FeedOptions, FeedResponse, CursorData, PersonalizedFeedOptions, FollowingFeedOptions } from '../types';

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

// Generate personalized feed for logged-in users
export async function generatePersonalizedFeed(options: PersonalizedFeedOptions): Promise<FeedResponse> {
  const { userId, category, limit, cursor } = options;

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

  // Get user's signals
  const [likeCount] = await sql`
    SELECT COUNT(*) as count FROM user_likes WHERE user_id = ${userId}
  `;

  // If not enough signals, fall back to base feed
  if (parseInt(likeCount.count) < (config.minSignalsForPersonalization || 5)) {
    return generateFeed({ category, limit, cursor });
  }

  // Get followed authors
  const followedAuthors = await sql`
    SELECT author_id FROM user_follows WHERE user_id = ${userId}
  `;
  const followedAuthorIds = followedAuthors.map((f: any) => f.author_id);

  // Get liked authors (authors with most likes)
  const likedAuthors = await sql`
    SELECT c.author_id, COUNT(*) as like_count
    FROM user_likes ul
    JOIN chunks c ON ul.chunk_id = c.id
    WHERE ul.user_id = ${userId}
    GROUP BY c.author_id
    ORDER BY like_count DESC
    LIMIT 20
  `;
  const likedAuthorIds = likedAuthors.map((a: any) => a.author_id);

  // Determine if we should use full corpus or curated works
  const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
  const hasCuratedWorks = parseInt(curatedCount.count) > 0;
  const useFullCorpus = config.fullCorpusForLoggedIn && !hasCuratedWorks;

  // Build personalized query
  let passages;

  if (category && category !== 'for-you') {
    // Category-filtered personalized feed
    passages = await sql`
      WITH scored_passages AS (
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count,
          CASE WHEN c.author_id = ANY(${followedAuthorIds}) THEN ${config.followedAuthorBoost || 3.0} ELSE 0 END as follow_boost,
          CASE WHEN c.author_id = ANY(${likedAuthorIds}) THEN ${config.likedAuthorBoost || 1.5} ELSE 0 END as like_boost,
          RANDOM() as base_score
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        JOIN work_categories wc ON c.work_id = wc.work_id
        JOIN categories cat ON wc.category_id = cat.id
        WHERE cat.slug = ${category}
          AND LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
          ${cursorData.recentAuthors.length > 0
            ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
            : sql``}
          ${cursorData.recentWorks.length > 0
            ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
            : sql``}
      )
      SELECT *,
        (base_score + follow_boost + like_boost) as final_score
      FROM scored_passages
      ORDER BY final_score DESC
      LIMIT ${limit}
    `;
  } else {
    // General personalized feed
    if (hasCuratedWorks && !useFullCorpus) {
      passages = await sql`
        WITH scored_passages AS (
          SELECT
            c.id, c.text, c.type,
            c.author_id, a.name as author_name, a.slug as author_slug,
            c.work_id, w.title as work_title, w.slug as work_slug,
            COALESCE(cs.like_count, 0) as like_count,
            CASE WHEN c.author_id = ANY(${followedAuthorIds}) THEN ${config.followedAuthorBoost || 3.0} ELSE 0 END as follow_boost,
            CASE WHEN c.author_id = ANY(${likedAuthorIds}) THEN ${config.likedAuthorBoost || 1.5} ELSE 0 END as like_boost,
            RANDOM() as base_score
          FROM chunks c
          JOIN curated_works cw ON c.work_id = cw.work_id
          JOIN authors a ON c.author_id = a.id
          LEFT JOIN works w ON c.work_id = w.id
          LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
          WHERE LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
            ${cursorData.recentAuthors.length > 0
              ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
              : sql``}
            ${cursorData.recentWorks.length > 0
              ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
              : sql``}
        )
        SELECT *,
          (base_score + follow_boost + like_boost) as final_score
        FROM scored_passages
        ORDER BY final_score DESC
        LIMIT ${limit}
      `;
    } else {
      // Full corpus for logged-in users
      passages = await sql`
        WITH scored_passages AS (
          SELECT
            c.id, c.text, c.type,
            c.author_id, a.name as author_name, a.slug as author_slug,
            c.work_id, w.title as work_title, w.slug as work_slug,
            COALESCE(cs.like_count, 0) as like_count,
            CASE WHEN c.author_id = ANY(${followedAuthorIds}) THEN ${config.followedAuthorBoost || 3.0} ELSE 0 END as follow_boost,
            CASE WHEN c.author_id = ANY(${likedAuthorIds}) THEN ${config.likedAuthorBoost || 1.5} ELSE 0 END as like_boost,
            RANDOM() as base_score
          FROM chunks c
          JOIN authors a ON c.author_id = a.id
          LEFT JOIN works w ON c.work_id = w.id
          LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
          WHERE LENGTH(c.text) BETWEEN ${config.minLength} AND ${config.maxLength}
            AND (w.chunk_count > 10 OR c.author_id = ANY(${followedAuthorIds}))
            ${cursorData.recentAuthors.length > 0
              ? sql`AND c.author_id NOT IN ${sql(cursorData.recentAuthors)}`
              : sql``}
            ${cursorData.recentWorks.length > 0
              ? sql`AND c.work_id NOT IN ${sql(cursorData.recentWorks)}`
              : sql``}
        )
        SELECT *,
          (base_score + follow_boost + like_boost) as final_score
        FROM scored_passages
        ORDER BY final_score DESC
        LIMIT ${limit}
      `;
    }
  }

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
