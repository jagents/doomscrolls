#!/usr/bin/env bun
// Gutenberg Phase 5 Ingestion - 9 Sub-phases

import {
  NEW_AUTHORS,
  NEW_BOOKSHELVES,
  SCIFI_AUTHORS,
  RUSSIAN_AUTHORS,
  GERMAN_AUTHORS,
  SPANISH_AUTHORS,
  SOCIAL_SCIENCE_AUTHORS,
  SOCIAL_SCIENCE_BOOKSHELVES,
  LITERARY_THEORY_AUTHORS,
  LITERARY_THEORY_BOOKSHELVES,
  PHILOSOPHY_AUTHORS,
  PHILOSOPHY_BOOKSHELVES
} from "./config-phase5";
import {
  searchBooks,
  fetchBooksByTopic,
  getTextUrl,
  downloadText,
  type GutenbergBook,
  type GutenbergAuthor
} from "./gutendex";
import { cleanGutenbergText, chunkText } from "./clean-text";

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

interface SubPhaseStats {
  books: number;
  passages: number;
  skipped: number;
}

interface Progress {
  subPhase: string;
  subPhaseStats: { [key: string]: SubPhaseStats };
  downloadedIds: number[];
  currentIndex?: number;
  startedAt: string;
  lastUpdatedAt: string;
}

// ============ State ============

const downloadedIds = new Set<number>();
const newAuthors: Author[] = [];
const newWorks: Work[] = [];
const newChunks: ChunkRecord[] = [];
const authorIdMap = new Map<string, string>();

let progress: Progress = {
  subPhase: "5A",
  subPhaseStats: {
    "5A": { books: 0, passages: 0, skipped: 0 },
    "5B": { books: 0, passages: 0, skipped: 0 },
    "5C": { books: 0, passages: 0, skipped: 0 },
    "5D": { books: 0, passages: 0, skipped: 0 },
    "5E": { books: 0, passages: 0, skipped: 0 },
    "5F": { books: 0, passages: 0, skipped: 0 },
    "5G": { books: 0, passages: 0, skipped: 0 },
    "5H": { books: 0, passages: 0, skipped: 0 },
    "5I": { books: 0, passages: 0, skipped: 0 }
  },
  downloadedIds: [],
  startedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString()
};

let totalBooksProcessed = 0;
const startTime = Date.now();
const SAVE_INTERVAL = 25; // Save every 25 books to manage memory

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

  newAuthors.push(author);
  authorIdMap.set(normalized, id);
  return id;
}

async function loadExistingData(): Promise<void> {
  console.log("Loading existing data from Phase 1-4...");

  try {
    // Load existing works to get IDs for dedup
    const worksFile = Bun.file(`${DATA_DIR}/works.json`);
    if (await worksFile.exists()) {
      const existingWorks = await worksFile.json() as Work[];
      for (const work of existingWorks) {
        downloadedIds.add(parseInt(work.source_id));
      }
      console.log(`  Loaded ${downloadedIds.size} existing work IDs for dedup`);
    }

    // Load existing authors to avoid duplicates
    const authorsFile = Bun.file(`${DATA_DIR}/authors.json`);
    if (await authorsFile.exists()) {
      const existingAuthors = await authorsFile.json() as Author[];
      for (const author of existingAuthors) {
        authorIdMap.set(normalizeAuthorName(author.name), author.id);
      }
      console.log(`  Loaded ${authorIdMap.size} existing author IDs`);
    }
  } catch (e) {
    console.log("Error loading existing data:", e);
  }
}

async function loadPhase5Progress(): Promise<boolean> {
  try {
    const file = Bun.file(`${DATA_DIR}/.progress-phase5.json`);
    if (await file.exists()) {
      const saved = await file.json() as Progress;
      progress = saved;
      saved.downloadedIds.forEach(id => downloadedIds.add(id));
      console.log(`Resuming Phase 5 from sub-phase ${progress.subPhase}`);
      return true;
    }
  } catch (e) {
    console.log("No Phase 5 progress file, starting fresh");
  }
  return false;
}

