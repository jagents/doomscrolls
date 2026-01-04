// Wikiquote Ingestion Script
// Scrapes quotes from https://en.wikiquote.org/

import * as cheerio from 'cheerio';
import type { Author, Work, Chunk } from '../src/types';
import { generateId, getTimestamp } from '../src/utils/ids';
import { createSlug } from '../src/utils/slugs';
import { readJson, writeJson, readProgress, saveProgress } from '../src/utils/files';
import { fetchText } from '../src/utils/fetch';

const BASE_URL = 'https://en.wikiquote.org/wiki';
const DATA_DIR = './data/wikiquote';
const PROGRESS_FILE = `${DATA_DIR}/.progress.json`;

// Priority author list with era hints
const PRIORITY_AUTHORS: Array<{ name: string; era: string }> = [
  // Ancient Philosophy
  { name: 'Marcus Aurelius', era: 'Ancient' },
  { name: 'Seneca the Younger', era: 'Ancient' },
  { name: 'Epictetus', era: 'Ancient' },
  { name: 'Plato', era: 'Ancient' },
  { name: 'Aristotle', era: 'Ancient' },
  { name: 'Socrates', era: 'Ancient' },
  { name: 'Heraclitus', era: 'Ancient' },
  { name: 'Epicurus', era: 'Ancient' },
  { name: 'Cicero', era: 'Ancient' },
  { name: 'Plutarch', era: 'Ancient' },

  // Eastern Philosophy
  { name: 'Confucius', era: 'Ancient' },
  { name: 'Lao Tzu', era: 'Ancient' },
  { name: 'Sun Tzu', era: 'Ancient' },
  { name: 'Gautama Buddha', era: 'Ancient' },

  // Enlightenment & Modern Philosophy
  { name: 'Voltaire', era: 'Enlightenment' },
  { name: 'Michel de Montaigne', era: 'Renaissance' },
  { name: 'Blaise Pascal', era: 'Enlightenment' },
  { name: 'René Descartes', era: 'Enlightenment' },
  { name: 'Immanuel Kant', era: 'Enlightenment' },
  { name: 'Friedrich Nietzsche', era: 'Modern' },
  { name: 'Arthur Schopenhauer', era: 'Romantic' },
  { name: 'Søren Kierkegaard', era: 'Romantic' },
  { name: 'Albert Camus', era: 'Modern' },
  { name: 'Jean-Paul Sartre', era: 'Modern' },

  // American Transcendentalists & Writers
  { name: 'Ralph Waldo Emerson', era: 'Romantic' },
  { name: 'Henry David Thoreau', era: 'Romantic' },
  { name: 'Walt Whitman', era: 'Romantic' },
  { name: 'Mark Twain', era: 'Victorian' },
  { name: 'Benjamin Franklin', era: 'Enlightenment' },
  { name: 'Ernest Hemingway', era: 'Modern' },
  { name: 'F. Scott Fitzgerald', era: 'Modern' },

  // British Writers
  { name: 'William Shakespeare', era: 'Renaissance' },
  { name: 'Oscar Wilde', era: 'Victorian' },
  { name: 'George Bernard Shaw', era: 'Victorian' },
  { name: 'Jane Austen', era: 'Romantic' },
  { name: 'Charles Dickens', era: 'Victorian' },
  { name: 'Virginia Woolf', era: 'Modern' },
  { name: 'George Orwell', era: 'Modern' },
  { name: 'Aldous Huxley', era: 'Modern' },
  { name: 'Samuel Johnson', era: 'Enlightenment' },
  { name: 'Jonathan Swift', era: 'Enlightenment' },
  { name: 'Alexander Pope', era: 'Enlightenment' },

  // Russian Writers
  { name: 'Leo Tolstoy', era: 'Victorian' },
  { name: 'Fyodor Dostoevsky', era: 'Victorian' },
  { name: 'Anton Chekhov', era: 'Victorian' },

  // European Writers
  { name: 'Franz Kafka', era: 'Modern' },
  { name: 'Johann Wolfgang von Goethe', era: 'Romantic' },
  { name: 'Victor Hugo', era: 'Romantic' },

  // Poets
  { name: 'Emily Dickinson', era: 'Victorian' },
  { name: 'Robert Frost', era: 'Modern' },
  { name: 'William Blake', era: 'Romantic' },
  { name: 'John Keats', era: 'Romantic' },
  { name: 'Percy Bysshe Shelley', era: 'Romantic' },
  { name: 'Lord Byron', era: 'Romantic' },
  { name: 'William Wordsworth', era: 'Romantic' },

  // Scientists & Thinkers
  { name: 'Albert Einstein', era: 'Modern' },
  { name: 'Isaac Newton', era: 'Enlightenment' },
  { name: 'Carl Sagan', era: 'Contemporary' },
  { name: 'Charles Darwin', era: 'Victorian' },

  // Historical Figures
  { name: 'Winston Churchill', era: 'Modern' },
  { name: 'Abraham Lincoln', era: 'Victorian' },
  { name: 'Theodore Roosevelt', era: 'Modern' },
  { name: 'Mahatma Gandhi', era: 'Modern' },
  { name: 'Martin Luther King Jr.', era: 'Contemporary' },
  { name: 'Nelson Mandela', era: 'Contemporary' },

  // Wit & Aphorists
  { name: 'Dorothy Parker', era: 'Modern' },
  { name: 'Ambrose Bierce', era: 'Victorian' },
  { name: 'H. L. Mencken', era: 'Modern' },
  { name: 'G. K. Chesterton', era: 'Modern' }
];

