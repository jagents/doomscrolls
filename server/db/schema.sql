-- =============================================================================
-- DOOMSCROLLS PHASE 1 SCHEMA ADDITIONS
-- Run against existing Neon database with authors, works, chunks tables
-- =============================================================================

-- Global like/view counts per passage
CREATE TABLE IF NOT EXISTS chunk_stats (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_stats_like_count ON chunk_stats(like_count DESC);

-- Curated top works for Phase 1 (subset of full corpus)
CREATE TABLE IF NOT EXISTS curated_works (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_curated_works_priority ON curated_works(priority DESC);

-- Categories for filtering
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order ASC);

-- Many-to-many: works <-> categories
CREATE TABLE IF NOT EXISTS work_categories (
  work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_work_categories_category ON work_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_work_categories_work ON work_categories(work_id);
