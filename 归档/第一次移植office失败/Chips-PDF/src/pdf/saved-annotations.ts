import type { PDFDocumentProxy } from "pdfjs-dist";
import { MARKUP_TYPE_BY_ANNOT } from "./annotations";
import { toSavedNote, type PdfJsAnnotData, type SavedNoteAnnot } from "./notes";

export interface SavedMarkupAnnot {
  pageIndex: number;
  /** PDF 对象号（pdf.js id "123R" → 123） */
  objNum: number;
  type: "highlight" | "underline" | "strikeout";
  quads: number[][];
  rect: [number, number, number, number];
}

export interface PageSavedAnnots {
  markups: SavedMarkupAnnot[];
  notes: SavedNoteAnnot[];
}

/**
 * 读取一页已保存的文本标记与便签批注（直接来自 pdf.js）。
 * 页面不可读时返回空集合，不阻塞阅读。
 */
export async function loadSavedAnnots(
  doc: PDFDocumentProxy,
  origIdx: number,
): Promise<PageSavedAnnots> {
  try {
    const page = await doc.getPage(origIdx + 1);
    const annots = (await page.getAnnotations()) as (PdfJsAnnotData & {
      quadPoints?: Float32Array | null;
    })[];
    const markups = annots.flatMap((a) => {
      const type = MARKUP_TYPE_BY_ANNOT[a.annotationType];
      const objNum = /^(\d+)R$/.exec(a.id);
      if (!type || !objNum || !a.quadPoints || a.quadPoints.length < 8) return [];
      const quads: number[][] = [];
      for (let q = 0; q + 8 <= a.quadPoints.length; q += 8) {
        quads.push([...a.quadPoints.slice(q, q + 8)]);
      }
      if (!Array.isArray(a.rect) || a.rect.length !== 4) return [];
      return [
        {
          pageIndex: origIdx,
          objNum: Number(objNum[1]),
          type,
          quads,
          rect: [a.rect[0], a.rect[1], a.rect[2], a.rect[3]] as [number, number, number, number],
        },
      ];
    });
    const notes = annots.flatMap((a) => {
      const note = toSavedNote(a, origIdx);
      return note ? [note] : [];
    });
    return { markups, notes };
  } catch {
    return { markups: [], notes: [] };
  }
}
