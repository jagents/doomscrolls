#!/usr/bin/env node
import fs from 'fs';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import pg from 'pg';
import pkg from 'stream-json';
import streamArrayPkg from 'stream-json/streamers/StreamArray.js';

const { Pool } = pg;
const { parser } = pkg;
const { streamArray } = streamArrayPkg;

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Mappings
const authorNameToId = new Map();
const sourceIdToWorkId = new Map();

function slugify(text) {
  if (!text) return 'unknown';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'unknown';
}

async function loadExistingAuthors() {
  console.log('Loading existing authors from database...');
  const result = await pool.query('SELECT id, name FROM authors');
  for (const row of result.rows) {
    authorNameToId.set(row.name.toLowerCase(), row.id);
  }
  console.log(`  Loaded ${authorNameToId.size} existing authors`);
}

async function loadExistingWorks() {
  console.log('Loading existing works from database...');
  const result = await pool.query("SELECT id, source_id FROM works WHERE source = 'gutenberg'");
  for (const row of result.rows) {
    if (row.source_id) {
      sourceIdToWorkId.set(row.source_id, row.id);
    }
  }
  console.log(`  Loaded ${sourceIdToWorkId.size} existing gutenberg works`);
}

async function importPhase5bAuthors() {
  console.log('Importing phase5b authors...');
  const authors = JSON.parse(fs.readFileSync('data/gutenberg/phase5b-authors.json', 'utf-8'));

  let imported = 0;
  let skipped = 0;

  for (const author of authors) {
    const nameLower = author.name.toLowerCase();

    // Skip if already exists
    if (authorNameToId.has(nameLower)) {
      skipped++;
      continue;
    }

    const id = crypto.randomUUID();

    await pool.query(`
      INSERT INTO authors (id, name, slug, name_variants, birth_year, death_year,
        nationality, era, sources, source_ids, work_count, chunk_count, primary_genre, traditions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING
    `, [
      id,
      author.name,
      slugify(author.name),
      [],
      author.birth_year,
      author.death_year,
      null,
      null,
      ['gutenberg'],
      JSON.stringify({}),
      0,
      0,
      null,
      []
    ]);

    authorNameToId.set(nameLower, id);
    imported++;
  }

  console.log(`  Imported ${imported} new authors, skipped ${skipped} existing`);
}

async function importPhase5bWorks() {
  console.log('Importing phase5b works...');
  const works = JSON.parse(fs.readFileSync('data/gutenberg/phase5b-works.json', 'utf-8'));

  let imported = 0;
  let skipped = 0;

  for (const work of works) {
    // Skip if already exists
    if (sourceIdToWorkId.has(work.source_id)) {
      skipped++;
      continue;
    }

    const id = crypto.randomUUID();

    // Find author_id from first author name
    let authorId = null;
    if (work.authors && work.authors.length > 0) {
      const authorName = work.authors[0].toLowerCase();
      authorId = authorNameToId.get(authorName);
    }

    await pool.query(`
      INSERT INTO works (id, title, slug, author_id, year, language, original_language,
        translator, type, genre, subgenre, tradition, source, source_id, source_url,
        source_list, source_sublist, source_bookshelf, ingestion_phase, chunk_count, full_text_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (id) DO NOTHING
    `, [
      id,
      work.title,
      slugify(work.title),
      authorId,
      null,
      'en',
      null,
      null,
      null,
      null,
      null,
      null,
      'gutenberg',
      work.source_id,
      `https://www.gutenberg.org/ebooks/${work.source_id}`,
      null,
      null,
      null,
      'phase5b',
      work.chunk_count || 0,
      null
    ]);

    sourceIdToWorkId.set(work.source_id, id);
    imported++;

    if (imported % 500 === 0) {
      console.log(`  Progress: ${imported} works`);
    }
  }

  console.log(`  Imported ${imported} new works, skipped ${skipped} existing`);
}

async function importPhase5bChunks() {
  console.log('Importing phase5b chunks (streaming)...');

  const jsonStream = createReadStream('data/gutenberg/phase5b-chunks.json')
    .pipe(parser())
    .pipe(streamArray());

  let batch = [];
  let total = 0;
  let skipped = 0;
  const BATCH_SIZE = 1000;

  for await (const { value: chunk } of jsonStream) {
    // Look up work_id from source_id
    const workId = sourceIdToWorkId.get(chunk.source_id);

    if (!workId) {
      skipped++;
      continue;
    }

    // Transform chunk to match schema
    const transformedChunk = {
      id: crypto.randomUUID(),
      text: chunk.text,
      author_id: null, // Could look up from work, but not critical
      work_id: workId,
      type: null,
      position_index: chunk.chunk_index,
      source: 'gutenberg',
      source_chunk_id: `${chunk.source_id}-${chunk.chunk_index}`,
    };

    batch.push(transformedChunk);

    if (batch.length >= BATCH_SIZE) {
      await insertChunkBatch(batch);
      total += batch.length;
      batch = [];

      if (total % 100000 === 0) {
        console.log(`  Progress: ${(total / 1000000).toFixed(1)}M chunks (skipped: ${skipped.toLocaleString()})`);
        if (global.gc) global.gc();
      }
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await insertChunkBatch(batch);
    total += batch.length;
  }

  console.log(`  Imported ${total.toLocaleString()} chunks (skipped ${skipped.toLocaleString()} with missing work_id)`);
  return total;
}

async function insertChunkBatch(chunks) {
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    const placeholders = [];
    for (let i = 0; i < 9; i++) {
      placeholders.push(`$${paramIndex++}`);
    }
    values.push(`(${placeholders.join(', ')})`);

    params.push(
      chunk.id,
      chunk.text,
      chunk.author_id,
      chunk.work_id,
      chunk.type,
      chunk.position_index,
      chunk.source,
      chunk.source_chunk_id,
      null // char_count
    );
  }

  try {
    await pool.query(`
      INSERT INTO chunks (id, text, author_id, work_id, type, position_index,
        source, source_chunk_id, char_count)
      VALUES ${values.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, params);
  } catch (err) {
    console.error(`  Batch error: ${err.message}`);
  }
}

async function main() {
  console.log('=== Phase5b Import Fix ===\n');
  const start = Date.now();

  // Load existing data
  await loadExistingAuthors();
  await loadExistingWorks();

  // Import phase5b data
  await importPhase5bAuthors();
  await importPhase5bWorks();
  const chunksImported = await importPhase5bChunks();

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n=== Complete in ${elapsed} minutes ===`);

  // Verify counts
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM authors) as authors,
      (SELECT COUNT(*) FROM works) as works,
      (SELECT COUNT(*) FROM chunks) as chunks
  `);
  console.log('Final counts:', counts.rows[0]);

  // Show gutenberg breakdown
  const gutenbergCount = await pool.query(`
    SELECT COUNT(*) FROM chunks WHERE source = 'gutenberg'
  `);
  console.log('Gutenberg chunks:', gutenbergCount.rows[0].count);

  await pool.end();
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
