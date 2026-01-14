# Doomscrolls Data Report

Generated: 2026-01-13
Scope: Reconstructed data sources, ingestion pipeline, provenance, rights, dedup, segmentation, and embeddings from repo files under `scripts/`, `data/`, and `OLDdocsplans/`.

---

## 1) Data Snapshot and Source Breakdown

This section summarizes the corpus as it exists in the repo data outputs and progress logs. Counts marked as “unknown” were not found in local progress logs or summary files.

### 1.0 Neon DB Snapshot (read-only)

These are live counts from Neon (read-only query). Use these as the current source of truth for what is loaded in the DB.

| Table | Count |
|---|---:|
| authors | 7,664 |
| works | 17,291 |
| chunks | 10,302,862 |
| chunk_stats | 4 |
| categories | 13 |
| curated_works | 153 |
| work_categories | 153 |

### 1.0.1 Neon Schema (core tables)

This is the observed schema in Neon for the main content tables.

chunks:
`id`, `text`, `author_id`, `work_id`, `type`, `position_index`, `position_chapter`, `position_section`, `position_paragraph`, `position_verse`, `position_book`, `source`, `source_chunk_id`, `bible_translation`, `bible_book`, `bible_chapter`, `bible_verse`, `char_count`, `word_count`, `embedding`, `created_at`, `search_vector`, `embedding_model`, `embedded_at`

works:
`id`, `title`, `slug`, `author_id`, `year`, `language`, `original_language`, `translator`, `type`, `genre`, `subgenre`, `tradition`, `source`, `source_id`, `source_url`, `source_list`, `source_sublist`, `source_bookshelf`, `ingestion_phase`, `gutenberg_downloads`, `chunk_count`, `word_count`, `full_text_url`, `created_at`, `search_vector`

authors:
`id`, `name`, `slug`, `name_variants`, `birth_year`, `death_year`, `nationality`, `era`, `sources`, `source_ids`, `work_count`, `chunk_count`, `primary_genre`, `traditions`, `created_at`, `search_vector`, `bio`, `bio_generated_at`, `image_url`

### 1.0.2 Neon Distribution Checks (read-only)

Works by source:

| source | works |
|---|---:|
| gutenberg | 7,910 |
| wikiquote | 4,394 |
| poetrydb | 3,010 |
| standardebooks | 1,354 |
| bible-api | 264 |
| newadvent | 125 |
| ccel | 104 |
| bible | 66 |
| perseus | 44 |
| sacredtexts | 20 |

Chunks by source:

| source | chunks |
|---|---:|
| gutenberg | 8,113,638 |
| standardebooks | 1,645,680 |
| wikiquote | 219,798 |
| ccel | 100,436 |
| bible-api | 92,959 |
| newadvent | 67,452 |
| bible | 31,009 |
| perseus | 18,122 |
| sacredtexts | 10,758 |
| poetrydb | 3,010 |

Works by ingestion_phase:

| ingestion_phase | works |
|---|---:|
| null | 14,240 |
| phase5b | 3,051 |

Chunks by type:

| type | chunks |
|---|---:|
| null | 8,113,638 |
| passage | 1,832,934 |
| quote | 219,798 |
| verse | 125,432 |
| speech | 3,982 |
| poem | 3,010 |
| section | 1,906 |
| verse_group | 1,508 |
| saying | 389 |
| chapter | 265 |

Sample row observations (read-only):
- `works.source_url` is populated for some Gutenberg rows, but null on many others.
- `works.ingestion_phase` is mostly null; only `phase5b` appears in the sample distribution.
- `chunks.type` is often null for Gutenberg, but populated for other sources (`quote`, `verse`, `poem`, etc.).
- `chunks.source_chunk_id` is sometimes null for Gutenberg entries, suggesting partial backfill for that field.

### 1.0.3 Sample Works by Source (provenance fields)

These are single random examples per source to show how provenance fields are populated in Neon.

