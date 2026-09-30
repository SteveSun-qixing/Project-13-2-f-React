import { escape as escapeHtml } from './markup-escape';
import { bytesToDataUri } from '../../core/binary';
import { EpubHtmlTransformer } from './html-transformer';
import { isExternalHref, joinEpubHref, normalizeEpubPath, resolveEpubHref } from './path';
import { resolveEpubMimeType } from './resources';
import { createPublicationLink } from './publication';
import type { EpubBook, EpubLink, EpubManifestItem, RenderedSectionDocument } from './types';

const DATA_URI_CACHE = new WeakMap<EpubBook, Map<string, string>>();
const CSS_URL_PATTERN = /url\(([^)]+)\)/g;

function getDataUriCache(book: EpubBook): Map<string, string> {
  const existing = DATA_URI_CACHE.get(book);
  if (existing) {
    return existing;
  }

  const cache = new Map<string, string>();
  DATA_URI_CACHE.set(book, cache);
  return cache;
}

async function readResourceDataUri(
  book: EpubBook,
  path: string,
  explicitMimeType?: string
): Promise<string> {
  const normalizedPath = normalizeEpubPath(path);
  const cache = getDataUriCache(book);
  const cached = cache.get(normalizedPath);
  if (cached) {
    return cached;
  }

  const bytes = await book.archive.readBinary(normalizedPath);
  const dataUri = bytesToDataUri(bytes, resolveEpubMimeType(normalizedPath, explicitMimeType));
  cache.set(normalizedPath, dataUri);
  return dataUri;
}

function findManifestItemByPath(book: EpubBook, path: string): EpubManifestItem | undefined {
  return book.manifestByPath.get(normalizeEpubPath(path));
}

function readAttributeValue(element: Element, candidates: string[]): string {
  for (const candidate of candidates) {
    const direct = element.getAttribute(candidate)?.trim();
    if (direct) {
      return direct;
    }
  }

  for (const attribute of Array.from(element.attributes)) {
    if (candidates.includes(attribute.name) || candidates.includes(attribute.localName)) {
      const value = attribute.value.trim();
      if (value) {
        return value;
      }
    }
  }

  return '';
}

function resolveAttributeName(element: Element, candidates: string[]): string {
  for (const candidate of candidates) {
    if (element.hasAttribute(candidate)) {
      return candidate;
    }
  }

  for (const attribute of Array.from(element.attributes)) {
    if (candidates.includes(attribute.name) || candidates.includes(attribute.localName)) {
      return attribute.name;
    }
  }

  return candidates[0] ?? 'src';
}

function writeAttributeValue(element: Element, candidates: string[], value: string): void {
  element.setAttribute(resolveAttributeName(element, candidates), value);
}

function resolveParserMode(link: EpubLink): DOMParserSupportedType {
  const mediaType = link.mediaType?.trim().toLowerCase() ?? '';
  if (mediaType.includes('xhtml') || mediaType.includes('xml')) {
    return 'application/xhtml+xml';
  }
  return 'text/html';
}

function hasParserError(document: Document): boolean {
  return document.getElementsByTagName('parsererror').length > 0;
}

function parseSectionDocument(source: string, link: EpubLink): Document {
  const parser = new DOMParser();
  const preferredMode = resolveParserMode(link);
  const preferredDocument = parser.parseFromString(source, preferredMode);

  if (!hasParserError(preferredDocument)) {
    return preferredDocument;
  }

  return parser.parseFromString(source, 'text/html');
}

function getBodyElement(document: Document): Element | null {
  return (
    document.querySelector('body') ??
    Array.from(document.getElementsByTagName('*')).find(
      (element) => element.localName === 'body'
    ) ??
    null
  );
}

function serializeBodyContent(document: Document): string {
  const body = getBodyElement(document);
  if (!body) {
    return '';
  }

  const serializer = new XMLSerializer();
  return Array.from(body.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('');
}

function resolveDocumentLanguage(book: EpubBook, document: Document): string {
  const html = document.documentElement;
  return (
    html.getAttribute('lang')?.trim() ||
    html.getAttribute('xml:lang')?.trim() ||
    Array.from(html.attributes)
      .find((attribute) => attribute.localName === 'lang')
      ?.value.trim() ||
    book.metadata.language ||
    'zh-CN'
  );
}

function resolveSectionLink(book: EpubBook, sectionPath: string): EpubLink {
  const normalizedPath = normalizeEpubPath(sectionPath);
  const existing = book.publication.linksByPath.get(normalizedPath);
  if (existing) {
    return existing;
  }

  const section = book.sections.find((item) => item.path === normalizedPath);
  return createPublicationLink({
    id: section?.id ?? normalizedPath,
    href: section?.href ?? normalizedPath,
    path: normalizedPath,
    title: section?.title === undefined ? undefined : section.title,
    mediaType: findManifestItemByPath(book, normalizedPath)?.mediaType,
  });
}

async function rewriteCssUrls(book: EpubBook, cssText: string, cssPath: string): Promise<string> {
  const matches = Array.from(cssText.matchAll(CSS_URL_PATTERN));
  let nextCss = cssText;

  for (const match of matches) {
    const entireMatch = match[0];
    const rawValue = match[1]?.trim() ?? '';
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '');

    if (
      !unquoted ||
      unquoted.startsWith('data:') ||
      unquoted.startsWith('#') ||
      isExternalHref(unquoted)
    ) {
      continue;
    }

    const target = resolveEpubHref(cssPath, unquoted);
    if (!book.archive.hasEntry(target.path)) {
      continue;
    }

    const manifestItem = findManifestItemByPath(book, target.path);
    const dataUri = await readResourceDataUri(book, target.path, manifestItem?.mediaType);
    nextCss = nextCss.replace(entireMatch, `url("${dataUri}")`);
  }

  return nextCss;
}

