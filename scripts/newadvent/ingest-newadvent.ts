#!/usr/bin/env bun
/**
 * New Advent Church Fathers Ingestion Script
 *
 * Fetches Church Fathers texts from newadvent.org/fathers/
 * and processes them into chunks for the Doomscrolls database.
 */

import * as cheerio from "cheerio";
import { FATHERS_CONFIG, type FatherConfig, type WorkConfig, getConfigStats } from "./fathers-config";
import { generateId, getTimestamp } from "../../src/utils/ids";
import { createSlug } from "../../src/utils/slugs";
import type { Author, Work, Chunk, Progress } from "../../src/types";

// Constants
const BASE_URL = "https://www.newadvent.org/fathers/";
const DATA_DIR = "./data/newadvent";
const RATE_LIMIT_MS = 1200; // Be respectful - 1.2 seconds between requests
const MIN_CHUNK_LENGTH = 200;
const MAX_CHUNK_LENGTH = 700;
const TARGET_CHUNK_LENGTH = 450;

// State
interface IngestState {
  authors: Author[];
  works: Work[];
  chunks: Chunk[];
  progress: {
    completedWorks: string[];
    failedWorks: string[];
    lastUpdated: string;
    currentAuthor?: string;
    currentWork?: string;
  };
  stats: {
    startTime: string;
    worksProcessed: number;
    chaptersProcessed: number;
    chunksCreated: number;
  };
}

let state: IngestState = {
  authors: [],
  works: [],
  chunks: [],
  progress: {
    completedWorks: [],
    failedWorks: [],
    lastUpdated: getTimestamp()
  },
  stats: {
    startTime: getTimestamp(),
    worksProcessed: 0,
    chaptersProcessed: 0,
    chunksCreated: 0
  }
};

