// Tao Te Ching Parser
// Parses the Tao Te Ching from sacred-texts.com
// The text is on a single page with chapters separated by <hr> tags

import * as cheerio from 'cheerio';
import type { ParsedChunk } from './index';

export function parseTaoTeChing(html: string, tradition: string): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  // The sacred-texts Tao Te Ching has all 81 chapters on one page
  // Chapters are separated by <hr> tags and numbered 1-81

  // Get the full HTML content and split by <hr>
  const bodyHtml = $('body').html() || '';

  // Split by horizontal rule
  const sections = bodyHtml.split(/<hr\s*\/?>/i);

  let chapterNum = 0;

  for (const section of sections) {
    // Load this section
    const $section = cheerio.load(`<div>${section}</div>`);
    let text = $section('div').text().trim();

    // Skip navigation/header sections
    if (text.match(/^sacred.*texts|contents|index|copyright|next|previous/i)) {
      continue;
    }

    // Skip very short sections (navigation remnants)
    if (text.length < 30) {
      continue;
    }

    // Try to find chapter number in the text
    const chapterMatch = text.match(/^(\d+)\s*\./);
    if (chapterMatch) {
      chapterNum = parseInt(chapterMatch[1]);
      // Remove the chapter number from content
      text = text.replace(/^\d+\s*\.?\s*/, '').trim();
    } else {
      // Just increment
      chapterNum++;
    }

    // Clean up the text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();

    // Skip if still too short or is navigation
    if (text.length < 20 || text.match(/^(next|previous|index|home|contents)/i)) {
      continue;
    }

    chunks.push({
      content: text,
      chunkType: 'chapter',
      metadata: {
        chapter: chapterNum,
        tradition
      }
    });
  }

  // If hr splitting didn't work, try numbered paragraphs approach
  if (chunks.length < 10) {
    chunks.length = 0;
    chapterNum = 0;

    // Get all text and split by chapter numbers
    const fullText = $('body').text();
    const chapterRegex = /(?:^|\n)(\d{1,2})\.?\s+([\s\S]*?)(?=(?:\n\d{1,2}\.?\s+)|$)/g;
    let match;

    while ((match = chapterRegex.exec(fullText)) !== null) {
      const num = parseInt(match[1]);
      let content = match[2].trim();

      // Clean up
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();

      if (content.length > 20 && num <= 81) {
        chunks.push({
          content,
          chunkType: 'chapter',
          metadata: {
            chapter: num,
            tradition
          }
        });
      }
    }
  }

  // Last resort: split by double newlines and look for substantial paragraphs
  if (chunks.length < 10) {
    chunks.length = 0;
    chapterNum = 0;

    const fullText = $('body').text();
    const paragraphs = fullText.split(/\n\s*\n/).filter(p => {
      const trimmed = p.trim();
      return trimmed.length > 30 &&
             !trimmed.match(/copyright|sacred-texts|index|next|previous/i);
    });

    for (const para of paragraphs) {
      chapterNum++;
      const cleaned = para.trim().replace(/\s+/g, ' ');

      if (cleaned.length > 30 && cleaned.length < 1500) {
        chunks.push({
          content: cleaned,
          chunkType: 'chapter',
          metadata: {
            chapter: chapterNum,
            tradition
          }
        });
      }
    }
  }

  // Filter out any navigation/boilerplate that slipped through
  return chunks.filter(c =>
    c.content.length > 20 &&
    !c.content.match(/^(sacred-texts|copyright|index|next|previous|home)/i)
  );
}
