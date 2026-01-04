# Wikiquote Ingestion

Scrapes quotes from Wikiquote author pages using a tiered approach.

## Tier System

| Tier | Authors | Description | Status |
|------|---------|-------------|--------|
| 1 | ~70 | Original curated list (philosophers, writers, historical figures) | Complete |
| 2 | ~130 | Expanded curated list (more writers, world lit, modern thinkers) | Complete |
| 3 | 2000+ | Auto-discovered from Wikiquote category crawl | Phase 3 |

## Usage

```bash
# Run all tiers (1 + 2 + 3)
bun run scripts/wikiquote/ingest-wikiquote.ts

# Run specific tier only
bun run scripts/wikiquote/ingest-wikiquote.ts --tier=1
bun run scripts/wikiquote/ingest-wikiquote.ts --tier=2
bun run scripts/wikiquote/ingest-wikiquote.ts --tier=3

# With limit (useful for testing tier 3)
bun run scripts/wikiquote/ingest-wikiquote.ts --tier=3 --limit=10

# Via main CLI
bun run scripts/ingest.ts --source=wikiquote
bun run scripts/ingest.ts --source=wikiquote --tier=2
bun run scripts/ingest.ts --source=wikiquote --tier=3 --limit=100
```

## Category Crawler (Phase 3)

Before ingesting tier 3 authors, you must first discover them using the category crawler:

```bash
# Discover authors from all categories
bun run scripts/wikiquote/crawl-categories.ts

# Discover from limited categories (for testing)
bun run scripts/wikiquote/crawl-categories.ts --limit=3

# Discover from a single category
bun run scripts/wikiquote/crawl-categories.ts --category=Writers
```

The crawler outputs:
- `author-lists/tier3-crawled.ts` - Discovered authors list
- `data/wikiquote/progress.md` - Crawl progress report

## Directory Structure

```
scripts/wikiquote/
├── fetch-author.ts        # Core scraper function
├── author-lists/
│   ├── tier1-original.ts  # Original 70 authors
│   ├── tier2-expanded.ts  # Expanded 135 authors
│   └── index.ts           # Combined exports
├── ingest-wikiquote.ts    # Main runner with --tier flag
├── crawl-categories.ts    # Placeholder for Phase 3
└── README.md              # This file
```

## Quality Filters

| Filter | Value | Reason |
|--------|-------|--------|
| Minimum quotes per author | 10 | Skip low-content pages |
| Quote min length | 20 chars | Filter fragments |
| Quote max length | 1000 chars | Filter non-quotes |
| Skipped sections | Misattributed, Disputed, About, See also, etc. | Quality control |

## Data Fields

Authors include Wikiquote-specific metadata:

```typescript
interface WikiquoteAuthor extends Author {
  wikiquote_url: string;          // Source URL
  quote_count: number;            // Number of quotes scraped
  discovery_method: 'curated' | 'category-crawl';
  tier: 1 | 2 | 3;
}
```

## Resumability

Progress is saved after each author in `.progress.json`. Re-running will skip already-completed authors.

## Tier 1 Categories (Original 70)

- Ancient Philosophy (10): Marcus Aurelius, Seneca, Epictetus, Plato, Aristotle, etc.
- Eastern Philosophy (4): Confucius, Lao Tzu, Sun Tzu, Buddha
- Enlightenment/Modern Philosophy (10): Voltaire, Nietzsche, Kant, etc.
- American Writers (7): Emerson, Thoreau, Twain, Hemingway, etc.
- British Writers (11): Shakespeare, Wilde, Orwell, etc.
- Russian Writers (3): Tolstoy, Dostoevsky, Chekhov
- European Writers (3): Kafka, Goethe, Hugo
- Poets (7): Dickinson, Frost, Blake, Keats, etc.
- Scientists (4): Einstein, Newton, Sagan, Darwin
- Historical Figures (6): Churchill, Lincoln, Gandhi, MLK, etc.
- Wit & Aphorists (4): Parker, Bierce, Mencken, Chesterton

## Tier 2 Categories (Expanded 135)

- Philosophers (23): Russell, Wittgenstein, Locke, Hume, Marx, etc.
- American Writers (20): Poe, Steinbeck, Vonnegut, Baldwin, Morrison, etc.
- British Writers (20): Hardy, Conrad, Lewis, Tolkien, Eliot, Milton, etc.
- World Literature (19): García Márquez, Borges, Rumi, Tagore, Proust, etc.
- Ancient/Classical (15): Sophocles, Homer, Virgil, Ovid, etc.
- Historical Figures (18): Jefferson, Napoleon, Caesar, Elizabeth I, etc.
- Modern Thinkers (15): Chomsky, Jung, Freud, Frankl, etc.
