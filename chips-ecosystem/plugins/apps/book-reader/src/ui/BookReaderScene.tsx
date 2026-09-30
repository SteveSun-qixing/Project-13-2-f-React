import React from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Flex,
  Slider,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from '@chips/ui';
import {
  FontSizeOutlined,
  LeftOutlined,
  MenuUnfoldOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReadOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@chips/ui';
import { chips } from '@chips/sdk';
import type { IResourceOpenContext } from '@chips/sdk';
import { loadReadableBook } from '../domain/book/virtual-book';
import type { EpubBook } from '../domain/epub/types';
import { renderSectionDocument } from '../domain/epub/markup';
import { SearchEngine, type SearchResult } from '../engine/search-engine';
import type { PageDirection, ReadingBoundary } from '../engine/types';
import {
  isSupportedBookResource,
  normalizeBookFormat,
  type BookSourceDescriptor,
} from '../core/book-model';
import { BASE_READER_PALETTE, resolveReaderThemePalette } from '../core/reader-palette';
import type { ReaderPreferences } from '../core/book-model';
import { APP_COMMAND_IDS, isAppCommandId, type AppCommandStatus } from '../commands/appCommands';
import { useAppCommands } from '../commands/useAppCommands';
import {
  createChipsReadingConfigClient,
  createResilientReadingConfigClient,
  type ReadingPersistenceMode,
} from '../reading/config-client';
import {
  createSourceFromOpenContext,
  readBookFromUri,
  requestBookOpen,
} from '../reading/book-opener';
import { useReaderPreferences } from './useReaderPreferences';
import { useBookmarks, type Bookmark } from './useBookmarks';
import { useReadingPosition } from './useReadingPosition';
import { useReaderEngine } from './useReaderEngine';
import { useReaderProgress } from './useReaderProgress';
import { useReaderSystemTheme } from './useReaderSystemTheme';
import { useReaderInteraction } from './useReaderInteraction';
import { useDebouncedValue } from './useDebouncedValue';
import {
  BookmarksPanel,
  ContentsPanel,
  PanelDrawer,
  PANEL_TITLES,
  PreferencesPanel,
  SearchPanel,
  SourcePanel,
} from './ReaderPanels';

/** `resource:opened` 标准事件载荷（《14-资源打开与默认处理器契约》§5.5，消费方按契约收窄）。 */
interface ResourceOpenedPayload {
  readonly pluginId: string;
  readonly context: IResourceOpenContext;
}

type OverlayPanel = 'contents' | 'bookmarks' | 'preferences' | 'search' | 'source';

interface OpenedBook {
  readonly book: EpubBook;
}

/** 全书搜索去抖间隔（毫秒）。 */
const SEARCH_DEBOUNCE_DELAY_MS = 300;

/** 章节横幅展示时长（毫秒）。 */
const SECTION_BANNER_DURATION_MS = 1600;

function locateBookFraction(
  fraction: number,
  weights: readonly number[]
): { sectionIndex: number; sectionFraction: number } {
  const target = Math.min(1, Math.max(0, fraction));
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (weights.length === 0 || totalWeight <= 0) {
    return { sectionIndex: 0, sectionFraction: target };
  }

  let remaining = target * totalWeight;
  for (let index = 0; index < weights.length; index += 1) {
    const weight = Math.max(0, weights[index] ?? 0);
    if (remaining <= weight || index === weights.length - 1) {
      const sectionFraction = weight > 0 ? Math.min(1, Math.max(0, remaining / weight)) : 0;
      return { sectionIndex: index, sectionFraction };
    }
    remaining -= weight;
  }

  return { sectionIndex: weights.length - 1, sectionFraction: 1 };
}

/** 书籍阅读器主场景：壳层状态机、打开臂接线与命令执行器装配。 */
export const BookReaderScene: React.FC = () => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const commands = useAppCommands();

  const configClient = React.useMemo(
    () => createResilientReadingConfigClient(createChipsReadingConfigClient()),
    []
  );
  const [persistenceMode, setPersistenceMode] = React.useState<ReadingPersistenceMode>(
    configClient.mode
  );
  React.useEffect(() => {
    const unsubscribe = configClient.onModeChange(setPersistenceMode);
    return () => {
      unsubscribe();
    };
  }, [configClient]);

  const { preferences, update, reset } = useReaderPreferences({ configClient });
  const systemTheme = useReaderSystemTheme();
  const themePalette = React.useMemo(
    () =>
      resolveReaderThemePalette(
        BASE_READER_PALETTE,
        { backgroundTone: preferences.backgroundTone },
        systemTheme.isDark ? 'dark' : 'light'
      ),
    [preferences.backgroundTone, systemTheme.isDark]
  );

  const [opened, setOpened] = React.useState<OpenedBook | null>(null);
  const [isLoadingBook, setIsLoadingBook] = React.useState(false);
  const [openFailureMessage, setOpenFailureMessage] = React.useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = React.useState(0);
  const [currentFragment, setCurrentFragment] = React.useState<string | undefined>(undefined);
  const [renderedSection, setRenderedSection] = React.useState<Awaited<
    ReturnType<typeof renderSectionDocument>
  > | null>(null);
  const [isLoadingSection, setIsLoadingSection] = React.useState(false);
  const [sectionError, setSectionError] = React.useState<string | null>(null);
  const [activePanel, setActivePanel] = React.useState<OverlayPanel | null>(null);
  const [pendingBoundary, setPendingBoundary] = React.useState<ReadingBoundary | null>(null);
  const [pendingSeekFraction, setPendingSeekFraction] = React.useState<number | null>(null);
  const [sectionBannerTitle, setSectionBannerTitle] = React.useState<string | null>(null);
  const [uriInput, setUriInput] = React.useState('');
  const [isRequestingOpen, setIsRequestingOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<readonly SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchProgress, setSearchProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);

  const book = opened?.book ?? null;
  const bookSourceId = book?.source.sourceId ?? null;
  const currentSection = book?.sections[currentSectionIndex] ?? null;
  const sectionCount = book?.sections.length ?? 0;
  const sectionIndexByPath = React.useMemo(
    () => new Map((book?.sections ?? []).map((section, index) => [section.path, index] as const)),
    [book]
  );
  const sectionWeights = React.useMemo(() => book?.sections.map(() => 1) ?? [1], [book]);

  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const sectionBannerTimerRef = React.useRef<number | null>(null);
  const previousSectionIndexRef = React.useRef<number | null>(null);
  const pendingPositionRestoreRef = React.useRef<{
    sectionIndex: number;
    readingMode: 'paginated' | 'scroll';
    spreadIndex?: number | undefined;
    scrollFraction: number;
  } | null>(null);
  const pendingBookmarkRef = React.useRef<Bookmark | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, {
    delay: SEARCH_DEBOUNCE_DELAY_MS,
  });

  // ─── 书籍装载与章节渲染 ──────────────────────────────────────

  const openBookBytes = React.useCallback(
    async (bytes: Uint8Array, source: BookSourceDescriptor): Promise<void> => {
      setIsLoadingBook(true);
      setOpenFailureMessage(null);
      try {
        const nextBook = await loadReadableBook({ bytes, source });
        previousSectionIndexRef.current = null;
        setOpened({ book: nextBook });
        setCurrentSectionIndex(0);
        setCurrentFragment(undefined);
        setRenderedSection(null);
        setActivePanel(null);
        message.success(`已打开「${nextBook.metadata.title}」`);
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        setOpenFailureMessage(`无法打开该书籍：${detail}`);
      } finally {
        setIsLoadingBook(false);
      }
    },
    [message]
  );

  const openFromOpenContext = React.useCallback(
    async (context: IResourceOpenContext): Promise<void> => {
      const source = createSourceFromOpenContext(context);
      if (
        !isSupportedBookResource({
          sourceId: source.sourceId,
          fileName: source.fileName,
          mimeType: context.mimeType,
        })
      ) {
        setOpenFailureMessage('该资源不是本阅读器支持的书籍格式。');
        return;
      }
      const outcome = await readBookFromUri(context.uri, source);
      if (outcome.kind === 'failure') {
        setOpenFailureMessage(outcome.failure.message);
        return;
      }
      await openBookBytes(outcome.bytes, {
        ...outcome.source,
        format: normalizeBookFormat(outcome.mimeType || outcome.source.format || source.fileName),
      });
    },
    [openBookBytes]
  );

  // 被打开臂：订阅 `resource:opened` 标准事件（14 §5.5），平台投递后按上下文读资源。
  React.useEffect(() => {
    let subscription: { dispose(): void } | null = null;
    try {
      subscription = chips.subscribe('resource:opened', (payload: unknown) => {
        const narrowed = payload as Partial<ResourceOpenedPayload> | null;
        if (!narrowed || narrowed.pluginId !== 'chips.official.book-reader' || !narrowed.context) {
          return;
        }
        void openFromOpenContext(narrowed.context);
      });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      setOpenFailureMessage(
        code === 'SDK_BRIDGE_UNAVAILABLE'
          ? '平台事件通道不可用：无法接收资源打开投递，可改用下方资源引用发起打开。'
          : '平台事件通道订阅失败：无法接收资源打开投递。'
      );
    }
    return () => {
      subscription?.dispose();
    };
  }, [openFromOpenContext]);

  // 发起臂：经 `resource:open` 正式面请求书籍槽位；宿主路由未就绪时行内如实提示。
  const submitOpenRequest = React.useCallback(async (): Promise<void> => {
    const uri = uriInput.trim();
    if (!uri) {
      return;
    }
    setIsRequestingOpen(true);
    setOpenFailureMessage(null);
    try {
      const title = uri.split('/').pop();
      await requestBookOpen({ uri, ...(title === undefined ? {} : { title }) });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      setOpenFailureMessage(
        `资源打开路由不可用（${detail}）。宿主 resource:open 处理器就绪后即可路由到本应用。`
      );
    } finally {
      setIsRequestingOpen(false);
    }
  }, [uriInput]);

  // 章节渲染：当前章节变化时重新渲染帧内 HTML。
  React.useEffect(() => {
    if (!book) {
      setRenderedSection(null);
      return;
    }
    const section = book.sections[currentSectionIndex];
    if (!section) {
      return;
    }

    let cancelled = false;
    setIsLoadingSection(true);
    setSectionError(null);
    void renderSectionDocument(book, section.path)
      .then((document) => {
        if (!cancelled) {
          setRenderedSection(document);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSectionError(
            `渲染章节失败：${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSection(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [book, currentSectionIndex]);

  // ─── 阅读引擎与进度 ─────────────────────────────────────────

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
      title: currentSection?.title ?? book?.metadata.title ?? '',
      weights: sectionWeights,
    },
    onInitialLocationSettled: () => {
      setPendingBoundary(null);
    },
  });

  const { progress } = useReaderProgress({ controller });

  // ─── 书签与阅读位置 ─────────────────────────────────────────

  const { bookmarks, addBookmark, removeBookmark, findBookmarkAtPosition } = useBookmarks({
    bookSourceId,
    configClient,
  });

  const readingPosition = useReadingPosition({ bookSourceId, configClient });

  const currentAnchor = React.useMemo(() => {
    if (!progress) {
      return null;
    }
    const anchor = controller?.getCurrentAnchor();
    return {
      spreadIndex: anchor?.spreadIndex ?? Math.max(0, progress.currentPage - 1),
      scrollFraction: anchor?.scrollFraction ?? progress.sectionFraction,
    };
  }, [controller, progress]);

  const currentBookmark = React.useMemo(() => {
    if (!currentAnchor || !progress || !book) {
      return null;
    }
    return findBookmarkAtPosition({
      sectionIndex: currentSectionIndex,
      readingMode: preferences.readingMode,
      spreadIndex: currentAnchor.spreadIndex,
      scrollFraction: currentAnchor.scrollFraction,
    });
  }, [
    book,
    currentAnchor,
    currentSectionIndex,
    findBookmarkAtPosition,
    preferences.readingMode,
    progress,
  ]);

  const toggleBookmark = React.useCallback((): void => {
    if (!book || !progress || !currentAnchor) {
      return;
    }
    const existing = findBookmarkAtPosition({
      sectionIndex: currentSectionIndex,
      readingMode: preferences.readingMode,
      spreadIndex: currentAnchor.spreadIndex,
      scrollFraction: currentAnchor.scrollFraction,
    });
    if (existing) {
      removeBookmark(existing.id);
      message.info('已移除书签');
      return;
    }
    addBookmark({
      sectionIndex: currentSectionIndex,
      sectionTitle: currentSection?.title ?? book.metadata.title,
      spreadIndex: currentAnchor.spreadIndex,
      scrollFraction: currentAnchor.scrollFraction,
      readingMode: preferences.readingMode,
      excerpt: progress.sectionTitle,
    });
    message.success('已添加书签');
  }, [
    addBookmark,
    book,
    currentAnchor,
    currentSection,
    currentSectionIndex,
    findBookmarkAtPosition,
    message,
    preferences.readingMode,
    progress,
    removeBookmark,
  ]);

  const jumpToBookmark = React.useCallback(
    (bookmark: Bookmark): void => {
      pendingBookmarkRef.current = bookmark;
      setCurrentFragment(undefined);
      setPendingSeekFraction(null);
      if (bookmark.sectionIndex !== currentSectionIndex) {
        setPendingBoundary(null);
        setCurrentSectionIndex(bookmark.sectionIndex);
      }
    },
    [currentSectionIndex]
  );

  // 书签落位：目标章节渲染并挂载控制器后跳转到书签位置。
  React.useEffect(() => {
    const pending = pendingBookmarkRef.current;
    if (!controller || !pending || pending.sectionIndex !== currentSectionIndex) {
      return;
    }
    if (preferences.readingMode === 'paginated' && pending.readingMode === 'paginated') {
      controller.goToSpread(pending.spreadIndex, 'smooth');
    } else {
      controller.goToProgress(pending.scrollFraction, 'smooth');
    }
    pendingBookmarkRef.current = null;
  }, [controller, currentSectionIndex, preferences.readingMode]);

  // 阅读位置：节流持久化与恢复。
  React.useEffect(() => {
    if (!book || !progress || !currentAnchor) {
      return;
    }
    readingPosition.track({
      sectionIndex: currentSectionIndex,
      readingMode: preferences.readingMode,
      spreadIndex: preferences.readingMode === 'paginated' ? currentAnchor.spreadIndex : undefined,
      scrollFraction: currentAnchor.scrollFraction,
    });
  }, [
    book,
    currentAnchor,
    currentSectionIndex,
    preferences.readingMode,
    progress,
    readingPosition,
  ]);

  React.useEffect(() => {
    const saved = readingPosition.savedPosition;
    if (!saved || pendingPositionRestoreRef.current !== null) {
      return;
    }
    const action = readingPosition.restore(saved);
    if (!action) {
      return;
    }
    pendingPositionRestoreRef.current = action;
    if (action.sectionIndex !== currentSectionIndex) {
      setCurrentSectionIndex(action.sectionIndex);
    }
  }, [currentSectionIndex, readingPosition]);

  React.useEffect(() => {
    const action = pendingPositionRestoreRef.current;
    if (!controller || !action || action.sectionIndex !== currentSectionIndex) {
      return;
    }
    if (
      preferences.readingMode === 'paginated' &&
      action.readingMode === 'paginated' &&
      typeof action.spreadIndex === 'number'
    ) {
      controller.goToSpread(action.spreadIndex, 'smooth');
    } else {
      controller.goToProgress(action.scrollFraction, 'smooth');
    }
    pendingPositionRestoreRef.current = null;
  }, [controller, currentSectionIndex, preferences.readingMode]);

  // 章节横幅：跨章节导航后短暂展示章节标题。
  React.useEffect(() => {
    if (!book) {
      previousSectionIndexRef.current = null;
      return;
    }
    const previous = previousSectionIndexRef.current;
    previousSectionIndexRef.current = currentSectionIndex;
    if (previous === null || previous === currentSectionIndex || pendingBoundary !== null) {
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

  React.useEffect(() => {
    return () => {
      if (sectionBannerTimerRef.current !== null) {
        window.clearTimeout(sectionBannerTimerRef.current);
      }
    };
  }, []);

  // ─── 全书搜索 ───────────────────────────────────────────────

  const searchEngine = React.useMemo(() => (book ? new SearchEngine(book) : null), [book]);

  React.useEffect(() => {
    if (!searchEngine) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchProgress(null);
      return;
    }
    const query = debouncedSearchQuery.trim();
    searchEngine.cancel();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchProgress(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchResults([]);
    setSearchProgress({ current: 0, total: book?.sections.length ?? 0 });

    void (async (): Promise<void> => {
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
          setSearchResults((current) => [...current, ...batch]);
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
  }, [book, debouncedSearchQuery, searchEngine]);

  React.useEffect(() => {
    if (!frameDocument || !searchEngine) {
      return;
    }
    const currentSectionResults = searchResults.filter(
      (result) => result.sectionIndex === currentSectionIndex
    );
    if (
      activePanel !== 'search' ||
      !debouncedSearchQuery.trim() ||
      currentSectionResults.length === 0
    ) {
      searchEngine.clearHighlights(frameDocument);
      return;
    }
    searchEngine.highlightInDocument(frameDocument, [...currentSectionResults], 0);
    return () => {
      searchEngine.clearHighlights(frameDocument);
    };
  }, [
    activePanel,
    currentSectionIndex,
    debouncedSearchQuery,
    frameDocument,
    searchEngine,
    searchResults,
  ]);

  const selectSearchResult = React.useCallback(
    (result: SearchResult): void => {
      if (result.sectionIndex !== currentSectionIndex) {
        setCurrentFragment(undefined);
        setPendingSeekFraction(null);
        setCurrentSectionIndex(result.sectionIndex);
      } else {
        void controller?.goToProgress(
          Math.min(1, result.matchOffset / Math.max(1, result.matchOffset + 400)),
          'auto'
        );
      }
    },
    [controller, currentSectionIndex]
  );

  // ─── 导航 ───────────────────────────────────────────────────

  const stepSection = React.useCallback(
    (delta: number): void => {
      const nextIndex = currentSectionIndex + delta;
      if (!book || nextIndex < 0 || nextIndex >= book.sections.length) {
        return;
      }
      setCurrentFragment(undefined);
      setCurrentSectionIndex(nextIndex);
    },
    [book, currentSectionIndex]
  );

  const handleNavigate = React.useCallback(
    (direction: PageDirection): void => {
      if (!book) {
        return;
      }
      const result = navigatePage(direction);
      if (result?.moved) {
        return;
      }
      const delta = direction === 'next' ? 1 : -1;
      const nextIndex = currentSectionIndex + delta;
      if (nextIndex < 0 || nextIndex >= book.sections.length) {
        return;
      }
      setPendingBoundary(direction === 'next' ? 'start' : 'end');
      stepSection(delta);
    },
    [book, currentSectionIndex, navigatePage, stepSection]
  );

  const handleNavigateBoundary = React.useCallback(
    (boundary: ReadingBoundary): void => {
      navigateToBoundary(boundary);
    },
    [navigateToBoundary]
  );

  const selectSection = React.useCallback(
    (sectionIndex: number, fragment?: string): void => {
      setPendingBoundary(null);
      setPendingSeekFraction(null);
      setCurrentFragment(fragment);
      if (sectionIndex !== currentSectionIndex) {
        setCurrentSectionIndex(sectionIndex);
      }
    },
    [currentSectionIndex]
  );

  const seekToBookFraction = React.useCallback(
    (fraction: number): void => {
      const located = locateBookFraction(fraction, sectionWeights);
      if (located.sectionIndex === currentSectionIndex) {
        seekToFraction(located.sectionFraction);
        return;
      }
      setPendingBoundary(null);
      setPendingSeekFraction(located.sectionFraction);
      setCurrentFragment(undefined);
      setCurrentSectionIndex(located.sectionIndex);
    },
    [currentSectionIndex, seekToFraction, sectionWeights]
  );

  React.useEffect(() => {
    if (pendingSeekFraction === null || !controller) {
      return;
    }
    controller.goToProgress(pendingSeekFraction, 'auto');
    setPendingSeekFraction(null);
  }, [controller, pendingSeekFraction]);

  // ─── 命令执行器 ─────────────────────────────────────────────

  const applyFontDelta = React.useCallback(
    (delta: number): void => {
      update({
        fontScale: preferences.fontScale + delta,
      });
    },
    [preferences.fontScale, update]
  );

  const applyWidthDelta = React.useCallback(
    (delta: number): void => {
      update({
        contentWidth: preferences.contentWidth + delta,
      });
    },
    [preferences.contentWidth, update]
  );

  const executeCommand = React.useCallback(
    (status: AppCommandStatus): void => {
      if (!isAppCommandId(status.commandId)) {
        return;
      }
      switch (status.commandId) {
        case APP_COMMAND_IDS.previousPage:
          handleNavigate('previous');
          return;
        case APP_COMMAND_IDS.nextPage:
          handleNavigate('next');
          return;
        case APP_COMMAND_IDS.previousSection:
          if (currentSectionIndex > 0) {
            setPendingBoundary('end');
            stepSection(-1);
          }
          return;
        case APP_COMMAND_IDS.nextSection:
          if (currentSectionIndex < sectionCount - 1) {
            setPendingBoundary('start');
            stepSection(1);
          }
          return;
        case APP_COMMAND_IDS.goSectionStart:
          handleNavigateBoundary('start');
          return;
        case APP_COMMAND_IDS.goSectionEnd:
          handleNavigateBoundary('end');
          return;
        case APP_COMMAND_IDS.toggleContents:
          setActivePanel((current) => (current === 'contents' ? null : 'contents'));
          return;
        case APP_COMMAND_IDS.toggleBookmarks:
          setActivePanel((current) => (current === 'bookmarks' ? null : 'bookmarks'));
          return;
        case APP_COMMAND_IDS.togglePreferences:
          setActivePanel((current) => (current === 'preferences' ? null : 'preferences'));
          return;
        case APP_COMMAND_IDS.toggleSearch:
          setActivePanel((current) => (current === 'search' ? null : 'search'));
          return;
        case APP_COMMAND_IDS.closePanel:
          setActivePanel(null);
          return;
        case APP_COMMAND_IDS.increaseFont:
          applyFontDelta(0.05);
          return;
        case APP_COMMAND_IDS.decreaseFont:
          applyFontDelta(-0.05);
          return;
        case APP_COMMAND_IDS.widenContent:
          applyWidthDelta(40);
          return;
        case APP_COMMAND_IDS.narrowContent:
          applyWidthDelta(-40);
          return;
        case APP_COMMAND_IDS.toggleBookmark:
          toggleBookmark();
          return;
        default:
          return;
      }
    },
    [
      applyFontDelta,
      applyWidthDelta,
      currentSectionIndex,
      handleNavigate,
      handleNavigateBoundary,
      sectionCount,
      stepSection,
      toggleBookmark,
    ]
  );

  React.useEffect(() => {
    commands.setExecutor(executeCommand);
  }, [commands, executeCommand]);

  useReaderInteraction({
    book,
    controller,
    frameDocument,
    activePanel,
    preferences,
    sectionIndexByPath,
    onNavigate: handleNavigate,
    onNavigateBoundary: handleNavigateBoundary,
    onInvokeCommand: (commandId) => {
      void commands.invoke(commandId);
    },
    onToggleChrome: () => {
      setActivePanel((current) => current);
    },
    onClosePanel: () => {
      setActivePanel(null);
    },
    onSelectSection: (sectionIndex, fragment) => {
      selectSection(sectionIndex, fragment);
    },
    onOpenExternalLink: () => {
      message.info('外部链接已在阅读器内拦截，未经平台路由不放行。');
    },
    onUpdatePreferences: (next: ReaderPreferences) => {
      update(next);
    },
  });

  // ─── 渲染 ───────────────────────────────────────────────────

  const isBusy = isLoadingBook || isLoadingSection || isFrameLoading;
  const bookPercentage = progress?.bookPercentage ?? 0;

  const toolbarButton = (
    key: string,
    title: string,
    icon: React.ReactNode,
    onClick: () => void,
    active = false
  ): React.ReactElement => (
    <Tooltip key={key} title={title}>
      <Button
        type="text"
        aria-label={title}
        icon={icon}
        onClick={onClick}
        style={active ? { color: token.colorPrimary } : undefined}
      />
    </Tooltip>
  );

  return (
    <Flex
      vertical
      style={{
        height: '100vh',
        background: themePalette.surface,
        color: themePalette.text,
      }}
    >
      <Flex
        align="center"
        gap={token.marginXS}
        style={{
          paddingInline: token.paddingSM,
          paddingBlock: token.paddingXS,
          borderBottom: `1px solid ${themePalette.border}`,
        }}
      >
        {toolbarButton('source', '打开书籍', <MenuUnfoldOutlined />, () =>
          setActivePanel((current) => (current === 'source' ? null : 'source'))
        )}
        {toolbarButton(
          'contents',
          PANEL_TITLES.contents,
          <ReadOutlined />,
          () => setActivePanel((current) => (current === 'contents' ? null : 'contents')),
          activePanel === 'contents'
        )}
        {toolbarButton(
          'bookmarks',
          PANEL_TITLES.bookmarks,
          bookmarks.length > 0 && currentBookmark ? <PushpinFilled /> : <PushpinOutlined />,
          () => setActivePanel((current) => (current === 'bookmarks' ? null : 'bookmarks')),
          activePanel === 'bookmarks'
        )}
        {toolbarButton(
          'search',
          PANEL_TITLES.search,
          <SearchOutlined />,
          () => setActivePanel((current) => (current === 'search' ? null : 'search')),
          activePanel === 'search'
        )}
        {toolbarButton(
          'preferences',
          PANEL_TITLES.preferences,
          <SettingOutlined />,
          () => setActivePanel((current) => (current === 'preferences' ? null : 'preferences')),
          activePanel === 'preferences'
        )}
        <Typography.Text strong ellipsis style={{ flex: 1, marginInline: token.marginXS }}>
          {book ? book.metadata.title : '书籍阅读器'}
        </Typography.Text>
        {persistenceMode === 'memory' ? (
          <Tag color="warning" style={{ marginInlineEnd: 0 }}>
            偏好暂存于内存
          </Tag>
        ) : null}
        {toolbarButton('previous', '上一页', <LeftOutlined />, () => handleNavigate('previous'))}
        {toolbarButton('next', '下一页', <RightOutlined />, () => handleNavigate('next'))}
        {toolbarButton('font-increase', '增大字号', <FontSizeOutlined />, () =>
          applyFontDelta(0.05)
        )}
      </Flex>

      {sectionBannerTitle === null ? null : (
        <div
          role="status"
          style={{
            textAlign: 'center',
            paddingBlock: token.paddingXS,
            borderBottom: `1px solid ${themePalette.border}`,
          }}
        >
          <Typography.Text type="secondary">{sectionBannerTitle}</Typography.Text>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {book === null ? (
          <Flex
            align="center"
            justify="center"
            vertical
            gap={token.marginMD}
            style={{ height: '100%', padding: token.paddingLG }}
          >
            <Empty description="尚未打开书籍" />
            <SourcePanel
              uriInput={uriInput}
              onUriInputChange={setUriInput}
              onSubmit={() => void submitOpenRequest()}
              submitting={isRequestingOpen}
              failureMessage={openFailureMessage}
              persistenceMode={persistenceMode}
            />
            {commands.phase !== 'ready' ? (
              <Typography.Text type="secondary" role="status">
                {commands.phase === 'error'
                  ? `命令通道异常（${commands.errorCode ?? '未知错误'}）：阅读命令暂不可用，界面按钮仍可直接操作。`
                  : '命令注册中'}
              </Typography.Text>
            ) : null}
          </Flex>
        ) : (
          <>
            <iframe
              ref={iframeRef}
              title="书籍内容"
              style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
            />
            {isBusy ? (
              <div
                role="status"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Spin />
              </div>
            ) : null}
            {sectionError === null ? null : (
              <div
                style={{ position: 'absolute', insetInline: 0, top: 0, padding: token.paddingSM }}
              >
                <Alert
                  type="error"
                  showIcon
                  role="alert"
                  message={sectionError}
                  style={{ background: token.colorBgContainer }}
                />
              </div>
            )}
            {activePanel === 'source' || openFailureMessage === null ? null : (
              <div
                style={{ position: 'absolute', insetInline: 0, top: 0, padding: token.paddingSM }}
              >
                <Alert
                  type="error"
                  showIcon
                  role="alert"
                  closable
                  onClose={() => setOpenFailureMessage(null)}
                  message={openFailureMessage}
                  style={{ background: token.colorBgContainer }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Flex
        align="center"
        gap={token.marginSM}
        style={{
          paddingInline: token.paddingSM,
          paddingBlock: token.paddingXS,
          borderTop: `1px solid ${themePalette.border}`,
        }}
      >
        <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
          {book
            ? progress?.readingMode === 'paginated' && progress.totalPages > 0
              ? `${progress.currentPage}/${progress.totalPages} 页`
              : `${currentSectionIndex + 1}/${Math.max(1, sectionCount)} 章`
            : '未打开书籍'}
        </Typography.Text>
        <Slider
          style={{ flex: 1, margin: 0 }}
          min={0}
          max={100}
          value={bookPercentage}
          disabled={book === null}
          aria-label="全书进度"
          tooltip={{ formatter: (value): string => `全书进度 ${value}%` }}
          onChange={(value) => seekToBookFraction(value / 100)}
        />
        <Space size={0}>
          <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
            全书进度 {bookPercentage}%
          </Typography.Text>
        </Space>
      </Flex>

      <PanelDrawer
        title={PANEL_TITLES.contents}
        open={book !== null && activePanel === 'contents'}
        onClose={() => setActivePanel(null)}
      >
        {book === null ? null : (
          <ContentsPanel
            toc={book.publication.toc}
            activeSectionPath={currentSection?.path ?? null}
            sectionIndexByPath={sectionIndexByPath}
            onSelect={selectSection}
          />
        )}
      </PanelDrawer>
      <PanelDrawer
        title={PANEL_TITLES.bookmarks}
        open={book !== null && activePanel === 'bookmarks'}
        onClose={() => setActivePanel(null)}
      >
        <BookmarksPanel
          bookmarks={bookmarks}
          currentBookmarkId={currentBookmark?.id ?? null}
          onJump={jumpToBookmark}
          onRemove={(id) => {
            removeBookmark(id);
            message.info('已移除书签');
          }}
        />
      </PanelDrawer>
      <PanelDrawer
        title={PANEL_TITLES.search}
        open={book !== null && activePanel === 'search'}
        onClose={() => setActivePanel(null)}
      >
        <SearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          isSearching={isSearching}
          progress={searchProgress}
          results={searchResults}
          onSelectResult={selectSearchResult}
        />
      </PanelDrawer>
      <PanelDrawer
        title={PANEL_TITLES.preferences}
        open={activePanel === 'preferences'}
        onClose={() => setActivePanel(null)}
      >
        <PreferencesPanel
          preferences={preferences}
          persistenceMode={persistenceMode}
          onChange={update}
          onReset={reset}
        />
      </PanelDrawer>
      <PanelDrawer
        title={PANEL_TITLES.source}
        open={activePanel === 'source'}
        onClose={() => setActivePanel(null)}
      >
        <SourcePanel
          uriInput={uriInput}
          onUriInputChange={setUriInput}
          onSubmit={() => void submitOpenRequest()}
          submitting={isRequestingOpen}
          failureMessage={openFailureMessage}
          persistenceMode={persistenceMode}
        />
      </PanelDrawer>
    </Flex>
  );
};

export default BookReaderScene;
