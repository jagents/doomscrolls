// Data models for Doomscrolls ingestion pipeline

export interface Author {
  id: string;
  name: string;
  slug: string;
  birth_year: number | null;
  death_year: number | null;
  nationality: string | null;
  era: string | null;
  bio: string | null;
  wikipedia_url: string | null;
  created_at: string;
}

export interface Work {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  original_language: string;
  publication_year: number | null;
  genre: string | null;
  form: string | null;
  source: string;
  source_id: string | null;
  created_at: string;
}

export interface Chunk {
  id: string;
  work_id: string | null;
  author_id: string;
  content: string;
  chunk_index: number;
  chunk_type: string;
  source: string;
  source_metadata: Record<string, unknown>;
  created_at: string;
}

export interface Progress {
  completed: string[];
  last_updated: string;
}

// Source-specific response types

export interface PoetryDBPoem {
  title: string;
  author: string;
  lines: string[];
  linecount: string;
}

export interface BibleVerse {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleAPIResponse {
  reference: string;
  verses: BibleVerse[];
  text: string;
  translation_name: string;
}

export type SourceType = 'poetrydb' | 'bible' | 'wikiquote';

// Extended Author type for Wikiquote with additional metadata
export interface WikiquoteAuthor extends Author {
  wikiquote_url: string;
  quote_count: number;
  discovery_method: 'curated' | 'category-crawl';
  tier: 1 | 2 | 3;
}