| source | title | source_id | source_url | source_list | source_sublist | source_bookshelf | ingestion_phase | full_text_url |
|---|---|---|---|---|---|---|---|---|
| gutenberg | The Practice and Theory of Bolshevism | 17350 | https://www.gutenberg.org/ebooks/17350 | null | null | null | phase5b | null |
| standardebooks | Plague Ship | andre-norton_plague-ship | null | null | null | null | null | null |
| wikiquote | Carlos Fuentes - Collected Quotes | Carlos_Fuentes | null | null | null | null | null | null |
| poetrydb | 386. The Rights of Women—Spoken by Miss Fontenelle | null | null | null | null | null | null | null |
| bible | Deuteronomy | Deuteronomy | null | null | null | null | null | null |
| bible-api | Jeremiah (ASV) | jeremiah-asv | null | null | null | null | null | null |
| perseus | Hippolytus | tlg0006.tlg005 | null | null | null | null | null | null |
| ccel | Institutes of the Christian Religion | calvin-institutes | null | null | null | null | null | null |
| newadvent | Letters | 3103 | null | null | null | null | null | null |
| sacredtexts | Doctrine of the Mean | doctrine-of-the-mean | null | null | null | null | null | null |

### 1.1 Source Summary (works/passages)

| Source | Works/Books | Passages/Chunks | Last Updated (from logs) | Evidence |
|---|---:|---:|---|---|
| Project Gutenberg (combined tranches) | 7,903 books | 8,113,638 passages | 2026-01-06 | `data/gutenberg/progress.md`, `data/gutenberg/progress-5b.md` |
| Standard Ebooks | 1,354 books | 1,645,680 passages | 2026-01-05 | `data/standardebooks/progress.md` |
| CCEL | 104 works | 100,436 passages | 2026-01-04 | `data/ccel/progress.md` |
| Perseus | 44 works | 18,122 passages | 2026-01-04 | `data/perseus/progress.md` |
| Sacred Texts (Round 1+2) | 20 texts | 10,758 passages | 2026-01-05 | `data/sacredtexts/progress.md` |
| Bible Translations (WEB/ASV/YLT/DBY) | 264 books | 100,959 verses | 2026-01-04 | `data/bibletranslations/progress.md` |
| Bible (KJV) | 66 books | 31,009 verses | unknown | `data/bible/chunks.json` |
| PoetryDB | 3,010 poems | 3,010 passages | unknown | `data/poetrydb/chunks.json` |
| Wikiquote (tiers 1-3) | 4,394 authors/works | 219,798 quotes | 2026-01-04 (crawl only) | `data/wikiquote/chunks.json`, `data/wikiquote/progress.md` |
| New Advent | 125 works | 67,452 passages | unknown | `data/newadvent/chunks.json` |

Notes:
1) Gutenberg totals above are summed across ingestion tranches (phases 1-5b). The process was split/parallelized for speed and memory limits; counts may include overlap, but dedup skipped 2,846 books total in logs (1,539 + 1,307).
2) Wikiquote progress log is for category crawl only and does not show final ingestion totals; the counts above are from `data/wikiquote/*.json`.

### 1.1.1 Gutenberg Tranche Breakdown (for audit)

| Tranche | Books | Passages | Notes | Evidence |
|---|---:|---:|---|---|
| Phases 1-4 | 1,909 | 2,125,671 | Top 200, author completists, greatest books, bookshelves | `data/gutenberg/progress.md` |
| Phase 5A-5D | 2,943 | 2,786,937 | New authors, new bookshelves, sci-fi, Russian lit | `data/gutenberg/progress.md` |
| Phase 5E-5I (5b) | 3,051 | 3,201,030 | German/Spanish lit, social sciences, theory, philosophy | `data/gutenberg/progress-5b.md` |

### 1.1.2 Source Counts (from data files)

