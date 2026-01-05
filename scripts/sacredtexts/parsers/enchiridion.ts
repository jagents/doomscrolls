// Enchiridion (Epictetus) Parser
// Parses the Enchiridion from Project Gutenberg plain text

import type { ParsedChunk } from './index';

export function parseEnchiridion(text: string, tradition: string): ParsedChunk[] {
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

  // Enchiridion has 53 numbered sections
  // Format varies but typically "1.", "2.", etc.

  const lines = content.split('\n');
  let sectionNum = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section number (Roman numerals or Arabic)
    const arabicMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
    const romanMatch = trimmed.match(/^([IVXLC]+)\.\s*(.*)$/i);

    if (arabicMatch || romanMatch) {
      // Save previous section
      if (currentContent.length > 0 && sectionNum > 0) {
        const sectionContent = currentContent.join(' ').trim()
          .replace(/\s+/g, ' ');
        if (sectionContent.length > 20 && sectionContent.length < 3000) {
          chunks.push({
            content: sectionContent,
            chunkType: 'section',
            metadata: {
              section: sectionNum,
              tradition
            }
          });
        }
      }

      if (arabicMatch) {
        sectionNum = parseInt(arabicMatch[1]);
        currentContent = arabicMatch[2] ? [arabicMatch[2]] : [];
      } else if (romanMatch) {
        // Convert Roman numeral
        const romanMap: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
        const romanStr = romanMatch[1].toUpperCase();
        sectionNum = romanStr.split('').reduce((acc, char, i, arr) => {
          const val = romanMap[char] || 0;
          const next = romanMap[arr[i + 1]] || 0;
          return val < next ? acc - val : acc + val;
        }, 0);
        currentContent = romanMatch[2] ? [romanMatch[2]] : [];
      }
    } else if (trimmed.length > 0 && sectionNum > 0) {
      currentContent.push(trimmed);
    }
  }

  // Save last section
  if (currentContent.length > 0 && sectionNum > 0) {
    const sectionContent = currentContent.join(' ').trim()
      .replace(/\s+/g, ' ');
    if (sectionContent.length > 20 && sectionContent.length < 3000) {
      chunks.push({
        content: sectionContent,
        chunkType: 'section',
        metadata: {
          section: sectionNum,
          tradition
        }
      });
    }
  }

  // Fallback: paragraph-based extraction
  if (chunks.length < 10) {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    let idx = 0;
    for (const para of paragraphs) {
      const cleaned = para.trim().replace(/\s+/g, ' ');
      if (cleaned.length > 50 && cleaned.length < 2000 &&
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

export function parseEnchiridionGutenberg(text: string, tradition: string): ParsedChunk[] {
  return parseEnchiridion(text, tradition);
}
