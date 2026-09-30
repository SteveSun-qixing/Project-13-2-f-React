import type { BookSourceDescriptor } from '../../core/book-model';

export interface ReadableBookArchiveEntry {
  path: string;
  size: number;
  compressedSize: number;
  crc32: number;
  offset: number;
  isDirectory: boolean;
}

export interface ReadableBookArchive {
  listEntries(): ReadableBookArchiveEntry[];
  hasEntry(path: string): boolean;
  readBinary(entryPath: string): Promise<Uint8Array>;
  readText(entryPath: string): Promise<string>;
}

export interface EpubMetadata {
  title: string;
  creator?: string | undefined;
  language?: string | undefined;
  identifier?: string | undefined;
  publisher?: string | undefined;
  description?: string | undefined;
}

export interface EpubManifestItem {
  id: string;
  href: string;
  path: string;
  mediaType: string;
  properties: string[];
}

export interface EpubSection {
  id: string;
  href: string;
  path: string;
  title: string;
  linear: boolean;
}

export interface EpubNavigationItem {
  id: string;
  label: string;
  href: string;
  path: string;
  fragment?: string | undefined;
  sectionIndex?: number | undefined;
  children: EpubNavigationItem[];
}

export interface EpubLink {
  id: string;
  href: string;
  path: string;
  title?: string | undefined;
  mediaType?: string | undefined;
  rels: string[];
  properties: string[];
  fragment?: string | undefined;
  children: EpubLink[];
}

export interface EpubPublication {
  readingOrder: EpubLink[];
  resources: EpubLink[];
  toc: EpubLink[];
  cover?: EpubLink | undefined;
  nav?: EpubLink | undefined;
  linksByPath: Map<string, EpubLink>;
}

export interface EpubBook {
  source: BookSourceDescriptor;
  metadata: EpubMetadata;
  archive: ReadableBookArchive;
  publication: EpubPublication;
  packagePath: string;
  manifest: Map<string, EpubManifestItem>;
  manifestByPath: Map<string, EpubManifestItem>;
  sections: EpubSection[];
  navigation: EpubNavigationItem[];
  coverPath?: string | undefined;
  coverMediaType?: string | undefined;
  coverImageUri?: string | undefined;
}

export interface EpubThemePalette {
  surface: string;
  text: string;
  mutedText: string;
  primary: string;
  border: string;
  accentSurface: string;
}

export interface RenderedSectionDocument {
  title: string;
  sectionPath: string;
  html: string;
}
