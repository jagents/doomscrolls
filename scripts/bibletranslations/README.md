# Bible Translations Ingestion

Ingests multiple public domain Bible translations from bible-api.com.

## Translations

| Abbrev | Name | Year | Style |
|--------|------|------|-------|
| WEB | World English Bible | 2000 | Modern English |
| ASV | American Standard Version | 1901 | Formal equivalent |
| YLT | Young's Literal Translation | 1862 | Ultra-literal |
| DBY | Darby Translation | 1890 | Literal |

## Usage

```bash
bun run scripts/bibletranslations/ingest-translations.ts
```

## Output

- `data/bibletranslations/authors.json` - One author per translation
- `data/bibletranslations/works.json` - One work per book per translation (66 x 4 = 264)
- `data/bibletranslations/chunks.json` - All verses (~31,000 per translation)
- `data/bibletranslations/progress.md` - Human-readable progress
- `data/bibletranslations/.progress.json` - Machine-readable progress for resumption
- `data/bibletranslations/DONE.txt` - Created on completion

## Expected Results

- ~4 translations
- ~264 total books (66 per translation)
- ~124,000 verses (~31,000 per translation)
- Runtime: 3-6 hours due to API rate limiting
