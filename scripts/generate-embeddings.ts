import 'dotenv/config';
import OpenAI from 'openai';
import pg from 'pg';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new pg.Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  max: 3  // Conservative connection pool
});

// =============================================================================
// CRANKED UP SETTINGS - 12GB RAM available, 264MB used
// =============================================================================
const BATCH_SIZE = 1000;            // Chunks per API call
const BATCHES_PER_CYCLE = 30;       // Process 30,000 chunks then pause
const PAUSE_BETWEEN_CYCLES = 500;   // 0.5 second pause between cycles
const PAUSE_BETWEEN_BATCHES = 25;   // 25ms between API calls
const MODEL = 'text-embedding-3-small';

// Rate limit tracking
let rateLimitHits = 0;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getUnembeddedChunks(limit: number): Promise<{ id: string; text: string }[]> {
  const result = await pool.query(`
    SELECT id, text
    FROM chunks
    WHERE embedding IS NULL
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
  // Batch update for efficiency
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
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as processed,
      COUNT(*) FILTER (WHERE embedding IS NULL) as remaining
    FROM chunks
  `);
  return {
    processed: parseInt(result.rows[0].processed),
    remaining: parseInt(result.rows[0].remaining)
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN PROCESSING LOOP
// =============================================================================

async function processCycle(): Promise<number> {
  let processedThisCycle = 0;

  for (let batch = 0; batch < BATCHES_PER_CYCLE; batch++) {
    // Get chunks without embeddings
    const chunks = await getUnembeddedChunks(BATCH_SIZE);

    if (chunks.length === 0) {
      console.log('No more chunks to process!');
      return processedThisCycle;
    }

    try {
      // Get embeddings from OpenAI - truncate text for safety
      const texts = chunks.map(c => c.text.substring(0, 8000));
      const embeddings = await embedBatch(texts);

      // Update database in a transaction
      await updateChunkEmbeddings(chunks, embeddings);

      processedThisCycle += chunks.length;

    } catch (error: any) {
      if (error?.status === 429) {
        rateLimitHits++;
        const retryAfter = error?.headers?.['retry-after'] || 60;
        console.log(`\n${'!'.repeat(60)}`);
        console.log(`RATE LIMITED (429) - Hit #${rateLimitHits}`);
        console.log(`Time: ${new Date().toISOString()}`);
        console.log(`Waiting ${retryAfter} seconds before retry...`);
        console.log(`${'!'.repeat(60)}\n`);
        await sleep(retryAfter * 1000);
      } else {
        console.error(`\nERROR: ${error.message || error}`);
        await sleep(5000);
      }
    }

    // Pause between batches
    await sleep(PAUSE_BETWEEN_BATCHES);
  }

  return processedThisCycle;
}

async function main() {
  console.log('='.repeat(60));
  console.log('DOOMSCROLLS EMBEDDING GENERATION');
  console.log('Started:', new Date().toISOString());
  console.log('='.repeat(60));

  // Initial progress
  const initial = await getProgress();
  console.log(`\nInitial state:`);
  console.log(`  Already embedded: ${initial.processed.toLocaleString()}`);
  console.log(`  Remaining: ${initial.remaining.toLocaleString()}`);

  if (initial.remaining === 0) {
    console.log('\nAll chunks already have embeddings!');
    await pool.end();
    return;
  }

  console.log(`\nSettings:`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Batches per cycle: ${BATCHES_PER_CYCLE}`);
  console.log(`  Pause between cycles: ${PAUSE_BETWEEN_CYCLES}ms`);
  console.log(`\nEstimated time: ${Math.ceil(initial.remaining / 1000 / 60)} hours`);
  console.log('\nStarting...\n');

  let totalProcessed = 0;
  let cycleCount = 0;
  const startTime = Date.now();

  while (true) {
    cycleCount++;
    const processedThisCycle = await processCycle();
    totalProcessed += processedThisCycle;

    if (processedThisCycle === 0) {
      break; // No more chunks
    }

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
    const rate = totalProcessed / elapsed; // chunks per minute
    const progress = await getProgress();
    const eta = progress.remaining / rate; // minutes remaining

    const etaHours = Math.floor(eta / 60);
    const etaMins = Math.round(eta % 60);
    const rateLimitStr = rateLimitHits > 0 ? ` | 429s: ${rateLimitHits}` : '';
    console.log(`[Cycle ${cycleCount}] +${processedThisCycle.toLocaleString()} = ${totalProcessed.toLocaleString()} | ` +
                `Left: ${progress.remaining.toLocaleString()} | ` +
                `${Math.round(rate)}/min | ` +
                `ETA: ${etaHours}h${etaMins}m${rateLimitStr}`);

    // Pause between cycles to let server breathe
    await sleep(PAUSE_BETWEEN_CYCLES);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE!');
  console.log(`Total processed: ${totalProcessed.toLocaleString()}`);
  console.log(`Time: ${Math.round((Date.now() - startTime) / 1000 / 60)} minutes`);
  console.log('='.repeat(60));

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
