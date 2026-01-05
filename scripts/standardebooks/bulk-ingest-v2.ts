// Bulk ingestion for Standard Ebooks via GitHub raw content
// Uses our existing catalog and fetches XHTML directly from GitHub

import * as cheerio from 'cheerio';
import { generateId, getTimestamp } from '../../src/utils/ids';
import { createSlug } from '../../src/utils/slugs';
import { readJson, writeJson } from '../../src/utils/files';
import type { Author, Work, Chunk } from '../../src/types';
import { join } from 'path';

const DATA_DIR = join(import.meta.dir, '../../data/standardebooks');
const AUTHORS_FILE = join(DATA_DIR, 'authors.json');
const WORKS_FILE = join(DATA_DIR, 'works.json');
const CHUNKS_FILE = join(DATA_DIR, 'chunks.json');
const PROGRESS_MD = join(DATA_DIR, 'progress.md');

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/standardebooks';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get catalog from website (same as before)
async function fetchCatalog(): Promise<{ identifier: string; title: string; author: string }[]> {
  console.log('Fetching catalog from Standard Ebooks website...');
  const entries: { identifier: string; title: string; author: string }[] = [];
  let page = 1;

  while (page <= 30) {
    const url = `https://standardebooks.org/ebooks?page=${page}&per-page=48`;
    console.log(`  Page ${page}...`);

    const response = await fetch(url);
    if (!response.ok) break;

    const html = await response.text();
    const $ = cheerio.load(html);

    const bookLinks: string[] = [];
    $('ol.ebooks-list li a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/ebooks/') && href.split('/').length >= 3) {
        bookLinks.push(href);
      }
    });

    const uniqueLinks = [...new Set(bookLinks)];
    if (uniqueLinks.length === 0) break;

    for (const href of uniqueLinks) {
      const parts = href.split('/').filter(p => p && p !== 'ebooks');
      const identifier = parts.join('_');

      // Skip if already in entries
      if (entries.some(e => e.identifier === identifier)) continue;

      // Parse author and title from identifier
      const authorSlug = parts[0] || 'unknown';
      const titleSlug = parts[parts.length - 1] || 'unknown';

      entries.push({
        identifier,
        title: slugToName(titleSlug),
        author: slugToName(authorSlug)
      });
    }

    console.log(`  ${entries.length} books found`);
    await sleep(200);
    page++;
  }

  return entries;
}

