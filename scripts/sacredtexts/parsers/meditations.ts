// Marcus Aurelius Meditations Parser
// Parses the Meditations from Project Gutenberg plain text

import type { ParsedChunk } from './index';

export function parseMeditations(text: string, tradition: string): ParsedChunk[] {
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

  // Meditations has 12 books, each with numbered sections
  // Format: "BOOK ONE", "BOOK TWO", etc., then numbered paragraphs

  const bookRegex = /BOOK\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|\d+)/gi;
  const numberWords: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6,
    SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, ELEVEN: 11, TWELVE: 12
  };

  // Split by books
  const bookSections = content.split(bookRegex);

  let currentBook = 0;

  for (let i = 0; i < bookSections.length; i++) {
    const section = bookSections[i].trim();

    // Check if this is a book number
    const upperSection = section.toUpperCase();
    if (numberWords[upperSection]) {
      currentBook = numberWords[upperSection];
      continue;
    } else if (section.match(/^\d+$/)) {
      currentBook = parseInt(section);
      continue;
    }

    if (currentBook === 0 || section.length < 50) continue;

    // Parse numbered sections within book
    // Format: "1.", "2.", etc. at start of paragraph
    const lines = section.split('\n');
    let sectionNum = 0;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for section number
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
      if (numMatch) {
        // Save previous section
        if (currentContent.length > 0 && sectionNum > 0) {
          const sectionContent = currentContent.join(' ').trim()
            .replace(/\s+/g, ' ');
          if (sectionContent.length > 20 && sectionContent.length < 2000) {
            chunks.push({
              content: sectionContent,
              chunkType: 'section',
              metadata: {
                book: currentBook,
                section: sectionNum,
                tradition
              }
            });
          }
        }
        sectionNum = parseInt(numMatch[1]);
        currentContent = numMatch[2] ? [numMatch[2]] : [];
      } else if (trimmed.length > 0 && sectionNum > 0) {
        currentContent.push(trimmed);
      }
    }

    // Save last section
    if (currentContent.length > 0 && sectionNum > 0) {
      const sectionContent = currentContent.join(' ').trim()
        .replace(/\s+/g, ' ');
      if (sectionContent.length > 20 && sectionContent.length < 2000) {
        chunks.push({
          content: sectionContent,
          chunkType: 'section',
          metadata: {
            book: currentBook,
            section: sectionNum,
            tradition
          }
        });
      }
    }
  }

  // If parsing failed, try simpler paragraph approach
  if (chunks.length < 10) {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    let idx = 0;
    for (const para of paragraphs) {
      const cleaned = para.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 50 && cleaned.length < 1500 &&
          !cleaned.match(/gutenberg|project|ebook|copyright/i)) {
        idx++;
        chunks.push({
          content: cleaned,
          chunkType: 'section',
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

// Wrapper for Gutenberg text
export function parseMeditationsGutenberg(text: string, tradition: string): ParsedChunk[] {
  return parseMeditations(text, tradition);
}
