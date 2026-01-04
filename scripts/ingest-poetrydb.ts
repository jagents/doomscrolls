// PoetryDB Ingestion Script
// Fetches poems from https://poetrydb.org/

import type { Author, Work, Chunk, PoetryDBPoem } from '../src/types';
import { generateId, getTimestamp } from '../src/utils/ids';
import { createSlug } from '../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../src/utils/files';
import { fetchJson } from '../src/utils/fetch';

const BASE_URL = 'https://poetrydb.org';
const DATA_DIR = './data/poetrydb';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;

interface IngestStats {
  authors: number;
  works: number;
  chunks: number;
}

async function fetchAuthors(): Promise<string[]> {
  console.log('[PoetryDB] Fetching author list...');
  const response = await fetchJson<{ authors: string[] }>(`${BASE_URL}/author`);
  return response.authors;
}

async function fetchPoemsByAuthor(authorName: string): Promise<PoetryDBPoem[]> {
  try {
    const encoded = encodeURIComponent(authorName);
    const poems = await fetchJson<PoetryDBPoem[]>(`${BASE_URL}/author/${encoded}`);

    // Handle case where API returns error object instead of array
    if (!Array.isArray(poems)) {
      return [];
    }

    return poems;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not found')) {
      return [];
    }
    throw error;
  }
}

function createAuthor(name: string): Author {
  return {
    id: generateId(),
    name,
    slug: createSlug(name),
    birth_year: null,
    death_year: null,
    nationality: null,
    era: null,
    bio: null,
    wikipedia_url: null,
    created_at: getTimestamp()
  };
}

function createWork(poem: PoetryDBPoem, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: poem.title,
    slug: createSlug(poem.title),
    original_language: 'en',
    publication_year: null,
    genre: 'Poetry',
    form: 'poem',
    source: 'poetrydb',
    source_id: null,
    created_at: getTimestamp()
  };
}

function createChunk(poem: PoetryDBPoem, workId: string, authorId: string): Chunk {
  return {
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: poem.lines.join('\n'),
    chunk_index: 0,
    chunk_type: 'poem',
    source: 'poetrydb',
    source_metadata: {
      linecount: parseInt(poem.linecount) || poem.lines.length,
      title: poem.title
    },
    created_at: getTimestamp()
  };
}

export async function ingestPoetryDB(): Promise<IngestStats> {
  console.log('[PoetryDB] Starting ingestion...');

  const stats: IngestStats = { authors: 0, works: 0, chunks: 0 };

  // Load existing data and progress
  const existingAuthors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  const existingWorks = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  const existingChunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  const authors: Author[] = [...existingAuthors];
  const works: Work[] = [...existingWorks];
  const chunks: Chunk[] = [...existingChunks];

  // Track existing poem titles per author to deduplicate
  const existingPoemKeys = new Set(
    existingChunks.map(c => `${c.source_metadata.title}`)
  );

  // Fetch all authors
  const authorNames = await fetchAuthors();
  console.log(`[PoetryDB] Found ${authorNames.length} authors`);

  for (const authorName of authorNames) {
    // Skip if already completed
    if (progress.completed.includes(authorName)) {
      console.log(`[PoetryDB] Skipping ${authorName} (already completed)`);
      continue;
    }

    try {
      const poems = await fetchPoemsByAuthor(authorName);

      if (poems.length === 0) {
        console.log(`[PoetryDB] No poems found for ${authorName}`);
        progress.completed.push(authorName);
        await saveProgress(PROGRESS_FILE, progress.completed);
        continue;
      }

      // Find or create author
      let author = authors.find(a => a.name === authorName);
      if (!author) {
        author = createAuthor(authorName);
        authors.push(author);
        stats.authors++;
      }

      // Process poems
      let poemCount = 0;
      for (const poem of poems) {
        // Skip if we've already ingested this poem
        const poemKey = `${poem.title}`;
        if (existingPoemKeys.has(poemKey)) {
          continue;
        }

        // Skip poems with empty content
        if (!poem.lines || poem.lines.length === 0) {
          continue;
        }

        const work = createWork(poem, author.id);
        const chunk = createChunk(poem, work.id, author.id);

        works.push(work);
        chunks.push(chunk);
        existingPoemKeys.add(poemKey);

        stats.works++;
        stats.chunks++;
        poemCount++;
      }

      console.log(`[PoetryDB] Ingested ${poemCount} poems by ${authorName}`);

      // Save progress after each author
      progress.completed.push(authorName);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);

    } catch (error) {
      console.error(`[PoetryDB] Error processing ${authorName}:`, error);
      // Continue with next author
    }
  }

  console.log(`[PoetryDB] Ingestion complete: ${stats.authors} authors, ${stats.works} poems`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestPoetryDB().catch(console.error);
}