function slugToName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function fetchBookContent(identifier: string): Promise<{ title: string; author: string; chapters: string[] } | null> {
  // Convert identifier to GitHub repo format
  // e.g., "jane-austen_pride-and-prejudice" stays the same
  const repoName = identifier;

  try {
    // Try to fetch content.opf from master branch first
    let branch = 'master';
    let opfUrl = `${GITHUB_RAW_BASE}/${repoName}/${branch}/src/epub/content.opf`;

    let response = await fetch(opfUrl);
    if (!response.ok) {
      // Try main branch
      branch = 'main';
      opfUrl = `${GITHUB_RAW_BASE}/${repoName}/${branch}/src/epub/content.opf`;
      response = await fetch(opfUrl);

      if (!response.ok) {
        return null;
      }
    }

    const opfText = await response.text();
    const $opf = cheerio.load(opfText, { xmlMode: true });

    const title = $opf('dc\\:title, title').first().text() || 'Unknown Title';
    const author = $opf('dc\\:creator, creator').first().text() || 'Unknown Author';

    // Get spine items (reading order)
    const spineItems: string[] = [];
    $opf('spine itemref').each((_, el) => {
      const idref = $opf(el).attr('idref');
      if (idref) spineItems.push(idref);
    });

    // Build manifest map
    const manifest: Map<string, string> = new Map();
    $opf('manifest item').each((_, el) => {
      const id = $opf(el).attr('id');
      const href = $opf(el).attr('href');
      if (id && href) manifest.set(id, href);
    });

    // Fetch chapter content
    const chapters: string[] = [];
    for (const itemId of spineItems) {
      const href = manifest.get(itemId);
      if (!href || !href.endsWith('.xhtml')) continue;

      // Skip front/back matter
      const skipPatterns = ['titlepage', 'colophon', 'imprint', 'uncopyright', 'halftitle', 'loi', 'dedication', 'epigraph', 'endnotes'];
      if (skipPatterns.some(p => href.includes(p))) continue;

      const chapterUrl = `${GITHUB_RAW_BASE}/${repoName}/${branch}/src/epub/${href}`;

      try {
        const chapterResponse = await fetch(chapterUrl);
        if (!chapterResponse.ok) continue;

        const chapterHtml = await chapterResponse.text();
        const $ = cheerio.load(chapterHtml, { xmlMode: true });

        // Remove unwanted elements
        $('header, footer, nav, figure, figcaption, blockquote[epub\\:type="z3998:verse"]').remove();

        const text = $('body').text()
          .replace(/\t/g, ' ')
          .replace(/ +/g, ' ')
          .replace(/\n +/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (text.length > 200) {
          chapters.push(text);
        }
      } catch {
        continue;
      }

      await sleep(30); // Small delay between file fetches
    }

    return { title, author, chapters };
  } catch (error) {
    return null;
  }
}

function chunkText(text: string, targetSize = 400, minSize = 200, maxSize = 600): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk && (currentChunk.length + trimmed.length + 2) > maxSize) {
      if (currentChunk.length >= minSize) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }

    if (trimmed.length > maxSize) {
      if (currentChunk.length >= minSize) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (currentChunk && (currentChunk.length + sentence.length + 1) > maxSize) {
          if (currentChunk.length >= minSize) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
        }
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;

        if (currentChunk.length >= targetSize) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed;

      if (currentChunk.length >= targetSize) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }
  }

  if (currentChunk.trim() && currentChunk.length >= minSize) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function updateProgressMd(processed: number, total: number, passages: number, current?: string): Promise<void> {
  const percent = ((processed / total) * 100).toFixed(1);
  const md = `# Standard Ebooks Ingestion Progress

**Method:** Bulk via GitHub raw content
**Last Updated:** ${new Date().toISOString()}

## Progress
- Books: ${processed} / ${total} (${percent}%)
- Passages: ${passages.toLocaleString()}
${current ? `- Current: ${current}` : ''}

## Status
🔄 Fetching from GitHub raw content (bypassing rate limits)
`;
  await Bun.write(PROGRESS_MD, md);
}

