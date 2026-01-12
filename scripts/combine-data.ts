#!/usr/bin/env bun
/**
 * Doomscrolls Data Combiner - Streaming Edition v2
 *
 * Combines ~7.5 million text passages from 10+ sources into a unified dataset.
 * Uses streaming for chunks to handle ~4-5GB of data without memory issues.
 *
 * Handles two different chunk formats:
 * 1. Standard format: chunks with work_id and author_id references
 * 2. Phase5b format: chunks with inline authors[] array and source_id
 */

import { createReadStream, createWriteStream, existsSync, statSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = join(process.cwd(), 'data');
const COMBINED_DIR = join(DATA_DIR, 'combined');

// Chunk files to process
const CHUNK_FILES = [
  { path: 'data/gutenberg/chunks.json', source: 'gutenberg', phase: 'phase1-4', format: 'standard' },
  { path: 'data/gutenberg/phase5-chunks.json', source: 'gutenberg', phase: 'phase5', format: 'standard' },
  { path: 'data/gutenberg/phase5b-chunks.json', source: 'gutenberg', phase: 'phase5b', format: 'inline' },
  { path: 'data/standardebooks/chunks.json', source: 'standardebooks', phase: null, format: 'standard' },
  { path: 'data/wikiquote/chunks.json', source: 'wikiquote', phase: null, format: 'standard' },
  { path: 'data/ccel/chunks.json', source: 'ccel', phase: null, format: 'standard' },
  { path: 'data/newadvent/chunks.json', source: 'newadvent', phase: null, format: 'standard' },
  { path: 'data/bibletranslations/chunks.json', source: 'bibletranslations', phase: null, format: 'standard' },
  { path: 'data/bible/chunks.json', source: 'bible', phase: null, format: 'standard' },
  { path: 'data/perseus/chunks.json', source: 'perseus', phase: null, format: 'standard' },
  { path: 'data/sacredtexts/chunks.json', source: 'sacredtexts', phase: null, format: 'standard' },
  { path: 'data/poetrydb/chunks.json', source: 'poetrydb', phase: null, format: 'standard' },
];

// Author files to load
const AUTHOR_FILES = [
  { path: 'data/gutenberg/authors.json', source: 'gutenberg' },
  { path: 'data/gutenberg/phase5b-authors.json', source: 'gutenberg' },
  { path: 'data/standardebooks/authors.json', source: 'standardebooks' },
  { path: 'data/wikiquote/authors.json', source: 'wikiquote' },
  { path: 'data/ccel/authors.json', source: 'ccel' },
  { path: 'data/newadvent/authors.json', source: 'newadvent' },
  { path: 'data/bibletranslations/authors.json', source: 'bibletranslations' },
  { path: 'data/bible/authors.json', source: 'bible' },
  { path: 'data/perseus/authors.json', source: 'perseus' },
  { path: 'data/sacredtexts/authors.json', source: 'sacredtexts' },
  { path: 'data/poetrydb/authors.json', source: 'poetrydb' },
];

// Work files to load
const WORK_FILES = [
  { path: 'data/gutenberg/works.json', source: 'gutenberg', phase: 'phase1-4', format: 'standard' },
  { path: 'data/gutenberg/phase5b-works.json', source: 'gutenberg', phase: 'phase5b', format: 'inline' },
  { path: 'data/standardebooks/works.json', source: 'standardebooks', phase: null, format: 'standard' },
  { path: 'data/wikiquote/works.json', source: 'wikiquote', phase: null, format: 'standard' },
  { path: 'data/ccel/works.json', source: 'ccel', phase: null, format: 'standard' },
  { path: 'data/newadvent/works.json', source: 'newadvent', phase: null, format: 'standard' },
  { path: 'data/bibletranslations/works.json', source: 'bibletranslations', phase: null, format: 'standard' },
  { path: 'data/bible/works.json', source: 'bible', phase: null, format: 'standard' },
  { path: 'data/perseus/works.json', source: 'perseus', phase: null, format: 'standard' },
  { path: 'data/sacredtexts/works.json', source: 'sacredtexts', phase: null, format: 'standard' },
  { path: 'data/poetrydb/works.json', source: 'poetrydb', phase: null, format: 'standard' },
];

// Interfaces
interface UnifiedAuthor {
  id: string;
  name: string;
  slug: string;
  name_variants: string[];
  birth_year?: number;
  death_year?: number;
  nationality?: string;
  era?: string;
  sources: string[];
  source_ids: Record<string, string>;
  work_count: number;
  chunk_count: number;
  created_at: string;
}

interface UnifiedWork {
  id: string;
  title: string;
  slug: string;
  author_id: string;
  year?: number;
  language: string;
  original_language?: string;
  translator?: string;
  type: string;
  genre?: string;
  tradition?: string;
  source: string;
  source_id: string;
  ingestion_phase?: string;
  chunk_count: number;
  full_text_url?: string;
  created_at: string;
}

interface UnifiedChunk {
  id: string;
  text: string;
  author_id: string;
  work_id?: string;
  type: string;
  position_index: number;
  position_chapter?: string;
  position_section?: string;
  position_paragraph?: number;
  position_verse?: string;
  position_book?: string;
  source: string;
  source_chunk_id: string;
  bible_translation?: string;
  bible_book?: string;
  bible_chapter?: number;
  bible_verse?: number;
  char_count: number;
  word_count: number;
  created_at: string;
}

interface Stats {
  total_authors: number;
  total_works: number;
  total_chunks: number;
  by_source: Record<string, { authors: number; works: number; chunks: number }>;
  by_type: Record<string, number>;
  top_authors: Array<{ name: string; chunk_count: number }>;
  generated_at: string;
  files: {
    authors_json_mb: number;
    works_json_mb: number;
    chunks_json_mb: number;
  };
}

// Mappings - these are the key data structures
const authorsBySlug: Map<string, UnifiedAuthor> = new Map();
const authorIdMap: Map<string, string> = new Map(); // source_oldId -> unifiedId
const authorNameToId: Map<string, string> = new Map(); // normalized_name -> unifiedId (for inline lookups)

const workIdMap: Map<string, string> = new Map(); // source_oldWorkId -> unifiedWorkId
const workSourceIdMap: Map<string, string> = new Map(); // source_sourceId -> unifiedWorkId (for inline)
const workToAuthor: Map<string, string> = new Map(); // unifiedWorkId -> unifiedAuthorId

const workChunkCounts: Map<string, number> = new Map();
const authorChunkCounts: Map<string, number> = new Map();

// Stats
const stats: Stats = {
  total_authors: 0,
  total_works: 0,
  total_chunks: 0,
  by_source: {},
  by_type: {},
  top_authors: [],
  generated_at: '',
  files: { authors_json_mb: 0, works_json_mb: 0, chunks_json_mb: 0 },
};

const startTime = new Date();

function log(msg: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

function normalizeAuthorName(name: string): string {
  if (!name) return 'Unknown';
  // Handle "Last, First" format -> "First Last"
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim());
    if (parts.length === 2) {
      const [last, first] = parts;
      // Remove parenthetical additions like "(Robert William)"
      const cleanFirst = first.replace(/\s*\([^)]*\)\s*/g, '').trim();
      return `${cleanFirst} ${last}`.trim();
    }
  }
  return name.trim();
}

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateFullTextUrl(source: string, sourceId: string, slug?: string): string | undefined {
  switch (source) {
    case 'gutenberg':
      return `https://www.gutenberg.org/ebooks/${sourceId}`;
    case 'standardebooks':
      return `https://standardebooks.org/ebooks/${slug || sourceId}`;
    case 'bible':
    case 'bibletranslations':
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(sourceId)}`;
    case 'perseus':
      return `https://www.perseus.tufts.edu/hopper/text?doc=${sourceId}`;
    case 'ccel':
      return `https://www.ccel.org/${sourceId}`;
    case 'sacredtexts':
      return `https://www.sacred-texts.com/${sourceId}`;
    default:
      return undefined;
  }
}

