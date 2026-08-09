// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import type { EpubThemePalette } from "../epub/types";
import type { ReaderPreferences, ReaderReadingMode } from "../../utils/book-reader";
import {
  computeResponsiveReadiumLayout,
  type ReadiumResponsiveLayout,
} from "./layout";
import { isStyleElementNode, resolveDocumentScrollingElement } from "../../utils/dom";

type ReadiumProfile = "default" | "rtl" | "cjk-horizontal" | "cjk-vertical";
type ReadiumStyleMod = "before" | "default" | "after";

export type ReadiumDirection = "previous" | "next";
export type ReadiumBoundary = "start" | "end";

export interface ReadiumPaginationInfo {
  totalColumns: number | undefined;
  currentColumn: number | undefined;
  isTwoPageSpread: boolean | undefined;
  spreadIndex: number | undefined;
}

interface ReadiumCssSettings {
  paged: boolean;
  colCount?: "auto" | "1" | "2";
  textAlign?: "left" | "right" | "justify" | "start";
  lineHeight?: string;
  letterSpacing?: string;
  wordSpacing?: string;
  pageMargins?: string;
  paraIndent?: string;
  paraSpacing?: string;
  bodyHyphens?: "auto" | "none";
  backgroundColor?: string;
  textColor?: string;
  selectionBackgroundColor?: string;
  selectionTextColor?: string;
  linkColor?: string;
  linkVisitedColor?: string;
  font?: "DEFAULT" | "OLD" | "SANS" | string;
  fontSize?: string;
  typeScale?: string;
  noFootnotes?: boolean;
  noTemporaryNavTargetOutline?: boolean;
  noRuby?: boolean;
  reduceMotion?: boolean;
}

interface ReadiumPresentationOptions {
  preferences: ReaderPreferences;
  theme: EpubThemePalette;
}

interface ReadiumPaginationSnapshot {
  offset: number;
  unit: number;
  limit: number;
}

const CLASS_PAGINATED = "r2-css-paginated";
const CLASS_VWM = "r2-class-VWM";
const ROOT_CLASS_NO_FOOTNOTES = "r2-no-popup-foonotes";
const ROOT_CLASS_NO_RUBY = "r2-no-ruby";
const ROOT_CLASS_REDUCE_MOTION = "r2-reduce-motion";
const DISABLE_TEMPORARY_NAV_TARGET_OUTLINE_CLASS = "r2-no-link-target-temp-highlight";
const FOOTNOTE_FORCE_SHOW = "r2-footnote-force-show";

const CSS_PIXEL_TOLERANCE = 5;
const BEFORE_STYLE_ID = "book-reader-readium-before";
const DEFAULT_STYLE_ID = "book-reader-readium-default";
const AFTER_STYLE_ID = "book-reader-readium-after";
const PATCH_STYLE_ID = "book-reader-readium-patch";
const SUPPLEMENTAL_STYLE_ID = "book-reader-supplemental";

const STYLE_ASSET_URLS: Record<ReadiumProfile, Record<ReadiumStyleMod, string>> = {
  default: {
    before: new URL("./assets/ReadiumCSS/ReadiumCSS-before.css", import.meta.url).href,
    default: new URL("./assets/ReadiumCSS/ReadiumCSS-default.css", import.meta.url).href,
    after: new URL("./assets/ReadiumCSS/ReadiumCSS-after.css", import.meta.url).href,
  },
  rtl: {
    before: new URL("./assets/ReadiumCSS/rtl/ReadiumCSS-before.css", import.meta.url).href,
    default: new URL("./assets/ReadiumCSS/rtl/ReadiumCSS-default.css", import.meta.url).href,
    after: new URL("./assets/ReadiumCSS/rtl/ReadiumCSS-after.css", import.meta.url).href,
  },
  "cjk-horizontal": {
    before: new URL("./assets/ReadiumCSS/cjk-horizontal/ReadiumCSS-before.css", import.meta.url).href,
    default: new URL("./assets/ReadiumCSS/cjk-horizontal/ReadiumCSS-default.css", import.meta.url).href,
    after: new URL("./assets/ReadiumCSS/cjk-horizontal/ReadiumCSS-after.css", import.meta.url).href,
  },
  "cjk-vertical": {
    before: new URL("./assets/ReadiumCSS/cjk-vertical/ReadiumCSS-before.css", import.meta.url).href,
    default: new URL("./assets/ReadiumCSS/cjk-vertical/ReadiumCSS-default.css", import.meta.url).href,
    after: new URL("./assets/ReadiumCSS/cjk-vertical/ReadiumCSS-after.css", import.meta.url).href,
  },
};

const FONT_ASSET_URLS = {
  "fonts/AccessibleDfA.otf": new URL("./assets/ReadiumCSS/fonts/AccessibleDfA.otf", import.meta.url).href,
  "fonts/AccessibleDfA-Regular.woff2": new URL("./assets/ReadiumCSS/fonts/AccessibleDfA-Regular.woff2", import.meta.url).href,
  "fonts/AccessibleDfA-Regular.woff": new URL("./assets/ReadiumCSS/fonts/AccessibleDfA-Regular.woff", import.meta.url).href,
  "fonts/AccessibleDfA-Bold.woff2": new URL("./assets/ReadiumCSS/fonts/AccessibleDfA-Bold.woff2", import.meta.url).href,
  "fonts/AccessibleDfA-Italic.woff2": new URL("./assets/ReadiumCSS/fonts/AccessibleDfA-Italic.woff2", import.meta.url).href,
  "fonts/iAWriterDuospace-Regular.ttf": new URL("./assets/ReadiumCSS/fonts/iAWriterDuospace-Regular.ttf", import.meta.url).href,
} as const;

