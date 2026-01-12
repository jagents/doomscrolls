import 'dotenv/config';
import { sql } from './client';

// Categories to seed
const CATEGORIES = [
  { id: 'cat-philosophy', name: 'Philosophy', slug: 'philosophy', icon: '🏛️', description: 'Wisdom from the great thinkers', display_order: 1 },
  { id: 'cat-poetry', name: 'Poetry', slug: 'poetry', icon: '📜', description: 'Verses that move the soul', display_order: 2 },
  { id: 'cat-fiction', name: 'Fiction', slug: 'fiction', icon: '📖', description: 'Stories that shaped literature', display_order: 3 },
  { id: 'cat-religion', name: 'Religion & Spirituality', slug: 'religion', icon: '🙏', description: 'Sacred texts and spiritual wisdom', display_order: 4 },
  { id: 'cat-essays', name: 'Essays', slug: 'essays', icon: '✍️', description: 'Thoughtful prose and reflections', display_order: 5 },
  { id: 'cat-drama', name: 'Drama', slug: 'drama', icon: '🎭', description: 'Plays and theatrical works', display_order: 6 },
  { id: 'cat-history', name: 'History', slug: 'history', icon: '📚', description: 'Chronicles of human civilization', display_order: 7 },
  { id: 'cat-stoicism', name: 'Stoicism', slug: 'stoicism', icon: '⚖️', description: 'Ancient wisdom for modern life', display_order: 8 },
  { id: 'cat-romanticism', name: 'Romanticism', slug: 'romanticism', icon: '🌹', description: 'Emotion and nature celebrated', display_order: 9 },
  { id: 'cat-russian', name: 'Russian Literature', slug: 'russian', icon: '🪆', description: 'The great Russian masters', display_order: 10 },
  { id: 'cat-ancient', name: 'Ancient', slug: 'ancient', icon: '🏺', description: 'Works from antiquity', display_order: 11 },
  { id: 'cat-medieval', name: 'Medieval', slug: 'medieval', icon: '🏰', description: 'Middle Ages literature', display_order: 12 },
  { id: 'cat-modern', name: 'Modern', slug: 'modern', icon: '🌆', description: 'Contemporary classics', display_order: 13 },
];

