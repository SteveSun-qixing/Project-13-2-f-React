import { bytesToDataUri } from '../../core/binary';
import {
  isRenderableBookFormat,
  normalizeBookFormat,
  type BookSourceDescriptor,
} from '../../core/book-model';
import { loadEpubBook } from '../epub/package';
import type {
  EpubBook,
  EpubLink,
  EpubManifestItem,
  EpubMetadata,
  EpubNavigationItem,
  EpubPublication,
  EpubSection,
  ReadableBookArchive,
  ReadableBookArchiveEntry,
} from '../epub/types';

const TEXT_SECTION_SIZE = 18_000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeTextBytes(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = new Uint8Array(bytes.length - 2);
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      swapped[index - 2] = bytes[index + 1] ?? 0;
      swapped[index - 1] = bytes[index] ?? 0;
    }
    return new TextDecoder('utf-16le').decode(swapped);
  }

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }

  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeText(value: string): string {
  return (
    value
      .replace(/\r\n?/g, '\n')
      // 控制字符（NUL）是文本解码后的清洗目标，非输入校验，属规则误报，定向豁免。
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, '')
      .trim()
  );
}

function splitTextIntoSections(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [''];
  }

  const sections: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + TEXT_SECTION_SIZE);
    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf('\n\n', end);
      if (paragraphBreak > cursor + 1000) {
        end = paragraphBreak;
      }
    }
    sections.push(normalized.slice(cursor, end).trim());
    cursor = end;
  }

  return sections.filter((section) => section.length > 0);
}

function textToHtml(text: string): string {
  return splitTextIntoBlocks(text).join('\n');
}