async function saveProgress(): Promise<void> {
  progress.downloadedIds = Array.from(downloadedIds);
  progress.lastUpdatedAt = new Date().toISOString();
  await Bun.write(`${DATA_DIR}/.progress-phase5.json`, JSON.stringify(progress, null, 2));
}

async function appendToFiles(): Promise<void> {
  if (newAuthors.length === 0 && newWorks.length === 0 && newChunks.length === 0) {
    return;
  }

  console.log(`  Saving: ${newAuthors.length} authors, ${newWorks.length} works, ${newChunks.length} chunks`);

  // Append authors
  if (newAuthors.length > 0) {
    const authorsFile = Bun.file(`${DATA_DIR}/authors.json`);
    let existingAuthors: Author[] = [];
    if (await authorsFile.exists()) {
      existingAuthors = await authorsFile.json();
    }
    const allAuthors = [...existingAuthors, ...newAuthors];
    await Bun.write(`${DATA_DIR}/authors.json`, JSON.stringify(allAuthors, null, 2));
    newAuthors.length = 0;
  }

  // Append works
  if (newWorks.length > 0) {
    const worksFile = Bun.file(`${DATA_DIR}/works.json`);
    let existingWorks: Work[] = [];
    if (await worksFile.exists()) {
      existingWorks = await worksFile.json();
    }
    const allWorks = [...existingWorks, ...newWorks];
    await Bun.write(`${DATA_DIR}/works.json`, JSON.stringify(allWorks, null, 2));
    newWorks.length = 0;
  }

  // Append chunks - use streaming to handle large file
  if (newChunks.length > 0) {
    const chunksPath = `${DATA_DIR}/chunks.json`;
    const chunksFile = Bun.file(chunksPath);

    if (await chunksFile.exists()) {
      // Read existing, append new, write back
      // This is memory-intensive but necessary for JSON format
      try {
        const existingChunks = await chunksFile.json() as ChunkRecord[];
        const allChunks = [...existingChunks, ...newChunks];
        await Bun.write(chunksPath, JSON.stringify(allChunks, null, 2));
      } catch (e) {
        // If memory error, try writing to a separate file
        console.log("  Memory issue with chunks, writing to phase5-chunks.json");
        const phase5ChunksPath = `${DATA_DIR}/phase5-chunks.json`;
        const phase5File = Bun.file(phase5ChunksPath);
        let existingPhase5Chunks: ChunkRecord[] = [];
        if (await phase5File.exists()) {
          try {
            existingPhase5Chunks = await phase5File.json();
          } catch { }
        }
        await Bun.write(phase5ChunksPath, JSON.stringify([...existingPhase5Chunks, ...newChunks], null, 2));
      }
    } else {
      await Bun.write(chunksPath, JSON.stringify(newChunks, null, 2));
    }
    newChunks.length = 0;
  }
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
  const totalBooks = Object.values(progress.subPhaseStats).reduce((a, b) => a + b.books, 0);
  const totalPassages = Object.values(progress.subPhaseStats).reduce((a, b) => a + b.passages, 0);
  const totalSkipped = Object.values(progress.subPhaseStats).reduce((a, b) => a + b.skipped, 0);

  const phaseNames: { [key: string]: string } = {
    "5A": "New Authors",
    "5B": "New Bookshelves",
    "5C": "Science Fiction",
    "5D": "Russian Literature",
    "5E": "German Literature",
    "5F": "Spanish Literature",
    "5G": "Social Sciences",
    "5H": "Literary Theory",
    "5I": "Philosophy"
  };

  const phaseOrder = ["5A", "5B", "5C", "5D", "5E", "5F", "5G", "5H", "5I"];
  const currentIdx = phaseOrder.indexOf(progress.subPhase);

  const phaseStatus = (p: string) => {
    const idx = phaseOrder.indexOf(p);
    if (idx < currentIdx) return "✅ Complete";
    if (idx === currentIdx) return "🔄 Running";
    return "⏳ Pending";
  };

  const rows = phaseOrder.map(p =>
    `| ${p} - ${phaseNames[p]} | ${phaseStatus(p)} | ${progress.subPhaseStats[p].books} | ${progress.subPhaseStats[p].passages.toLocaleString()} | ${progress.subPhaseStats[p].skipped} |`
  ).join('\n');

  const md = `# Gutenberg Phase 5 Progress

**Started:** ${new Date(progress.startedAt).toLocaleString()}
**Last Updated:** ${new Date().toLocaleString()}
**Elapsed:** ${formatDuration(elapsed)}

## Overall (Phase 5 only)
- **Sub-Phase:** ${progress.subPhase} (${phaseNames[progress.subPhase]})
- **New Books:** ${totalBooks}
- **New Passages:** ${totalPassages.toLocaleString()}
- **Duplicates Skipped:** ${totalSkipped}

## Sub-Phase Status
| Phase | Status | Books | Passages | Skipped |
|-------|--------|-------|----------|---------|
${rows}

## Combined with Phase 1-4
- Phase 1-4: 1,909 books, 2,125,671 passages
- Phase 5: ${totalBooks} books, ${totalPassages.toLocaleString()} passages
- **TOTAL:** ${1909 + totalBooks} books, ${(2125671 + totalPassages).toLocaleString()} passages
`;

  await Bun.write(`${DATA_DIR}/progress.md`, md);
}

