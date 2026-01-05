// Catalog fetcher for Standard Ebooks (via HTML scraping)

import * as cheerio from 'cheerio';

export interface CatalogEntry {
  title: string;
  author: string;
  epubUrl: string;
  identifier: string;
  bookPageUrl: string;
}

/**
 * Fetch and parse the Standard Ebooks catalog by scraping HTML pages
 */
export async function fetchCatalog(): Promise<CatalogEntry[]> {
  console.log('Fetching Standard Ebooks catalog (via HTML scraping)...');

  const entries: CatalogEntry[] = [];
  const seenIds = new Set<string>();
  let page = 1;
  const perPage = 48;

  while (true) {
    const url = `https://standardebooks.org/ebooks?page=${page}&per-page=${perPage}`;
    console.log(`  Fetching page ${page}...`);

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch page ${page}: ${response.status}`);
      break;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find all ebook links
    const bookLinks: string[] = [];
    $('ol.ebooks-list li a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/ebooks/') && !href.endsWith('/ebooks/')) {
        // Filter out author-only links (they don't have a book title)
        const parts = href.split('/').filter(p => p);
        if (parts.length >= 2) { // /ebooks/author/book
          bookLinks.push(href);
        }
      }
    });

    // Dedupe links on this page
    const uniqueLinks = [...new Set(bookLinks)];

    if (uniqueLinks.length === 0) {
      console.log(`  No more books on page ${page}, stopping.`);
      break;
    }

    // Track count before adding
    const countBefore = entries.length;

    // Parse each unique book link
    for (const href of uniqueLinks) {
      // Extract identifier from path
      // e.g., /ebooks/jane-austen/pride-and-prejudice -> jane-austen_pride-and-prejudice
      const parts = href.split('/').filter(p => p && p !== 'ebooks');
      const identifier = parts.join('_');

      if (seenIds.has(identifier)) continue;
      seenIds.add(identifier);

      // Extract author from path (first part after /ebooks/)
      const authorSlug = parts[0] || 'unknown';
      // Convert slug to name: jane-austen -> Jane Austen
      const author = slugToName(authorSlug);

      // Extract title from last part
      const titleSlug = parts[parts.length - 1] || 'unknown';
      const title = slugToName(titleSlug);

      // Construct EPUB URL (need ?source=download to bypass redirect page)
      const epubUrl = `https://standardebooks.org${href}/downloads/${identifier}.epub?source=download`;

      entries.push({
        title,
        author,
        epubUrl,
        identifier,
        bookPageUrl: `https://standardebooks.org${href}`
      });
    }

    const newBooksThisPage = entries.length - countBefore;
    console.log(`  Found ${uniqueLinks.length} links on page ${page}, ${newBooksThisPage} new, ${entries.length} unique total`);

    // Stop if we didn't find any new books on this page
    if (newBooksThisPage === 0 && page > 1) {
      console.log(`  No new books found, catalog complete.`);
      break;
    }

    // Rate limit between pages
    await sleep(300);
    page++;

    // Safety limit
    if (page > 100) {
      console.log('  Reached page limit, stopping.');
      break;
    }
  }

  console.log(`\nFound ${entries.length} books in catalog`);
  return entries;
}

/**
 * Convert a slug to a proper name
 * e.g., "jane-austen" -> "Jane Austen"
 */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract identifier from Standard Ebooks URL
 * e.g., "jane-austen_pride-and-prejudice" from the epub URL
 */
function extractIdentifier(url: string): string {
  // URL pattern: .../author_title.epub
  const match = url.match(/\/([^/]+)\.epub$/);
  if (match) {
    return match[1];
  }
  return '';
}

/**
 * Download an EPUB file - returns 'rate_limited' | 'success' | 'failed'
 */
export async function downloadEpub(
  url: string,
  destPath: string,
  retries = 3
): Promise<'success' | 'rate_limited' | 'failed'> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);

      // Return immediately on rate limit - let main script handle cooldown
      if (response.status === 429) {
        console.log(`  Rate limited (429)`);
        return 'rate_limited';
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      await Bun.write(destPath, buffer);
      return 'success';
    } catch (error) {
      console.error(`  Download attempt ${attempt + 1} failed:`, (error as Error).message);
      if (attempt < retries - 1) {
        // Short backoff for non-rate-limit errors
        await sleep(2000);
      }
    }
  }
  return 'failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