function splitTextIntoBlocks(text: string): string[] {
  const paragraphs = normalizeText(text).split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        return '';
      }
      return `<p>${escapeHtml(lines.join('\n')).replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean);
}

function markdownToHtml(text: string): string {
  const lines = normalizeText(text).split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${escapeHtml(paragraph.join(' ')).replace(/\n/g, '<br />')}</p>`);
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };
  const flushCode = (): void => {
    if (codeLines.length > 0) {
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      codeLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(6, heading[1]?.length ?? 1);
      blocks.push(`<h${level}>${escapeHtml(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    const list = /^[-*+]\s+(.+)$/.exec(line.trim());
    if (list) {
      flushParagraph();
      listItems.push(list[1] ?? '');
      continue;
    }

    paragraph.push(line.trim());
  }

  flushCode();
  flushParagraph();
  flushList();
  return blocks.join('\n');
}

function rtfToPlainText(source: string): string {
  let output = '';
  let index = 0;
  let skipDepth = 0;
  const stack: number[] = [];

  while (index < source.length) {
    const char = source[index] ?? '';
    if (char === '{') {
      stack.push(skipDepth);
      index += 1;
      continue;
    }
    if (char === '}') {
      skipDepth = stack.pop() ?? 0;
      index += 1;
      continue;
    }
    if (char !== '\\') {
      if (skipDepth === 0) {
        output += char;
      }
      index += 1;
      continue;
    }

    const next = source[index + 1] ?? '';
    if (next === "'" && index + 3 < source.length) {
      const byte = Number.parseInt(source.slice(index + 2, index + 4), 16);
      if (skipDepth === 0 && Number.isFinite(byte)) {
        output += String.fromCharCode(byte);
      }
      index += 4;
      continue;
    }

    if (next === '\\' || next === '{' || next === '}') {
      if (skipDepth === 0) {
        output += next;
      }
      index += 2;
      continue;
    }

    const controlMatch = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(index));
    if (!controlMatch) {
      index += 1;
      continue;
    }

    const word = controlMatch[1] ?? '';
    const argument = controlMatch[2];
    if (
      word === 'fonttbl' ||
      word === 'colortbl' ||
      word === 'stylesheet' ||
      word === 'info' ||
      word === 'pict'
    ) {
      skipDepth += 1;
    } else if (skipDepth === 0) {
      if (word === 'par' || word === 'line') {
        output += '\n';
      } else if (word === 'tab') {
        output += '\t';
      } else if (word === 'u' && argument) {
        const codePoint = Number.parseInt(argument, 10);
        output += String.fromCharCode(codePoint < 0 ? codePoint + 65536 : codePoint);
      }
    }
    index += controlMatch[0].length;
  }

  return normalizeText(output.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'));
}

function parseFb2(
  input: string,
  fallbackTitle: string
): {
  title: string;
  author?: string | undefined;
  sections: Array<{ title: string; html: string }>;
} {
  const parser = new DOMParser();
  const document = parser.parseFromString(input, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error(`FB2 文件无法解析：${parserError.textContent?.trim() || 'XML 结构无效'}`);
  }

  const textContent = (selector: string): string =>
    document.querySelector(selector)?.textContent?.trim() ?? '';
  const title = textContent('description title-info book-title') || fallbackTitle;
  const authorParts = [
    textContent('description title-info author first-name'),
    textContent('description title-info author middle-name'),
    textContent('description title-info author last-name'),
    textContent('description title-info author nickname'),
  ].filter(Boolean);
  const body = document.querySelector('body') ?? document.documentElement;
  const fb2Sections = Array.from(body.querySelectorAll(':scope > section'));
  const sourceSections = fb2Sections.length > 0 ? fb2Sections : [body];

  const sections = sourceSections.map((section, index) => {
    const sectionTitle =
      section.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() ||
      `${title} ${index + 1}`;
    const paragraphs = Array.from(section.querySelectorAll('p, subtitle, text-author'))
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean);
    return {
      title: sectionTitle,
      html:
        paragraphs.length > 0
          ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')
          : `<p>${escapeHtml(section.textContent?.replace(/\s+/g, ' ').trim() ?? '')}</p>`,
    };
  });

  return {
    title,
    author: authorParts.join(' ') || undefined,
    sections,
  };
}

function createSectionHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      .chips-reader-virtual-document {
        width: 100%;
      }
      .chips-reader-virtual-document :where(p, li) {
        white-space: pre-wrap;
      }
      .chips-reader-virtual-document :where(pre) {
        overflow-x: auto;
        padding: 1em;
        border-radius: 0.5em;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }
      .chips-reader-pdf {
        position: fixed;
        inset: 0;
      }
      .chips-reader-pdf iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }
    </style>
  </head>
  <body data-chips-app="book-reader.virtual">
    <article class="chips-reader-virtual-document">
      ${body}
    </article>
  </body>
</html>`;
}

class VirtualBookArchive implements ReadableBookArchive {
  private readonly entries = new Map<string, { bytes: Uint8Array; text?: string | undefined }>();

  public constructor(
    files: Array<{ path: string; text?: string | undefined; bytes?: Uint8Array | undefined }>
  ) {
    for (const file of files) {
      const bytes = file.bytes ?? new TextEncoder().encode(file.text ?? '');
      this.entries.set(file.path, {
        bytes,
        text: file.text,
      });
    }
  }

  public listEntries(): ReadableBookArchiveEntry[] {
    return Array.from(this.entries.entries()).map(([path, entry], index) => ({
      path,
      size: entry.bytes.length,
      compressedSize: entry.bytes.length,
      crc32: 0,
      offset: index,
      isDirectory: false,
    }));
  }

  public hasEntry(path: string): boolean {
    return this.entries.has(path);
  }

  public readBinary(entryPath: string): Promise<Uint8Array> {
    const entry = this.entries.get(entryPath);
    if (!entry) {
      return Promise.reject(new Error(`阅读资源不存在：${entryPath}`));
    }
    return Promise.resolve(entry.bytes);
  }

  public readText(entryPath: string): Promise<string> {
    const entry = this.entries.get(entryPath);
    if (!entry) {
      return Promise.reject(new Error(`阅读资源不存在：${entryPath}`));
    }
    if (typeof entry.text === 'string') {
      return Promise.resolve(entry.text);
    }
    return Promise.resolve(new TextDecoder('utf-8').decode(entry.bytes));
  }
}

function createPublication(input: {
  sections: EpubSection[];
  manifest: Map<string, EpubManifestItem>;
}): EpubPublication {
  const readingOrder: EpubLink[] = input.sections.map((section) => ({
    id: section.id,
    href: section.href,
    path: section.path,
    title: section.title,
    mediaType: input.manifest.get(section.id)?.mediaType,
    rels: [],
    properties: [],
    children: [],
  }));
  return {
    readingOrder,
    resources: [],
    toc: readingOrder,
    linksByPath: new Map(readingOrder.map((link) => [link.path, link])),
  };
}

function createVirtualBook(input: {
  source: BookSourceDescriptor;
  metadata: EpubMetadata;
  sectionBodies: Array<{ title: string; html: string }>;
  files?:
    Array<{ path: string; text?: string | undefined; bytes?: Uint8Array | undefined }> | undefined;
}): EpubBook {
  const sectionFiles = input.sectionBodies.map((section, index) => ({
    path: `sections/section-${index + 1}.xhtml`,
    text: createSectionHtml(section.title, section.html),
  }));
  const archive = new VirtualBookArchive([...sectionFiles, ...(input.files ?? [])]);
  const sections: EpubSection[] = sectionFiles.map((file, index) => ({
    id: `section-${index + 1}`,
    href: file.path,
    path: file.path,
    title: input.sectionBodies[index]?.title || input.metadata.title,
    linear: true,
  }));
  const manifest = new Map<string, EpubManifestItem>(
    sections.map((section) => [
      section.id,
      {
        id: section.id,
        href: section.href,
        path: section.path,
        mediaType: 'application/xhtml+xml',
        properties: [],
      },
    ])
  );
  const manifestByPath = new Map<string, EpubManifestItem>(
    Array.from(manifest.values()).map((item) => [item.path, item])
  );
  const navigation: EpubNavigationItem[] = sections.map((section, index) => ({
    id: `${section.id}-nav`,
    label: section.title,
    href: section.href,
    path: section.path,
    sectionIndex: index,
    children: [],
  }));

  return {
    source: input.source,
    metadata: input.metadata,
    archive,
    publication: createPublication({ sections, manifest }),
    packagePath: 'virtual.opf',
    manifest,
    manifestByPath,
    sections,
    navigation,
  };
}

function loadTextLikeBook(input: {
  bytes: Uint8Array;
  source: BookSourceDescriptor;
  format: 'txt' | 'md' | 'rtf';
}): EpubBook {
  const text =
    input.format === 'rtf'
      ? rtfToPlainText(decodeTextBytes(input.bytes))
      : decodeTextBytes(input.bytes);
  const sections = splitTextIntoSections(text).map((section, index) => ({
    title: index === 0 ? input.source.title : `${input.source.title} ${index + 1}`,
    html: input.format === 'md' ? markdownToHtml(section) : textToHtml(section),
  }));

  return createVirtualBook({
    source: input.source,
    metadata: {
      title: input.source.title,
      creator: input.source.author,
    },
    sectionBodies: sections,
  });
}

function loadFb2Book(input: { bytes: Uint8Array; source: BookSourceDescriptor }): EpubBook {
  const parsed = parseFb2(decodeTextBytes(input.bytes), input.source.title);
  return createVirtualBook({
    source: {
      ...input.source,
      title: parsed.title,
      author: input.source.author ?? parsed.author,
    },
    metadata: {
      title: parsed.title,
      creator: input.source.author ?? parsed.author,
    },
    sectionBodies:
      parsed.sections.length > 0
        ? parsed.sections
        : [
            {
              title: parsed.title,
              html: '',
            },
          ],
  });
}

function loadPdfBook(input: { bytes: Uint8Array; source: BookSourceDescriptor }): EpubBook {
  const pdfUri = input.source.resourceUri || bytesToDataUri(input.bytes, 'application/pdf');
  return createVirtualBook({
    source: input.source,
    metadata: {
      title: input.source.title,
      creator: input.source.author,
    },
    sectionBodies: [
      {
        title: input.source.title,
        html: `<div class="chips-reader-pdf"><iframe title="${escapeHtml(input.source.title)}" src="${escapeHtml(pdfUri)}"></iframe></div>`,
      },
    ],
  });
}

export async function loadReadableBook(input: {
  bytes: Uint8Array;
  source: BookSourceDescriptor;
}): Promise<EpubBook> {
  const format = normalizeBookFormat(input.source.format || input.source.fileName);

  if (!isRenderableBookFormat(format)) {
    throw new Error(`当前阅读器尚未接入 ${format.toUpperCase()} 的正式解码器。`);
  }

  if (format === 'epub' || format === 'epub3') {
    return loadEpubBook(input);
  }

  if (format === 'pdf') {
    return loadPdfBook(input);
  }

  if (format === 'fb2') {
    return loadFb2Book(input);
  }

  if (format === 'rtf') {
    return loadTextLikeBook({ ...input, format: 'rtf' });
  }

  return loadTextLikeBook({
    ...input,
    format: format === 'md' || format === 'markdown' ? 'md' : 'txt',
  });
}
