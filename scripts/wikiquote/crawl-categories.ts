#!/usr/bin/env bun
// Wikiquote Category Crawler for Phase 3
// Discovers authors from Wikiquote category pages

import * as cheerio from 'cheerio';
import { fetchText } from '../../src/utils/fetch';
import { writeJson, readJson } from '../../src/utils/files';
import { TIER1_AUTHORS, TIER2_AUTHORS } from './author-lists';

const DATA_DIR = './data/wikiquote';
const CRAWL_PROGRESS_FILE = `${DATA_DIR}/.crawl-progress.json`;
const TIER3_OUTPUT_FILE = './scripts/wikiquote/author-lists/tier3-crawled.ts';
const PROGRESS_MD_FILE = `${DATA_DIR}/progress.md`;

// Categories to crawl - ordered by expected quality/quantity
const CATEGORIES_TO_CRAWL = [
  'Writers',
  'Philosophers',
  'Poets',
  'Scientists',
  'Politicians',
  'Novelists',
  'Playwrights',
  'Essayists',
  'Historians',
  'Journalists',
  'Religious_figures',
  'Activists',
  'Artists',
  'Composers',
  'Film_directors',
  'Economists',
  'Mathematicians',
  'Lawyers',
  'Military_personnel',
  'Monarchs',
];

interface DiscoveredAuthor {
  name: string;
  wikiquote_url: string;
  discovered_from_category: string;
  discovered_at: string;
}

interface CrawlProgress {
  completedCategories: string[];
  discoveredAuthors: DiscoveredAuthor[];
  lastUpdated: string;
}

interface CategoryResult {
  category: string;
  authorsFound: number;
  newAuthors: number;
  pagesProcessed: number;
}

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseArgs(): { limit?: number; category?: string } {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let category: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--category=')) {
      category = arg.split('=')[1];
    }
  }

  return { limit, category };
}

async function loadProgress(): Promise<CrawlProgress> {
  const existing = await readJson<CrawlProgress>(CRAWL_PROGRESS_FILE);
  return existing ?? {
    completedCategories: [],
    discoveredAuthors: [],
    lastUpdated: new Date().toISOString(),
  };
}

async function saveProgress(progress: CrawlProgress): Promise<void> {
  progress.lastUpdated = new Date().toISOString();
  await writeJson(CRAWL_PROGRESS_FILE, progress);
}

function buildExistingAuthorsSet(progress: CrawlProgress): Set<string> {
  const existing = new Set<string>();

  // Add tier 1 authors
  for (const author of TIER1_AUTHORS) {
    existing.add(normalizeAuthorName(author.name));
  }

  // Add tier 2 authors
  for (const author of TIER2_AUTHORS) {
    existing.add(normalizeAuthorName(author.name));
  }

  // Add already discovered tier 3 authors
  for (const author of progress.discoveredAuthors) {
    existing.add(normalizeAuthorName(author.name));
  }

  return existing;
}

async function crawlCategoryPage(
  categoryName: string,
  pageUrl: string
): Promise<{ authors: Array<{ name: string; url: string }>; nextPageUrl: string | null }> {
  console.log(`  [Crawl] Fetching: ${pageUrl}`);

  const html = await fetchText(pageUrl, { rateLimit: 1000, timeout: 30000 });
  const $ = cheerio.load(html);

  const authors: Array<{ name: string; url: string }> = [];

  // Find author links in the category listing
  // They're in div.mw-category or div.mw-category-group
  $('div.mw-category a, div.mw-category-group a').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href');
    const name = $link.text().trim();

    // Skip empty, category links, and special pages
    if (!href || !name) return;
    if (href.includes('Category:')) return;
    if (href.includes('Special:')) return;
    if (href.includes('File:')) return;
    if (href.includes('Template:')) return;
    if (href.includes('Help:')) return;
    if (href.includes('Wikipedia:')) return;

    // Skip "quotes about" pages
    if (name.toLowerCase().includes('quotes about')) return;
    if (name.toLowerCase().includes('(disambiguation)')) return;

    // Only include /wiki/ links
    if (href.startsWith('/wiki/')) {
      const fullUrl = `https://en.wikiquote.org${href}`;
      authors.push({ name, url: fullUrl });
    }
  });

  // Find "next page" link for pagination
  let nextPageUrl: string | null = null;
  $('a').each((_, el) => {
    const $link = $(el);
    const text = $link.text().trim().toLowerCase();
    const href = $link.attr('href');

    if ((text === 'next page' || text === 'next 200') && href) {
      nextPageUrl = `https://en.wikiquote.org${href}`;
    }
  });

  return { authors, nextPageUrl };
}

