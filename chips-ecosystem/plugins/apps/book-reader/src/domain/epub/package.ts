import { resolveFileName, type BookSourceDescriptor } from '../../core/book-model';
import {
  dirnameEpubPath,
  joinEpubHref,
  normalizeEpubPath,
  resolveEpubHref,
  resolveEpubPathFromDirectory,
} from './path';
import { openEpubArchive } from './archive';
import { createEpubPublication } from './publication';
import { readArchiveDataUri } from './resources';
import type {
  EpubBook,
  EpubManifestItem,
  EpubMetadata,
  EpubNavigationItem,
  EpubSection,
} from './types';

function parseXmlDocument(source: string, label: string): XMLDocument {
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error(`解析 ${label} 失败：${parserError.textContent?.trim() || 'XML 无法解析'}`);
  }
  return document;
}

function parseHtmlDocument(source: string): Document {
  return new DOMParser().parseFromString(source, 'text/html');
}

function getElementsByLocalName(root: ParentNode, localName: string): Element[] {
  const scopedRoot = root as Document | Element;
  return Array.from(scopedRoot.getElementsByTagName('*')).filter(
    (element): element is Element => element.localName === localName
  );
}

function getFirstByLocalName(root: ParentNode, localName: string): Element | null {
  return getElementsByLocalName(root, localName)[0] ?? null;
}