async function loadJsonFile<T>(filePath: string): Promise<T[]> {
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) {
    log(`  File not found: ${filePath}`);
    return [];
  }
  try {
    const content = await readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log(`  Error loading ${filePath}: ${error}`);
    return [];
  }
}

async function* streamJsonArray(filePath: string): AsyncGenerator<any> {
  const fullPath = join(process.cwd(), filePath);
  if (!existsSync(fullPath)) {
    log(`  File not found: ${filePath}`);
    return;
  }

  const readStream = createReadStream(fullPath);
  const jsonParser = parser();
  const arrayStream = streamArray();

  readStream.pipe(jsonParser).pipe(arrayStream);

  for await (const { value } of arrayStream as AsyncIterable<{ value: any }>) {
    yield value;
  }
}

// Get or create a unified author from a name
function getOrCreateAuthor(name: string, source: string): string {
  const normalized = normalizeAuthorName(name);
  const slug = createSlug(normalized);

  // Check if author already exists
  if (authorsBySlug.has(slug)) {
    const author = authorsBySlug.get(slug)!;
    if (!author.sources.includes(source)) {
      author.sources.push(source);
    }
    if (!author.name_variants.includes(name) && name !== author.name) {
      author.name_variants.push(name);
    }
    return author.id;
  }

  // Create new author
  const unifiedId = `author-${slug}`;
  const author: UnifiedAuthor = {
    id: unifiedId,
    name: normalized,
    slug: slug,
    name_variants: name !== normalized ? [name] : [],
    sources: [source],
    source_ids: {},
    work_count: 0,
    chunk_count: 0,
    created_at: new Date().toISOString(),
  };

  authorsBySlug.set(slug, author);
  authorNameToId.set(normalized.toLowerCase(), unifiedId);
  authorNameToId.set(name.toLowerCase(), unifiedId);

  return unifiedId;
}

