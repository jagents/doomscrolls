# Standard Ebooks Ingestion

Ingests prose passages from Standard Ebooks (~900 professionally curated public domain novels).

## Scripts

- `ingest-standardebooks.ts` - Main ingestion script
- `fetch-catalog.ts` - OPDS catalog fetching and EPUB download
- `extract-text.ts` - EPUB extraction and HTML parsing
- `chunk-text.ts` - Text chunking into scroll-sized passages

## Usage

```bash
bun run scripts/standardebooks/ingest-standardebooks.ts
```

## Output

Data is written to `data/standardebooks/`:
- `authors.json` - Author records
- `works.json` - Book/work records
- `chunks.json` - Passage chunks (300-500 chars each)
- `.progress.json` - Resume tracking
- `progress.md` - Human-readable progress
- `DONE.txt` - Completion signal

## Chunking Strategy

- Target chunk size: 300-500 characters
- Splits on paragraph breaks first, then sentences
- Filters out front/back matter (copyright, colophon, etc.)
- Tracks chapter and position within book

## Rate Limiting

500ms delay between EPUB downloads to be respectful to Standard Ebooks servers.
