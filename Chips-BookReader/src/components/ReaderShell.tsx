import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EpubBook, RenderedSectionDocument } from "../domain/epub/types";
import type { SearchResult } from "../engine/search-engine";
import { SearchEngine } from "../engine/search-engine";
import type { PageDirection, ReadingBoundary } from "../engine/types";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { useBookmarks, type Bookmark } from "../hooks/useBookmarks";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useReaderEngine } from "../hooks/useReaderEngine";
import { useReaderInteraction } from "../hooks/useReaderInteraction";
import { useReaderProgress } from "../hooks/useReaderProgress";
import type { PendingPositionRestore } from "../hooks/useReadingPosition";
import { useBookReaderCommands } from "../commands/useBookReaderCommands";
import {
  BOOK_READER_COMMAND_HANDLER_IDS,
  type BookReaderCommandId,
  type BookReaderCommandRuntimeState,
} from "../commands/book-reader-commands";
import {
  clampContentWidth,
  clampFontScale,
  type ReaderBackgroundTone,
  type ReaderFeedback,
  type ReaderPreferences,
} from "../utils/book-reader";
import {
  BRIGHTNESS_DEFAULT,
  READER_THEME_TRANSITION_CSS_TEXT,
  READER_THEME_TRANSITION_DURATION_MS,
  resolveBrightnessOverlayOpacity,
  type ReaderThemePaletteResolution,
} from "../utils/reader-palette";
import { BookmarkPanel } from "./BookmarkPanel";
import { ContentsPanel } from "./ContentsPanel";
import { EmptyState } from "./EmptyState";
import { FeedbackToast } from "./FeedbackToast";
import { PreferencesPanel } from "./PreferencesPanel";
import { ProgressBar, type ProgressBarSectionMark } from "./ProgressBar";
import { ReaderChrome, type OverlayPanel } from "./ReaderChrome";
import { SearchPanel } from "./SearchPanel";
import { SourcePanel } from "./SourcePanel";
import { ViewerStage } from "./ViewerStage";

const CHROME_AUTO_HIDE_DELAY_MS = 3500;
const SECTION_BANNER_DURATION_MS = 1400;
const SEARCH_DEBOUNCE_DELAY_MS = 300;
const BOOKMARK_EXCERPT_CHARS = 40;
const BACKGROUND_TONE_CYCLE: ReaderBackgroundTone[] = ["theme", "warm", "mist", "night", "system"];

function createSearchResultKey(result: SearchResult): string {
  return `${result.sectionIndex}:${result.matchOffset}:${result.matchLength}:${result.query}`;
}

function createBookmarkLookupPosition(
  sectionIndex: number,
  readingMode: ReaderPreferences["readingMode"],
  spreadIndex: number,
  scrollFraction: number,
) {
  return {
    sectionIndex,
    readingMode,
    spreadIndex,
    scrollFraction,
  } as const;
}

function isSameSearchResult(left: SearchResult | null, right: SearchResult | null): boolean {
  if (!left || !right) {
    return false;
  }

  return createSearchResultKey(left) === createSearchResultKey(right);
}

function isPageTurnKey(key: string): boolean {
  switch (key) {
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown":
    case "PageUp":
    case "PageDown":
    case " ":
    case "Home":
    case "End":
      return true;
    default:
      return false;
  }
}

function locateBookFraction(
  fraction: number,
  weights: number[],
): { sectionIndex: number; sectionFraction: number } {
  const target = Math.min(1, Math.max(0, fraction));
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (weights.length === 0 || totalWeight <= 0) {
    return { sectionIndex: 0, sectionFraction: target };
  }

  let remaining = target * totalWeight;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = Math.max(0, weights[index]);
    if (remaining <= weight || index === weights.length - 1) {
      const sectionFraction = weight > 0 ? Math.min(1, Math.max(0, remaining / weight)) : 0;
      return { sectionIndex: index, sectionFraction };
    }
    remaining -= weight;
  }

  return { sectionIndex: 0, sectionFraction: 0 };
}

function isExcerptContainerElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  switch (tagName) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
    case "li":
    case "blockquote":
    case "td":
    case "th":
    case "figcaption":
    case "dt":
    case "dd":
      return true;
    default:
      return false;
  }
}

