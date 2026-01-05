// Text chunking utility for Standard Ebooks passages

export interface TextChunk {
  content: string;
  index: number;
  chapter?: string;
  positionPercent: number;
}

/**
 * Split text into scroll-sized passages (300-500 chars)
 * Uses paragraph-first, then sentence splitting
 */
export function chunkText(
  text: string,
  chapter: string | undefined,
  targetSize = 400,
  minSize = 200,
  maxSize = 600
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) return [];

  const totalLength = cleanedText.length;

  // Split into paragraphs first
  const paragraphs = cleanedText.split(/\n\n+/);

  let currentChunk = '';
  let chunkStart = 0;
  let processedLength = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // If adding this paragraph exceeds max size, we need to handle it
    if (currentChunk && (currentChunk.length + trimmedPara.length + 2) > maxSize) {
      // Save current chunk if it meets minimum
      if (currentChunk.length >= minSize) {
        const positionPercent = Math.round((processedLength / totalLength) * 100);
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          chapter,
          positionPercent
        });
        processedLength += currentChunk.length;
        currentChunk = '';
      }
    }

    // If paragraph itself is too long, split by sentences
    if (trimmedPara.length > maxSize) {
      // First, save any accumulated chunk
      if (currentChunk.length >= minSize) {
        const positionPercent = Math.round((processedLength / totalLength) * 100);
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          chapter,
          positionPercent
        });
        processedLength += currentChunk.length;
        currentChunk = '';
      }

      // Split long paragraph into sentences
      const sentences = splitIntoSentences(trimmedPara);

      for (const sentence of sentences) {
        if (currentChunk && (currentChunk.length + sentence.length + 1) > maxSize) {
          if (currentChunk.length >= minSize) {
            const positionPercent = Math.round((processedLength / totalLength) * 100);
            chunks.push({
              content: currentChunk.trim(),
              index: chunks.length,
              chapter,
              positionPercent
            });
            processedLength += currentChunk.length;
            currentChunk = '';
          }
        }

        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;

        // If we've reached target size, save it
        if (currentChunk.length >= targetSize) {
          const positionPercent = Math.round((processedLength / totalLength) * 100);
          chunks.push({
            content: currentChunk.trim(),
            index: chunks.length,
            chapter,
            positionPercent
          });
          processedLength += currentChunk.length;
          currentChunk = '';
        }
      }
    } else {
      // Normal paragraph - add to current chunk
      currentChunk = currentChunk
        ? currentChunk + '\n\n' + trimmedPara
        : trimmedPara;

      // If we've reached target size, save it
      if (currentChunk.length >= targetSize) {
        const positionPercent = Math.round((processedLength / totalLength) * 100);
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          chapter,
          positionPercent
        });
        processedLength += currentChunk.length;
        currentChunk = '';
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim() && currentChunk.length >= minSize) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      chapter,
      positionPercent: 100
    });
  }

  return chunks;
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence endings, keeping the punctuation
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter(p => p.trim().length > 0);
}

/**
 * Process full book text with chapter detection
 */
export function chunkBook(
  chapters: { title?: string; content: string }[]
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  // Calculate total length for position tracking
  const totalLength = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
  let processedLength = 0;

  for (const chapter of chapters) {
    const chapterChunks = chunkText(chapter.content, chapter.title);

    // Recalculate position percent based on global position
    for (const chunk of chapterChunks) {
      const globalPosition = processedLength + (chunk.positionPercent / 100) * chapter.content.length;
      allChunks.push({
        ...chunk,
        index: globalIndex++,
        positionPercent: Math.round((globalPosition / totalLength) * 100)
      });
    }

    processedLength += chapter.content.length;
  }

  return allChunks;
}
