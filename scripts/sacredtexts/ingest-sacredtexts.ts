// Sacred Texts Ingestion Script
// Fetches and parses wisdom literature from sacred-texts.com and Project Gutenberg

import type { Author, Work, Chunk } from '../../src/types';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import { fetchText } from '../../src/utils/fetch';
import { TEXTS_TO_INGEST, type TextSource } from './texts-config';
import { parseTaoTeChing } from './parsers/tao-te-ching';
import { parseBhagavadGita } from './parsers/bhagavad-gita';
import { parseDhammapada } from './parsers/dhammapada';
import { parseAnalects } from './parsers/analects';
import { parseMeditations } from './parsers/meditations';
import { parseEnchiridion } from './parsers/enchiridion';
import { parseArtOfWar } from './parsers/art-of-war';
import { parseProphet } from './parsers/prophet';
import { parseUpanishads } from './parsers/upanishads';
import { parseGeneric, parseGenericGutenberg } from './parsers/generic';
import type { ParsedChunk } from './parsers/index';

const DATA_DIR = './data/sacredtexts';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;
const PROGRESS_MD = `${DATA_DIR}/progress.md`;

// Rate limit for sacred-texts.com (be respectful)
const SACRED_TEXTS_RATE_LIMIT = 1500; // 1.5 seconds between requests
const GUTENBERG_RATE_LIMIT = 500;

interface IngestStats {
  texts: number;
  passages: number;
  authors: number;
  works: number;
}

// Get parser function based on text config
function getParser(textConfig: TextSource): (content: string, tradition: string, chapterNum?: number) => ParsedChunk[] {
  const isGutenberg = textConfig.source === 'gutenberg';

  switch (textConfig.parser) {
    case 'tao-te-ching':
      return parseTaoTeChing;
    case 'bhagavad-gita':
      return parseBhagavadGita;
    case 'dhammapada':
      return parseDhammapada;
    case 'analects':
      return parseAnalects;
    case 'meditations':
      return parseMeditations;
    case 'enchiridion':
      return parseEnchiridion;
    case 'art-of-war':
      return parseArtOfWar;
    case 'prophet':
      return parseProphet;
    case 'upanishads':
      return parseUpanishads;
    case 'generic':
    default:
      return isGutenberg ? parseGenericGutenberg : parseGeneric;
  }
}

function createAuthor(textConfig: TextSource): Author {
  return {
    id: generateId(),
    name: textConfig.author,
    slug: createSlug(textConfig.author),
    birth_year: null,
    death_year: null,
    nationality: null,
    era: textConfig.era || null,
    bio: textConfig.authorBio || `Author of ${textConfig.title}. ${textConfig.tradition} tradition.`,
    wikipedia_url: null,
    created_at: getTimestamp()
  };
}

function createWork(textConfig: TextSource, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: textConfig.title,
    slug: createSlug(textConfig.title),
    original_language: textConfig.originalLanguage,
    publication_year: null,
    genre: 'Philosophy',
    form: 'scripture',
    source: 'sacredtexts',
    source_id: textConfig.id,
    created_at: getTimestamp()
  };
}

function createChunk(
  parsed: ParsedChunk,
  workId: string,
  authorId: string,
  globalIndex: number
): Chunk {
  return {
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: parsed.content,
    chunk_index: globalIndex,
    chunk_type: parsed.chunkType,
    source: 'sacredtexts',
    source_metadata: parsed.metadata,
    created_at: getTimestamp()
  };
}

async function updateProgressMd(
  completedTexts: string[],
  inProgressText: string | null,
  stats: IngestStats
): Promise<void> {
  const startTime = '2026-01-05';
  const now = new Date().toISOString();

  let content = `# Sacred Texts Ingestion Progress

**Started:** ${startTime}
**Last Updated:** ${now}

## Progress
- Texts: ${completedTexts.length} / ${TEXTS_TO_INGEST.length} (${Math.round(completedTexts.length / TEXTS_TO_INGEST.length * 100)}%)
- Passages extracted: ${stats.passages.toLocaleString()}

## Completed
`;

  for (const textId of completedTexts) {
    const text = TEXTS_TO_INGEST.find(t => t.id === textId);
    if (text) {
      content += `- [x] ${text.title} (${text.author})\n`;
    }
  }

  if (inProgressText) {
    const text = TEXTS_TO_INGEST.find(t => t.id === inProgressText);
    if (text) {
      content += `\n## In Progress\n- [ ] ${text.title} (${text.author})\n`;
    }
  }

  const pendingTexts = TEXTS_TO_INGEST.filter(
    t => !completedTexts.includes(t.id) && t.id !== inProgressText
  );

  if (pendingTexts.length > 0) {
    content += `\n## Pending\n`;
    for (const text of pendingTexts) {
      content += `- [ ] ${text.title} (${text.author})\n`;
    }
  }

  await writeJson(PROGRESS_MD.replace('.md', '.json'), { markdown: content });
  await Bun.write(PROGRESS_MD, content);
}