// Phase 1: Load and combine authors
async function combineAuthors(): Promise<UnifiedAuthor[]> {
  log('Phase 1: Combining authors...');

  for (const { path, source } of AUTHOR_FILES) {
    log(`  Loading ${path}...`);
    const authors = await loadJsonFile<any>(path);

    if (!stats.by_source[source]) {
      stats.by_source[source] = { authors: 0, works: 0, chunks: 0 };
    }

    for (const author of authors) {
      const normalized = normalizeAuthorName(author.name);
      const slug = createSlug(normalized);
      const mapKey = `${source}_${author.id}`;

      if (authorsBySlug.has(slug)) {
        // Merge
        const existing = authorsBySlug.get(slug)!;
        if (!existing.name_variants.includes(author.name) && author.name !== existing.name) {
          existing.name_variants.push(author.name);
        }
        if (!existing.sources.includes(source)) {
          existing.sources.push(source);
        }
        existing.source_ids[source] = author.id;
        if (!existing.birth_year && author.birth_year) existing.birth_year = author.birth_year;
        if (!existing.death_year && author.death_year) existing.death_year = author.death_year;
        if (!existing.nationality && author.nationality) existing.nationality = author.nationality;
        if (!existing.era && author.era) existing.era = author.era;

        authorIdMap.set(mapKey, existing.id);
      } else {
        // Create new
        const unifiedId = `author-${slug}`;
        const unifiedAuthor: UnifiedAuthor = {
          id: unifiedId,
          name: normalized,
          slug: slug,
          name_variants: author.name !== normalized ? [author.name] : [],
          birth_year: author.birth_year,
          death_year: author.death_year,
          nationality: author.nationality,
          era: author.era,
          sources: [source],
          source_ids: { [source]: author.id },
          work_count: 0,
          chunk_count: 0,
          created_at: new Date().toISOString(),
        };

        authorsBySlug.set(slug, unifiedAuthor);
        authorIdMap.set(mapKey, unifiedId);
        authorNameToId.set(normalized.toLowerCase(), unifiedId);
        authorNameToId.set(author.name.toLowerCase(), unifiedId);
        stats.by_source[source].authors++;
      }
    }
  }

  const authors = Array.from(authorsBySlug.values());
  stats.total_authors = authors.length;
  log(`  Total unique authors: ${authors.length}`);

  const authorsPath = join(COMBINED_DIR, 'authors.json');
  await writeFile(authorsPath, JSON.stringify(authors, null, 2));
  log(`  Written to ${authorsPath}`);

  return authors;
}

