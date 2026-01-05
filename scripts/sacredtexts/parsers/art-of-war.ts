// Art of War Parser
// Parses Sun Tzu's Art of War from Project Gutenberg plain text

import type { ParsedChunk } from './index';

export function parseArtOfWar(text: string, tradition: string): ParsedChunk[] {
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

  // Art of War has 13 chapters with numbered sections
  // Format: "I. LAYING PLANS", "II. WAGING WAR", etc.

  const chapterRegex = /(?:^|\n)([IVX]+)\.\s*([A-Z][A-Z\s]+)(?:\n|$)/g;
  const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

  // Find all chapter positions
  const chapters: Array<{ num: number; title: string; start: number }> = [];
  let match;

  while ((match = chapterRegex.exec(content)) !== null) {
    const romanStr = match[1];
    const chapterNum = romanStr.split('').reduce((acc, char, i, arr) => {
      const val = romanMap[char] || 0;
      const next = romanMap[arr[i + 1]] || 0;
      return val < next ? acc - val : acc + val;
    }, 0);
    chapters.push({
      num: chapterNum,
      title: match[2].trim(),
      start: match.index + match[0].length
    });
  }

  // Process each chapter
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const endPos = i < chapters.length - 1 ? chapters[i + 1].start - 50 : content.length;
    const chapterContent = content.substring(chapter.start, endPos);

    // Split into numbered sections
    const lines = chapterContent.split('\n');
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
                chapter: chapter.num,
                section: sectionNum,
                title: chapter.title,
                tradition
              }
            });
          }
        }
        sectionNum = parseInt(numMatch[1]);
        currentContent = numMatch[2] ? [numMatch[2]] : [];
      } else if (trimmed.length > 0 && !trimmed.match(/^[IVX]+\./)) {
        if (sectionNum === 0 && trimmed.length > 30) {
          sectionNum = 1;
        }
        if (sectionNum > 0) {
          currentContent.push(trimmed);
        }
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
            chapter: chapter.num,
            section: sectionNum,
            title: chapter.title,
            tradition
          }
        });
      }
    }
  }

  // Fallback if chapter parsing failed
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

export function parseArtOfWarGutenberg(text: string, tradition: string): ParsedChunk[] {
  return parseArtOfWar(text, tradition);
}