| Source | Authors | Works/Books | Chunks/Passages | Evidence |
|---|---:|---:|---:|---|
| Gutenberg (phase 1-5 main files) | 1,451 | 4,859 | n/a | `data/gutenberg/authors.json`, `data/gutenberg/works.json` |
| Gutenberg (phase 5b works file) | n/a | 3,051 | n/a | `data/gutenberg/phase5b-works.json` |
| Standard Ebooks | 612 | 1,354 | n/a | `data/standardebooks/authors.json`, `data/standardebooks/works.json` |
| CCEL | 42 | 104 | 100,436 | `data/ccel/*.json` |
| Perseus | 13 | 44 | 18,122 | `data/perseus/*.json` |
| Sacred Texts | 19 | 20 | 10,758 | `data/sacredtexts/*.json` |
| New Advent | 33 | 125 | 67,452 | `data/newadvent/*.json` |
| Bible (KJV) | 1 | 66 | 31,009 | `data/bible/*.json` |
| Bible Translations | 4 | 264 | 100,959 | `data/bibletranslations/*.json` |
| PoetryDB | 129 | 3,010 | 3,010 | `data/poetrydb/*.json` |
| Wikiquote | 4,394 | 4,394 | 219,798 | `data/wikiquote/*.json` |

### 1.2 Source Types and Acquisition Methods

| Source | Primary Acquisition | Formats | Storage Folder |
|---|---|---|---|
| Gutenberg | Gutendex API + Gutenberg text downloads | plain text | `data/gutenberg/` |
| Standard Ebooks | OPDS catalog + EPUB (bulk via GitHub raw) | EPUB/HTML | `data/standardebooks/` |
| CCEL | CCEL text + Gutenberg text | plain text | `data/ccel/` |
| Perseus | TEI XML from canonical corpora | TEI XML | `data/perseus/` |
| Sacred Texts | sacred-texts.com pages (plus some Gutenberg) | HTML / plain text | `data/sacredtexts/` |
| New Advent | newadvent.org pages | HTML | `data/newadvent/` |
| Bible | bible-api.com | JSON API | `data/bible/` |
| Bible Translations | bible-api.com | JSON API | `data/bibletranslations/` |
| PoetryDB | poetrydb.org | JSON API | `data/poetrydb/` |
| Wikiquote | wikiquote.org pages + MediaWiki API for crawl | HTML/API | `data/wikiquote/` |

### 1.3 Content Types and Selection Strategy

| Source | What It Is | Content Types | Coverage | Selection Strategy |
|---|---|---|---|---|
| Gutenberg | Public domain books from Project Gutenberg via Gutendex | novels, essays, philosophy, history, etc. | Partial (broad) | Curated top lists + author completists + bookshelves + themed expansions |
| Standard Ebooks | Curated, proofed public domain EPUBs | novels, essays, classics | Full (catalog) | Full catalog at ingest time |
| CCEL | Christian Classics Ethereal Library + Gutenberg | theology, sermons, devotional works | Partial | Curated list of 104 texts |
| Perseus | Perseus Digital Library TEI | Greek/Latin classics | Partial | Curated classics list (44 works) |
| Sacred Texts | sacred-texts.com | religious/wisdom texts | Partial | Curated list + expansion (20 texts) |
| New Advent | New Advent Church Fathers | patristic works | Partial | Curated list (125 works) |
| Bible (KJV) | bible-api.com | scripture | Full (KJV) | All 66 books via chapter enumeration |
| Bible Translations | bible-api.com | scripture translations | Full (4 translations) | All 66 books per translation |
| PoetryDB | poetrydb.org | poetry | Full (PoetryDB) | Full author list from API |
| Wikiquote | en.wikiquote.org | quotes/aphorisms | Partial | Tiered: curated authors (tiers 1-2) + category crawl (tier 3) |

### 1.3.1 Selection Notes (why some sources are complete vs curated)

- Gutenberg: pulled in multiple tranches to scale (top 200, author completists, greatest books, bookshelves, and themed expansions like sci-fi and philosophy). This is intentionally broad but not the entire Gutenberg catalog.
- Standard Ebooks: full catalog at ingest time; these are carefully proofed, curated EPUBs.
- PoetryDB: full API crawl of all authors in PoetryDB at ingest time (each poem becomes one passage).
- Bible: full corpus for KJV and for four public-domain translations (each verse becomes a passage).
- Wikiquote: tiered approach to avoid scraping the full site; starts with curated author lists, then expands via category crawl.
- Perseus/CCEL/Sacred Texts/New Advent: curated lists of works focused on classics, theology, and wisdom literature rather than full catalogs.
### 1.4 Combined Dataset (Unified)

