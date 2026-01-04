// Core Wikiquote scraper function
// Extracts quotes from a Wikiquote author page

import * as cheerio from 'cheerio';
import { fetchText } from '../../src/utils/fetch';

export interface ScrapedQuote {
  content: string;
  section?: string;
}

export interface FetchAuthorResult {
  success: boolean;
  authorName: string;
  wikiquoteUrl: string;
  quotes: ScrapedQuote[];
  error?: string;
}

function authorToUrl(name: string): string {
  return `https://en.wikiquote.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`;
}

function isValidQuote(text: string): boolean {
  // Length filters
  if (text.length < 20 || text.length > 1000) {
    return false;
  }

  // Skip metadata and navigation
  const lowerText = text.toLowerCase();
  if (
    text.includes('==') ||
    text.startsWith('[') ||
    text.startsWith('(') ||
    lowerText.startsWith('see also') ||
    lowerText.startsWith('external links') ||
    lowerText.startsWith('references') ||
    lowerText.startsWith('notes') ||
    lowerText.includes('wikiquote') ||
    lowerText.includes('wikipedia') ||
    lowerText.includes('isbn') ||
    lowerText.includes('retrieved') ||
    /^\d{4}[-–]\d{4}$/.test(text.trim()) || // Date ranges
    /^p\.\s*\d+/.test(text.trim()) // Page numbers
  ) {
    return false;
  }

  return true;
}

function extractQuotes($: cheerio.CheerioAPI): ScrapedQuote[] {
  const quotes: ScrapedQuote[] = [];
  const seen = new Set<string>();

  const content = $('div.mw-parser-output');

  // Sections to skip
  const skipSections = [
    'quotes about',
    'misattributed',
    'disputed',
    'wrongly attributed',
    'about',
    'see also',
    'external links',
    'references',
    'notes',
    'sources',
    'further reading'
  ];

  let currentSection = 'Quotes';
  let inSkipSection = false;

  content.children().each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase();

    // Track section headers
    if (tagName === 'h2' || tagName === 'h3') {
      const headerText = $el.find('.mw-headline').text() || $el.text();
      const lowerHeader = headerText.toLowerCase();
      currentSection = headerText;
      inSkipSection = skipSections.some(skip => lowerHeader.includes(skip));
      return;
    }

    // Skip if in a section we don't want
    if (inSkipSection) return;

    // Skip table of contents and navigation
    if ($el.attr('id') === 'toc' || $el.hasClass('toc') || $el.hasClass('navbox') || $el.hasClass('metadata')) {
      return;
    }

    // Extract from unordered lists (main quote format)
    if (tagName === 'ul') {
      $el.children('li').each((_, li) => {
        const $li = $(li);

        // Get direct text, excluding nested lists (attributions)
        const $clone = $li.clone();
        $clone.find('ul, dl, ol').remove();
        let quoteText = $clone.text()
          .replace(/\s+/g, ' ')
          .replace(/^\s*[-–—•*]\s*/, '')
          .trim();

        // Clean up common artifacts
        quoteText = quoteText
          .replace(/\[\d+\]/g, '') // Remove citation markers
          .replace(/\s+/g, ' ')
          .trim();

        if (isValidQuote(quoteText) && !seen.has(quoteText)) {
          quotes.push({ content: quoteText, section: currentSection });
          seen.add(quoteText);
        }
      });
    }

    // Also check definition lists (alternative format)
    if (tagName === 'dl') {
      $el.children('dd').each((_, dd) => {
        const $dd = $(dd);
        const $clone = $dd.clone();
        $clone.find('dl, ul, ol').remove();
        let quoteText = $clone.text()
          .replace(/\s+/g, ' ')
          .replace(/\[\d+\]/g, '')
          .trim();

        if (isValidQuote(quoteText) && !seen.has(quoteText)) {
          quotes.push({ content: quoteText, section: currentSection });
          seen.add(quoteText);
        }
      });
    }
  });

  return quotes;
}

export async function fetchAuthorQuotes(authorName: string): Promise<FetchAuthorResult> {
  const url = authorToUrl(authorName);

  try {
    const html = await fetchText(url, { rateLimit: 500, timeout: 30000 });
    const $ = cheerio.load(html);
    const quotes = extractQuotes($);

    return {
      success: true,
      authorName,
      wikiquoteUrl: url,
      quotes
    };
  } catch (error) {
    // Try alternative URL formats
    if (error instanceof Error && error.message.includes('Not found')) {
      const altFormats = ['_(author)', '_(writer)', '_(philosopher)', '_(poet)'];

      for (const suffix of altFormats) {
        try {
          const altUrl = `https://en.wikiquote.org/wiki/${encodeURIComponent(authorName.replace(/ /g, '_'))}${suffix}`;
          const html = await fetchText(altUrl, { rateLimit: 500, timeout: 30000 });
          const $ = cheerio.load(html);
          const quotes = extractQuotes($);

          return {
            success: true,
            authorName,
            wikiquoteUrl: altUrl,
            quotes
          };
        } catch {
          continue;
        }
      }
    }

    return {
      success: false,
      authorName,
      wikiquoteUrl: url,
      quotes: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
