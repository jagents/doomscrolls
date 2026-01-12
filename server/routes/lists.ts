import { Hono } from 'hono';
import { sql } from '../db/client';
import { requireAuth, optionalAuth, getCurrentUser } from '../middleware/auth';
import { formatPassage } from '../services/formatters';

const lists = new Hono();

// Helper to check if string looks like a UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Helper to find list by id or slug
async function findList(idOrSlug: string) {
  if (isUUID(idOrSlug)) {
    const [list] = await sql`SELECT * FROM lists WHERE id = ${idOrSlug}`;
    return list;
  }
  const [list] = await sql`SELECT * FROM lists WHERE slug = ${idOrSlug}`;
  return list;
}

// Helper to find list owned by user (by id or slug)
async function findOwnedList(idOrSlug: string, userId: string) {
  if (isUUID(idOrSlug)) {
    const [list] = await sql`SELECT * FROM lists WHERE id = ${idOrSlug} AND user_id = ${userId}`;
    return list;
  }
  const [list] = await sql`SELECT * FROM lists WHERE slug = ${idOrSlug} AND user_id = ${userId}`;
  return list;
}

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// GET /api/lists - Get user's lists (authenticated) or curated lists (anonymous)
lists.get('/', optionalAuth, async (c) => {
  const currentUser = getCurrentUser(c);

  if (currentUser) {
    // Get user's lists + curated lists
    const userLists = await sql`
      SELECT
        l.*,
        (SELECT COUNT(*) FROM list_chunks WHERE list_id = l.id) as chunk_count
      FROM lists l
      WHERE l.user_id = ${currentUser.userId}
         OR l.is_curated = TRUE
      ORDER BY l.is_curated DESC, l.updated_at DESC
    `;

    return c.json({
      lists: userLists.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        description: l.description,
        isPublic: l.is_public,
        isCurated: l.is_curated,
        isOwner: l.user_id === currentUser.userId,
        chunkCount: parseInt(l.chunk_count),
        coverImageUrl: l.cover_image_url,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
    });
  } else {
    // Anonymous: only curated lists
    const curatedLists = await sql`
      SELECT
        l.*,
        (SELECT COUNT(*) FROM list_chunks WHERE list_id = l.id) as chunk_count
      FROM lists l
      WHERE l.is_curated = TRUE
      ORDER BY l.name ASC
    `;

    return c.json({
      lists: curatedLists.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        description: l.description,
        isPublic: true,
        isCurated: true,
        isOwner: false,
        chunkCount: parseInt(l.chunk_count),
        coverImageUrl: l.cover_image_url,
        createdAt: l.created_at,
      })),
    });
  }
});

// GET /api/lists/curated - Get only curated lists
lists.get('/curated', async (c) => {
  const curatedLists = await sql`
    SELECT
      l.*,
      (SELECT COUNT(*) FROM list_chunks WHERE list_id = l.id) as chunk_count
    FROM lists l
    WHERE l.is_curated = TRUE
    ORDER BY l.name ASC
  `;

  return c.json({
    lists: curatedLists.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      description: l.description,
      chunkCount: parseInt(l.chunk_count),
      coverImageUrl: l.cover_image_url,
    })),
  });
});

// POST /api/lists - Create new list
lists.post('/', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const body = await c.req.json();
  const { name, description, isPublic = true } = body;

  if (!name || name.trim().length === 0) {
    return c.json({ error: 'Name is required' }, 400);
  }

  // Generate unique slug
  let slug = generateSlug(name);
  const [existing] = await sql`SELECT id FROM lists WHERE slug = ${slug}`;
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const [list] = await sql`
    INSERT INTO lists (user_id, name, description, slug, is_public)
    VALUES (${currentUser.userId}, ${name.trim()}, ${description || null}, ${slug}, ${isPublic})
    RETURNING *
  `;

  return c.json({
    list: {
      id: list.id,
      name: list.name,
      slug: list.slug,
      description: list.description,
      isPublic: list.is_public,
      isCurated: false,
      isOwner: true,
      chunkCount: 0,
      createdAt: list.created_at,
    },
  });
});

// GET /api/lists/:idOrSlug - Get list details with passages
lists.get('/:idOrSlug', optionalAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);

  const list = await findList(idOrSlug);

  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  // Check access
  const isOwner = currentUser && list.user_id === currentUser.userId;
  if (!list.is_public && !list.is_curated && !isOwner) {
    return c.json({ error: 'List not found' }, 404);
  }

  // Get passages in list
  const chunks = await sql`
    SELECT
      c.id, c.text, c.type,
      a.id as author_id, a.name as author_name, a.slug as author_slug,
      w.id as work_id, w.title as work_title, w.slug as work_slug,
      COALESCE(cs.like_count, 0) as like_count,
      lc.position,
      lc.note,
      lc.added_at
    FROM list_chunks lc
    JOIN chunks c ON lc.chunk_id = c.id
    JOIN authors a ON c.author_id = a.id
    LEFT JOIN works w ON c.work_id = w.id
    LEFT JOIN chunk_stats cs ON c.id = cs.chunk_id
    WHERE lc.list_id = ${list.id}
    ORDER BY lc.position ASC
  `;

  return c.json({
    list: {
      id: list.id,
      name: list.name,
      slug: list.slug,
      description: list.description,
      isPublic: list.is_public,
      isCurated: list.is_curated,
      isOwner,
      chunkCount: chunks.length,
      coverImageUrl: list.cover_image_url,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
    },
    passages: chunks.map((chunk) => ({
      ...formatPassage(chunk),
      position: chunk.position,
      note: chunk.note,
      addedAt: chunk.added_at,
    })),
  });
});

