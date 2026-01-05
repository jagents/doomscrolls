#!/usr/bin/env bun
// Gutenberg Phase 5b Ingestion (5E-5I) with Streaming Writes

import { createWriteStream, type WriteStream } from "fs";
import { searchBooks, fetchBooksByTopic, getTextUrl, downloadText, type GutenbergBook, type GutendexResponse } from "./gutendex";
import { cleanGutenbergText, chunkText } from "./clean-text";

const DATA_DIR = "data/gutenberg";

// Rate limits
const API_DELAY = 300;
const DOWNLOAD_DELAY = 500;

// ============ SUB-PHASE CONFIGURATIONS ============

const GERMAN_AUTHORS = [
  "Goethe, Johann Wolfgang von",
  "Schiller, Friedrich",
  "Heine, Heinrich",
  "Hoffmann, E. T. A.",
  "Novalis",
  "Tieck, Ludwig",
  "Kleist, Heinrich von",
  "Fontane, Theodor",
  "Storm, Theodor",
  "Keller, Gottfried",
  "Meyer, Conrad Ferdinand",
  "Lessing, Gotthold Ephraim",
  "Grillparzer, Franz",
  "Hebbel, Friedrich",
  "Hauptmann, Gerhart",
  "Hesse, Hermann",
  "Mann, Thomas",
  "Rilke, Rainer Maria",
  "Grimm, Jacob",
  "Grimm, Wilhelm"
];

const SPANISH_AUTHORS = [
  "Cervantes Saavedra, Miguel de",
  "Calderón de la Barca, Pedro",
  "Vega, Lope de",
  "Quevedo, Francisco de",
  "Góngora, Luis de",
  "Pérez Galdós, Benito",
  "Blasco Ibáñez, Vicente",
  "Alas, Leopoldo",
  "Valera, Juan",
  "Pardo Bazán, Emilia",
  "Pereda, José María de",
  "Alarcón, Pedro Antonio de",
  "Unamuno, Miguel de",
  "Baroja, Pío",
  "Valle-Inclán, Ramón del",
  "Azorín",
  "Machado, Antonio",
  "Bécquer, Gustavo Adolfo",
  "Espronceda, José de",
  "Zorrilla, José",
  "Darío, Rubén",
  "Quiroga, Horacio",
  "Lugones, Leopoldo"
];

const SOCIAL_SCIENCE_AUTHORS = [
  // Sociology
  "Weber, Max",
  "Durkheim, Émile",
  "Veblen, Thorstein",
  "Spencer, Herbert",
  "Simmel, Georg",
  "Tarde, Gabriel",
  "Tönnies, Ferdinand",
  "Comte, Auguste",
  "Pareto, Vilfredo",
  "Sumner, William Graham",
  // Psychology
  "Freud, Sigmund",
  "Jung, C. G.",
  "James, William",
  "Wundt, Wilhelm",
  "Adler, Alfred",
  "Watson, John B.",
  "McDougall, William",
  "Hall, G. Stanley",
  "Binet, Alfred",
  "Janet, Pierre",
  "Ellis, Havelock",
  "Krafft-Ebing, Richard von",
  // IR / Geopolitics
  "Mahan, Alfred Thayer",
  "Mackinder, Halford John",
  "Angell, Norman",
  "Bryce, James",
  "Grotius, Hugo",
  "Vattel, Emer de",
  "Clausewitz, Carl von"
];

const SOCIAL_SCIENCE_BOOKSHELVES = [
  "Sociology",
  "Psychology",
  "Anthropology",
  "Education"
];

