# Doomscrolls Phase 1: Data Ingestion Pipeline - Implementation Plan

**Version:** 1.0
**Created:** 2026-01-04
**Status:** Planning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Architecture](#2-project-architecture)
3. [Implementation Tasks](#3-implementation-tasks)
4. [Detailed Specifications](#4-detailed-specifications)
5. [API Reference](#5-api-reference)
6. [Error Handling Strategy](#6-error-handling-strategy)
7. [Testing Strategy](#7-testing-strategy)
8. [Execution Plan](#8-execution-plan)

---

## 1. Executive Summary

### Goal
Build a data ingestion pipeline that fetches classical literature from 3 sources (PoetryDB, Bible API, Wikiquote) and stores them as normalized JSON files for later database import.

### Tech Stack
- **Runtime:** Bun
- **Language:** TypeScript
- **Dependencies:** cheerio, uuid (or native crypto.randomUUID)
- **Storage:** Local JSON files

### Expected Output
| Source | Content Type | Estimated Count |
|--------|-------------|-----------------|
| PoetryDB | Poems | ~3,000+ |
| Bible API | Verses (KJV) | ~31,000+ |
| Wikiquote | Quotes | ~2,000+ |

---

## 2. Project Architecture

### 2.1 Directory Structure

```
~/projects/doomscrolls/
├── package.json
├── tsconfig.json
├── bun.lockb
├── src/
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces (Author, Work, Chunk)
│   └── utils/
│       ├── ids.ts              # UUID generation
│       ├── slugs.ts            # Slug generation from names/titles
│       ├── files.ts            # JSON read/write helpers with pretty formatting
│       └── fetch.ts            # Rate-limited fetch with retry logic
├── scripts/
│   ├── ingest.ts               # Main CLI runner
│   ├── ingest-poetrydb.ts      # PoetryDB ingestion
│   ├── ingest-bible.ts         # Bible API ingestion
│   ├── ingest-wikiquote.ts     # Wikiquote scraping
│   └── combine.ts              # Merge and deduplicate all sources
└── data/
    ├── poetrydb/
    │   ├── authors.json
    │   ├── works.json
    │   ├── chunks.json
    │   └── .progress.json      # Resume tracking
    ├── bible/
    │   ├── authors.json
    │   ├── works.json
    │   ├── chunks.json
    │   └── .progress.json
    ├── wikiquote/
    │   ├── authors.json
    │   ├── works.json
    │   ├── chunks.json
    │   └── .progress.json
    └── combined/
        ├── authors.json
        ├── works.json
        └── chunks.json
```

### 2.2 Data Models

```typescript
interface Author {
  id: string;                    // UUID v4
  name: string;                  // "William Shakespeare"
  slug: string;                  // "william-shakespeare"
  birth_year: number | null;
  death_year: number | null;
  nationality: string | null;
  era: string | null;            // Ancient/Medieval/Renaissance/Enlightenment/Romantic/Victorian/Modern/Contemporary
  bio: string | null;
  wikipedia_url: string | null;
  created_at: string;            // ISO 8601 timestamp
}

interface Work {
  id: string;                    // UUID v4
  author_id: string;             // FK to Author.id
  title: string;                 // "Sonnet 18" or "Genesis"
  slug: string;                  // "sonnet-18"
  original_language: string;     // ISO 639-1: "en", "la", "grc"
  publication_year: number | null;
  genre: string | null;          // Poetry, Philosophy, Religious, etc.
  form: string | null;           // poem/letter/verse/aphorism/dialogue/meditation/scripture
  source: string;                // "poetrydb" | "bible" | "wikiquote"
  source_id: string | null;      // Original ID from source if available
  created_at: string;
}

interface Chunk {
  id: string;                    // UUID v4
  work_id: string | null;        // FK to Work.id (null for standalone quotes)
  author_id: string;             // FK to Author.id
  content: string;               // The actual text content
  chunk_index: number;           // Order within work (0 for standalone)
  chunk_type: string;            // "poem" | "quote" | "verse" | "passage"
  source: string;                // "poetrydb" | "bible" | "wikiquote"
  source_metadata: object;       // Source-specific data
  created_at: string;
}

interface Progress {
  completed: string[];           // List of completed item identifiers
  last_updated: string;          // ISO timestamp
}
```

---

## 3. Implementation Tasks

### Phase 1: Project Setup

| # | Task | Description |
|---|------|-------------|
| 1.1 | Create directory structure | Create all folders: src/types, src/utils, scripts, data/* |
| 1.2 | Initialize package.json | `bun init` with project metadata |
| 1.3 | Install dependencies | `bun add cheerio` (uuid via crypto.randomUUID) |
| 1.4 | Create tsconfig.json | Configure TypeScript for Bun with strict mode |
| 1.5 | Create type definitions | `src/types/index.ts` with all interfaces |
| 1.6 | Create utility: ids.ts | UUID generation wrapper |
| 1.7 | Create utility: slugs.ts | Name/title to URL-safe slug |
| 1.8 | Create utility: files.ts | JSON read/write with pretty print |
| 1.9 | Create utility: fetch.ts | Rate-limited fetch with retry |

### Phase 2: PoetryDB Ingestion

| # | Task | Description |
|---|------|-------------|
| 2.1 | Create ingest-poetrydb.ts | Main script structure |
| 2.2 | Fetch author list | GET /author endpoint |
| 2.3 | Iterate authors | Fetch poems for each author |
| 2.4 | Create Author records | Generate UUIDs, slugs |
| 2.5 | Create Work records | One per poem |
| 2.6 | Create Chunk records | Join lines as content |
| 2.7 | Implement progress tracking | Save after each author |
| 2.8 | Handle edge cases | 404s, empty arrays, duplicates |

### Phase 3: Bible API Ingestion

| # | Task | Description |
|---|------|-------------|
| 3.1 | Create ingest-bible.ts | Main script structure |
| 3.2 | Create Biblical author | "Various (Biblical)" |
| 3.3 | Define book list | All 66 books in order |
| 3.4 | Iterate books/chapters | Dynamic chapter detection |
| 3.5 | Create Work records | One per book |
| 3.6 | Create Chunk records | One per verse |
| 3.7 | Store source metadata | Book, chapter, verse, reference |
| 3.8 | Implement progress tracking | Track completed books |

### Phase 4: Wikiquote Ingestion

| # | Task | Description |
|---|------|-------------|
| 4.1 | Create ingest-wikiquote.ts | Main script structure |
| 4.2 | Define priority author list | ~70 authors across categories |
| 4.3 | Fetch and parse HTML | Using Cheerio |
| 4.4 | Extract quotes | Parse nested list structure |
| 4.5 | Filter quality | Length checks, skip metadata |
| 4.6 | Create Author records | Detect era if possible |
| 4.7 | Create Work records | "Collected Quotes" per author |
| 4.8 | Create Chunk records | One per quote |
| 4.9 | Implement progress tracking | Track completed authors |

### Phase 5: Combine Script

| # | Task | Description |
|---|------|-------------|
| 5.1 | Create combine.ts | Main script structure |
| 5.2 | Read all source data | Load from 3 directories |
| 5.3 | Deduplicate authors | Merge by normalized name |
| 5.4 | Reassign IDs | Consistent UUIDs across merged data |
| 5.5 | Update foreign keys | Fix work.author_id, chunk.work_id |
| 5.6 | Write combined output | To data/combined/ |
| 5.7 | Print statistics | Summary of all sources |

### Phase 6: CLI Runner

| # | Task | Description |
|---|------|-------------|
| 6.1 | Create ingest.ts | Parse CLI arguments |
| 6.2 | Implement --source flag | Run individual scripts |
| 6.3 | Implement --all flag | Run all in sequence |
| 6.4 | Add logging | Progress and completion messages |

---

## 4. Detailed Specifications

### 4.1 Utility Functions

#### ids.ts
```typescript
// Use native crypto.randomUUID() available in Bun
export function generateId(): string {
  return crypto.randomUUID();
}
```

#### slugs.ts
```typescript
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')       // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '');          // Trim leading/trailing hyphens
}
```

#### files.ts
```typescript
export async function readJson<T>(path: string): Promise<T | null>;
export async function writeJson(path: string, data: unknown): Promise<void>;
export async function ensureDir(path: string): Promise<void>;
```

#### fetch.ts
```typescript
interface FetchOptions {
  retries?: number;        // Default: 3
  baseDelay?: number;      // Default: 1000ms
  rateLimit?: number;      // Default: 100ms between requests
}

export async function rateLimitedFetch(
  url: string,
  options?: FetchOptions
): Promise<Response>;
```

### 4.2 PoetryDB Specifics

**API Endpoints:**
- `GET https://poetrydb.org/author` → `string[]` (author names)
- `GET https://poetrydb.org/author/{name}` → `Poem[]`

**Poem Response Structure:**
```typescript
interface PoetryDBPoem {
  title: string;
  author: string;
  lines: string[];
  linecount: string;
}
```

**Mapping:**
| PoetryDB Field | Our Model | Transformation |
|----------------|-----------|----------------|
| author | Author.name | Direct |
| title | Work.title | Direct |
| lines | Chunk.content | Join with `\n` |
| linecount | source_metadata | Store as number |

**Rate Limiting:** 100ms between requests

### 4.3 Bible API Specifics

**API Endpoint:**
- `GET https://bible-api.com/{book}+{chapter}?translation=kjv`

**Response Structure:**
```typescript
interface BibleAPIResponse {
  reference: string;
  verses: {
    book_name: string;
    chapter: number;
    verse: number;
    text: string;
  }[];
  text: string;
  translation_name: string;
}
```

**Books List (66 total):**
```
Old Testament (39):
Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth,
1 Samuel, 2 Samuel, 1 Kings, 2 Kings, 1 Chronicles, 2 Chronicles,
Ezra, Nehemiah, Esther, Job, Psalms, Proverbs, Ecclesiastes, Song of Solomon,
Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel, Hosea, Joel, Amos,
Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi

New Testament (27):
Matthew, Mark, Luke, John, Acts, Romans, 1 Corinthians, 2 Corinthians,
Galatians, Ephesians, Philippians, Colossians, 1 Thessalonians, 2 Thessalonians,
1 Timothy, 2 Timothy, Titus, Philemon, Hebrews, James, 1 Peter, 2 Peter,
1 John, 2 John, 3 John, Jude, Revelation
```

**Chapter Detection Algorithm:**
1. Start at chapter 1
2. Fetch chapter, check for valid response
3. If valid, increment chapter and repeat
4. If error/empty, move to next book

**Mapping:**
| Bible API Field | Our Model | Notes |
|-----------------|-----------|-------|
| book_name | Work.title | One work per book |
| verses[].text | Chunk.content | One chunk per verse |
| chapter, verse | source_metadata | For reference |

**Rate Limiting:** 100ms between requests

### 4.4 Wikiquote Specifics

**URL Pattern:** `https://en.wikiquote.org/wiki/{Author_Name}`
(Spaces → underscores)

**Priority Authors (70 total):**

| Category | Authors |
|----------|---------|
| Ancient Philosophy | Marcus Aurelius, Seneca the Younger, Epictetus, Plato, Aristotle, Socrates, Heraclitus, Epicurus, Cicero, Plutarch |
| Eastern Philosophy | Confucius, Lao Tzu, Sun Tzu, Buddha |
| Enlightenment/Modern | Voltaire, Montaigne, Pascal, Descartes, Kant, Nietzsche, Schopenhauer, Kierkegaard, Camus, Sartre |
| American Writers | Emerson, Thoreau, Whitman, Twain, Franklin, Hemingway, Fitzgerald |
| British Writers | Shakespeare, Wilde, Shaw, Austen, Dickens, Woolf, Orwell, Huxley, Johnson, Swift, Pope |
| Russian Writers | Tolstoy, Dostoevsky, Chekhov |
| European Writers | Kafka, Goethe, Hugo |
| Poets | Dickinson, Frost, Blake, Keats, Shelley, Byron, Wordsworth |
| Scientists | Einstein, Newton, Sagan, Darwin |
| Historical Figures | Churchill, Lincoln, Roosevelt, Gandhi, MLK, Mandela |
| Wit & Aphorists | Parker, Bierce, Mencken, Chesterton |

**HTML Parsing Strategy:**

1. **Target Container:** `div#mw-content-text`
2. **Skip Elements:**
   - `div#toc` (table of contents)
   - `div.navbox` (navigation boxes)
   - Section headers for "Quotes about", "Misattributed", "Disputed"
3. **Quote Location:**
   - Under `<h2>` sections like "Quotes", "Attributed", "Sourced"
   - Within `<ul><li>` structures
   - Main quote is direct text in `<li>`
   - Attribution is in nested `<ul><li>`

**Quote Filtering:**
- Minimum length: 20 characters
- Maximum length: 1000 characters
- Skip if looks like header/metadata (all caps, contains "==", etc.)

**Rate Limiting:** 500ms between requests (be nice to Wikipedia)

---

## 5. API Reference

### 5.1 PoetryDB API

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/author` | GET | `string[]` - All author names |
| `/author/{name}` | GET | `Poem[]` - All poems by author |
| `/title/{title}` | GET | `Poem[]` - Poems matching title |

**Rate Limit:** No official limit, but be respectful (100ms delay)

**Known Issues:**
- Some authors return 404
- Some poems may have empty lines arrays
- Author names with special characters need URL encoding

### 5.2 Bible API

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/{book}+{chapter}` | GET | Full chapter with verses |
| `/{book}+{chapter}:{verse}` | GET | Single verse |
| `?translation=kjv` | Query | Use King James Version |

**Rate Limit:** No official limit (100ms delay recommended)

**Known Issues:**
- Invalid chapters return error responses
- Some books have alternate names (Song of Solomon vs Song of Songs)

### 5.3 Wikiquote (Scraping)

| URL Pattern | Content |
|-------------|---------|
| `/wiki/{Name}` | Main quote page |
| `/wiki/{Name}_(author)` | Disambiguation fallback |

**Parsing Notes:**
- Content is in `#mw-content-text .mw-parser-output`
- Quotes typically in unordered lists
- Watch for nested blockquotes
- Attributions often in sub-lists or `<dd>` elements

---

## 6. Error Handling Strategy

### 6.1 HTTP Errors

| Error Type | Handling |
|------------|----------|
| 404 Not Found | Log warning, skip item, continue |
| 429 Too Many Requests | Exponential backoff, retry |
| 500 Server Error | Retry with backoff (max 3 attempts) |
| Network Timeout | Retry with backoff (max 3 attempts) |

### 6.2 Retry Logic

```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404) throw new Error('Not found');
      // Retry on 5xx errors
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
    }
  }
}
```

### 6.3 Progress Tracking

Each source maintains a `.progress.json`:
```json
{
  "completed": ["author-name-1", "author-name-2"],
  "last_updated": "2026-01-04T12:00:00Z"
}
```

On startup, check progress file and skip completed items.

### 6.4 Data Validation

- Validate required fields before creating records
- Log but skip malformed entries
- Ensure UUIDs are valid format
- Ensure content is non-empty

---

## 7. Testing Strategy

### 7.1 Manual Testing

| Test | Command | Expected Result |
|------|---------|-----------------|
| Single source | `bun run scripts/ingest.ts --source=poetrydb` | PoetryDB data in data/poetrydb/ |
| Resume | Run twice | Second run skips completed items |
| Combine | `bun run scripts/ingest.ts --source=combine` | Merged data in data/combined/ |
| Full pipeline | `bun run scripts/ingest.ts --all` | All data ingested and combined |

### 7.2 Validation Checks

After ingestion, verify:
- [ ] All JSON files are valid
- [ ] No duplicate IDs within a source
- [ ] All foreign keys reference valid IDs
- [ ] Chunk counts match expectations
- [ ] No empty content fields

---

## 8. Execution Plan

### 8.1 Build Order

1. **Project Setup** (Tasks 1.1-1.9)
   - Initialize project
   - Install dependencies
   - Create all utility functions

2. **PoetryDB Script** (Tasks 2.1-2.8)
   - Simplest API, good for testing patterns

3. **Bible Script** (Tasks 3.1-3.8)
   - More complex chapter iteration

4. **Wikiquote Script** (Tasks 4.1-4.9)
   - Most complex, requires HTML parsing

5. **Combine Script** (Tasks 5.1-5.7)
   - Merges all data

6. **CLI Runner** (Tasks 6.1-6.4)
   - Ties everything together

### 8.2 Execution Command

```bash
# Full pipeline
bun run scripts/ingest.ts --all

# Individual sources (for testing/debugging)
bun run scripts/ingest.ts --source=poetrydb
bun run scripts/ingest.ts --source=bible
bun run scripts/ingest.ts --source=wikiquote
bun run scripts/ingest.ts --source=combine
```

### 8.3 Expected Runtime

| Source | Items | Delay | Estimated Time |
|--------|-------|-------|----------------|
| PoetryDB | ~150 authors | 100ms | ~5-10 minutes |
| Bible | 66 books, ~1,189 chapters | 100ms | ~15-20 minutes |
| Wikiquote | 70 authors | 500ms | ~5-10 minutes |
| Combine | N/A | N/A | < 1 minute |
| **Total** | | | **~30-45 minutes** |

### 8.4 Success Criteria

```
=== Ingestion Complete ===
PoetryDB: X authors, Y poems
Bible: 66 books, ~31,102 verses
Wikiquote: X authors, Y quotes
Combined: X unique authors, Y total chunks
```

---

## Appendix A: Era Classification

For author era detection (used in Wikiquote):

| Era | Date Range | Keywords/Indicators |
|-----|------------|---------------------|
| Ancient | Before 500 CE | Greek, Roman, Classical |
| Medieval | 500-1400 | Middle Ages, Scholastic |
| Renaissance | 1400-1600 | Italian, Humanist |
| Enlightenment | 1600-1800 | Reason, Revolution |
| Romantic | 1780-1850 | Nature, Emotion |
| Victorian | 1837-1901 | Industrial, Empire |
| Modern | 1900-1945 | Modernist, Wars |
| Contemporary | 1945-present | Postmodern, Digital |

---

## Appendix B: Language Codes

| Language | ISO 639-1 | Used For |
|----------|-----------|----------|
| English | en | Most content |
| Latin | la | Some philosophy |
| Ancient Greek | grc | Ancient philosophy |
| Hebrew | he | Old Testament original |
| German | de | Goethe, Kafka (originals) |
| French | fr | French authors (originals) |
| Russian | ru | Russian authors (originals) |

---

## Appendix C: Genre/Form Classifications

**Genres:**
- Poetry
- Philosophy
- Religious
- Fiction
- Non-fiction
- Drama
- Letters

**Forms:**
- poem
- verse
- quote
- aphorism
- dialogue
- meditation
- scripture
- letter
- essay
- speech

---

## Notes

- All timestamps use ISO 8601 format with UTC timezone
- UUIDs use v4 (random) format
- JSON files use 2-space indentation for readability
- Progress files are hidden (prefixed with `.`)

---

# Phase 2A: Wikiquote Medium Expansion

**Added:** 2026-01-04
**Status:** Planning

## Overview

Expand Wikiquote coverage from 69 curated authors to ~200-250 authors, while refactoring the architecture to support future large-scale crawling (1,000+ authors from category indexes).

### Current State (Phase 1 Complete)
- 69 authors
- 14,936 quotes
- 9.8 MB data

### Target State (Phase 2A)
- ~185-200 authors
- ~35,000-45,000 quotes
- ~25-30 MB data

---

## Phase 2A.1: Architecture Refactor

### New Directory Structure

```
~/projects/doomscrolls/
├── scripts/
│   └── wikiquote/
│       ├── fetch-author.ts        # Core scraper function
│       ├── author-lists/
│       │   ├── tier1-original.ts  # Original 70 authors
│       │   ├── tier2-expanded.ts  # New ~135 authors
│       │   └── index.ts           # Combined exports
│       ├── ingest-wikiquote.ts    # Main runner with --tier flag
│       ├── crawl-categories.ts    # Placeholder for future Phase 3
│       └── README.md              # Tier system documentation
```

### Enhanced WikiquoteAuthor Interface

```typescript
interface WikiquoteAuthor extends Author {
  wikiquote_url: string;          // Source URL
  quote_count: number;            // Quotes scraped from this author
  discovery_method: string;       // "curated" | "category-crawl"
  tier: number;                   // 1=original, 2=expanded, 3=future-crawled
}
```

---

## Phase 2A.2: Tier System

### Tier 1: Original Authors (70)
Already ingested in Phase 1. Categories:
- Ancient Philosophy (10)
- Eastern Philosophy (4)
- Enlightenment/Modern Philosophy (10)
- American Writers (7)
- British Writers (11)
- Russian Writers (3)
- European Writers (3)
- Poets (7)
- Scientists (4)
- Historical Figures (6)
- Wit & Aphorists (4)

### Tier 2: Expanded Authors (~135 new)

| Category | Authors |
|----------|---------|
| **Philosophers** | Bertrand Russell, Ludwig Wittgenstein, John Locke, David Hume, Thomas Hobbes, Baruch Spinoza, Jean-Jacques Rousseau, John Stuart Mill, William James, Simone de Beauvoir, Hannah Arendt, Michel Foucault, Karl Marx, Thomas Aquinas, Augustine of Hippo, Francis Bacon, George Santayana, Alfred North Whitehead, Henri Bergson, Edmund Burke, Thomas Paine, Ayn Rand, Simone Weil |
| **American Writers** | Edgar Allan Poe, Nathaniel Hawthorne, Herman Melville, Jack London, John Steinbeck, William Faulkner, Tennessee Williams, Truman Capote, Kurt Vonnegut, Ray Bradbury, Flannery O'Connor, Willa Cather, Edith Wharton, Upton Sinclair, Sinclair Lewis, James Baldwin, Toni Morrison, Maya Angelou, Langston Hughes, Zora Neale Hurston |
| **British Writers** | Thomas Hardy, Joseph Conrad, D. H. Lawrence, E. M. Forster, Evelyn Waugh, Graham Greene, W. Somerset Maugham, Rudyard Kipling, H. G. Wells, Arthur Conan Doyle, C. S. Lewis, J. R. R. Tolkien, T. S. Eliot, W. H. Auden, Dylan Thomas, Robert Burns, Alfred Lord Tennyson, John Milton, Geoffrey Chaucer, William Hazlitt |
| **World Literature** | Gabriel García Márquez, Jorge Luis Borges, Pablo Neruda, Rumi, Khalil Gibran, Rabindranath Tagore, Umberto Eco, Italo Calvino, Milan Kundera, Honoré de Balzac, Gustave Flaubert, Marcel Proust, Stendhal, Aleksandr Solzhenitsyn, Boris Pasternak, Nikos Kazantzakis, Hermann Hesse, Thomas Mann, Bertolt Brecht |
| **Ancient/Classical** | Sophocles, Euripides, Aeschylus, Thucydides, Xenophon, Diogenes, Ovid, Horace, Juvenal, Lucretius, Virgil, Homer, Sappho, Pindar, Aristophanes |
| **Historical Figures** | Thomas Jefferson, John Adams, George Washington, Frederick Douglass, Susan B. Anthony, Eleanor Roosevelt, John F. Kennedy, Franklin D. Roosevelt, Woodrow Wilson, Napoleon Bonaparte, Julius Caesar, Cleopatra, Elizabeth I, Catherine the Great, Pericles, Alexander the Great, Charlemagne, Joan of Arc |
| **Modern Thinkers** | Noam Chomsky, Marshall McLuhan, Susan Sontag, Christopher Hitchens, Carl Jung, Sigmund Freud, Joseph Campbell, Alan Watts, Buckminster Fuller, Erich Fromm, Viktor Frankl, Abraham Maslow, B. F. Skinner, Steven Pinker, Jordan Peterson |

### Tier 3: Category-Crawled (Future)
- Placeholder for auto-discovered authors from Wikiquote category pages
- Expected: 1,000-2,000 additional authors
- Categories to crawl: Writers, Philosophers, Poets, Scientists, etc.

---

## Phase 2A.3: Implementation Tasks

| # | Task | Description |
|---|------|-------------|
| 2A.1 | Create wikiquote/ directory | New script directory structure |
| 2A.2 | Create tier1-original.ts | Extract existing 70 authors |
| 2A.3 | Create tier2-expanded.ts | New 135 authors list |
| 2A.4 | Create author-lists/index.ts | Combined exports |
| 2A.5 | Update src/types/index.ts | Add WikiquoteAuthor interface |
| 2A.6 | Create fetch-author.ts | Extract core scraping logic |
| 2A.7 | Create new ingest-wikiquote.ts | Tier-aware main runner |
| 2A.8 | Create crawl-categories.ts | Placeholder for Phase 3 |
| 2A.9 | Create README.md | Document tier system |
| 2A.10 | Run Tier 2 ingestion | Execute ~135 new authors |
| 2A.11 | Run combine script | Merge with existing data |
| 2A.12 | Update report | Document Phase 2A results |

---

## Phase 2A.4: Quality Filters

| Filter | Value | Reason |
|--------|-------|--------|
| Minimum quotes | 10 | Skip low-content pages |
| Quote min length | 20 chars | Filter fragments |
| Quote max length | 1000 chars | Filter non-quotes |
| Skip sections | Misattributed, Disputed, About, etc. | Quality control |

---

## Phase 2A.5: CLI Interface

```bash
# Run all curated tiers (1 + 2)
bun run scripts/ingest.ts --source=wikiquote

# Run specific tier only
bun run scripts/ingest.ts --source=wikiquote --tier=1
bun run scripts/ingest.ts --source=wikiquote --tier=2

# Future: run category-crawled authors
bun run scripts/ingest.ts --source=wikiquote --tier=3
```

---

## Phase 2A.6: Expected Results

| Metric | Before (Phase 1) | After (Phase 2A) |
|--------|------------------|------------------|
| Authors | 69 | ~185-200 |
| Quotes | 14,936 | ~35,000-45,000 |
| Data Size | 9.8 MB | ~25-30 MB |
| Combined Chunks | 48,955 | ~70,000-80,000 |

**Runtime:** ~1-2 hours for Tier 2 (135 authors × 500ms delay + processing)

---

## Phase 2A.7: Success Criteria

```
=== Wikiquote Phase 2A Complete ===
Tier 2 new authors: ~120-135 (some may have <10 quotes)
Tier 2 new quotes: ~20,000-30,000
Skipped (low quotes): ~10-15
Total authors: ~185-200
Total quotes: ~35,000-45,000
```

---

## Phase 2A.8: Future Phase 3 Prep

The `crawl-categories.ts` placeholder will enable:

1. Fetch Wikiquote category pages:
   - `https://en.wikiquote.org/wiki/Category:Writers`
   - `https://en.wikiquote.org/wiki/Category:Philosophers`
   - `https://en.wikiquote.org/wiki/Category:Poets`
   - `https://en.wikiquote.org/wiki/Category:Scientists`

2. Extract all author page URLs from category listings

3. Deduplicate against existing Tier 1 and Tier 2 authors

4. Output discovered authors to `author-lists/tier3-crawled.ts`

**Expected Phase 3 yield:** 1,000-2,000 additional authors

---

# Phase 3: Wikiquote Category Crawler for Full Coverage

**Added:** 2026-01-04
**Status:** Planning

## Overview

Build a category crawler to auto-discover all Wikiquote authors from category indexes, dramatically expanding from ~200 curated authors to 2,000-3,000 total authors.

### Current State (Phase 2A Complete)
- 198 curated authors (Tier 1 + Tier 2)
- 32,672 quotes
- ~22 MB data

### Target State (Phase 3)
- 2,000-3,000 total authors
- 100,000-200,000 quotes
- ~100-200 MB data

---

## Phase 3.1: Category Crawler Implementation

### Categories to Crawl

| Category URL | Expected Authors |
|-------------|------------------|
| `Category:Writers` | 500+ |
| `Category:Philosophers` | 200+ |
| `Category:Poets` | 300+ |
| `Category:Scientists` | 200+ |
| `Category:Politicians` | 500+ |
| `Category:Novelists` | 400+ |
| `Category:Playwrights` | 150+ |
| `Category:Essayists` | 100+ |
| `Category:Historians` | 100+ |
| `Category:Journalists` | 100+ |
| `Category:Religious_figures` | 100+ |
| `Category:Activists` | 100+ |
| `Category:Artists` | 100+ |
| `Category:Composers` | 100+ |
| `Category:Film_directors` | 100+ |
| `Category:Economists` | 50+ |
| `Category:Mathematicians` | 50+ |
| `Category:Lawyers` | 50+ |
| `Category:Military_personnel` | 100+ |
| `Category:Monarchs` | 100+ |

### Skip Categories (Low Quote Quality)
- Actors/Actresses
- Athletes
- Musicians (except classical)
- Business people

---

## Phase 3.2: Crawler Architecture

### crawl-categories.ts

```typescript
interface CategoryCrawlResult {
  category: string;
  authorsFound: string[];
  pagesProcessed: number;
  hasNextPage: boolean;
}

interface CrawlProgress {
  completedCategories: string[];
  discoveredAuthors: string[];
  lastUpdated: string;
}

async function crawlCategory(categoryName: string): Promise<CategoryCrawlResult>;
async function crawlAllCategories(options: {
  limit?: number;
  skipExisting?: boolean;
}): Promise<void>;
```

### Pagination Handling

Wikiquote category pages show ~200 authors per page with "next page" links:
```
https://en.wikiquote.org/wiki/Category:Writers
https://en.wikiquote.org/wiki/Category:Writers?pagefrom=...
```

The crawler will:
1. Fetch category page
2. Extract all author links from `div.mw-category`
3. Check for "next page" link
4. Follow pagination until exhausted
5. Rate limit: 1 second between page fetches

### Deduplication Strategy

```typescript
function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Skip if already in tier1, tier2, or previously discovered tier3
const existingAuthors = new Set([
  ...TIER1_AUTHORS.map(a => normalizeAuthorName(a.name)),
  ...TIER2_AUTHORS.map(a => normalizeAuthorName(a.name)),
  ...discoveredTier3.map(a => normalizeAuthorName(a))
]);
```

---

## Phase 3.3: Output Format

### tier3-crawled.ts

```typescript
// Auto-generated by crawl-categories.ts
// DO NOT EDIT - regenerate with: bun run scripts/wikiquote/crawl-categories.ts

export interface DiscoveredAuthor {
  name: string;
  wikiquote_url: string;
  discovered_from_category: string;
  discovered_at: string;
}

export const TIER3_AUTHORS: DiscoveredAuthor[] = [
  { name: "Author Name", wikiquote_url: "...", discovered_from_category: "Writers", discovered_at: "2026-01-04" },
  // ... 1,000+ more
];
```

### progress.md (Crawler Progress Tracker)

```markdown
# Wikiquote Category Crawl Progress

## Summary
- Categories crawled: X / 20
- Authors discovered: X
- Authors deduplicated (already in tier1/2): X

## Category Results

| Category | Authors Found | New Authors | Status |
|----------|---------------|-------------|--------|
| Writers | 523 | 480 | Complete |
| Philosophers | 212 | 198 | Complete |
| ... | ... | ... | ... |

## Last Updated: 2026-01-04 12:00:00
```

---

## Phase 3.4: CLI Interface

```bash
# Discover authors from categories (does NOT ingest quotes)
bun run scripts/wikiquote/crawl-categories.ts

# Options
bun run scripts/wikiquote/crawl-categories.ts --limit=5      # Only first 5 categories
bun run scripts/wikiquote/crawl-categories.ts --category=Writers  # Single category

# Ingest discovered tier3 authors
bun run scripts/ingest.ts --source=wikiquote --tier=3

# Ingest with limit (useful for testing)
bun run scripts/ingest.ts --source=wikiquote --tier=3 --limit=100
```

---

## Phase 3.5: Implementation Tasks

| # | Task | Description |
|---|------|-------------|
| 3.1 | Build crawl-categories.ts | Core category page parser |
| 3.2 | Implement pagination handling | Follow "next page" links |
| 3.3 | Add deduplication logic | Skip tier1/tier2 authors |
| 3.4 | Generate tier3-crawled.ts | Output discovered authors |
| 3.5 | Create progress.md | Track crawl progress |
| 3.6 | Update author-lists/index.ts | Export TIER3_AUTHORS |
| 3.7 | Update ingest-wikiquote.ts | Support --tier=3 and --limit |
| 3.8 | Test on 2-3 categories | Verify crawler works |
| 3.9 | Full crawl (manual trigger) | Run complete category crawl |
| 3.10 | Full ingestion (manual trigger) | Ingest all tier3 authors |

---

## Phase 3.6: Quality Control

### Author Filtering

After crawling, apply additional filters during ingestion:
- Minimum 10 quotes per author (same as tier1/tier2)
- Skip disambiguation pages
- Skip category pages incorrectly in listings
- Skip "(quotes about)" pages

### Progress Tracking

The crawler maintains two progress files:
1. `.crawl-progress.json` - Categories completed
2. `.progress.json` - Authors ingested (existing file)

---

## Phase 3.7: Expected Results

| Metric | After Phase 2A | After Phase 3 |
|--------|----------------|---------------|
| Authors (total) | 198 | 2,000-3,000 |
| Quotes (total) | 32,672 | 100,000-200,000 |
| Data Size | 22 MB | 100-200 MB |
| Combined Chunks | 66,691 | 150,000-250,000 |

**Runtime Estimates:**
- Category crawl: ~30 minutes (20 categories × ~5 pages each × 1s delay)
- Quote ingestion: ~4-8 hours (2,000 authors × 500ms delay + processing)

---

## Phase 3.8: Safety & Testing

### Test Plan (Do First)

1. Run crawler on 2-3 categories only
2. Verify output format is correct
3. Check deduplication is working
4. Review sample of discovered authors
5. **STOP and report results before full crawl**

### Commands for Testing

```bash
# Test crawler on limited categories
bun run scripts/wikiquote/crawl-categories.ts --limit=3

# View results
cat data/wikiquote/tier3-crawled.ts | head -50
cat data/wikiquote/progress.md
```

---

## Phase 3.9: Success Criteria

```
=== Wikiquote Phase 3 Category Crawl Complete ===
Categories processed: 20
Authors discovered: ~2,500
Already in tier1/tier2: ~180
New unique authors: ~2,320
Output: data/wikiquote/tier3-crawled.ts

=== Wikiquote Phase 3 Ingestion Complete (after manual trigger) ===
Tier 3 authors processed: ~2,320
Tier 3 quotes ingested: ~100,000-150,000
Skipped (low quotes): ~300-500
Total authors: ~2,000-2,500
Total quotes: ~130,000-180,000
```
