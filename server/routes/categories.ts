import { Hono } from 'hono';
import { sql } from '../db/client';

const categories = new Hono();

// GET /api/categories
categories.get('/', async (c) => {
  const results = await sql`
    SELECT
      cat.id, cat.name, cat.slug, cat.icon, cat.description, cat.display_order,
      COUNT(wc.work_id)::int as work_count
    FROM categories cat
    LEFT JOIN work_categories wc ON cat.id = wc.category_id
    GROUP BY cat.id
    ORDER BY cat.display_order ASC
  `;

  return c.json({ categories: results });
});

// GET /api/categories/:slug
categories.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const [category] = await sql`
    SELECT * FROM categories WHERE slug = ${slug}
  `;

  if (!category) {
    return c.json({ error: 'Category not found' }, 404);
  }

  return c.json(category);
});

export { categories };