const LITERARY_THEORY_AUTHORS = [
  "Aristotle",
  "Longinus",
  "Horace",
  "Sidney, Philip",
  "Dryden, John",
  "Johnson, Samuel",
  "Coleridge, Samuel Taylor",
  "Wordsworth, William",
  "Shelley, Percy Bysshe",
  "Arnold, Matthew",
  "Ruskin, John",
  "Pater, Walter",
  "Wilde, Oscar",
  "Sainte-Beuve, Charles Augustin",
  "Taine, Hippolyte",
  "Brandes, Georg",
  "Emerson, Ralph Waldo",
  "Poe, Edgar Allan",
  "James, Henry",
  "Howells, William Dean",
  "Lowell, James Russell",
  "Eliot, T. S.",
  "Woolf, Virginia",
  "Lessing, Gotthold Ephraim",
  "Croce, Benedetto",
  "De Quincey, Thomas",
  "Hazlitt, William",
  "Lamb, Charles"
];

const LITERARY_THEORY_BOOKSHELVES = [
  "Literary Criticism",
  "Aesthetics"
];

const PHILOSOPHY_AUTHORS = [
  // Ancient
  "Plato",
  "Aristotle",
  "Epicurus",
  "Epictetus",
  "Marcus Aurelius",
  "Lucretius",
  "Diogenes Laertius",
  "Plutarch",
  "Seneca",
  "Cicero",
  // Medieval
  "Augustine",
  "Boethius",
  "Aquinas, Thomas",
  "Maimonides",
  // Early Modern
  "Machiavelli, Niccolò",
  "Bacon, Francis",
  "Montaigne, Michel de",
  "Hobbes, Thomas",
  "Descartes, René",
  "Pascal, Blaise",
  "Spinoza, Baruch",
  "Leibniz, Gottfried Wilhelm",
  "Locke, John",
  "Berkeley, George",
  "Hume, David",
  // Enlightenment
  "Voltaire",
  "Rousseau, Jean-Jacques",
  "Montesquieu",
  "Diderot, Denis",
  // German Idealism
  "Kant, Immanuel",
  "Fichte, Johann Gottlieb",
  "Schelling, Friedrich",
  "Hegel, Georg Wilhelm Friedrich",
  // 19th Century
  "Schopenhauer, Arthur",
  "Kierkegaard, Søren",
  "Nietzsche, Friedrich",
  "Mill, John Stuart",
  "Bentham, Jeremy",
  "Marx, Karl",
  "Engels, Friedrich",
  // American
  "Emerson, Ralph Waldo",
  "Thoreau, Henry David",
  "James, William",
  "Santayana, George",
  // Late 19th / Early 20th
  "Bergson, Henri",
  "Russell, Bertrand",
  "Moore, G. E."
];

const PHILOSOPHY_BOOKSHELVES = [
  "Philosophy",
  "Ethics",
  "Metaphysics",
  "Logic"
];

// ============ TYPES ============

interface WorkRecord {
  source_id: string;
  title: string;
  authors: string[];
  chunk_count: number;
}

interface AuthorRecord {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

interface ChunkRecord {
  source: string;
  source_id: string;
  title: string;
  authors: string[];
  chunk_index: number;
  text: string;
}

interface PhaseStats {
  books: number;
  passages: number;
  skipped: number;
}

interface Progress {
  currentPhase: string;
  currentItem: string;
  stats: Record<string, PhaseStats>;
  startTime: string;
}

// ============ STREAMING WRITERS ============

class StreamingJsonArrayWriter {
  private stream: WriteStream;
  private firstItem = true;
  private itemCount = 0;

  constructor(filePath: string) {
    this.stream = createWriteStream(filePath);
    this.stream.write('[\n');
  }

  write(item: object): void {
    if (!this.firstItem) {
      this.stream.write(',\n');
    }
    this.stream.write(JSON.stringify(item));
    this.firstItem = false;
    this.itemCount++;
  }

  async close(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.stream.write('\n]');
      this.stream.end();
      this.stream.on('finish', () => resolve(this.itemCount));
      this.stream.on('error', reject);
    });
  }

  getCount(): number {
    return this.itemCount;
  }
}

// ============ DEDUPLICATION ============

