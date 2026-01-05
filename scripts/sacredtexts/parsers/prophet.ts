// The Prophet Parser
// Parses Khalil Gibran's The Prophet from Project Gutenberg plain text

import type { ParsedChunk } from './index';

export function parseProphet(text: string, tradition: string): ParsedChunk[] {
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

  // The Prophet has 26 prose poems, each titled (e.g., "On Love", "On Marriage")
  // Format: typically "On [Topic]" as chapter headers

  const chapterRegex = /(?:^|\n\n)((?:On|The|And)\s+[A-Z][a-zA-Z\s]+?)(?:\n)/g;

  const chapters: Array<{ title: string; start: number }> = [];
  let match;

  while ((match = chapterRegex.exec(content)) !== null) {
    const title = match[1].trim();
    // Skip if too short or looks like a sentence
    if (title.length > 3 && title.length < 50 && !title.match(/[,;:]/)) {
      chapters.push({
        title,
        start: match.index + match[0].length
      });
    }
  }

  // Process each chapter
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const endPos = i < chapters.length - 1 ? chapters[i + 1].start - chapter.title.length - 5 : content.length;
    const chapterContent = content.substring(chapter.start, endPos).trim();

    // Clean and add as single chunk (prose poems are meant to be read whole)
    const cleaned = chapterContent
      .replace(/\s+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();

    if (cleaned.length > 50 && cleaned.length < 5000) {
      chunks.push({
        content: cleaned,
        chunkType: 'chapter',
        metadata: {
          chapter: i + 1,
          title: chapter.title,
          tradition
        }
      });
    }
  }

  // If chapter parsing didn't work well, try paragraph extraction
  if (chunks.length < 5) {
    chunks.length = 0;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 100);
    let idx = 0;
    for (const para of paragraphs) {
      const cleaned = para.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 100 && cleaned.length < 3000 &&
          !cleaned.match(/gutenberg|project|ebook|copyright|contents|illustrated/i)) {
        idx++;
        chunks.push({
          content: cleaned,
          chunkType: 'chapter',
          metadata: {
            chapter: idx,
            tradition
          }
        });
      }
    }
  }

  return chunks;
}

export function parseProphetGutenberg(text: string, tradition: string): ParsedChunk[] {
  return parseProphet(text, tradition);
}
