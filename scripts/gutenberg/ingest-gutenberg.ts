#!/usr/bin/env bun
// Gutenberg Ingestion - All 4 Phases

import { TOP_AUTHORS, GREATEST_BOOKS, BOOKSHELVES } from "./config";
import {
  fetchPopularBooks,
  searchBooks,
  fetchBooksByTopic,
  getTextUrl,
  downloadText,
  type GutenbergBook,
  type GutenbergAuthor
} from "./gutendex";
import { cleanGutenbergText, chunkText, type Chunk } from "./clean-text";

const DATA_DIR = "./data/gutenberg";

// ============ Types ============

interface Author {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  source: string;
  source_id: string;
  created_at: string;
}

interface Work {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  original_language: string;
  publication_year: number | null;
  genre: string | null;
  form: string;
  source: string;
  source_id: string;
  created_at: string;
}

interface ChunkRecord {
  id: string;
  work_id: string;
  content: string;
  sequence: number;
  created_at: string;
}

interface PhaseStats {
  books: number;
  passages: number;
  skipped: number;
}

interface Progress {
  phase: number;
  phaseStats: { [key: number]: PhaseStats };
  downloadedIds: number[];
  currentAuthorIndex?: number;
  currentBookshelfIndex?: number;
  currentGreatestIndex?: number;
  startedAt: string;
  lastUpdatedAt: string;
}

// ============ State ============

const downloadedIds = new Set<number>();
const authors: Author[] = [];
const works: Work[] = [];
const chunks: ChunkRecord[] = [];
const authorIdMap = new Map<string, string>(); // normalized name -> id
const dedupLog: string[] = [];

let progress: Progress = {
  phase: 1,
  phaseStats: {
    1: { books: 0, passages: 0, skipped: 0 },
    2: { books: 0, passages: 0, skipped: 0 },
    3: { books: 0, passages: 0, skipped: 0 },
    4: { books: 0, passages: 0, skipped: 0 }
  },
  downloadedIds: [],
  startedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString()
};

let totalBooksProcessed = 0;
const startTime = Date.now();

// ============ Utilities ============

