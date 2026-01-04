// Combine Script
// Merges and deduplicates data from all sources

import type { Author, Work, Chunk } from '../src/types';
import { generateId, getTimestamp } from '../src/utils/ids';
import { createSlug } from '../src/utils/slugs';
import { readJson, writeJson } from '../src/utils/files';

const DATA_DIR = './data';
const COMBINED_DIR = `${DATA_DIR}/combined`;

interface CombineStats {
  totalAuthors: number;
  totalWorks: number;
  totalChunks: number;
  bySource: {
    poetrydb: { authors: number; works: number; chunks: number };
    bible: { authors: number; works: number; chunks: number };
    wikiquote: { authors: number; works: number; chunks: number };
  };
}

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export async function combine(): Promise<CombineStats> {
  console.log('[Combine] Starting merge process...');

  const stats: CombineStats = {
    totalAuthors: 0,
    totalWorks: 0,
    totalChunks: 0,
    bySource: {
      poetrydb: { authors: 0, works: 0, chunks: 0 },
      bible: { authors: 0, works: 0, chunks: 0 },
      wikiquote: { authors: 0, works: 0, chunks: 0 }
    }
  };

  // Load all source data
  const poetrydbAuthors = await readJson<Author[]>(`${DATA_DIR}/poetrydb/authors.json`) ?? [];
  const poetrydbWorks = await readJson<Work[]>(`${DATA_DIR}/poetrydb/works.json`) ?? [];
  const poetrydbChunks = await readJson<Chunk[]>(`${DATA_DIR}/poetrydb/chunks.json`) ?? [];

  const bibleAuthors = await readJson<Author[]>(`${DATA_DIR}/bible/authors.json`) ?? [];
  const bibleWorks = await readJson<Work[]>(`${DATA_DIR}/bible/works.json`) ?? [];
  const bibleChunks = await readJson<Chunk[]>(`${DATA_DIR}/bible/chunks.json`) ?? [];

  const wikiquoteAuthors = await readJson<Author[]>(`${DATA_DIR}/wikiquote/authors.json`) ?? [];
  const wikiquoteWorks = await readJson<Work[]>(`${DATA_DIR}/wikiquote/works.json`) ?? [];
  const wikiquoteChunks = await readJson<Chunk[]>(`${DATA_DIR}/wikiquote/chunks.json`) ?? [];

  // Track source stats
  stats.bySource.poetrydb = {
    authors: poetrydbAuthors.length,
    works: poetrydbWorks.length,
    chunks: poetrydbChunks.length
  };
  stats.bySource.bible = {
    authors: bibleAuthors.length,
    works: bibleWorks.length,
    chunks: bibleChunks.length
  };
  stats.bySource.wikiquote = {
    authors: wikiquoteAuthors.length,
    works: wikiquoteWorks.length,
    chunks: wikiquoteChunks.length
  };

  console.log(`[Combine] Loaded data:`);
  console.log(`  PoetryDB: ${poetrydbAuthors.length} authors, ${poetrydbWorks.length} works, ${poetrydbChunks.length} chunks`);
  console.log(`  Bible: ${bibleAuthors.length} authors, ${bibleWorks.length} works, ${bibleChunks.length} chunks`);
  console.log(`  Wikiquote: ${wikiquoteAuthors.length} authors, ${wikiquoteWorks.length} works, ${wikiquoteChunks.length} chunks`);

  // Merge and deduplicate authors
  const allSourceAuthors = [...poetrydbAuthors, ...bibleAuthors, ...wikiquoteAuthors];
  const authorIdMap = new Map<string, string>(); // old ID -> new ID
  const mergedAuthors: Author[] = [];
  const seenAuthors = new Map<string, Author>(); // normalized name -> author

  for (const author of allSourceAuthors) {
    const normalizedName = normalizeAuthorName(author.name);

    if (seenAuthors.has(normalizedName)) {
      // Map old ID to existing author's new ID
      const existingAuthor = seenAuthors.get(normalizedName)!;
      authorIdMap.set(author.id, existingAuthor.id);

      // Merge any additional info (prefer non-null values)
      if (!existingAuthor.era && author.era) existingAuthor.era = author.era;
      if (!existingAuthor.bio && author.bio) existingAuthor.bio = author.bio;
      if (!existingAuthor.wikipedia_url && author.wikipedia_url) {
        existingAuthor.wikipedia_url = author.wikipedia_url;
      }
      if (!existingAuthor.birth_year && author.birth_year) {
        existingAuthor.birth_year = author.birth_year;
      }
      if (!existingAuthor.death_year && author.death_year) {
        existingAuthor.death_year = author.death_year;
      }
    } else {
      // Create new combined author with fresh ID
      const newId = generateId();
      const newAuthor: Author = {
        ...author,
        id: newId,
        slug: createSlug(author.name),
        created_at: getTimestamp()
      };
      mergedAuthors.push(newAuthor);
      seenAuthors.set(normalizedName, newAuthor);
      authorIdMap.set(author.id, newId);
    }
  }

  console.log(`[Combine] Merged ${allSourceAuthors.length} authors into ${mergedAuthors.length} unique authors`);

  // Merge works with updated author IDs
  const allSourceWorks = [...poetrydbWorks, ...bibleWorks, ...wikiquoteWorks];
  const workIdMap = new Map<string, string>(); // old ID -> new ID
  const mergedWorks: Work[] = [];

  for (const work of allSourceWorks) {
    const newId = generateId();
    const newAuthorId = authorIdMap.get(work.author_id) ?? work.author_id;

    const newWork: Work = {
      ...work,
      id: newId,
      author_id: newAuthorId,
      slug: createSlug(work.title),
      created_at: getTimestamp()
    };

    mergedWorks.push(newWork);
    workIdMap.set(work.id, newId);
  }

  console.log(`[Combine] Processed ${mergedWorks.length} works`);

  // Merge chunks with updated IDs
  const allSourceChunks = [...poetrydbChunks, ...bibleChunks, ...wikiquoteChunks];
  const mergedChunks: Chunk[] = [];

  for (const chunk of allSourceChunks) {
    const newId = generateId();
    const newAuthorId = authorIdMap.get(chunk.author_id) ?? chunk.author_id;
    const newWorkId = chunk.work_id ? (workIdMap.get(chunk.work_id) ?? chunk.work_id) : null;

    const newChunk: Chunk = {
      ...chunk,
      id: newId,
      author_id: newAuthorId,
      work_id: newWorkId,
      created_at: getTimestamp()
    };

    mergedChunks.push(newChunk);
  }

  console.log(`[Combine] Processed ${mergedChunks.length} chunks`);

  // Write combined files
  await writeJson(`${COMBINED_DIR}/authors.json`, mergedAuthors);
  await writeJson(`${COMBINED_DIR}/works.json`, mergedWorks);
  await writeJson(`${COMBINED_DIR}/chunks.json`, mergedChunks);

  stats.totalAuthors = mergedAuthors.length;
  stats.totalWorks = mergedWorks.length;
  stats.totalChunks = mergedChunks.length;

  console.log(`[Combine] Complete!`);
  console.log(`  Total unique authors: ${stats.totalAuthors}`);
  console.log(`  Total works: ${stats.totalWorks}`);
  console.log(`  Total chunks: ${stats.totalChunks}`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  combine().catch(console.error);
}