async function crawlCategory(
  categoryName: string,
  existingAuthors: Set<string>,
  progress: CrawlProgress
): Promise<CategoryResult | null> {
  console.log(`\n[Category] Crawling: ${categoryName}`);

  const baseUrl = `https://en.wikiquote.org/wiki/Category:${categoryName}`;
  let currentUrl: string | null = baseUrl;
  let pagesProcessed = 0;
  let authorsFound = 0;
  let newAuthors = 0;
  const today = new Date().toISOString().split('T')[0];

  while (currentUrl) {
    pagesProcessed++;
    let result;
    try {
      result = await crawlCategoryPage(categoryName, currentUrl);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not found')) {
        console.log(`  [Skip] Category not found: ${categoryName}`);
        return null;
      }
      throw error;
    }
    const { authors, nextPageUrl } = result;

    for (const { name, url } of authors) {
      authorsFound++;
      const normalized = normalizeAuthorName(name);

      // Skip if already exists
      if (existingAuthors.has(normalized)) {
        continue;
      }

      // Add to discovered authors
      existingAuthors.add(normalized);
      progress.discoveredAuthors.push({
        name,
        wikiquote_url: url,
        discovered_from_category: categoryName,
        discovered_at: today,
      });
      newAuthors++;
    }

    console.log(`  [Page ${pagesProcessed}] Found ${authors.length} authors, ${newAuthors} new total`);

    currentUrl = nextPageUrl;

    // Save progress after each page
    await saveProgress(progress);
  }

  return {
    category: categoryName,
    authorsFound,
    newAuthors,
    pagesProcessed,
  };
}

function generateTier3File(authors: DiscoveredAuthor[]): string {
  const lines = [
    '// Auto-generated by crawl-categories.ts',
    '// DO NOT EDIT - regenerate with: bun run scripts/wikiquote/crawl-categories.ts',
    `// Generated: ${new Date().toISOString()}`,
    `// Total authors: ${authors.length}`,
    '',
    'export interface DiscoveredAuthor {',
    '  name: string;',
    '  wikiquote_url: string;',
    '  discovered_from_category: string;',
    '  discovered_at: string;',
    '}',
    '',
    'export const TIER3_AUTHORS: DiscoveredAuthor[] = [',
  ];

  for (const author of authors) {
    lines.push(`  { name: ${JSON.stringify(author.name)}, wikiquote_url: ${JSON.stringify(author.wikiquote_url)}, discovered_from_category: ${JSON.stringify(author.discovered_from_category)}, discovered_at: ${JSON.stringify(author.discovered_at)} },`);
  }

  lines.push('];');
  lines.push('');
  lines.push('export const TIER3_AUTHOR_NAMES = TIER3_AUTHORS.map(a => a.name);');
  lines.push('');

  return lines.join('\n');
}

