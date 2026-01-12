import 'dotenv/config';
import { sql } from './client';

/**
 * Phase 2 Database Migration
 * Creates all new tables for user accounts, sync, lists, reading progress, etc.
 */

async function migrate() {
  console.log('Starting Phase 2 migration...\n');

  try {
    // =============================================================================
    // USER ACCOUNTS
    // =============================================================================
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        email_verified BOOLEAN DEFAULT FALSE,
        settings JSONB DEFAULT '{}'::jsonb
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;

    // =============================================================================
    // REFRESH TOKENS (for JWT refresh)
    // =============================================================================
    console.log('Creating refresh_tokens table...');
    await sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`;

    // =============================================================================
    // USER LIKES (replaces localStorage for logged-in users)
    // =============================================================================
    console.log('Creating user_likes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_likes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, chunk_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_likes_user ON user_likes(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_likes_chunk ON user_likes(chunk_id)`;

    // =============================================================================
    // USER BOOKMARKS
    // =============================================================================
    console.log('Creating user_bookmarks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, chunk_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id)`;

    // =============================================================================
    // AUTHOR FOLLOWS
    // =============================================================================
    console.log('Creating user_follows table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_follows (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, author_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_follows_user ON user_follows(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_follows_author ON user_follows(author_id)`;

    // =============================================================================
    // LISTS (user-created and curated)
    // =============================================================================
    console.log('Creating lists table...');
    await sql`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        slug TEXT UNIQUE NOT NULL,
        is_public BOOLEAN DEFAULT TRUE,
        is_curated BOOLEAN DEFAULT FALSE,
        cover_image_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lists_slug ON lists(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_lists_curated ON lists(is_curated) WHERE is_curated = TRUE`;

    // =============================================================================
    // LIST CHUNKS (passages in a list)
    // =============================================================================
    console.log('Creating list_chunks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS list_chunks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(list_id, chunk_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_list_chunks_list ON list_chunks(list_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_list_chunks_position ON list_chunks(list_id, position)`;

    // =============================================================================
    // READING PROGRESS (for full work reader)
    // =============================================================================
    console.log('Creating reading_progress table...');
    await sql`
      CREATE TABLE IF NOT EXISTS reading_progress (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
        current_chunk_index INTEGER NOT NULL DEFAULT 0,
        total_chunks INTEGER NOT NULL,
        last_read_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        UNIQUE(user_id, work_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id)`;

    // =============================================================================
    // USER STATS (aggregated for performance)
    // =============================================================================
    console.log('Creating user_stats table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        passages_read INTEGER DEFAULT 0,
        passages_liked INTEGER DEFAULT 0,
        passages_bookmarked INTEGER DEFAULT 0,
        authors_explored INTEGER DEFAULT 0,
        works_explored INTEGER DEFAULT 0,
        total_reading_time_seconds INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // =============================================================================
    // USER TASTE VECTORS (for embedding-based personalization)
    // Requires pgvector extension - will fail gracefully if not available
    // =============================================================================
    console.log('Creating user_taste_vectors table (requires pgvector)...');
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      await sql`
        CREATE TABLE IF NOT EXISTS user_taste_vectors (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          taste_vector vector(1536) NOT NULL,
          based_on_count INTEGER NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      console.log('  pgvector extension and user_taste_vectors created');
    } catch (error) {
      console.log('  pgvector not available - skipping user_taste_vectors table');
      console.log('  (This is OK - taste vectors will be skipped until pgvector is enabled)');
    }

    // =============================================================================
    // SEARCH VECTORS (for full-text search)
    // =============================================================================
    console.log('Adding search vectors to existing tables...');

    // Add search_vector column to chunks if not exists
    try {
      await sql`ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_vector tsvector`;
      await sql`CREATE INDEX IF NOT EXISTS idx_chunks_search ON chunks USING GIN(search_vector)`;
    } catch (error) {
      console.log('  chunks.search_vector may already exist');
    }

    // Add search_vector to authors
    try {
      await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS search_vector tsvector`;
      await sql`CREATE INDEX IF NOT EXISTS idx_authors_search ON authors USING GIN(search_vector)`;
    } catch (error) {
      console.log('  authors.search_vector may already exist');
    }

    // Add search_vector to works
    try {
      await sql`ALTER TABLE works ADD COLUMN IF NOT EXISTS search_vector tsvector`;
      await sql`CREATE INDEX IF NOT EXISTS idx_works_search ON works USING GIN(search_vector)`;
    } catch (error) {
      console.log('  works.search_vector may already exist');
    }

    // =============================================================================
    // AUTHOR ENRICHMENT COLUMNS
    // =============================================================================
    console.log('Adding author enrichment columns...');
    try {
      await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio TEXT`;
      await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio_generated_at TIMESTAMPTZ`;
      await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS image_url TEXT`;
    } catch (error) {
      console.log('  Author enrichment columns may already exist');
    }

    // =============================================================================
    // UPDATE PERSONALIZATION CONFIG
    // =============================================================================
    console.log('Updating feed algorithm config with personalization settings...');
    const [existingConfig] = await sql`
      SELECT value FROM app_config WHERE key = 'feed_algorithm'
    `;

    if (existingConfig) {
      const currentConfig = existingConfig.value;
      const updatedConfig = {
        ...currentConfig,
        // Add new Phase 2 personalization settings
        enablePersonalization: true,
        followedAuthorBoost: 3.0,
        likedAuthorBoost: 1.5,
        likedCategoryBoost: 1.3,
        bookmarkedWorkBoost: 1.2,
        minSignalsForPersonalization: 5,
        fullCorpusForLoggedIn: true,
        // Embedding settings
        enableEmbeddingSimilarity: true,
        embeddingSimilarityWeight: 0.5,
        minLikesForTasteVector: 5,
        tasteVectorRefreshHours: 1,
      };

      await sql`
        UPDATE app_config
        SET value = ${sql.json(updatedConfig)}, updated_at = NOW()
        WHERE key = 'feed_algorithm'
      `;
    }

    // =============================================================================
    // SUMMARY
    // =============================================================================
    console.log('\n--- Migration Summary ---');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('Tables in database:');
    for (const t of tables) {
      console.log(`  - ${t.table_name}`);
    }

    console.log('\nPhase 2 migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await sql.end();
}

migrate();
