import { sql } from '../db/client';
import { formatPassage } from './formatters';
import type { FeedOptions, FeedResponse, CursorData } from '../types';

interface FeedConfig {
  maxAuthorRepeat: number;
  maxWorkRepeat: number;
}

const DEFAULT_CONFIG: FeedConfig = {
  maxAuthorRepeat: 10,
  maxWorkRepeat: 20,
};

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

export async function generateFeed(options: FeedOptions): Promise<FeedResponse> {
  const { category, limit, cursor } = options;

  const cursorData = cursor ? decodeCursor(cursor) : {
    recentAuthors: [],
    recentWorks: [],
    offset: 0
  };

  let passages;

  // Check if we have curated works, if not fall back to all works
  const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
  const hasCuratedWorks = parseInt(curatedCount.count) > 0;

  if (category && category !== 'for-you') {
    // Category-filtered feed
    if (hasCuratedWorks) {
      passages = await sql`
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
          AND LENGTH(c.text) BETWEEN 50 AND 1000
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
      // Fallback without curated_works
      passages = await sql`
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
          AND LENGTH(c.text) BETWEEN 50 AND 1000
        ORDER BY RANDOM()
        LIMIT ${limit}
      `;
    }
  } else {
    // Main feed (for-you or default)
    if (hasCuratedWorks) {
      passages = await sql`
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
        WHERE LENGTH(c.text) BETWEEN 50 AND 1000
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
      // Fallback: sample from all works with good chunk counts
      passages = await sql`
        SELECT
          c.id, c.text, c.type,
          c.author_id, a.name as author_name, a.slug as author_slug,
          c.work_id, w.title as work_title, w.slug as work_slug,
          COALESCE(cs.like_count, 0) as like_count
        FROM chunks c
        JOIN authors a ON c.author_id = a.id
        LEFT JOIN works w ON c.work_id = w.id
        LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
        WHERE LENGTH(c.text) BETWEEN 50 AND 1000
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

  // Build next cursor with recent author/work IDs for diversity
  const newRecentAuthors = [
    ...cursorData.recentAuthors,
    ...passages.map((p: any) => p.author_id),
  ].slice(-DEFAULT_CONFIG.maxAuthorRepeat);

  const newRecentWorks = [
    ...cursorData.recentWorks,
    ...passages.filter((p: any) => p.work_id).map((p: any) => p.work_id),
  ].slice(-DEFAULT_CONFIG.maxWorkRepeat);

  const nextCursor = passages.length > 0 ? encodeCursor({
    recentAuthors: newRecentAuthors,
    recentWorks: newRecentWorks,
    offset: cursorData.offset + passages.length,
  }) : null;

  return {
    passages: passages.map(formatPassage),
    nextCursor,
    hasMore: passages.length === limit,
  };
}
