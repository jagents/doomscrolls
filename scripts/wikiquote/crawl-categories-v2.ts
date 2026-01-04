#!/usr/bin/env bun
// Wikiquote Category Crawler v2 - Uses MediaWiki API with recursive subcategory crawling
// Fixes the issues from v1: proper pagination, subcategory recursion, API instead of HTML scraping

import { writeJson, readJson } from '../../src/utils/files';
import { TIER1_AUTHORS, TIER2_AUTHORS } from './author-lists';

const DATA_DIR = './data/wikiquote';
const CRAWL_PROGRESS_FILE = `${DATA_DIR}/.crawl-progress-v2.json`;
const TIER3_OUTPUT_FILE = './scripts/wikiquote/author-lists/tier3-crawled.ts';
const PROGRESS_MD_FILE = `${DATA_DIR}/progress-v2.md`;

const API_BASE = 'https://en.wikiquote.org/w/api.php';
const RATE_LIMIT_MS = 200; // Be nice to the API

// Better starting categories - these have more direct author pages
const ROOT_CATEGORIES = [
  'Authors_from_the_United_States',
  'Authors_from_England',
  'Authors_from_France',
  'Authors_from_Germany',
  'Authors_from_Russia',
  'Authors_from_India',
  'Authors_from_Ireland',
  'Authors_from_Scotland',
  'Authors_from_Italy',
  'Authors_from_Canada',
  'Authors_from_Australia',
  'Greek_philosophers',
  'Roman_philosophers',
  'German_philosophers',
  'French_philosophers',
  'British_philosophers',
  'American_philosophers',
  'Poets_from_the_United_States',
  'Poets_from_England',
  'Scientists',
  'Physicists',
  'Historians',
  'Economists',
];

interface DiscoveredAuthor {
  name: string;
  wikiquote_url: string;
  discovered_from_category: string;
  discovered_at: string;
}

interface CrawlProgress {
  completedCategories: string[];
  visitedCategories: string[]; // All categories we've seen (to avoid loops)
  discoveredAuthors: DiscoveredAuthor[];
  lastUpdated: string;
  stats: {
    totalPagesFound: number;
    totalSubcategoriesFound: number;
    apiCalls: number;
  };
}

interface CategoryMember {
  pageid: number;
  ns: number; // 0 = page, 14 = category
  title: string;
}