let lastFetchTime = 0;

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  if (timeSinceLastFetch < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastFetch);
  }
  lastFetchTime = Date.now();

  const maxRetries = 5;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Doomscrolls/1.0 (Classical literature collection; educational use)',
          'Accept': 'text/html',
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.text();
      }

      if (response.status === 404) {
        throw new Error(`Not found: ${url}`);
      }

      if (response.status === 429) {
        const waitTime = 5000 * Math.pow(2, attempt);
        console.log(`  [Rate limited] Waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.startsWith('Not found')) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const waitTime = 2000 * Math.pow(2, attempt);
        console.log(`  [Retry ${attempt + 1}] ${lastError.message}, waiting ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${url}`);
}

// HTML parsing
function extractChapterUrls(html: string, workSourceId: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  // Look for links to chapter pages (same pattern as work, with extra digits)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Match patterns like "../fathers/110101.htm" or "/fathers/110101.htm"
    // The work is e.g. "1101" so chapters are "110101", "110102", etc.
    const match = href.match(/fathers\/(\d+)\.htm/);
    if (match) {
      const chapterId = match[1];
      // Chapter IDs are longer than work IDs and start with the work ID
      if (chapterId.length > workSourceId.length && chapterId.startsWith(workSourceId)) {
        const fullUrl = `${BASE_URL}${chapterId}.htm`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    }
  });

  // Sort by chapter number
  urls.sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)\.htm/)?.[1] || '0');
    const numB = parseInt(b.match(/(\d+)\.htm/)?.[1] || '0');
    return numA - numB;
  });

  return urls;
}

function extractChapterContent(html: string): { title: string; paragraphs: string[] } {
  const $ = cheerio.load(html);

  // Get chapter title from h2 or h3
  let title = $('h2').first().text().trim() || $('h3').first().text().trim() || '';
  // Clean up the title
  title = title.replace(/\s+/g, ' ').trim();

  const paragraphs: string[] = [];

  // Extract main content paragraphs
  // Skip navigation and footer content
  $('p').each((_, el) => {
    const $p = $(el);

    // Skip if it's in a navigation area
    const parent = $p.parent();
    if (parent.is('nav') || parent.is('header') || parent.is('footer')) {
      return;
    }

    // Get the text
    let text = $p.text().trim();

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Skip very short paragraphs or navigation text
    if (text.length < 30) return;
    if (text.match(/^(Home|Contents|Index|Chapter|Book|Previous|Next)/i)) return;

    // Skip footnote markers that are just numbers
    if (text.match(/^\d+\.?\s*$/)) return;

    paragraphs.push(text);
  });

  return { title, paragraphs };
}

// Text chunking
function chunkText(text: string): string[] {
  const chunks: string[] = [];

  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If adding this sentence would exceed max, save current chunk
    if (currentChunk.length + trimmedSentence.length > MAX_CHUNK_LENGTH) {
      if (currentChunk.length >= MIN_CHUNK_LENGTH) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else if (currentChunk.length > 0) {
        // Current chunk is too short, add sentence anyway
        currentChunk += ' ' + trimmedSentence;
        if (currentChunk.length >= MIN_CHUNK_LENGTH) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      } else {
        // No current chunk, start with this sentence
        currentChunk = trimmedSentence;
      }
    } else {
      // Add sentence to current chunk
      currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;

      // If we're at target length, save
      if (currentChunk.length >= TARGET_CHUNK_LENGTH) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length >= MIN_CHUNK_LENGTH) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    // Append short remainder to previous chunk if it exists
    chunks[chunks.length - 1] += ' ' + currentChunk.trim();
  } else if (currentChunk.length > 50) {
    // If it's the only chunk and reasonably sized, keep it
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function chunkParagraphs(paragraphs: string[]): string[] {
  const allChunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= MAX_CHUNK_LENGTH && para.length >= MIN_CHUNK_LENGTH) {
      // Paragraph is good size as-is
      allChunks.push(para);
    } else if (para.length < MIN_CHUNK_LENGTH) {
      // Short paragraph - might combine with next
      // For now, just add it
      allChunks.push(para);
    } else {
      // Long paragraph - chunk it
      const chunks = chunkText(para);
      allChunks.push(...chunks);
    }
  }

  // Clean up very short chunks by merging
  const finalChunks: string[] = [];
  let buffer = '';

  for (const chunk of allChunks) {
    if (buffer.length + chunk.length < MAX_CHUNK_LENGTH) {
      buffer = buffer ? buffer + ' ' + chunk : chunk;
    } else {
      if (buffer.length >= MIN_CHUNK_LENGTH) {
        finalChunks.push(buffer);
      }
      buffer = chunk;
    }

    if (buffer.length >= TARGET_CHUNK_LENGTH) {
      finalChunks.push(buffer);
      buffer = '';
    }
  }

  if (buffer.length >= MIN_CHUNK_LENGTH / 2) {
    finalChunks.push(buffer);
  }

  return finalChunks;
}

// File I/O
async function loadProgress(): Promise<void> {
  try {
    const progressFile = Bun.file(`${DATA_DIR}/.progress.json`);
    if (await progressFile.exists()) {
      const data = await progressFile.json();
      state.progress = data.progress || state.progress;
      state.stats = data.stats || state.stats;
      console.log(`[Resume] Loaded progress: ${state.progress.completedWorks.length} works completed`);
    }

    // Load existing data files
    const authorsFile = Bun.file(`${DATA_DIR}/authors.json`);
    if (await authorsFile.exists()) {
      state.authors = await authorsFile.json();
    }

    const worksFile = Bun.file(`${DATA_DIR}/works.json`);
    if (await worksFile.exists()) {
      state.works = await worksFile.json();
    }

    const chunksFile = Bun.file(`${DATA_DIR}/chunks.json`);
    if (await chunksFile.exists()) {
      state.chunks = await chunksFile.json();
    }
  } catch (error) {
    console.log('[Init] Starting fresh - no previous progress found');
  }
}

async function saveProgress(): Promise<void> {
  state.progress.lastUpdated = getTimestamp();

  await Bun.write(
    `${DATA_DIR}/.progress.json`,
    JSON.stringify({ progress: state.progress, stats: state.stats }, null, 2)
  );
}

async function saveData(): Promise<void> {
  await Promise.all([
    Bun.write(`${DATA_DIR}/authors.json`, JSON.stringify(state.authors, null, 2)),
    Bun.write(`${DATA_DIR}/works.json`, JSON.stringify(state.works, null, 2)),
    Bun.write(`${DATA_DIR}/chunks.json`, JSON.stringify(state.chunks, null, 2)),
  ]);
}

async function updateProgressMarkdown(): Promise<void> {
  const completedWorks = state.progress.completedWorks;
  const totalWorksInConfig = FATHERS_CONFIG.reduce((sum, f) => sum + f.works.length, 0);

  const uniqueAuthors = new Set(state.authors.map(a => a.id));
  const totalAuthorsInConfig = FATHERS_CONFIG.length;

  const md = `# New Advent Ingestion Progress

**Started:** ${state.stats.startTime}
**Last Updated:** ${getTimestamp()}

## Summary
- Authors: ${uniqueAuthors.size} / ${totalAuthorsInConfig} (${Math.round(uniqueAuthors.size / totalAuthorsInConfig * 100)}%)
- Works: ${state.works.length} / ${totalWorksInConfig} (${Math.round(state.works.length / totalWorksInConfig * 100)}%)
- Passages: ${state.chunks.length.toLocaleString()}
- Chapters processed: ${state.stats.chaptersProcessed}

## Status
${state.progress.currentAuthor ? `Currently processing: ${state.progress.currentAuthor} - ${state.progress.currentWork || 'starting...'}` : 'Idle'}

## Completed Works
${completedWorks.map(w => `- ${w}`).join('\n') || 'None yet'}

${state.progress.failedWorks.length > 0 ? `
## Failed Works
${state.progress.failedWorks.map(w => `- ${w}`).join('\n')}
` : ''}
`;

  await Bun.write(`${DATA_DIR}/progress.md`, md);
}

// Main processing functions
async function processWork(
  fatherConfig: FatherConfig,
  workConfig: WorkConfig,
  authorRecord: Author
): Promise<number> {
  const workKey = `${fatherConfig.author.name} - ${workConfig.title}`;

  if (state.progress.completedWorks.includes(workKey)) {
    console.log(`  [Skip] Already completed: ${workConfig.title}`);
    return 0;
  }

  console.log(`\n  Processing: ${workConfig.title} (${workConfig.sourceId})`);
  state.progress.currentWork = workConfig.title;

  try {
    // Fetch work index page
    const indexUrl = `${BASE_URL}${workConfig.sourceId}.htm`;
    let indexHtml: string;

    try {
      indexHtml = await rateLimitedFetch(indexUrl);
    } catch (error) {
      // Some works might be single-page
      console.log(`    [Note] No index page, treating as single page`);
      indexHtml = '';
    }

    // Get chapter URLs
    let chapterUrls = extractChapterUrls(indexHtml, workConfig.sourceId);

    if (chapterUrls.length === 0) {
      // Single-page work - the index page IS the content
      chapterUrls = [indexUrl];
    }

    // Apply chapter limit if specified
    if (workConfig.maxChapters && chapterUrls.length > workConfig.maxChapters) {
      console.log(`    [Limit] Capping at ${workConfig.maxChapters} chapters (of ${chapterUrls.length})`);
      chapterUrls = chapterUrls.slice(0, workConfig.maxChapters);
    }

    console.log(`    Found ${chapterUrls.length} chapters`);

    // Create work record
    const workRecord: Work = {
      id: generateId(),
      author_id: authorRecord.id,
      title: workConfig.title,
      slug: createSlug(workConfig.title),
      original_language: fatherConfig.author.originalLanguage,
      publication_year: null, // These are ancient texts
      genre: workConfig.genre,
      form: workConfig.form,
      source: "newadvent",
      source_id: workConfig.sourceId,
      created_at: getTimestamp()
    };

    state.works.push(workRecord);

    // Process chapters
    let totalChunks = 0;

    for (let i = 0; i < chapterUrls.length; i++) {
      const chapterUrl = chapterUrls[i];
      const chapterNum = i + 1;

      try {
        const html = await rateLimitedFetch(chapterUrl);
        const { title: chapterTitle, paragraphs } = extractChapterContent(html);

        if (paragraphs.length === 0) {
          console.log(`    [Chapter ${chapterNum}] No content found`);
          continue;
        }

        // Chunk the paragraphs
        const chunks = chunkParagraphs(paragraphs);

        // Create chunk records
        for (let j = 0; j < chunks.length; j++) {
          const chunkRecord: Chunk = {
            id: generateId(),
            work_id: workRecord.id,
            author_id: authorRecord.id,
            content: chunks[j],
            chunk_index: totalChunks + j,
            chunk_type: "passage",
            source: "newadvent",
            source_metadata: {
              chapter: chapterNum,
              chapterTitle: chapterTitle || undefined,
              sourceId: workConfig.sourceId
            },
            created_at: getTimestamp()
          };

          state.chunks.push(chunkRecord);
        }

        totalChunks += chunks.length;
        state.stats.chaptersProcessed++;

        // Progress indicator every 10 chapters
        if (chapterNum % 10 === 0 || chapterNum === chapterUrls.length) {
          console.log(`    [Chapter ${chapterNum}/${chapterUrls.length}] ${chunks.length} passages (total: ${totalChunks})`);
        }

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes('Not found')) {
          console.log(`    [Error] Chapter ${chapterNum}: ${msg}`);
        }
      }
    }

    console.log(`    Completed: ${totalChunks} passages from ${chapterUrls.length} chapters`);

    state.stats.worksProcessed++;
    state.stats.chunksCreated += totalChunks;
    state.progress.completedWorks.push(workKey);

    // Save progress after each work
    await saveProgress();
    await saveData();
    await updateProgressMarkdown();

    return totalChunks;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    [Failed] ${workConfig.title}: ${msg}`);
    state.progress.failedWorks.push(workKey);
    await saveProgress();
    return 0;
  }
}