function generateId(): string {
  return crypto.randomUUID();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function normalizeAuthorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function getOrCreateAuthor(gutenbergAuthor: GutenbergAuthor): string {
  const normalized = normalizeAuthorName(gutenbergAuthor.name);

  if (authorIdMap.has(normalized)) {
    return authorIdMap.get(normalized)!;
  }

  const id = generateId();
  const author: Author = {
    id,
    name: gutenbergAuthor.name,
    birth_year: gutenbergAuthor.birth_year,
    death_year: gutenbergAuthor.death_year,
    source: "gutenberg",
    source_id: normalized,
    created_at: new Date().toISOString()
  };

  authors.push(author);
  authorIdMap.set(normalized, id);
  return id;
}

async function saveProgress(): Promise<void> {
  progress.downloadedIds = Array.from(downloadedIds);
  progress.lastUpdatedAt = new Date().toISOString();
  await Bun.write(`${DATA_DIR}/.progress.json`, JSON.stringify(progress, null, 2));
}

async function saveData(): Promise<void> {
  await Promise.all([
    Bun.write(`${DATA_DIR}/authors.json`, JSON.stringify(authors, null, 2)),
    Bun.write(`${DATA_DIR}/works.json`, JSON.stringify(works, null, 2)),
    Bun.write(`${DATA_DIR}/chunks.json`, JSON.stringify(chunks, null, 2)),
    Bun.write(`${DATA_DIR}/dedup-log.txt`, dedupLog.join('\n'))
  ]);
}

async function loadProgress(): Promise<boolean> {
  try {
    const file = Bun.file(`${DATA_DIR}/.progress.json`);
    if (await file.exists()) {
      const saved = await file.json() as Progress;
      progress = saved;
      saved.downloadedIds.forEach(id => downloadedIds.add(id));
      console.log(`Resuming from phase ${progress.phase}, ${downloadedIds.size} books already downloaded`);

      // Load existing data
      const authorsFile = Bun.file(`${DATA_DIR}/authors.json`);
      const worksFile = Bun.file(`${DATA_DIR}/works.json`);
      const chunksFile = Bun.file(`${DATA_DIR}/chunks.json`);

      if (await authorsFile.exists()) {
        const savedAuthors = await authorsFile.json() as Author[];
        authors.push(...savedAuthors);
        savedAuthors.forEach(a => authorIdMap.set(normalizeAuthorName(a.name), a.id));
      }
      if (await worksFile.exists()) {
        works.push(...(await worksFile.json() as Work[]));
      }
      if (await chunksFile.exists()) {
        chunks.push(...(await chunksFile.json() as ChunkRecord[]));
      }

      return true;
    }
  } catch (e) {
    console.log("No valid progress file, starting fresh");
  }
  return false;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

async function updateProgressMd(): Promise<void> {
  const elapsed = Date.now() - startTime;
  const totalBooks = Object.values(progress.phaseStats).reduce((a, b) => a + b.books, 0);
  const totalPassages = Object.values(progress.phaseStats).reduce((a, b) => a + b.passages, 0);
  const totalSkipped = Object.values(progress.phaseStats).reduce((a, b) => a + b.skipped, 0);

  const phaseNames = ["", "Top 200", "Author Completists", "Greatest Books", "Curated Bookshelves"];
  const phaseStatus = (p: number) => {
    if (p < progress.phase) return "✅ Complete";
    if (p === progress.phase) return "🔄 Running";
    return "⏳ Pending";
  };

  let currentInfo = "";
  if (progress.phase === 2 && progress.currentAuthorIndex !== undefined) {
    currentInfo = `\n## Current\n- Phase: 2 (Author Completists)\n- Author: ${progress.currentAuthorIndex + 1}/${TOP_AUTHORS.length} - ${TOP_AUTHORS[progress.currentAuthorIndex]}`;
  } else if (progress.phase === 3 && progress.currentGreatestIndex !== undefined) {
    currentInfo = `\n## Current\n- Phase: 3 (Greatest Books)\n- Book: ${progress.currentGreatestIndex + 1}/${GREATEST_BOOKS.length} - ${GREATEST_BOOKS[progress.currentGreatestIndex]}`;
  } else if (progress.phase === 4 && progress.currentBookshelfIndex !== undefined) {
    currentInfo = `\n## Current\n- Phase: 4 (Curated Bookshelves)\n- Bookshelf: ${progress.currentBookshelfIndex + 1}/${BOOKSHELVES.length} - ${BOOKSHELVES[progress.currentBookshelfIndex]}`;
  }

  const md = `# Gutenberg Ingestion Progress

**Started:** ${new Date(progress.startedAt).toLocaleString()}
**Last Updated:** ${new Date().toLocaleString()}
**Elapsed:** ${formatDuration(elapsed)}

## Overall Progress
- **Phase:** ${progress.phase} of 4 (${phaseNames[progress.phase]})
- **Total Books:** ${totalBooks}
- **Total Passages:** ${totalPassages.toLocaleString()}
- **Duplicates Skipped:** ${totalSkipped}

## Phase Status
| Phase | Status | Books | Passages | Dupes Skipped |
|-------|--------|-------|----------|---------------|
| 1 - Top 200 | ${phaseStatus(1)} | ${progress.phaseStats[1].books} | ${progress.phaseStats[1].passages.toLocaleString()} | ${progress.phaseStats[1].skipped} |
| 2 - Authors | ${phaseStatus(2)} | ${progress.phaseStats[2].books} | ${progress.phaseStats[2].passages.toLocaleString()} | ${progress.phaseStats[2].skipped} |
| 3 - Greatest | ${phaseStatus(3)} | ${progress.phaseStats[3].books} | ${progress.phaseStats[3].passages.toLocaleString()} | ${progress.phaseStats[3].skipped} |
| 4 - Bookshelves | ${phaseStatus(4)} | ${progress.phaseStats[4].books} | ${progress.phaseStats[4].passages.toLocaleString()} | ${progress.phaseStats[4].skipped} |
${currentInfo}
`;

  await Bun.write(`${DATA_DIR}/progress.md`, md);
}

// ============ Book Processing ============

async function processBook(book: GutenbergBook, phase: number): Promise<boolean> {
  // Check for duplicate
  if (downloadedIds.has(book.id)) {
    dedupLog.push(`[Phase ${phase}] SKIP: ${book.id} - ${book.title} (already downloaded)`);
    progress.phaseStats[phase].skipped++;
    return false;
  }

  // Must be English
  if (!book.languages.includes('en')) {
    dedupLog.push(`[Phase ${phase}] SKIP: ${book.id} - ${book.title} (not English: ${book.languages.join(',')})`);
    return false;
  }

  // Get text URL
  const textUrl = getTextUrl(book);
  if (!textUrl) {
    console.log(`  No text URL for ${book.title}`);
    return false;
  }

  // Download text
  console.log(`  Downloading: ${book.title} (ID: ${book.id})`);
  const rawText = await downloadText(textUrl);
  if (!rawText) {
    console.log(`  Failed to download ${book.title}`);
    return false;
  }

  // Clean and chunk
  const cleanedText = cleanGutenbergText(rawText);
  if (cleanedText.length < 1000) {
    console.log(`  Skipping ${book.title} - too short after cleaning (${cleanedText.length} chars)`);
    return false;
  }

  const textChunks = chunkText(cleanedText);
  if (textChunks.length === 0) {
    console.log(`  Skipping ${book.title} - no valid chunks`);
    return false;
  }

  // Get or create author
  const author = book.authors[0] || { name: "Unknown", birth_year: null, death_year: null };
  const authorId = getOrCreateAuthor(author);

  // Create work
  const workId = generateId();
  const work: Work = {
    id: workId,
    author_id: authorId,
    title: book.title,
    slug: slugify(book.title),
    original_language: "en",
    publication_year: null,
    genre: book.subjects[0] || null,
    form: "novel",
    source: "gutenberg",
    source_id: String(book.id),
    created_at: new Date().toISOString()
  };
  works.push(work);

  // Create chunks
  for (const chunk of textChunks) {
    chunks.push({
      id: generateId(),
      work_id: workId,
      content: chunk.text,
      sequence: chunk.index,
      created_at: new Date().toISOString()
    });
  }

  // Mark as downloaded
  downloadedIds.add(book.id);
  progress.phaseStats[phase].books++;
  progress.phaseStats[phase].passages += textChunks.length;
  totalBooksProcessed++;

  console.log(`  ✓ ${book.title} by ${author.name} - ${textChunks.length} passages`);

  // Save progress every 10 books
  if (totalBooksProcessed % 10 === 0) {
    await saveProgress();
    await saveData();
    await updateProgressMd();
  }

  return true;
}

// ============ Phase 1: Top 200 ============

async function phase1(): Promise<void> {
  console.log("\n========================================");
  console.log("PHASE 1: Top 200 Most Downloaded");
  console.log("========================================\n");

  let page = 1;
  let booksProcessed = 0;
  const target = 200;

  while (booksProcessed < target) {
    console.log(`Fetching popular books page ${page}...`);
    const response = await fetchPopularBooks(page);

    for (const book of response.results) {
      if (booksProcessed >= target) break;
      await processBook(book, 1);
      booksProcessed++;
    }

    if (!response.next) break;
    page++;
  }

  console.log(`\nPhase 1 complete: ${progress.phaseStats[1].books} books, ${progress.phaseStats[1].passages} passages`);
}

// ============ Phase 2: Author Completists ============

async function phase2(): Promise<void> {
  console.log("\n========================================");
  console.log("PHASE 2: Author Completists (30 authors)");
  console.log("========================================\n");

  const startIndex = progress.currentAuthorIndex ?? 0;

  for (let i = startIndex; i < TOP_AUTHORS.length; i++) {
    const authorName = TOP_AUTHORS[i];
    progress.currentAuthorIndex = i;
    console.log(`\n[${i + 1}/${TOP_AUTHORS.length}] Searching for: ${authorName}`);

    // Search for author
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await searchBooks(authorName.split(',')[0], page);

        for (const book of response.results) {
          // Check if this book is actually by this author
          const isMatch = book.authors.some(a =>
            a.name.toLowerCase().includes(authorName.split(',')[0].toLowerCase())
          );
          if (isMatch) {
            await processBook(book, 2);
          }
        }

        hasMore = !!response.next;
        page++;
      } catch (e) {
        console.log(`  Error searching for ${authorName}: ${e}`);
        hasMore = false;
      }
    }

    await saveProgress();
    await updateProgressMd();
  }

  console.log(`\nPhase 2 complete: ${progress.phaseStats[2].books} books, ${progress.phaseStats[2].passages} passages`);
}

