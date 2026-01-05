// Cleanup script to remove failed texts from data files

import { readJson, writeJson } from '../../src/utils/files';
import type { Work, Chunk } from '../../src/types';

const DATA_DIR = './data/sacredtexts';
const TEXTS_TO_REMOVE = ['analects'];

async function cleanup() {
  console.log('Cleaning up failed texts...');

  // Read works
  const works = await readJson<Work[]>(`${DATA_DIR}/works.json`) ?? [];
  const chunks = await readJson<Chunk[]>(`${DATA_DIR}/chunks.json`) ?? [];

  // Get work IDs to remove
  const workIdsToRemove = new Set(
    works.filter(w => TEXTS_TO_REMOVE.includes(w.source_id || '')).map(w => w.id)
  );

  console.log(`Found ${workIdsToRemove.size} works to remove`);

  // Filter works
  const cleanWorks = works.filter(w => !TEXTS_TO_REMOVE.includes(w.source_id || ''));

  // Filter chunks
  const cleanChunks = chunks.filter(c => !workIdsToRemove.has(c.work_id || ''));

  console.log(`Works: ${works.length} -> ${cleanWorks.length}`);
  console.log(`Chunks: ${chunks.length} -> ${cleanChunks.length}`);

  // Write back
  await writeJson(`${DATA_DIR}/works.json`, cleanWorks);
  await writeJson(`${DATA_DIR}/chunks.json`, cleanChunks);

  console.log('Cleanup complete!');
}

cleanup().catch(console.error);
