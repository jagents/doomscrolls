// Generic Parser
// Fallback parser for texts that don't have specialized parsers

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export function parseGeneric(html: string, tradition: string, chapterNum?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const chapter = chapterNum || 1;

  // Try to extract meaningful content
  let verseNum = 0;
  let currentVerse: string[] = [];

  // First try: look for numbered verses/sections
  const content = $('body').text();
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip navigation and metadata
    if (line.match(/copyright|sacred-texts|next|previous|index|contents|translated by|home/i)) {
      continue;
    }

    // Check for verse/section number
    const verseMatch = line.match(/^(\d+)[:\.]\s*(.*)$/);

    if (verseMatch) {
      // Save previous verse
      if (currentVerse.length > 0 && verseNum > 0) {
        const verseContent = currentVerse.join(' ').trim();
        if (verseContent.length > 10 && verseContent.length < 2000) {
          chunks.push({
            content: verseContent,
            chunkType: 'verse',
            metadata: {
              chapter,
              verse: verseNum,
              tradition
            }
          });
        }
      }
      verseNum = parseInt(verseMatch[1]);
      currentVerse = verseMatch[2] ? [verseMatch[2]] : [];
    } else if (verseNum > 0 && line.length > 5 && !line.match(/^\d+$/)) {
      currentVerse.push(line);
    }
  }

  // Save last verse
  if (currentVerse.length > 0 && verseNum > 0) {
    const verseContent = currentVerse.join(' ').trim();
    if (verseContent.length > 10 && verseContent.length < 2000) {
      chunks.push({
        content: verseContent,
        chunkType: 'verse',
        metadata: {
          chapter,
          verse: verseNum,
          tradition
        }
      });
    }
  }

  // Fallback: paragraph extraction
  if (chunks.length === 0) {
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 30 && text.length < 2000 &&
          !text.match(/copyright|sacred-texts|index|translated|home|next|previous/i)) {
        chunks.push({
          content: text,
          chunkType: 'verse',
          metadata: {
            chapter,
            verse: i + 1,
            tradition
          }
        });
      }
    });
  }

  // Last resort: split by double newlines
  if (chunks.length === 0) {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    let idx = 0;
    for (const para of paragraphs) {
      const cleaned = para.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 50 && cleaned.length < 1500 &&
          !cleaned.match(/sacred-texts|copyright|index|home/i)) {
        idx++;
        chunks.push({
          content: cleaned,
          chunkType: 'verse',
          metadata: {
            chapter,
            verse: idx,
            tradition
          }
        });
      }
    }
  }

  return chunks;
}

// For Gutenberg texts
export function parseGenericGutenberg(text: string, tradition: string): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];

  // Remove Gutenberg header/footer
  const startMatch = text.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG/i);
  const endMatch = text.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i);

  let content = text;
  if (startMatch && startMatch.index !== undefined) {
    content = content.substring(startMatch.index + startMatch[0].length);
  }
  if (endMatch && endMatch.index !== undefined) {
    content = content.substring(0, endMatch.index);
  }

  // Split by paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
  let idx = 0;

  for (const para of paragraphs) {
    const cleaned = para.trim().replace(/\s+/g, ' ');
    if (cleaned.length > 50 && cleaned.length < 2000 &&
        !cleaned.match(/gutenberg|project|ebook|copyright|contents/i)) {
      idx++;
      chunks.push({
        content: cleaned,
        chunkType: 'passage',
        metadata: {
          section: idx,
          tradition
        }
      });
    }
  }

  return chunks;
}