// ============ Phase 3: Greatest Books ============

async function phase3(): Promise<void> {
  console.log("\n========================================");
  console.log("PHASE 3: Greatest Books");
  console.log("========================================\n");

  const startIndex = progress.currentGreatestIndex ?? 0;

  for (let i = startIndex; i < GREATEST_BOOKS.length; i++) {
    const title = GREATEST_BOOKS[i];
    progress.currentGreatestIndex = i;
    console.log(`\n[${i + 1}/${GREATEST_BOOKS.length}] Searching for: ${title}`);

    try {
      const response = await searchBooks(title, 1);

      // Find best match
      const normalizedSearch = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matches = response.results.filter(book => {
        const normalizedTitle = book.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedTitle.includes(normalizedSearch) ||
               normalizedSearch.includes(normalizedTitle);
      });

      if (matches.length > 0) {
        await processBook(matches[0], 3);
      } else if (response.results.length > 0) {
        // Take first result if no exact match
        console.log(`  No exact match, trying: ${response.results[0].title}`);
        await processBook(response.results[0], 3);
      } else {
        console.log(`  No results found for: ${title}`);
      }
    } catch (e) {
      console.log(`  Error searching for ${title}: ${e}`);
    }

    if (i % 10 === 0) {
      await saveProgress();
      await updateProgressMd();
    }
  }

  console.log(`\nPhase 3 complete: ${progress.phaseStats[3].books} books, ${progress.phaseStats[3].passages} passages`);
}