| Output | Purpose | Path | Notes |
|---|---|---|---|
| Unified Authors | canonical author list | `data/combined/authors.json` | merged by normalized author name |
| Unified Works | source-scoped works | `data/combined/works.json` | ID includes source + source_id |
| Unified Chunks | all passages | `data/combined/chunks.json` | streaming combine to handle multi-GB |
| Stats | summary | `data/combined/stats.json` | generated by `scripts/combine-data.ts` |

## 2) Corpus Sources (observed in code + data)

Below are the active sources discovered in the ingestion scripts and data outputs. Each entry includes the acquisition path, key scripts, and where the resulting data lands.

### Project Gutenberg (Gutendex + Gutenberg text files)
- Source: Gutendex API `https://gutendex.com/books/` and Gutenberg text downloads (fallback to `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt`).
- Ingestion scripts: `scripts/gutenberg/ingest-gutenberg.ts`, `scripts/gutenberg/ingest-phase5.ts`, `scripts/gutenberg/ingest-phase5b.ts`, `scripts/gutenberg/gutendex.ts`, `scripts/gutenberg/clean-text.ts`, `scripts/gutenberg/config.ts`, `scripts/gutenberg/config-phase5.ts`, `scripts/gutenberg/config-phase5b.ts`.
- Data outputs: `data/gutenberg/authors.json`, `data/gutenberg/works.json`, `data/gutenberg/chunks.json`, `data/gutenberg/phase5-chunks.json`, `data/gutenberg/phase5b-chunks.json`, `data/gutenberg/phase5b-works.json`, `data/gutenberg/dedup-log.txt`, `data/gutenberg/progress.md`, `data/gutenberg/progress-5b.md`.
- Ingestion dates and counts (from progress logs):
  - Phase 1-4 complete: 2026-01-05; 1,909 books, 2,125,671 passages.
  - Phase 5A-5D complete: 2,943 books, 2,786,937 passages.
  - Phase 5E-5I (Phase 5b) complete or in progress around 2026-01-06; 3,051 books, 3,201,030 passages.
- Chunking: paragraph-first, then sentence splits, 300-600 chars with 50-char overlap; Gutenberg header/footer stripping in `scripts/gutenberg/clean-text.ts`.
- Dedup: skips already downloaded book IDs, non-English, and logs skipped duplicates in `data/gutenberg/dedup-log.txt`.

### Standard Ebooks
- Source: Standard Ebooks catalog and EPUB downloads via `https://standardebooks.org/ebooks` and OPDS; bulk method uses GitHub raw.
- Ingestion scripts: `scripts/standardebooks/ingest-standardebooks.ts`, `scripts/standardebooks/fetch-catalog.ts`, `scripts/standardebooks/extract-text.ts`, `scripts/standardebooks/chunk-text.ts`, `scripts/standardebooks/bulk-ingest.ts`, `scripts/standardebooks/bulk-ingest-v2.ts`.
- Data outputs: `data/standardebooks/authors.json`, `data/standardebooks/works.json`, `data/standardebooks/chunks.json`, `data/standardebooks/progress.md`.
- Ingestion status: `data/standardebooks/progress.md` reports 1,354 books and 1,645,680 passages (2026-01-05).
- Chunking: 200-600 chars, target ~400; paragraph-first, sentence fallback; tracks chapter and position percent in `source_metadata`.
- Filters: front/back matter removed (copyright, colophon, etc.) in `scripts/standardebooks/extract-text.ts`.

