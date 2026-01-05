// Text-type specific chunking for Perseus texts
// Different text types need different chunking strategies

import type { ParsedSection, ParsedText } from "./parse-tei";
import type { TextConfig } from "./texts-config";

export interface ChunkResult {
  content: string;
  chunkType: "passage" | "speech" | "verse_group";
  metadata: {
    book?: string | number;
    chapter?: string | number;
    section?: string | number;
    card?: string | number;
    lineStart?: number;
    lineEnd?: number;
    speaker?: string;
  };
}

// Target chunk sizes by form
const CHUNK_TARGETS = {
  poetry: { min: 150, max: 500, target: 300 },     // Groups of 10-20 lines
  dialogue: { min: 100, max: 600, target: 350 },   // By speech/paragraph
  drama: { min: 100, max: 500, target: 300 },      // By speech, preserve speaker
  prose: { min: 200, max: 600, target: 400 },      // By paragraph/section
};

// Chunk poetry (Homer, Virgil, Ovid)
function chunkPoetry(parsed: ParsedText, config: TextConfig): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const targets = CHUNK_TARGETS.poetry;

  // Group sections by book/card for better chunking
  let currentChunk: string[] = [];
  let currentMeta: ChunkResult["metadata"] = {};
  let firstMeta: ChunkResult["metadata"] = {};

  for (const section of parsed.sections) {
    const sectionLen = section.content.length;

    // If current chunk + section exceeds max, flush
    const currentLen = currentChunk.join(" ").length;
    if (currentLen > 0 && currentLen + sectionLen > targets.max) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "verse_group",
        metadata: { ...firstMeta, lineEnd: currentMeta.lineEnd },
      });
      currentChunk = [];
      firstMeta = {};
    }

    // Add section to current chunk
    if (currentChunk.length === 0) {
      firstMeta = {
        book: section.book,
        chapter: section.chapter,
        section: section.section,
        card: section.card,
        lineStart: section.lineStart,
      };
    }
    currentChunk.push(section.content);
    currentMeta = {
      book: section.book,
      chapter: section.chapter,
      section: section.section,
      card: section.card,
      lineEnd: section.lineEnd || section.lineStart,
    };

    // If chunk reaches target, flush
    const newLen = currentChunk.join(" ").length;
    if (newLen >= targets.target) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "verse_group",
        metadata: { ...firstMeta, lineEnd: currentMeta.lineEnd },
      });
      currentChunk = [];
      firstMeta = {};
    }
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    const content = currentChunk.join(" ");
    if (content.length >= targets.min) {
      chunks.push({
        content,
        chunkType: "verse_group",
        metadata: { ...firstMeta, lineEnd: currentMeta.lineEnd },
      });
    } else if (chunks.length > 0) {
      // Append to last chunk if too small
      const last = chunks[chunks.length - 1];
      last.content += " " + content;
      last.metadata.lineEnd = currentMeta.lineEnd;
    } else if (content.length > 50) {
      // Keep even small chunks if it's all we have
      chunks.push({
        content,
        chunkType: "verse_group",
        metadata: { ...firstMeta, lineEnd: currentMeta.lineEnd },
      });
    }
  }

  return chunks;
}

// Chunk drama (Sophocles, Euripides, Aeschylus)
function chunkDrama(parsed: ParsedText, config: TextConfig): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const targets = CHUNK_TARGETS.drama;

  for (const section of parsed.sections) {
    if (section.type === "speech" && section.speaker) {
      // Drama speeches: keep speaker context
      const content = section.content;
      const speaker = section.speaker;

      if (content.length <= targets.max) {
        // Single speech fits in a chunk
        chunks.push({
          content: `${speaker}: ${content}`,
          chunkType: "speech",
          metadata: {
            book: section.book,
            chapter: section.chapter,
            lineStart: section.lineStart,
            lineEnd: section.lineEnd,
            speaker,
          },
        });
      } else {
        // Split long speech into multiple chunks
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
        let currentContent: string[] = [];

        for (const sentence of sentences) {
          const currentLen = currentContent.join(" ").length;
          if (currentLen + sentence.length > targets.max && currentContent.length > 0) {
            chunks.push({
              content: `${speaker}: ${currentContent.join(" ")}`,
              chunkType: "speech",
              metadata: {
                book: section.book,
                chapter: section.chapter,
                lineStart: section.lineStart,
                lineEnd: section.lineEnd,
                speaker,
              },
            });
            currentContent = [];
          }
          currentContent.push(sentence.trim());
        }

        if (currentContent.length > 0) {
          const remaining = currentContent.join(" ");
          if (remaining.length >= targets.min) {
            chunks.push({
              content: `${speaker}: ${remaining}`,
              chunkType: "speech",
              metadata: {
                book: section.book,
                chapter: section.chapter,
                lineStart: section.lineStart,
                lineEnd: section.lineEnd,
                speaker,
              },
            });
          } else if (chunks.length > 0) {
            // Append to last chunk
            const last = chunks[chunks.length - 1];
            last.content += " " + remaining;
          }
        }
      }
    } else {
      // Non-speech sections (chorus, stage directions)
      const content = section.content;
      if (content.length >= targets.min) {
        chunks.push({
          content,
          chunkType: "passage",
          metadata: {
            book: section.book,
            chapter: section.chapter,
            lineStart: section.lineStart,
            lineEnd: section.lineEnd,
          },
        });
      }
    }
  }

  return chunks;
}

