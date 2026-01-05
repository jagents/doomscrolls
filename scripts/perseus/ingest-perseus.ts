#!/usr/bin/env bun
// Main Perseus ingestion script
// Processes Greek and Roman classics from Perseus Digital Library

import { join, dirname } from "path";
import { generateId, getTimestamp } from "../../src/utils/ids";
import { createSlug } from "../../src/utils/slugs";
import { writeJson, readJson, ensureDir } from "../../src/utils/files";
import { ALL_TEXTS, getUniqueAuthors, type TextConfig } from "./texts-config";
import { parseTEI, testParseTEI } from "./parse-tei";
import { chunkText, type ChunkResult } from "./chunk-by-type";
import type { Author, Work, Chunk } from "../../src/types";

// Paths
const DATA_DIR = join(import.meta.dir, "../../data/perseus");
const REPOS_DIR = join(DATA_DIR, "repos");
const PROGRESS_PATH = join(DATA_DIR, ".progress.json");
const PROGRESS_MD_PATH = join(DATA_DIR, "progress.md");

// Progress tracking
interface Progress {
  completed: string[];
  failed: string[];
  startTime: string;
  lastUpdated: string;
  stats: {
    textsProcessed: number;
    totalChunks: number;
  };
}

async function loadProgress(): Promise<Progress> {
  const existing = await readJson<Progress>(PROGRESS_PATH);
  if (existing) return existing;
  return {
    completed: [],
    failed: [],
    startTime: getTimestamp(),
    lastUpdated: getTimestamp(),
    stats: { textsProcessed: 0, totalChunks: 0 },
  };
}

async function saveProgress(progress: Progress): Promise<void> {
  progress.lastUpdated = getTimestamp();
  await writeJson(PROGRESS_PATH, progress);
}

async function updateProgressMd(
  progress: Progress,
  authors: Author[],
  works: Work[],
  chunks: Chunk[],
  currentText?: string
): Promise<void> {
  const total = ALL_TEXTS.length;
  const completed = progress.completed.length;
  const pct = Math.round((completed / total) * 100);

  let content = `# Perseus Ingestion Progress

**Started:** ${progress.startTime}
**Last Updated:** ${progress.lastUpdated}

## Summary
- Texts: ${completed} / ${total} (${pct}%)
- Authors: ${authors.length}
- Works: ${works.length}
- Passages extracted: ${chunks.length}

## Completed
`;

  // Group completed by author
  const byAuthor = new Map<string, { title: string; chunks: number }[]>();
  for (const textId of progress.completed) {
    const config = ALL_TEXTS.find((t) => t.id === textId);
    if (!config) continue;

    const work = works.find((w) => w.source_id === `${config.authorId}.${config.workId}`);
    const workChunks = chunks.filter((c) => c.work_id === work?.id);

    if (!byAuthor.has(config.author)) {
      byAuthor.set(config.author, []);
    }
    byAuthor.get(config.author)!.push({
      title: config.title,
      chunks: workChunks.length,
    });
  }

  for (const [author, works] of byAuthor) {
    for (const work of works) {
      content += `- ${author} - ${work.title} - ${work.chunks} passages\n`;
    }
  }

  if (currentText) {
    content += `\n## In Progress\n- ${currentText}...\n`;
  }

  if (progress.failed.length > 0) {
    content += `\n## Failed\n`;
    for (const textId of progress.failed) {
      const config = ALL_TEXTS.find((t) => t.id === textId);
      if (config) {
        content += `- ${config.author} - ${config.title}\n`;
      }
    }
  }

  await Bun.write(PROGRESS_MD_PATH, content);
}

// Create author record
function createAuthor(config: TextConfig, existingAuthors: Map<string, Author>): Author {
  const existing = existingAuthors.get(config.authorId);
  if (existing) return existing;

  const author: Author = {
    id: generateId(),
    name: config.author,
    slug: createSlug(config.author),
    birth_year: config.birthYear ?? null,
    death_year: config.deathYear ?? null,
    nationality: config.nationality,
    era: config.era,
    bio: null,
    wikipedia_url: null,
    created_at: getTimestamp(),
  };

  existingAuthors.set(config.authorId, author);
  return author;
}

// Create work record
function createWork(config: TextConfig, authorId: string): Work {
  return {
    id: generateId(),
    author_id: authorId,
    title: config.title,
    slug: createSlug(config.title),
    original_language: config.language,
    publication_year: null,
    genre: config.genre,
    form: config.form,
    source: "perseus",
    source_id: `${config.authorId}.${config.workId}`,
    created_at: getTimestamp(),
  };
}

// Create chunk records from parsed content
function createChunks(
  chunkResults: ChunkResult[],
  workId: string,
  authorId: string
): Chunk[] {
  return chunkResults.map((result, index) => ({
    id: generateId(),
    work_id: workId,
    author_id: authorId,
    content: result.content,
    chunk_index: index,
    chunk_type: result.chunkType,
    source: "perseus",
    source_metadata: result.metadata,
    created_at: getTimestamp(),
  }));
}

