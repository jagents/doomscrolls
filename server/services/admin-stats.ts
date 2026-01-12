import { sql } from '../db/client';

export interface DatasetStats {
  chunks: number;
  works: number;
  authors: number;
  curatedWorks: number;
  categories: number;
  categoryBreakdown: Array<{
    name: string;
    slug: string;
    icon: string;
    workCount: number;
  }>;
}

export interface FeedStats {
  totalLikes: number;
  totalViews: number;
  topPassages: Array<{
    id: string;
    text: string;
    authorName: string;
    workTitle: string | null;
    likeCount: number;
  }>;
}

export async function getDatasetStats(): Promise<DatasetStats> {
  // Run queries in parallel
  const [
    [chunksResult],
    [worksResult],
    [authorsResult],
    [curatedResult],
    [categoriesResult],
    categoryBreakdown
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM chunks`,
    sql`SELECT COUNT(*)::int as count FROM works`,
    sql`SELECT COUNT(*)::int as count FROM authors`,
    sql`SELECT COUNT(*)::int as count FROM curated_works`,
    sql`SELECT COUNT(*)::int as count FROM categories`,
    sql`
      SELECT
        c.name,
        c.slug,
        c.icon,
        COUNT(wc.work_id)::int as work_count
      FROM categories c
      LEFT JOIN work_categories wc ON c.id = wc.category_id
      GROUP BY c.id, c.name, c.slug, c.icon
      ORDER BY c.display_order ASC
    `
  ]);

  return {
    chunks: chunksResult.count,
    works: worksResult.count,
    authors: authorsResult.count,
    curatedWorks: curatedResult.count,
    categories: categoriesResult.count,
    categoryBreakdown: categoryBreakdown.map(row => ({
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      workCount: row.work_count
    }))
  };
}

export async function getFeedStats(): Promise<FeedStats> {
  const [
    [likesResult],
    [viewsResult],
    topPassages
  ] = await Promise.all([
    sql`SELECT COALESCE(SUM(like_count), 0)::int as total FROM chunk_stats`,
    sql`SELECT COALESCE(SUM(view_count), 0)::int as total FROM chunk_stats`,
    sql`
      SELECT
        c.id,
        LEFT(c.text, 200) as text,
        a.name as author_name,
        w.title as work_title,
        cs.like_count
      FROM chunk_stats cs
      JOIN chunks c ON cs.chunk_id = c.id
      JOIN authors a ON c.author_id = a.id
      LEFT JOIN works w ON c.work_id = w.id
      WHERE cs.like_count > 0
      ORDER BY cs.like_count DESC
      LIMIT 10
    `
  ]);

  return {
    totalLikes: likesResult.total,
    totalViews: viewsResult.total,
    topPassages: topPassages.map(row => ({
      id: row.id,
      text: row.text,
      authorName: row.author_name,
      workTitle: row.work_title,
      likeCount: row.like_count
    }))
  };
}