// Chunk dialogue (Plato)
function chunkDialogue(parsed: ParsedText, config: TextConfig): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const targets = CHUNK_TARGETS.dialogue;

  let currentChunk: string[] = [];
  let currentMeta: ChunkResult["metadata"] = {};
  let firstMeta: ChunkResult["metadata"] = {};

  for (const section of parsed.sections) {
    const content = section.content;
    const currentLen = currentChunk.join(" ").length;

    // If adding this section would exceed max, flush
    if (currentLen > 0 && currentLen + content.length > targets.max) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "passage",
        metadata: firstMeta,
      });
      currentChunk = [];
      firstMeta = {};
    }

    // Start new chunk metadata
    if (currentChunk.length === 0) {
      firstMeta = {
        book: section.book,
        chapter: section.chapter,
        section: section.section,
      };
    }
    currentChunk.push(content);
    currentMeta = {
      book: section.book,
      chapter: section.chapter,
      section: section.section,
    };

    // Flush if we've reached target
    const newLen = currentChunk.join(" ").length;
    if (newLen >= targets.target) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "passage",
        metadata: firstMeta,
      });
      currentChunk = [];
      firstMeta = {};
    }
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    const content = currentChunk.join(" ");
    if (content.length >= targets.min) {
      chunks.push({
        content,
        chunkType: "passage",
        metadata: firstMeta,
      });
    } else if (chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      last.content += " " + content;
    } else if (content.length > 50) {
      chunks.push({
        content,
        chunkType: "passage",
        metadata: firstMeta,
      });
    }
  }

  return chunks;
}

// Chunk prose (Aristotle, Herodotus, Thucydides)
function chunkProse(parsed: ParsedText, config: TextConfig): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const targets = CHUNK_TARGETS.prose;

  let currentChunk: string[] = [];
  let currentMeta: ChunkResult["metadata"] = {};
  let firstMeta: ChunkResult["metadata"] = {};

  for (const section of parsed.sections) {
    const content = section.content;

    // Split very long sections first
    if (content.length > targets.max * 2) {
      // Flush current chunk first
      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join(" "),
          chunkType: "passage",
          metadata: firstMeta,
        });
        currentChunk = [];
        firstMeta = {};
      }

      // Split by sentences
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
      let splitChunk: string[] = [];

      for (const sentence of sentences) {
        const splitLen = splitChunk.join(" ").length;
        if (splitLen + sentence.length > targets.max && splitChunk.length > 0) {
          chunks.push({
            content: splitChunk.join(" "),
            chunkType: "passage",
            metadata: {
              book: section.book,
              chapter: section.chapter,
              section: section.section,
            },
          });
          splitChunk = [];
        }
        splitChunk.push(sentence.trim());
      }

      if (splitChunk.length > 0) {
        const remaining = splitChunk.join(" ");
        if (remaining.length >= targets.min) {
          chunks.push({
            content: remaining,
            chunkType: "passage",
            metadata: {
              book: section.book,
              chapter: section.chapter,
              section: section.section,
            },
          });
        }
      }
      continue;
    }

    const currentLen = currentChunk.join(" ").length;
    if (currentLen > 0 && currentLen + content.length > targets.max) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "passage",
        metadata: firstMeta,
      });
      currentChunk = [];
      firstMeta = {};
    }

    if (currentChunk.length === 0) {
      firstMeta = {
        book: section.book,
        chapter: section.chapter,
        section: section.section,
      };
    }
    currentChunk.push(content);
    currentMeta = {
      book: section.book,
      chapter: section.chapter,
      section: section.section,
    };

    const newLen = currentChunk.join(" ").length;
    if (newLen >= targets.target) {
      chunks.push({
        content: currentChunk.join(" "),
        chunkType: "passage",
        metadata: firstMeta,
      });
      currentChunk = [];
      firstMeta = {};
    }
  }

  // Flush remaining
  if (currentChunk.length > 0) {
    const content = currentChunk.join(" ");
    if (content.length >= targets.min) {
      chunks.push({
        content,
        chunkType: "passage",
        metadata: firstMeta,
      });
    } else if (chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      last.content += " " + content;
    } else if (content.length > 50) {
      chunks.push({
        content,
        chunkType: "passage",
        metadata: firstMeta,
      });
    }
  }

  return chunks;
}

// Main chunking function - routes to type-specific chunker
export function chunkText(parsed: ParsedText, config: TextConfig): ChunkResult[] {
  switch (config.form) {
    case "poetry":
      return chunkPoetry(parsed, config);
    case "drama":
      return chunkDrama(parsed, config);
    case "dialogue":
      return chunkDialogue(parsed, config);
    case "prose":
      return chunkProse(parsed, config);
    default:
      // Default to prose chunking
      return chunkProse(parsed, config);
  }
}
