import { useEffect, useMemo, useState } from 'react';
import type { ReadingConfigClient } from '../reading/config-client';
import { BOOKMARKS_CONFIG_KEY_PREFIX } from '../reading/config-client';
import { encodeBookSourceKey } from '../reading/keys';
import type { ReadingMode } from '../engine/types';

export interface Bookmark {
  id: string;
  sectionIndex: number;
  sectionTitle: string;
  spreadIndex: number;
  scrollFraction: number;
  readingMode: ReadingMode;
  createdAt: number;
  label?: string;
  excerpt?: string;
}

export interface UseBookmarksParams {
  bookSourceId: string | null;
  configClient: ReadingConfigClient;
}

export interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  hasBookmarkAtPosition: (position: {
    sectionIndex: number;
    readingMode: ReadingMode;
    spreadIndex: number;
    scrollFraction: number;
    tolerance?: number;
  }) => boolean;
  findBookmarkAtPosition: (position: {
    sectionIndex: number;
    readingMode: ReadingMode;
    spreadIndex: number;
    scrollFraction: number;
    tolerance?: number;
  }) => Bookmark | null;
}

function createBookmarkId(): string {
  return `bookmark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createConfigKey(sourceId: string): string {
  return encodeBookSourceKey(BOOKMARKS_CONFIG_KEY_PREFIX, sourceId);
}

function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as Bookmark)
    .filter((item) => typeof item.id === 'string' && typeof item.sectionIndex === 'number');
}

function matchesBookmarkPosition(
  bookmark: Bookmark,
  position: {
    sectionIndex: number;
    readingMode: ReadingMode;
    spreadIndex: number;
    scrollFraction: number;
    tolerance?: number;
  }
): boolean {
  if (bookmark.sectionIndex !== position.sectionIndex) {
    return false;
  }

  if (bookmark.readingMode === 'paginated' && position.readingMode === 'paginated') {
    return bookmark.spreadIndex === position.spreadIndex;
  }

  const tolerance = position.tolerance ?? 0.02;
  return Math.abs(bookmark.scrollFraction - position.scrollFraction) <= tolerance;
}

export function useBookmarks(params: UseBookmarksParams): UseBookmarksReturn {
  const { bookSourceId, configClient } = params;
  const [bookmarksMap, setBookmarksMap] = useState<Map<string, Bookmark[]>>(new Map());

  useEffect(() => {
    if (!bookSourceId) {
      return;
    }

    const existing = bookmarksMap.get(bookSourceId);
    if (existing) {
      return;
    }

    let cancelled = false;
    const key = createConfigKey(bookSourceId);

    void configClient.get<Bookmark[]>(key).then((stored) => {
      if (cancelled) {
        return;
      }

      setBookmarksMap((current) => {
        const next = new Map(current);
        next.set(bookSourceId, normalizeBookmarks(stored));
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bookSourceId, bookmarksMap, configClient]);

  const bookmarks = useMemo(() => {
    if (!bookSourceId) {
      return [];
    }

    return bookmarksMap.get(bookSourceId) ?? [];
  }, [bookSourceId, bookmarksMap]);

  function persist(sourceId: string, nextBookmarks: Bookmark[]): void {
    void configClient.set(createConfigKey(sourceId), nextBookmarks);
  }

  return {
    bookmarks,
    addBookmark: (bookmark) => {
      if (!bookSourceId) {
        return;
      }

      const nextBookmark: Bookmark = {
        ...bookmark,
        id: createBookmarkId(),
        createdAt: Date.now(),
      };

      setBookmarksMap((current) => {
        const next = new Map(current);
        const currentBookmarks = next.get(bookSourceId) ?? [];
        const nextBookmarks = [...currentBookmarks, nextBookmark].sort(
          (left, right) => left.createdAt - right.createdAt
        );
        next.set(bookSourceId, nextBookmarks);
        persist(bookSourceId, nextBookmarks);
        return next;
      });
    },
    removeBookmark: (id) => {
      if (!bookSourceId) {
        return;
      }

      setBookmarksMap((current) => {
        const next = new Map(current);
        const nextBookmarks = (next.get(bookSourceId) ?? []).filter(
          (bookmark) => bookmark.id !== id
        );
        next.set(bookSourceId, nextBookmarks);
        persist(bookSourceId, nextBookmarks);
        return next;
      });
    },
    hasBookmarkAtPosition: (position) => {
      return bookmarks.some((bookmark) => matchesBookmarkPosition(bookmark, position));
    },
    findBookmarkAtPosition: (position) => {
      return bookmarks.find((bookmark) => matchesBookmarkPosition(bookmark, position)) ?? null;
    },
  };
}
