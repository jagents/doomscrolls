// CCEL (Christian Classics Ethereal Library) Ingestion Script
// Fetches and parses Christian theological texts from Gutenberg and CCEL

import type { Author, Work, Chunk } from '../../src/types';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import { fetchText } from '../../src/utils/fetch';
import { CCEL_TEXTS, type CCELTextSource } from './texts-config';

const DATA_DIR = './data/ccel';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;
const PROGRESS_MD = `${DATA_DIR}/progress.md`;

// Rate limits
const GUTENBERG_RATE_LIMIT = 500; // 500ms between requests
const CCEL_RATE_LIMIT = 1000; // 1s between requests

// Chunking settings
const TARGET_CHUNK_SIZE = 450; // Target 300-600 chars, aim for middle
const MIN_CHUNK_SIZE = 200;
const MAX_CHUNK_SIZE = 700;
const OVERLAP_SIZE = 50;

interface IngestStats {
  texts: number;
  passages: number;
  authors: number;
  works: number;
}

interface ParsedChunk {
  content: string;
  chunkType: string;
  metadata: Record<string, unknown>;
}

// Clean up Gutenberg text by removing header/footer
function stripGutenbergWrapper(text: string): string {
  // Find start marker
  const startPatterns = [
    /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i,
    /\*\*\*\s*START OF THE PROJECT GUTENBERG/i,
    /START OF THIS PROJECT GUTENBERG/i,
    /\*\*\* START \*\*\*/i,
  ];

  let content = text;
  for (const pattern of startPatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.substring(match.index + match[0].length);
      break;
    }
  }

  // Find end marker
  const endPatterns = [
    /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i,
    /\*\*\*\s*END OF THE PROJECT GUTENBERG/i,
    /END OF THIS PROJECT GUTENBERG/i,
    /End of (?:the )?Project Gutenberg/i,
  ];

  for (const pattern of endPatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      content = content.substring(0, match.index);
      break;
    }
  }

  return content.trim();
}

// Clean text content
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ') // Non-breaking space
    .replace(/\u2018|\u2019/g, "'") // Smart quotes
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2014/g, '--') // Em dash
    .replace(/\u2013/g, '-') // En dash
    .replace(/\s+/g, ' ')
    .trim();
}

// Split text into sentences
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while keeping the delimiter
  const sentencePattern = /(?<=[.!?])\s+(?=[A-Z])/g;
  return text.split(sentencePattern).filter(s => s.trim().length > 0);
}