interface ApiResponse {
  batchcomplete?: string;
  continue?: {
    cmcontinue: string;
    continue: string;
  };
  query?: {
    categorymembers: CategoryMember[];
  };
}

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseArgs(): { limit?: number; maxDepth?: number; dryRun?: boolean } {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let maxDepth: number | undefined;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--max-depth=')) {
      maxDepth = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { limit, maxDepth: maxDepth ?? 3, dryRun };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadProgress(): Promise<CrawlProgress> {
  const existing = await readJson<CrawlProgress>(CRAWL_PROGRESS_FILE);
  return existing ?? {
    completedCategories: [],
    visitedCategories: [],
    discoveredAuthors: [],
    lastUpdated: new Date().toISOString(),
    stats: {
      totalPagesFound: 0,
      totalSubcategoriesFound: 0,
      apiCalls: 0,
    },
  };
}

async function saveProgress(progress: CrawlProgress): Promise<void> {
  progress.lastUpdated = new Date().toISOString();
  await writeJson(CRAWL_PROGRESS_FILE, progress);
}

function buildExistingAuthorsSet(progress: CrawlProgress): Set<string> {
  const existing = new Set<string>();

  for (const author of TIER1_AUTHORS) {
    existing.add(normalizeAuthorName(author.name));
  }
  for (const author of TIER2_AUTHORS) {
    existing.add(normalizeAuthorName(author.name));
  }
  for (const author of progress.discoveredAuthors) {
    existing.add(normalizeAuthorName(author.name));
  }

  return existing;
}

async function fetchCategoryMembers(
  categoryTitle: string,
  type: 'page' | 'subcat',
  progress: CrawlProgress
): Promise<CategoryMember[]> {
  const members: CategoryMember[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle.startsWith('Category:') ? categoryTitle : `Category:${categoryTitle}`,
      cmtype: type,
      cmlimit: '500',
      format: 'json',
    });

    if (cmcontinue) {
      params.set('cmcontinue', cmcontinue);
    }

    const url = `${API_BASE}?${params.toString()}`;

    await sleep(RATE_LIMIT_MS);
    progress.stats.apiCalls++;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  [API Error] ${response.status} for ${categoryTitle}`);
      break;
    }

    const data: ApiResponse = await response.json();

    if (data.query?.categorymembers) {
      members.push(...data.query.categorymembers);
    }

    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function crawlCategoryRecursive(
  categoryName: string,
  existingAuthors: Set<string>,
  progress: CrawlProgress,
  depth: number,
  maxDepth: number,
  rootCategory: string
): Promise<{ pagesFound: number; newAuthors: number }> {
  const fullCategoryName = categoryName.startsWith('Category:') ? categoryName : `Category:${categoryName}`;

  // Skip if already visited (prevent infinite loops)
  if (progress.visitedCategories.includes(fullCategoryName)) {
    return { pagesFound: 0, newAuthors: 0 };
  }
  progress.visitedCategories.push(fullCategoryName);

  const indent = '  '.repeat(depth);
  console.log(`${indent}[Depth ${depth}] ${categoryName}`);

  let pagesFound = 0;
  let newAuthors = 0;
  const today = new Date().toISOString().split('T')[0];

  // Get pages in this category
  const pages = await fetchCategoryMembers(categoryName, 'page', progress);
  pagesFound += pages.length;
  progress.stats.totalPagesFound += pages.length;

  for (const page of pages) {
    // Skip non-main namespace pages
    if (page.ns !== 0) continue;

    // Skip meta pages
    if (page.title.startsWith('Wikiquote:')) continue;
    if (page.title.includes('(disambiguation)')) continue;
    if (page.title.toLowerCase().includes('quotes about')) continue;

    const normalized = normalizeAuthorName(page.title);
    if (existingAuthors.has(normalized)) continue;

    existingAuthors.add(normalized);
    progress.discoveredAuthors.push({
      name: page.title,
      wikiquote_url: `https://en.wikiquote.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      discovered_from_category: rootCategory,
      discovered_at: today,
    });
    newAuthors++;
  }

  if (pages.length > 0) {
    console.log(`${indent}  → ${pages.length} pages, ${newAuthors} new authors`);
  }

  // Recurse into subcategories if not at max depth
  if (depth < maxDepth) {
    const subcats = await fetchCategoryMembers(categoryName, 'subcat', progress);
    progress.stats.totalSubcategoriesFound += subcats.length;

    for (const subcat of subcats) {
      const subcatName = subcat.title.replace('Category:', '');
      const result = await crawlCategoryRecursive(
        subcatName,
        existingAuthors,
        progress,
        depth + 1,
        maxDepth,
        rootCategory
      );
      pagesFound += result.pagesFound;
      newAuthors += result.newAuthors;

      // Save progress periodically
      if (progress.stats.apiCalls % 50 === 0) {
        await saveProgress(progress);
      }
    }
  }

  return { pagesFound, newAuthors };
}

