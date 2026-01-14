#!/usr/bin/env node
// MVP low-risk augmentation: additive metadata + hash/QA tables (no changes to core text tables).

const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const pg = require('pg');

dotenv.config({ path: path.join('/aiprojects/doomscrolls', '.env') });

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error('NEON_DATABASE_URL is not set in .env');
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_WORKS = args.has('--skip-works');
const SKIP_HASH = args.has('--skip-hash');
const SKIP_QA = args.has('--skip-qa');
const BATCH_SIZE = parseInt(getArgValue('--batch-size') || '2000', 10);
const MIN_LEN = parseInt(getArgValue('--min-length') || '10', 10);
const MAX_LEN = parseInt(getArgValue('--max-length') || '5000', 10);

const pool = new pg.Pool({
  connectionString,
  max: 2,
  ssl: { rejectUnauthorized: false },
});

function getArgValue(flag) {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(flag + '=')) {
      return arg.split('=')[1];
    }
  }
  return null;
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sourceUrl(source, sourceId) {
  if (!sourceId) return null;
  switch (source) {
    case 'gutenberg':
      return `https://www.gutenberg.org/ebooks/${sourceId}`;
    case 'standardebooks':
      return `https://standardebooks.org/ebooks/${sourceId}`;
    case 'wikiquote':
      return `https://en.wikiquote.org/wiki/${sourceId}`;
    case 'perseus':
      return `https://www.perseus.tufts.edu/hopper/text?doc=${sourceId}`;
    case 'ccel':
      return `https://www.ccel.org/${sourceId}`;
    case 'sacredtexts':
      return `https://www.sacred-texts.com/${sourceId}`;
    case 'newadvent':
      return `https://www.newadvent.org/fathers/${sourceId}.htm`;
    case 'bible':
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(sourceId)}`;
    case 'bible-api':
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(sourceId)}`;
    default:
      return null;
  }
}

function editionLabel(source, title, sourceId) {
  if (source === 'bible') return 'KJV';
  if (source === 'bible-api') {
    const match = /\(([^)]+)\)\s*$/.exec(title || '');
    if (match) return match[1];
  }
  if (source === 'perseus') return 'Perseus';
  if (source === 'standardebooks') return 'Standard Ebooks';
  if (source === 'gutenberg') return 'Gutenberg';
  if (source === 'ccel') return 'CCEL';
  if (source === 'sacredtexts') return 'Sacred Texts';
  if (source === 'newadvent') return 'New Advent';
  if (source === 'wikiquote') return 'Wikiquote';
  if (source === 'poetrydb') return 'PoetryDB';
  return source || null;
}

function rightsBasis(source) {
  if (['gutenberg','standardebooks','bible','bible-api','perseus','ccel','sacredtexts','newadvent'].includes(source)) {
    return 'pd_assumed';
  }
  if (['wikiquote','poetrydb'].includes(source)) {
    return 'unknown';
  }
  return 'unknown';
}

async function ensureTables(client) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Skipping table creation');
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS work_metadata_aug (
      work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
      rights_basis TEXT,
      takedown_status TEXT,
      edition_label TEXT,
      edition_source TEXT,
      source_url TEXT,
      full_text_url TEXT,
      canonical_work_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS chunk_hashes (
      chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
      hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS qa_flags (
      id BIGSERIAL PRIMARY KEY,
      chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
      issue TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (chunk_id, issue)
    );
  `);
}

async function backfillWorks(client) {
  if (SKIP_WORKS) {
    console.log('[Skip] Work metadata backfill');
    return;
  }

  const worksRes = await client.query(`SELECT id, author_id, title, source, source_id FROM works`);
  const authorRes = await client.query(`SELECT id, name FROM authors`);
  const authorMap = new Map(authorRes.rows.map(r => [r.id, r.name || '']));

  // Build canonical map (obvious duplicates by normalized title+author name)
  const canonicalMap = new Map();
  for (const w of worksRes.rows) {
    const authorName = (authorMap.get(w.author_id) || '').toLowerCase().trim();
    const title = (w.title || '').toLowerCase().trim();
    const key = `${authorName}::${title}`;
    if (!canonicalMap.has(key)) canonicalMap.set(key, w.id);
  }

  const total = worksRes.rows.length;
  let processed = 0;
  const start = Date.now();

  for (const w of worksRes.rows) {
    const authorName = (authorMap.get(w.author_id) || '').toLowerCase().trim();
    const title = (w.title || '').toLowerCase().trim();
    const key = `${authorName}::${title}`;
    const canonicalId = canonicalMap.get(key);

    const sourceUrlValue = sourceUrl(w.source, w.source_id);
    const fullTextUrlValue = sourceUrlValue;
    const editionLabelValue = editionLabel(w.source, w.title, w.source_id);

    const payload = {
      work_id: w.id,
      rights_basis: rightsBasis(w.source),
      takedown_status: 'active',
      edition_label: editionLabelValue,
      edition_source: w.source,
      source_url: sourceUrlValue,
      full_text_url: fullTextUrlValue,
      canonical_work_id: canonicalId,
    };

    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO work_metadata_aug (
          work_id, rights_basis, takedown_status, edition_label, edition_source,
          source_url, full_text_url, canonical_work_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (work_id) DO UPDATE SET
          rights_basis = COALESCE(work_metadata_aug.rights_basis, EXCLUDED.rights_basis),
          takedown_status = COALESCE(work_metadata_aug.takedown_status, EXCLUDED.takedown_status),
          edition_label = COALESCE(work_metadata_aug.edition_label, EXCLUDED.edition_label),
          edition_source = COALESCE(work_metadata_aug.edition_source, EXCLUDED.edition_source),
          source_url = COALESCE(work_metadata_aug.source_url, EXCLUDED.source_url),
          full_text_url = COALESCE(work_metadata_aug.full_text_url, EXCLUDED.full_text_url),
          canonical_work_id = COALESCE(work_metadata_aug.canonical_work_id, EXCLUDED.canonical_work_id),
          updated_at = NOW()
      `, [
        payload.work_id,
        payload.rights_basis,
        payload.takedown_status,
        payload.edition_label,
        payload.edition_source,
        payload.source_url,
        payload.full_text_url,
        payload.canonical_work_id,
      ]);
    }

    processed++;
    if (processed % 1000 === 0 || processed === total) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = processed / (elapsed || 1);
      const pct = ((processed / total) * 100).toFixed(1);
      console.log(`[Work metadata] ${processed}/${total} (${pct}%) | ${rate.toFixed(1)}/s`);
    }
  }
}