// Smart chunking with overlap
function chunkText(text: string): string[] {
  const chunks: string[] = [];

  // First, split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  let currentChunk = '';
  let overlap = '';

  for (const para of paragraphs) {
    const cleanedPara = cleanText(para);

    // Skip very short paragraphs that are likely headers/noise
    if (cleanedPara.length < 20) continue;

    // Skip likely metadata
    if (cleanedPara.match(/^(chapter|book|part|section|contents|index|preface|introduction|footnote|\d+\.|page \d+)/i)) {
      continue;
    }

    // If paragraph itself is in target range, use it directly
    if (cleanedPara.length >= MIN_CHUNK_SIZE && cleanedPara.length <= MAX_CHUNK_SIZE) {
      if (overlap && chunks.length > 0) {
        chunks.push(overlap + ' ' + cleanedPara);
      } else {
        chunks.push(cleanedPara);
      }
      // Set overlap for next chunk
      const words = cleanedPara.split(' ');
      overlap = words.slice(-Math.ceil(OVERLAP_SIZE / 5)).join(' ');
      currentChunk = '';
      continue;
    }

    // If paragraph is too long, split by sentences
    if (cleanedPara.length > MAX_CHUNK_SIZE) {
      const sentences = splitIntoSentences(cleanedPara);

      for (const sentence of sentences) {
        const testChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;

        if (testChunk.length > MAX_CHUNK_SIZE && currentChunk.length >= MIN_CHUNK_SIZE) {
          // Save current chunk
          if (overlap && chunks.length > 0) {
            chunks.push(overlap + ' ' + currentChunk);
          } else {
            chunks.push(currentChunk);
          }
          // Set overlap for next chunk
          const words = currentChunk.split(' ');
          overlap = words.slice(-Math.ceil(OVERLAP_SIZE / 5)).join(' ');
          currentChunk = sentence;
        } else {
          currentChunk = testChunk;
        }
      }

      // Flush if currentChunk is big enough
      if (currentChunk.length >= MIN_CHUNK_SIZE) {
        if (overlap && chunks.length > 0) {
          chunks.push(overlap + ' ' + currentChunk);
        } else {
          chunks.push(currentChunk);
        }
        const words = currentChunk.split(' ');
        overlap = words.slice(-Math.ceil(OVERLAP_SIZE / 5)).join(' ');
        currentChunk = '';
      }
    } else {
      // Paragraph is too short, accumulate
      const testChunk = currentChunk ? currentChunk + ' ' + cleanedPara : cleanedPara;

      if (testChunk.length >= MIN_CHUNK_SIZE && testChunk.length <= MAX_CHUNK_SIZE) {
        if (overlap && chunks.length > 0) {
          chunks.push(overlap + ' ' + testChunk);
        } else {
          chunks.push(testChunk);
        }
        const words = testChunk.split(' ');
        overlap = words.slice(-Math.ceil(OVERLAP_SIZE / 5)).join(' ');
        currentChunk = '';
      } else if (testChunk.length > MAX_CHUNK_SIZE) {
        // Current is good enough
        if (currentChunk.length >= MIN_CHUNK_SIZE) {
          if (overlap && chunks.length > 0) {
            chunks.push(overlap + ' ' + currentChunk);
          } else {
            chunks.push(currentChunk);
          }
          const words = currentChunk.split(' ');
          overlap = words.slice(-Math.ceil(OVERLAP_SIZE / 5)).join(' ');
        }
        currentChunk = cleanedPara;
      } else {
        currentChunk = testChunk;
      }
    }
  }

  // Flush remaining
  if (currentChunk.length >= MIN_CHUNK_SIZE) {
    if (overlap && chunks.length > 0) {
      chunks.push(overlap + ' ' + currentChunk);
    } else {
      chunks.push(currentChunk);
    }
  }

  return chunks;
}

// Parse Gutenberg plain text
function parseGutenbergText(text: string, textConfig: CCELTextSource): ParsedChunk[] {
  const stripped = stripGutenbergWrapper(text);
  const rawChunks = chunkText(stripped);

  return rawChunks.map((content, idx) => ({
    content,
    chunkType: 'passage',
    metadata: {
      section: idx + 1,
      tradition: textConfig.tradition,
      era: textConfig.era
    }
  }));
}

// Parse CCEL plain text
function parseCCELText(text: string, textConfig: CCELTextSource): ParsedChunk[] {
  // CCEL .txt files are usually clean, just chunk directly
  const rawChunks = chunkText(text);

  return rawChunks.map((content, idx) => ({
    content,
    chunkType: 'passage',
    metadata: {
      section: idx + 1,
      tradition: textConfig.tradition,
      era: textConfig.era
    }
  }));
}

// Create author from text config
function createAuthor(textConfig: CCELTextSource): Author {
  return {
    id: generateId(),
    name: textConfig.author,
    slug: createSlug(textConfig.author),
    birth_year: null,
    death_year: null,
    nationality: null,
    era: textConfig.era,
    bio: textConfig.authorBio || `${textConfig.tradition} author of ${textConfig.title}. Era: ${textConfig.era}.`,
    wikipedia_url: null,
    created_at: getTimestamp()
  };
}

// Create work from text config
function createWork(textConfig: CCELTextSource, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: textConfig.title,
    slug: createSlug(textConfig.title),
    original_language: textConfig.originalLanguage,
    publication_year: null,
    genre: textConfig.genre,
    form: textConfig.form,
    source: 'ccel',
    source_id: textConfig.id,
    created_at: getTimestamp()
  };
}