async function processAuthor(fatherConfig: FatherConfig): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${fatherConfig.author.name} (${fatherConfig.author.era})`);
  console.log(`${'='.repeat(60)}`);

  state.progress.currentAuthor = fatherConfig.author.name;

  // Check if author already exists
  let authorRecord = state.authors.find(a => a.slug === fatherConfig.author.slug);

  if (!authorRecord) {
    authorRecord = {
      id: generateId(),
      name: fatherConfig.author.name,
      slug: fatherConfig.author.slug,
      birth_year: fatherConfig.author.birthYear,
      death_year: fatherConfig.author.deathYear,
      nationality: null,
      era: fatherConfig.author.era,
      bio: null,
      wikipedia_url: null,
      created_at: getTimestamp()
    };
    state.authors.push(authorRecord);
  }

  // Sort works by priority
  const sortedWorks = [...fatherConfig.works].sort((a, b) => a.priority - b.priority);

  let authorTotal = 0;

  for (const workConfig of sortedWorks) {
    const chunks = await processWork(fatherConfig, workConfig, authorRecord);
    authorTotal += chunks;
  }

  console.log(`\n[${fatherConfig.author.name}] Total: ${authorTotal.toLocaleString()} passages`);
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('NEW ADVENT CHURCH FATHERS INGESTION');
  console.log('='.repeat(70));

  const configStats = getConfigStats();
  console.log(`\nConfiguration:`);
  console.log(`  - Tier 1 Authors: ${configStats.tier1Authors} (${configStats.tier1Works} works)`);
  console.log(`  - Tier 2 Authors: ${configStats.tier2Authors} (${configStats.tier2Works} works)`);
  console.log(`  - Total: ${configStats.totalAuthors} authors, ${configStats.totalWorks} works`);

  // Ensure data directory exists
  await Bun.write(`${DATA_DIR}/.gitkeep`, '');

  // Load existing progress
  await loadProgress();

  console.log(`\nStarting ingestion...`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between requests`);

  // Process Tier 1 first
  const tier1Fathers = FATHERS_CONFIG.filter(f => f.author.tier === 1);
  const tier2Fathers = FATHERS_CONFIG.filter(f => f.author.tier === 2);

  console.log(`\n${'#'.repeat(70)}`);
  console.log('# TIER 1: GREATEST CHURCH FATHERS');
  console.log(`${'#'.repeat(70)}`);

  for (const father of tier1Fathers) {
    await processAuthor(father);
  }

  console.log(`\n${'#'.repeat(70)}`);
  console.log('# TIER 2: IMPORTANT CHURCH FATHERS');
  console.log(`${'#'.repeat(70)}`);

  for (const father of tier2Fathers) {
    await processAuthor(father);
  }

  // Final save
  await saveData();
  await saveProgress();
  await updateProgressMarkdown();

  // Create completion marker
  const doneContent = `New Advent ingestion complete
Finished: ${getTimestamp()}
Authors: ${state.authors.length}
Works: ${state.works.length}
Passages: ${state.chunks.length}
`;

  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  console.log(`\n${'='.repeat(70)}`);
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Authors: ${state.authors.length}`);
  console.log(`Works: ${state.works.length}`);
  console.log(`Passages: ${state.chunks.length.toLocaleString()}`);
  console.log(`\nOutput: ${DATA_DIR}/`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
