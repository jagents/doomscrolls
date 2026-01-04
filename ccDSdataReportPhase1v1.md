# Doomscrolls Data Ingestion Report

**Date:** 2026-01-04
**Status:** Phase 1 + Phase 2A + Phase 3 Complete

---

## Executive Summary

The data ingestion pipeline for Doomscrolls has been successfully built and executed through Phase 3. All three content sources (PoetryDB, Bible API, Wikiquote) have been ingested and combined into a unified dataset ready for database import.

### Final Statistics (After Phase 3)

| Metric | Count |
|--------|-------|
| **Total Unique Authors** | 491 |
| **Total Works** | 3,457 |
| **Total Content Chunks** | 74,524 |
| **Total Data Size** | ~58 MB (combined) |

### Phase Progression

| Phase | Wikiquote Authors | Total Chunks | Data Size |
|-------|-------------------|--------------|-----------|
| Phase 1 | 69 | 48,955 | 41 MB |
| Phase 2A | 198 (+129) | 66,691 (+17,736) | 53 MB |
| Phase 3 | 381 (+183) | 74,524 (+7,833) | 58 MB |

---

## Source Breakdown

### Coverage Summary

| Source | Coverage | Notes |
|--------|----------|-------|
| PoetryDB | **100%** | All authors and poems available via API |
| Bible (KJV) | **~99.7%** | 31,009 of ~31,102 verses (API bug on single-chapter books) |
| Wikiquote | **Sampled** | 198 curated authors (Tier 1 + Tier 2) |

### PoetryDB
- **Authors:** 129
- **Poems:** 3,010
- **Coverage:** 100% of API content
- **Data Size:** 14 MB

Notable collections include:
- Emily Dickinson: 362 poems
- George Gordon, Lord Byron: 302 poems
- Percy Bysshe Shelley: 277 poems
- William Shakespeare: 160 poems
- Edward Thomas: 129 poems
- John Clare: 126 poems

### Bible (KJV)
- **Author:** 1 (Various - Biblical)
- **Books:** 66
- **Chapters:** 1,189
- **Verses:** 31,009
- **Coverage:** ~99.7% (31,009 of ~31,102 verses)
- **Data Size:** 17 MB

Complete Old and New Testament coverage with verse-level granularity. Each verse is stored as an individual chunk with full metadata including book, chapter, verse number, and reference string.

**Known Gap:** Single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude) returned only 1 verse each due to an API quirk - missing ~93 verses total.

### Wikiquote (Phase 3 Complete)
- **Authors:** 381 (69 Tier 1 + 129 Tier 2 + 183 Tier 3)
- **Quotes:** 40,505
- **Coverage:** Expanded (381 authors from category crawl + curated lists)
- **Data Size:** 35 MB

#### Tier System

| Tier | Authors | Quotes | Description |
|------|---------|--------|-------------|
| **Tier 1** | 69 | 14,936 | Original curated list (Phase 1) |
| **Tier 2** | 129 | 17,736 | Expanded list (Phase 2A) |
| **Tier 3** | 183 | 7,833 | Category crawl (Phase 3) |

#### Tier 1 Categories (Original 70)
- Ancient Philosophy: Stoics, Greeks, Romans
- Eastern Philosophy: Confucius, Lao Tzu, Sun Tzu, Buddha
- Enlightenment/Modern Philosophy: Voltaire, Kant, Nietzsche, etc.
- American Writers: Emerson, Thoreau, Twain, Hemingway, etc.
- British Writers: Shakespeare, Wilde, Orwell, etc.
- Russian/European Writers: Tolstoy, Dostoevsky, Kafka, Goethe
- Romantic Poets: Dickinson, Frost, Blake, Keats, etc.
- Scientists: Einstein, Newton, Sagan, Darwin
- Historical Figures: Churchill, Lincoln, Gandhi, MLK
- Wit & Aphorists: Parker, Bierce, Mencken, Chesterton

#### Tier 2 Categories (Expanded 130)
- Philosophers (23): Russell, Wittgenstein, Locke, Hume, Marx, etc.
- American Writers (20): Poe, Steinbeck, Vonnegut, Baldwin, Morrison, etc.
- British Writers (20): Hardy, Conrad, Lewis, Tolkien, Eliot, Milton, etc.
- World Literature (19): García Márquez, Borges, Rumi, Tagore, Proust, etc.
- Ancient/Classical (15): Sophocles, Homer, Virgil, Ovid, etc.
- Historical Figures (18): Jefferson, Napoleon, Caesar, Elizabeth I, etc.
- Modern Thinkers (15): Chomsky, Jung, Freud, Frankl, etc.