function generateTier3File(authors: DiscoveredAuthor[]): string {
  const lines = [
    '// Auto-generated by crawl-categories-v2.ts',
    '// DO NOT EDIT - regenerate with: bun run scripts/wikiquote/crawl-categories-v2.ts',
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

function generateProgressMd(progress: CrawlProgress, rootCategories: string[]): string {
  const completedSet = new Set(progress.completedCategories);

  const lines = [
    '# Wikiquote Category Crawl Progress (v2 - API-based)',
    '',
    '## Summary',
    '',
    `- **Root categories crawled:** ${progress.completedCategories.length} / ${rootCategories.length}`,
    `- **Total categories visited:** ${progress.visitedCategories.length}`,
    `- **Authors discovered:** ${progress.discoveredAuthors.length}`,
    `- **Total pages found:** ${progress.stats.totalPagesFound}`,
    `- **Total subcategories found:** ${progress.stats.totalSubcategoriesFound}`,
    `- **API calls made:** ${progress.stats.apiCalls}`,
    '',
    '## Root Category Status',
    '',
    '| Category | Status |',
    '|----------|--------|',
  ];

  for (const cat of rootCategories) {
    const status = completedSet.has(cat) ? 'Complete' : 'Pending';
    lines.push(`| ${cat} | ${status} |`);
  }

  lines.push('');
  lines.push(`## Last Updated: ${progress.lastUpdated}`);
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const { limit, maxDepth, dryRun } = parseArgs();

  console.log('=== Wikiquote Category Crawler v2 (API-based) ===');
  console.log('');
  console.log(`Max recursion depth: ${maxDepth}`);
  if (limit) console.log(`Root category limit: ${limit}`);
  if (dryRun) console.log('DRY RUN - no files will be written');
  console.log('');

  const progress = await loadProgress();
  const existingAuthors = buildExistingAuthorsSet(progress);

  console.log(`Existing authors (tier1+tier2): ${TIER1_AUTHORS.length + TIER2_AUTHORS.length}`);
  console.log(`Already discovered (tier3): ${progress.discoveredAuthors.length}`);
  console.log(`Categories already visited: ${progress.visitedCategories.length}`);
  console.log('');

  // Determine which root categories to crawl
  let rootCategoriesToCrawl = ROOT_CATEGORIES.filter(
    cat => !progress.completedCategories.includes(cat)
  );

  if (limit) {
    rootCategoriesToCrawl = rootCategoriesToCrawl.slice(0, limit);
  }

  if (rootCategoriesToCrawl.length === 0) {
    console.log('All root categories already crawled!');
    return;
  }

  console.log(`Root categories to process: ${rootCategoriesToCrawl.length}`);
  console.log('');

  const startAuthors = progress.discoveredAuthors.length;

  for (const rootCat of rootCategoriesToCrawl) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`ROOT: ${rootCat}`);
    console.log('='.repeat(50));

    const beforeAuthors = progress.discoveredAuthors.length;

    await crawlCategoryRecursive(
      rootCat,
      existingAuthors,
      progress,
      0,
      maxDepth!,
      rootCat
    );

    const newFromRoot = progress.discoveredAuthors.length - beforeAuthors;
    console.log(`\n  Total new authors from ${rootCat}: ${newFromRoot}`);

    progress.completedCategories.push(rootCat);
    await saveProgress(progress);
  }

  const totalNewAuthors = progress.discoveredAuthors.length - startAuthors;

  // Generate output files
  if (!dryRun) {
    console.log('\n[Output] Generating tier3-crawled.ts...');
    const tier3Content = generateTier3File(progress.discoveredAuthors);
    await Bun.write(TIER3_OUTPUT_FILE, tier3Content);
    console.log(`  Written: ${TIER3_OUTPUT_FILE}`);

    console.log('[Output] Generating progress-v2.md...');
    const progressMd = generateProgressMd(progress, ROOT_CATEGORIES);
    await Bun.write(PROGRESS_MD_FILE, progressMd);
    console.log(`  Written: ${PROGRESS_MD_FILE}`);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('CRAWL COMPLETE');
  console.log('='.repeat(50));
  console.log('');
  console.log(`New authors discovered this run: ${totalNewAuthors}`);
  console.log(`Total authors discovered: ${progress.discoveredAuthors.length}`);
  console.log(`Categories visited: ${progress.visitedCategories.length}`);
  console.log(`API calls made: ${progress.stats.apiCalls}`);
  console.log('');
  console.log('Next steps:');
  console.log('  To continue crawling: bun run scripts/wikiquote/crawl-categories-v2.ts');
  console.log('  To ingest quotes: bun run scripts/ingest.ts --source=wikiquote --tier=3');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
