import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/**
 * pdf.js 运行时静态资源基址。构建脚本把 node_modules 中的
 * cmaps 与 standard_fonts 原样复制到 public/pdfjs/，Vite 构建后
 * 位于 dist/pdfjs/，与 index.html 同级，因此相对 document.baseURI 解析。
 */
export const PDFJS_ASSET_BASE = new URL("pdfjs/", document.baseURI).href;

export const DOC_OPTIONS = {
  cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
} as const;

GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument };
export type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