### Wikiquote
- Source: `https://en.wikiquote.org/` (scraping and category crawl via API).
- Ingestion scripts: `scripts/ingest-wikiquote.ts` (standalone), `scripts/wikiquote/ingest-wikiquote.ts` (tiered), `scripts/wikiquote/crawl-categories.ts`, `scripts/wikiquote/crawl-categories-v2.ts`, `scripts/wikiquote/fetch-author.ts`.
- Author lists: `scripts/wikiquote/author-lists/tier1-original.ts`, `scripts/wikiquote/author-lists/tier2-expanded.ts`, `scripts/wikiquote/author-lists/tier3-crawled.ts`.
- Data outputs: `data/wikiquote/authors.json`, `data/wikiquote/works.json`, `data/wikiquote/chunks.json`, `data/wikiquote/progress.md`.
- Ingestion status: category crawl progress updated 2026-01-04 (8/20 categories, 526 authors discovered).
- Chunking: each quote becomes a chunk; length filter 20-1000 chars; ignores disputed/misattributed sections and navigation.
- Dedup: per-author page duplicate quote removal.

### PoetryDB
- Source: `https://poetrydb.org/`.
- Ingestion scripts: `scripts/ingest-poetrydb.ts`.
- Data outputs: `data/poetrydb/authors.json`, `data/poetrydb/works.json`, `data/poetrydb/chunks.json`.
- Chunking: entire poem stored as one chunk (line breaks preserved).
- Dedup: skips poems with duplicate titles per author in `scripts/ingest-poetrydb.ts`.

### Bible (KJV)
- Source: `https://bible-api.com` (KJV).
- Ingestion scripts: `scripts/ingest-bible.ts`.
- Data outputs: `data/bible/authors.json`, `data/bible/works.json`, `data/bible/chunks.json`.
- Chunking: one verse per chunk; `source_metadata` stores book/chapter/verse.

### Bible Translations (WEB, ASV, YLT, DBY)
- Source: `https://bible-api.com`.
- Ingestion scripts: `scripts/bibletranslations/ingest-translations.ts`, `scripts/bibletranslations/translations-config.ts`, `scripts/bibletranslations/README.md`.
- Data outputs: `data/bibletranslations/authors.json`, `data/bibletranslations/works.json`, `data/bibletranslations/chunks.json`, `data/bibletranslations/progress.md`.
- Ingestion status: 264 books, 100,959 verses; completed 2026-01-04.
- Chunking: one verse per chunk; `source_metadata.translation` recorded.

### Perseus Digital Library (Greek/Latin classics)
- Source: TEI XML files from Perseus canonical corpora (expected under `data/perseus/repos/...`).
- Ingestion scripts: `scripts/perseus/ingest-perseus.ts`, `scripts/perseus/parse-tei.ts`, `scripts/perseus/chunk-by-type.ts`, `scripts/perseus/texts-config.ts`.
- Data outputs: `data/perseus/authors.json`, `data/perseus/works.json`, `data/perseus/chunks.json`, `data/perseus/progress.md`.
- Ingestion status: 44 works, 18,122 passages; completed 2026-01-04.
- Chunking: type-specific (poetry, drama, dialogue, prose) with chunk types `verse_group`, `speech`, `passage`.

### CCEL (Christian Classics Ethereal Library)
- Source: Mix of CCEL and Gutenberg text URLs listed in `scripts/ccel/texts-config.ts`.
- Ingestion scripts: `scripts/ccel/ingest-ccel.ts`, `scripts/ccel/texts-config.ts`, `scripts/ccel/README.md`.
- Data outputs: `data/ccel/authors.json`, `data/ccel/works.json`, `data/ccel/chunks.json`, `data/ccel/progress.md`.
- Ingestion status: 104 works, 100,436 passages; completed 2026-01-04.
- Chunking: paragraph-first then sentence; 300-600 chars with 50-char overlap.

### New Advent (Church Fathers)
- Source: `https://www.newadvent.org/fathers/`.
- Ingestion scripts: `scripts/newadvent/ingest-newadvent.ts`, `scripts/newadvent/fathers-config.ts`.
- Data outputs: `data/newadvent/authors.json`, `data/newadvent/works.json`, `data/newadvent/chunks.json`.
- Chunking: paragraph-based, 200-700 chars (target ~450); chapter metadata stored in `source_metadata`.