function generateProgressMd(
  results: CategoryResult[],
  totalDiscovered: number,
  existingCount: number
): string {
  const lines = [
    '# Wikiquote Category Crawl Progress',
    '',
    '## Summary',
    '',
    `- **Categories crawled:** ${results.length} / ${CATEGORIES_TO_CRAWL.length}`,
    `- **Authors discovered:** ${totalDiscovered}`,
    `- **Authors deduplicated (already in tier1/2):** ${existingCount}`,
    '',
    '## Category Results',
    '',
    '| Category | Authors Found | New Authors | Pages | Status |',
    '|----------|---------------|-------------|-------|--------|',
  ];

  for (const result of results) {
    lines.push(`| ${result.category} | ${result.authorsFound} | ${result.newAuthors} | ${result.pagesProcessed} | Complete |`);
  }

  // Add remaining categories as pending
  const completedCategories = new Set(results.map(r => r.category));
  for (const cat of CATEGORIES_TO_CRAWL) {
    if (!completedCategories.has(cat)) {
      lines.push(`| ${cat} | - | - | - | Pending |`);
    }
  }

  lines.push('');
  lines.push(`## Last Updated: ${new Date().toISOString()}`);
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const { limit, category } = parseArgs();

  console.log('=== Wikiquote Category Crawler ===');
  console.log('');

  // Load progress
  const progress = await loadProgress();
  const existingAuthors = buildExistingAuthorsSet(progress);

  console.log(`Existing authors (tier1+tier2): ${TIER1_AUTHORS.length + TIER2_AUTHORS.length}`);
  console.log(`Already discovered (tier3): ${progress.discoveredAuthors.length}`);
  console.log('');

  // Determine which categories to crawl
  let categoriesToProcess: string[];

  if (category) {
    // Single category mode
    categoriesToProcess = [category];
    console.log(`Mode: Single category (${category})`);
  } else if (limit) {
    // Limited categories mode
    categoriesToProcess = CATEGORIES_TO_CRAWL.filter(
      c => !progress.completedCategories.includes(c)
    ).slice(0, limit);
    console.log(`Mode: Limited crawl (${limit} categories)`);
  } else {
    // Full crawl mode
    categoriesToProcess = CATEGORIES_TO_CRAWL.filter(
      c => !progress.completedCategories.includes(c)
    );
    console.log(`Mode: Full crawl (${categoriesToProcess.length} remaining categories)`);
  }

  if (categoriesToProcess.length === 0) {
    console.log('All categories already crawled!');
    return;
  }

  console.log(`Categories to process: ${categoriesToProcess.join(', ')}`);
  console.log('');

  // Crawl categories
  const results: CategoryResult[] = [];
  const existingCountBefore = existingAuthors.size;

  for (const cat of categoriesToProcess) {
    const result = await crawlCategory(cat, existingAuthors, progress);
    if (result) {
      results.push(result);
    }

    // Mark category as complete (even if not found, so we don't retry)
    if (!progress.completedCategories.includes(cat)) {
      progress.completedCategories.push(cat);
    }
    await saveProgress(progress);
  }

  // Calculate deduplication count
  const deduplicatedCount = results.reduce((sum, r) => sum + (r.authorsFound - r.newAuthors), 0);

  // Generate tier3-crawled.ts
  console.log('\n[Output] Generating tier3-crawled.ts...');
  const tier3Content = generateTier3File(progress.discoveredAuthors);
  await Bun.write(TIER3_OUTPUT_FILE, tier3Content);
  console.log(`  Written: ${TIER3_OUTPUT_FILE}`);

  // Generate progress.md
  console.log('[Output] Generating progress.md...');
  const progressMd = generateProgressMd(results, progress.discoveredAuthors.length, deduplicatedCount);
  await Bun.write(PROGRESS_MD_FILE, progressMd);
  console.log(`  Written: ${PROGRESS_MD_FILE}`);

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('CRAWL COMPLETE');
  console.log('='.repeat(50));
  console.log('');
  console.log('Results by category:');
  for (const result of results) {
    console.log(`  ${result.category}: ${result.authorsFound} found, ${result.newAuthors} new`);
  }
  console.log('');
  console.log(`Total new authors discovered: ${progress.discoveredAuthors.length}`);
  console.log(`Total deduplicated: ${deduplicatedCount}`);
  console.log('');
  console.log('Output files:');
  console.log(`  ${TIER3_OUTPUT_FILE}`);
  console.log(`  ${PROGRESS_MD_FILE}`);
  console.log('');
  console.log('Next steps:');
  console.log('  To continue crawling: bun run scripts/wikiquote/crawl-categories.ts');
  console.log('  To ingest quotes: bun run scripts/ingest.ts --source=wikiquote --tier=3');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
