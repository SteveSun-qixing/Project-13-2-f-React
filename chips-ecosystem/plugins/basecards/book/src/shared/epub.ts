/**
 * EPUB 元数据纯解析（自旧族 book-BCP/src/shared/epub.ts 逐字迁移，零 Host 依赖）：
 * container.xml → OPF → 标题 / 作者 / 封面（meta name=cover → properties=cover-image →
 * 清单首个图片三臂回退），封面字节经图片 MIME 嗅探后组装为 File 与建议文件名，
 * 供编辑器资源导入臂（待工单061 通道开放后接线）消费。
 */

import { extractZipEntry, parseZipEntries, type ZipEntry } from './archive';
import {
  detectImageMimeType,
  inferImageMimeTypeFromPath,
  sanitizeImportedFileName,
  stripFileExtension,
} from './utils';

export interface EpubCoverResource {
  file: File;
  mimeType: string;
  suggestedFileName: string;
  entryPath: string;
}

export interface EpubMetadata {
  title: string;
  author: string;
  cover?: EpubCoverResource | undefined;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function parseXml(text: string): Document | null {
  if (typeof DOMParser !== 'function') {
    return null;
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }

  return doc;
}

function findEntry(entries: ZipEntry[], path: string): ZipEntry | undefined {
  const normalized = path.replace(/\\/g, '/');
  return entries.find((entry) => entry.path === normalized);
}

function joinZipPath(baseDir: string, href: string): string {
  const hrefSegments = decodeURIComponent(href)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  const baseSegments = baseDir.split('/').filter(Boolean);
  const segments = [...baseSegments];

  for (const segment of hrefSegments) {
    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join('/');
}

function getTextContentByLocalName(doc: Document, localName: string): string {
  const matches = Array.from(doc.getElementsByTagName('*'));
  const node = matches.find((item) => item.localName.toLowerCase() === localName.toLowerCase());
  return node?.textContent?.trim() ?? '';
}

function getManifestItems(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagName('*')).filter((item) => item.localName === 'item');
}

function resolveCoverHref(opfDoc: Document): string {
  const manifestItems = getManifestItems(opfDoc);
  const metaCover = Array.from(opfDoc.getElementsByTagName('*')).find((node) => (
    node.localName === 'meta' &&
    node.getAttribute('name')?.toLowerCase() === 'cover' &&
    node.getAttribute('content')
  ));
  const coverId = metaCover?.getAttribute('content') ?? '';

  if (coverId) {
    const coverItem = manifestItems.find((item) => item.getAttribute('id') === coverId);
    const href = coverItem?.getAttribute('href');
    if (href) {
      return href;
    }
  }

  const propertiesCover = manifestItems.find((item) => (
    item.getAttribute('properties')?.split(/\s+/).includes('cover-image')
  ));
  const propertiesHref = propertiesCover?.getAttribute('href');
  if (propertiesHref) {
    return propertiesHref;
  }

  const firstImage = manifestItems.find((item) => {
    const mediaType = item.getAttribute('media-type') ?? '';
    const href = item.getAttribute('href') ?? '';
    return mediaType.startsWith('image/') || Boolean(inferImageMimeTypeFromPath(href));
  });

  return firstImage?.getAttribute('href') ?? '';
}

async function readEntryText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  return decodeUtf8(await extractZipEntry(buffer, entry));
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function parseEpubMetadata(file: File): Promise<EpubMetadata> {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const containerEntry = findEntry(entries, 'META-INF/container.xml');
  if (!containerEntry) {
    return {
      title: '',
      author: '',
    };
  }

  const containerDoc = parseXml(await readEntryText(buffer, containerEntry));
  const rootFile = containerDoc
    ? Array.from(containerDoc.getElementsByTagName('*')).find((node) => node.localName === 'rootfile')
    : undefined;
  const opfPath = rootFile?.getAttribute('full-path') ?? '';
  const opfEntry = opfPath ? findEntry(entries, opfPath) : undefined;
  if (!opfEntry) {
    return {
      title: '',
      author: '',
    };
  }

  const opfDoc = parseXml(await readEntryText(buffer, opfEntry));
  if (!opfDoc) {
    return {
      title: '',
      author: '',
    };
  }

  const title = getTextContentByLocalName(opfDoc, 'title');
  const author = getTextContentByLocalName(opfDoc, 'creator');
  const coverHref = resolveCoverHref(opfDoc);
  const opfBaseDir = opfPath.split('/').slice(0, -1).join('/');
  const coverEntryPath = coverHref ? joinZipPath(opfBaseDir, coverHref) : '';
  const coverEntry = coverEntryPath ? findEntry(entries, coverEntryPath) : undefined;

  if (!coverEntry) {
    return {
      title,
      author,
    };
  }

  const coverBytes = await extractZipEntry(buffer, coverEntry);
  const mimeType = detectImageMimeType(coverBytes, coverEntry.fileName);
  if (!mimeType) {
    return {
      title,
      author,
    };
  }

  const sourceBaseName = sanitizeImportedFileName(stripFileExtension(file.name), 'ebook');
  const coverExtension = coverEntry.fileName.includes('.')
    ? coverEntry.fileName.split('.').pop()
    : mimeType.split('/').pop();
  const suggestedFileName = `${sourceBaseName}-cover.${coverExtension ?? 'jpg'}`;

  return {
    title,
    author,
    cover: {
      file: new File(
        [copyBytesToArrayBuffer(coverBytes)],
        sanitizeImportedFileName(suggestedFileName, 'ebook-cover'),
        {
          type: mimeType,
          lastModified: file.lastModified,
        }
      ),
      mimeType,
      suggestedFileName: sanitizeImportedFileName(suggestedFileName, 'ebook-cover'),
      entryPath: coverEntry.path,
    },
  };
}
