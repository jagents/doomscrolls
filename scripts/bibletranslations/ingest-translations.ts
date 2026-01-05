// Bible Translations Ingestion Script
// Fetches multiple Bible translations from https://bible-api.com/

import type { Author, Work, Chunk, BibleAPIResponse } from '../../src/types';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../../src/utils/files';
import { fetchJson } from '../../src/utils/fetch';
import { TRANSLATIONS, BIBLE_BOOKS, TOTAL_BOOKS, type TranslationConfig, type BookConfig } from './translations-config';

const BASE_URL = 'https://bible-api.com';
const DATA_DIR = './data/bibletranslations';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;
const PROGRESS_MD = `${DATA_DIR}/progress.md`;

interface TranslationProgress {
  completed: string[]; // Format: "translation:book" e.g., "web:Genesis"
  last_updated: string;
}

interface IngestStats {
  translations: number;
  books: number;
  chapters: number;
  verses: number;
}

const startTime = new Date();

async function fetchChapter(book: string, chapter: number, translation: string): Promise<BibleAPIResponse | null> {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(book)}+${chapter}?translation=${translation}`;
    const response = await fetchJson<BibleAPIResponse>(url, {
      retries: 5,
      baseDelay: 3000,
      rateLimit: 600, // 600ms between requests to be respectful
      timeout: 60000
    });

    if (!response.verses || response.verses.length === 0) {
      return null;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not found')) {
      return null;
    }
    console.error(`[${translation.toUpperCase()}] Failed to fetch ${book} ${chapter}: ${error}`);
    return null;
  }
}

function createAuthorForTranslation(translation: TranslationConfig): Author {
  return {
    id: generateId(),
    name: `Various - Biblical (${translation.abbrev})`,
    slug: `various-biblical-${translation.abbrev.toLowerCase()}`,
    birth_year: null,
    death_year: null,
    nationality: null,
    era: 'Ancient',
    bio: `The collected authors of the Bible as presented in the ${translation.name} (${translation.year}). ${translation.style} style translation.`,
    wikipedia_url: 'https://en.wikipedia.org/wiki/Authorship_of_the_Bible',
    created_at: getTimestamp()
  };
}

function createWorkForBook(book: BookConfig, translation: TranslationConfig, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: `${book.name} (${translation.abbrev})`,
    slug: createSlug(`${book.name}-${translation.abbrev.toLowerCase()}`),
    original_language: book.testament === 'OT' ? 'he' : 'grc',
    publication_year: translation.year,
    genre: 'Religious',
    form: 'scripture',
    source: 'bible-api',
    source_id: `${createSlug(book.name)}-${translation.abbrev.toLowerCase()}`,
    created_at: getTimestamp()
  };
}

function createChunkForVerse(
  verse: { book_name: string; chapter: number; verse: number; text: string },
  workId: string,
  authorId: string,
  globalIndex: number,
  translation: string
): Chunk {
  return {
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: verse.text.trim(),
    chunk_index: globalIndex,
    chunk_type: 'verse',
    source: 'bible-api',
    source_metadata: {
      translation: translation,
      book: verse.book_name,
      chapter: verse.chapter,
      verse: verse.verse,
      reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`
    },
    created_at: getTimestamp()
  };
}

function makeProgressKey(translation: string, book: string): string {
  return `${translation}:${book}`;
}