// ============ Book Processing ============

async function processBook(book: GutenbergBook, subPhase: string): Promise<boolean> {
  // Check for duplicate
  if (downloadedIds.has(book.id)) {
    progress.subPhaseStats[subPhase].skipped++;
    return false;
  }

  // Must be English (for most phases)
  if (!book.languages.includes('en')) {
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
    console.log(`  Skipping ${book.title} - too short (${cleanedText.length} chars)`);
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
  newWorks.push(work);

  // Create chunks
  for (const chunk of textChunks) {
    newChunks.push({
      id: generateId(),
      work_id: workId,
      content: chunk.text,
      sequence: chunk.index,
      created_at: new Date().toISOString()
    });
  }

  // Mark as downloaded
  downloadedIds.add(book.id);
  progress.subPhaseStats[subPhase].books++;
  progress.subPhaseStats[subPhase].passages += textChunks.length;
  totalBooksProcessed++;

  console.log(`  ✓ ${book.title} by ${author.name} - ${textChunks.length} passages`);

  // Save periodically
  if (totalBooksProcessed % SAVE_INTERVAL === 0) {
    await appendToFiles();
    await saveProgress();
    await updateProgressMd();
  }

  return true;
}

// ============ Author Search ============

async function processAuthorList(authors: string[], subPhase: string, startIndex: number = 0): Promise<void> {
  for (let i = startIndex; i < authors.length; i++) {
    const authorName = authors[i];
    progress.currentIndex = i;
    console.log(`\n[${i + 1}/${authors.length}] Searching for: ${authorName}`);

    let page = 1;
    let hasMore = true;
    const searchTerm = authorName.split(',')[0];

    while (hasMore) {
      try {
        const response = await searchBooks(searchTerm, page);

        for (const book of response.results) {
          const isMatch = book.authors.some(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          if (isMatch) {
            await processBook(book, subPhase);
          }
        }

        hasMore = !!response.next && page < 10; // Limit pages per author
        page++;
      } catch (e) {
        console.log(`  Error searching for ${authorName}: ${e}`);
        hasMore = false;
      }
    }

    // Save after each author
    await appendToFiles();
    await saveProgress();
    await updateProgressMd();
  }
}

// ============ Bookshelf Search ============

async function processBookshelfList(bookshelves: string[], subPhase: string, startIndex: number = 0): Promise<void> {
  for (let i = startIndex; i < bookshelves.length; i++) {
    const bookshelf = bookshelves[i];
    progress.currentIndex = i;
    console.log(`\n[${i + 1}/${bookshelves.length}] Fetching bookshelf: ${bookshelf}`);

    let page = 1;
    let hasMore = true;
    let booksInShelf = 0;

    while (hasMore) {
      try {
        const response = await fetchBooksByTopic(bookshelf, page);

        for (const book of response.results) {
          const processed = await processBook(book, subPhase);
          if (processed) booksInShelf++;
        }

        hasMore = !!response.next && booksInShelf < 100; // Limit per shelf
        page++;
      } catch (e) {
        console.log(`  Error fetching ${bookshelf}: ${e}`);
        hasMore = false;
      }
    }

    console.log(`  Bookshelf "${bookshelf}": ${booksInShelf} new books`);
    await appendToFiles();
    await saveProgress();
    await updateProgressMd();
  }
}

// ============ Sub-Phases ============

async function subPhase5A(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5A: New General Authors (30)");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5A" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(NEW_AUTHORS, "5A", startIdx);

  console.log(`\n5A complete: ${progress.subPhaseStats["5A"].books} books, ${progress.subPhaseStats["5A"].passages} passages`);
}

async function subPhase5B(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5B: New Bookshelves (20)");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5B" ? (progress.currentIndex ?? 0) : 0;
  await processBookshelfList(NEW_BOOKSHELVES, "5B", startIdx);

  console.log(`\n5B complete: ${progress.subPhaseStats["5B"].books} books, ${progress.subPhaseStats["5B"].passages} passages`);
}

async function subPhase5C(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5C: Science Fiction Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5C" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(SCIFI_AUTHORS, "5C", startIdx);

  // Also get the full Science Fiction bookshelf
  console.log("\nFetching complete Science Fiction bookshelf...");
  await processBookshelfList(["Science Fiction"], "5C", 0);

  console.log(`\n5C complete: ${progress.subPhaseStats["5C"].books} books, ${progress.subPhaseStats["5C"].passages} passages`);
}

async function subPhase5D(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5D: Russian Literature Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5D" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(RUSSIAN_AUTHORS, "5D", startIdx);

  // Also search by topic
  console.log("\nFetching Russian Fiction bookshelf...");
  await processBookshelfList(["Russian Fiction"], "5D", 0);

  console.log(`\n5D complete: ${progress.subPhaseStats["5D"].books} books, ${progress.subPhaseStats["5D"].passages} passages`);
}

async function subPhase5E(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5E: German Literature Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5E" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(GERMAN_AUTHORS, "5E", startIdx);

  console.log("\nFetching German Fiction bookshelf...");
  await processBookshelfList(["German Fiction"], "5E", 0);

  console.log(`\n5E complete: ${progress.subPhaseStats["5E"].books} books, ${progress.subPhaseStats["5E"].passages} passages`);
}

async function subPhase5F(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5F: Spanish Literature Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5F" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(SPANISH_AUTHORS, "5F", startIdx);

  console.log("\nFetching Spanish Fiction bookshelf...");
  await processBookshelfList(["Spanish Fiction"], "5F", 0);

  console.log(`\n5F complete: ${progress.subPhaseStats["5F"].books} books, ${progress.subPhaseStats["5F"].passages} passages`);
}

async function subPhase5G(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5G: Social Sciences Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5G" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(SOCIAL_SCIENCE_AUTHORS, "5G", startIdx);

  console.log("\nFetching Social Science bookshelves...");
  await processBookshelfList(SOCIAL_SCIENCE_BOOKSHELVES, "5G", 0);

  console.log(`\n5G complete: ${progress.subPhaseStats["5G"].books} books, ${progress.subPhaseStats["5G"].passages} passages`);
}

async function subPhase5H(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5H: Literary Theory Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5H" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(LITERARY_THEORY_AUTHORS, "5H", startIdx);

  console.log("\nFetching Literary Theory bookshelves...");
  await processBookshelfList(LITERARY_THEORY_BOOKSHELVES, "5H", 0);

  console.log(`\n5H complete: ${progress.subPhaseStats["5H"].books} books, ${progress.subPhaseStats["5H"].passages} passages`);
}

async function subPhase5I(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("SUB-PHASE 5I: Philosophy Deep Dive");
  console.log("=".repeat(50));

  const startIdx = progress.subPhase === "5I" ? (progress.currentIndex ?? 0) : 0;
  await processAuthorList(PHILOSOPHY_AUTHORS, "5I", startIdx);

  console.log("\nFetching Philosophy bookshelves...");
  await processBookshelfList(PHILOSOPHY_BOOKSHELVES, "5I", 0);

  console.log(`\n5I complete: ${progress.subPhaseStats["5I"].books} books, ${progress.subPhaseStats["5I"].passages} passages`);
}

// ============ Main ============

async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("GUTENBERG PHASE 5 - Starting");
  console.log("=".repeat(50));

  // Load existing Phase 1-4 data for dedup
  await loadExistingData();

  // Check for Phase 5 resume
  await loadPhase5Progress();

  const phases = ["5A", "5B", "5C", "5D", "5E", "5F", "5G", "5H", "5I"];
  const phaseFuncs: { [key: string]: () => Promise<void> } = {
    "5A": subPhase5A,
    "5B": subPhase5B,
    "5C": subPhase5C,
    "5D": subPhase5D,
    "5E": subPhase5E,
    "5F": subPhase5F,
    "5G": subPhase5G,
    "5H": subPhase5H,
    "5I": subPhase5I
  };

  const startIdx = phases.indexOf(progress.subPhase);

  for (let i = startIdx; i < phases.length; i++) {
    const phase = phases[i];
    progress.subPhase = phase;
    progress.currentIndex = 0;
    await saveProgress();

    await phaseFuncs[phase]();

    // Move to next phase
    if (i < phases.length - 1) {
      progress.subPhase = phases[i + 1];
      progress.currentIndex = 0;
    }
    await appendToFiles();
    await saveProgress();
    await updateProgressMd();
  }

  // Final save
  await appendToFiles();
  await updateProgressMd();

  // Update DONE.txt
  const elapsed = Date.now() - startTime;
  const totalBooks = Object.values(progress.subPhaseStats).reduce((a, b) => a + b.books, 0);
  const totalPassages = Object.values(progress.subPhaseStats).reduce((a, b) => a + b.passages, 0);

  const doneContent = `Gutenberg Phase 5 complete
Finished: ${new Date().toISOString()}

Phase 1-4: 1,909 books, 2,125,671 passages
Phase 5: ${totalBooks} books, ${totalPassages.toLocaleString()} passages

TOTAL: ${1909 + totalBooks} books, ${(2125671 + totalPassages).toLocaleString()} passages

Sub-Phase Breakdown:
- 5A (New Authors): ${progress.subPhaseStats["5A"].books} books, ${progress.subPhaseStats["5A"].passages.toLocaleString()} passages
- 5B (New Bookshelves): ${progress.subPhaseStats["5B"].books} books, ${progress.subPhaseStats["5B"].passages.toLocaleString()} passages
- 5C (Science Fiction): ${progress.subPhaseStats["5C"].books} books, ${progress.subPhaseStats["5C"].passages.toLocaleString()} passages
- 5D (Russian Lit): ${progress.subPhaseStats["5D"].books} books, ${progress.subPhaseStats["5D"].passages.toLocaleString()} passages
- 5E (German Lit): ${progress.subPhaseStats["5E"].books} books, ${progress.subPhaseStats["5E"].passages.toLocaleString()} passages
- 5F (Spanish Lit): ${progress.subPhaseStats["5F"].books} books, ${progress.subPhaseStats["5F"].passages.toLocaleString()} passages
- 5G (Social Sciences): ${progress.subPhaseStats["5G"].books} books, ${progress.subPhaseStats["5G"].passages.toLocaleString()} passages
- 5H (Literary Theory): ${progress.subPhaseStats["5H"].books} books, ${progress.subPhaseStats["5H"].passages.toLocaleString()} passages
- 5I (Philosophy): ${progress.subPhaseStats["5I"].books} books, ${progress.subPhaseStats["5I"].passages.toLocaleString()} passages

Runtime: ${formatDuration(elapsed)}
`;

  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  console.log("\n" + "=".repeat(50));
  console.log("GUTENBERG PHASE 5 - COMPLETE");
  console.log("=".repeat(50));
  console.log(doneContent);
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
