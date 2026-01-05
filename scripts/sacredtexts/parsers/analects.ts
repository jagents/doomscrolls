// Analects Parser
// Parses the Analects of Confucius from Project Gutenberg plain text
// Format: Books with Chapters, and English translations after Chinese text

import type { ParsedChunk } from './index';

export function parseAnalects(text: string, tradition: string): ParsedChunk[] {
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

  // Split by BOOK markers
  const bookRegex = /BOOK\s+([IVXL]+)\.\s+([^\n]+)/gi;
  const books: Array<{ num: number; title: string; start: number; end: number }> = [];

  let match;
  while ((match = bookRegex.exec(content)) !== null) {
    const romanStr = match[1].toUpperCase();
    const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
    const bookNum = romanStr.split('').reduce((acc, char, i, arr) => {
      const val = romanMap[char] || 0;
      const next = romanMap[arr[i + 1]] || 0;
      return val < next ? acc - val : acc + val;
    }, 0);
    books.push({
      num: bookNum,
      title: match[2].trim(),
      start: match.index + match[0].length,
      end: 0
    });
  }

  // Set end positions
  for (let i = 0; i < books.length; i++) {
    books[i].end = i < books.length - 1 ? books[i + 1].start - 20 : content.length;
  }

  // Process each book
  for (const book of books) {
    const bookContent = content.substring(book.start, book.end);

    // Look for CHAPTER markers within book
    const chapterRegex = /CHAPTER\s+([IVXL]+)\./gi;
    const chapters: Array<{ num: number; start: number; end: number }> = [];

    let cm;
    while ((cm = chapterRegex.exec(bookContent)) !== null) {
      const romanStr = cm[1].toUpperCase();
      const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
      const chapNum = romanStr.split('').reduce((acc, char, i, arr) => {
        const val = romanMap[char] || 0;
        const next = romanMap[arr[i + 1]] || 0;
        return val < next ? acc - val : acc + val;
      }, 0);
      chapters.push({
        num: chapNum,
        start: cm.index + cm[0].length,
        end: 0
      });
    }

    for (let i = 0; i < chapters.length; i++) {
      chapters[i].end = i < chapters.length - 1 ? chapters[i + 1].start - 20 : bookContent.length;
    }

    // If no chapters found, treat whole book as one chapter
    if (chapters.length === 0) {
      chapters.push({ num: 1, start: 0, end: bookContent.length });
    }

    // Extract sayings from each chapter
    for (const chapter of chapters) {
      const chapterContent = bookContent.substring(chapter.start, chapter.end);

      // Look for English sayings that start with patterns like:
      // "The Master said" or numbered sections or quoted content
      // The text has Chinese followed by English translations

      // Split by double newlines to get paragraphs
      const paragraphs = chapterContent.split(/\n\s*\n/);

      for (const para of paragraphs) {
        const trimmed = para.trim();

        // Skip Chinese text (contains Chinese characters)
        if (trimmed.match(/[\u4e00-\u9fff]/)) continue;

        // Skip if too short
        if (trimmed.length < 40) continue;

        // Skip section markers
        if (trimmed.match(/^【.*】$/)) continue;

        // Skip metadata
        if (trimmed.match(/^(BOOK|CHAPTER|Section|Note)/i)) continue;

        // This should be English content - clean it up
        const cleaned = trimmed
          .replace(/\s+/g, ' ')
          .replace(/\[.*?\]/g, '') // Remove bracketed annotations
          .trim();

        if (cleaned.length > 40 && cleaned.length < 2000) {
          chunks.push({
            content: cleaned,
            chunkType: 'saying',
            metadata: {
              book: book.num,
              chapter: chapter.num,
              section: chunks.filter(c =>
                c.metadata.book === book.num &&
                c.metadata.chapter === chapter.num
              ).length + 1,
              tradition
            }
          });
        }
      }
    }
  }

  // If we got too few chunks, try simpler approach
  if (chunks.length < 100) {
    chunks.length = 0;

    // Look for "The Master said" patterns
    const sayingRegex = /(?:The Master said|Confucius said|The philosopher [A-Za-z]+ said)[,:]?\s*["']?([^"'\n]+["']?[^.!?]*[.!?])/gi;

    let sm;
    let idx = 0;
    while ((sm = sayingRegex.exec(content)) !== null) {
      idx++;
      const saying = sm[0].trim().replace(/\s+/g, ' ');

      if (saying.length > 40 && saying.length < 1500) {
        chunks.push({
          content: saying,
          chunkType: 'saying',
          metadata: {
            section: idx,
            tradition
          }
        });
      }
    }
  }

  // Last resort: extract all substantial English paragraphs
  if (chunks.length < 100) {
    chunks.length = 0;

    const paragraphs = content.split(/\n\s*\n/);
    let idx = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();

      // Skip Chinese text
      if (trimmed.match(/[\u4e00-\u9fff]/)) continue;

      // Skip short content
      if (trimmed.length < 50) continue;

      // Skip section markers and metadata
      if (trimmed.match(/^(BOOK|CHAPTER|【|Note|Section|Gutenberg|Project)/i)) continue;

      // Must contain English letters and quotes (dialogue indicator)
      if (!trimmed.match(/[a-zA-Z]/) || !trimmed.match(/["']/)) continue;

      const cleaned = trimmed
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 50 && cleaned.length < 1500) {
        idx++;
        chunks.push({
          content: cleaned,
          chunkType: 'saying',
          metadata: {
            section: idx,
            tradition
          }
        });
      }
    }
  }

  return chunks;
}
