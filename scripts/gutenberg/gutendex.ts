// Gutendex API Client

import { RATE_LIMITS } from "./config";

const BASE_URL = "https://gutendex.com/books/";

export interface GutenbergAuthor {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  formats: Record<string, string>;
  download_count: number;
}

export interface GutendexResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = RATE_LIMITS.RETRY_COUNT, timeoutMs = 120000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }
      if (response.status === 429 || response.status >= 500) {
        // Rate limited or server error - retry
        if (attempt < retries) {
          const delay = RATE_LIMITS.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`  Retry ${attempt + 1}/${retries} after ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`  Request timed out after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        const delay = RATE_LIMITS.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`  Retry ${attempt + 1}/${retries} after ${delay}ms (${error})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function fetchPopularBooks(page: number = 1): Promise<GutendexResponse> {
  await sleep(RATE_LIMITS.API_DELAY_MS);
  const url = `${BASE_URL}?sort=popular&page=${page}`;
  const response = await fetchWithRetry(url);
  return response.json();
}

export async function searchBooks(query: string, page: number = 1): Promise<GutendexResponse> {
  await sleep(RATE_LIMITS.API_DELAY_MS);
  const url = `${BASE_URL}?search=${encodeURIComponent(query)}&page=${page}`;
  const response = await fetchWithRetry(url);
  return response.json();
}

export async function fetchBooksByTopic(topic: string, page: number = 1): Promise<GutendexResponse> {
  await sleep(RATE_LIMITS.API_DELAY_MS);
  const url = `${BASE_URL}?topic=${encodeURIComponent(topic)}&page=${page}`;
  const response = await fetchWithRetry(url);
  return response.json();
}

export async function fetchAllPages(
  fetcher: (page: number) => Promise<GutendexResponse>,
  maxBooks?: number
): Promise<GutenbergBook[]> {
  const allBooks: GutenbergBook[] = [];
  let page = 1;

  while (true) {
    const response = await fetcher(page);
    allBooks.push(...response.results);

    if (maxBooks && allBooks.length >= maxBooks) {
      return allBooks.slice(0, maxBooks);
    }

    if (!response.next) {
      break;
    }
    page++;
  }

  return allBooks;
}

export function getTextUrl(book: GutenbergBook): string | null {
  // Prefer UTF-8 encoded plain text
  const formats = book.formats;

  // Try different format keys in order of preference
  const preferredKeys = [
    "text/plain; charset=utf-8",
    "text/plain",
  ];

  for (const key of preferredKeys) {
    if (formats[key] && !formats[key].endsWith('.zip')) {
      return formats[key];
    }
  }

  // Fallback to cache URL
  return `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`;
}

export async function downloadText(url: string): Promise<string | null> {
  await sleep(RATE_LIMITS.DOWNLOAD_DELAY_MS);
  try {
    // Use longer timeout for text downloads (3 min for large books)
    const response = await fetchWithRetry(url, RATE_LIMITS.RETRY_COUNT, 180000);
    return response.text();
  } catch (error) {
    console.error(`  Failed to download: ${error}`);
    return null;
  }
}