async function loadExistingIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  // Load from works.json (Phase 1-4)
  try {
    const works = await Bun.file(`${DATA_DIR}/works.json`).json() as WorkRecord[];
    for (const w of works) {
      ids.add(w.source_id);
    }
    console.log(`Loaded ${works.length} existing work IDs from works.json`);
  } catch (e) {
    console.log("No existing works.json found");
  }

  // Load from phase5-works.json (Phase 5A-5D) - need to check if it exists
  try {
    const worksFile = Bun.file(`${DATA_DIR}/works.json`);
    const allWorks = await worksFile.json() as WorkRecord[];
    // The works.json already contains phase 5 works merged in
    console.log(`Total existing IDs: ${ids.size}`);
  } catch (e) {
    // Already handled above
  }

  return ids;
}

// ============ PROGRESS TRACKING ============

async function updateProgress(progress: Progress): Promise<void> {
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - new Date(progress.startTime).getTime()) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;

  let totalBooks = 0;
  let totalPassages = 0;
  let totalSkipped = 0;

  const phases = ['5E', '5F', '5G', '5H', '5I'];
  const phaseNames: Record<string, string> = {
    '5E': 'German Literature',
    '5F': 'Spanish Literature',
    '5G': 'Social Sciences',
    '5H': 'Literary Theory',
    '5I': 'Philosophy'
  };

  let tableRows = '';
  for (const phase of phases) {
    const stats = progress.stats[phase] || { books: 0, passages: 0, skipped: 0 };
    totalBooks += stats.books;
    totalPassages += stats.passages;
    totalSkipped += stats.skipped;

    let status = '⏳ Pending';
    if (progress.currentPhase === phase) {
      status = '🔄 Running';
    } else if (phases.indexOf(phase) < phases.indexOf(progress.currentPhase)) {
      status = '✅ Complete';
    }

    tableRows += `| ${phase} - ${phaseNames[phase]} | ${status} | ${stats.books} | ${stats.passages.toLocaleString()} | ${stats.skipped} |\n`;
  }

  const md = `# Gutenberg Phase 5b Progress (5E-5I)

**Started:** ${new Date(progress.startTime).toLocaleString()}
**Last Updated:** ${now.toLocaleString()}
**Elapsed:** ${hours}h ${mins}m ${secs}s

## Status
| Phase | Status | Books | Passages | Skipped |
|-------|--------|-------|----------|---------|
${tableRows}
## Totals
- **Books:** ${totalBooks}
- **Passages:** ${totalPassages.toLocaleString()}
- **Skipped:** ${totalSkipped}

## Current
Processing: ${progress.currentPhase} - ${progress.currentItem}
`;

  await Bun.write(`${DATA_DIR}/progress-5b.md`, md);
}

// ============ BOOK PROCESSING ============

async function processBook(
  book: GutenbergBook,
  downloadedIds: Set<string>,
  chunkWriter: StreamingJsonArrayWriter,
  worksList: WorkRecord[],
  authorSet: Map<string, AuthorRecord>
): Promise<{ passages: number; skipped: boolean }> {
  const bookId = book.id.toString();

  // Skip if already downloaded
  if (downloadedIds.has(bookId)) {
    return { passages: 0, skipped: true };
  }

  // Get text URL
  const textUrl = getTextUrl(book);
  if (!textUrl) {
    console.log(`  ✗ No text URL for ${book.title}`);
    return { passages: 0, skipped: true };
  }

  // Download text
  const text = await downloadText(textUrl);
  if (!text) {
    console.log(`  ✗ Failed to download ${book.title}`);
    return { passages: 0, skipped: true };
  }

  // Clean and chunk
  const cleanedText = cleanGutenbergText(text);
  if (cleanedText.length < 1000) {
    console.log(`  ✗ Too short after cleaning: ${book.title}`);
    return { passages: 0, skipped: true };
  }

  const chunks = chunkText(cleanedText);
  if (chunks.length === 0) {
    console.log(`  ✗ No chunks from ${book.title}`);
    return { passages: 0, skipped: true };
  }

  // Get author names
  const authorNames = book.authors.map(a => a.name);

  // Write chunks to stream (ONE AT A TIME - no memory accumulation)
  for (const chunk of chunks) {
    const record: ChunkRecord = {
      source: "gutenberg",
      source_id: bookId,
      title: book.title,
      authors: authorNames,
      chunk_index: chunk.index,
      text: chunk.text
    };
    chunkWriter.write(record);
  }

  // Track work
  worksList.push({
    source_id: bookId,
    title: book.title,
    authors: authorNames,
    chunk_count: chunks.length
  });

  // Track authors
  for (const author of book.authors) {
    if (!authorSet.has(author.name)) {
      authorSet.set(author.name, {
        name: author.name,
        birth_year: author.birth_year,
        death_year: author.death_year
      });
    }
  }

  // Mark as downloaded
  downloadedIds.add(bookId);

  console.log(`  ✓ ${book.title} by ${authorNames.join(', ')} - ${chunks.length} passages`);
  return { passages: chunks.length, skipped: false };
}

