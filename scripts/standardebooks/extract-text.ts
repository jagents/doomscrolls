// EPUB text extraction utility

import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { readdir } from 'fs/promises';
import { join, basename } from 'path';

export interface ChapterContent {
  title?: string;
  content: string;
  order: number;
}

export interface BookContent {
  title: string;
  author: string;
  chapters: ChapterContent[];
  identifier?: string;
}

/**
 * Extract text content from an EPUB file
 */
export async function extractFromEpub(epubPath: string): Promise<BookContent | null> {
  try {
    const zip = new AdmZip(epubPath);
    const entries = zip.getEntries();

    // Find content.opf to get metadata and reading order
    const opfEntry = entries.find(e =>
      e.entryName.endsWith('.opf') || e.entryName.includes('content.opf')
    );

    if (!opfEntry) {
      console.error(`No OPF file found in ${epubPath}`);
      return null;
    }

    const opfContent = opfEntry.getData().toString('utf8');
    const $opf = cheerio.load(opfContent, { xmlMode: true });

    // Extract metadata
    const title = $opf('dc\\:title, title').first().text() || 'Unknown Title';
    const author = $opf('dc\\:creator, creator').first().text() || 'Unknown Author';
    const identifier = $opf('dc\\:identifier, identifier').first().text() || undefined;

    // Get spine order (the reading order)
    const spineItems: string[] = [];
    $opf('spine itemref').each((_, el) => {
      const idref = $opf(el).attr('idref');
      if (idref) spineItems.push(idref);
    });

    // Build manifest map (id -> href)
    const manifest: Map<string, string> = new Map();
    $opf('manifest item').each((_, el) => {
      const id = $opf(el).attr('id');
      const href = $opf(el).attr('href');
      const mediaType = $opf(el).attr('media-type');
      if (id && href && mediaType?.includes('html')) {
        manifest.set(id, href);
      }
    });

    // Get the base path for content files
    const opfDir = opfEntry.entryName.includes('/')
      ? opfEntry.entryName.substring(0, opfEntry.entryName.lastIndexOf('/') + 1)
      : '';

    // Extract chapters in spine order
    const chapters: ChapterContent[] = [];
    let order = 0;

    for (const itemId of spineItems) {
      const href = manifest.get(itemId);
      if (!href) continue;

      // Find the entry for this chapter
      const chapterPath = opfDir + href;
      const chapterEntry = entries.find(e =>
        e.entryName === chapterPath ||
        e.entryName.endsWith('/' + href)
      );

      if (!chapterEntry) continue;

      const html = chapterEntry.getData().toString('utf8');
      const extracted = extractTextFromHtml(html);

      if (extracted.content.trim().length > 100) { // Skip very short sections
        chapters.push({
          title: extracted.title,
          content: extracted.content,
          order: order++
        });
      }
    }

    if (chapters.length === 0) {
      console.error(`No chapters extracted from ${epubPath}`);
      return null;
    }

    return { title, author, chapters, identifier };
  } catch (error) {
    console.error(`Error extracting ${epubPath}:`, error);
    return null;
  }
}

/**
 * Extract text from HTML/XHTML content
 */
function extractTextFromHtml(html: string): { title?: string; content: string } {
  const $ = cheerio.load(html, { xmlMode: true });

  // Try to find chapter title
  let title: string | undefined;
  const h1 = $('h1, h2').first().text().trim();
  if (h1 && h1.length < 100) {
    title = h1;
  }

  // Remove unwanted elements
  $('script, style, nav, header, footer, aside').remove();

  // Get main content - Standard Ebooks uses <body> or <section>
  let content = '';

  // Try to find main content area
  const mainContent = $('body').text();
  content = mainContent;

  // Clean up the text
  content = content
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Remove the title from content if it appears at the start
  if (title && content.startsWith(title)) {
    content = content.substring(title.length).trim();
  }

  return { title, content };
}

/**
 * Extract and filter content - skip front/back matter
 */
export function filterChapters(chapters: ChapterContent[]): ChapterContent[] {
  // Common front/back matter patterns to skip
  const skipPatterns = [
    /^(title|half-title|halftitle)/i,
    /^(copyright|colophon|imprint)/i,
    /^(dedication|epigraph)/i,
    /^(table of contents|contents)/i,
    /^(preface|foreword|introduction|prologue)$/i, // Keep if part of actual story
    /^(afterword|appendix|endnotes|footnotes)/i,
    /^(about|bibliography|index)/i,
    /^(loi|uncopyright)/i,
  ];

  return chapters.filter(ch => {
    // Skip chapters that match front/back matter patterns
    if (ch.title) {
      const normalizedTitle = ch.title.toLowerCase().trim();
      for (const pattern of skipPatterns) {
        if (pattern.test(normalizedTitle)) {
          return false;
        }
      }
    }

    // Skip very short chapters (likely front matter)
    if (ch.content.length < 500) {
      return false;
    }

    return true;
  });
}
