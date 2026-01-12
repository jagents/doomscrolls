import { sql } from '../db/client';
import { formatPassage } from './formatters';
import { getFeedConfig, FeedAlgorithmConfig } from './config';
import type { FeedOptions, FeedResponse, CursorData } from '../types';

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