function readAttribute(element: Element | null, attributeName: string): string | undefined {
  if (!element) {
    return undefined;
  }

  const direct = element.getAttribute(attributeName)?.trim();
  if (direct) {
    return direct;
  }

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === attributeName || attribute.localName === attributeName) {
      const value = attribute.value.trim();
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function readText(element: Element | null): string | undefined {
  const text = element?.textContent?.trim();
  return text && text.length > 0 ? text : undefined;
}

function parseProperties(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildMetadata(document: XMLDocument): EpubMetadata {
  const metadataRoot = getFirstByLocalName(document, 'metadata');

  const findFirstText = (localName: string): string | undefined => {
    return readText(getElementsByLocalName(metadataRoot ?? document, localName)[0] ?? null);
  };

  return {
    title: findFirstText('title') ?? 'Untitled EPUB',
    creator: findFirstText('creator'),
    language: findFirstText('language'),
    identifier: findFirstText('identifier'),
    publisher: findFirstText('publisher'),
    description: findFirstText('description'),
  };
}

function buildManifest(
  document: XMLDocument,
  packagePath: string
): {
  manifest: Map<string, EpubManifestItem>;
  manifestByPath: Map<string, EpubManifestItem>;
  coverPath?: string | undefined;
  coverMediaType?: string | undefined;
  navPath?: string | undefined;
  ncxPath?: string | undefined;
} {
  const manifestRoot = getFirstByLocalName(document, 'manifest');
  const spineRoot = getFirstByLocalName(document, 'spine');
  const packageDir = dirnameEpubPath(packagePath);
  const manifest = new Map<string, EpubManifestItem>();
  const manifestByPath = new Map<string, EpubManifestItem>();

  let navPath: string | undefined;
  let ncxPath: string | undefined;
  let coverMetaId: string | undefined;

  for (const metaElement of getElementsByLocalName(document, 'meta')) {
    if (readAttribute(metaElement, 'name') === 'cover') {
      coverMetaId = readAttribute(metaElement, 'content');
      break;
    }
  }

  const spineTocId = readAttribute(spineRoot, 'toc');

  for (const itemElement of getElementsByLocalName(manifestRoot ?? document, 'item')) {
    const id = readAttribute(itemElement, 'id');
    const href = readAttribute(itemElement, 'href');
    const mediaType = readAttribute(itemElement, 'media-type');

    if (!id || !href || !mediaType) {
      continue;
    }

    const path = resolveEpubPathFromDirectory(packageDir, href);
    const item: EpubManifestItem = {
      id,
      href,
      path,
      mediaType,
      properties: parseProperties(readAttribute(itemElement, 'properties')),
    };

    manifest.set(id, item);
    manifestByPath.set(path, item);

    if (item.properties.includes('nav')) {
      navPath = path;
    }

    if (spineTocId && id === spineTocId) {
      ncxPath = path;
    }
  }

  const coverItem =
    Array.from(manifest.values()).find((item) => item.properties.includes('cover-image')) ||
    (coverMetaId ? manifest.get(coverMetaId) : undefined);

  return {
    manifest,
    manifestByPath,
    coverPath: coverItem?.path,
    coverMediaType: coverItem?.mediaType,
    navPath,
    ncxPath,
  };
}

function buildFallbackSections(
  document: XMLDocument,
  manifest: Map<string, EpubManifestItem>
): EpubSection[] {
  const spineRoot = getFirstByLocalName(document, 'spine');
  const sections: EpubSection[] = [];

  for (const itemRef of getElementsByLocalName(spineRoot ?? document, 'itemref')) {
    const idref = readAttribute(itemRef, 'idref');
    if (!idref) {
      continue;
    }

    const manifestItem = manifest.get(idref);
    if (!manifestItem) {
      continue;
    }

    if (!manifestItem.mediaType.includes('html') && !manifestItem.mediaType.includes('xml')) {
      continue;
    }

    sections.push({
      id: manifestItem.id,
      href: manifestItem.href,
      path: manifestItem.path,
      title: resolveFileName(manifestItem.path),
      linear: readAttribute(itemRef, 'linear') !== 'no',
    });
  }

  return sections;
}

function buildSectionIndexByPath(sections: EpubSection[]): Map<string, number> {
  return new Map(sections.map((section, index) => [normalizeEpubPath(section.path), index]));
}

function attachSectionIndices(
  items: EpubNavigationItem[],
  sectionIndexByPath: Map<string, number>
): EpubNavigationItem[] {
  return items.map((item) => ({
    ...item,
    sectionIndex: sectionIndexByPath.get(normalizeEpubPath(item.path)),
    children: attachSectionIndices(item.children, sectionIndexByPath),
  }));
}

function collectSectionTitles(
  items: EpubNavigationItem[],
  sink = new Map<string, string>()
): Map<string, string> {
  for (const item of items) {
    if (item.path && item.label) {
      sink.set(normalizeEpubPath(item.path), item.label);
    }
    collectSectionTitles(item.children, sink);
  }
  return sink;
}

function buildFallbackNavigation(sections: EpubSection[]): EpubNavigationItem[] {
  return sections.map((section, index) => ({
    id: `${section.id}-nav`,
    label: section.title,
    href: section.href,
    path: section.path,
    fragment: undefined,
    sectionIndex: index,
    children: [],
  }));
}

function parseNavList(
  listElement: Element | null,
  basePath: string,
  parentId: string
): EpubNavigationItem[] {
  if (!listElement) {
    return [];
  }

  const items: EpubNavigationItem[] = [];
  const listItems = Array.from(listElement.children).filter((child) => child.localName === 'li');

  listItems.forEach((listItem, index) => {
    const linkElement =
      Array.from(listItem.children).find((child) => child.localName === 'a') ??
      Array.from(listItem.children).find((child) => child.localName === 'span');

    if (!linkElement) {
      return;
    }

    const hrefValue = readAttribute(linkElement, 'href') ?? '';
    const target = resolveEpubHref(basePath, hrefValue);
    const nestedList = Array.from(listItem.children).find((child) => child.localName === 'ol');

    items.push({
      id: `${parentId}-${index}`,
      label: readText(linkElement) ?? `Section ${index + 1}`,
      href: joinEpubHref(target.path, target.fragment),
      path: target.path,
      fragment: target.fragment,
      children: parseNavList(nestedList ?? null, basePath, `${parentId}-${index}`),
    });
  });

  return items;
}

function parseNavigationDocument(
  navDocumentText: string,
  navPath: string
): Promise<EpubNavigationItem[]> {
  const document = parseHtmlDocument(navDocumentText);
  const navElements = Array.from(document.querySelectorAll('nav'));
  const tocRoot =
    navElements.find((element) =>
      Array.from(element.attributes).some(
        (attribute) => attribute.localName === 'type' && attribute.value === 'toc'
      )
    ) ?? navElements[0];

  if (!tocRoot) {
    return Promise.resolve([]);
  }

  const listRoot = tocRoot.querySelector('ol');
  return Promise.resolve(parseNavList(listRoot, navPath, 'nav'));
}

function parseNcxNavPoint(
  navPoint: Element,
  ncxPath: string,
  parentId: string
): EpubNavigationItem {
  const label = readText(getFirstByLocalName(navPoint, 'text')) ?? parentId;
  const content = getFirstByLocalName(navPoint, 'content');
  const src = readAttribute(content, 'src') ?? '';
  const target = resolveEpubHref(ncxPath, src);
  const childPoints = Array.from(navPoint.children).filter(
    (child) => child.localName === 'navPoint'
  );

  return {
    id: parentId,
    label,
    href: joinEpubHref(target.path, target.fragment),
    path: target.path,
    fragment: target.fragment,
    children: childPoints.map((child, index) =>
      parseNcxNavPoint(child, ncxPath, `${parentId}-${index}`)
    ),
  };
}

function parseNcxDocument(ncxText: string, ncxPath: string): Promise<EpubNavigationItem[]> {
  const document = parseXmlDocument(ncxText, 'NCX');
  const navMap = getFirstByLocalName(document, 'navMap');
  const topLevel = Array.from(navMap?.children ?? []).filter(
    (child) => child.localName === 'navPoint'
  );

  return Promise.resolve(
    topLevel.map((navPoint, index) => parseNcxNavPoint(navPoint, ncxPath, `ncx-${index}`))
  );
}

export async function loadEpubBook(input: {
  bytes: Uint8Array;
  source: BookSourceDescriptor;
}): Promise<EpubBook> {
  const archive = await openEpubArchive(input.bytes);
  const containerText = await archive.readText('META-INF/container.xml');
  const containerDocument = parseXmlDocument(containerText, 'container.xml');
  const rootFileElement = getFirstByLocalName(containerDocument, 'rootfile');
  const packagePath = normalizeEpubPath(readAttribute(rootFileElement, 'full-path') ?? '');

  if (!packagePath) {
    throw new Error('EPUB 文件缺少 OPF 包描述入口。');
  }

  const packageDocument = parseXmlDocument(await archive.readText(packagePath), packagePath);
  const metadata = buildMetadata(packageDocument);
  const manifestState = buildManifest(packageDocument, packagePath);
  const sections = buildFallbackSections(packageDocument, manifestState.manifest);

  if (sections.length === 0) {
    throw new Error('EPUB 文件中没有可阅读的 spine 内容。');
  }

  let navigation: EpubNavigationItem[] = [];

  if (manifestState.navPath && archive.hasEntry(manifestState.navPath)) {
    navigation = await parseNavigationDocument(
      await archive.readText(manifestState.navPath),
      manifestState.navPath
    );
  } else if (manifestState.ncxPath && archive.hasEntry(manifestState.ncxPath)) {
    navigation = await parseNcxDocument(
      await archive.readText(manifestState.ncxPath),
      manifestState.ncxPath
    );
  }

  if (navigation.length === 0) {
    navigation = buildFallbackNavigation(sections);
  }

  const sectionIndexByPath = buildSectionIndexByPath(sections);
  const navigationWithIndices = attachSectionIndices(navigation, sectionIndexByPath);
  const sectionTitles = collectSectionTitles(navigationWithIndices);
  const normalizedSections = sections.map((section) => ({
    ...section,
    title: sectionTitles.get(normalizeEpubPath(section.path)) ?? section.title,
  }));
  const publication = createEpubPublication({
    manifest: manifestState.manifest,
    sections: normalizedSections,
    navigation: navigationWithIndices,
    coverPath: manifestState.coverPath,
    navPath: manifestState.navPath,
  });
  const coverImageUri =
    manifestState.coverPath && archive.hasEntry(manifestState.coverPath)
      ? await readArchiveDataUri(archive, manifestState.coverPath, manifestState.coverMediaType)
      : undefined;

  return {
    source: input.source,
    metadata,
    archive,
    publication,
    packagePath,
    manifest: manifestState.manifest,
    manifestByPath: manifestState.manifestByPath,
    sections: normalizedSections,
    navigation: navigationWithIndices,
    coverPath: manifestState.coverPath,
    coverMediaType: manifestState.coverMediaType,
    coverImageUri,
  };
}