// Create chunk from parsed data
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
    source: 'ccel',
    source_metadata: parsed.metadata,
    created_at: getTimestamp()
  };
}

// Update progress markdown
async function updateProgressMd(
  completedTexts: string[],
  inProgressText: string | null,
  stats: IngestStats,
  completionDetails: Map<string, number>
): Promise<void> {
  const startTime = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const totalTexts = CCEL_TEXTS.length;

  let content = `# CCEL Ingestion Progress

**Started:** ${startTime}
**Last Updated:** ${now}

## Progress
- Texts: ${completedTexts.length} / ${totalTexts} (${Math.round(completedTexts.length / totalTexts * 100)}%)
- Passages: ${stats.passages.toLocaleString()}
- Authors: ${stats.authors}
- Works: ${stats.works}

## Completed
`;

  for (const textId of completedTexts) {
    const text = CCEL_TEXTS.find(t => t.id === textId);
    if (text) {
      const passageCount = completionDetails.get(textId) || 0;
      content += `- [x] ${text.author} - ${text.title} - ${passageCount.toLocaleString()} passages\n`;
    }
  }

  if (inProgressText) {
    const text = CCEL_TEXTS.find(t => t.id === inProgressText);
    if (text) {
      content += `\n## In Progress\n- [ ] ${text.author} - ${text.title}...\n`;
    }
  }

  const pendingTexts = CCEL_TEXTS.filter(
    t => !completedTexts.includes(t.id) && t.id !== inProgressText
  );

  if (pendingTexts.length > 0) {
    content += `\n## Pending (${pendingTexts.length} texts)\n`;
    // Group by tier
    const tier1 = pendingTexts.filter(t => t.tier === 1);
    const tier2 = pendingTexts.filter(t => t.tier === 2);
    const tier3 = pendingTexts.filter(t => t.tier === 3);

    if (tier1.length > 0) {
      content += `\n### Tier 1 (Must Have)\n`;
      for (const text of tier1) {
        content += `- [ ] ${text.author} - ${text.title}\n`;
      }
    }
    if (tier2.length > 0) {
      content += `\n### Tier 2 (Important)\n`;
      for (const text of tier2) {
        content += `- [ ] ${text.author} - ${text.title}\n`;
      }
    }
    if (tier3.length > 0) {
      content += `\n### Tier 3 (If Time Permits)\n`;
      for (const text of tier3) {
        content += `- [ ] ${text.author} - ${text.title}\n`;
      }
    }
  }

  await Bun.write(PROGRESS_MD, content);
}

// Fetch with appropriate rate limiting
async function fetchWithRateLimit(url: string, source: 'gutenberg' | 'ccel'): Promise<string> {
  const rateLimit = source === 'gutenberg' ? GUTENBERG_RATE_LIMIT : CCEL_RATE_LIMIT;

  const content = await fetchText(url, {
    retries: 5,
    baseDelay: 2000,
    rateLimit,
    timeout: 120000 // 2 minute timeout for large texts
  });

  return content;
}

