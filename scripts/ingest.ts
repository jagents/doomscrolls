#!/usr/bin/env bun
// Main CLI runner for Doomscrolls ingestion pipeline

import { ingestPoetryDB } from './ingest-poetrydb';
import { ingestBible } from './ingest-bible';
import { ingestWikiquote } from './wikiquote/ingest-wikiquote';
import { combine } from './combine';

type Source = 'poetrydb' | 'bible' | 'wikiquote' | 'combine';

function parseArgs(): { source?: Source; all: boolean; tier?: number; limit?: number } {
  const args = process.argv.slice(2);
  let source: Source | undefined;
  let all = false;
  let tier: number | undefined;
  let limit: number | undefined;

  for (const arg of args) {
    if (arg === '--all') {
      all = true;
    } else if (arg.startsWith('--source=')) {
      source = arg.split('=')[1] as Source;
    } else if (arg.startsWith('--tier=')) {
      tier = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    }
  }

  return { source, all, tier, limit };
}

function printUsage(): void {
  console.log(`
Doomscrolls Data Ingestion Pipeline

Usage:
  bun run scripts/ingest.ts --source=<source>  Run a specific source
  bun run scripts/ingest.ts --all              Run all sources in order

Sources:
  poetrydb   - Fetch poems from PoetryDB API
  bible      - Fetch KJV Bible from Bible API
  wikiquote  - Scrape quotes from Wikiquote
  combine    - Merge all sources into combined dataset

Wikiquote Options:
  --tier=1   - Original 70 curated authors only
  --tier=2   - Expanded 135 authors only (Phase 2A)
  --tier=3   - Category-crawled authors only (Phase 3)
  (no tier)  - All tiers (1 + 2 + 3)
  --limit=N  - Limit to first N authors (useful for testing)

Examples:
  bun run scripts/ingest.ts --source=poetrydb
  bun run scripts/ingest.ts --source=wikiquote --tier=2
  bun run scripts/ingest.ts --source=wikiquote --tier=3 --limit=10
  bun run scripts/ingest.ts --all
`);
}

async function runSource(source: Source, tier?: number, limit?: number): Promise<void> {
  switch (source) {
    case 'poetrydb':
      await ingestPoetryDB();
      break;
    case 'bible':
      await ingestBible();
      break;
    case 'wikiquote':
      await ingestWikiquote(tier, limit);
      break;
    case 'combine':
      await combine();
      break;
    default:
      console.error(`Unknown source: ${source}`);
      process.exit(1);
  }
}

async function runAll(): Promise<void> {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('DOOMSCROLLS DATA INGESTION PIPELINE');
  console.log('='.repeat(60));
  console.log();

  // Run each source in order
  console.log('[1/4] PoetryDB');
  console.log('-'.repeat(40));
  const poetryStats = await ingestPoetryDB();
  console.log();

  console.log('[2/4] Bible');
  console.log('-'.repeat(40));
  const bibleStats = await ingestBible();
  console.log();

  console.log('[3/4] Wikiquote');
  console.log('-'.repeat(40));
  const wikiquoteStats = await ingestWikiquote();
  console.log();

  console.log('[4/4] Combine');
  console.log('-'.repeat(40));
  const combineStats = await combine();
  console.log();

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('='.repeat(60));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log(`Duration: ${duration} minutes`);
  console.log();
  console.log('Source Statistics:');
  console.log(`  PoetryDB:  ${poetryStats.authors} authors, ${poetryStats.works} poems`);
  console.log(`  Bible:     ${bibleStats.books} books, ${bibleStats.verses} verses`);
  console.log(`  Wikiquote: ${wikiquoteStats.newAuthors} new authors, ${wikiquoteStats.newQuotes} new quotes`);
  console.log();
  console.log('Combined Dataset:');
  console.log(`  ${combineStats.totalAuthors} unique authors`);
  console.log(`  ${combineStats.totalWorks} works`);
  console.log(`  ${combineStats.totalChunks} total chunks`);
  console.log();
  console.log('Data saved to: ./data/combined/');
}

async function main(): Promise<void> {
  const { source, all, tier, limit } = parseArgs();

  if (all) {
    await runAll();
  } else if (source) {
    await runSource(source, tier, limit);
  } else {
    printUsage();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