interface IngestStats {
  authors: number;
  works: number;
  quotes: number;
}

function authorToUrl(name: string): string {
  return `${BASE_URL}/${name.replace(/ /g, '_')}`;
}

function isValidQuote(text: string): boolean {
  // Filter by length
  if (text.length < 20 || text.length > 1000) {
    return false;
  }

  // Skip if looks like metadata or header
  const lowerText = text.toLowerCase();
  if (
    text.includes('==') ||
    text.startsWith('[') ||
    lowerText.startsWith('see also') ||
    lowerText.startsWith('external links') ||
    lowerText.startsWith('references') ||
    lowerText.includes('wikiquote') ||
    lowerText.includes('wikipedia')
  ) {
    return false;
  }

  return true;
}

function extractQuotes($: cheerio.CheerioAPI): string[] {
  const quotes: string[] = [];
  const seen = new Set<string>();

  // Find the main content area
  const content = $('.mw-parser-output');

  // Skip certain sections
  const skipSections = [
    'quotes about',
    'misattributed',
    'disputed',
    'wrongly attributed',
    'see also',
    'external links',
    'references'
  ];

  let inSkipSection = false;

  content.children().each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase();

    // Check for section headers
    if (tagName === 'h2' || tagName === 'h3') {
      const headerText = $el.text().toLowerCase();
      inSkipSection = skipSections.some(skip => headerText.includes(skip));
      return;
    }

    // Skip if we're in a section to skip
    if (inSkipSection) {
      return;
    }

    // Skip table of contents and navigation
    if ($el.attr('id') === 'toc' || $el.hasClass('toc') || $el.hasClass('navbox')) {
      return;
    }

    // Process unordered lists (main quote format)
    if (tagName === 'ul') {
      $el.children('li').each((_, li) => {
        const $li = $(li);

        // Get the direct text content, not nested lists (which are usually attributions)
        let quoteText = '';

        $li.contents().each((_, node) => {
          if (node.type === 'text') {
            quoteText += $(node).text();
          } else if (node.type === 'tag' && node.tagName !== 'ul' && node.tagName !== 'dl') {
            // Include inline elements but not nested lists
            quoteText += $(node).text();
          }
        });

        quoteText = quoteText
          .replace(/\s+/g, ' ')
          .replace(/^\s*[-–—•]\s*/, '')
          .trim();

        if (isValidQuote(quoteText) && !seen.has(quoteText)) {
          quotes.push(quoteText);
          seen.add(quoteText);
        }
      });
    }

    // Also check for definition lists (used on some pages)
    if (tagName === 'dl') {
      $el.children('dd').each((_, dd) => {
        let quoteText = $(dd).clone().children('dl').remove().end().text()
          .replace(/\s+/g, ' ')
          .trim();

        if (isValidQuote(quoteText) && !seen.has(quoteText)) {
          quotes.push(quoteText);
          seen.add(quoteText);
        }
      });
    }
  });

  return quotes;
}