const CSS_TEXT_CACHE = new Map<string, Promise<string>>();

const READIUM_PATCH_CSS = `
@namespace epub "http://www.idpf.org/2007/ops";

div[epub|type~="pagebreak"]:empty,
div[role~="doc-pagebreak"]:empty {
  line-height: 0 !important;
}

*[epub|type~="pagebreak"]:empty::before,
*[role~="doc-pagebreak"]:empty::before {
  display: contents;
  content: "\\feff";
}

:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="footnote"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="note"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="endnote"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="rearnote"]:not(.${FOOTNOTE_FORCE_SHOW}) {
  display: none;
}

audio[controls] {
  width: revert !important;
  height: revert !important;
}

:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) div {
  letter-spacing: var(--USER__letterSpacing);
  font-variant: none;
}

:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) div {
  word-spacing: var(--USER__wordSpacing);
}
`;

function scheduleAnimationFrame(windowRef: Window, callback: () => void): number {
  if (typeof windowRef.requestAnimationFrame === "function") {
    return windowRef.requestAnimationFrame(callback);
  }

  return windowRef.setTimeout(callback, 16);
}

function cancelAnimationFrameSchedule(windowRef: Window, handle: number): void {
  if (typeof windowRef.cancelAnimationFrame === "function") {
    windowRef.cancelAnimationFrame(handle);
    return;
  }

  windowRef.clearTimeout(handle);
}

function waitForAnimationFrame(windowRef: Window): Promise<void> {
  return new Promise((resolve) => {
    scheduleAnimationFrame(windowRef, () => resolve());
  });
}

async function waitForLayoutPasses(document: Document, count = 2): Promise<void> {
  const view = document.defaultView;
  if (!view) {
    return;
  }

  for (let index = 0; index < count; index += 1) {
    await waitForAnimationFrame(view);
  }
}

function getScrollingElement(document: Document): HTMLElement {
  return resolveDocumentScrollingElement(document);
}

function hasPublisherStyles(document: Document): boolean {
  const head = document.head;
  if (!head) {
    return false;
  }

  for (const child of Array.from(head.children)) {
    const localName = child.localName.toLowerCase();
    if (localName === "style") {
      return true;
    }

    if (
      localName === "link" &&
      (child.getAttribute("rel")?.trim().toLowerCase() === "stylesheet" ||
        child.getAttribute("type")?.trim().toLowerCase() === "text/css")
    ) {
      return true;
    }
  }

  return Boolean(document.body?.getAttribute("style"));
}

function ensureHead(document: Document): HTMLHeadElement {
  if (document.head) {
    return document.head;
  }

  const head = document.createElement("head");
  if (document.body) {
    document.documentElement.insertBefore(head, document.body);
  } else {
    document.documentElement.appendChild(head);
  }
  return head;
}