### Sacred-texts.com (wisdom and religious texts)
- Source: `https://sacred-texts.com/` plus some Gutenberg files (via `scripts/sacredtexts/texts-config.ts` and `scripts/sacredtexts/texts-config-expansion.ts`).
- Ingestion scripts: `scripts/sacredtexts/ingest-sacredtexts.ts`, `scripts/sacredtexts/ingest-expansion.ts`, custom parsers in `scripts/sacredtexts/parsers/`.
- Data outputs: `data/sacredtexts/authors.json`, `data/sacredtexts/works.json`, `data/sacredtexts/chunks.json`, `data/sacredtexts/progress.md`.
- Ingestion status: 20 texts, 10,758 passages; expansion completed 2026-01-05.
- Chunking: parser-driven (verse, section, chapter) depending on text type.

### Combined Dataset (Unified)
- Source: All of the above.
- Combiner scripts: `scripts/combine-data.ts` (streaming), `scripts/combine.ts` (earlier 3-source combiner).
- Output: `data/combined/authors.json`, `data/combined/works.json`, `data/combined/chunks.json`, `data/combined/stats.json`.
- Import to Neon: `scripts/import-to-neon.js`.

### Legacy Mention: Internet Archive
- Mentioned in `OLDdocsplans/DOCDoomscollsv1.md`, but no active ingestion scripts reference Internet Archive in this repo. Treat as planned/aspirational unless external scripts exist outside this repo.

---

## 2) Provenance and Rights Metadata (what exists, what is missing)

### What is currently recorded
- Works have `source` and `source_id` (per source). Examples:
  - Gutenberg: `source=gutenberg`, `source_id` is the Gutenberg numeric ID.
  - Standard Ebooks: `source=standardebooks`, `source_id` is SE identifier.
  - Perseus: `source=perseus`, `source_id` is `authorId.workId`.
  - Bible / Bible translations: `source=bible` or `source=bible-api`, `source_id` is book or slug.
- Chunks store `source` and `source_metadata` (chapter/verse/section, translation, etc.) in per-source data.
- Combined dataset stores `source`, `source_chunk_id`, `position_*` fields (chapter/section/book/verse/paragraph), `char_count`, and `word_count` in `data/combined/chunks.json`.
- Combined works include `full_text_url` when it can be derived, via `scripts/combine-data.ts`.

### What is missing or not consistently tracked
- No per-work or per-passage **download URL**, **ingest date**, **checksum**, or **parser version** stored in the data models.
- No explicit **rights/licensing metadata** per work or per passage.
- No **territory-specific rights** flags (e.g., PD US vs worldwide) or translation rights basis.
- No structured **edition** object or provenance chain (source version, translator, editorial notes).

---

## 3) Deduplication, Editions, and Canonicalization (current reality)

### Observed behavior
- Author deduplication exists in `scripts/combine-data.ts` by normalized author name.
- Work deduplication across sources does not exist; unified work IDs are source-specific (`work-{slug}-{source}-{sourceId}`).
- Passage-level deduplication (exact or near-duplicate) is not implemented globally.

### Local or source-specific dedup
- Gutenberg: skips duplicate book IDs and non-English; logs skips in `data/gutenberg/dedup-log.txt`.
- PoetryDB: skips duplicate poem titles per author.
- Wikiquote: removes duplicate quotes on a page via an in-memory set.

### Editions
- No first-class Edition entity.
- Translations are represented as distinct works (Bible translations) but not as a canonical Work/Edition model.
- Perseus translations use specific TEI XML files, but translator metadata is not captured in works.

---

## 4) Passage Segmentation (per-source summary)

### Gutenberg
- Algorithm: paragraph-first, then sentence splitting, 300-600 chars with 50-char overlap.
- Files: `scripts/gutenberg/clean-text.ts`, `scripts/gutenberg/config.ts`.

### Standard Ebooks
- Algorithm: paragraph-first, sentence fallback, target 400 chars (min 200, max 600).
- Preserves chapter title and position percent in `source_metadata`.
- Files: `scripts/standardebooks/chunk-text.ts`, `scripts/standardebooks/ingest-standardebooks.ts`.

### CCEL
- Algorithm: paragraph-first, sentence fallback with 50-char overlap.
- Files: `scripts/ccel/ingest-ccel.ts`.