// Process a single text
async function processText(
  config: TextConfig,
  authors: Map<string, Author>,
  works: Work[],
  chunks: Chunk[]
): Promise<{ work: Work; chunks: Chunk[] } | null> {
  const filePath = join(REPOS_DIR, config.translationPath);

  // Check if file exists and is parseable
  const canParse = await testParseTEI(filePath);
  if (!canParse) {
    console.log(`  [SKIP] File not found or unparseable: ${config.translationPath}`);
    return null;
  }

  try {
    // Parse the TEI XML
    const parsed = await parseTEI(filePath, config);

    if (parsed.sections.length === 0) {
      console.log(`  [SKIP] No content extracted from: ${config.title}`);
      return null;
    }

    // Get or create author
    const author = createAuthor(config, authors);

    // Create work
    const work = createWork(config, author.id);
    works.push(work);

    // Chunk the text
    const chunkResults = chunkText(parsed, config);

    // Create chunk records
    const newChunks = createChunks(chunkResults, work.id, author.id);
    chunks.push(...newChunks);

    console.log(`  [OK] ${config.author} - ${config.title}: ${newChunks.length} passages`);

    return { work, chunks: newChunks };
  } catch (error) {
    console.log(`  [ERROR] ${config.title}: ${error}`);
    return null;
  }
}

// Main ingestion function
async function main() {
  console.log("Perseus Digital Library Ingestion");
  console.log("=".repeat(50));

  // Ensure data directory exists
  await ensureDir(join(DATA_DIR, "authors.json"));

  // Load progress
  const progress = await loadProgress();
  console.log(`\nResuming from ${progress.completed.length} completed texts\n`);

  // Track all data
  const authorMap = new Map<string, Author>();
  const works: Work[] = [];
  const chunks: Chunk[] = [];

  // Load existing data if resuming
  const existingAuthors = await readJson<Author[]>(join(DATA_DIR, "authors.json"));
  const existingWorks = await readJson<Work[]>(join(DATA_DIR, "works.json"));
  const existingChunks = await readJson<Chunk[]>(join(DATA_DIR, "chunks.json"));

  if (existingAuthors) {
    for (const author of existingAuthors) {
      // Find the config that matches this author
      for (const config of ALL_TEXTS) {
        if (config.author === author.name) {
          authorMap.set(config.authorId, author);
          break;
        }
      }
    }
  }
  if (existingWorks) works.push(...existingWorks);
  if (existingChunks) chunks.push(...existingChunks);

  // Filter texts that need processing
  const textsToProcess = ALL_TEXTS.filter(
    (t) => !progress.completed.includes(t.id) && !progress.failed.includes(t.id)
  );

  console.log(`Processing ${textsToProcess.length} texts...\n`);

  // Process each text
  for (const config of textsToProcess) {
    console.log(`Processing: ${config.author} - ${config.title} (Tier ${config.tier})`);

    // Update progress.md with current text
    await updateProgressMd(
      progress,
      Array.from(authorMap.values()),
      works,
      chunks,
      `${config.author} - ${config.title}`
    );

    const result = await processText(config, authorMap, works, chunks);

    if (result) {
      progress.completed.push(config.id);
      progress.stats.textsProcessed++;
      progress.stats.totalChunks = chunks.length;
    } else {
      progress.failed.push(config.id);
    }

    // Save progress after each text
    await saveProgress(progress);

    // Save data periodically (every 5 texts)
    if (progress.completed.length % 5 === 0) {
      await writeJson(join(DATA_DIR, "authors.json"), Array.from(authorMap.values()));
      await writeJson(join(DATA_DIR, "works.json"), works);
      await writeJson(join(DATA_DIR, "chunks.json"), chunks);
    }
  }

  // Final save
  const finalAuthors = Array.from(authorMap.values());
  await writeJson(join(DATA_DIR, "authors.json"), finalAuthors);
  await writeJson(join(DATA_DIR, "works.json"), works);
  await writeJson(join(DATA_DIR, "chunks.json"), chunks);

  // Update final progress
  await updateProgressMd(progress, finalAuthors, works, chunks);

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("INGESTION COMPLETE");
  console.log("=".repeat(50));
  console.log(`Authors: ${finalAuthors.length}`);
  console.log(`Works: ${works.length}`);
  console.log(`Passages: ${chunks.length}`);
  console.log(`Completed: ${progress.completed.length}`);
  console.log(`Failed: ${progress.failed.length}`);

  // Create DONE.txt
  const doneContent = `Perseus ingestion complete
Finished: ${getTimestamp()}
Texts: ${works.length}
Passages: ${chunks.length}
Authors: ${finalAuthors.length}
`;
  await Bun.write(join(DATA_DIR, "DONE.txt"), doneContent);

  console.log("\nDONE.txt created.");
}

// Run
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