// ============ AUTHOR SEARCH ============

async function searchAuthor(
  authorName: string,
  downloadedIds: Set<string>,
  chunkWriter: StreamingJsonArrayWriter,
  worksList: WorkRecord[],
  authorSet: Map<string, AuthorRecord>,
  stats: PhaseStats
): Promise<void> {
  console.log(`\nSearching: ${authorName}`);

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await sleep(API_DELAY);
      const response = await searchBooks(authorName, page);

      // Filter to books actually by this author
      const authorBooks = response.results.filter(book =>
        book.authors.some(a =>
          a.name.toLowerCase().includes(authorName.split(',')[0].toLowerCase()) ||
          authorName.toLowerCase().includes(a.name.split(',')[0].toLowerCase())
        )
      );

      for (const book of authorBooks) {
        const result = await processBook(book, downloadedIds, chunkWriter, worksList, authorSet);
        if (result.skipped) {
          stats.skipped++;
        } else {
          stats.books++;
          stats.passages += result.passages;
        }
      }

      hasMore = response.next !== null && page < 10; // Max 10 pages per author
      page++;
    }
  } catch (error) {
    console.error(`  Error searching ${authorName}: ${error}`);
  }
}

// ============ BOOKSHELF SEARCH ============

async function searchBookshelf(
  bookshelf: string,
  downloadedIds: Set<string>,
  chunkWriter: StreamingJsonArrayWriter,
  worksList: WorkRecord[],
  authorSet: Map<string, AuthorRecord>,
  stats: PhaseStats
): Promise<void> {
  console.log(`\nBookshelf: ${bookshelf}`);

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await sleep(API_DELAY);
      const response = await fetchBooksByTopic(bookshelf, page);

      for (const book of response.results) {
        const result = await processBook(book, downloadedIds, chunkWriter, worksList, authorSet);
        if (result.skipped) {
          stats.skipped++;
        } else {
          stats.books++;
          stats.passages += result.passages;
        }
      }

      hasMore = response.next !== null && page < 5; // Max 5 pages per bookshelf
      page++;
    }
  } catch (error) {
    console.error(`  Error fetching bookshelf ${bookshelf}: ${error}`);
  }
}

// ============ LANGUAGE SEARCH ============

async function searchByLanguage(
  language: string,
  downloadedIds: Set<string>,
  chunkWriter: StreamingJsonArrayWriter,
  worksList: WorkRecord[],
  authorSet: Map<string, AuthorRecord>,
  stats: PhaseStats,
  maxPages: number = 10
): Promise<void> {
  console.log(`\nLanguage search: ${language}`);

  try {
    let page = 1;
    let hasMore = true;
    let processed = 0;

    while (hasMore && page <= maxPages) {
      await sleep(API_DELAY);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(
          `https://gutendex.com/books/?languages=${language}&page=${page}`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
          console.log(`  API error: ${response.status}`);
          break;
        }

        const data = await response.json() as GutendexResponse;

        for (const book of data.results) {
          const result = await processBook(book, downloadedIds, chunkWriter, worksList, authorSet);
          if (result.skipped) {
            stats.skipped++;
          } else {
            stats.books++;
            stats.passages += result.passages;
            processed++;
          }
        }

        hasMore = data.next !== null;
        page++;

        console.log(`  Page ${page - 1}: ${processed} books processed so far`);
      } catch (e: any) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
          console.log(`  Timeout on page ${page}, continuing...`);
        } else {
          console.log(`  Error on page ${page}: ${e}`);
        }
        page++;
      }
    }
  } catch (error) {
    console.error(`  Error in language search: ${error}`);
  }
}

