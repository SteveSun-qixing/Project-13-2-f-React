import type { ReactNode } from "react";
import {
  BgColorsOutlined,
  CloseOutlined,
  ColumnWidthOutlined,
  ControlOutlined,
  ExpandOutlined,
  FolderOpenOutlined,
  FontSizeOutlined,
  FullscreenOutlined,
  LeftOutlined,
  LinkOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReadOutlined,
  RightOutlined,
  SearchOutlined,
  ShrinkOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  TagsOutlined,
  UploadOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import type { ReaderPreferences } from "../utils/book-reader";

export type BookReaderOverlayPanel = "source" | "contents" | "preferences" | "search" | "bookmarks";

export const BOOK_READER_COMMAND_IDS = {
  openSourcePanel: `${appConfig.appId}.source.open-panel`,
  openFile: `${appConfig.appId}.source.open-file`,
  openUrl: `${appConfig.appId}.source.open-url`,
  toggleContents: `${appConfig.appId}.view.toggle-contents`,
  toggleSearch: `${appConfig.appId}.view.toggle-search`,
  toggleBookmarks: `${appConfig.appId}.view.toggle-bookmarks`,
  togglePreferences: `${appConfig.appId}.view.toggle-preferences`,
  toggleFullscreen: `${appConfig.appId}.view.toggle-fullscreen`,
  cycleBackgroundTone: `${appConfig.appId}.view.cycle-background-tone`,
  closePanel: `${appConfig.appId}.view.close-panel`,
  previousPage: `${appConfig.appId}.reader.previous-page`,
  nextPage: `${appConfig.appId}.reader.next-page`,
  previousSection: `${appConfig.appId}.reader.previous-section`,
  nextSection: `${appConfig.appId}.reader.next-section`,
  goSectionStart: `${appConfig.appId}.reader.go-section-start`,
  goSectionEnd: `${appConfig.appId}.reader.go-section-end`,
  decreaseFont: `${appConfig.appId}.reader.decrease-font`,
  increaseFont: `${appConfig.appId}.reader.increase-font`,
  narrowContent: `${appConfig.appId}.reader.narrow-content`,
  widenContent: `${appConfig.appId}.reader.widen-content`,
  toggleBookmark: `${appConfig.appId}.bookmark.toggle`,
  readingModePaginated: `${appConfig.appId}.preferences.reading-mode.paginated`,
  readingModeScroll: `${appConfig.appId}.preferences.reading-mode.scroll`,
} as const;

export const BOOK_READER_COMMAND_HANDLER_IDS = {
  openSourcePanel: "book-reader:source.open-panel",
  openFile: "book-reader:source.open-file",
  openUrl: "book-reader:source.open-url",
  toggleContents: "book-reader:view.toggle-contents",
  toggleSearch: "book-reader:view.toggle-search",
  toggleBookmarks: "book-reader:view.toggle-bookmarks",
  togglePreferences: "book-reader:view.toggle-preferences",
  toggleFullscreen: "book-reader:view.toggle-fullscreen",
  cycleBackgroundTone: "book-reader:view.cycle-background-tone",
  closePanel: "book-reader:view.close-panel",
  previousPage: "book-reader:reader.previous-page",
  nextPage: "book-reader:reader.next-page",
  previousSection: "book-reader:reader.previous-section",
  nextSection: "book-reader:reader.next-section",
  goSectionStart: "book-reader:reader.go-section-start",
  goSectionEnd: "book-reader:reader.go-section-end",
  decreaseFont: "book-reader:reader.decrease-font",
  increaseFont: "book-reader:reader.increase-font",
  narrowContent: "book-reader:reader.narrow-content",
  widenContent: "book-reader:reader.widen-content",
  toggleBookmark: "book-reader:bookmark.toggle",
  readingModePaginated: "book-reader:preferences.reading-mode.paginated",
  readingModeScroll: "book-reader:preferences.reading-mode.scroll",
} as const;

export type BookReaderCommandId =
  (typeof BOOK_READER_COMMAND_IDS)[keyof typeof BOOK_READER_COMMAND_IDS];
export type BookReaderCommandHandlerId =
  (typeof BOOK_READER_COMMAND_HANDLER_IDS)[keyof typeof BOOK_READER_COMMAND_HANDLER_IDS];

export interface BookReaderCommandRuntimeState {
  hasBook: boolean;
  activePanel: BookReaderOverlayPanel | null;
  hasCurrentBookmark: boolean;
  readingMode: ReaderPreferences["readingMode"];
  isBusy: boolean;
  canPreviousSection: boolean;
  canNextSection: boolean;
}

export type BookReaderCommandDispatch = (
  commandId: BookReaderCommandId,
  payload?: Record<string, unknown>,
) => void;

const BOOK_READER_COMMAND_HANDLER_BY_ID: Record<BookReaderCommandId, BookReaderCommandHandlerId> = {
  [BOOK_READER_COMMAND_IDS.openSourcePanel]: BOOK_READER_COMMAND_HANDLER_IDS.openSourcePanel,
  [BOOK_READER_COMMAND_IDS.openFile]: BOOK_READER_COMMAND_HANDLER_IDS.openFile,
  [BOOK_READER_COMMAND_IDS.openUrl]: BOOK_READER_COMMAND_HANDLER_IDS.openUrl,
  [BOOK_READER_COMMAND_IDS.toggleContents]: BOOK_READER_COMMAND_HANDLER_IDS.toggleContents,
  [BOOK_READER_COMMAND_IDS.toggleSearch]: BOOK_READER_COMMAND_HANDLER_IDS.toggleSearch,
  [BOOK_READER_COMMAND_IDS.toggleBookmarks]: BOOK_READER_COMMAND_HANDLER_IDS.toggleBookmarks,
  [BOOK_READER_COMMAND_IDS.togglePreferences]: BOOK_READER_COMMAND_HANDLER_IDS.togglePreferences,
  [BOOK_READER_COMMAND_IDS.toggleFullscreen]: BOOK_READER_COMMAND_HANDLER_IDS.toggleFullscreen,
  [BOOK_READER_COMMAND_IDS.cycleBackgroundTone]: BOOK_READER_COMMAND_HANDLER_IDS.cycleBackgroundTone,
  [BOOK_READER_COMMAND_IDS.closePanel]: BOOK_READER_COMMAND_HANDLER_IDS.closePanel,
  [BOOK_READER_COMMAND_IDS.previousPage]: BOOK_READER_COMMAND_HANDLER_IDS.previousPage,
  [BOOK_READER_COMMAND_IDS.nextPage]: BOOK_READER_COMMAND_HANDLER_IDS.nextPage,
  [BOOK_READER_COMMAND_IDS.previousSection]: BOOK_READER_COMMAND_HANDLER_IDS.previousSection,
  [BOOK_READER_COMMAND_IDS.nextSection]: BOOK_READER_COMMAND_HANDLER_IDS.nextSection,
  [BOOK_READER_COMMAND_IDS.goSectionStart]: BOOK_READER_COMMAND_HANDLER_IDS.goSectionStart,
  [BOOK_READER_COMMAND_IDS.goSectionEnd]: BOOK_READER_COMMAND_HANDLER_IDS.goSectionEnd,
  [BOOK_READER_COMMAND_IDS.decreaseFont]: BOOK_READER_COMMAND_HANDLER_IDS.decreaseFont,
  [BOOK_READER_COMMAND_IDS.increaseFont]: BOOK_READER_COMMAND_HANDLER_IDS.increaseFont,
  [BOOK_READER_COMMAND_IDS.narrowContent]: BOOK_READER_COMMAND_HANDLER_IDS.narrowContent,
  [BOOK_READER_COMMAND_IDS.widenContent]: BOOK_READER_COMMAND_HANDLER_IDS.widenContent,
  [BOOK_READER_COMMAND_IDS.toggleBookmark]: BOOK_READER_COMMAND_HANDLER_IDS.toggleBookmark,
  [BOOK_READER_COMMAND_IDS.readingModePaginated]: BOOK_READER_COMMAND_HANDLER_IDS.readingModePaginated,
  [BOOK_READER_COMMAND_IDS.readingModeScroll]: BOOK_READER_COMMAND_HANDLER_IDS.readingModeScroll,
};

export function resolveBookReaderCommandHandlerId(
  commandId: BookReaderCommandId,
): BookReaderCommandHandlerId | null {
  return BOOK_READER_COMMAND_HANDLER_BY_ID[commandId] ?? null;
}

interface BookReaderCommandDefinition {
  id: BookReaderCommandId;
  title: string;
  shortcut?: string;
  icon: (state: BookReaderCommandRuntimeState) => ReactNode;
  group: string;
  menuId: string;
  toolbarId: string;
  keywords?: string[];
  enabled: (state: BookReaderCommandRuntimeState) => boolean;
}

const BOOK_READER_COMMAND_DEFINITIONS: BookReaderCommandDefinition[] = [
  {
    id: BOOK_READER_COMMAND_IDS.openSourcePanel,
    title: "导入或打开书籍",
    shortcut: "Mod+O",
    icon: () => <FolderOpenOutlined />,
    group: "文件",
    menuId: "file",
    toolbarId: "reader",
    keywords: ["book", "open", "import", "导入", "书籍"],
    enabled: (state) => !state.isBusy,
  },
  {
    id: BOOK_READER_COMMAND_IDS.openFile,
    title: "打开本地电子书",
    icon: () => <UploadOutlined />,
    group: "文件",
    menuId: "file",
    toolbarId: "source",
    keywords: ["file", "epub", "本地", "电子书"],
    enabled: (state) => !state.isBusy,
  },
  {
    id: BOOK_READER_COMMAND_IDS.openUrl,
    title: "打开电子书链接",
    icon: () => <LinkOutlined />,
    group: "文件",
    menuId: "file",
    toolbarId: "source",
    keywords: ["url", "remote", "链接", "远程"],
    enabled: (state) => !state.isBusy,
  },
  {
    id: BOOK_READER_COMMAND_IDS.toggleContents,
    title: "切换目录",
    shortcut: "Mod+1",
    icon: () => <ReadOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "reader",
    keywords: ["toc", "contents", "目录"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.toggleSearch,
    title: "搜索书籍",
    shortcut: "Mod+F",
    icon: () => <SearchOutlined />,
    group: "编辑",
    menuId: "edit",
    toolbarId: "reader",
    keywords: ["search", "find", "搜索"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.toggleBookmarks,
    title: "打开书签",
    shortcut: "Mod+B",
    icon: () => <TagsOutlined />,
    group: "书签",
    menuId: "bookmarks",
    toolbarId: "reader",
    keywords: ["bookmarks", "书签"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.togglePreferences,
    title: "阅读偏好",
    shortcut: "Mod+,",
    icon: () => <ControlOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "reader",
    keywords: ["preferences", "reading", "偏好"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.toggleFullscreen,
    title: "切换全屏",
    shortcut: "F",
    icon: () => <FullscreenOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "reader",
    keywords: ["fullscreen", "full", "全屏"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.cycleBackgroundTone,
    title: "循环背景色调",
    shortcut: "T",
    icon: () => <BgColorsOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["tone", "background", "theme", "色调", "背景"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.closePanel,
    title: "关闭当前面板",
    shortcut: "Escape",
    icon: () => <CloseOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "reader",
    keywords: ["close", "panel", "关闭"],
    enabled: (state) => state.activePanel !== null,
  },
  {
    id: BOOK_READER_COMMAND_IDS.previousPage,
    title: "上一页",
    shortcut: "ArrowLeft",
    icon: () => <LeftOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["previous", "page", "上一页"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.nextPage,
    title: "下一页",
    shortcut: "ArrowRight",
    icon: () => <RightOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["next", "page", "下一页"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.previousSection,
    title: "上一章",
    shortcut: "P",
    icon: () => <StepBackwardOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["previous", "section", "chapter", "上一章"],
    enabled: (state) => state.hasBook && state.canPreviousSection,
  },
  {
    id: BOOK_READER_COMMAND_IDS.nextSection,
    title: "下一章",
    shortcut: "N",
    icon: () => <StepForwardOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["next", "section", "chapter", "下一章"],
    enabled: (state) => state.hasBook && state.canNextSection,
  },
  {
    id: BOOK_READER_COMMAND_IDS.goSectionStart,
    title: "章节开头",
    shortcut: "Home",
    icon: () => <VerticalAlignTopOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["start", "section", "开头"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.goSectionEnd,
    title: "章节结尾",
    shortcut: "End",
    icon: () => <VerticalAlignBottomOutlined />,
    group: "导航",
    menuId: "navigate",
    toolbarId: "reader-navigation",
    keywords: ["end", "section", "结尾"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.decreaseFont,
    title: "减小字号",
    shortcut: "[",
    icon: () => <FontSizeOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["font", "smaller", "字号"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.increaseFont,
    title: "增大字号",
    shortcut: "]",
    icon: () => <FontSizeOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["font", "larger", "字号"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.narrowContent,
    title: "缩窄版心",
    shortcut: "-",
    icon: () => <ShrinkOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["width", "narrow", "版心"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.widenContent,
    title: "放宽版心",
    shortcut: "=",
    icon: () => <ExpandOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["width", "wide", "版心"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.toggleBookmark,
    title: "切换当前书签",
    shortcut: "Mod+D",
    icon: (state) => (state.hasCurrentBookmark ? <PushpinFilled /> : <PushpinOutlined />),
    group: "书签",
    menuId: "bookmarks",
    toolbarId: "reader",
    keywords: ["bookmark", "书签"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.readingModePaginated,
    title: "翻页阅读",
    icon: () => <ColumnWidthOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["page", "mode", "翻页"],
    enabled: (state) => state.hasBook,
  },
  {
    id: BOOK_READER_COMMAND_IDS.readingModeScroll,
    title: "滚动阅读",
    icon: () => <VerticalAlignMiddleOutlined />,
    group: "视图",
    menuId: "view",
    toolbarId: "preferences",
    keywords: ["scroll", "mode", "滚动"],
    enabled: (state) => state.hasBook,
  },
];

export function createBookReaderCommands(
  dispatch: BookReaderCommandDispatch,
  runtimeState: BookReaderCommandRuntimeState,
): CommandItem[] {
  return BOOK_READER_COMMAND_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    shortcut: definition.shortcut,
    icon: definition.icon(runtimeState),
    group: definition.group,
    menuId: definition.menuId,
    toolbarId: definition.toolbarId,
    keywords: definition.keywords,
    enabled: definition.enabled(runtimeState),
    run: () => dispatch(definition.id),
  }));
}
