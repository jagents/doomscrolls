// TEI XML parser for Perseus Digital Library texts
// Handles various TEI structures: poetry, prose, drama, dialogue

import { XMLParser } from "fast-xml-parser";
import type { TextConfig } from "./texts-config";

export interface ParsedSection {
  book?: string | number;
  chapter?: string | number;
  section?: string | number;
  card?: string | number;
  lineStart?: number;
  lineEnd?: number;
  speaker?: string;
  content: string;
  type: "verse" | "prose" | "speech";
}

export interface ParsedText {
  title: string;
  author: string;
  sections: ParsedSection[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  preserveOrder: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

// Clean text content by removing notes, tags, and normalizing whitespace
function cleanText(text: string | unknown): string {
  if (typeof text !== "string") {
    if (text === null || text === undefined) return "";
    if (typeof text === "object") {
      // Handle nested objects/arrays - try to extract text content
      return extractTextFromObject(text);
    }
    return String(text);
  }
  return text
    .replace(/<note[^>]*>.*?<\/note>/gs, "") // Remove notes
    .replace(/<[^>]+>/g, " ") // Remove remaining tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Recursively extract text from parsed XML objects
function extractTextFromObject(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number") return String(obj);
  if (Array.isArray(obj)) {
    return obj.map(extractTextFromObject).join(" ");
  }
  if (typeof obj === "object") {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip attributes
      if (key.startsWith("@_")) continue;
      // Get text content
      if (key === "#text") {
        parts.push(String(value));
      } else {
        parts.push(extractTextFromObject(value));
      }
    }
    return parts.join(" ");
  }
  return "";
}

// Extract milestone line numbers from content
function extractLineNumbers(content: unknown): { start?: number; end?: number } {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  const lineMatches = text.match(/milestone[^>]*n="(\d+)"[^>]*unit="line"/g);
  if (!lineMatches || lineMatches.length === 0) return {};

  const lines: number[] = [];
  for (const match of lineMatches) {
    const numMatch = match.match(/n="(\d+)"/);
    if (numMatch) lines.push(parseInt(numMatch[1], 10));
  }

  if (lines.length === 0) return {};
  return {
    start: Math.min(...lines),
    end: Math.max(...lines),
  };
}

// Parse a div element and extract sections
function parseDivElement(
  div: Record<string, unknown>,
  context: { book?: string; chapter?: string; section?: string; card?: string },
  form: string
): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const type = (div["@_type"] as string) || "";
  const subtype = (div["@_subtype"] as string) || "";
  const n = div["@_n"] as string;

  // Update context based on div type
  const newContext = { ...context };
  if (subtype === "book" || type === "book") {
    newContext.book = n;
  } else if (subtype === "chapter" || type === "chapter") {
    newContext.chapter = n;
  } else if (subtype === "section" || type === "section") {
    newContext.section = n;
  } else if (subtype === "card" || type === "card") {
    newContext.card = n;
  }

  // Handle nested divs
  const nestedDivs = div["div"];
  if (nestedDivs) {
    const divArray = Array.isArray(nestedDivs) ? nestedDivs : [nestedDivs];
    for (const nestedDiv of divArray) {
      if (nestedDiv && typeof nestedDiv === "object") {
        sections.push(...parseDivElement(nestedDiv as Record<string, unknown>, newContext, form));
      }
    }
  }

  // Handle drama speeches
  const speeches = div["sp"];
  if (speeches) {
    const spArray = Array.isArray(speeches) ? speeches : [speeches];
    for (const sp of spArray) {
      if (sp && typeof sp === "object") {
        const spObj = sp as Record<string, unknown>;
        let speaker = "";

        // Get speaker from speaker element or n attribute
        if (spObj["speaker"]) {
          speaker = extractTextFromObject(spObj["speaker"]);
        } else if (spObj["@_n"]) {
          speaker = String(spObj["@_n"]);
        }

        // Get speech content from l (line) elements or p elements
        let content = "";
        if (spObj["l"]) {
          const lines = Array.isArray(spObj["l"]) ? spObj["l"] : [spObj["l"]];
          content = lines.map(extractTextFromObject).join(" ");
        } else if (spObj["p"]) {
          content = extractTextFromObject(spObj["p"]);
        } else {
          content = extractTextFromObject(spObj);
        }

        content = cleanText(content);
        if (content.length > 20) {
          sections.push({
            ...newContext,
            speaker: cleanText(speaker),
            content,
            type: "speech",
          });
        }
      }
    }
  }

  // Handle paragraphs (for prose and dialogue)
  const paragraphs = div["p"];
  if (paragraphs && !speeches) {
    const pArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
    for (const p of pArray) {
      const rawContent = typeof p === "object" ? JSON.stringify(p) : String(p);
      const lineNums = extractLineNumbers(rawContent);
      const content = cleanText(extractTextFromObject(p));

      if (content.length > 20) {
        sections.push({
          ...newContext,
          lineStart: lineNums.start,
          lineEnd: lineNums.end,
          content,
          type: "prose",
        });
      }
    }
  }

  // Handle line elements (for poetry)
  const lines = div["l"];
  if (lines && !speeches && !paragraphs) {
    const lArray = Array.isArray(lines) ? lines : [lines];
    const lineContents: string[] = [];
    let startLine: number | undefined;
    let endLine: number | undefined;

    for (const l of lArray) {
      if (l && typeof l === "object") {
        const lObj = l as Record<string, unknown>;
        const lineNum = lObj["@_n"] ? parseInt(String(lObj["@_n"]), 10) : undefined;
        if (lineNum !== undefined) {
          if (startLine === undefined) startLine = lineNum;
          endLine = lineNum;
        }
        lineContents.push(extractTextFromObject(lObj));
      } else if (l) {
        lineContents.push(String(l));
      }
    }

    const content = cleanText(lineContents.join(" "));
    if (content.length > 20) {
      sections.push({
        ...newContext,
        lineStart: startLine,
        lineEnd: endLine,
        content,
        type: "verse",
      });
    }
  }

  return sections;
}

// Main parse function
export async function parseTEI(filePath: string, config: TextConfig): Promise<ParsedText> {
  const file = Bun.file(filePath);
  const xml = await file.text();

  // Parse XML
  const parsed = parser.parse(xml);

  // Navigate to text/body
  const tei = parsed.TEI || parsed["TEI"];
  if (!tei) {
    throw new Error(`No TEI root element found in ${filePath}`);
  }

  const text = tei.text || tei["text"];
  if (!text) {
    throw new Error(`No text element found in ${filePath}`);
  }

  const body = text.body || text["body"];
  if (!body) {
    throw new Error(`No body element found in ${filePath}`);
  }

  // Get title and author from header
  const header = tei.teiHeader || tei["teiHeader"];
  let title = config.title;
  let author = config.author;

  if (header) {
    const fileDesc = header.fileDesc || header["fileDesc"];
    if (fileDesc) {
      const titleStmt = fileDesc.titleStmt || fileDesc["titleStmt"];
      if (titleStmt) {
        if (titleStmt.title) {
          const titleEl = Array.isArray(titleStmt.title) ? titleStmt.title[0] : titleStmt.title;
          const extractedTitle = extractTextFromObject(titleEl);
          if (extractedTitle) title = cleanText(extractedTitle);
        }
        if (titleStmt.author) {
          const extractedAuthor = extractTextFromObject(titleStmt.author);
          if (extractedAuthor) author = cleanText(extractedAuthor);
        }
      }
    }
  }

  // Parse body content
  const sections: ParsedSection[] = [];

  // Get the main translation div or all divs
  let mainDivs = body.div || body["div"];
  if (!mainDivs) {
    return { title, author, sections };
  }

  if (!Array.isArray(mainDivs)) {
    mainDivs = [mainDivs];
  }

  for (const div of mainDivs) {
    if (div && typeof div === "object") {
      sections.push(...parseDivElement(div as Record<string, unknown>, {}, config.form));
    }
  }

  return { title, author, sections };
}

// Test if a file exists and is parseable
export async function testParseTEI(filePath: string): Promise<boolean> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return false;
    }
    const xml = await file.text();
    parser.parse(xml);
    return true;
  } catch {
    return false;
  }
}
