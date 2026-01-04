// Wikiquote Ingestion Script with Tier Support
// Phase 2A: Medium expansion with large-ready infrastructure
// Phase 3: Category-crawled authors support

import { fetchAuthorQuotes } from './fetch-author';
import { TIER1_AUTHORS, TIER2_AUTHORS, TIER3_AUTHORS } from './author-lists';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import type { Work, Chunk, WikiquoteAuthor } from '../../src/types';

const DATA_DIR = './data/wikiquote';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;
const MIN_QUOTES_THRESHOLD = 10;

interface IngestStats {
  newAuthors: number;
  newQuotes: number;
  skippedLowQuotes: number;
  skippedFailed: number;
}

function parseArgs(): { tier: number; limit?: number } {
  const args = process.argv.slice(2);
  const tierArg = args.find(a => a.startsWith('--tier='));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const tier = tierArg ? parseInt(tierArg.split('=')[1]) : 0; // 0 = all tiers
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  return { tier, limit };
}

export async function ingestWikiquote(tierFilter?: number, limitFilter?: number): Promise<IngestStats> {
  const { tier, limit } = tierFilter !== undefined
    ? { tier: tierFilter, limit: limitFilter }
    : parseArgs();

  console.log('[Wikiquote] Starting ingestion...');

  // Select authors based on tier
  let authorsToProcess: Array<{ name: string; era: string; tier: 1 | 2 | 3 }> = [];

  if (tier === 1) {
    authorsToProcess = TIER1_AUTHORS.map(a => ({ ...a, tier: 1 as const }));
    console.log(`[Wikiquote] Processing Tier 1 only: ${authorsToProcess.length} authors`);
  } else if (tier === 2) {
    authorsToProcess = TIER2_AUTHORS.map(a => ({ ...a, tier: 2 as const }));
    console.log(`[Wikiquote] Processing Tier 2 only: ${authorsToProcess.length} authors`);
  } else if (tier === 3) {
    // Tier 3: Category-crawled authors
    if (TIER3_AUTHORS.length === 0) {
      console.log('[Wikiquote] No Tier 3 authors found. Run crawl-categories.ts first.');
      return { newAuthors: 0, newQuotes: 0, skippedLowQuotes: 0, skippedFailed: 0 };
    }
    authorsToProcess = TIER3_AUTHORS.map(a => ({
      name: a.name,
      era: 'Unknown',
      tier: 3 as const
    }));
    console.log(`[Wikiquote] Processing Tier 3 (crawled): ${authorsToProcess.length} authors`);
  } else {
    // All tiers (tier 1 + 2 + 3)
    authorsToProcess = [
      ...TIER1_AUTHORS.map(a => ({ ...a, tier: 1 as const })),
      ...TIER2_AUTHORS.map(a => ({ ...a, tier: 2 as const })),
      ...TIER3_AUTHORS.map(a => ({ name: a.name, era: 'Unknown', tier: 3 as const }))
    ];
    console.log(`[Wikiquote] Processing all tiers: ${authorsToProcess.length} authors`);
  }

  // Apply limit if specified
  if (limit && limit < authorsToProcess.length) {
    authorsToProcess = authorsToProcess.slice(0, limit);
    console.log(`[Wikiquote] Limited to first ${limit} authors`);
  }

  const stats: IngestStats = {
    newAuthors: 0,
    newQuotes: 0,
    skippedLowQuotes: 0,
    skippedFailed: 0
  };

  // Load existing data and progress
  const existingAuthors = await readJson<WikiquoteAuthor[]>(`${DATA_DIR}/authors.json`) ?? [];
  const existingWorks = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  const existingChunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  const authors: WikiquoteAuthor[] = [...existingAuthors];
  const works: Work[] = [...existingWorks];
  const chunks: Chunk[] = [...existingChunks];

  for (const { name, era, tier: authorTier } of authorsToProcess) {
    // Skip if already processed
    if (progress.completed.includes(name)) {
      console.log(`[Wikiquote] Skipping ${name} (already completed)`);
      continue;
    }

    console.log(`[Wikiquote] Fetching ${name}...`);
    const result = await fetchAuthorQuotes(name);

    if (!result.success) {
      console.log(`[Wikiquote] Failed to fetch ${name}: ${result.error}`);
      stats.skippedFailed++;
      progress.completed.push(name);
      await saveProgress(PROGRESS_FILE, progress.completed);
      continue;
    }

    // Quality gate: skip if too few quotes
    if (result.quotes.length < MIN_QUOTES_THRESHOLD) {
      console.log(`[Wikiquote] Skipping ${name}: only ${result.quotes.length} quotes (min: ${MIN_QUOTES_THRESHOLD})`);
      stats.skippedLowQuotes++;
      progress.completed.push(name);
      await saveProgress(PROGRESS_FILE, progress.completed);
      continue;
    }

    // Create author record
    const authorId = generateId();
    const author: WikiquoteAuthor = {
      id: authorId,
      name,
      slug: createSlug(name),
      birth_year: null,
      death_year: null,
      nationality: null,
      era,
      bio: null,
      wikipedia_url: `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`,
      wikiquote_url: result.wikiquoteUrl,
      quote_count: result.quotes.length,
      discovery_method: 'curated',
      tier: authorTier,
      created_at: getTimestamp()
    };
    authors.push(author);
    stats.newAuthors++;

    // Create work record
    const workId = generateId();
    const work: Work = {
      id: workId,
      author_id: authorId,
      title: `${name} - Collected Quotes`,
      slug: createSlug(`${name}-collected-quotes`),
      original_language: 'en',
      publication_year: null,
      genre: 'Quotes',
      form: 'aphorism',
      source: 'wikiquote',
      source_id: name.replace(/ /g, '_'),
      created_at: getTimestamp()
    };
    works.push(work);

    // Create chunk records
    for (let i = 0; i < result.quotes.length; i++) {
      const quote = result.quotes[i];
      const chunk: Chunk = {
        id: generateId(),
        work_id: workId,
        author_id: authorId,
        content: quote.content,
        chunk_index: i,
        chunk_type: 'quote',
        source: 'wikiquote',
        source_metadata: {
          section: quote.section,
          wikiquote_url: result.wikiquoteUrl,
          tier: authorTier
        },
        created_at: getTimestamp()
      };
      chunks.push(chunk);
      stats.newQuotes++;
    }

    console.log(`[Wikiquote] Ingested ${result.quotes.length} quotes from ${name}`);

    // Update progress and save
    progress.completed.push(name);
    await saveProgress(PROGRESS_FILE, progress.completed);
    await writeJson(`${DATA_DIR}/authors.json`, authors);
    await writeJson(`${DATA_DIR}/works.json`, works);
    await writeJson(`${DATA_DIR}/chunks.json`, chunks);
  }

  console.log(`\n=== Wikiquote Ingestion Complete ===`);
  console.log(`New authors: ${stats.newAuthors}`);
  console.log(`New quotes: ${stats.newQuotes}`);
  console.log(`Skipped (low quotes): ${stats.skippedLowQuotes}`);
  console.log(`Skipped (failed): ${stats.skippedFailed}`);
  console.log(`Total authors: ${authors.length}`);
  console.log(`Total quotes: ${chunks.length}`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestWikiquote().catch(console.error);
}