async function rewriteInlineStyleAttributes(
  book: EpubBook,
  sectionPath: string,
  document: Document
): Promise<void> {
  const elements = Array.from(document.querySelectorAll('[style]'));

  for (const element of elements) {
    const styleValue = element.getAttribute('style')?.trim() ?? '';
    if (!styleValue || !styleValue.includes('url(')) {
      continue;
    }

    element.setAttribute('style', await rewriteCssUrls(book, styleValue, sectionPath));
  }
}

async function inlinePublisherStyles(
  book: EpubBook,
  sectionPath: string,
  document: Document
): Promise<string[]> {
  const linkElements = Array.from(document.querySelectorAll('link[href]')).filter((element) => {
    const rel = element.getAttribute('rel')?.trim().toLowerCase() ?? '';
    return rel.includes('stylesheet');
  });

  const styles: string[] = [];

  for (const linkElement of linkElements) {
    const href = linkElement.getAttribute('href')?.trim() ?? '';
    linkElement.remove();
    if (!href || isExternalHref(href)) {
      continue;
    }

    const target = resolveEpubHref(sectionPath, href);
    if (!book.archive.hasEntry(target.path)) {
      continue;
    }

    const stylesheet = await book.archive.readText(target.path);
    styles.push(await rewriteCssUrls(book, stylesheet, target.path));
  }

  return styles;
}

async function rewriteResourceReference(
  book: EpubBook,
  sectionPath: string,
  rawValue: string
): Promise<string | null> {
  const normalizedValue = rawValue.trim();
  if (
    !normalizedValue ||
    normalizedValue.startsWith('data:') ||
    normalizedValue.startsWith('#') ||
    isExternalHref(normalizedValue)
  ) {
    return null;
  }

  const target = resolveEpubHref(sectionPath, normalizedValue);
  if (!book.archive.hasEntry(target.path)) {
    return null;
  }

  const manifestItem = findManifestItemByPath(book, target.path);
  return readResourceDataUri(book, target.path, manifestItem?.mediaType);
}

async function rewriteEmbeddedMedia(
  book: EpubBook,
  sectionPath: string,
  document: Document
): Promise<void> {
  const rules: Array<{ selector: string; attributes: string[] }> = [
    { selector: 'img', attributes: ['src'] },
    { selector: 'image', attributes: ['href', 'xlink:href'] },
    { selector: 'use', attributes: ['href', 'xlink:href'] },
    { selector: 'video', attributes: ['poster', 'src'] },
    { selector: 'audio', attributes: ['src'] },
    { selector: 'source', attributes: ['src'] },
    { selector: 'track', attributes: ['src'] },
  ];

  for (const rule of rules) {
    const elements = Array.from(document.querySelectorAll(rule.selector));
    for (const element of elements) {
      const rawValue = readAttributeValue(element, rule.attributes);
      if (!rawValue) {
        continue;
      }

      const rewritten = await rewriteResourceReference(book, sectionPath, rawValue);
      if (rewritten) {
        writeAttributeValue(element, rule.attributes, rewritten);
      }
    }
  }
}

function rewriteInternalLinks(sectionPath: string, document: Document): void {
  for (const link of Array.from(document.querySelectorAll('a[href], area[href]'))) {
    const href = readAttributeValue(link, ['href']);
    if (!href) {
      continue;
    }

    if (isExternalHref(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
      continue;
    }

    const target = resolveEpubHref(sectionPath, href);
    link.setAttribute('data-epub-target', joinEpubHref(target.path, target.fragment));
  }
}

function removeUnsafeNodes(document: Document): void {
  for (const selector of ['script', 'iframe', 'object', 'embed', 'base']) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      element.remove();
    }
  }
}

function isIllustrationSection(document: Document): boolean {
  const body = getBodyElement(document);
  if (!body) {
    return false;
  }

  const textContent = body.textContent?.replace(/\s+/g, '') ?? '';
  const imageCount = body.querySelectorAll('img, image, svg').length;
  return textContent.length === 0 && imageCount > 0;
}

type SectionKind = 'chapter' | 'illustration' | 'full-page-image' | 'cover';