function ensureStyleElement(document: Document, id: string, cssText: string, options?: { prepend?: boolean }): void {
  const head = ensureHead(document);
  const existing = document.getElementById(id);
  if (isStyleElementNode(existing)) {
    if (existing.textContent !== cssText) {
      existing.textContent = cssText;
    }
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = id;
  styleElement.type = "text/css";
  styleElement.textContent = cssText;

  if (options?.prepend && head.firstChild) {
    head.insertBefore(styleElement, head.firstChild);
    return;
  }

  head.appendChild(styleElement);
}

function removeStyleElement(document: Document, id: string): void {
  document.getElementById(id)?.remove();
}

function isDocJapanese(document: Document): boolean {
  const lang = (
    document.documentElement.getAttribute("lang") ||
    document.documentElement.getAttribute("xml:lang") ||
    document.documentElement.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") ||
    ""
  ).trim().toLowerCase();

  return lang === "ja" || lang.startsWith("ja-");
}

function isDocCjk(document: Document): boolean {
  const lang = (
    document.documentElement.getAttribute("lang") ||
    document.documentElement.getAttribute("xml:lang") ||
    document.documentElement.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") ||
    ""
  ).trim().toLowerCase();

  return (
    lang === "ja" ||
    lang.startsWith("ja-") ||
    lang === "zh" ||
    lang.startsWith("zh-") ||
    lang === "ko" ||
    lang.startsWith("ko-")
  );
}

function isDocRtl(document: Document): boolean {
  let rtl = false;
  let foundDir = false;

  const htmlDir = document.documentElement.getAttribute("dir")?.trim().toLowerCase();
  if (htmlDir === "rtl") {
    foundDir = true;
    rtl = true;
  }

  if (!rtl) {
    const bodyDir = document.body?.getAttribute("dir")?.trim().toLowerCase();
    if (bodyDir === "rtl") {
      foundDir = true;
      rtl = true;
    }
  }

  if (!rtl) {
    const lang = (
      document.documentElement.getAttribute("lang") ||
      document.documentElement.getAttribute("xml:lang") ||
      document.documentElement.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") ||
      ""
    )
      .trim()
      .toLowerCase();

    rtl = lang === "ar" || lang.startsWith("ar-") || lang === "he" || lang.startsWith("he-") || lang === "fa" || lang.startsWith("fa-");
  }

  if (rtl && !foundDir) {
    document.documentElement.setAttribute("dir", "rtl");
  }

  return rtl;
}

function computeVerticalRtl(document: Document): { isVertical: boolean; isRtl: boolean } {
  const view = document.defaultView;
  if (!view) {
    return {
      isVertical: false,
      isRtl: isDocRtl(document),
    };
  }

  let isRtl = isDocRtl(document);
  let isVertical = false;

  const htmlStyle = view.getComputedStyle(document.documentElement);
  let prop = htmlStyle.getPropertyValue("direction");
  if (prop.includes("rtl")) {
    isRtl = true;
  }

  prop = htmlStyle.getPropertyValue("writing-mode") || htmlStyle.getPropertyValue("-epub-writing-mode");
  if (prop.includes("vertical")) {
    isVertical = true;
  }
  if (prop.includes("-rl")) {
    isRtl = true;
  }

  if (document.body) {
    const bodyStyle = view.getComputedStyle(document.body);
    prop = bodyStyle.getPropertyValue("direction");
    if (prop.includes("rtl")) {
      isRtl = true;
    }

    prop = bodyStyle.getPropertyValue("writing-mode") || bodyStyle.getPropertyValue("-epub-writing-mode");
    if (prop.includes("vertical")) {
      isVertical = true;
    }
    if (prop.includes("-rl")) {
      isRtl = true;
    }
  }

  return {
    isVertical,
    isRtl,
  };
}

function isPaginated(document: Document): boolean {
  return document.documentElement.classList.contains(CLASS_PAGINATED);
}

function isTwoPageSpread(document: Document): boolean {
  if (!document.body || !document.defaultView || !isPaginated(document)) {
    return false;
  }

  const docStyle = document.defaultView.getComputedStyle(document.documentElement);
  const scrollElement = getScrollingElement(document);
  const bodyStyle = document.defaultView.getComputedStyle(document.body);
  const columnCount = Number.parseInt(docStyle.getPropertyValue("column-count"), 10);
  const bodyWidth = Number.parseInt(bodyStyle.width, 10);

  let paginatedTwo = columnCount === 2;
  if (paginatedTwo && bodyWidth * 2 > scrollElement.clientWidth) {
    paginatedTwo = false;
  }

  if (Number.isNaN(columnCount) && bodyWidth * 2 <= scrollElement.clientWidth + 10) {
    paginatedTwo = true;
  }

  return paginatedTwo;
}

function calculateDocumentColumnizedWidthAdjustedForTwoPageSpread(document: Document, isVertical: boolean): number {
  const scrollElement = getScrollingElement(document);
  let width = scrollElement.scrollWidth;

  if (!isPaginated(document) || !isTwoPageSpread(document) || isVertical) {
    return width;
  }

  const twoPageWidth = scrollElement.offsetWidth;
  const spreads = width / twoPageWidth;
  const wholeSpreadCount = Math.floor(spreads);
  const fractionalSpread = spreads - wholeSpreadCount;

  if (fractionalSpread > 0 && Math.round(fractionalSpread * 10) / 10 <= 0.5) {
    width = twoPageWidth * Math.ceil(spreads);
  }

  return width;
}

function calculateMaxScrollShift(document: Document, isVertical: boolean): { maxScrollShift: number; maxScrollShiftAdjusted: number } {
  const scrollElement = getScrollingElement(document);

  if (isPaginated(document)) {
    const maxScrollShift = isVertical
      ? scrollElement.scrollHeight - scrollElement.offsetHeight
      : scrollElement.scrollWidth - scrollElement.offsetWidth;
    const maxScrollShiftAdjusted = isVertical
      ? maxScrollShift
      : calculateDocumentColumnizedWidthAdjustedForTwoPageSpread(document, isVertical) - scrollElement.offsetWidth;

    return {
      maxScrollShift: Math.max(0, maxScrollShift),
      maxScrollShiftAdjusted: Math.max(0, maxScrollShiftAdjusted),
    };
  }

  const maxScrollShift = isVertical
    ? scrollElement.scrollWidth - scrollElement.clientWidth
    : scrollElement.scrollHeight - scrollElement.clientHeight;

  return {
    maxScrollShift: Math.max(0, maxScrollShift),
    maxScrollShiftAdjusted: Math.max(0, maxScrollShift),
  };
}

function resolvePaginatedLimit(maxShift: { maxScrollShift: number; maxScrollShiftAdjusted: number }): number {
  return Math.max(0, Math.min(maxShift.maxScrollShift, maxShift.maxScrollShiftAdjusted));
}

function calculateTotalColumns(document: Document, isVertical: boolean): number {
  if (!document.body || !document.defaultView || !isPaginated(document)) {
    return 0;
  }

  const scrollElement = getScrollingElement(document);
  const bodyStyle = document.defaultView.getComputedStyle(document.body);
  const zoomFactor = Number.parseFloat(bodyStyle.zoom || "1");

  if (isVertical) {
    return Math.ceil((document.body.scrollWidth * zoomFactor) / Math.max(1, scrollElement.scrollWidth));
  }

  return Math.ceil((document.body.scrollHeight * zoomFactor) / Math.max(1, scrollElement.scrollHeight));
}

function readPositiveOffset(document: Document, mode: ReaderReadingMode, isVertical: boolean, isRtl: boolean): number {
  const scrollElement = getScrollingElement(document);

  if (mode === "paginated") {
    if (isVertical) {
      return Math.max(0, scrollElement.scrollTop);
    }

    return Math.max(0, (isRtl ? -1 : 1) * scrollElement.scrollLeft);
  }

  if (isVertical) {
    return Math.max(0, Math.abs(scrollElement.scrollLeft));
  }

  return Math.max(0, scrollElement.scrollTop);
}

function writePositiveOffset(
  document: Document,
  mode: ReaderReadingMode,
  value: number,
  isVertical: boolean,
  isRtl: boolean,
  behavior: ScrollBehavior,
): void {
  const scrollElement = getScrollingElement(document);
  const target = Math.max(0, value);

  if (mode === "paginated") {
    if (isVertical) {
      scrollElement.scrollTo({
        top: target,
        behavior,
      });
      return;
    }

    scrollElement.scrollTo({
      left: (isRtl ? -1 : 1) * target,
      behavior,
    });
    return;
  }

  if (isVertical) {
    scrollElement.scrollTo({
      left: (isRtl ? -1 : 1) * target,
      behavior,
    });
    return;
  }

  scrollElement.scrollTo({
    top: target,
    behavior,
  });
}

function calculateViewportUnit(document: Document, mode: ReaderReadingMode, isVertical: boolean): number {
  const scrollElement = getScrollingElement(document);
  if (mode === "paginated") {
    return Math.max(1, isVertical ? scrollElement.offsetHeight : scrollElement.offsetWidth);
  }

  return Math.max(1, isVertical ? document.documentElement.clientWidth : document.documentElement.clientHeight);
}

function snapToUnit(value: number, unit: number): number {
  if (unit <= 0) {
    return Math.max(0, value);
  }

  return Math.max(0, Math.round(value / unit) * unit);
}

export function snapToUnitByDirection(value: number, unit: number, direction: ReadiumDirection): number {
  if (unit <= 0) {
    return Math.max(0, value);
  }

  const ratio = value / unit;
  return Math.max(0, (direction === "next" ? Math.ceil(ratio) : Math.floor(ratio)) * unit);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function resolveFontFamily(preferences: ReaderPreferences): ReadiumCssSettings["font"] {
  return preferences.fontFamily === "sans" ? "SANS" : "OLD";
}

function buildReadiumCssSettings(
  options: ReadiumPresentationOptions,
  isVertical: boolean,
  layout: ReadiumResponsiveLayout,
): ReadiumCssSettings {
  const fontPercentage = `${Math.round(options.preferences.fontScale * 100)}%`;

  return {
    paged: !isVertical && options.preferences.readingMode === "paginated",
    colCount: layout.forcedColCount,
    textAlign: "start",
    lineHeight: "1.68",
    paraSpacing: "0.75rem",
    bodyHyphens: "auto",
    font: resolveFontFamily(options.preferences),
    fontSize: fontPercentage,
    backgroundColor: options.theme.surface,
    textColor: options.theme.text,
    selectionBackgroundColor: options.theme.primary,
    selectionTextColor: options.theme.surface,
    linkColor: options.theme.primary,
    linkVisitedColor: options.theme.primary,
    noFootnotes: false,
    noTemporaryNavTargetOutline: false,
    noRuby: false,
    reduceMotion: false,
  };
}

function setOrRemoveStyle(element: HTMLElement, property: string, value: string | undefined): void {
  if (!value) {
    element.style.removeProperty(property);
    return;
  }

  element.style.setProperty(property, value);
}

function setOrRemoveStyleImportant(element: HTMLElement, property: string, value: string | undefined): void {
  if (!value) {
    element.style.removeProperty(property);
    return;
  }

  element.style.setProperty(property, value, "important");
}

function applyReadiumCssSettings(
  document: Document,
  options: ReadiumPresentationOptions,
  flags: { isVertical: boolean; isRtl: boolean },
): void {
  const root = document.documentElement as HTMLElement;
  const layout = computeResponsiveReadiumLayout({
    viewportWidth: document.documentElement.clientWidth || document.defaultView?.innerWidth || 0,
    preferredContentWidth: options.preferences.contentWidth,
    readingMode: options.preferences.readingMode,
    sectionKind: document.body?.dataset.sectionKind,
  });
  const settings = buildReadiumCssSettings(options, flags.isVertical, layout);

  if (flags.isVertical) {
    root.classList.add(CLASS_VWM);
  } else {
    root.classList.remove(CLASS_VWM);
  }

  if (settings.paged) {
    root.classList.add(CLASS_PAGINATED);
  } else {
    root.classList.remove(CLASS_PAGINATED);
  }

  root.classList.toggle(ROOT_CLASS_NO_FOOTNOTES, Boolean(settings.noFootnotes));
  root.classList.toggle(ROOT_CLASS_NO_RUBY, Boolean(settings.noRuby));
  root.classList.toggle(ROOT_CLASS_REDUCE_MOTION, Boolean(settings.reduceMotion));
  root.classList.toggle(DISABLE_TEMPORARY_NAV_TARGET_OUTLINE_CLASS, Boolean(settings.noTemporaryNavTargetOutline));

  setOrRemoveStyle(root, "--USER__advancedSettings", "readium-advanced-on");
  setOrRemoveStyle(root, "--USER__view", settings.paged ? "readium-paged-on" : "readium-scroll-on");
  setOrRemoveStyle(root, "--USER__appearance", "readium-default-on");
  setOrRemoveStyle(root, "--USER__fontOverride", settings.font && settings.font !== "DEFAULT" ? "readium-font-on" : "readium-font-off");

  if (settings.font === "SANS") {
    setOrRemoveStyle(root, "--USER__fontFamily", "var(--RS__sansTf)");
  } else if (settings.font === "OLD") {
    setOrRemoveStyle(root, "--USER__fontFamily", "var(--RS__oldStyleTf)");
  } else {
    setOrRemoveStyle(root, "--USER__fontFamily", undefined);
  }

  const fontSize = settings.fontSize?.trim();
  if (fontSize && fontSize !== "100%") {
    setOrRemoveStyle(root, "--USER__fontSize", fontSize);
    const ratio = fontSize.endsWith("%") ? Number.parseFloat(fontSize) / 100 : Number.parseFloat(fontSize);
    setOrRemoveStyle(root, "--USER__fontXSizeX", Number.isFinite(ratio) ? String(ratio) : "1");
  } else {
    setOrRemoveStyle(root, "--USER__fontSize", undefined);
    setOrRemoveStyle(root, "--USER__fontXSizeX", "1");
  }

  setOrRemoveStyle(root, "--USER__lineHeight", settings.lineHeight);
  setOrRemoveStyle(root, "--USER__typeScale", settings.typeScale);
  setOrRemoveStyle(root, "--USER__paraSpacing", settings.paraSpacing);
  setOrRemoveStyle(root, "--USER__pageMargins", settings.pageMargins);
  setOrRemoveStyle(root, "--USER__backgroundColor", settings.backgroundColor);
  setOrRemoveStyle(root, "--USER__textColor", settings.textColor);
  setOrRemoveStyle(root, "--RS__selectionBackgroundColor", settings.selectionBackgroundColor);
  setOrRemoveStyle(root, "--RS__selectionTextColor", settings.selectionTextColor);
  setOrRemoveStyle(root, "--RS__linkColor", settings.linkColor);
  setOrRemoveStyle(root, "--RS__visitedColor", settings.linkVisitedColor);

  if (!flags.isVertical) {
    setOrRemoveStyle(root, "--USER__colCount", settings.colCount);
    setOrRemoveStyle(root, "--USER__textAlign", settings.textAlign);
    setOrRemoveStyle(root, "--USER__paraIndent", settings.paraIndent);
  } else {
    setOrRemoveStyle(root, "--USER__colCount", "1");
    setOrRemoveStyle(root, "--USER__textAlign", undefined);
    setOrRemoveStyle(root, "--USER__paraIndent", undefined);
  }

  if (flags.isVertical || flags.isRtl) {
    setOrRemoveStyle(root, "--USER__bodyHyphens", undefined);
  } else {
    setOrRemoveStyle(root, "--USER__bodyHyphens", settings.bodyHyphens);
  }

  if (isDocJapanese(document)) {
    setOrRemoveStyle(root, "--USER__wordSpacing", settings.wordSpacing);
    setOrRemoveStyle(root, "--USER__letterSpacing", settings.letterSpacing);
  } else {
    setOrRemoveStyle(root, "--USER__wordSpacing", undefined);
    setOrRemoveStyle(root, "--USER__letterSpacing", undefined);
  }

  setOrRemoveStyle(root, "--RS__pageGutter", `${layout.pageGutterPx}px`);
  setOrRemoveStyle(root, "--RS__colGap", `${layout.columnGapPx}px`);
  setOrRemoveStyle(root, "--RS__colWidth", `${layout.pageWidthPx}px`);
  setOrRemoveStyle(root, "--RS__maxLineLength", `${layout.maxLineLengthPx}px`);
  setOrRemoveStyle(root, "--book-reader-page-width", `${layout.pageWidthPx}px`);
  setOrRemoveStyle(root, "--book-reader-max-line-length", `${layout.maxLineLengthPx}px`);
  setOrRemoveStyle(root, "--book-reader-illustration-width", `${layout.illustrationWidthPx}px`);

  if (document.body) {
    // ReadiumCSS redefines --RS__maxLineLength on body in scroll mode with !important.
    // We re-assert the computed responsive value at the same cascade level so scroll
    // layout follows the actual viewport and user content-width preference.
    setOrRemoveStyleImportant(document.body, "--RS__maxLineLength", `${layout.maxLineLengthPx}px`);
  }
}

function createSupplementalCss(options: ReadiumPresentationOptions, layout: ReadiumResponsiveLayout): string {
  return `
:root {
  color-scheme: light;
  --book-reader-surface: ${options.theme.surface};
  --book-reader-text: ${options.theme.text};
  --book-reader-primary: ${options.theme.primary};
  --book-reader-border: ${options.theme.border};
  --book-reader-accent-surface: ${options.theme.accentSurface};
  --book-reader-content-width: ${options.preferences.contentWidth}px;
  --book-reader-page-width: ${layout.pageWidthPx}px;
  --book-reader-max-line-length: ${layout.maxLineLengthPx}px;
  --book-reader-illustration-width: ${layout.illustrationWidthPx}px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: var(--book-reader-surface) !important;
  color: var(--book-reader-text) !important;
  overscroll-behavior: none;
}

body {
  position: relative;
}

body > :where(img, video, canvas, picture, svg, figure, table, pre, blockquote) {
  max-inline-size: 100%;
}

body :where(img, video, canvas, picture, svg, image) {
  display: block;
  max-width: 100% !important;
  max-inline-size: 100% !important;
  height: auto !important;
  block-size: auto !important;
  object-fit: contain;
}

body :where(figure, img, video, canvas, svg) {
  margin-inline: auto;
}

body :where(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
}

body :where(td, th) {
  border-color: var(--book-reader-border);
}

body[data-section-kind="cover"],
body[data-section-kind="full-page-image"],
body[data-section-kind="illustration"] {
  width: 100% !important;
  max-width: none !important;
  min-width: 100% !important;
  inline-size: 100% !important;
  max-inline-size: none !important;
  margin: 0 !important;
}

:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"] {
  --RS__maxLineLength: var(--book-reader-max-line-length) !important;
  width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2))) !important;
  max-width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2)));
  margin-inline: auto !important;
  padding-inline: var(--RS__pageGutter) !important;
  padding-block: clamp(28px, 6vh, 88px);
}

:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"]
  > :where(.element, .element-bodymatter, .element-container-single, .element-container-double, article, main, section),
:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"] :where(.heading-container-single, .text) {
  width: 100% !important;
  max-width: 100% !important;
}

:root.${CLASS_PAGINATED} body[data-section-kind="cover"],
:root.${CLASS_PAGINATED} body[data-section-kind="full-page-image"],
:root.${CLASS_PAGINATED} body[data-section-kind="illustration"] {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(8px, 2vh, 22px) clamp(8px, 2vw, 22px);
}

:root.${CLASS_PAGINATED} body[data-section-kind="cover"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body[data-section-kind="full-page-image"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body[data-section-kind="illustration"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body :where(.inline-image-flow-separate-page img, #cover .cover-image, [id^="full-page-image"] .image-element-image, .element-type-image .image-element-image) {
  width: clamp(360px, 92vw, var(--book-reader-illustration-width)) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
  max-height: calc(100dvh - 20px) !important;
  max-block-size: calc(100dvh - 20px) !important;
}

body :where(#cover, [id^="full-page-image"], .element-type-image) {
  width: 100%;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-block, .element-type-image .image-element-block) {
  width: 100% !important;
  max-width: 100% !important;
  padding-top: 0 !important;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-size-container, .element-type-image .image-element-size-container) {
  width: min(100%, calc(100vw - 24px)) !important;
  max-width: 100% !important;
  display: grid !important;
  place-items: center;
}

body :where(.inline-image-flow-separate-page) {
  display: grid;
  place-items: center;
  margin-block: clamp(1.5rem, 5vh, 4rem) !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  text-align: center;
}

body :where(.inline-image-flow-separate-page .inline-image-container) {
  width: clamp(360px, 90vw, var(--book-reader-illustration-width)) !important;
  max-width: 100% !important;
  display: grid;
  place-items: center;
}

body :where(.inline-image-flow-center.inline-image-flow-within-text .inline-image-container) {
  width: min(100%, max(70%, calc(var(--book-reader-max-line-length) * 0.82))) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
}

body :where(
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-large .inline-image-container,
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-full .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-large .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-full .inline-image-container
) {
  width: min(100%, max(88%, calc(var(--book-reader-max-line-length) * 1.02))) !important;
}

:root.${CLASS_PAGINATED} body :where(.inline-image-flow-separate-page) {
  break-before: column;
  break-after: column;
  break-inside: avoid;
}

body[data-has-heading-hero="true"] :where(.heading-container-single) {
  max-width: min(100%, var(--book-reader-content-width));
  margin-inline: auto !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full) {
  min-height: clamp(0px, 22vh, 10rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-without-image .heading-contents) {
  padding-top: clamp(1.5rem, 7vh, 4rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-with-image .heading-contents) {
  padding-top: clamp(1rem, 4vh, 2.25rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading) {
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem) !important;
}

a {
  color: var(--book-reader-primary);
}

blockquote {
  border-inline-start: 3px solid var(--book-reader-border);
  color: color-mix(in srgb, var(--book-reader-text) 76%, var(--book-reader-surface));
}

pre {
  border-radius: 16px;
  border: 1px solid var(--book-reader-border);
  background: var(--book-reader-accent-surface);
}

@media (max-width: 840px) {
  body :where(.inline-image-flow-left.inline-image-flow-within-text, .inline-image-flow-right.inline-image-flow-within-text) {
    float: none !important;
    width: 100% !important;
    margin-inline: 0 !important;
  }
}
`;
}

function resolveReadiumProfile(document: Document, flags: { isVertical: boolean; isRtl: boolean }): ReadiumProfile {
  const cjk = isDocCjk(document);

  if (flags.isVertical && cjk) {
    return "cjk-vertical";
  }
  if (cjk) {
    return "cjk-horizontal";
  }
  if (flags.isRtl) {
    return "rtl";
  }
  return "default";
}

async function loadReadiumStyleText(profile: ReadiumProfile, mod: ReadiumStyleMod): Promise<string> {
  const cacheKey = `${profile}:${mod}`;
  const existing = CSS_TEXT_CACHE.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = fetch(STYLE_ASSET_URLS[profile][mod])
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`加载 ReadiumCSS 失败：${profile}/${mod}`);
      }

      const cssText = await response.text();
      return Object.entries(FONT_ASSET_URLS).reduce((current, [relativePath, assetUrl]) => {
        return current.split(relativePath).join(assetUrl);
      }, cssText);
    });

  CSS_TEXT_CACHE.set(cacheKey, promise);
  return promise;
}