// Ingest a single text
async function ingestText(
  textConfig: CCELTextSource,
  authors: Author[],
  works: Work[],
  chunks: Chunk[],
  stats: IngestStats
): Promise<number> {
  console.log(`[CCEL] Ingesting: ${textConfig.title} by ${textConfig.author}`);

  // Find or create author
  let author = authors.find(a => a.name === textConfig.author);
  if (!author) {
    author = createAuthor(textConfig);
    authors.push(author);
    stats.authors++;
    console.log(`[CCEL] Created author: ${author.name}`);
  }

  // Check if work already exists
  let work = works.find(w => w.source_id === textConfig.id);
  if (!work) {
    work = createWork(textConfig, author.id);
    works.push(work);
    stats.works++;
  }

  let chunkIndex = 0;
  let totalParsed = 0;

  // Fetch and parse each URL
  for (let i = 0; i < textConfig.urls.length; i++) {
    const url = textConfig.urls[i];
    console.log(`[CCEL] Fetching: ${url}`);

    try {
      const content = await fetchWithRateLimit(url, textConfig.source);
      console.log(`[CCEL] Fetched ${content.length.toLocaleString()} bytes`);

      // Parse based on source
      const parsed = textConfig.source === 'gutenberg'
        ? parseGutenbergText(content, textConfig)
        : parseCCELText(content, textConfig);

      console.log(`[CCEL] Parsed ${parsed.length.toLocaleString()} chunks`);

      // Create chunks
      for (const p of parsed) {
        // Skip chunks that are too short or likely noise
        if (p.content.length < MIN_CHUNK_SIZE) continue;
        if (p.content.match(/^(table of contents|index|copyright|gutenberg|project|ebook|www\.|http)/i)) continue;

        const chunk = createChunk(p, work.id, author.id, chunkIndex);
        chunks.push(chunk);
        chunkIndex++;
        stats.passages++;
        totalParsed++;
      }

    } catch (error) {
      console.error(`[CCEL] Error fetching ${url}:`, error);
      // Continue with other URLs if there are multiple
    }
  }

  console.log(`[CCEL] Completed ${textConfig.title}: ${totalParsed.toLocaleString()} passages`);
  return totalParsed;
}

// Main ingestion function
export async function ingestCCEL(): Promise<IngestStats> {
  console.log('[CCEL] Starting ingestion...');
  console.log(`[CCEL] Total texts to process: ${CCEL_TEXTS.length}`);

  const stats: IngestStats = { texts: 0, passages: 0, authors: 0, works: 0 };
  const completionDetails = new Map<string, number>();

  // Load existing data and progress
  let authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  let works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  let chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  // Update stats from existing data
  stats.authors = authors.length;
  stats.works = works.length;
  stats.passages = chunks.length;

  // Rebuild completion details from existing data
  for (const textId of progress.completed) {
    const text = CCEL_TEXTS.find(t => t.id === textId);
    if (text) {
      const work = works.find(w => w.source_id === textId);
      if (work) {
        const chunkCount = chunks.filter(c => c.work_id === work.id).length;
        completionDetails.set(textId, chunkCount);
      }
    }
  }

  console.log(`[CCEL] Existing data: ${authors.length} authors, ${works.length} works, ${chunks.length} chunks`);
  console.log(`[CCEL] Already completed: ${progress.completed.length} texts`);

  // Process each text (sorted by tier)
  const sortedTexts = [...CCEL_TEXTS].sort((a, b) => a.tier - b.tier);

  for (const textConfig of sortedTexts) {
    // Skip if already completed
    if (progress.completed.includes(textConfig.id)) {
      console.log(`[CCEL] Skipping ${textConfig.title} (already completed)`);
      continue;
    }

    try {
      // Update progress to show in-progress
      await updateProgressMd(progress.completed, textConfig.id, stats, completionDetails);

      // Ingest this text
      const passageCount = await ingestText(textConfig, authors, works, chunks, stats);

      stats.texts++;
      completionDetails.set(textConfig.id, passageCount);

      // Save progress after each text
      progress.completed.push(textConfig.id);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);
      await updateProgressMd(progress.completed, null, stats, completionDetails);

      console.log(`[CCEL] Progress saved. Total passages: ${stats.passages.toLocaleString()}`);

    } catch (error) {
      console.error(`[CCEL] Error processing ${textConfig.title}:`, error);
      // Continue with next text
    }
  }

  console.log('[CCEL] Ingestion complete!');
  console.log(`[CCEL] Final stats: ${stats.texts} new texts, ${stats.passages} total passages`);

  // Create DONE.txt
  const doneContent = `CCEL ingestion complete
Finished: ${new Date().toISOString()}
Texts: ${progress.completed.length}
Authors: ${stats.authors}
Passages: ${stats.passages}
Works: ${stats.works}
`;
  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestCCEL().catch(console.error);
}
