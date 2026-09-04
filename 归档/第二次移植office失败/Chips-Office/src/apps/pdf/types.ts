import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

export interface PageSize {
  width: number;
  height: number;
}

export type DocumentStatus = "idle" | "loading" | "password" | "error" | "ready";

export type ZoomMode = "fit-width" | "fit-page" | "custom";

export interface ZoomState {
  mode: ZoomMode;
  scale: number;
}

export interface Annotation {
  id: string;
  pageIndex: number;
  type: "highlight" | "underline" | "comment";
  rect: AnnotationRect;
  color: string;
  text?: string;
  author?: string;
  createdAt: number;
}

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  results: SearchResult[];
  currentIndex: number;
  isSearching: boolean;
}

export interface SearchResult {
  pageIndex: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface PdfDocumentInfo {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  isLinearized?: boolean;
}

export interface ThumbnailCache {
  [pageIndex: number]: ImageBitmap | string;
}

export interface LoadingTaskState {
  token: number;
  cancelled: boolean;
}
