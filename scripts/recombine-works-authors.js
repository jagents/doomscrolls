#!/usr/bin/env node
import fs from 'fs';

const SOURCES = [
  'data/gutenberg',
  'data/standardebooks',
  'data/wikiquote',
  'data/ccel',
  'data/newadvent',
  'data/bibletranslations',
  'data/bible',
  'data/perseus',
  'data/sacredtexts',
  'data/poetrydb',
];

// For phase5b which has separate files
const EXTRA_FILES = [
  { authors: 'data/gutenberg/phase5b-authors.json', works: 'data/gutenberg/phase5b-works.json' }
];

async function main() {
  console.log('=== Re-combining Authors and Works from Sources ===\n');

  const allAuthors = new Map();
  const allWorks = new Map();

  // Process main source directories
  for (const dir of SOURCES) {
    const authorsFile = `${dir}/authors.json`;
    const worksFile = `${dir}/works.json`;

    if (fs.existsSync(authorsFile)) {
      const authors = JSON.parse(fs.readFileSync(authorsFile, 'utf-8'));
      console.log(`${dir}/authors.json: ${authors.length} authors`);
      for (const a of authors) {
        if (a.id && !allAuthors.has(a.id)) {
          allAuthors.set(a.id, a);
        }
      }
    }

    if (fs.existsSync(worksFile)) {
      const works = JSON.parse(fs.readFileSync(worksFile, 'utf-8'));
      console.log(`${dir}/works.json: ${works.length} works`);
      for (const w of works) {
        if (w.id && !allWorks.has(w.id)) {
          allWorks.set(w.id, w);
        }
      }
    }
  }

  // Process extra files (phase5b)
  for (const extra of EXTRA_FILES) {
    if (fs.existsSync(extra.authors)) {
      const authors = JSON.parse(fs.readFileSync(extra.authors, 'utf-8'));
      console.log(`${extra.authors}: ${authors.length} authors`);
      for (const a of authors) {
        if (a.id && !allAuthors.has(a.id)) {
          allAuthors.set(a.id, a);
        }
      }
    }

    if (fs.existsSync(extra.works)) {
      const works = JSON.parse(fs.readFileSync(extra.works, 'utf-8'));
      console.log(`${extra.works}: ${works.length} works`);
      for (const w of works) {
        if (w.id && !allWorks.has(w.id)) {
          allWorks.set(w.id, w);
        }
      }
    }
  }

  console.log(`\nTotal unique authors: ${allAuthors.size}`);
  console.log(`Total unique works: ${allWorks.size}`);

  // Write combined files
  const authorsArray = Array.from(allAuthors.values());
  const worksArray = Array.from(allWorks.values());

  // Backup old files
  if (fs.existsSync('data/combined/authors.json')) {
    fs.renameSync('data/combined/authors.json', 'data/combined/authors.json.bak');
  }
  if (fs.existsSync('data/combined/works.json')) {
    fs.renameSync('data/combined/works.json', 'data/combined/works.json.bak');
  }

  fs.writeFileSync('data/combined/authors.json', JSON.stringify(authorsArray, null, 2));
  fs.writeFileSync('data/combined/works.json', JSON.stringify(worksArray, null, 2));

  console.log('\nWrote:');
  console.log(`  data/combined/authors.json (${authorsArray.length} authors)`);
  console.log(`  data/combined/works.json (${worksArray.length} works)`);
}

main().catch(console.error);