function findFragmentTarget(document: Document, fragment: string): Element | null {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(fragment)
      : fragment.replace(/["\\]/g, "\\$&");

  return (
    document.getElementById(fragment) ??
    document.querySelector(`[id="${escaped}"]`) ??
    document.querySelector(`[name="${escaped}"]`)
  );
}

export class ReadiumDocumentController {
  private resizeObserver: ResizeObserver | null = null;
  private resizeRafHandle: number | null = null;
  private paginatedSnapshot: ReadiumPaginationSnapshot | null = null;

  public constructor(
    private readonly document: Document,
    private options: ReadiumPresentationOptions,
  ) {}

  public async mount(): Promise<void> {
    await this.ensureReadiumStyles();
    this.applyPresentation();
    this.attachResizeObserver();
    await waitForLayoutPasses(this.document);
    this.realignToViewport("auto");
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.resizeRafHandle !== null && this.document.defaultView) {
      cancelAnimationFrameSchedule(this.document.defaultView, this.resizeRafHandle);
      this.resizeRafHandle = null;
    }
  }

  public async update(options: ReadiumPresentationOptions): Promise<void> {
    const ratio = this.captureProgressionRatio();
    this.options = options;
    await this.ensureReadiumStyles();
    this.applyPresentation();
    await waitForLayoutPasses(this.document);
    this.restoreProgressionRatio(ratio, "auto");
  }

  public move(direction: ReadiumDirection, behavior: ScrollBehavior = "smooth"): boolean {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const unit = calculateViewportUnit(this.document, mode, flags.isVertical);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const current = readPositiveOffset(this.document, mode, flags.isVertical, flags.isRtl);
    const limit = mode === "paginated" ? resolvePaginatedLimit(maxShift) : maxShift.maxScrollShift;
    const target =
      direction === "next"
        ? clamp(current + unit, 0, limit)
        : clamp(current - unit, 0, limit);

    const next = mode === "paginated" ? clamp(snapToUnitByDirection(target, unit, direction), 0, limit) : target;
    if (Math.abs(next - current) <= (mode === "paginated" ? CSS_PIXEL_TOLERANCE : 4)) {
      return false;
    }

    writePositiveOffset(this.document, mode, next, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
    return true;
  }

  public moveBySpread(direction: ReadiumDirection, behavior: ScrollBehavior = "smooth"): boolean {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    if (mode !== "paginated") {
      return this.move(direction, behavior);
    }

    const unit = calculateViewportUnit(this.document, mode, flags.isVertical);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const current = readPositiveOffset(this.document, mode, flags.isVertical, flags.isRtl);
    const limit = resolvePaginatedLimit(maxShift);
    if (unit <= 0 || limit <= 0) {
      return false;
    }

    const currentSpreadIndex =
      direction === "next"
        ? Math.floor((current + CSS_PIXEL_TOLERANCE) / unit)
        : Math.ceil((current - CSS_PIXEL_TOLERANCE) / unit);
    const targetSpreadIndex = direction === "next" ? currentSpreadIndex + 1 : currentSpreadIndex - 1;
    const next = clamp(targetSpreadIndex * unit, 0, limit);
    if (Math.abs(next - current) <= CSS_PIXEL_TOLERANCE) {
      return false;
    }

    writePositiveOffset(this.document, mode, next, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
    return true;
  }

  public isNearBoundary(direction: ReadiumDirection): boolean {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const current = readPositiveOffset(this.document, mode, flags.isVertical, flags.isRtl);
    const limit = mode === "paginated" ? resolvePaginatedLimit(maxShift) : maxShift.maxScrollShift;
    const unit = calculateViewportUnit(this.document, mode, flags.isVertical);
    const threshold = Math.max(24, Math.round(unit * 0.04));

    if (direction === "previous") {
      return current <= threshold;
    }

    return current >= Math.max(0, limit - threshold);
  }

  public scrollToBoundary(boundary: ReadiumBoundary, behavior: ScrollBehavior = "smooth"): void {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const target = boundary === "start"
      ? 0
      : mode === "paginated"
        ? resolvePaginatedLimit(maxShift)
        : maxShift.maxScrollShift;

    writePositiveOffset(this.document, mode, target, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
  }

  public async scrollToFragment(fragment?: string): Promise<void> {
    if (!fragment) {
      this.scrollToBoundary("start", "auto");
      return;
    }

    const target = findFragmentTarget(this.document, fragment);
    if (!target) {
      this.scrollToBoundary("start", "auto");
      return;
    }

    target.scrollIntoView({
      block: "start",
      inline: "start",
      behavior: "auto",
    });
    await waitForLayoutPasses(this.document, 1);
    if (this.options.preferences.readingMode === "paginated") {
      this.realignToViewport("auto");
    }
    this.updatePaginatedSnapshot();
  }

  public getPaginationInfo(): ReadiumPaginationInfo {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const current = readPositiveOffset(this.document, mode, flags.isVertical, flags.isRtl);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const totalColumns = calculateTotalColumns(this.document, flags.isVertical);
    const twoPageSpread = isTwoPageSpread(this.document);
    const unit = calculateViewportUnit(this.document, "paginated", flags.isVertical);
    const spreadIndex = unit > 0 ? Math.round(current / unit) : 0;

    return {
      totalColumns: totalColumns || undefined,
      currentColumn: totalColumns ? Math.min(totalColumns - 1, spreadIndex * (twoPageSpread ? 2 : 1)) : undefined,
      isTwoPageSpread: twoPageSpread,
      spreadIndex: resolvePaginatedLimit(maxShift) > 0 ? spreadIndex : 0,
    };
  }

  private applyPresentation(): void {
    const flags = computeVerticalRtl(this.document);
    applyReadiumCssSettings(this.document, this.options, flags);
    const layout = computeResponsiveReadiumLayout({
      viewportWidth: this.document.documentElement.clientWidth || this.document.defaultView?.innerWidth || 0,
      preferredContentWidth: this.options.preferences.contentWidth,
      readingMode: this.options.preferences.readingMode,
      sectionKind: this.document.body?.dataset.sectionKind,
    });
    ensureStyleElement(this.document, SUPPLEMENTAL_STYLE_ID, createSupplementalCss(this.options, layout));
  }

  private async ensureReadiumStyles(): Promise<void> {
    const flags = computeVerticalRtl(this.document);
    const profile = resolveReadiumProfile(this.document, flags);
    const includeDefault = !hasPublisherStyles(this.document);
    const [beforeCss, defaultCss, afterCss] = await Promise.all([
      loadReadiumStyleText(profile, "before"),
      includeDefault ? loadReadiumStyleText(profile, "default") : Promise.resolve(""),
      loadReadiumStyleText(profile, "after"),
    ]);

    ensureStyleElement(this.document, PATCH_STYLE_ID, READIUM_PATCH_CSS, { prepend: true });
    ensureStyleElement(this.document, BEFORE_STYLE_ID, beforeCss, { prepend: true });

    if (includeDefault) {
      ensureStyleElement(this.document, DEFAULT_STYLE_ID, defaultCss);
    } else {
      removeStyleElement(this.document, DEFAULT_STYLE_ID);
    }

    ensureStyleElement(this.document, AFTER_STYLE_ID, afterCss);
  }

  private attachResizeObserver(): void {
    const view = this.document.defaultView;
    if (!view || typeof view.ResizeObserver !== "function" || this.resizeObserver) {
      return;
    }

    this.resizeObserver = new view.ResizeObserver(() => {
      if (this.options.preferences.readingMode !== "paginated") {
        return;
      }

      if (this.resizeRafHandle !== null) {
        return;
      }

      this.resizeRafHandle = scheduleAnimationFrame(view, async () => {
        this.resizeRafHandle = null;
        const anchor = this.capturePaginatedAnchor();
        await waitForLayoutPasses(this.document, 1);
        this.restorePaginatedAnchor(anchor, "auto");
      });
    });
    this.resizeObserver.observe(this.document.documentElement);
  }

  private capturePaginatedAnchor(): { unitProgress: number; ratio: number } {
    const snapshot = this.paginatedSnapshot ?? this.createPaginatedSnapshot();
    if (!snapshot || snapshot.unit <= 0) {
      return {
        unitProgress: 0,
        ratio: 0,
      };
    }

    return {
      unitProgress: snapshot.offset / snapshot.unit,
      ratio: snapshot.limit > 0 ? snapshot.offset / snapshot.limit : 0,
    };
  }

  private createPaginatedSnapshot(): ReadiumPaginationSnapshot | null {
    if (this.options.preferences.readingMode !== "paginated") {
      return null;
    }

    const flags = computeVerticalRtl(this.document);
    const unit = calculateViewportUnit(this.document, "paginated", flags.isVertical);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);

    return {
      offset: readPositiveOffset(this.document, "paginated", flags.isVertical, flags.isRtl),
      unit,
      limit: resolvePaginatedLimit(maxShift),
    };
  }

  private updatePaginatedSnapshot(): void {
    this.paginatedSnapshot = this.createPaginatedSnapshot();
  }

  private captureProgressionRatio(): number {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const current = readPositiveOffset(this.document, mode, flags.isVertical, flags.isRtl);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const limit = mode === "paginated" ? resolvePaginatedLimit(maxShift) : maxShift.maxScrollShift;

    return limit > 0 ? clamp(current / limit, 0, 1) : 0;
  }

  private restoreProgressionRatio(ratio: number, behavior: ScrollBehavior): void {
    const flags = computeVerticalRtl(this.document);
    const mode = this.options.preferences.readingMode;
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const limit = mode === "paginated" ? resolvePaginatedLimit(maxShift) : maxShift.maxScrollShift;
    const unit = calculateViewportUnit(this.document, mode, flags.isVertical);
    const target = clamp(limit * clamp(ratio, 0, 1), 0, limit);
    const next = mode === "paginated" ? snapToUnit(target, unit) : target;

    writePositiveOffset(this.document, mode, next, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
  }

  private restorePaginatedAnchor(
    anchor: { unitProgress: number; ratio: number },
    behavior: ScrollBehavior,
  ): void {
    if (this.options.preferences.readingMode !== "paginated") {
      this.updatePaginatedSnapshot();
      return;
    }

    const flags = computeVerticalRtl(this.document);
    const unit = calculateViewportUnit(this.document, "paginated", flags.isVertical);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const limit = resolvePaginatedLimit(maxShift);
    const targetFromUnits = unit > 0 ? anchor.unitProgress * unit : Number.NaN;
    const fallbackTarget = limit > 0 ? anchor.ratio * limit : 0;
    const target = Number.isFinite(targetFromUnits) ? targetFromUnits : fallbackTarget;
    const next = clamp(snapToUnit(target, unit), 0, limit);

    writePositiveOffset(this.document, "paginated", next, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
  }

  private realignToViewport(behavior: ScrollBehavior): void {
    if (this.options.preferences.readingMode !== "paginated") {
      return;
    }

    const flags = computeVerticalRtl(this.document);
    const current = readPositiveOffset(this.document, "paginated", flags.isVertical, flags.isRtl);
    const unit = calculateViewportUnit(this.document, "paginated", flags.isVertical);
    const maxShift = calculateMaxScrollShift(this.document, flags.isVertical);
    const target = clamp(snapToUnit(current, unit), 0, resolvePaginatedLimit(maxShift));

    writePositiveOffset(this.document, "paginated", target, flags.isVertical, flags.isRtl, behavior);
    this.updatePaginatedSnapshot();
  }
}