// ============ HELPER ============

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ MAIN ============

async function main() {
  console.log("=".repeat(60));
  console.log("GUTENBERG PHASE 5B INGESTION (5E-5I)");
  console.log("Using streaming writes to avoid memory issues");
  console.log("=".repeat(60));

  const startTime = new Date().toISOString();

  // Load existing IDs for deduplication
  const downloadedIds = await loadExistingIds();
  console.log(`Starting with ${downloadedIds.size} existing book IDs`);

  // Initialize streaming writers
  const chunkWriter = new StreamingJsonArrayWriter(`${DATA_DIR}/phase5b-chunks.json`);
  const worksList: WorkRecord[] = [];
  const authorSet = new Map<string, AuthorRecord>();

  // Progress tracking
  const progress: Progress = {
    currentPhase: '5E',
    currentItem: 'Starting...',
    stats: {
      '5E': { books: 0, passages: 0, skipped: 0 },
      '5F': { books: 0, passages: 0, skipped: 0 },
      '5G': { books: 0, passages: 0, skipped: 0 },
      '5H': { books: 0, passages: 0, skipped: 0 },
      '5I': { books: 0, passages: 0, skipped: 0 }
    },
    startTime
  };

  // ============ 5E: GERMAN LITERATURE ============
  console.log("\n" + "=".repeat(60));
  console.log("SUB-PHASE 5E: GERMAN LITERATURE");
  console.log("=".repeat(60));

  progress.currentPhase = '5E';
  for (const author of GERMAN_AUTHORS) {
    progress.currentItem = author;
    await updateProgress(progress);
    await searchAuthor(author, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5E']);
  }

  // Also search German language books
  progress.currentItem = 'German language books';
  await updateProgress(progress);
  await searchByLanguage('de', downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5E'], 15);

  console.log(`\n5E Complete: ${progress.stats['5E'].books} books, ${progress.stats['5E'].passages} passages`);

  // ============ 5F: SPANISH LITERATURE ============
  console.log("\n" + "=".repeat(60));
  console.log("SUB-PHASE 5F: SPANISH LITERATURE");
  console.log("=".repeat(60));

  progress.currentPhase = '5F';
  for (const author of SPANISH_AUTHORS) {
    progress.currentItem = author;
    await updateProgress(progress);
    await searchAuthor(author, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5F']);
  }

  // Also search Spanish language books
  progress.currentItem = 'Spanish language books';
  await updateProgress(progress);
  await searchByLanguage('es', downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5F'], 15);

  console.log(`\n5F Complete: ${progress.stats['5F'].books} books, ${progress.stats['5F'].passages} passages`);

  // ============ 5G: SOCIAL SCIENCES ============
  console.log("\n" + "=".repeat(60));
  console.log("SUB-PHASE 5G: SOCIAL SCIENCES");
  console.log("=".repeat(60));

  progress.currentPhase = '5G';
  for (const author of SOCIAL_SCIENCE_AUTHORS) {
    progress.currentItem = author;
    await updateProgress(progress);
    await searchAuthor(author, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5G']);
  }

  for (const shelf of SOCIAL_SCIENCE_BOOKSHELVES) {
    progress.currentItem = `Bookshelf: ${shelf}`;
    await updateProgress(progress);
    await searchBookshelf(shelf, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5G']);
  }

  console.log(`\n5G Complete: ${progress.stats['5G'].books} books, ${progress.stats['5G'].passages} passages`);

  // ============ 5H: LITERARY THEORY ============
  console.log("\n" + "=".repeat(60));
  console.log("SUB-PHASE 5H: LITERARY THEORY");
  console.log("=".repeat(60));

  progress.currentPhase = '5H';
  for (const author of LITERARY_THEORY_AUTHORS) {
    progress.currentItem = author;
    await updateProgress(progress);
    await searchAuthor(author, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5H']);
  }

  for (const shelf of LITERARY_THEORY_BOOKSHELVES) {
    progress.currentItem = `Bookshelf: ${shelf}`;
    await updateProgress(progress);
    await searchBookshelf(shelf, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5H']);
  }

  console.log(`\n5H Complete: ${progress.stats['5H'].books} books, ${progress.stats['5H'].passages} passages`);

  // ============ 5I: PHILOSOPHY ============
  console.log("\n" + "=".repeat(60));
  console.log("SUB-PHASE 5I: PHILOSOPHY");
  console.log("=".repeat(60));

  progress.currentPhase = '5I';
  for (const author of PHILOSOPHY_AUTHORS) {
    progress.currentItem = author;
    await updateProgress(progress);
    await searchAuthor(author, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5I']);
  }

  for (const shelf of PHILOSOPHY_BOOKSHELVES) {
    progress.currentItem = `Bookshelf: ${shelf}`;
    await updateProgress(progress);
    await searchBookshelf(shelf, downloadedIds, chunkWriter, worksList, authorSet, progress.stats['5I']);
  }

  console.log(`\n5I Complete: ${progress.stats['5I'].books} books, ${progress.stats['5I'].passages} passages`);

  // ============ FINALIZE ============
  console.log("\n" + "=".repeat(60));
  console.log("FINALIZING");
  console.log("=".repeat(60));

  // Close chunk stream
  const totalChunks = await chunkWriter.close();
  console.log(`Wrote ${totalChunks} chunks to phase5b-chunks.json`);

  // Write works
  await Bun.write(`${DATA_DIR}/phase5b-works.json`, JSON.stringify(worksList, null, 2));
  console.log(`Wrote ${worksList.length} works to phase5b-works.json`);

  // Write authors
  const authorList = Array.from(authorSet.values());
  await Bun.write(`${DATA_DIR}/phase5b-authors.json`, JSON.stringify(authorList, null, 2));
  console.log(`Wrote ${authorList.length} authors to phase5b-authors.json`);

  // Calculate totals
  let totalBooks = 0;
  let totalPassages = 0;
  let totalSkipped = 0;

  for (const phase of ['5E', '5F', '5G', '5H', '5I']) {
    totalBooks += progress.stats[phase].books;
    totalPassages += progress.stats[phase].passages;
    totalSkipped += progress.stats[phase].skipped;
  }

  // Write DONE file
  const doneContent = `Gutenberg Phase 5b complete (5E-5I)
Finished: ${new Date().toISOString()}

5E - German Literature: ${progress.stats['5E'].books} books, ${progress.stats['5E'].passages.toLocaleString()} passages
5F - Spanish Literature: ${progress.stats['5F'].books} books, ${progress.stats['5F'].passages.toLocaleString()} passages
5G - Social Sciences: ${progress.stats['5G'].books} books, ${progress.stats['5G'].passages.toLocaleString()} passages
5H - Literary Theory: ${progress.stats['5H'].books} books, ${progress.stats['5H'].passages.toLocaleString()} passages
5I - Philosophy: ${progress.stats['5I'].books} books, ${progress.stats['5I'].passages.toLocaleString()} passages

TOTAL: ${totalBooks} books, ${totalPassages.toLocaleString()} passages
Skipped (duplicates): ${totalSkipped}
`;

  await Bun.write(`${DATA_DIR}/DONE-5b.txt`, doneContent);

  // Final progress update
  progress.currentItem = 'Complete!';
  await updateProgress(progress);

  console.log("\n" + "=".repeat(60));
  console.log("PHASE 5B COMPLETE!");
  console.log("=".repeat(60));
  console.log(`Total Books: ${totalBooks}`);
  console.log(`Total Passages: ${totalPassages.toLocaleString()}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log("=".repeat(60));
}

// Run
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
