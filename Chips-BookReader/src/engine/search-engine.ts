import type { EpubBook } from "../domain/epub/types";

export interface SearchResult {
  sectionIndex: number;
  sectionTitle: string;
  excerpt: string;
  matchOffset: number;
  matchLength: number;
  query: string;
}

export interface SearchOptions {
  maxResults?: number;
  onProgress?: (currentSection: number, totalSections: number) => void;
}

const SEARCH_STYLE_ID = "book-reader-search-highlights";

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

function extractPlainText(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  return (document.body?.textContent ?? document.documentElement.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExcerpt(text: string, offset: number, matchLength: number): string {
  const before = Math.max(0, offset - 40);
  const after = Math.min(text.length, offset + matchLength + 40);
  const prefix = before > 0 ? "..." : "";
  const suffix = after < text.length ? "..." : "";
  return `${prefix}${text.slice(before, after).trim()}${suffix}`;
}

export interface ExcerptSegments {
  before: string;
  match: string;
  after: string;
}

export function splitExcerptIntoMatchSegments(excerpt: string, query: string): ExcerptSegments {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return { before: excerpt, match: "", after: "" };
  }

  const matchIndex = excerpt.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return { before: excerpt, match: "", after: "" };
  }

  return {
    before: excerpt.slice(0, matchIndex),
    match: excerpt.slice(matchIndex, matchIndex + normalizedQuery.length),
    after: excerpt.slice(matchIndex + normalizedQuery.length),
  };
}

function isHighlightableTextNode(node: Node): node is Text {
  if (node.nodeType !== Node.TEXT_NODE) {
    return false;
  }

  const parentName = node.parentElement?.localName.toLowerCase();
  return parentName !== "script" && parentName !== "style" && parentName !== "noscript" && parentName !== "mark";
}

export class SearchEngine {
  private cancelToken = 0;

  public constructor(private readonly book: EpubBook) {}

  public async *search(
    query: string,
    options?: SearchOptions,
  ): AsyncGenerator<SearchResult[], void, undefined> {
    const token = ++this.cancelToken;
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) {
      return;
    }

    const maxResults = options?.maxResults ?? Number.POSITIVE_INFINITY;
    const totalSections = this.book.sections.length;
    let totalResults = 0;

    for (let index = 0; index < this.book.sections.length; index += 1) {
      if (token !== this.cancelToken || totalResults >= maxResults) {
        return;
      }

      options?.onProgress?.(index + 1, totalSections);
      const section = this.book.sections[index];

      let text = "";
      try {
        text = extractPlainText(await this.book.archive.readText(section.path));
      } catch {
        continue;
      }

      if (!text) {
        continue;
      }

      const normalizedText = text.toLowerCase();
      const batch: SearchResult[] = [];
      let offset = 0;

      while (offset < normalizedText.length && totalResults < maxResults) {
        const matchIndex = normalizedText.indexOf(normalizedQuery, offset);
        if (matchIndex < 0) {
          break;
        }

        batch.push({
          sectionIndex: index,
          sectionTitle: section.title,
          excerpt: buildExcerpt(text, matchIndex, normalizedQuery.length),
          matchOffset: matchIndex,
          matchLength: normalizedQuery.length,
          query: normalizedQuery,
        });

        totalResults += 1;
        offset = matchIndex + Math.max(1, normalizedQuery.length);
      }

      if (batch.length > 0) {
        yield batch;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  public cancel(): void {
    this.cancelToken += 1;
  }

  public highlightInDocument(document: Document, results: SearchResult[], currentIndex: number): void {
    this.clearHighlights(document);
    if (results.length === 0) {
      return;
    }

    const query = normalizeSearchQuery(results[0]?.query ?? "");
    if (!query || !document.body) {
      return;
    }

    this.ensureHighlightStyles(document);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (isHighlightableTextNode(currentNode)) {
        textNodes.push(currentNode);
      }
      currentNode = walker.nextNode();
    }

    for (const node of textNodes) {
      const content = node.textContent ?? "";
      const normalizedContent = content.toLowerCase();
      let offset = 0;
      let matchIndex = normalizedContent.indexOf(query, offset);

      if (matchIndex < 0) {
        continue;
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      while (matchIndex >= 0) {
        if (matchIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(content.slice(lastIndex, matchIndex)));
        }

        const mark = document.createElement("mark");
        mark.dataset.searchResult = "true";
        mark.textContent = content.slice(matchIndex, matchIndex + query.length);
        fragment.appendChild(mark);

        lastIndex = matchIndex + query.length;
        matchIndex = normalizedContent.indexOf(query, lastIndex);
      }

      if (lastIndex < content.length) {
        fragment.appendChild(document.createTextNode(content.slice(lastIndex)));
      }

      node.parentNode?.replaceChild(fragment, node);
    }

    const marks = Array.from(document.querySelectorAll<HTMLElement>("mark[data-search-result]"));
    const currentMark = marks[currentIndex];
    currentMark?.classList.add("search-current");
    if (currentMark && typeof currentMark.scrollIntoView === "function") {
      currentMark.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "auto",
      });
    }
  }

  public clearHighlights(document: Document): void {
    const marks = Array.from(document.querySelectorAll<HTMLElement>("mark[data-search-result]"));
    for (const mark of marks) {
      const parent = mark.parentNode;
      if (!parent) {
        continue;
      }

      parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
      parent.normalize();
    }
  }

  private ensureHighlightStyles(document: Document): void {
    if (document.getElementById(SEARCH_STYLE_ID)) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = SEARCH_STYLE_ID;
    styleElement.textContent = `
mark[data-search-result] {
  background: rgba(255, 214, 10, 0.28);
  color: inherit;
  border-radius: 0.35em;
  padding: 0 0.08em;
  box-shadow: inset 0 -0.08em 0 rgba(255, 159, 10, 0.28);
}

mark[data-search-result].search-current {
  background: rgba(255, 159, 10, 0.6);
  box-shadow: inset 0 -0.08em 0 rgba(255, 159, 10, 0.48);
}
`;

    (document.head ?? document.documentElement).appendChild(styleElement);
  }
}