#### Tier 3 Categories (Crawled from Wikiquote)
- Writers (45), Philosophers (96), Poets (30), Scientists (9), Politicians (12)
- Novelists (5), Playwrights (30), Essayists (30), Historians (10), Journalists (139)
- Artists (48), Composers (30), Film Directors (2), Economists (4)
- Mathematicians (4), Lawyers (1), Monarchs (30)

**Note:** 526 authors discovered, 183 passed quality filter (min 10 quotes)

#### Top Quote Collections (Combined)
| Author | Quotes | Tier |
|--------|--------|------|
| Winston Churchill | 563 | 1 |
| Abraham Lincoln | 550 | 1 |
| John F. Kennedy | 519 | 2 |
| Bertrand Russell | 513 | 2 |
| Albert Einstein | 511 | 1 |
| Martin Luther King Jr. | 463 | 1 |
| Thomas Jefferson | 428 | 2 |
| Friedrich Nietzsche | 429 | 1 |
| Marshall McLuhan | 408 | 2 |
| Noam Chomsky | 396 | 2 |

---

## Data Models

### Author
```typescript
{
  id: string;           // UUID v4
  name: string;         // "William Shakespeare"
  slug: string;         // "william-shakespeare"
  birth_year: number | null;
  death_year: number | null;
  nationality: string | null;
  era: string | null;   // Ancient/Medieval/Renaissance/etc.
  bio: string | null;
  wikipedia_url: string | null;
  created_at: string;   // ISO timestamp
}
```

### WikiquoteAuthor (Extended)
```typescript
{
  // ... all Author fields plus:
  wikiquote_url: string;
  quote_count: number;
  discovery_method: 'curated' | 'category-crawl';
  tier: 1 | 2 | 3;
}
```

### Work
```typescript
{
  id: string;
  author_id: string;    // FK to Author
  title: string;
  slug: string;
  original_language: string;  // "en", "he", "grc"
  publication_year: number | null;
  genre: string | null;
  form: string | null;  // poem/scripture/aphorism
  source: string;       // "poetrydb"/"bible"/"wikiquote"
  source_id: string | null;
  created_at: string;
}
```

### Chunk
```typescript
{
  id: string;
  work_id: string | null;
  author_id: string;
  content: string;      // The actual text
  chunk_index: number;
  chunk_type: string;   // "poem"/"verse"/"quote"
  source: string;
  source_metadata: object;
  created_at: string;
}
```

---

## Directory Structure (After Phase 2A)

```
~/projects/doomscrolls/
├── package.json
├── tsconfig.json
├── bun.lockb
├── ccDSdataplanPhase1v1.md      # Implementation plan
├── ccDSdataReportPhase1v1.md    # This report
├── src/
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   └── utils/
│       ├── ids.ts               # UUID generation
│       ├── slugs.ts             # Slug generation
│       ├── files.ts             # JSON read/write helpers
│       └── fetch.ts             # Rate-limited fetch with retry
├── scripts/
│   ├── ingest.ts                # Main CLI runner
│   ├── ingest-poetrydb.ts       # PoetryDB ingestion
│   ├── ingest-bible.ts          # Bible API ingestion
│   ├── combine.ts               # Merge and deduplicate
│   └── wikiquote/               # NEW: Refactored Wikiquote module
│       ├── fetch-author.ts      # Core scraper function
│       ├── ingest-wikiquote.ts  # Main runner with tier support
│       ├── crawl-categories.ts  # Placeholder for Phase 3
│       ├── README.md            # Tier system documentation
│       └── author-lists/
│           ├── tier1-original.ts
│           ├── tier2-expanded.ts
│           └── index.ts
└── data/
    ├── poetrydb/
    │   ├── authors.json         # 129 authors
    │   ├── works.json           # 3,010 works
    │   ├── chunks.json          # 3,010 chunks
    │   └── .progress.json
    ├── bible/
    │   ├── authors.json         # 1 author
    │   ├── works.json           # 66 works
    │   ├── chunks.json          # 31,009 chunks
    │   └── .progress.json
    ├── wikiquote/
    │   ├── authors.json         # 198 authors (Tier 1 + 2)
    │   ├── works.json           # 198 works
    │   ├── chunks.json          # 32,672 chunks
    │   └── .progress.json
    └── combined/
        ├── authors.json         # 308 unique authors
        ├── works.json           # 3,274 works
        └── chunks.json          # 66,691 chunks
```

---

## How It Works

### 1. PoetryDB Ingestion (`scripts/ingest-poetrydb.ts`)
- Fetches author list from `GET https://poetrydb.org/author`
- For each author, fetches all poems from `GET https://poetrydb.org/author/{name}`
- Creates Author, Work, and Chunk records
- Saves progress after each author for resumability
- Rate limited at 300ms between requests

### 2. Bible API Ingestion (`scripts/ingest-bible.ts`)
- Uses predefined list of 66 books with chapter counts
- Fetches each chapter from `GET https://bible-api.com/{book}+{chapter}?translation=kjv`
- Creates one Work per book, one Chunk per verse
- Handles aggressive API rate limiting with exponential backoff (up to 24s waits)
- Saves progress after each book

