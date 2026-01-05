// Upanishads Parser
// Parses various Upanishads from sacred-texts.com

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export function parseUpanishads(html: string, tradition: string, chapterNum?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const chapter = chapterNum || 1;

  // Upanishads have verses/passages, often numbered
  // Format varies by specific Upanishad

  let verseNum = 0;
  let currentVerse: string[] = [];

  // Get main content
  const content = $('body').text();
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip navigation and metadata
    if (line.match(/copyright|sacred-texts|next|previous|index|contents|translated by/i)) {
      continue;
    }

    // Check for verse/section number
    const verseMatch = line.match(/^(\d+)\.\s*(.*)$/) ||
                       line.match(/^([IVXLC]+)\.\s*(.*)$/i);

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

      // Parse number (Arabic or Roman)
      if (verseMatch[1].match(/^\d+$/)) {
        verseNum = parseInt(verseMatch[1]);
      } else {
        // Roman numeral
        const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
        const romanStr = verseMatch[1].toUpperCase();
        verseNum = romanStr.split('').reduce((acc, char, i, arr) => {
          const val = romanMap[char] || 0;
          const next = romanMap[arr[i + 1]] || 0;
          return val < next ? acc - val : acc + val;
        }, 0);
      }
      currentVerse = verseMatch[2] ? [verseMatch[2]] : [];
    } else if (verseNum > 0 && line.length > 5) {
      currentVerse.push(line);
    } else if (line.length > 50 && !line.match(/^\d+$/) && verseNum === 0) {
      // Start capturing even without explicit verse numbers
      verseNum = 1;
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
          !text.match(/copyright|sacred-texts|index|translated/i)) {
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
