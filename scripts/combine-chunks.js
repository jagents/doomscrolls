#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import pkg from 'stream-json';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

const { parser } = pkg;
const { streamArray } = streamArrayPkg;

const CHUNK_FILES = [
  'data/gutenberg/chunks.json',
  'data/gutenberg/phase5-chunks.json',
  'data/gutenberg/phase5b-chunks.json',
  'data/standardebooks/chunks.json',
  'data/wikiquote/chunks.json',
  'data/ccel/chunks.json',
  'data/newadvent/chunks.json',
  'data/bibletranslations/chunks.json',
  'data/bible/chunks.json',
  'data/perseus/chunks.json',
  'data/sacredtexts/chunks.json',
  'data/poetrydb/chunks.json',
];

async function processFile(filePath, outStream, isFirstChunk, totalCount) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${filePath} (not found)`);
      resolve({ isFirstChunk, totalCount });
      return;
    }

    const fileStream = createReadStream(filePath, { highWaterMark: 64 * 1024 });
    const jsonStream = fileStream.pipe(parser()).pipe(streamArray());

    const source = filePath.split('/')[1]; // gutenberg, wikiquote, etc.
    let fileCount = 0;
    let localIsFirst = isFirstChunk;
    let localTotal = totalCount;

    jsonStream.on('data', ({ value: chunk }) => {
      // Write comma if not first
      if (!localIsFirst) {
        outStream.write(',\n');
      }
      localIsFirst = false;

      // Add source if missing
      if (!chunk.source) chunk.source = source;

      // Write immediately - DO NOT ACCUMULATE
      outStream.write(JSON.stringify(chunk));

      fileCount++;
      localTotal++;

      // Progress every 500k
      if (localTotal % 500000 === 0) {
        console.log(`    Progress: ${(localTotal / 1000000).toFixed(1)}M chunks`);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    });

    jsonStream.on('end', () => {
      console.log(`  ✓ ${filePath}: ${fileCount.toLocaleString()} chunks`);
      resolve({ isFirstChunk: localIsFirst, totalCount: localTotal });
    });

    jsonStream.on('error', (err) => {
      console.error(`  ✗ Error in ${filePath}:`, err.message);
      resolve({ isFirstChunk: localIsFirst, totalCount: localTotal });
    });
  });
}

async function main() {
  console.log('=== Combining Chunks (Memory-Safe Streaming) ===\n');

  // Delete old file if exists
  const outPath = 'data/combined/chunks.json';
  if (fs.existsSync(outPath)) {
    fs.unlinkSync(outPath);
    console.log('Deleted old chunks.json\n');
  }

  const outStream = createWriteStream(outPath, { highWaterMark: 64 * 1024 });
  outStream.write('[\n');

  let isFirstChunk = true;
  let totalCount = 0;

  const startTime = Date.now();

  for (const file of CHUNK_FILES) {
    console.log(`Processing: ${file}`);
    const result = await processFile(file, outStream, isFirstChunk, totalCount);
    isFirstChunk = result.isFirstChunk;
    totalCount = result.totalCount;
  }

  outStream.write('\n]');
  outStream.end();

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`\n=== COMPLETE ===`);
  console.log(`Total chunks: ${totalCount.toLocaleString()}`);
  console.log(`Time: ${elapsed} minutes`);

  // Write DONE file
  fs.writeFileSync('data/combined/DONE.txt',
    `Combine complete\n` +
    `Finished: ${new Date().toISOString()}\n` +
    `Total chunks: ${totalCount.toLocaleString()}\n` +
    `Time: ${elapsed} minutes\n`
  );

  // Write stats
  const stats = {
    total_chunks: totalCount,
    generated_at: new Date().toISOString(),
    elapsed_minutes: parseFloat(elapsed)
  };
  fs.writeFileSync('data/combined/stats.json', JSON.stringify(stats, null, 2));

  console.log('\nWrote DONE.txt and stats.json');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
