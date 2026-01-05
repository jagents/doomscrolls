// Dhammapada Parser
// Parses the Dhammapada from sacred-texts.com

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export function parseDhammapada(html: string, tradition: string, chapterNum?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const chapter = chapterNum || 1;

  // Dhammapada has numbered verses
  // Format is typically "Verse X. [content]" or just numbered

  let verseNum = 0;
  let currentVerse: string[] = [];

  const content = $('body').text();
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip navigation and metadata
    if (line.match(/copyright|sacred-texts|next|previous|index|contents/i)) {
      continue;
    }

    // Check for verse number
    const verseMatch = line.match(/^(?:verse\s+)?(\d+)\.\s*(.*)$/i);
    if (verseMatch) {
      // Save previous verse
      if (currentVerse.length > 0 && verseNum > 0) {
        const verseContent = currentVerse.join(' ').trim();
        if (verseContent.length > 10) {
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
    if (verseContent.length > 10) {
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

  // Fallback: paragraph-based extraction
  if (chunks.length === 0) {
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20 && !text.match(/copyright|sacred-texts|index/i)) {
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

  return chunks;
}