### 3. Wikiquote Ingestion (`scripts/wikiquote/ingest-wikiquote.ts`)
- Supports tier-based ingestion via `--tier` flag
- Scrapes HTML from `https://en.wikiquote.org/wiki/{Author_Name}`
- Uses Cheerio for HTML parsing
- Extracts quotes from `<ul><li>` and `<dl><dd>` structures
- Quality filters: 20-1000 characters, minimum 10 quotes per author
- Skips "Misattributed", "Disputed", "Quotes about" sections
- Rate limited at 500ms between authors
- Tracks Wikiquote-specific metadata (tier, quote_count, discovery_method)

### 4. Combine Script (`scripts/combine.ts`)
- Loads all data from the three source directories
- Deduplicates authors by normalized name (20 duplicates found across sources)
- Reassigns consistent UUIDs across the merged dataset
- Updates all foreign keys (work.author_id, chunk.work_id, chunk.author_id)
- Writes combined output to `data/combined/`

### 5. CLI Runner (`scripts/ingest.ts`)
```bash
# Run individual sources
bun run scripts/ingest.ts --source=poetrydb
bun run scripts/ingest.ts --source=bible
bun run scripts/ingest.ts --source=wikiquote
bun run scripts/ingest.ts --source=wikiquote --tier=2  # Tier 2 only
bun run scripts/ingest.ts --source=combine

# Run all sources in sequence
bun run scripts/ingest.ts --all
```

---

## Technical Challenges & Solutions

### 1. Bible API Rate Limiting
**Problem:** The bible-api.com API returns 429 errors frequently, even with modest request rates.

**Solution:** Implemented aggressive retry logic with exponential backoff:
- 5 retries per request
- Base delay of 3 seconds
- Up to 24 second waits between retries
- 500ms minimum delay between requests

### 2. Wikiquote HTML Parsing
**Problem:** Wikiquote has inconsistent HTML structure across different author pages.

**Solution:**
- Target multiple quote container patterns (`<ul><li>`, `<dl><dd>`)
- Skip known metadata sections by header text
- Filter by content length to eliminate navigation/metadata
- Handle nested quote/attribution structures
- Try alternative URL patterns for disambiguation pages

### 3. Author Deduplication
**Problem:** Same authors appear in multiple sources (e.g., Shakespeare in PoetryDB and Wikiquote).

**Solution:** Normalize author names by:
- Lowercase conversion
- Remove diacritics (NFD normalization)
- Strip non-alphanumeric characters
- Merge metadata from all sources (prefer non-null values)

---

## Data Quality Notes

1. **Author Metadata:** Most authors have limited metadata (birth_year, death_year, bio are mostly null). Wikiquote authors have era information populated.

2. **Bible Verses:** Some single-chapter books (2 John, 3 John, Jude, Philemon, Obadiah) may have incomplete verse counts due to API quirks with single-chapter book handling.

3. **Quote Attribution:** Wikiquote quotes are extracted without their source attribution text (which is typically in nested `<ul>` elements).

4. **Poem Formatting:** Poems from PoetryDB preserve line breaks as `\n` characters in the content field.

5. **Wikiquote Quality Gate:** Authors with fewer than 10 quotes are skipped (1 author skipped in Phase 2A: Diogenes).

---

## Next Steps

### Phase 2B (Planned)
1. **Database Import:** Load combined JSON files into PostgreSQL/SQLite
2. **Author Enrichment:** Use Wikipedia API to populate missing author metadata

### Phase 3 (Future)
1. **Wikiquote Category Crawl:** Auto-discover 1,000+ authors from category indexes
2. **Additional Sources:** Project Gutenberg, Sacred Texts, Perseus Digital Library
3. **Content Scoring:** Implement popularity/quality scoring for feed algorithm

---

## Usage

To re-run the ingestion pipeline:

```bash
cd ~/projects/doomscrolls

# Install dependencies
bun install

# Run all ingestion scripts
bun run scripts/ingest.ts --all

# Or run individually
bun run scripts/ingest.ts --source=poetrydb
bun run scripts/ingest.ts --source=bible
bun run scripts/ingest.ts --source=wikiquote           # All tiers
bun run scripts/ingest.ts --source=wikiquote --tier=1  # Tier 1 only
bun run scripts/ingest.ts --source=wikiquote --tier=2  # Tier 2 only
bun run scripts/ingest.ts --source=combine
```

The scripts support resumability - if interrupted, they will skip already-completed items on the next run.

---

## Conclusion

The data ingestion pipeline has now completed through **Phase 3**, collecting **74,524 pieces of classical literature content** from 3 different sources:

