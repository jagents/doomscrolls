// Parser exports and interface
import * as cheerio from 'cheerio';

export interface ParsedChunk {
  content: string;
  chunkType: string;
  metadata: {
    chapter?: number;
    verse?: number;
    section?: number;
    book?: number;
    title?: string;
    tradition: string;
  };
}

export interface Parser {
  parse(html: string, tradition: string, chapterNum?: number): ParsedChunk[];
  parseGutenberg?(text: string, tradition: string): ParsedChunk[];
}

// Export all parsers
export { parseTaoTeChing } from './tao-te-ching';
export { parseBhagavadGita } from './bhagavad-gita';
export { parseDhammapada } from './dhammapada';
export { parseAnalects } from './analects';
export { parseMeditations } from './meditations';
export { parseEnchiridion } from './enchiridion';
export { parseArtOfWar } from './art-of-war';
export { parseProphet } from './prophet';
export { parseUpanishads } from './upanishads';
export { parseGeneric } from './generic';
