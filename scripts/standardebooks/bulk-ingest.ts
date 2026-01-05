// Bulk ingestion for Standard Ebooks via GitHub API
// Bypasses rate limits by fetching XHTML directly from repos

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

// GitHub API has 60 requests/hour unauthenticated, but we can use raw.githubusercontent.com
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/standardebooks';
const GITHUB_API_BASE = 'https://api.github.com';

interface RepoInfo {
  name: string;
  full_name: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllRepos(): Promise<RepoInfo[]> {
  console.log('Fetching all Standard Ebooks repos from GitHub...');
  const allRepos: RepoInfo[] = [];
  let page = 1;

  while (true) {
    const url = `${GITHUB_API_BASE}/orgs/standardebooks/repos?per_page=100&page=${page}&type=public`;
    console.log(`  Page ${page}...`);

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) {
        console.log('  Rate limited by GitHub API, waiting 60s...');
        await sleep(60000);
        continue;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json() as RepoInfo[];
    if (repos.length === 0) break;

    // Filter to only ebook repos (not tools, web, manual, etc.)
    const ebookRepos = repos.filter(r =>
      !['tools', 'web', 'manual', 'se-lint-ui'].includes(r.name) &&
      r.name.includes('_') // Ebook repos have format author_title
    );

    allRepos.push(...ebookRepos);
    console.log(`  Found ${ebookRepos.length} ebook repos (${allRepos.length} total)`);

    if (repos.length < 100) break;
    page++;
    await sleep(100); // Small delay between API calls
  }

  return allRepos;
}

async function fetchRepoContent(repoName: string): Promise<{ title: string; author: string; chapters: string[] } | null> {
  try {
    // Fetch content.opf for metadata - try master first
    const opfUrl = `${GITHUB_RAW_BASE}/${repoName}/master/src/epub/content.opf`;
    let opfText: string;
    let branch: string;

    try {
      const opfResponse = await fetch(opfUrl);
      if (opfResponse.ok) {
        opfText = await opfResponse.text();
        branch = 'master';
      } else {
        // Try 'main' branch
        const opfUrlMain = `${GITHUB_RAW_BASE}/${repoName}/main/src/epub/content.opf`;
        const opfResponseMain = await fetch(opfUrlMain);
        if (!opfResponseMain.ok) {
          console.log(`  Could not fetch content.opf (${opfResponse.status}/${opfResponseMain.status})`);
          return null;
        }
        opfText = await opfResponseMain.text();
        branch = 'main';
      }
    } catch (fetchError) {
      console.log(`  Fetch error: ${(fetchError as Error).message}`);
      return null;
    }

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
      if (href.includes('titlepage') || href.includes('colophon') ||
          href.includes('imprint') || href.includes('uncopyright') ||
          href.includes('halftitle') || href.includes('loi')) continue;

      const chapterUrl = `${GITHUB_RAW_BASE}/${repoName}/${branch}/src/epub/${href}`;
      const chapterResponse = await fetch(chapterUrl);

      if (!chapterResponse.ok) continue;

      const chapterHtml = await chapterResponse.text();
      const $ = cheerio.load(chapterHtml, { xmlMode: true });

      // Remove unwanted elements
      $('header, footer, nav, figure, figcaption').remove();

      const text = $('body').text()
        .replace(/\t/g, ' ')
        .replace(/ +/g, ' ')
        .replace(/\n +/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length > 200) {
        chapters.push(text);
      }

      await sleep(50); // Small delay between file fetches
    }

    return { title, author, chapters };
  } catch (error) {
    console.error(`  Error fetching ${repoName}:`, error);
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

      // Split long paragraph by sentences
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

async function updateProgressMd(
  processed: number,
  total: number,
  passages: number,
  current?: string
): Promise<void> {
  const percent = ((processed / total) * 100).toFixed(1);
  const md = `# Standard Ebooks Ingestion Progress

**Method:** Bulk download via GitHub (bypassing rate limits)
**Last Updated:** ${new Date().toISOString()}

## Progress
- Books: ${processed} / ${total} (${percent}%)
- Passages extracted: ${passages.toLocaleString()}
${current ? `- Current: ${current}` : ''}

## Status
🔄 Processing via GitHub raw content (no rate limits)
`;
  await Bun.write(PROGRESS_MD, md);
}

async function main(): Promise<void> {
  console.log('=== Standard Ebooks Bulk Ingestion (via GitHub) ===\n');

  // Load existing data
  const existingAuthors: Author[] = (await readJson<Author[]>(AUTHORS_FILE)) ?? [];
  const existingWorks: Work[] = (await readJson<Work[]>(WORKS_FILE)) ?? [];
  const existingChunks: Chunk[] = (await readJson<Chunk[]>(CHUNKS_FILE)) ?? [];

  console.log(`Existing data: ${existingWorks.length} works, ${existingChunks.length} passages\n`);

  // Build set of already-processed work identifiers
  const processedIds = new Set(existingWorks.map(w => w.source_id).filter(Boolean));

  // Build author lookup
  const authorsByName = new Map<string, Author>();
  for (const author of existingAuthors) {
    authorsByName.set(author.name.toLowerCase(), author);
  }

  // Fetch all repos
  const repos = await fetchAllRepos();
  console.log(`\nFound ${repos.length} ebook repos\n`);

  // Filter to unprocessed repos
  const toProcess = repos.filter(r => !processedIds.has(r.name));
  console.log(`Already processed: ${repos.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}\n`);

  let processed = existingWorks.length;
  let totalPassages = existingChunks.length;
  let saveCounter = 0;

  const newAuthors: Author[] = [];
  const newWorks: Work[] = [];
  const newChunks: Chunk[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const repo = toProcess[i];
    console.log(`\n[${processed + 1}/${repos.length}] Processing: ${repo.name}`);

    const content = await fetchRepoContent(repo.full_name);
    if (!content || content.chapters.length === 0) {
      console.log('  ⏭️ Skipped (no content)');
      continue;
    }

    console.log(`  Found ${content.chapters.length} chapters`);

    // Chunk all chapters
    const allText = content.chapters.join('\n\n');
    const textChunks = chunkText(allText);
    console.log(`  Created ${textChunks.length} passages`);

    if (textChunks.length === 0) {
      console.log('  ⏭️ Skipped (no passages)');
      continue;
    }

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
      source_id: repo.name,
      created_at: getTimestamp()
    };
    newWorks.push(work);

    // Create chunks
    for (let j = 0; j < textChunks.length; j++) {
      const chunk: Chunk = {
        id: generateId(),
        work_id: work.id,
        author_id: author.id,
        content: textChunks[j],
        chunk_index: j,
        chunk_type: 'passage',
        source: 'standardebooks',
        source_metadata: {
          position_percent: Math.round((j / textChunks.length) * 100)
        },
        created_at: getTimestamp()
      };
      newChunks.push(chunk);
    }

    processed++;
    totalPassages += textChunks.length;
    console.log(`  ✅ Done - ${textChunks.length} passages`);

    // Save periodically
    saveCounter++;
    if (saveCounter >= 20) {
      console.log('\n💾 Saving progress...');

      // Merge with existing
      const allAuthors = [...existingAuthors, ...newAuthors];
      const allWorks = [...existingWorks, ...newWorks];
      const allChunks = [...existingChunks, ...newChunks];

      // Dedupe authors
      const uniqueAuthors = Array.from(
        new Map(allAuthors.map(a => [a.name.toLowerCase(), a])).values()
      );

      await writeJson(AUTHORS_FILE, uniqueAuthors);
      await writeJson(WORKS_FILE, allWorks);
      await writeJson(CHUNKS_FILE, allChunks);
      await updateProgressMd(processed, repos.length, totalPassages, content.title);

      // Move new items to existing for next save
      existingAuthors.push(...newAuthors);
      existingWorks.push(...newWorks);
      existingChunks.push(...newChunks);
      newAuthors.length = 0;
      newWorks.length = 0;
      newChunks.length = 0;

      saveCounter = 0;
    }

    // Small delay to be nice to GitHub
    await sleep(200);
  }

  // Final save
  console.log('\n\n💾 Saving final data...');

  const allAuthors = [...existingAuthors, ...newAuthors];
  const allWorks = [...existingWorks, ...newWorks];
  const allChunks = [...existingChunks, ...newChunks];

  const uniqueAuthors = Array.from(
    new Map(allAuthors.map(a => [a.name.toLowerCase(), a])).values()
  );

  await writeJson(AUTHORS_FILE, uniqueAuthors);
  await writeJson(WORKS_FILE, allWorks);
  await writeJson(CHUNKS_FILE, allChunks);
  await updateProgressMd(processed, repos.length, totalPassages);

  // Create completion signal
  const doneContent = `Standard Ebooks ingestion complete
Method: Bulk download via GitHub
Finished: ${new Date().toISOString()}
Books: ${processed}
Passages: ${totalPassages}
Authors: ${uniqueAuthors.length}
`;
  await Bun.write(join(DATA_DIR, 'DONE.txt'), doneContent);

  console.log('\n=== Standard Ebooks Bulk Ingestion Complete ===');
  console.log(`Books processed: ${processed}`);
  console.log(`Total passages: ${totalPassages.toLocaleString()}`);
  console.log(`Authors: ${uniqueAuthors.length}`);
}

main().catch(console.error);
