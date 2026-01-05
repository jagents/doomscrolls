# Doomscrolls

**Enlightened doomscrolling** — classical literature delivered via infinite scroll.

## What Is This?

A data ingestion pipeline that collects public domain literature from multiple sources and normalizes it into scroll-sized passages.

## Data Sources

| Source | Content | Status |
|--------|---------|--------|
| Wikiquote | 220k quotes from 4,400+ authors | ✅ Complete |
| Bible (KJV) | 31k verses | ✅ Complete |
| PoetryDB | 3k poems from 129 poets | ✅ Complete |
| Standard Ebooks | Classic novels as prose passages | 🔄 Running |
| Sacred Texts | World religious/philosophical texts | ✅ Complete |
| Perseus | Greek & Roman classics | ✅ Complete |
| CCEL | Christian theological classics | ✅ Complete |
| New Advent | Church Fathers | ✅ Complete |
| Bible Translations | WEB, ASV, YLT, Darby | ✅ Complete |
| Project Gutenberg | Top books + author completists | 🔄 Running |

## Progress

See `data/*/progress.md` for real-time ingestion status.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Data Format:** JSON (authors, works, chunks)

## Usage

```bash
# Install dependencies
bun install

# Run ingestion
bun run scripts/ingest.ts --source=poetrydb
bun run scripts/ingest.ts --source=bible
bun run scripts/ingest.ts --source=wikiquote
bun run scripts/ingest.ts --source=combine
```

## License

Code: MIT
Data: Public domain (all sources are pre-1929 or explicitly public domain)
