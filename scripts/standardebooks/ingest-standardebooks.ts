// Main ingestion script for Standard Ebooks

import { fetchCatalog, downloadEpub, type CatalogEntry } from './fetch-catalog';
import { extractFromEpub, filterChapters } from './extract-text';
import { chunkBook } from './chunk-text';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import type { Author, Work, Chunk } from '../../src/types';
import { join } from 'path';
import { unlink } from 'fs/promises';

const DATA_DIR = join(import.meta.dir, '../../data/standardebooks');
const EPUBS_DIR = join(DATA_DIR, 'epubs');
const PROGRESS_FILE = join(DATA_DIR, '.progress.json');
const PROGRESS_MD = join(DATA_DIR, 'progress.md');

const AUTHORS_FILE = join(DATA_DIR, 'authors.json');
const WORKS_FILE = join(DATA_DIR, 'works.json');
const CHUNKS_FILE = join(DATA_DIR, 'chunks.json');

// Rate limiting - Standard Ebooks rate limits aggressively (~100 downloads before blocking)
// Strategy: Process in batches of 80, then cooldown for 30 minutes automatically
const DELAY_BETWEEN_DOWNLOADS = 6000;
const BATCH_SIZE = 80; // Process this many before automatic cooldown
const BATCH_COOLDOWN = 30 * 60 * 1000; // 30 minutes between batches
const RATE_LIMIT_COOLDOWN = 30 * 60 * 1000; // 30 minutes when rate limited