// Phase 2: Combine works
async function combineWorks(): Promise<UnifiedWork[]> {
  log('Phase 2: Combining works...');

  const allWorks: UnifiedWork[] = [];
  const worksBySourceId: Map<string, UnifiedWork> = new Map();

  for (const { path, source, phase, format } of WORK_FILES) {
    log(`  Loading ${path}...`);
    const works = await loadJsonFile<any>(path);

    if (!stats.by_source[source]) {
      stats.by_source[source] = { authors: 0, works: 0, chunks: 0 };
    }

    for (const work of works) {
      let unifiedAuthorId: string | undefined;

      if (format === 'inline') {
        // Phase5b format: authors is array of names
        const authorNames: string[] = work.authors || [];
        if (authorNames.length > 0) {
          const primaryAuthor = authorNames[0];
          unifiedAuthorId = getOrCreateAuthor(primaryAuthor, source);
        }
      } else {
        // Standard format: author_id reference
        const authorMapKey = `${source}_${work.author_id}`;
        unifiedAuthorId = authorIdMap.get(authorMapKey);
      }

      if (!unifiedAuthorId) {
        continue; // Skip works without authors
      }

      const workId = work.id || work.source_id;
      const sourceId = work.source_id || work.id;
      const slug = work.slug || createSlug(work.title);
      const unifiedId = `work-${slug}-${source}-${sourceId}`;

      const unifiedWork: UnifiedWork = {
        id: unifiedId,
        title: work.title,
        slug: slug,
        author_id: unifiedAuthorId,
        year: work.publication_year,
        language: work.original_language || 'en',
        original_language: work.original_language,
        translator: work.translator,
        type: work.form || 'prose',
        genre: work.genre,
        tradition: work.tradition,
        source: source,
        source_id: sourceId,
        ingestion_phase: phase || undefined,
        chunk_count: work.chunk_count || 0,
        full_text_url: generateFullTextUrl(source, sourceId, slug),
        created_at: new Date().toISOString(),
      };

      allWorks.push(unifiedWork);

      // Map by work.id (for standard format)
      if (work.id) {
        workIdMap.set(`${source}_${work.id}`, unifiedId);
      }
      // Map by source_id (for inline format chunks)
      workSourceIdMap.set(`${source}_${sourceId}`, unifiedId);

      // Store work->author mapping
      workToAuthor.set(unifiedId, unifiedAuthorId);

      stats.by_source[source].works++;
    }
  }

  stats.total_works = allWorks.length;
  log(`  Total works: ${allWorks.length}`);

  const worksPath = join(COMBINED_DIR, 'works.json');
  await writeFile(worksPath, JSON.stringify(allWorks, null, 2));
  log(`  Written to ${worksPath}`);

  return allWorks;
}