async function main(): Promise<void> {
  console.log('=== Standard Ebooks Bulk Ingestion v2 ===\n');

  // Load existing data
  const existingAuthors: Author[] = (await readJson<Author[]>(AUTHORS_FILE)) ?? [];
  const existingWorks: Work[] = (await readJson<Work[]>(WORKS_FILE)) ?? [];
  const existingChunks: Chunk[] = (await readJson<Chunk[]>(CHUNKS_FILE)) ?? [];

  console.log(`Existing: ${existingWorks.length} works, ${existingChunks.length} passages\n`);

  // Build set of processed identifiers
  const processedIds = new Set(existingWorks.map(w => w.source_id).filter(Boolean));

  // Author lookup
  const authorsByName = new Map<string, Author>();
  for (const a of existingAuthors) {
    authorsByName.set(a.name.toLowerCase(), a);
  }

  // Get catalog
  const catalog = await fetchCatalog();
  console.log(`\nTotal in catalog: ${catalog.length}`);

  // Filter to unprocessed
  const toProcess = catalog.filter(c => !processedIds.has(c.identifier));
  console.log(`Already done: ${catalog.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}\n`);

  let processed = existingWorks.length;
  let totalPassages = existingChunks.length;
  let saveCounter = 0;

  const newAuthors: Author[] = [];
  const newWorks: Work[] = [];
  const newChunks: Chunk[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    console.log(`\n[${processed + 1}/${catalog.length}] ${entry.title} by ${entry.author}`);

    const content = await fetchBookContent(entry.identifier);

    if (!content || content.chapters.length === 0) {
      console.log('  ⏭️ Skipped (no content)');
      continue;
    }

    console.log(`  ${content.chapters.length} chapters`);

    // Chunk text
    const allText = content.chapters.join('\n\n');
    const textChunks = chunkText(allText);

    if (textChunks.length === 0) {
      console.log('  ⏭️ Skipped (no passages)');
      continue;
    }

    console.log(`  ${textChunks.length} passages`);

    // Get or create author
    const authorKey = content.author.toLowerCase();
    let author = authorsByName.get(authorKey);

    if (!author) {
      author = {
        id: generateId(),
        name: content.author,
        slug: createSlug(content.author),
        birth_year: null,
        death_year: null,
        nationality: null,
        era: null,
        bio: null,
        wikipedia_url: null,
        created_at: getTimestamp()
      };
      newAuthors.push(author);
      authorsByName.set(authorKey, author);
    }

    // Create work
    const work: Work = {
      id: generateId(),
      author_id: author.id,
      title: content.title,
      slug: createSlug(content.title),
      original_language: 'en',
      publication_year: null,
      genre: null,
      form: 'novel',
      source: 'standardebooks',
      source_id: entry.identifier,
      created_at: getTimestamp()
    };
    newWorks.push(work);

    // Create chunks
    for (let j = 0; j < textChunks.length; j++) {
      newChunks.push({
        id: generateId(),
        work_id: work.id,
        author_id: author.id,
        content: textChunks[j],
        chunk_index: j,
        chunk_type: 'passage',
        source: 'standardebooks',
        source_metadata: { position_percent: Math.round((j / textChunks.length) * 100) },
        created_at: getTimestamp()
      });
    }

    processed++;
    totalPassages += textChunks.length;
    console.log('  ✅ Done');

    // Save every 10 books
    saveCounter++;
    if (saveCounter >= 10) {
      console.log('\n💾 Saving...');

      const allAuthors = [...existingAuthors, ...newAuthors];
      const allWorks = [...existingWorks, ...newWorks];
      const allChunks = [...existingChunks, ...newChunks];

      const uniqueAuthors = Array.from(new Map(allAuthors.map(a => [a.name.toLowerCase(), a])).values());

      await writeJson(AUTHORS_FILE, uniqueAuthors);
      await writeJson(WORKS_FILE, allWorks);
      await writeJson(CHUNKS_FILE, allChunks);
      await updateProgressMd(processed, catalog.length, totalPassages, content.title);

      existingAuthors.push(...newAuthors);
      existingWorks.push(...newWorks);
      existingChunks.push(...newChunks);
      newAuthors.length = 0;
      newWorks.length = 0;
      newChunks.length = 0;
      saveCounter = 0;
    }

    // Small delay
    await sleep(100);
  }

  // Final save
  console.log('\n\n💾 Final save...');

  const allAuthors = [...existingAuthors, ...newAuthors];
  const allWorks = [...existingWorks, ...newWorks];
  const allChunks = [...existingChunks, ...newChunks];
  const uniqueAuthors = Array.from(new Map(allAuthors.map(a => [a.name.toLowerCase(), a])).values());

  await writeJson(AUTHORS_FILE, uniqueAuthors);
  await writeJson(WORKS_FILE, allWorks);
  await writeJson(CHUNKS_FILE, allChunks);
  await updateProgressMd(processed, catalog.length, totalPassages);

  await Bun.write(join(DATA_DIR, 'DONE.txt'), `Standard Ebooks complete
Finished: ${new Date().toISOString()}
Books: ${processed}
Passages: ${totalPassages}
Authors: ${uniqueAuthors.length}
`);

  console.log('\n=== Complete ===');
  console.log(`Books: ${processed}`);
  console.log(`Passages: ${totalPassages.toLocaleString()}`);
}

main().catch(console.error);