### Perseus
- Algorithm: type-specific chunking (poetry, drama, dialogue, prose) with chunk types `verse_group`, `speech`, `passage`.
- Files: `scripts/perseus/chunk-by-type.ts`.

### Bible / Bible Translations
- Algorithm: one verse per chunk.
- `source_metadata` stores book/chapter/verse and translation.
- Files: `scripts/ingest-bible.ts`, `scripts/bibletranslations/ingest-translations.ts`.

### New Advent
- Algorithm: paragraph-based with length merge/split; target ~450 chars (min 200, max 700).
- Files: `scripts/newadvent/ingest-newadvent.ts`.

### Sacred Texts
- Algorithm: parser-driven based on work type (chapter/section/verse).
- Files: `scripts/sacredtexts/parsers/*.ts`.

### Wikiquote
- Algorithm: each quote is a chunk; 20-1000 chars filter.
- Files: `scripts/ingest-wikiquote.ts`, `scripts/wikiquote/ingest-wikiquote.ts`.

### PoetryDB
- Algorithm: one poem per chunk (line breaks preserved).
- Files: `scripts/ingest-poetrydb.ts`.

### Offsets back to full text
- There is no universal offset storage (start/end positions in canonical text).
- Some sources store chapter/section/verse or position percent in `source_metadata`, but this is not uniform.

---

## 5) Embeddings, Similarity, and Hybrid Search

### Embedding model and storage
- Embedding model: OpenAI `text-embedding-3-small` (1536 dims) in `scripts/generate-embeddings.ts`.
- Storage: pgvector in PostgreSQL (Neon), fields `embedding`, `embedding_model`, `embedded_at` updated per chunk.
- Planned schema and strategy described in `OLDdocsplans/embeddingideas.md`.
 - Status: embeddings are currently being processed via OpenAI in long-running batch jobs; completion is expected to enable full similarity search and feed personalization based on likes/saves.

### Similar passages
- Implemented in `server/routes/passages.ts`.
- If a passage has an embedding, similarity uses pgvector distance (`ORDER BY c.embedding <=> source.embedding`).
- Fallback: same author or same work, random order, length filtered.

### Hybrid search
- `server/routes/search.ts` currently returns keyword search only; semantic/hybrid is marked TODO.

### Taste vector personalization
- `server/db/migrate-phase2.ts` creates `user_taste_vectors` table, but no code computes or refreshes taste vectors.
- Feed personalization uses metadata signals only; embedding-based personalization is not implemented.

### Backfill pipeline
- Embeddings are generated in batch scripts `scripts/generate-embeddings.ts`, `scripts/embed-lower.ts`, `scripts/embed-upper.ts`.
- Retries exist for 429s; no job queue or robust failure pipeline is implemented.

---

## 6) Operational Integrity and Editorial Overrides

- No editorial patch layer (e.g., diff/patch overrides) is evident in the data pipeline.
- No takedown or rights dispute workflow is visible in data models or scripts.
- No corpus-level validation scripts for bad Unicode, empty passages, or rights gaps were found.

---

## 7) Direct Answers to the 27 Questions

### Provenance and rights metadata
1) **Source of truth per Work/Passage:**
   - Current: per-source `data/<source>/works.json` and `data/<source>/chunks.json` produced by ingestion scripts. Combined output is `data/combined/*` via `scripts/combine-data.ts`.
   - Available provenance: `source`, `source_id`, `source_metadata` (chapter/verse/etc), and `full_text_url` (derived in combine step).
   - Missing: download URL, ingest date, checksum, parser version.

2) **Rights/licensing metadata today:**
   - Not stored in any schema or JSON output.
   - Assumptions in docs: public domain (explicitly stated in `OLDdocsplans/DOCDoomscollsv1.md`); Standard Ebooks is PD; Bible translations are marked as PD in `scripts/bibletranslations/README.md`.
   - Missing: explicit rights basis per work or passage.

3) **Territory-specific rights assumptions:**
   - Not tracked.

4) **Translations handled and labeled:**
   - Bible translations: separate works per translation with `source_metadata.translation` in each chunk.
   - Perseus translations: specific TEI translation files, but translator identity not captured.
   - Other sources: translator not tracked.

