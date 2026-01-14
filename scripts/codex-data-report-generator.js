#!/usr/bin/env node
// Read-only Neon DB summary for Doomscrolls data reporting.

const path = require('path');
const dotenv = require('dotenv');
const pg = require('pg');

dotenv.config({ path: path.join('/aiprojects/doomscrolls', '.env') });

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error('NEON_DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  max: 2,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM authors) AS authors,
        (SELECT COUNT(*) FROM works) AS works,
        (SELECT COUNT(*) FROM chunks) AS chunks,
        (SELECT COUNT(*) FROM chunk_stats) AS chunk_stats,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM curated_works) AS curated_works,
        (SELECT COUNT(*) FROM work_categories) AS work_categories
    `);

    const worksBySource = await client.query(`
      SELECT source, COUNT(*)::int AS works
      FROM works
      GROUP BY source
      ORDER BY works DESC
    `);

    const worksByPhase = await client.query(`
      SELECT ingestion_phase, COUNT(*)::int AS works
      FROM works
      GROUP BY ingestion_phase
      ORDER BY works DESC NULLS LAST
    `);

    const chunksBySource = await client.query(`
      SELECT source, COUNT(*)::int AS chunks
      FROM chunks
      GROUP BY source
      ORDER BY chunks DESC
    `);

    const chunksByType = await client.query(`
      SELECT type, COUNT(*)::int AS chunks
      FROM chunks
      GROUP BY type
      ORDER BY chunks DESC
    `);

    const chunkColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'chunks'
      ORDER BY ordinal_position
    `);

    const workColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'works'
      ORDER BY ordinal_position
    `);

    const authorColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'authors'
      ORDER BY ordinal_position
    `);

    console.log('\n=== Neon DB Counts ===');
    console.table(counts.rows[0]);

    console.log('\n=== Works by Source ===');
    console.table(worksBySource.rows);

    console.log('\n=== Works by Ingestion Phase ===');
    console.table(worksByPhase.rows);

    console.log('\n=== Chunks by Source ===');
    console.table(chunksBySource.rows);

    console.log('\n=== Chunks by Type ===');
    console.table(chunksByType.rows);

    console.log('\n=== chunks columns ===');
    console.table(chunkColumns.rows);

    console.log('\n=== works columns ===');
    console.table(workColumns.rows);

    console.log('\n=== authors columns ===');
    console.table(authorColumns.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