// PUT /api/lists/:idOrSlug - Update list
lists.put('/:idOrSlug', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  const body = await c.req.json();
  const { name, description, isPublic } = body;

  const [updated] = await sql`
    UPDATE lists
    SET
      name = COALESCE(${name}, name),
      description = COALESCE(${description}, description),
      is_public = COALESCE(${isPublic}, is_public),
      updated_at = NOW()
    WHERE id = ${list.id}
    RETURNING *
  `;

  return c.json({
    list: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      isPublic: updated.is_public,
      isCurated: updated.is_curated,
      isOwner: true,
    },
  });
});

// DELETE /api/lists/:idOrSlug - Delete list
lists.delete('/:idOrSlug', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  // Can't delete curated lists
  if (list.is_curated) {
    return c.json({ error: 'Cannot delete curated lists' }, 403);
  }

  await sql`DELETE FROM lists WHERE id = ${list.id}`;

  return c.json({ success: true });
});

// POST /api/lists/:idOrSlug/chunks - Add passage to list (also supports /passages)
lists.post('/:idOrSlug/chunks', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  const body = await c.req.json();
  const { chunkId, note } = body;

  if (!chunkId) {
    return c.json({ error: 'chunkId is required' }, 400);
  }

  // Get max position
  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 as next_pos
    FROM list_chunks WHERE list_id = ${list.id}
  `;

  try {
    await sql`
      INSERT INTO list_chunks (list_id, chunk_id, position, note)
      VALUES (${list.id}, ${chunkId}, ${maxPos.next_pos}, ${note || null})
      ON CONFLICT (list_id, chunk_id) DO UPDATE SET note = ${note || null}
    `;

    // Update list timestamp
    await sql`UPDATE lists SET updated_at = NOW() WHERE id = ${list.id}`;

    return c.json({ success: true, position: maxPos.next_pos });
  } catch (error) {
    return c.json({ error: 'Failed to add passage to list' }, 400);
  }
});

// Alias: POST /api/lists/:idOrSlug/passages
lists.post('/:idOrSlug/passages', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  const body = await c.req.json();
  const { chunkId, note } = body;

  if (!chunkId) {
    return c.json({ error: 'chunkId is required' }, 400);
  }

  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 as next_pos
    FROM list_chunks WHERE list_id = ${list.id}
  `;

  try {
    await sql`
      INSERT INTO list_chunks (list_id, chunk_id, position, note)
      VALUES (${list.id}, ${chunkId}, ${maxPos.next_pos}, ${note || null})
      ON CONFLICT (list_id, chunk_id) DO UPDATE SET note = ${note || null}
    `;

    await sql`UPDATE lists SET updated_at = NOW() WHERE id = ${list.id}`;

    return c.json({ success: true, position: maxPos.next_pos });
  } catch (error) {
    return c.json({ error: 'Failed to add passage to list' }, 400);
  }
});

// DELETE /api/lists/:idOrSlug/chunks/:chunkId - Remove passage from list
lists.delete('/:idOrSlug/chunks/:chunkId', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const chunkId = c.req.param('chunkId');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  await sql`
    DELETE FROM list_chunks
    WHERE list_id = ${list.id} AND chunk_id = ${chunkId}
  `;

  await sql`UPDATE lists SET updated_at = NOW() WHERE id = ${list.id}`;

  return c.json({ success: true });
});

// Alias: DELETE /api/lists/:idOrSlug/passages/:chunkId
lists.delete('/:idOrSlug/passages/:chunkId', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const chunkId = c.req.param('chunkId');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  await sql`
    DELETE FROM list_chunks
    WHERE list_id = ${list.id} AND chunk_id = ${chunkId}
  `;

  await sql`UPDATE lists SET updated_at = NOW() WHERE id = ${list.id}`;

  return c.json({ success: true });
});

// PUT /api/lists/:idOrSlug/chunks/reorder - Reorder passages in list
lists.put('/:idOrSlug/chunks/reorder', requireAuth, async (c) => {
  const idOrSlug = c.req.param('idOrSlug');
  const currentUser = getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const list = await findOwnedList(idOrSlug, currentUser.userId);

  if (!list) {
    return c.json({ error: 'List not found or not authorized' }, 404);
  }

  const body = await c.req.json();
  const { order } = body; // Array of chunk IDs in new order

  if (!Array.isArray(order)) {
    return c.json({ error: 'order must be an array of chunk IDs' }, 400);
  }

  // Update positions
  for (let i = 0; i < order.length; i++) {
    await sql`
      UPDATE list_chunks
      SET position = ${i}
      WHERE list_id = ${list.id} AND chunk_id = ${order[i]}
    `;
  }

  await sql`UPDATE lists SET updated_at = NOW() WHERE id = ${list.id}`;

  return c.json({ success: true });
});

export { lists };