interface SectionLayoutProfile {
  sectionKind: SectionKind;
  hasSeparatePageIllustration: boolean;
  hasHeadingHero: boolean;
}

function resolveSectionLayoutProfile(document: Document): SectionLayoutProfile {
  const body = getBodyElement(document);
  const isCover =
    body?.classList.contains('cover') ||
    Boolean(document.querySelector('#cover .cover-image, #cover img.cover-image'));
  const isFullPageImage =
    Boolean(
      document.querySelector('[id^="full-page-image"], .element-type-image .image-element-image')
    ) && !isCover;

  return {
    sectionKind: isCover
      ? 'cover'
      : isFullPageImage
        ? 'full-page-image'
        : isIllustrationSection(document)
          ? 'illustration'
          : 'chapter',
    hasSeparatePageIllustration: Boolean(
      document.querySelector('.inline-image-flow-separate-page')
    ),
    hasHeadingHero: Boolean(document.querySelector('.heading-size-full')),
  };
}

function buildFrameCss(): string {
  return `
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: transparent;
      color: inherit;
    }
    body {
      position: relative;
    }
    body :where(img, video, canvas, picture, svg) {
      display: block;
      max-width: 100% !important;
      max-inline-size: 100% !important;
      width: auto !important;
      height: auto !important;
      block-size: auto !important;
      object-fit: contain;
    }
    body :where(image) {
      max-width: 100% !important;
      max-inline-size: 100% !important;
      height: auto !important;
    }
    body :where(figure, img, video, canvas, svg) {
      margin-inline: auto;
    }
    body :where(a) {
      text-decoration-thickness: 1px;
      text-underline-offset: 0.14em;
    }
    body :where(table) {
      display: block;
      width: 100%;
      overflow-x: auto;
    }
    @media (max-width: 840px) {
      body :where(.inline-image-flow-left.inline-image-flow-within-text, .inline-image-flow-right.inline-image-flow-within-text) {
        float: none !important;
        width: 100% !important;
        margin-inline: 0 !important;
      }
      body :where(
        .inline-image-flow-left.inline-image-flow-within-text .inline-image-container,
        .inline-image-flow-right.inline-image-flow-within-text .inline-image-container,
        .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-large .inline-image-container,
        .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-full .inline-image-container,
        .inline-image-aspect-tall.inline-image-size-large .inline-image-container,
        .inline-image-aspect-tall.inline-image-size-full .inline-image-container
      ) {
        width: 100% !important;
      }
    }
  `;
}

async function buildTransformedSectionHtml(
  context: {
    book: EpubBook;
    link: EpubLink;
    sectionPath: string;
  },
  source: string
): Promise<string> {
  const document = parseSectionDocument(source, context.link);

  removeUnsafeNodes(document);
  const publisherStyles = await inlinePublisherStyles(context.book, context.sectionPath, document);
  await rewriteInlineStyleAttributes(context.book, context.sectionPath, document);
  await rewriteEmbeddedMedia(context.book, context.sectionPath, document);
  rewriteInternalLinks(context.sectionPath, document);
  const layoutProfile = resolveSectionLayoutProfile(document);

  const title =
    document.querySelector('title')?.textContent?.trim() ||
    document.querySelector('h1, h2, h3')?.textContent?.trim() ||
    context.link.title ||
    context.book.metadata.title;

  return `<!doctype html>
<html lang="${escapeHtml(resolveDocumentLanguage(context.book, document))}" data-section-kind="${escapeHtml(layoutProfile.sectionKind)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    ${publisherStyles.map((style) => `<style>${style}</style>`).join('\n')}
    <style>${buildFrameCss()}</style>
  </head>
  <body data-chips-app="book-reader.chapter" data-section-kind="${escapeHtml(layoutProfile.sectionKind)}" data-has-separate-page-illustration="${String(layoutProfile.hasSeparatePageIllustration)}" data-has-heading-hero="${String(layoutProfile.hasHeadingHero)}">${serializeBodyContent(document)}
  </body>
</html>`;
}

const SECTION_HTML_TRANSFORMER = new EpubHtmlTransformer((context, source) =>
  buildTransformedSectionHtml(
    {
      book: context.book,
      link: context.link,
      sectionPath: context.link.path,
    },
    source
  )
);

export async function renderSectionDocument(
  book: EpubBook,
  sectionPath: string
): Promise<RenderedSectionDocument> {
  const normalizedPath = normalizeEpubPath(sectionPath);
  const link = resolveSectionLink(book, normalizedPath);
  const source = await book.archive.readText(normalizedPath);
  if (book.source.format === 'pdf') {
    return {
      title: link.title ?? book.metadata.title,
      sectionPath: normalizedPath,
      html: source,
    };
  }

  const html = await SECTION_HTML_TRANSFORMER.transform(
    {
      book,
      link,
    },
    source
  );

  return {
    title: link.title ?? book.metadata.title,
    sectionPath: normalizedPath,
    html,
  };
}