interface Stats {
  booksProcessed: number;
  totalPassages: number;
  startTime: Date;
  recentBooks: { title: string; author: string; passages: number }[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateProgressMd(
  stats: Stats,
  totalBooks: number,
  currentBook?: string,
  currentAuthor?: string
): Promise<void> {
  const elapsed = Date.now() - stats.startTime.getTime();
  const elapsedMins = Math.round(elapsed / 60000);

  const percent = ((stats.booksProcessed / totalBooks) * 100).toFixed(1);

  let md = `# Standard Ebooks Ingestion Progress

**Started:** ${stats.startTime.toISOString()}
**Last Updated:** ${new Date().toISOString()}

## Progress
- Books: ${stats.booksProcessed} / ${totalBooks} (${percent}%)
- Passages extracted: ${stats.totalPassages.toLocaleString()}
- Runtime: ${elapsedMins} minutes
`;

  if (currentBook && currentAuthor) {
    md += `- Current: "${currentBook}" by ${currentAuthor}\n`;
  }

  md += `\n## Recent Completions\n`;
  const recent = stats.recentBooks.slice(-10).reverse();
  for (const book of recent) {
    md += `- ✅ ${book.title} by ${book.author} - ${book.passages.toLocaleString()} passages\n`;
  }

  await writeJson(PROGRESS_MD.replace('.json', ''), md);
  await Bun.write(PROGRESS_MD, md);
}

async function main(): Promise<void> {
  console.log('=== Standard Ebooks Ingestion ===\n');

  // Fetch catalog
  const catalog = await fetchCatalog();
  console.log(`\nFound ${catalog.length} books in catalog\n`);

  // Load existing progress
  const progress = await readProgress(PROGRESS_FILE);
  const completedSet = new Set(progress.completed);
  console.log(`Already completed: ${completedSet.size} books\n`);

  // Load or initialize data arrays
  const authors: Author[] = (await readJson<Author[]>(AUTHORS_FILE)) ?? [];
  const works: Work[] = (await readJson<Work[]>(WORKS_FILE)) ?? [];
  const chunks: Chunk[] = (await readJson<Chunk[]>(CHUNKS_FILE)) ?? [];

  // Build author lookup by name
  const authorsByName = new Map<string, Author>();
  for (const author of authors) {
    authorsByName.set(author.name.toLowerCase(), author);
  }

  const stats: Stats = {
    booksProcessed: completedSet.size,
    totalPassages: chunks.length,
    startTime: new Date(),
    recentBooks: []
  };

  // Filter to only books we haven't processed
  const toProcess = catalog.filter(entry => !completedSet.has(entry.identifier));
  console.log(`Books to process: ${toProcess.length}\n`);

  let saveCounter = 0;
  let batchCounter = 0;
  let consecutiveFailures = 0;

  for (const entry of toProcess) {
    console.log(`\n[${stats.booksProcessed + 1}/${catalog.length}] Processing: ${entry.title} by ${entry.author}`);

    // Check if we need batch cooldown
    if (batchCounter >= BATCH_SIZE) {
      console.log(`\n⏸️  Batch complete (${BATCH_SIZE} books). Cooling down for 30 minutes...`);
      console.log(`   Next batch starts at: ${new Date(Date.now() + BATCH_COOLDOWN).toLocaleTimeString()}`);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(AUTHORS_FILE, authors);
      await writeJson(WORKS_FILE, works);
      await writeJson(CHUNKS_FILE, chunks);
      await updateProgressMd(stats, catalog.length, 'Cooling down...', 'Batch break');
      await sleep(BATCH_COOLDOWN);
      batchCounter = 0;
      consecutiveFailures = 0;
      console.log(`\n▶️  Resuming ingestion...`);
    }

    try {
      // Download EPUB
      const epubPath = join(EPUBS_DIR, `${entry.identifier}.epub`);
      console.log(`  Downloading...`);

      const downloadResult = await downloadEpub(entry.epubUrl, epubPath);

      if (downloadResult === 'rate_limited') {
        // Immediate 30-minute cooldown on rate limit
        console.log(`\n🚫 Rate limited! Cooling down for 30 minutes...`);
        console.log(`   Resuming at: ${new Date(Date.now() + RATE_LIMIT_COOLDOWN).toLocaleTimeString()}`);
        await saveProgress(PROGRESS_FILE, progress.completed);
        await writeJson(AUTHORS_FILE, authors);
        await writeJson(WORKS_FILE, works);
        await writeJson(CHUNKS_FILE, chunks);
        await updateProgressMd(stats, catalog.length, 'Rate limited - cooling down', 'Auto-pause');
        await sleep(RATE_LIMIT_COOLDOWN);
        batchCounter = 0; // Reset batch counter after cooldown
        console.log(`\n▶️  Resuming after rate limit cooldown...`);
        // Retry this same book
        continue;
      }

      if (downloadResult === 'failed') {
        console.log(`  ❌ Failed to download, skipping`);
        continue;
      }

      // Success - reset any failure tracking

      // Extract content
      console.log(`  Extracting text...`);
      const bookContent = await extractFromEpub(epubPath);

      if (!bookContent) {
        console.log(`  ❌ Failed to extract content, skipping`);
        // Clean up epub
        try { await unlink(epubPath); } catch {}
        continue;
      }

      // Filter chapters
      const filteredChapters = filterChapters(bookContent.chapters);
      console.log(`  Found ${filteredChapters.length} chapters`);

      if (filteredChapters.length === 0) {
        console.log(`  ❌ No valid chapters found, skipping`);
        try { await unlink(epubPath); } catch {}
        continue;
      }

      // Chunk the text
      const textChunks = chunkBook(
        filteredChapters.map(ch => ({ title: ch.title, content: ch.content }))
      );
      console.log(`  Created ${textChunks.length} passages`);

      if (textChunks.length === 0) {
        console.log(`  ❌ No passages created, skipping`);
        try { await unlink(epubPath); } catch {}
        continue;
      }

      // Get or create author
      const authorKey = bookContent.author.toLowerCase();
      let author = authorsByName.get(authorKey);

      if (!author) {
        author = {
          id: generateId(),
          name: bookContent.author,
          slug: createSlug(bookContent.author),
          birth_year: null,
          death_year: null,
          nationality: null,
          era: null,
          bio: null,
          wikipedia_url: null,
          created_at: getTimestamp()
        };
        authors.push(author);
        authorsByName.set(authorKey, author);
      }

      // Create work
      const work: Work = {
        id: generateId(),
        author_id: author.id,
        title: bookContent.title,
        slug: createSlug(bookContent.title),
        original_language: 'en',
        publication_year: null,
        genre: null,
        form: 'novel',
        source: 'standardebooks',
        source_id: entry.identifier,
        created_at: getTimestamp()
      };
      works.push(work);

      // Create chunks
      for (const tc of textChunks) {
        const chunk: Chunk = {
          id: generateId(),
          work_id: work.id,
          author_id: author.id,
          content: tc.content,
          chunk_index: tc.index,
          chunk_type: 'passage',
          source: 'standardebooks',
          source_metadata: {
            chapter: tc.chapter,
            position_percent: tc.positionPercent
          },
          created_at: getTimestamp()
        };
        chunks.push(chunk);
      }

      // Mark as completed
      progress.completed.push(entry.identifier);
      completedSet.add(entry.identifier);

      stats.booksProcessed++;
      stats.totalPassages += textChunks.length;
      stats.recentBooks.push({
        title: bookContent.title,
        author: bookContent.author,
        passages: textChunks.length
      });

      console.log(`  ✅ Done - ${textChunks.length} passages`);

      // Clean up epub to save space
      try { await unlink(epubPath); } catch {}

      // Increment batch counter
      batchCounter++;

      // Save progress periodically
      saveCounter++;
      if (saveCounter >= 5) {
        console.log(`\n  💾 Saving progress...`);
        await saveProgress(PROGRESS_FILE, progress.completed);
        await writeJson(AUTHORS_FILE, authors);
        await writeJson(WORKS_FILE, works);
        await writeJson(CHUNKS_FILE, chunks);
        await updateProgressMd(stats, catalog.length, entry.title, entry.author);
        saveCounter = 0;
      }

      // Rate limiting
      await sleep(DELAY_BETWEEN_DOWNLOADS);

    } catch (error) {
      console.error(`  ❌ Error processing ${entry.title}:`, error);
      continue;
    }
  }

  // Final save
  console.log('\n\n💾 Saving final data...');
  await saveProgress(PROGRESS_FILE, progress.completed);
  await writeJson(AUTHORS_FILE, authors);
  await writeJson(WORKS_FILE, works);
  await writeJson(CHUNKS_FILE, chunks);
  await updateProgressMd(stats, catalog.length);

  // Create completion signal
  const doneContent = `Standard Ebooks ingestion complete
Finished: ${new Date().toISOString()}
Books: ${stats.booksProcessed}
Passages: ${stats.totalPassages}
Authors: ${authors.length}
`;
  await Bun.write(join(DATA_DIR, 'DONE.txt'), doneContent);

  console.log('\n=== Standard Ebooks Ingestion Complete ===');
  console.log(`Books processed: ${stats.booksProcessed}`);
  console.log(`Total passages: ${stats.totalPassages.toLocaleString()}`);
  console.log(`Authors: ${authors.length}`);
  console.log(`\nDONE.txt created`);
}

main().catch(console.error);
