// Bible API Ingestion Script
// Fetches KJV Bible from https://bible-api.com/

import type { Author, Work, Chunk, BibleAPIResponse } from '../src/types';
import { generateId, getTimestamp } from '../src/utils/ids';
import { createSlug } from '../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../src/utils/files';
import { fetchJson } from '../src/utils/fetch';

const BASE_URL = 'https://bible-api.com';
const DATA_DIR = './data/bible';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;

// All 66 books with chapter counts (to avoid probing for chapters)
const BIBLE_BOOKS: Array<{ name: string; chapters: number }> = [
  // Old Testament
  { name: 'Genesis', chapters: 50 },
  { name: 'Exodus', chapters: 40 },
  { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 },
  { name: 'Deuteronomy', chapters: 34 },
  { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 },
  { name: 'Ruth', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Kings', chapters: 22 },
  { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 },
  { name: '2 Chronicles', chapters: 36 },
  { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 },
  { name: 'Esther', chapters: 10 },
  { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 },
  { name: 'Proverbs', chapters: 31 },
  { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 },
  { name: 'Isaiah', chapters: 66 },
  { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 },
  { name: 'Ezekiel', chapters: 48 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 },
  { name: 'Joel', chapters: 3 },
  { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 },
  { name: 'Jonah', chapters: 4 },
  { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 },
  { name: 'Habakkuk', chapters: 3 },
  { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 },
  { name: 'Zechariah', chapters: 14 },
  { name: 'Malachi', chapters: 4 },
  // New Testament
  { name: 'Matthew', chapters: 28 },
  { name: 'Mark', chapters: 16 },
  { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 },
  { name: 'Acts', chapters: 28 },
  { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 },
  { name: '2 Corinthians', chapters: 13 },
  { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 },
  { name: 'Philippians', chapters: 4 },
  { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 },
  { name: '2 Thessalonians', chapters: 3 },
  { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 },
  { name: 'Titus', chapters: 3 },
  { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 },
  { name: 'James', chapters: 5 },
  { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 },
  { name: '1 John', chapters: 5 },
  { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 },
  { name: 'Jude', chapters: 1 },
  { name: 'Revelation', chapters: 22 }
];

interface IngestStats {
  books: number;
  chapters: number;
  verses: number;
}

async function fetchChapter(book: string, chapter: number): Promise<BibleAPIResponse | null> {
  try {
    // Use a colon format which the API also supports well
    const url = `${BASE_URL}/${encodeURIComponent(book)}+${chapter}?translation=kjv`;
    const response = await fetchJson<BibleAPIResponse>(url, {
      retries: 5,
      baseDelay: 3000,
      rateLimit: 500, // Be more respectful to the API
      timeout: 45000
    });

    // Check if we got valid verses
    if (!response.verses || response.verses.length === 0) {
      return null;
    }

    return response;
  } catch (error) {
    // Log but don't throw for 404s (end of chapters)
    if (error instanceof Error && error.message.includes('Not found')) {
      return null;
    }
    console.error(`[Bible] Failed to fetch ${book} ${chapter}: ${error}`);
    return null;
  }
}

function createBiblicalAuthor(): Author {
  return {
    id: generateId(),
    name: 'Various (Biblical)',
    slug: 'various-biblical',
    birth_year: null,
    death_year: null,
    nationality: null,
    era: 'Ancient',
    bio: 'The collected authors of the Bible, including prophets, apostles, and other inspired writers.',
    wikipedia_url: 'https://en.wikipedia.org/wiki/Authorship_of_the_Bible',
    created_at: getTimestamp()
  };
}

function createWork(book: string, authorId: string): Work {
  const isNewTestament = BIBLE_BOOKS.findIndex(b => b.name === book) >= 39;
  return {
    id: generateId(),
    author_id: authorId,
    title: book,
    slug: createSlug(book),
    original_language: isNewTestament ? 'grc' : 'he',
    publication_year: null,
    genre: 'Religious',
    form: 'scripture',
    source: 'bible',
    source_id: book,
    created_at: getTimestamp()
  };
}

function createChunk(
  verse: { book_name: string; chapter: number; verse: number; text: string },
  workId: string,
  authorId: string,
  globalIndex: number
): Chunk {
  return {
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: verse.text.trim(),
    chunk_index: globalIndex,
    chunk_type: 'verse',
    source: 'bible',
    source_metadata: {
      book: verse.book_name,
      chapter: verse.chapter,
      verse: verse.verse,
      reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`
    },
    created_at: getTimestamp()
  };
}

export async function ingestBible(): Promise<IngestStats> {
  console.log('[Bible] Starting ingestion...');

  const stats: IngestStats = { books: 0, chapters: 0, verses: 0 };

  // Load existing data and progress
  let authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  let works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  let chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  // Create or find biblical author
  let author = authors.find(a => a.name === 'Various (Biblical)');
  if (!author) {
    author = createBiblicalAuthor();
    authors.push(author);
    await writeJson(`${DATA_DIR}/authors.json`, authors);
  }

  // Process each book
  for (const bookInfo of BIBLE_BOOKS) {
    const book = bookInfo.name;

    // Skip if already completed
    if (progress.completed.includes(book)) {
      console.log(`[Bible] Skipping ${book} (already completed)`);
      continue;
    }

    // Find or create work for this book
    let work = works.find(w => w.title === book);
    if (!work) {
      work = createWork(book, author.id);
      works.push(work);
      stats.books++;
    }

    // Fetch all chapters
    let bookVerseIndex = 0;
    let successfulChapters = 0;

    for (let chapter = 1; chapter <= bookInfo.chapters; chapter++) {
      try {
        const chapterData = await fetchChapter(book, chapter);

        if (!chapterData || !chapterData.verses) {
          console.log(`[Bible] No data for ${book} ${chapter}, skipping...`);
          continue;
        }

        // Process verses in this chapter
        for (const verse of chapterData.verses) {
          const chunk = createChunk(verse, work.id, author.id, bookVerseIndex);
          chunks.push(chunk);
          bookVerseIndex++;
          stats.verses++;
        }

        successfulChapters++;
        stats.chapters++;

        // Save periodically (every 5 chapters)
        if (chapter % 5 === 0) {
          await writeJson(`${DATA_DIR}/chunks.json`, chunks);
        }

      } catch (error) {
        console.error(`[Bible] Error on ${book} ${chapter}:`, error);
        // Continue with next chapter
      }
    }

    console.log(`[Bible] Ingested ${book}: ${successfulChapters} chapters, ${bookVerseIndex} verses`);

    // Save progress after each book
    progress.completed.push(book);
    await saveProgress(PROGRESS_FILE, progress.completed);
    await writeJson(`${DATA_DIR}/works.json`, works);
    await writeJson(`${DATA_DIR}/chunks.json`, chunks);
  }

  console.log(`[Bible] Ingestion complete: ${stats.books} books, ${stats.chapters} chapters, ${stats.verses} verses`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestBible().catch(console.error);
}