// Phase 3: Stream combine chunks
async function streamCombineChunks(): Promise<void> {
  log('Phase 3: Streaming chunks...');

  const chunksPath = join(COMBINED_DIR, 'chunks.json');
  const writeStream = createWriteStream(chunksPath);

  writeStream.write('[\n');

  let isFirst = true;
  let totalChunks = 0;
  const errorFiles: string[] = [];

  for (const { path, source, phase, format } of CHUNK_FILES) {
    const fullPath = join(process.cwd(), path);
    if (!existsSync(fullPath)) {
      log(`  Skipping missing: ${path}`);
      errorFiles.push(path);
      continue;
    }

    const fileSize = statSync(fullPath).size;
    log(`  Processing ${path} (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);

    if (!stats.by_source[source]) {
      stats.by_source[source] = { authors: 0, works: 0, chunks: 0 };
    }

    let fileChunks = 0;

    try {
      for await (const chunk of streamJsonArray(path)) {
        // Get text content
        const text = chunk.content || chunk.text || '';
        if (!text || text.length < 10) continue;

        let unifiedAuthorId: string | undefined;
        let unifiedWorkId: string | undefined;

        if (format === 'inline') {
          // Phase5b format: inline authors and source_id
          const authorNames: string[] = chunk.authors || [];
          const sourceId = chunk.source_id;

          if (authorNames.length > 0) {
            const primaryAuthor = authorNames[0];
            // Look up author by name
            const normalized = normalizeAuthorName(primaryAuthor);
            const slug = createSlug(normalized);
            const author = authorsBySlug.get(slug);
            unifiedAuthorId = author?.id;

            if (!unifiedAuthorId) {
              // Create the author on the fly
              unifiedAuthorId = getOrCreateAuthor(primaryAuthor, source);
            }
          }

          // Look up work by source_id
          if (sourceId) {
            unifiedWorkId = workSourceIdMap.get(`${source}_${sourceId}`);
          }
        } else {
          // Standard format: work_id and author_id references
          if (chunk.work_id) {
            const workMapKey = `${source}_${chunk.work_id}`;
            unifiedWorkId = workIdMap.get(workMapKey);
          }

          if (chunk.author_id) {
            const authorMapKey = `${source}_${chunk.author_id}`;
            unifiedAuthorId = authorIdMap.get(authorMapKey);
          }

          // If no author_id, look up from work
          if (!unifiedAuthorId && unifiedWorkId) {
            unifiedAuthorId = workToAuthor.get(unifiedWorkId);
          }
        }

        // Skip if still no author
        if (!unifiedAuthorId) {
          continue;
        }

        const positionIndex = chunk.sequence ?? chunk.chunk_index ?? chunk.index ?? chunk.position ?? 0;
        const chunkType = chunk.chunk_type || 'passage';

        const unifiedChunk: UnifiedChunk = {
          id: uuidv4(),
          text: text,
          author_id: unifiedAuthorId,
          work_id: unifiedWorkId,
          type: chunkType,
          position_index: positionIndex,
          source: source,
          source_chunk_id: chunk.id || `${source}-${fileChunks}`,
          char_count: text.length,
          word_count: text.split(/\s+/).filter(Boolean).length,
          created_at: new Date().toISOString(),
        };

        // Add position metadata
        if (chunk.source_metadata) {
          const meta = chunk.source_metadata;
          if (meta.chapter) unifiedChunk.position_chapter = String(meta.chapter);
          if (meta.section) unifiedChunk.position_section = String(meta.section);
          if (meta.book) unifiedChunk.position_book = String(meta.book);
          if (meta.verse) unifiedChunk.position_verse = String(meta.verse);
          if (meta.paragraph) unifiedChunk.position_paragraph = Number(meta.paragraph);

          if (source === 'bible' || source === 'bibletranslations') {
            if (meta.translation) unifiedChunk.bible_translation = meta.translation;
            if (meta.book) unifiedChunk.bible_book = meta.book;
            if (meta.chapter) unifiedChunk.bible_chapter = Number(meta.chapter);
            if (meta.verse) unifiedChunk.bible_verse = Number(meta.verse);
          }
        }

        // Write chunk
        if (!isFirst) {
          writeStream.write(',\n');
        }
        writeStream.write(JSON.stringify(unifiedChunk));
        isFirst = false;

        fileChunks++;
        totalChunks++;

        // Track counts
        if (unifiedWorkId) {
          workChunkCounts.set(unifiedWorkId, (workChunkCounts.get(unifiedWorkId) || 0) + 1);
        }
        authorChunkCounts.set(unifiedAuthorId, (authorChunkCounts.get(unifiedAuthorId) || 0) + 1);
        stats.by_type[chunkType] = (stats.by_type[chunkType] || 0) + 1;

        if (totalChunks % 100000 === 0) {
          const elapsed = (Date.now() - startTime.getTime()) / 1000 / 60;
          log(`    Processed ${totalChunks.toLocaleString()} chunks (${elapsed.toFixed(1)} min elapsed)...`);
        }
      }

      stats.by_source[source].chunks += fileChunks;
      log(`    Completed ${path}: ${fileChunks.toLocaleString()} chunks`);

    } catch (error) {
      log(`    Error processing ${path}: ${error}`);
      errorFiles.push(path);
    }
  }

  writeStream.write('\n]');
  writeStream.end();

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  stats.total_chunks = totalChunks;
  log(`  Total chunks written: ${totalChunks.toLocaleString()}`);

  if (errorFiles.length > 0) {
    log(`  Files with errors: ${errorFiles.join(', ')}`);
  }
}

// Update counts
async function updateCounts(authors: UnifiedAuthor[], works: UnifiedWork[]): Promise<void> {
  log('Updating counts...');

  for (const work of works) {
    work.chunk_count = workChunkCounts.get(work.id) || work.chunk_count || 0;
  }

  for (const author of authors) {
    author.chunk_count = authorChunkCounts.get(author.id) || 0;
    author.work_count = works.filter(w => w.author_id === author.id).length;
  }

  await writeFile(join(COMBINED_DIR, 'authors.json'), JSON.stringify(authors, null, 2));
  await writeFile(join(COMBINED_DIR, 'works.json'), JSON.stringify(works, null, 2));
  log('  Updated authors.json and works.json with counts');
}

// Generate stats
async function generateStats(): Promise<void> {
  log('Generating stats...');

  const authorsSize = statSync(join(COMBINED_DIR, 'authors.json')).size / 1024 / 1024;
  const worksSize = statSync(join(COMBINED_DIR, 'works.json')).size / 1024 / 1024;
  const chunksSize = statSync(join(COMBINED_DIR, 'chunks.json')).size / 1024 / 1024;

  stats.files = {
    authors_json_mb: Math.round(authorsSize * 10) / 10,
    works_json_mb: Math.round(worksSize * 10) / 10,
    chunks_json_mb: Math.round(chunksSize * 10) / 10,
  };

  const authorCounts = Array.from(authorChunkCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  stats.top_authors = authorCounts.map(([id, count]) => {
    const author = authorsBySlug.get(id.replace('author-', ''));
    return {
      name: author?.name || id,
      chunk_count: count,
    };
  });

  stats.generated_at = new Date().toISOString();

  await writeFile(join(COMBINED_DIR, 'stats.json'), JSON.stringify(stats, null, 2));
  log(`  Written stats.json`);
}

// Generate done file
async function generateDoneFile(): Promise<void> {
  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000 / 60;

  const content = `Combine complete
Finished: ${endTime.toISOString()}
Duration: ${duration.toFixed(1)} minutes

Authors: ${stats.total_authors.toLocaleString()}
Works: ${stats.total_works.toLocaleString()}
Chunks: ${stats.total_chunks.toLocaleString()}

By Source:
${Object.entries(stats.by_source)
  .sort((a, b) => b[1].chunks - a[1].chunks)
  .map(([source, counts]) => `- ${source}: ${counts.chunks.toLocaleString()} chunks, ${counts.works.toLocaleString()} works, ${counts.authors.toLocaleString()} authors`)
  .join('\n')}

By Type:
${Object.entries(stats.by_type)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `- ${type}: ${count.toLocaleString()}`)
  .join('\n')}

Files:
- authors.json: ${stats.files.authors_json_mb} MB
- works.json: ${stats.files.works_json_mb} MB
- chunks.json: ${(stats.files.chunks_json_mb / 1024).toFixed(2)} GB
- stats.json: ~10 KB

Top 10 Authors by Chunk Count:
${stats.top_authors.slice(0, 10).map((a, i) => `${i + 1}. ${a.name}: ${a.chunk_count.toLocaleString()}`).join('\n')}
`;

  await writeFile(join(COMBINED_DIR, 'DONE.txt'), content);
  log(`Written DONE.txt`);
}

// Main
async function main(): Promise<void> {
  log('===========================================');
  log('Doomscrolls Data Combiner - Streaming v2');
  log('===========================================\n');

  await mkdir(COMBINED_DIR, { recursive: true });

  const authors = await combineAuthors();
  log('');

  const works = await combineWorks();
  log('');

  await streamCombineChunks();
  log('');

  await updateCounts(authors, works);
  log('');

  await generateStats();
  log('');

  await generateDoneFile();

  log('\n===========================================');
  log('COMBINATION COMPLETE!');
  log(`Total Authors: ${stats.total_authors.toLocaleString()}`);
  log(`Total Works: ${stats.total_works.toLocaleString()}`);
  log(`Total Chunks: ${stats.total_chunks.toLocaleString()}`);
  log('===========================================');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