| Source | Content |
|--------|---------|
| PoetryDB | 3,010 poems from 129 authors |
| Bible (KJV) | 31,009 verses from 66 books |
| Wikiquote | 40,505 quotes from 381 authors |

The data is normalized into a consistent format and ready for the next phase of the Doomscrolls project.

**Total ingestion time:**
- Phase 1: ~45 minutes
- Phase 2A (Tier 2 only): ~2 minutes
- Phase 3 (Category crawl + ingestion): ~5 minutes

---

## Phase 3 Investigation: Low Yield Root Cause Analysis

**Date:** 2026-01-04
**Issue:** Category crawler yielded 526 authors instead of expected 2,000-4,000

### Problem Summary

| Metric | Expected | Actual (v1) | v2 Test (2 cats) |
|--------|----------|-------------|------------------|
| Authors discovered | 2,000-4,000 | 526 | **5,721** |
| Authors after filter | 1,500-2,500 | 183 | TBD |
| Runtime | 10-15 hours | ~5 minutes | ~2 minutes |

### Root Cause: Wrong Category Structure

The v1 crawler had **three fundamental issues**:

#### Issue 1: Top-Level Categories Have Few Direct Authors

The categories we targeted were "container" categories with mostly subcategories:

| Category | Direct Pages | Subcategories |
|----------|--------------|---------------|
| Writers | 45 | 6 |
| Philosophers | 96 | ~10 |
| Poets | 38 | ~5 |

The actual authors are in **leaf subcategories** like:
- `Authors_from_the_United_States` → 361 direct + 4,000+ in subcategories
- `Authors_from_England` → 91 direct + 1,600+ in subcategories

#### Issue 2: No Subcategory Recursion

The v1 crawler only extracted direct page links from category pages. It did not follow subcategory links to find nested authors.

Example: `Category:Writers` contains `Category:American_writers` which contains `Category:Novelists_from_the_United_States` which contains 1,028 author pages. None of these were discovered.

#### Issue 3: HTML Scraping vs API

The v1 crawler scraped HTML looking for `div.mw-category a` links. The MediaWiki API is more reliable:

```
GET /w/api.php?action=query&list=categorymembers&cmtitle=Category:X&cmtype=page&cmlimit=500
```

Returns JSON with all category members, proper pagination via `cmcontinue`, and can filter by namespace.

### Solution: crawl-categories-v2.ts

Created new crawler with:

1. **MediaWiki API** instead of HTML scraping
2. **Recursive subcategory traversal** with configurable max depth
3. **Better root categories** targeting nationality-based author lists
4. **Proper pagination** using API's `cmcontinue` parameter
5. **Loop prevention** by tracking visited categories

### v2 Test Results (2 Categories, Depth=2)

```
Authors_from_the_United_States: 4,022 authors
Authors_from_England: 1,699 authors
Total: 5,721 authors
Categories visited: 69
API calls: 111
Runtime: ~2 minutes
```

### v2 Full Crawl Results (23 Categories, Depth=3) - COMPLETE

**Date:** 2026-01-04

| Metric | v1 (Original) | v2 Full Crawl | Improvement |
|--------|---------------|---------------|-------------|
| **Authors discovered** | 526 | **10,389** | **20x** |
| Root categories | 20 | 23 | - |
| Categories visited | 8 | 498 | 62x |
| API calls | N/A (HTML scraping) | 831 | - |
| Subcategory recursion | No | Yes (depth 3) | Fixed |

#### v2 Root Categories (All Complete)

| Category Group | Categories |
|----------------|------------|
| **By Nationality** | Authors_from_the_United_States, England, France, Germany, Russia, India, Ireland, Scotland, Italy, Canada, Australia |
| **Philosophers** | Greek_philosophers, Roman_philosophers, German_philosophers, French_philosophers, British_philosophers, American_philosophers |
| **Poets** | Poets_from_the_United_States, Poets_from_England |
| **Professions** | Scientists, Physicists, Historians, Economists |

#### Key Findings per Category

| Category | New Authors Found |
|----------|-------------------|
| Authors_from_the_United_States | ~4,000 |
| Authors_from_England | ~1,700 |
| Authors_from_France | ~700 |
| Authors_from_Germany | ~500 |
| Historians | 958 |
| Economists | 578 |
| Physicists | 260 |
| Others | ~1,700 |

### Next Steps

1. ✅ **Run v2 crawler** - COMPLETE (10,389 authors)
2. ⏳ **Run tier 3 ingestion** on the new author list
3. ⏳ **Combine all data** and update final statistics
4. **Expected final yield:** 5,000-10,000 authors with quotes after quality filter

### Commands

```bash
# v2 crawl complete - results in tier3-crawled.ts

# Ingest tier 3 quotes
bun run scripts/ingest.ts --source=wikiquote --tier=3

# Combine all data
bun run scripts/ingest.ts --source=combine
```
