// Universal Parser for Expansion Texts
// Handles numbered verses, paragraphs, pre-formatted, and numbered sections

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export type ParserType = 'numbered-verses' | 'paragraphs' | 'pre-formatted' | 'numbered-sections';

export function parseExpansionText(
  html: string,
  tradition: string,
  parserType: ParserType,
  chapterNum?: number
): ParsedChunk[] {
  switch (parserType) {
    case 'numbered-verses':
      return parseNumberedVerses(html, tradition, chapterNum);
    case 'paragraphs':
      return parseParagraphs(html, tradition, chapterNum);
    case 'pre-formatted':
      return parsePreFormatted(html, tradition, chapterNum);
    case 'numbered-sections':
      return parseNumberedSections(html, tradition, chapterNum);
    default:
      return parseParagraphs(html, tradition, chapterNum);
  }
}

// Parse texts with numbered verses (like Quran)
function parseNumberedVerses(html: string, tradition: string, chapter?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const bodyText = $('body').text();

  // Look for numbered verses: "1.", "2.", etc.
  const verseRegex = /(?:^|\n)\s*(\d+)\.\s+([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/g;

  let match;
  while ((match = verseRegex.exec(bodyText)) !== null) {
    const verseNum = parseInt(match[1]);
    let content = match[2].trim();

    content = content
      .replace(/\s+/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .trim();

    if (content.length < 15) continue;
    if (content.match(/^(next|previous|index|sacred-texts|contents|p\.\s*\d+)/i)) continue;
    if (verseNum > 500) continue;

    chunks.push({
      content,
      chunkType: 'verse',
      metadata: {
        chapter: chapter || 1,
        verse: verseNum,
        tradition
      }
    });
  }

  // Fallback to paragraph parsing if no verses found
  if (chunks.length < 3) {
    return parseParagraphs(html, tradition, chapter);
  }

  return chunks;
}

// Parse texts as paragraphs
function parseParagraphs(html: string, tradition: string, chapter?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  let idx = 0;

  // Try <p> tags first
  $('p').each((_, el) => {
    const text = $(el).text().trim();

    // Skip navigation, metadata, short content
    if (text.length < 40) return;
    if (text.match(/^(next|previous|index|sacred-texts|copyright|contents|p\.\s*\d+|page \d+|\[\d+\]$)/i)) return;
    if (text.match(/^\[.*\]$/)) return;

    const cleaned = text.replace(/\s+/g, ' ').trim();

    // Split long paragraphs into chunks of ~400-600 chars
    if (cleaned.length > 800) {
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
      let currentChunk = '';

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 600 && currentChunk.length > 100) {
          idx++;
          chunks.push({
            content: currentChunk.trim(),
            chunkType: 'passage',
            metadata: {
              chapter: chapter || 1,
              section: idx,
              tradition
            }
          });
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }

      if (currentChunk.trim().length > 40) {
        idx++;
        chunks.push({
          content: currentChunk.trim(),
          chunkType: 'passage',
          metadata: {
            chapter: chapter || 1,
            section: idx,
            tradition
          }
        });
      }
    } else if (cleaned.length >= 40) {
      idx++;
      chunks.push({
        content: cleaned,
        chunkType: 'passage',
        metadata: {
          chapter: chapter || 1,
          section: idx,
          tradition
        }
      });
    }
  });

  // If few paragraphs found, try body text splitting
  if (chunks.length < 5) {
    chunks.length = 0;
    idx = 0;

    const bodyText = $('body').text();
    const paragraphs = bodyText.split(/\n\s*\n/);

    for (const para of paragraphs) {
      const trimmed = para.trim();

      if (trimmed.length < 50) continue;
      if (trimmed.match(/^(next|previous|index|sacred-texts|copyright|contents)/i)) continue;

      const cleaned = trimmed.replace(/\s+/g, ' ').trim();

      if (cleaned.length > 800) {
        const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
        let currentChunk = '';

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > 600 && currentChunk.length > 100) {
            idx++;
            chunks.push({
              content: currentChunk.trim(),
              chunkType: 'passage',
              metadata: {
                chapter: chapter || 1,
                section: idx,
                tradition
              }
            });
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }

        if (currentChunk.trim().length > 40) {
          idx++;
          chunks.push({
            content: currentChunk.trim(),
            chunkType: 'passage',
            metadata: {
              chapter: chapter || 1,
              section: idx,
              tradition
            }
          });
        }
      } else if (cleaned.length >= 50) {
        idx++;
        chunks.push({
          content: cleaned,
          chunkType: 'passage',
          metadata: {
            chapter: chapter || 1,
            section: idx,
            tradition
          }
        });
      }
    }
  }

  return chunks;
}

// Parse pre-formatted texts (like Great Learning in <pre> tags)
function parsePreFormatted(html: string, tradition: string, chapter?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  // Get pre content
  let content = $('pre').text();

  if (!content || content.length < 100) {
    content = $('body').text();
  }

  // Split by double newlines
  const paragraphs = content.split(/\n\s*\n/);
  let idx = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();

    if (trimmed.length < 40) continue;
    if (trimmed.match(/^(next|previous|index|sacred-texts|copyright|contents|translated by)/i)) continue;

    // Skip Chinese characters if primarily looking for English
    if (trimmed.match(/^[\u4e00-\u9fff\s]+$/)) continue;

    const cleaned = trimmed.replace(/\s+/g, ' ').trim();

    if (cleaned.length >= 40 && cleaned.length < 2000) {
      idx++;
      chunks.push({
        content: cleaned,
        chunkType: 'passage',
        metadata: {
          chapter: chapter || 1,
          section: idx,
          tradition
        }
      });
    }
  }

  return chunks;
}

// Parse numbered sections (like Gospel of Thomas, Yoga Sutras)
function parseNumberedSections(html: string, tradition: string, chapter?: number): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  const bodyText = $('body').text();

  // Try patterns like "1)" or "(1)" or "1." for sections
  const sectionPatterns = [
    /(?:^|\n)\s*(\d+)\)\s+([\s\S]*?)(?=(?:\n\s*\d+\))|$)/g,
    /(?:^|\n)\s*\((\d+)\)\s+([\s\S]*?)(?=(?:\n\s*\(\d+\))|$)/g,
    /(?:^|\n)\s*(\d+)\.\s+([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/g,
    /(?:^|\n)\s*(\d+\.\d+)\s+([\s\S]*?)(?=(?:\n\s*\d+\.\d+)|$)/g,
  ];

  for (const regex of sectionPatterns) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(bodyText)) !== null) {
      const sectionNum = match[1];
      let content = match[2].trim();

      content = content
        .replace(/\s+/g, ' ')
        .replace(/\s*\n\s*/g, ' ')
        .trim();

      if (content.length < 20) continue;
      if (content.match(/^(next|previous|index|sacred-texts|contents)/i)) continue;

      chunks.push({
        content,
        chunkType: 'section',
        metadata: {
          chapter: chapter || 1,
          section: parseInt(sectionNum) || chunks.length + 1,
          tradition
        }
      });
    }

    if (chunks.length >= 5) break;
  }

  // Fallback to paragraph parsing
  if (chunks.length < 5) {
    return parseParagraphs(html, tradition, chapter);
  }

  return chunks;
}