function findExcerptContainer(element: Element | null): Element | null {
  const ownerDocument = element?.ownerDocument;
  let current: Element | null = element;
  while (current && current !== ownerDocument?.documentElement) {
    if (isExcerptContainerElement(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return ownerDocument?.body ?? null;
}

function computeTextOffsetInContainer(container: Element, targetNode: Node, targetOffset: number): number {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let accumulated = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (node === targetNode) {
      return accumulated + Math.min(Math.max(0, targetOffset), length);
    }
    accumulated += length;
    node = walker.nextNode();
  }
  return 0;
}

function buildExcerptText(rawText: string, offset: number): string | null {
  const start = Math.max(0, offset - Math.floor(BOOKMARK_EXCERPT_CHARS / 2));
  const end = Math.min(rawText.length, start + BOOKMARK_EXCERPT_CHARS);
  const excerpt = rawText.slice(start, end).replace(/\s+/g, " ").trim();
  return excerpt.length > 0 ? excerpt : null;
}

function extractCurrentExcerpt(document: Document | null): string | null {
  if (!document || !document.documentElement) {
    return null;
  }

  const view = document.defaultView;
  const width = document.documentElement.clientWidth || view?.innerWidth || 0;
  const height = document.documentElement.clientHeight || view?.innerHeight || 0;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const x = Math.round(width / 2);
  const y = Math.round(height / 2);

  let anchorNode: Node | null = null;
  let anchorOffset = 0;
  try {
    const range = document.caretRangeFromPoint(x, y);
    anchorNode = range?.startContainer ?? null;
    anchorOffset = range?.startOffset ?? 0;
  } catch {
    anchorNode = null;
  }

  if (!anchorNode && typeof document.caretPositionFromPoint === "function") {
    try {
      const position = document.caretPositionFromPoint(x, y);
      anchorNode = position?.offsetNode ?? null;
      anchorOffset = position?.offset ?? 0;
    } catch {
      anchorNode = null;
    }
  }

  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) {
    const element = document.elementFromPoint(x, y);
    const container = findExcerptContainer(element);
    if (!container) {
      return null;
    }
    const text = (container.textContent ?? "").replace(/\s+/g, " ").trim();
    return buildExcerptText(text, Math.floor(text.length / 2));
  }

  const container = findExcerptContainer(anchorNode.parentElement);
  if (!container) {
    return null;
  }
  const rawText = container.textContent ?? "";
  const offset = computeTextOffsetInContainer(container, anchorNode, anchorOffset);
  return buildExcerptText(rawText, offset);
}

export interface ReaderShellProps {
  book: EpubBook | null;
  renderedSection: RenderedSectionDocument | null;
  currentSectionIndex: number;
  currentFragment?: string;
  feedback: ReaderFeedback | null;
  isResolving: boolean;
  isLoadingSection: boolean;
  preferences: ReaderPreferences;
  themePalette: ReaderThemePaletteResolution;
  configClient: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T = unknown>(key: string, value: T): Promise<void>;
  };
  onOpenFile: () => void | Promise<void>;
  onOpenUrl: (value: string) => void | Promise<void>;
  onSelectSection: (sectionIndex: number, fragment?: string) => void;
  onStepSection: (delta: number) => void;
  onUpdatePreferences: (next: ReaderPreferences) => void;
  onDropFiles: (files: File[]) => void | Promise<void>;
  onOpenExternalLink: (url: string) => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ReaderShell(props: ReaderShellProps): React.ReactElement {
  const {
    book,
    renderedSection,
    currentSectionIndex,
    currentFragment,
    feedback,
    isResolving,
    isLoadingSection,
    preferences,
    themePalette,
    configClient,
    onOpenFile,
    onOpenUrl,
    onSelectSection,
    onStepSection,
    onUpdatePreferences,
    onDropFiles,
    onOpenExternalLink,
    t,
  } = props;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<OverlayPanel | null>(null);
  const [panelRestoreElement, setPanelRestoreElement] = useState<HTMLElement | null>(null);
  const [pendingBoundary, setPendingBoundary] = useState<ReadingBoundary | null>(null);
  const [pendingBookmark, setPendingBookmark] = useState<Bookmark | null>(null);
  const [pendingSeekFraction, setPendingSeekFraction] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number } | null>(null);
  const [localFeedback, setLocalFeedback] = useState<ReaderFeedback | null>(null);
  const [sectionBannerTitle, setSectionBannerTitle] = useState<string | null>(null);
  const { readingPosition } = useAppRuntime();
  const { savedPosition } = readingPosition;
  const pendingPositionRestoreRef = useRef<PendingPositionRestore | null>(null);
  const previousSectionIndexRef = useRef<number | null>(null);
  const sectionBannerTimerRef = useRef<number | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, { delay: SEARCH_DEBOUNCE_DELAY_MS });

  const currentSection = book?.sections[currentSectionIndex] ?? null;
  const sectionCount = book?.sections.length ?? 0;
  const sectionIndexByPath = useMemo(() => {
    return new Map((book?.sections ?? []).map((section, index) => [section.path, index]));
  }, [book]);
  const sectionWeights = useMemo(() => {
    return book ? book.sections.map(() => 1) : [1];
  }, [book]);

  const sectionMarks = useMemo<ProgressBarSectionMark[]>(() => {
    if (!book) {
      return [];
    }

    const totalWeight = sectionWeights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (totalWeight <= 0) {
      return [];
    }

    let accumulated = 0;
    return book.sections.map((section, index) => {
      const start = accumulated / totalWeight;
      accumulated += Math.max(0, sectionWeights[index] ?? 0);
      return { fraction: start, title: section.title };
    });
  }, [book, sectionWeights]);

  const sectionProgress = useMemo(() => sectionMarks.map((mark) => mark.fraction), [sectionMarks]);

  const {
    controller,
    frameDocument,
    isFrameLoading,
    navigatePage,
    navigateToBoundary,
    seekToFraction,
  } = useReaderEngine({
    iframeRef,
    renderedSection,
    preferences,
    themePalette,
    currentFragment,
    pendingBoundary,
    section: {
      index: currentSectionIndex,
      count: Math.max(1, sectionCount),
      title: currentSection?.title ?? book?.metadata.title ?? "",
      weights: sectionWeights,
    },
    onInitialLocationSettled: () => {
      setPendingBoundary(null);
    },
  });

  const { progress } = useReaderProgress({
    controller,
  });

  const {
    bookmarks,
    addBookmark,
    removeBookmark,
    findBookmarkAtPosition,
  } = useBookmarks({
    bookSourceId: book?.source.sourceId ?? null,
    configClient,
  });

  const progressBarBookmarks = useMemo(() => {
    return bookmarks.map((bookmark) => ({
      sectionIndex: bookmark.sectionIndex,
      scrollFraction: bookmark.scrollFraction,
      readingMode: bookmark.readingMode,
    }));
  }, [bookmarks]);

  const currentAnchor = useMemo(() => {
    if (!progress) {
      return null;
    }

    const anchor = controller?.getCurrentAnchor();
    return {
      spreadIndex: anchor?.spreadIndex ?? Math.max(0, progress.currentPage - 1),
      scrollFraction: anchor?.scrollFraction ?? progress.sectionFraction,
    };
  }, [controller, progress]);

  const currentBookmark = useMemo(() => {
    if (!currentAnchor || !progress) {
      return null;
    }

    return findBookmarkAtPosition(
      createBookmarkLookupPosition(
        currentSectionIndex,
        preferences.readingMode,
        currentAnchor.spreadIndex,
        currentAnchor.scrollFraction,
      ),
    );
  }, [currentAnchor, currentSectionIndex, findBookmarkAtPosition, preferences.readingMode, progress]);

  const searchEngine = useMemo(() => {
    return book ? new SearchEngine(book) : null;
  }, [book]);

  const isViewerBusy = isResolving || isLoadingSection || isFrameLoading;
  const shouldShowChrome = Boolean(book) && (isChromeVisible || activePanel !== null);
  const displayedFeedback =
    feedback?.tone === "error"
      ? feedback
      : localFeedback ?? feedback;
  const commandRuntimeState = useMemo<BookReaderCommandRuntimeState>(() => ({
    hasBook: Boolean(book),
    activePanel,
    hasCurrentBookmark: Boolean(currentBookmark),
    readingMode: preferences.readingMode,
    isBusy: isViewerBusy,
    canPreviousSection: currentSectionIndex > 0,
    canNextSection: currentSectionIndex < sectionCount - 1,
  }), [
    activePanel,
    book,
    currentBookmark,
    currentSectionIndex,
    isViewerBusy,
    preferences.readingMode,
    sectionCount,
  ]);
  const { invokeCommand, registerHandler } = useBookReaderCommands({
    runtimeState: commandRuntimeState,
  });

  const invokeReaderCommand = useCallback(
    (commandId: BookReaderCommandId, payload?: Record<string, unknown>) => {
      void invokeCommand(commandId, payload);
    },
    [invokeCommand],
  );

  useReaderInteraction({
    book,
    controller,
    frameDocument,
    activePanel,
    preferences,
    sectionIndexByPath,
    onNavigate: handleNavigate,
    onNavigateBoundary: handleNavigateBoundary,
    onInvokeCommand: (commandId) => invokeReaderCommand(commandId),
    onToggleChrome: () => {
      setIsChromeVisible((current) => !current);
    },
    onClosePanel: () => {
      setActivePanel(null);
    },
    onSelectSection: (sectionIndex, fragment) => {
      setPendingBoundary(null);
      setPendingBookmark(null);
      setActivePanel(null);
      onSelectSection(sectionIndex, fragment);
    },
    onOpenExternalLink,
    onUpdatePreferences,
  });

  const handleStepSection = useCallback(
    (delta: number): void => {
      if (!book) {
        return;
      }

      const nextIndex = currentSectionIndex + delta;
      if (nextIndex < 0 || nextIndex >= sectionCount) {
        return;
      }

      setPendingBoundary(delta > 0 ? "start" : "end");
      onStepSection(delta);
    },
    [book, currentSectionIndex, onStepSection, sectionCount],
  );

  useEffect(() => {
    const unregisterHandlers = [
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.openSourcePanel, () => {
        openPanel("source");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.openFile, () => {
        void onOpenFile();
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.openUrl, (payload) => {
        const url = typeof payload?.url === "string" ? payload.url.trim() : "";
        if (url) {
          void onOpenUrl(url);
        }
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.toggleContents, () => {
        openPanel("contents");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.toggleSearch, () => {
        openPanel("search");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.toggleBookmarks, () => {
        openPanel("bookmarks");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.togglePreferences, () => {
        openPanel("preferences");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.closePanel, () => {
        setActivePanel(null);
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.previousPage, () => {
        handleNavigate("previous");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.nextPage, () => {
        handleNavigate("next");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.previousSection, () => {
        handleStepSection(-1);
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.nextSection, () => {
        handleStepSection(1);
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.toggleFullscreen, () => {
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        } else if (typeof document.documentElement.requestFullscreen === "function") {
          void document.documentElement.requestFullscreen().catch(() => undefined);
        }
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.cycleBackgroundTone, () => {
        const currentIndex = BACKGROUND_TONE_CYCLE.indexOf(preferences.backgroundTone);
        const nextTone = currentIndex >= 0 ? BACKGROUND_TONE_CYCLE[(currentIndex + 1) % BACKGROUND_TONE_CYCLE.length] : "theme";
        onUpdatePreferences({ ...preferences, backgroundTone: nextTone });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.goSectionStart, () => {
        handleNavigateBoundary("start");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.goSectionEnd, () => {
        handleNavigateBoundary("end");
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.decreaseFont, () => {
        onUpdatePreferences({
          ...preferences,
          fontScale: clampFontScale(preferences.fontScale - 0.1),
        });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.increaseFont, () => {
        onUpdatePreferences({
          ...preferences,
          fontScale: clampFontScale(preferences.fontScale + 0.1),
        });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.narrowContent, () => {
        onUpdatePreferences({
          ...preferences,
          contentWidth: clampContentWidth(preferences.contentWidth - 40),
        });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.widenContent, () => {
        onUpdatePreferences({
          ...preferences,
          contentWidth: clampContentWidth(preferences.contentWidth + 40),
        });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.toggleBookmark, () => {
        handleToggleBookmark();
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.readingModePaginated, () => {
        onUpdatePreferences({ ...preferences, readingMode: "paginated" });
      }),
      registerHandler(BOOK_READER_COMMAND_HANDLER_IDS.readingModeScroll, () => {
        onUpdatePreferences({ ...preferences, readingMode: "scroll" });
      }),
    ];

    return () => {
      for (const unregister of unregisterHandlers) {
        unregister();
      }
    };
  }, [
    currentSectionIndex,
    handleStepSection,
    onOpenFile,
    onOpenUrl,
    onUpdatePreferences,
    preferences,
    registerHandler,
    sectionCount,
  ]);

  useEffect(() => {
    if (!localFeedback || localFeedback.tone === "error") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLocalFeedback((current) => (current === localFeedback ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [localFeedback]);

  useEffect(() => {
    setActivePanel(null);
    setPanelRestoreElement(null);
    setIsChromeVisible(false);
    setPendingBoundary(null);
    setPendingBookmark(null);
    setPendingSeekFraction(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchResult(null);
    setIsSearching(false);
    setSearchProgress(null);
    setLocalFeedback(null);
    pendingPositionRestoreRef.current = null;
    previousSectionIndexRef.current = null;
    if (sectionBannerTimerRef.current !== null) {
      window.clearTimeout(sectionBannerTimerRef.current);
      sectionBannerTimerRef.current = null;
    }
    setSectionBannerTitle(null);
  }, [book?.source.sourceId]);

  useEffect(() => {
    if (!searchEngine) {
      setSearchResults([]);
      setSelectedSearchResult(null);
      setIsSearching(false);
      setSearchProgress(null);
      return;
    }

    const query = debouncedSearchQuery.trim();
    searchEngine.cancel();

    if (!query) {
      setSearchResults([]);
      setSelectedSearchResult(null);
      setIsSearching(false);
      setSearchProgress(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedSearchResult(null);
    setSearchProgress({
      current: 0,
      total: book?.sections.length ?? 0,
    });

    void (async () => {
      try {
        for await (const batch of searchEngine.search(query, {
          onProgress: (current, total) => {
            if (!cancelled) {
              setSearchProgress({ current, total });
            }
          },
        })) {
          if (cancelled) {
            return;
          }

          startTransition(() => {
            setSearchResults((current) => [...current, ...batch]);
          });
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      searchEngine.cancel();
    };
  }, [book?.sections.length, debouncedSearchQuery, searchEngine]);

  useEffect(() => {
    if (!controller || !pendingBookmark || pendingBookmark.sectionIndex !== currentSectionIndex) {
      return;
    }

    if (preferences.readingMode === "paginated" && pendingBookmark.readingMode === "paginated") {
      controller.goToSpread(pendingBookmark.spreadIndex, "smooth");
    } else {
      controller.goToProgress(pendingBookmark.scrollFraction, "smooth");
    }

    setPendingBookmark(null);
  }, [controller, currentSectionIndex, pendingBookmark, preferences.readingMode]);

  useEffect(() => {
    if (!savedPosition || pendingPositionRestoreRef.current !== null) {
      return;
    }

    const action = readingPosition.restore(savedPosition);
    if (!action) {
      return;
    }

    pendingPositionRestoreRef.current = action;
    if (action.sectionIndex !== currentSectionIndex) {
      setPendingBookmark(null);
      onSelectSection(action.sectionIndex);
    }
  }, [currentSectionIndex, onSelectSection, readingPosition, savedPosition]);

  useEffect(() => {
    const action = pendingPositionRestoreRef.current;
    if (!action || !controller || action.sectionIndex !== currentSectionIndex) {
      return;
    }

    if (
      preferences.readingMode === "paginated" &&
      action.readingMode === "paginated" &&
      typeof action.spreadIndex === "number"
    ) {
      controller.goToSpread(action.spreadIndex, "smooth");
    } else {
      controller.goToProgress(action.scrollFraction, "smooth");
    }

    pendingPositionRestoreRef.current = null;
  }, [controller, currentSectionIndex, preferences.readingMode]);

  useEffect(() => {
    if (!book || !progress || !currentAnchor) {
      return;
    }

    readingPosition.track({
      sectionIndex: currentSectionIndex,
      readingMode: preferences.readingMode,
      spreadIndex: preferences.readingMode === "paginated" ? currentAnchor.spreadIndex : undefined,
      scrollFraction: currentAnchor.scrollFraction,
    });
  }, [book, currentAnchor, currentSectionIndex, preferences.readingMode, progress, readingPosition]);

  useEffect(() => {
    if (pendingSeekFraction === null || !controller) {
      return;
    }

    controller.goToProgress(pendingSeekFraction, "auto");
    setPendingSeekFraction(null);
  }, [controller, pendingSeekFraction]);

  useEffect(() => {
    if (!frameDocument || !frameDocument.documentElement) {
      return;
    }

    const styleId = "book-reader-theme-transition";
    let styleElement = frameDocument.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = frameDocument.createElement("style");
      styleElement.id = styleId;
      frameDocument.head?.appendChild(styleElement);
    }
    styleElement.textContent = `html, body { ${READER_THEME_TRANSITION_CSS_TEXT} }`;

    const timer = window.setTimeout(() => {
      styleElement?.remove();
    }, READER_THEME_TRANSITION_DURATION_MS + 60);

    return () => {
      window.clearTimeout(timer);
    };
  }, [frameDocument, themePalette.resolvedTone]);

  useEffect(() => {
    if (!book || activePanel !== null || !isChromeVisible) {
      return;
    }

    let hideTimer: number | null = null;

    const armHideTimer = (): void => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        setIsChromeVisible(false);
      }, CHROME_AUTO_HIDE_DELAY_MS);
    };

    const handlePointerMove = (): void => {
      armHideTimer();
    };

    const handleKeyDown: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (isPageTurnKey(keyboardEvent.key)) {
        return;
      }
      armHideTimer();
    };

    const targets: Array<Window | Document> = [window];
    if (frameDocument) {
      targets.push(frameDocument);
      if (frameDocument.defaultView) {
        targets.push(frameDocument.defaultView);
      }
    }

    for (const target of targets) {
      target.addEventListener("pointermove", handlePointerMove);
      target.addEventListener("keydown", handleKeyDown);
    }
    armHideTimer();

    return () => {
      for (const target of targets) {
        target.removeEventListener("pointermove", handlePointerMove);
        target.removeEventListener("keydown", handleKeyDown);
      }
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
    };
  }, [activePanel, book, frameDocument, isChromeVisible]);

  useEffect(() => {
    if (!book) {
      previousSectionIndexRef.current = null;
      return;
    }

    if (previousSectionIndexRef.current === null) {
      previousSectionIndexRef.current = currentSectionIndex;
      return;
    }

    if (previousSectionIndexRef.current === currentSectionIndex) {
      return;
    }

    previousSectionIndexRef.current = currentSectionIndex;
    if (pendingBoundary !== null) {
      return;
    }

    setSectionBannerTitle(currentSection?.title ?? book.metadata.title);
    if (sectionBannerTimerRef.current !== null) {
      window.clearTimeout(sectionBannerTimerRef.current);
    }
    sectionBannerTimerRef.current = window.setTimeout(() => {
      sectionBannerTimerRef.current = null;
      setSectionBannerTitle(null);
    }, SECTION_BANNER_DURATION_MS);
  }, [book, currentSection, currentSectionIndex, pendingBoundary]);

  useEffect(() => {
    if (!frameDocument || !searchEngine) {
      return;
    }

    if (activePanel !== "search" || !searchQuery.trim()) {
      searchEngine.clearHighlights(frameDocument);
      return;
    }

    const currentSectionResults = searchResults.filter((result) => result.sectionIndex === currentSectionIndex);
    if (currentSectionResults.length === 0) {
      searchEngine.clearHighlights(frameDocument);
      return;
    }

    const currentResultIndex = selectedSearchResult
      ? Math.max(0, currentSectionResults.findIndex((result) => isSameSearchResult(result, selectedSearchResult)))
      : 0;

    searchEngine.highlightInDocument(frameDocument, currentSectionResults, currentResultIndex);

    return () => {
      searchEngine.clearHighlights(frameDocument);
    };
  }, [activePanel, currentSectionIndex, frameDocument, searchEngine, searchQuery, searchResults, selectedSearchResult]);

  const searchStatusLabel = useMemo(() => {
    if (!searchQuery.trim()) {
      return null;
    }

    if (isSearching && searchProgress) {
      return t("book-reader.search.searching", {
        current: searchProgress.current,
        total: searchProgress.total,
      });
    }

    return t("book-reader.search.results", {
      count: searchResults.length,
    });
  }, [isSearching, searchProgress, searchQuery, searchResults.length, t]);

  function openPanel(panel: OverlayPanel): void {
    if (activePanel !== panel) {
      setPanelRestoreElement(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    setActivePanel((current) => (current === panel ? null : panel));
    setIsChromeVisible(true);
  }

  function handleNavigate(direction: PageDirection): void {
    if (!book) {
      return;
    }

    const result = navigatePage(direction);
    if (result?.moved) {
      return;
    }

    const delta = direction === "next" ? 1 : -1;
    const nextIndex = currentSectionIndex + delta;
    if (nextIndex < 0 || nextIndex >= sectionCount) {
      return;
    }

    setPendingBoundary(direction === "next" ? "start" : "end");
    onStepSection(delta);
  }

  function handleNavigateBoundary(boundary: ReadingBoundary): void {
    navigateToBoundary(boundary);
  }

  function seekToBookFraction(fraction: number): void {
    if (!book) {
      return;
    }

    const located = locateBookFraction(fraction, sectionWeights);
    if (located.sectionIndex === currentSectionIndex) {
      seekToFraction(located.sectionFraction);
      return;
    }

    setPendingBoundary(null);
    setPendingBookmark(null);
    setPendingSeekFraction(located.sectionFraction);
    onSelectSection(located.sectionIndex);
  }

  function handleStageClick(): void {
    if (activePanel) {
      setActivePanel(null);
      return;
    }

    setIsChromeVisible((current) => !current);
  }

  function handleToggleBookmark(): void {
    if (!book || !progress || !currentAnchor) {
      return;
    }

    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
      setLocalFeedback({
        tone: "info",
        message: t("book-reader.feedback.bookmarkRemoved"),
      });
      return;
    }

    addBookmark({
      sectionIndex: currentSectionIndex,
      sectionTitle: currentSection?.title ?? book.metadata.title,
      spreadIndex: currentAnchor.spreadIndex,
      scrollFraction: currentAnchor.scrollFraction,
      readingMode: preferences.readingMode,
      excerpt: extractCurrentExcerpt(frameDocument) ?? undefined,
    });
    setLocalFeedback({
      tone: "success",
      message: t("book-reader.feedback.bookmarkAdded"),
    });
  }

  function handleOpenBookmark(bookmark: Bookmark): void {
    if (bookmark.sectionIndex !== currentSectionIndex) {
      setPendingBookmark(bookmark);
      onSelectSection(bookmark.sectionIndex);
    } else if (controller) {
      if (preferences.readingMode === "paginated" && bookmark.readingMode === "paginated") {
        controller.goToSpread(bookmark.spreadIndex, "smooth");
      } else {
        controller.goToProgress(bookmark.scrollFraction, "smooth");
      }
    }

    setActivePanel(null);
    setIsChromeVisible(true);
  }

  function handleSearchResult(result: SearchResult): void {
    setSelectedSearchResult(result);
    setIsChromeVisible(true);

    if (result.sectionIndex !== currentSectionIndex) {
      onSelectSection(result.sectionIndex);
    }
  }

  return (
    <main
      className={`book-reader-shell${isDragActive ? " book-reader-shell--dragActive" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) {
          setIsDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) {
          void onDropFiles(files);
        }
      }}
    >
      <div className="book-reader-stage">
        {book ? (
          <ViewerStage
            iframeRef={iframeRef}
            title={currentSection?.title ?? book.metadata.title}
            isLoading={isViewerBusy}
            onClick={handleStageClick}
            t={t}
          >
            <div
              className="book-reader-chromeHost"
              data-state={shouldShowChrome ? "visible" : "hidden"}
              aria-hidden={shouldShowChrome ? undefined : true}
            >
              <ReaderChrome
                book={book}
                currentSection={currentSection}
                currentSectionIndex={currentSectionIndex}
                sectionCount={sectionCount}
                activePanel={activePanel}
                progress={progress}
                hasCurrentBookmark={Boolean(currentBookmark)}
                onInvokeCommand={(commandId) => invokeReaderCommand(commandId)}
                t={t}
              />
              <ProgressBar
                progress={progress}
                onSeek={seekToBookFraction}
                bookmarks={progressBarBookmarks}
                sectionMarks={sectionMarks}
                sectionWeights={sectionWeights}
                onBookmarkClick={(marker) => {
                  const matched = bookmarks.find(
                    (bookmark) =>
                      bookmark.sectionIndex === marker.sectionIndex &&
                      bookmark.readingMode === marker.readingMode &&
                      bookmark.scrollFraction === marker.scrollFraction,
                  );
                  if (matched) {
                    handleOpenBookmark(matched);
                  }
                }}
                onPreviousSection={() => handleStepSection(-1)}
                onNextSection={() => handleStepSection(1)}
                canPreviousSection={commandRuntimeState.canPreviousSection}
                canNextSection={commandRuntimeState.canNextSection}
                t={t}
              />
            </div>
          </ViewerStage>
        ) : (
          <EmptyState
            onOpenSource={() => {
              openPanel("source");
            }}
            onInvokeCommand={(commandId) => invokeReaderCommand(commandId)}
            t={t}
          />
        )}

        {sectionBannerTitle ? <div className="book-reader-sectionBanner">{sectionBannerTitle}</div> : null}

        {book ? (
          <div
            className="book-reader-brightness"
            style={{ "--book-reader-brightness-opacity": resolveBrightnessOverlayOpacity(preferences.brightness ?? BRIGHTNESS_DEFAULT) } as React.CSSProperties}
          />
        ) : null}

        {book && activePanel === "contents" ? (
          <ContentsPanel
            book={book}
            currentSectionIndex={currentSectionIndex}
            sectionProgress={sectionProgress}
            restoreFocusElement={panelRestoreElement}
            onSelectSection={(sectionIndex, fragment) => {
              setActivePanel(null);
              onSelectSection(sectionIndex, fragment);
            }}
            onClose={() => setActivePanel(null)}
            t={t}
          />
        ) : null}

        {activePanel === "source" ? (
          <SourcePanel
            initialUrl=""
            onOpenFile={onOpenFile}
            onOpenUrl={onOpenUrl}
            onInvokeCommand={(commandId, payload) => invokeReaderCommand(commandId, payload)}
            restoreFocusElement={panelRestoreElement}
            onClose={() => setActivePanel(null)}
            t={t}
          />
        ) : null}

        {activePanel === "preferences" ? (
          <PreferencesPanel
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
            onInvokeCommand={(commandId) => invokeReaderCommand(commandId)}
            restoreFocusElement={panelRestoreElement}
            onClose={() => setActivePanel(null)}
            t={t}
          />
        ) : null}

        {activePanel === "search" ? (
          <SearchPanel
            query={searchQuery}
            results={searchResults}
            isSearching={isSearching}
            statusLabel={searchStatusLabel}
            activeResultKey={selectedSearchResult ? createSearchResultKey(selectedSearchResult) : null}
            currentSectionIndex={currentSectionIndex}
            restoreFocusElement={panelRestoreElement}
            onQueryChange={setSearchQuery}
            onSelectResult={handleSearchResult}
            onClose={() => setActivePanel(null)}
            t={t}
          />
        ) : null}

        {activePanel === "bookmarks" ? (
          <BookmarkPanel
            bookmarks={bookmarks}
            activeBookmarkId={currentBookmark?.id ?? null}
            restoreFocusElement={panelRestoreElement}
            onGoToBookmark={handleOpenBookmark}
            onRemoveBookmark={removeBookmark}
            onClose={() => setActivePanel(null)}
            t={t}
          />
        ) : null}

        <FeedbackToast feedback={displayedFeedback} />
      </div>
    </main>
  );
}
