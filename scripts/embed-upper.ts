import 'dotenv/config';
import OpenAI from 'openai';
import pg from 'pg';

const WORKER_NAME = 'UPPER';
const ID_FILTER = "id >= '7c2ca8ca-d5ab-4312-9c28-edc3a6b05c03'";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  max: 3
});

// =============================================================================
// PARALLEL SETTINGS
// =============================================================================
const BATCH_SIZE = 250;
const BATCHES_PER_CYCLE = 20;
const PAUSE_BETWEEN_CYCLES = 1000;
const PAUSE_BETWEEN_BATCHES = 100;
const MODEL = 'text-embedding-3-small';

let rateLimitHits = 0;

async function getUnembeddedChunks(limit: number): Promise<{ id: string; text: string }[]> {
  const result = await pool.query(`
    SELECT id, text
    FROM chunks
    WHERE embedding IS NULL AND ${ID_FILTER}
    ORDER BY id
    LIMIT $1
  `, [limit]);
  return result.rows;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

async function updateChunkEmbeddings(chunks: { id: string }[], embeddings: number[][]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < chunks.length; i++) {
      await client.query(`
        UPDATE chunks
        SET embedding = $1::vector,
            embedding_model = $2,
            embedded_at = NOW()
        WHERE id = $3
      `, [JSON.stringify(embeddings[i]), MODEL, chunks[i].id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getProgress(): Promise<{ processed: number; remaining: number }> {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE embedding IS NOT NULL AND ${ID_FILTER}) as processed,
      COUNT(*) FILTER (WHERE embedding IS NULL AND ${ID_FILTER}) as remaining
    FROM chunks
    WHERE ${ID_FILTER}
  `);
  return {
    processed: parseInt(result.rows[0].processed),
    remaining: parseInt(result.rows[0].remaining)
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processCycle(): Promise<number> {
  let processedThisCycle = 0;

  for (let batch = 0; batch < BATCHES_PER_CYCLE; batch++) {
    const chunks = await getUnembeddedChunks(BATCH_SIZE);

    if (chunks.length === 0) {
      console.log(`[${WORKER_NAME}] No more chunks to process!`);
      return processedThisCycle;
    }

    try {
      const texts = chunks.map(c => c.text.substring(0, 8000));
      const embeddings = await embedBatch(texts);
      await updateChunkEmbeddings(chunks, embeddings);
      processedThisCycle += chunks.length;
    } catch (error: any) {
      if (error?.status === 429) {
        rateLimitHits++;
        const retryAfter = error?.headers?.['retry-after'] || 60;
        console.log(`[${WORKER_NAME}] RATE LIMITED (429) #${rateLimitHits} - waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
      } else {
        console.error(`[${WORKER_NAME}] ERROR: ${error.message || error}`);
        await sleep(5000);
      }
    }

    await sleep(PAUSE_BETWEEN_BATCHES);
  }

  return processedThisCycle;
}

async function main() {
  console.log('='.repeat(60));
  console.log(`EMBEDDING WORKER: ${WORKER_NAME}`);
  console.log(`Filter: ${ID_FILTER}`);
  console.log('Started:', new Date().toISOString());
  console.log('='.repeat(60));

  const initial = await getProgress();
  console.log(`\n[${WORKER_NAME}] Initial: ${initial.processed.toLocaleString()} done, ${initial.remaining.toLocaleString()} remaining`);

  if (initial.remaining === 0) {
    console.log(`[${WORKER_NAME}] All chunks in range already have embeddings!`);
    await pool.end();
    return;
  }

  console.log(`[${WORKER_NAME}] Settings: batch=${BATCH_SIZE}, pause=${PAUSE_BETWEEN_BATCHES}ms\n`);

  let totalProcessed = 0;
  let cycleCount = 0;
  const startTime = Date.now();

  while (true) {
    cycleCount++;
    const processedThisCycle = await processCycle();
    totalProcessed += processedThisCycle;

    if (processedThisCycle === 0) break;

    const elapsed = (Date.now() - startTime) / 1000 / 60;
    const rate = totalProcessed / elapsed;
    const progress = await getProgress();
    const eta = progress.remaining / rate;
    const etaHours = Math.floor(eta / 60);
    const etaMins = Math.round(eta % 60);
    const rlStr = rateLimitHits > 0 ? ` | 429s:${rateLimitHits}` : '';

    console.log(`[${WORKER_NAME} C${cycleCount}] +${processedThisCycle} = ${totalProcessed.toLocaleString()} | Left: ${progress.remaining.toLocaleString()} | ${Math.round(rate)}/min | ETA: ${etaHours}h${etaMins}m${rlStr}`);

    await sleep(PAUSE_BETWEEN_CYCLES);
    if (global.gc) global.gc();
  }

  console.log(`\n[${WORKER_NAME}] COMPLETE! Total: ${totalProcessed.toLocaleString()} in ${Math.round((Date.now() - startTime) / 1000 / 60)} min`);
  await pool.end();
}

main().catch(err => {
  console.error(`[${WORKER_NAME}] Fatal:`, err);
  process.exit(1);
});
