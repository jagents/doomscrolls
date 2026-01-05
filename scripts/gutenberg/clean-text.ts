// Gutenberg Text Cleaning and Chunking

import { CHUNK_CONFIG } from "./config";

const START_MARKERS = [
  "*** START OF THE PROJECT GUTENBERG EBOOK",
  "*** START OF THIS PROJECT GUTENBERG EBOOK",
  "***START OF THE PROJECT GUTENBERG EBOOK",
  "*END*THE SMALL PRINT!",
  "*** START OF THE PROJECT GUTENBERG",
  "***START OF THE PROJECT GUTENBERG"
];

const END_MARKERS = [
  "*** END OF THE PROJECT GUTENBERG EBOOK",
  "*** END OF THIS PROJECT GUTENBERG EBOOK",
  "***END OF THE PROJECT GUTENBERG EBOOK",
  "End of the Project Gutenberg EBook",
  "End of Project Gutenberg",
  "*** END OF THE PROJECT GUTENBERG",
  "***END OF THE PROJECT GUTENBERG"
];

export function cleanGutenbergText(text: string): string {
  let content = text;

  // Remove header - find the start marker and skip past it
  for (const marker of START_MARKERS) {
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      // Find the next newline after the marker line
      let newlineAfter = content.indexOf('\n', idx);
      if (newlineAfter === -1) newlineAfter = idx + marker.length;

      // Sometimes there's a second *** line, skip that too
      const nextLine = content.indexOf('\n', newlineAfter + 1);
      if (nextLine !== -1 && content.slice(newlineAfter, nextLine).includes('***')) {
        newlineAfter = nextLine;
      }

      content = content.slice(newlineAfter + 1);
      break;
    }
  }

  // Remove footer
  for (const marker of END_MARKERS) {
    const idx = content.indexOf(marker);
    if (idx !== -1) {
      content = content.slice(0, idx);
      break;
    }
  }

  // Clean up whitespace
  content = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines
    .trim();

  return content;
}

export interface Chunk {
  text: string;
  index: number;
}

export function chunkText(text: string): Chunk[] {
  const chunks: Chunk[] = [];

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const cleanPara = para.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanPara.length === 0) continue;

    // If adding this paragraph would exceed max, save current and start new
    if (currentChunk.length > 0 &&
        currentChunk.length + cleanPara.length + 1 > CHUNK_CONFIG.MAX_LENGTH) {
      if (currentChunk.length >= CHUNK_CONFIG.MIN_LENGTH) {
        chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords: string[] = [];
        let overlapLen = 0;
        for (let i = words.length - 1; i >= 0 && overlapLen < CHUNK_CONFIG.OVERLAP; i--) {
          overlapWords.unshift(words[i]);
          overlapLen += words[i].length + 1;
        }
        currentChunk = overlapWords.join(' ') + ' ' + cleanPara;
      } else {
        currentChunk += ' ' + cleanPara;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + cleanPara : cleanPara;
    }

    // If current chunk is too long, split by sentences
    while (currentChunk.length > CHUNK_CONFIG.MAX_LENGTH) {
      // Find a good break point (end of sentence)
      let breakPoint = -1;
      const sentenceEnders = ['. ', '! ', '? ', '." ', '!" ', '?" '];

      for (const ender of sentenceEnders) {
        const idx = currentChunk.lastIndexOf(ender, CHUNK_CONFIG.MAX_LENGTH);
        if (idx > CHUNK_CONFIG.MIN_LENGTH && idx > breakPoint) {
          breakPoint = idx + ender.length - 1;
        }
      }

      if (breakPoint === -1) {
        // No good sentence break, just break at max
        breakPoint = CHUNK_CONFIG.MAX_LENGTH;
        // Try to break at a space
        const spaceIdx = currentChunk.lastIndexOf(' ', breakPoint);
        if (spaceIdx > CHUNK_CONFIG.MIN_LENGTH) {
          breakPoint = spaceIdx;
        }
      }

      const chunk = currentChunk.slice(0, breakPoint).trim();
      if (chunk.length >= CHUNK_CONFIG.MIN_LENGTH) {
        chunks.push({ text: chunk, index: chunkIndex++ });
      }

      // Keep overlap for next chunk
      const remaining = currentChunk.slice(breakPoint).trim();
      const words = chunk.split(' ');
      const overlapWords: string[] = [];
      let overlapLen = 0;
      for (let i = words.length - 1; i >= 0 && overlapLen < CHUNK_CONFIG.OVERLAP; i--) {
        overlapWords.unshift(words[i]);
        overlapLen += words[i].length + 1;
      }
      currentChunk = overlapWords.join(' ') + ' ' + remaining;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length >= CHUNK_CONFIG.MIN_LENGTH) {
    chunks.push({ text: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}