async function updateProgressMarkdown(
  stats: IngestStats,
  translationStats: Map<string, { books: number; verses: number }>,
  currentTranslation: string | null,
  currentBook: string | null,
  currentChapter: number | null
): Promise<void> {
  const now = new Date();
  const elapsed = Math.round((now.getTime() - startTime.getTime()) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  let md = `# Bible Translations Ingestion Progress

**Started:** ${startTime.toISOString()}
**Last Updated:** ${now.toISOString()}
**Elapsed:** ${hours}h ${minutes}m ${seconds}s

## Overall Progress
- Translations: ${translationStats.size} / ${TRANSLATIONS.length} (${Math.round(translationStats.size / TRANSLATIONS.length * 100)}%)
- Total Books Completed: ${stats.books} / ${TRANSLATIONS.length * TOTAL_BOOKS}
- Total Verses: ${stats.verses.toLocaleString()}

## By Translation
`;

  for (const t of TRANSLATIONS) {
    const tStats = translationStats.get(t.apiParam);
    if (!tStats) {
      md += `- ⏳ ${t.abbrev} (${t.name}): not started\n`;
    } else if (tStats.books >= TOTAL_BOOKS) {
      md += `- ✅ ${t.abbrev} (${t.name}): ${tStats.books}/${TOTAL_BOOKS} books, ${tStats.verses.toLocaleString()} verses\n`;
    } else {
      md += `- 🔄 ${t.abbrev} (${t.name}): ${tStats.books}/${TOTAL_BOOKS} books, ${tStats.verses.toLocaleString()} verses\n`;
    }
  }

  if (currentTranslation && currentBook) {
    md += `
## Current
- Translation: ${currentTranslation.toUpperCase()}
- Book: ${currentBook}${currentChapter ? ` (chapter ${currentChapter})` : ''}
`;
  }

  await Bun.write(PROGRESS_MD, md);
}

export async function ingestTranslations(): Promise<IngestStats> {
  console.log('[BibleTranslations] Starting ingestion of multiple translations...');
  console.log(`[BibleTranslations] Target: ${TRANSLATIONS.length} translations x ${TOTAL_BOOKS} books = ${TRANSLATIONS.length * TOTAL_BOOKS} total books`);

  const stats: IngestStats = { translations: 0, books: 0, chapters: 0, verses: 0 };
  const translationStats = new Map<string, { books: number; verses: number }>();

  // Load existing data
  let authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  let works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  let chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progressData = await readProgress(PROGRESS_FILE) as TranslationProgress;
  const completed = new Set(progressData.completed);

  // Initialize translation stats from existing data
  for (const key of completed) {
    const [trans] = key.split(':');
    if (!translationStats.has(trans)) {
      translationStats.set(trans, { books: 0, verses: 0 });
    }
    translationStats.get(trans)!.books++;
  }

  // Count existing verses per translation
  for (const chunk of chunks) {
    const trans = (chunk.source_metadata as { translation?: string }).translation;
    if (trans && translationStats.has(trans)) {
      translationStats.get(trans)!.verses++;
    }
  }

  // Update stats from loaded data
  stats.books = completed.size;
  stats.verses = chunks.length;

  console.log(`[BibleTranslations] Resuming with ${completed.size} books already completed, ${chunks.length} verses`);

  // Process each translation
  for (const translation of TRANSLATIONS) {
    const trans = translation.apiParam;

    if (!translationStats.has(trans)) {
      translationStats.set(trans, { books: 0, verses: 0 });
    }

    // Check if this translation is fully complete
    const translationComplete = BIBLE_BOOKS.every(book =>
      completed.has(makeProgressKey(trans, book.name))
    );

    if (translationComplete) {
      console.log(`[${translation.abbrev}] Skipping (already complete)`);
      continue;
    }

    console.log(`\n[${translation.abbrev}] Starting ${translation.name}...`);
    stats.translations++;

    // Create or find author for this translation
    let author = authors.find(a => a.slug === `various-biblical-${trans}`);
    if (!author) {
      author = createAuthorForTranslation(translation);
      authors.push(author);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      console.log(`[${translation.abbrev}] Created author record`);
    }

    // Process each book
    for (const bookConfig of BIBLE_BOOKS) {
      const progressKey = makeProgressKey(trans, bookConfig.name);

      // Skip if already completed
      if (completed.has(progressKey)) {
        continue;
      }

      await updateProgressMarkdown(stats, translationStats, trans, bookConfig.name, null);

      // Find or create work for this book+translation
      const workSlug = createSlug(`${bookConfig.name}-${trans}`);
      let work = works.find(w => w.slug === workSlug);
      if (!work) {
        work = createWorkForBook(bookConfig, translation, author.id);
        works.push(work);
      }

      // Fetch all chapters for this book
      let bookVerseIndex = 0;
      let successfulChapters = 0;
      const bookChunks: Chunk[] = [];

      for (let chapter = 1; chapter <= bookConfig.chapters; chapter++) {
        try {
          await updateProgressMarkdown(stats, translationStats, trans, bookConfig.name, chapter);

          const chapterData = await fetchChapter(bookConfig.name, chapter, trans);

          if (!chapterData || !chapterData.verses) {
            console.log(`[${translation.abbrev}] No data for ${bookConfig.name} ${chapter}, skipping...`);
            continue;
          }

          // Process verses in this chapter
          for (const verse of chapterData.verses) {
            const chunk = createChunkForVerse(verse, work.id, author.id, bookVerseIndex, trans);
            bookChunks.push(chunk);
            bookVerseIndex++;
          }

          successfulChapters++;
          stats.chapters++;

        } catch (error) {
          console.error(`[${translation.abbrev}] Error on ${bookConfig.name} ${chapter}:`, error);
          // Continue with next chapter
        }
      }

      // Add all book chunks to main chunks array
      chunks.push(...bookChunks);
      stats.verses += bookChunks.length;
      stats.books++;

      // Update translation stats
      translationStats.get(trans)!.books++;
      translationStats.get(trans)!.verses += bookChunks.length;

      console.log(`[${translation.abbrev}] Ingested ${bookConfig.name}: ${successfulChapters}/${bookConfig.chapters} chapters, ${bookChunks.length} verses`);

      // Mark as completed and save progress
      completed.add(progressKey);
      await saveProgress(PROGRESS_FILE, Array.from(completed));
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);
      await updateProgressMarkdown(stats, translationStats, trans, bookConfig.name, null);
    }

    console.log(`[${translation.abbrev}] Completed: ${translationStats.get(trans)!.books} books, ${translationStats.get(trans)!.verses} verses`);
  }

  // Final progress update
  await updateProgressMarkdown(stats, translationStats, null, null, null);

  // Create completion file
  const doneContent = `Bible Translations ingestion complete
Finished: ${new Date().toISOString()}
Translations: ${TRANSLATIONS.length}
Books: ${stats.books}
Verses: ${stats.verses}
`;
  await Bun.write(`${DATA_DIR}/DONE.txt`, doneContent);

  console.log(`\n[BibleTranslations] Ingestion complete!`);
  console.log(`  Translations: ${stats.translations}`);
  console.log(`  Books: ${stats.books}`);
  console.log(`  Chapters: ${stats.chapters}`);
  console.log(`  Verses: ${stats.verses}`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestTranslations().catch(console.error);
}