async function backfillChunkHashes(client) {
  if (SKIP_HASH) {
    console.log('[Skip] Chunk hash backfill');
    return;
  }

  const totalRes = await client.query('SELECT COUNT(*)::int AS total FROM chunks');
  const total = totalRes.rows[0].total || 0;

  let lastId = '';
  let processed = 0;
  const start = Date.now();

  while (true) {
    const res = await client.query(`
      SELECT id, text
      FROM chunks
      WHERE id > $1
      ORDER BY id
      LIMIT $2
    `, [lastId, BATCH_SIZE]);

    if (res.rows.length === 0) break;

    const values = [];
    const params = [];
    let idx = 1;
    for (const row of res.rows) {
      const norm = normalizeText(row.text);
      const hash = sha256(norm);
      values.push(`($${idx++}, $${idx++})`);
      params.push(row.id, hash);
    }

    if (!DRY_RUN) {
      await client.query(`
        INSERT INTO chunk_hashes (chunk_id, hash)
        VALUES ${values.join(', ')}
        ON CONFLICT (chunk_id) DO NOTHING
      `, params);
    }

    processed += res.rows.length;
    lastId = res.rows[res.rows.length - 1].id;

    const elapsed = (Date.now() - start) / 1000;
    const rate = processed / (elapsed || 1);
    const pct = ((processed / total) * 100).toFixed(1);
    const eta = rate > 0 ? ((total - processed) / rate) : 0;
    console.log(`[Chunk hash] ${processed}/${total} (${pct}%) | ${rate.toFixed(1)}/s | ETA ${formatSeconds(eta)}`);
  }
}

async function runQaFlags(client) {
  if (SKIP_QA) {
    console.log('[Skip] QA flags');
    return;
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] Skipping QA inserts');
    return;
  }

  await client.query(`
    INSERT INTO qa_flags (chunk_id, issue, details)
    SELECT id, 'too_short', 'char_count < ${MIN_LEN}'
    FROM chunks
    WHERE COALESCE(char_count, LENGTH(text)) < $1
    ON CONFLICT (chunk_id, issue) DO NOTHING
  `, [MIN_LEN]);

  await client.query(`
    INSERT INTO qa_flags (chunk_id, issue, details)
    SELECT id, 'too_long', 'char_count > ${MAX_LEN}'
    FROM chunks
    WHERE COALESCE(char_count, LENGTH(text)) > $1
    ON CONFLICT (chunk_id, issue) DO NOTHING
  `, [MAX_LEN]);

  await client.query(`
    INSERT INTO qa_flags (chunk_id, issue, details)
    SELECT id, 'empty_text', 'text is empty'
    FROM chunks
    WHERE LENGTH(COALESCE(text, '')) = 0
    ON CONFLICT (chunk_id, issue) DO NOTHING
  `);

  console.log('[QA] Flags inserted (too_short, too_long, empty_text)');
}

function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${r}s`;
  return `${r}s`;
}

async function main() {
  console.log('=== Doomscrolls MVP DB Augmentation (additive) ===');
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Min length: ${MIN_LEN}, Max length: ${MAX_LEN}`);

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await backfillWorks(client);
    await backfillChunkHashes(client);
    await runQaFlags(client);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