async function fetchWithRateLimit(url: string, source: 'sacred-texts' | 'gutenberg' | 'other'): Promise<string> {
  const rateLimit = source === 'gutenberg' ? GUTENBERG_RATE_LIMIT : SACRED_TEXTS_RATE_LIMIT;

  const content = await fetchText(url, {
    retries: 3,
    baseDelay: 2000,
    rateLimit,
    timeout: 60000
  });

  return content;
}

async function ingestText(
  textConfig: TextSource,
  authors: Author[],
  works: Work[],
  chunks: Chunk[],
  stats: IngestStats
): Promise<void> {
  console.log(`[SacredTexts] Ingesting: ${textConfig.title} by ${textConfig.author}`);

  // Find or create author
  let author = authors.find(a => a.name === textConfig.author);
  if (!author) {
    author = createAuthor(textConfig);
    authors.push(author);
    stats.authors++;
    console.log(`[SacredTexts] Created author: ${author.name}`);
  }

  // Create work
  let work = works.find(w => w.source_id === textConfig.id);
  if (!work) {
    work = createWork(textConfig, author.id);
    works.push(work);
    stats.works++;
  }

  // Get parser
  const parser = getParser(textConfig);

  // Fetch and parse each URL
  let chunkIndex = 0;
  let totalParsed = 0;

  for (let i = 0; i < textConfig.urls.length; i++) {
    const url = textConfig.urls[i];
    console.log(`[SacredTexts] Fetching: ${url}`);

    try {
      const content = await fetchWithRateLimit(url, textConfig.source);

      // Parse content (pass chapter number for multi-page texts)
      const chapterNum = textConfig.urls.length > 1 ? i + 1 : undefined;
      const parsed = parser(content, textConfig.tradition, chapterNum);

      console.log(`[SacredTexts] Parsed ${parsed.length} chunks from page ${i + 1}`);

      // Create chunks
      for (const p of parsed) {
        const chunk = createChunk(p, work.id, author.id, chunkIndex);
        chunks.push(chunk);
        chunkIndex++;
        stats.passages++;
        totalParsed++;
      }

      // Save periodically
      if ((i + 1) % 5 === 0) {
        await writeJson(`${DATA_DIR}/chunks.json`, chunks);
      }

    } catch (error) {
      console.error(`[SacredTexts] Error fetching ${url}:`, error);
      // Continue with other URLs
    }
  }

  console.log(`[SacredTexts] Completed ${textConfig.title}: ${totalParsed} passages`);
}

export async function ingestSacredTexts(): Promise<IngestStats> {
  console.log('[SacredTexts] Starting ingestion...');
  console.log(`[SacredTexts] Total texts to process: ${TEXTS_TO_INGEST.length}`);

  const stats: IngestStats = { texts: 0, passages: 0, authors: 0, works: 0 };

  // Load existing data and progress
  let authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  let works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  let chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  // Update stats from existing data
  stats.authors = authors.length;
  stats.works = works.length;
  stats.passages = chunks.length;

  console.log(`[SacredTexts] Existing data: ${authors.length} authors, ${works.length} works, ${chunks.length} chunks`);

  // Process each text
  for (const textConfig of TEXTS_TO_INGEST) {
    // Skip if already completed
    if (progress.completed.includes(textConfig.id)) {
      console.log(`[SacredTexts] Skipping ${textConfig.title} (already completed)`);
      continue;
    }

    try {
      // Update progress to show in-progress
      await updateProgressMd(progress.completed, textConfig.id, stats);

      // Ingest this text
      await ingestText(textConfig, authors, works, chunks, stats);

      stats.texts++;

      // Save progress
      progress.completed.push(textConfig.id);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);
      await updateProgressMd(progress.completed, null, stats);

    } catch (error) {
      console.error(`[SacredTexts] Error processing ${textConfig.title}:`, error);
      // Continue with next text
    }
  }

  console.log('[SacredTexts] Ingestion complete!');
  console.log(`[SacredTexts] Final stats: ${stats.texts} texts, ${stats.passages} passages`);

  // Create DONE.txt
  const doneContent = `Sacred Texts ingestion complete
Finished: ${new Date().toISOString()}
Texts: ${stats.texts}
Passages: ${stats.passages}
Authors: ${stats.authors}
Works: ${stats.works}
`;
  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestSacredTexts().catch(console.error);
}