// Curated works for Phase 1 MVP - will be matched by title patterns
const CURATED_WORK_PATTERNS = [
  // Philosophy
  { pattern: '%meditations%', author_pattern: '%aurelius%', priority: 100, notes: 'Marcus Aurelius - Stoic classic', category: 'cat-philosophy' },
  { pattern: '%republic%', author_pattern: '%plato%', priority: 95, notes: 'Plato - Foundation of Western philosophy', category: 'cat-philosophy' },
  { pattern: '%nicomachean%', author_pattern: '%aristotle%', priority: 90, notes: 'Aristotle - Virtue ethics', category: 'cat-philosophy' },
  { pattern: '%zarathustra%', author_pattern: '%nietzsche%', priority: 85, notes: 'Nietzsche - Philosophical masterpiece', category: 'cat-philosophy' },
  { pattern: '%beyond good and evil%', author_pattern: '%nietzsche%', priority: 80, notes: 'Nietzsche', category: 'cat-philosophy' },
  { pattern: '%apology%', author_pattern: '%plato%', priority: 80, notes: 'Plato - Socrates defense', category: 'cat-philosophy' },
  { pattern: '%symposium%', author_pattern: '%plato%', priority: 75, notes: 'Plato - On love', category: 'cat-philosophy' },

  // Stoicism
  { pattern: '%letters%stoic%', author_pattern: '%seneca%', priority: 95, notes: 'Seneca - Accessible Stoic wisdom', category: 'cat-stoicism' },
  { pattern: '%moral letters%', author_pattern: '%seneca%', priority: 95, notes: 'Seneca - Epistles', category: 'cat-stoicism' },
  { pattern: '%discourses%', author_pattern: '%epictetus%', priority: 90, notes: 'Epictetus', category: 'cat-stoicism' },
  { pattern: '%enchiridion%', author_pattern: '%epictetus%', priority: 85, notes: 'Epictetus - Stoic handbook', category: 'cat-stoicism' },

  // Russian Literature
  { pattern: '%war and peace%', author_pattern: '%tolstoy%', priority: 100, notes: 'Tolstoy - Epic masterpiece', category: 'cat-russian' },
  { pattern: '%anna karenina%', author_pattern: '%tolstoy%', priority: 95, notes: 'Tolstoy', category: 'cat-russian' },
  { pattern: '%crime and punishment%', author_pattern: '%dostoevsky%', priority: 95, notes: 'Dostoevsky', category: 'cat-russian' },
  { pattern: '%brothers karamazov%', author_pattern: '%dostoevsky%', priority: 90, notes: 'Dostoevsky', category: 'cat-russian' },
  { pattern: '%notes from underground%', author_pattern: '%dostoevsky%', priority: 85, notes: 'Dostoevsky', category: 'cat-russian' },
  { pattern: '%idiot%', author_pattern: '%dostoevsky%', priority: 85, notes: 'Dostoevsky', category: 'cat-russian' },
  { pattern: '%dead souls%', author_pattern: '%gogol%', priority: 80, notes: 'Gogol', category: 'cat-russian' },

  // English Literature - Fiction
  { pattern: '%pride and prejudice%', author_pattern: '%austen%', priority: 95, notes: 'Austen - Beloved classic', category: 'cat-fiction' },
  { pattern: '%sense and sensibility%', author_pattern: '%austen%', priority: 85, notes: 'Austen', category: 'cat-fiction' },
  { pattern: '%emma%', author_pattern: '%austen%', priority: 85, notes: 'Austen', category: 'cat-fiction' },
  { pattern: '%great expectations%', author_pattern: '%dickens%', priority: 90, notes: 'Dickens', category: 'cat-fiction' },
  { pattern: '%tale of two cities%', author_pattern: '%dickens%', priority: 90, notes: 'Dickens', category: 'cat-fiction' },
  { pattern: '%oliver twist%', author_pattern: '%dickens%', priority: 85, notes: 'Dickens', category: 'cat-fiction' },
  { pattern: '%david copperfield%', author_pattern: '%dickens%', priority: 85, notes: 'Dickens', category: 'cat-fiction' },
  { pattern: '%jane eyre%', author_pattern: '%bronte%', priority: 90, notes: 'Charlotte Bronte', category: 'cat-fiction' },
  { pattern: '%wuthering heights%', author_pattern: '%bronte%', priority: 85, notes: 'Emily Bronte', category: 'cat-fiction' },
  { pattern: '%frankenstein%', author_pattern: '%shelley%', priority: 90, notes: 'Mary Shelley', category: 'cat-fiction' },
  { pattern: '%dracula%', author_pattern: '%stoker%', priority: 85, notes: 'Bram Stoker', category: 'cat-fiction' },

  // American Literature
  { pattern: '%moby%dick%', author_pattern: '%melville%', priority: 90, notes: 'Melville - American epic', category: 'cat-fiction' },
  { pattern: '%great gatsby%', author_pattern: '%fitzgerald%', priority: 95, notes: 'Fitzgerald', category: 'cat-fiction' },
  { pattern: '%walden%', author_pattern: '%thoreau%', priority: 90, notes: 'Thoreau - Transcendentalism', category: 'cat-essays' },
  { pattern: '%leaves of grass%', author_pattern: '%whitman%', priority: 85, notes: 'Whitman - American poetry', category: 'cat-poetry' },
  { pattern: '%adventures of huckleberry%', author_pattern: '%twain%', priority: 90, notes: 'Mark Twain', category: 'cat-fiction' },
  { pattern: '%adventures of tom sawyer%', author_pattern: '%twain%', priority: 85, notes: 'Mark Twain', category: 'cat-fiction' },

  // Poetry
  { pattern: '%sonnets%', author_pattern: '%shakespeare%', priority: 95, notes: 'Shakespeare - Timeless poetry', category: 'cat-poetry' },
  { pattern: '%poems%', author_pattern: '%dickinson%', priority: 85, notes: 'Emily Dickinson', category: 'cat-poetry' },
  { pattern: '%paradise lost%', author_pattern: '%milton%', priority: 85, notes: 'Milton - Epic poem', category: 'cat-poetry' },
  { pattern: '%divine comedy%', author_pattern: '%dante%', priority: 90, notes: 'Dante', category: 'cat-poetry' },
  { pattern: '%inferno%', author_pattern: '%dante%', priority: 90, notes: 'Dante', category: 'cat-poetry' },
  { pattern: '%odyssey%', author_pattern: '%homer%', priority: 95, notes: 'Homer - Ancient epic', category: 'cat-ancient' },
  { pattern: '%iliad%', author_pattern: '%homer%', priority: 95, notes: 'Homer', category: 'cat-ancient' },
  { pattern: '%canterbury tales%', author_pattern: '%chaucer%', priority: 85, notes: 'Chaucer', category: 'cat-medieval' },
  { pattern: '%raven%', author_pattern: '%poe%', priority: 80, notes: 'Edgar Allan Poe', category: 'cat-poetry' },

  // Essays
  { pattern: '%essays%', author_pattern: '%montaigne%', priority: 90, notes: 'Montaigne - Father of essays', category: 'cat-essays' },
  { pattern: '%self-reliance%', author_pattern: '%emerson%', priority: 90, notes: 'Emerson - Transcendentalism', category: 'cat-essays' },
  { pattern: '%nature%', author_pattern: '%emerson%', priority: 85, notes: 'Emerson', category: 'cat-essays' },
  { pattern: '%civil disobedience%', author_pattern: '%thoreau%', priority: 85, notes: 'Thoreau', category: 'cat-essays' },

  // Religion/Spirituality
  { pattern: '%tao te ching%', author_pattern: '%lao%', priority: 95, notes: 'Lao Tzu - Taoist wisdom', category: 'cat-religion' },
  { pattern: '%bhagavad%gita%', author_pattern: '%', priority: 90, notes: 'Hindu scripture', category: 'cat-religion' },
  { pattern: '%art of war%', author_pattern: '%sun%', priority: 90, notes: 'Sun Tzu - Strategic wisdom', category: 'cat-philosophy' },
  { pattern: '%confessions%', author_pattern: '%augustine%', priority: 85, notes: 'Augustine', category: 'cat-religion' },

  // Drama - Shakespeare
  { pattern: '%hamlet%', author_pattern: '%shakespeare%', priority: 95, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%macbeth%', author_pattern: '%shakespeare%', priority: 90, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%othello%', author_pattern: '%shakespeare%', priority: 85, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%king lear%', author_pattern: '%shakespeare%', priority: 85, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%midsummer night%', author_pattern: '%shakespeare%', priority: 80, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%romeo and juliet%', author_pattern: '%shakespeare%', priority: 90, notes: 'Shakespeare', category: 'cat-drama' },
  { pattern: '%merchant of venice%', author_pattern: '%shakespeare%', priority: 80, notes: 'Shakespeare', category: 'cat-drama' },

  // Drama - Greek
  { pattern: '%oedipus%', author_pattern: '%sophocles%', priority: 90, notes: 'Sophocles', category: 'cat-ancient' },
  { pattern: '%antigone%', author_pattern: '%sophocles%', priority: 85, notes: 'Sophocles', category: 'cat-ancient' },
  { pattern: '%medea%', author_pattern: '%euripides%', priority: 85, notes: 'Euripides', category: 'cat-ancient' },
];

async function seedCategories() {
  console.log('Seeding categories...');

  for (const cat of CATEGORIES) {
    await sql`
      INSERT INTO categories (id, name, slug, icon, description, display_order)
      VALUES (${cat.id}, ${cat.name}, ${cat.slug}, ${cat.icon}, ${cat.description}, ${cat.display_order})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        icon = EXCLUDED.icon,
        description = EXCLUDED.description,
        display_order = EXCLUDED.display_order
    `;
  }

  console.log(`  Seeded ${CATEGORIES.length} categories`);
}

async function seedCuratedWorks() {
  console.log('Seeding curated works...');

  let matched = 0;
  let notFound = 0;

  for (const pattern of CURATED_WORK_PATTERNS) {
    // Find works matching this pattern
    const works = await sql`
      SELECT w.id, w.title, a.name as author_name
      FROM works w
      JOIN authors a ON w.author_id = a.id
      WHERE LOWER(w.title) LIKE LOWER(${pattern.pattern})
        AND LOWER(a.name) LIKE LOWER(${pattern.author_pattern})
      LIMIT 5
    `;

    if (works.length > 0) {
      for (const work of works) {
        // Add to curated_works
        await sql`
          INSERT INTO curated_works (work_id, priority, notes)
          VALUES (${work.id}, ${pattern.priority}, ${pattern.notes})
          ON CONFLICT (work_id) DO UPDATE SET
            priority = GREATEST(curated_works.priority, EXCLUDED.priority),
            notes = EXCLUDED.notes
        `;

        // Add to work_categories
        await sql`
          INSERT INTO work_categories (work_id, category_id)
          VALUES (${work.id}, ${pattern.category})
          ON CONFLICT DO NOTHING
        `;

        matched++;
      }
      console.log(`  + Found ${works.length} works for pattern "${pattern.pattern}"`);
    } else {
      notFound++;
      console.log(`  - No match for pattern "${pattern.pattern}" by "${pattern.author_pattern}"`);
    }
  }

  console.log(`  Matched ${matched} works, ${notFound} patterns had no matches`);
}

async function main() {
  console.log('Starting database seed...\n');

  try {
    // Run schema first
    console.log('Creating tables if not exist...');

    await sql`
      CREATE TABLE IF NOT EXISTS chunk_stats (
        chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
        like_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_chunk_stats_like_count ON chunk_stats(like_count DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS curated_works (
        work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_curated_works_priority ON curated_works(priority DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT,
        description TEXT,
        display_order INTEGER DEFAULT 0
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order ASC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS work_categories (
        work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (work_id, category_id)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_work_categories_category ON work_categories(category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_work_categories_work ON work_categories(work_id)`;

    // App config table for admin dashboard
    await sql`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Seed default feed algorithm config
    await sql`
      INSERT INTO app_config (key, value) VALUES
        ('feed_algorithm', ${sql.json({
          maxAuthorRepeat: 10,
          maxWorkRepeat: 20,
          minLength: 50,
          maxLength: 1000
        })})
      ON CONFLICT (key) DO NOTHING
    `;

    console.log('Tables created successfully\n');

    // Seed data
    await seedCategories();
    console.log('');
    await seedCuratedWorks();

    // Print summary
    console.log('\n--- Summary ---');
    const [catCount] = await sql`SELECT COUNT(*) as count FROM categories`;
    const [curatedCount] = await sql`SELECT COUNT(*) as count FROM curated_works`;
    const [wcCount] = await sql`SELECT COUNT(*) as count FROM work_categories`;

    console.log(`Categories: ${catCount.count}`);
    console.log(`Curated works: ${curatedCount.count}`);
    console.log(`Work-category mappings: ${wcCount.count}`);

    console.log('\nSeed completed successfully!');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  await sql.end();
}

main();
