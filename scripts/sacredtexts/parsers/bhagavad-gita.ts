// Bhagavad Gita Parser
// Parses the Bhagavad Gita chapters from sacred-texts.com (sbg format)
// Verses are numbered like "1.", "2.", etc.

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export function parseBhagavadGita(html: string, tradition: string, chapterNum?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const chapter = chapterNum || 1;

  // Get the body text
  const bodyText = $('body').text();

  // Look for numbered verses: "1.", "2.", etc.
  // Pattern: number followed by period and content until next number
  const verseRegex = /(?:^|\n)\s*(\d+)\.\s+([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/g;

  let match;
  while ((match = verseRegex.exec(bodyText)) !== null) {
    const verseNum = parseInt(match[1]);
    let content = match[2].trim();

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .trim();

    // Skip navigation, headers, etc.
    if (content.length < 20) continue;
    if (content.match(/^(next|previous|index|sacred-texts|contents|chapter)/i)) continue;
    if (content.match(/^p\.\s*\d+/i)) continue; // Page numbers

    // Skip if this looks like a footnote or page reference
    if (verseNum > 100) continue;

    chunks.push({
      content,
      chunkType: 'verse',
      metadata: {
        chapter,
        verse: verseNum,
        tradition
      }
    });
  }

  // If numbered parsing didn't work well, try paragraph-based approach
  if (chunks.length < 10) {
    chunks.length = 0;

    $('p').each((i, el) => {
      const text = $(el).text().trim();

      // Check for verse number at start
      const verseMatch = text.match(/^(\d+)\.\s*(.+)/);
      if (verseMatch) {
        const verseNum = parseInt(verseMatch[1]);
        let content = verseMatch[2].trim();

        content = content.replace(/\s+/g, ' ').trim();

        if (content.length > 20 && verseNum <= 100) {
          chunks.push({
            content,
            chunkType: 'verse',
            metadata: {
              chapter,
              verse: verseNum,
              tradition
            }
          });
        }
      } else if (text.length > 40 && !text.match(/^(next|previous|index|p\.\s*\d+)/i)) {
        // Non-numbered paragraph that might be content
        chunks.push({
          content: text.replace(/\s+/g, ' '),
          chunkType: 'verse',
          metadata: {
            chapter,
            verse: chunks.length + 1,
            tradition
          }
        });
      }
    });
  }

  return chunks;
}
