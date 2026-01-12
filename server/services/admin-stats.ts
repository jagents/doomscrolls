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

export interface Phase2Stats {
  users: {
    total: number;
    activeThisWeek: number;
    withLikes: number;
    withFollows: number;
  };
  embeddings: {
    total: number;
    withEmbeddings: number;
    percentComplete: number;
  };
  lists: {
    total: number;
    curated: number;
    totalPassagesInLists: number;
  };
  follows: {
    totalFollows: number;
    topAuthors: Array<{ name: string; slug: string; followers: number }>;
  };
}

export async function getPhase2Stats(): Promise<Phase2Stats> {
  const [
    [usersTotal],
    [usersActive],
    [usersWithLikes],
    [usersWithFollows],
    [embeddingsTotal],
    [embeddingsCount],
    [listsTotal],
    [listsCurated],
    [listsPassages],
    [followsTotal],
    topFollowedAuthors
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM users`,
    sql`SELECT COUNT(DISTINCT user_id)::int as count FROM user_likes WHERE liked_at > NOW() - INTERVAL '7 days'`,
    sql`SELECT COUNT(DISTINCT user_id)::int as count FROM user_likes`,
    sql`SELECT COUNT(DISTINCT user_id)::int as count FROM user_follows`,
    sql`SELECT COUNT(*)::int as count FROM chunks`,
    sql`SELECT COUNT(*)::int as count FROM chunks WHERE embedding IS NOT NULL`,
    sql`SELECT COUNT(*)::int as count FROM lists`,
    sql`SELECT COUNT(*)::int as count FROM lists WHERE is_curated = true`,
    sql`SELECT COUNT(*)::int as count FROM list_chunks`,
    sql`SELECT COUNT(*)::int as count FROM user_follows`,
    sql`
      SELECT a.name, a.slug, COUNT(uf.id)::int as followers
      FROM authors a
      JOIN user_follows uf ON a.id = uf.author_id
      GROUP BY a.id, a.name, a.slug
      ORDER BY followers DESC
      LIMIT 5
    `
  ]);

  const totalChunks = embeddingsTotal.count || 1;
  const withEmbeddings = embeddingsCount.count || 0;

  return {
    users: {
      total: usersTotal.count,
      activeThisWeek: usersActive.count,
      withLikes: usersWithLikes.count,
      withFollows: usersWithFollows.count,
    },
    embeddings: {
      total: totalChunks,
      withEmbeddings,
      percentComplete: Math.round((withEmbeddings / totalChunks) * 100),
    },
    lists: {
      total: listsTotal.count,
      curated: listsCurated.count,
      totalPassagesInLists: listsPassages.count,
    },
    follows: {
      totalFollows: followsTotal.count,
      topAuthors: topFollowedAuthors.map(row => ({
        name: row.name,
        slug: row.slug,
        followers: row.followers,
      })),
    },
  };
}
