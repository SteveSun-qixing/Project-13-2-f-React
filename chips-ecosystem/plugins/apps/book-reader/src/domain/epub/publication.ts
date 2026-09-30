import { normalizeEpubPath } from './path';
import type {
  EpubLink,
  EpubManifestItem,
  EpubNavigationItem,
  EpubPublication,
  EpubSection,
} from './types';

interface CreatePublicationInput {
  manifest: Map<string, EpubManifestItem>;
  sections: EpubSection[];
  navigation: EpubNavigationItem[];
  coverPath?: string | undefined;
  navPath?: string | undefined;
}

interface LinkInput {
  id: string;
  href: string;
  path: string;
  title?: string | undefined;
  mediaType?: string | undefined;
  rels?: string[] | undefined;
  properties?: string[] | undefined;
  fragment?: string | undefined;
  children?: EpubLink[] | undefined;
}

function dedupeStrings(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

export function createPublicationLink(input: LinkInput): EpubLink {
  return {
    id: input.id,
    href: input.href,
    path: normalizeEpubPath(input.path),
    title: input.title?.trim() || undefined,
    mediaType: input.mediaType?.trim() || undefined,
    rels: dedupeStrings(input.rels),
    properties: dedupeStrings(input.properties),
    fragment: input.fragment?.trim() || undefined,
    children: input.children ?? [],
  };
}

function createResourceLink(item: EpubManifestItem, extraRels?: string[]): EpubLink {
  return createPublicationLink({
    id: item.id,
    href: item.href,
    path: item.path,
    mediaType: item.mediaType,
    rels: extraRels,
    properties: item.properties,
  });
}

function createReadingOrderLink(
  section: EpubSection,
  item: EpubManifestItem | undefined
): EpubLink {
  return createPublicationLink({
    id: section.id,
    href: section.href,
    path: section.path,
    title: section.title,
    mediaType: item?.mediaType,
    properties: item?.properties,
  });
}

function createTocLink(item: EpubNavigationItem): EpubLink {
  return createPublicationLink({
    id: item.id,
    href: item.href,
    path: item.path,
    title: item.label,
    fragment: item.fragment,
    children: item.children.map(createTocLink),
  });
}

function collectLinksByPath(
  links: EpubLink[],
  sink = new Map<string, EpubLink>()
): Map<string, EpubLink> {
  for (const link of links) {
    if (!sink.has(link.path)) {
      sink.set(link.path, link);
    }
    collectLinksByPath(link.children, sink);
  }

  return sink;
}

export function createEpubPublication(input: CreatePublicationInput): EpubPublication {
  const coverPath = input.coverPath ? normalizeEpubPath(input.coverPath) : undefined;
  const navPath = input.navPath ? normalizeEpubPath(input.navPath) : undefined;

  const readingOrder = input.sections.map((section) =>
    createReadingOrderLink(section, input.manifest.get(section.id))
  );
  const readingOrderPaths = new Set(readingOrder.map((link) => link.path));

  const resources = Array.from(input.manifest.values())
    .filter((item) => !readingOrderPaths.has(normalizeEpubPath(item.path)))
    .map((item) =>
      createResourceLink(item, [
        ...(coverPath && normalizeEpubPath(item.path) === coverPath ? ['cover'] : []),
        ...(navPath && normalizeEpubPath(item.path) === navPath ? ['contents'] : []),
      ])
    );

  const toc = input.navigation.map(createTocLink);
  const cover = resources.find((resource) => resource.path === coverPath);
  const nav = resources.find((resource) => resource.path === navPath);
  const linksByPath = collectLinksByPath([...readingOrder, ...resources, ...toc]);

  return {
    readingOrder,
    resources,
    toc,
    cover,
    nav,
    linksByPath,
  };
}
