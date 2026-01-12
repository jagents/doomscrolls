#!/usr/bin/env node
import fs from 'fs';
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

// Generate slug from name
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

// Load valid work IDs to filter chunks
let validWorkIds = new Set();

async function clearTables() {
  console.log('Clearing existing data...');
  await pool.query('TRUNCATE chunks, works, authors CASCADE');
  console.log('  Tables cleared');
}

async function loadValidWorkIds() {
  console.log('Loading valid work IDs from database...');
  const result = await pool.query('SELECT id FROM works');
  for (const row of result.rows) {
    validWorkIds.add(row.id);
  }
  console.log(`  Loaded ${validWorkIds.size} valid work IDs`);
}

async function importAuthors() {
  console.log('Importing authors...');
  const authors = JSON.parse(fs.readFileSync('data/combined/authors.json', 'utf-8'));

  let count = 0;
  for (const author of authors) {
    await pool.query(`
      INSERT INTO authors (id, name, slug, name_variants, birth_year, death_year,
        nationality, era, sources, source_ids, work_count, chunk_count, primary_genre, traditions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING
    `, [
      author.id,
      author.name,
      author.slug || slugify(author.name),
      author.name_variants || author.aliases || [],
      author.birth_year,
      author.death_year,
      author.nationality,
      author.era,
      author.sources ? (Array.isArray(author.sources) ? author.sources : [author.sources]) : [],
      JSON.stringify(author.source_ids || {}),
      author.work_count || 0,
      author.chunk_count || 0,
      author.primary_genre || author.genre,
      author.traditions || []
    ]);
    count++;
    if (count % 1000 === 0) {
      console.log(`  Progress: ${count} authors`);
    }
  }
  console.log(`  Imported ${authors.length} authors`);
}

async function importWorks() {
  console.log('Importing works...');
  const works = JSON.parse(fs.readFileSync('data/combined/works.json', 'utf-8'));

  let count = 0;
  for (const work of works) {
    await pool.query(`
      INSERT INTO works (id, title, slug, author_id, year, language, original_language,
        translator, type, genre, subgenre, tradition, source, source_id, source_url,
        source_list, source_sublist, source_bookshelf, ingestion_phase, chunk_count, full_text_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (id) DO NOTHING
    `, [
      work.id,
      work.title,
      work.slug || slugify(work.title),
      work.author_id,
      work.year || work.publication_year,
      work.language || 'en',
      work.original_language,
      work.translator,
      work.type || work.form,
      work.genre,
      work.subgenre,
      work.tradition,
      work.source,
      work.source_id,
      work.source_url,
      work.source_list,
      work.source_sublist,
      work.source_bookshelf,
      work.ingestion_phase,
      work.chunk_count || 0,
      work.full_text_url
    ]);
    count++;
    if (count % 1000 === 0) {
      console.log(`  Progress: ${count} works`);
    }
  }
  console.log(`  Imported ${works.length} works`);
}

async function importChunks() {
  console.log('Importing chunks (streaming)...');

  const jsonStream = createReadStream('data/combined/chunks.json')
    .pipe(parser())
    .pipe(streamArray());

  let batch = [];
  let total = 0;
  let skipped = 0;
  const BATCH_SIZE = 1000;

  for await (const { value: chunk } of jsonStream) {
    // Skip chunks with missing work_id
    if (!chunk.work_id || !validWorkIds.has(chunk.work_id)) {
      skipped++;
      continue;
    }

    batch.push(chunk);

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
}

async function insertChunkBatch(chunks) {
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    const placeholders = [];
    for (let i = 0; i < 17; i++) {
      placeholders.push(`$${paramIndex++}`);
    }
    values.push(`(${placeholders.join(', ')})`);

    params.push(
      chunk.id,
      chunk.content || chunk.text,
      chunk.author_id,
      chunk.work_id,
      chunk.chunk_type || chunk.type,
      chunk.chunk_index ?? chunk.sequence ?? chunk.position_index,
      chunk.chapter || chunk.position_chapter,
      chunk.section || chunk.position_section,
      chunk.paragraph || chunk.position_paragraph,
      chunk.book || chunk.position_book,
      chunk.source,
      chunk.source_chunk_id,
      chunk.bible_translation,
      chunk.bible_book,
      chunk.bible_chapter,
      chunk.char_count,
      chunk.word_count
    );
  }

  try {
    await pool.query(`
      INSERT INTO chunks (id, text, author_id, work_id, type, position_index,
        position_chapter, position_section, position_paragraph, position_book,
        source, source_chunk_id, bible_translation, bible_book, bible_chapter,
        char_count, word_count)
      VALUES ${values.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `, params);
  } catch (err) {
    console.error(`  Batch error: ${err.message}`);
  }
}

async function main() {
  console.log('=== Starting Import ===\n');
  const start = Date.now();

  await clearTables();
  await importAuthors();
  await importWorks();
  await loadValidWorkIds();
  await importChunks();

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

  await pool.end();
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