// ============ Phase 4: Bookshelves ============

async function phase4(): Promise<void> {
  console.log("\n========================================");
  console.log("PHASE 4: Curated Bookshelves");
  console.log("========================================\n");

  const startIndex = progress.currentBookshelfIndex ?? 0;

  for (let i = startIndex; i < BOOKSHELVES.length; i++) {
    const bookshelf = BOOKSHELVES[i];
    progress.currentBookshelfIndex = i;
    console.log(`\n[${i + 1}/${BOOKSHELVES.length}] Fetching bookshelf: ${bookshelf}`);

    let page = 1;
    let hasMore = true;
    let booksInShelf = 0;

    while (hasMore) {
      try {
        const response = await fetchBooksByTopic(bookshelf, page);

        for (const book of response.results) {
          const processed = await processBook(book, 4);
          if (processed) booksInShelf++;
        }

        hasMore = !!response.next;
        page++;

        // Limit per bookshelf to avoid spending too long on one
        if (booksInShelf >= 100) {
          console.log(`  Reached 100 books for ${bookshelf}, moving on...`);
          hasMore = false;
        }
      } catch (e) {
        console.log(`  Error fetching ${bookshelf}: ${e}`);
        hasMore = false;
      }
    }

    console.log(`  Bookshelf "${bookshelf}": ${booksInShelf} new books`);
    await saveProgress();
    await updateProgressMd();
  }

  console.log(`\nPhase 4 complete: ${progress.phaseStats[4].books} books, ${progress.phaseStats[4].passages} passages`);
}

// ============ Main ============

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("GUTENBERG INGESTION - Starting");
  console.log("=".repeat(50));

  // Ensure data directory exists
  await Bun.write(`${DATA_DIR}/.gitkeep`, "");

  // Load any existing progress
  await loadProgress();

  // Run phases
  if (progress.phase <= 1) {
    progress.phase = 1;
    await phase1();
    progress.phase = 2;
    await saveProgress();
    await saveData();
  }

  if (progress.phase <= 2) {
    await phase2();
    progress.phase = 3;
    await saveProgress();
    await saveData();
  }

  if (progress.phase <= 3) {
    await phase3();
    progress.phase = 4;
    await saveProgress();
    await saveData();
  }

  if (progress.phase <= 4) {
    await phase4();
    progress.phase = 5; // Complete
    await saveProgress();
    await saveData();
  }

  // Final save
  await saveData();
  await updateProgressMd();

  // Create DONE.txt
  const elapsed = Date.now() - startTime;
  const totalBooks = Object.values(progress.phaseStats).reduce((a, b) => a + b.books, 0);
  const totalPassages = Object.values(progress.phaseStats).reduce((a, b) => a + b.passages, 0);
  const totalSkipped = Object.values(progress.phaseStats).reduce((a, b) => a + b.skipped, 0);

  const doneContent = `Gutenberg ingestion complete
Finished: ${new Date().toISOString()}

Phase 1 (Top 200): ${progress.phaseStats[1].books} books, ${progress.phaseStats[1].passages.toLocaleString()} passages
Phase 2 (Authors): ${progress.phaseStats[2].books} books, ${progress.phaseStats[2].passages.toLocaleString()} passages
Phase 3 (Greatest): ${progress.phaseStats[3].books} books, ${progress.phaseStats[3].passages.toLocaleString()} passages
Phase 4 (Bookshelves): ${progress.phaseStats[4].books} books, ${progress.phaseStats[4].passages.toLocaleString()} passages

Total Books: ${totalBooks}
Total Passages: ${totalPassages.toLocaleString()}
Duplicates Skipped: ${totalSkipped}
Runtime: ${formatDuration(elapsed)}
`;

  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  console.log("\n" + "=".repeat(50));
  console.log("GUTENBERG INGESTION - COMPLETE");
  console.log("=".repeat(50));
  console.log(doneContent);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
