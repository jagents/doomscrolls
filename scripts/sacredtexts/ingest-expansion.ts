// Sacred Texts Expansion Ingestion Script
// Round 2: Adds new texts to existing data

import type { Author, Work, Chunk } from '../../src/types';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import { fetchText } from '../../src/utils/fetch';
import { EXPANSION_TEXTS, type ExpansionText } from './texts-config-expansion';
import { parseExpansionText } from './parsers/expansion-parser';
import type { ParsedChunk } from './parsers/index';

const DATA_DIR = './data/sacredtexts';
const PROGRESS_FILE = `${DATA_DIR}/.progress-expansion.json`;
const PROGRESS_MD = `${DATA_DIR}/progress.md`;

// Rate limit for sacred-texts.com
const RATE_LIMIT = 1200; // 1.2 seconds between requests

interface ExpansionStats {
  texts: number;
  passages: number;
  authors: number;
  works: number;
}

function createAuthor(textConfig: ExpansionText): Author {
  return {
    id: generateId(),
    name: textConfig.author,
    slug: createSlug(textConfig.author),
    birth_year: null,
    death_year: null,
    nationality: null,
    era: textConfig.era,
    bio: textConfig.authorBio,
    wikipedia_url: null,
    created_at: getTimestamp()
  };
}

function createWork(textConfig: ExpansionText, authorId: string): Work {
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateProgressMd(
  round1Chunks: number,
  completedTexts: string[],
  inProgressText: string | null,
  stats: ExpansionStats
): Promise<void> {
  const now = new Date().toISOString();

  let content = `# Sacred Texts Ingestion Progress

## Round 1 (Complete)
- Texts: 9
- Passages: ${round1Chunks.toLocaleString()}

## Round 2 (Expansion)
**Started:** 2026-01-05
**Last Updated:** ${now}

### New Texts Added
`;

  for (const textId of completedTexts) {
    const text = EXPANSION_TEXTS.find(t => t.id === textId);
    if (text) {
      content += `- [x] ${text.title} (${text.author})\n`;
    }
  }

  if (inProgressText) {
    const text = EXPANSION_TEXTS.find(t => t.id === inProgressText);
    if (text) {
      content += `\n### In Progress\n- [ ] ${text.title} (${text.author})\n`;
    }
  }

  const pendingTexts = EXPANSION_TEXTS.filter(
    t => !completedTexts.includes(t.id) && t.id !== inProgressText
  );

  if (pendingTexts.length > 0) {
    content += `\n### Pending\n`;
    for (const text of pendingTexts) {
      content += `- [ ] ${text.title} (${text.author})\n`;
    }
  }

  content += `
## Totals
- Round 1: ${round1Chunks.toLocaleString()} passages (9 texts)
- Round 2: ${stats.passages.toLocaleString()} passages (${stats.texts} texts)
- **Combined: ${(round1Chunks + stats.passages).toLocaleString()} passages**
`;

  await Bun.write(PROGRESS_MD, content);
}

async function ingestText(
  textConfig: ExpansionText,
  authors: Author[],
  works: Work[],
  chunks: Chunk[],
  stats: ExpansionStats
): Promise<void> {
  console.log(`[Expansion] Ingesting: ${textConfig.title} by ${textConfig.author}`);

  // Find or create author
  let author = authors.find(a => a.name === textConfig.author);
  if (!author) {
    author = createAuthor(textConfig);
    authors.push(author);
    stats.authors++;
    console.log(`[Expansion] Created author: ${author.name}`);
  }

  // Create work
  let work = works.find(w => w.source_id === textConfig.id);
  if (!work) {
    work = createWork(textConfig, author.id);
    works.push(work);
    stats.works++;
  }

  let chunkIndex = 0;
  let totalParsed = 0;

  for (let i = 0; i < textConfig.pages.length; i++) {
    const page = textConfig.pages[i];
    const url = textConfig.baseUrl + page;

    console.log(`[Expansion] Fetching: ${url} (${i + 1}/${textConfig.pages.length})`);

    try {
      const content = await fetchText(url, {
        retries: 3,
        baseDelay: 2000,
        rateLimit: RATE_LIMIT,
        timeout: 60000
      });

      // Parse content
      const chapterNum = i + 1;
      const parsed = parseExpansionText(content, textConfig.tradition, textConfig.parserType, chapterNum);

      console.log(`[Expansion] Parsed ${parsed.length} chunks from page ${i + 1}`);

      for (const p of parsed) {
        const chunk = createChunk(p, work.id, author.id, chunkIndex);
        chunks.push(chunk);
        chunkIndex++;
        stats.passages++;
        totalParsed++;
      }

      // Rate limiting
      await sleep(RATE_LIMIT);

    } catch (error) {
      console.error(`[Expansion] Error fetching ${url}:`, error);
    }
  }

  console.log(`[Expansion] Completed ${textConfig.title}: ${totalParsed} passages`);
}

export async function ingestExpansion(): Promise<ExpansionStats> {
  console.log('[Expansion] Starting Round 2 ingestion...');
  console.log(`[Expansion] Total texts to process: ${EXPANSION_TEXTS.length}`);

  const stats: ExpansionStats = { texts: 0, passages: 0, authors: 0, works: 0 };

  // Load existing data (APPEND mode)
  let authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  let works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  let chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  const round1Chunks = chunks.length;
  console.log(`[Expansion] Existing data: ${authors.length} authors, ${works.length} works, ${chunks.length} chunks`);

  // Process each text
  for (const textConfig of EXPANSION_TEXTS) {
    // Skip if already completed
    if (progress.completed.includes(textConfig.id)) {
      console.log(`[Expansion] Skipping ${textConfig.title} (already completed)`);
      continue;
    }

    // Skip if already exists in works
    if (works.find(w => w.source_id === textConfig.id)) {
      console.log(`[Expansion] Skipping ${textConfig.title} (already in works)`);
      progress.completed.push(textConfig.id);
      await saveProgress(PROGRESS_FILE, progress.completed);
      continue;
    }

    try {
      await updateProgressMd(round1Chunks, progress.completed, textConfig.id, stats);

      await ingestText(textConfig, authors, works, chunks, stats);

      stats.texts++;

      // Save progress after each text
      progress.completed.push(textConfig.id);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);
      await updateProgressMd(round1Chunks, progress.completed, null, stats);

      console.log(`[Expansion] Saved progress. Total chunks: ${chunks.length}`);

    } catch (error) {
      console.error(`[Expansion] Error processing ${textConfig.title}:`, error);
    }
  }

  console.log('[Expansion] Round 2 ingestion complete!');
  console.log(`[Expansion] Round 2 stats: ${stats.texts} texts, ${stats.passages} passages`);
  console.log(`[Expansion] Total chunks: ${chunks.length}`);

  // Update DONE.txt
  const doneContent = `Sacred Texts ingestion complete (Round 2)
Finished: ${new Date().toISOString()}
Total Texts: ${works.length}
Total Passages: ${chunks.length}
Round 1: 9 texts, ${round1Chunks} passages
Round 2: ${stats.texts} texts, ${stats.passages} passages
`;
  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestExpansion().catch(console.error);
}