async function fetchAndParseQuotes(authorName: string): Promise<string[]> {
  const url = authorToUrl(authorName);

  try {
    const html = await fetchText(url, { rateLimit: 500 });
    const $ = cheerio.load(html);
    return extractQuotes($);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not found')) {
      // Try alternative URL formats
      const altUrls = [
        `${BASE_URL}/${authorName.replace(/ /g, '_')}_(author)`,
        `${BASE_URL}/${authorName.replace(/ /g, '_')}_(writer)`
      ];

      for (const altUrl of altUrls) {
        try {
          const html = await fetchText(altUrl, { rateLimit: 500 });
          const $ = cheerio.load(html);
          return extractQuotes($);
        } catch {
          continue;
        }
      }
    }
    throw error;
  }
}

function createAuthor(name: string, era: string): Author {
  return {
    id: generateId(),
    name,
    slug: createSlug(name),
    birth_year: null,
    death_year: null,
    nationality: null,
    era,
    bio: null,
    wikipedia_url: `https://en.wikipedia.org/wiki/${name.replace(/ /g, '_')}`,
    created_at: getTimestamp()
  };
}

function createWork(authorName: string, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: `${authorName} - Collected Quotes`,
    slug: createSlug(`${authorName}-collected-quotes`),
    original_language: 'en',
    publication_year: null,
    genre: 'Philosophy',
    form: 'aphorism',
    source: 'wikiquote',
    source_id: null,
    created_at: getTimestamp()
  };
}

function createChunk(
  quote: string,
  workId: string,
  authorId: string,
  index: number,
  authorName: string
): Chunk {
  return {
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: quote,
    chunk_index: index,
    chunk_type: 'quote',
    source: 'wikiquote',
    source_metadata: {
      wikiquote_url: authorToUrl(authorName)
    },
    created_at: getTimestamp()
  };
}

export async function ingestWikiquote(): Promise<IngestStats> {
  console.log('[Wikiquote] Starting ingestion...');

  const stats: IngestStats = { authors: 0, works: 0, quotes: 0 };

  // Load existing data and progress
  const authors = await readJson<Author[]>(`${DATA_DIR}/authors.json`) ?? [];
  const works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  const chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];
  const progress = await readProgress(PROGRESS_FILE);

  for (const { name: authorName, era } of PRIORITY_AUTHORS) {
    // Skip if already completed
    if (progress.completed.includes(authorName)) {
      console.log(`[Wikiquote] Skipping ${authorName} (already completed)`);
      continue;
    }

    try {
      const quotes = await fetchAndParseQuotes(authorName);

      if (quotes.length === 0) {
        console.log(`[Wikiquote] No quotes found for ${authorName}`);
        progress.completed.push(authorName);
        await saveProgress(PROGRESS_FILE, progress.completed);
        continue;
      }

      // Find or create author
      let author = authors.find(a => a.name === authorName);
      if (!author) {
        author = createAuthor(authorName, era);
        authors.push(author);
        stats.authors++;
      }

      // Find or create work
      let work = works.find(w => w.author_id === author!.id);
      if (!work) {
        work = createWork(authorName, author.id);
        works.push(work);
        stats.works++;
      }

      // Create chunks for each quote
      for (let i = 0; i < quotes.length; i++) {
        const chunk = createChunk(quotes[i], work.id, author.id, i, authorName);
        chunks.push(chunk);
        stats.quotes++;
      }

      console.log(`[Wikiquote] Ingested ${quotes.length} quotes from ${authorName}`);

      // Save progress after each author
      progress.completed.push(authorName);
      await saveProgress(PROGRESS_FILE, progress.completed);
      await writeJson(`${DATA_DIR}/authors.json`, authors);
      await writeJson(`${DATA_DIR}/works.json`, works);
      await writeJson(`${DATA_DIR}/chunks.json`, chunks);

    } catch (error) {
      console.error(`[Wikiquote] Error processing ${authorName}:`, error);
      // Continue with next author
    }
  }

  console.log(`[Wikiquote] Ingestion complete: ${stats.authors} authors, ${stats.quotes} quotes`);

  return stats;
}

// Allow running directly
if (import.meta.main) {
  ingestWikiquote().catch(console.error);
}