5) **Takedown / rights dispute workflow:**
   - No workflow or data model found.

6) **Minimal rights + attribution payload currently possible:**
   - Best available: author name, work title, source name, `source_id`, `full_text_url` (for sources where derivable), and `source_metadata` for chapter/verse info.

### Deduplication, editions, canonicalization
7) **Canonical identity of a Work:**
   - Currently source-specific. Combined IDs encode `slug + source + sourceId` in `scripts/combine-data.ts`.

8) **Edition as first-class object:**
   - No edition entity or table is present.

9) **Exact duplicate detection across passages:**
   - Not implemented globally.

10) **Near-duplicate detection:**
   - Not implemented. Mentioned only as a possible embedding use case in `OLDdocsplans/embeddingideas.md`.

11) **Engagement aggregation across duplicates:**
   - Not implemented; duplicates are distinct chunks.

12) **Merge strategy for authors/works when duplicates discovered:**
   - None found. Author dedup is only done once in combine step by normalized name.

### Passage segmentation
13) **Segmentation algorithm today:**
   - Source-specific. See Section 4 above.

14) **Rules preventing bad cuts:**
   - Paragraph-first, sentence fallback in most sources. Filters for short chunks in some sources.
   - No global ruleset exists across all sources.

15) **Structural markers preserved:**
   - PoetryDB preserves line breaks.
   - Standard Ebooks preserves paragraph breaks and chapter titles.
   - Bible uses verse structure.
   - Sacred Texts and Perseus preserve some section/verse structure via parser metadata.

16) **Passage offsets back to canonical text:**
   - Not universally stored. Only partial position metadata exists in `source_metadata` and combined `position_*` fields.

17) **Segmentation change rollout strategy:**
   - Not implemented. Chunk IDs are generated at ingest; re-chunking would produce new IDs and break references unless a migration is built.

18) **Segmentation quality metrics:**
   - Not implemented in code. Admin dashboard tracks length buckets but no segmentation QA metrics found.

### Embeddings, similarity, hybrid search
19) **Embedding models and versioning:**
   - Model: `text-embedding-3-small` (1536 dims) in `scripts/generate-embeddings.ts`.
   - Versioning: `embedding_model` column is set; no explicit model version table.

20) **Vector storage and indexing:**
   - Stored in PostgreSQL with pgvector. Index creation not shown in code, but schema is described in `OLDdocsplans/embeddingideas.md`.

21) **Similar passages algorithm:**
   - If embedding exists: order by pgvector distance; else fallback to same author/work with random order. See `server/routes/passages.ts`.

22) **User taste vector computation:**
   - Not implemented. Only a table definition exists in `server/db/migrate-phase2.ts`.

23) **Hybrid search blending:**
   - Not implemented. `server/routes/search.ts` uses keyword search only and notes TODO for semantic search.

24) **Embedding backfill pipeline:**
   - Batch scripts exist (`scripts/generate-embeddings.ts`, `scripts/embed-lower.ts`, `scripts/embed-upper.ts`).
   - No queueing system; retry logic is ad hoc (429 handling).

### Operational integrity
25) **Editable content and edit storage:**
   - No explicit editorial patch layer or override tables found.

26) **Corpus-level validation checks:**
   - No validation scripts found beyond length filtering in feed logic.

27) **Audit report for a passage:**
   - Not implemented. You can infer limited provenance from `chunks.source`, `source_chunk_id`, and `source_metadata`, but no single audit payload exists.

---

## 8) Recommended Next Steps (if you want to close provenance/rights gaps)

1) Add a `sources` + `editions` + `rights` schema layer with:
   - `source_url`, `ingested_at`, `checksum`, `parser_version`, `license`, `rights_basis`, and `territory`.
2) Create a canonical `work` identity separate from `edition` (source-specific instance), and add redirects when merging.
3) Implement passage-level dedup: exact hash on normalized text, plus near-duplicate clustering.
4) Add stable IDs or mapping tables for re-chunking so bookmarks survive segmentation updates.
5) Implement a takedown workflow and rights flags with propagation to feed and lists.
