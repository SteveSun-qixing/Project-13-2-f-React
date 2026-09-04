import type { PDFDocumentProxy } from "pdfjs-dist";

/** 一次命中：原始页下标 + PDF 用户空间矩形（跨多个文本项时为多个矩形） */
export interface SearchMatch {
  pageIndex: number;
  rects: [number, number, number, number][];
}

interface IndexedItem {
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageEntry {
  /** 原文（与 lower 等长；用于上下文摘要） */
  text: string;
  lower: string;
  items: IndexedItem[];
}

export type SearchIndex = PageEntry[];

const MAX_MATCHES = 1000;

interface RawTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

/** 逐页拼接文本并记录每个文本项的字符区间与 PDF 空间盒子（每个文档构建一次，由调用方缓存） */
export async function buildSearchIndex(doc: PDFDocumentProxy): Promise<SearchIndex> {
  const entries: PageEntry[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let text = "";
    const items: IndexedItem[] = [];
    for (const it of content.items as RawTextItem[]) {
      if (typeof it.str !== "string") continue;
      if (it.str.length > 0 && it.transform) {
        const h = it.height || Math.hypot(it.transform[2] ?? 0, it.transform[3] ?? 0);
        items.push({
          start: text.length,
          end: text.length + it.str.length,
          x: it.transform[4] ?? 0,
          y: it.transform[5] ?? 0,
          w: it.width ?? 0,
          h,
        });
        text += it.str;
      }
      if (it.hasEOL) text += "\n";
    }
    entries.push({ text, lower: text.toLowerCase(), items });
  }
  return entries;
}

/** 大小写不敏感全文搜索；矩形按字符比例在文本项内线性插值（近似） */
export function searchInIndex(index: SearchIndex, query: string): SearchMatch[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const matches: SearchMatch[] = [];
  for (let pageIndex = 0; pageIndex < index.length; pageIndex++) {
    const entry = index[pageIndex];
    if (!entry) continue;
    const { lower, items } = entry;
    let from = 0;
    while (matches.length < MAX_MATCHES) {
      const s = lower.indexOf(q, from);
      if (s < 0) break;
      const e = s + q.length;
      from = e;
      const rects: [number, number, number, number][] = [];
      for (const it of items) {
        if (it.end <= s || it.start >= e) continue;
        const len = it.end - it.start;
        const lo = (Math.max(s, it.start) - it.start) / len;
        const hi = (Math.min(e, it.end) - it.start) / len;
        const x1 = it.x + it.w * lo;
        const x2 = it.x + it.w * hi;
        if (x2 - x1 < 0.01) continue;
        rects.push([x1, it.y, x2, it.y + it.h]);
      }
      if (rects.length > 0) matches.push({ pageIndex, rects });
    }
    if (matches.length >= MAX_MATCHES) break;
  }
  return matches;
}
