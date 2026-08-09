import React, { useEffect, useState } from "react";
import {
  ControlOutlined,
  DownOutlined,
  FolderOpenOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LeftOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReadOutlined,
  RightOutlined,
  SearchOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import type { EpubBook, EpubSection } from "../domain/epub/types";
import type { ReadingProgress } from "../engine/types";
import type { BookReaderCommandId, BookReaderOverlayPanel } from "../commands/book-reader-commands";
import { BOOK_READER_COMMAND_IDS } from "../commands/book-reader-commands";
import { ControlButton } from "./ControlButton";

export type OverlayPanel = BookReaderOverlayPanel;

export interface ReaderChromeProps {
  book: EpubBook;
  currentSection: EpubSection | null;
  currentSectionIndex: number;
  sectionCount: number;
  activePanel: OverlayPanel | null;
  progress: ReadingProgress | null;
  hasCurrentBookmark: boolean;
  onInvokeCommand: (commandId: BookReaderCommandId) => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  autoHideRemaining?: number;
}

export function ReaderChrome(props: ReaderChromeProps): React.ReactElement {
  const { book, currentSection, activePanel, progress, hasCurrentBookmark, onInvokeCommand, t } = props;

  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isBookInfoOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsBookInfoOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBookInfoOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const creatorLabel = book.metadata.creator?.trim() || t("book-reader.reader.unknownCreator");
  const sourceLabel = book.source.isRemote ? t("book-reader.reader.remoteSource") : t("book-reader.reader.localSource");
  const chapterTitle = currentSection?.title || book.metadata.title;
  const progressPercentage = progress ? Math.round(progress.bookPercentage) : null;
  const canFullscreen =
    typeof document.documentElement.requestFullscreen === "function" && document.fullscreenEnabled;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }

    void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="book-reader-chrome" data-state="visible">
      <header className="book-reader-chrome__header">
        {canFullscreen ? (
          <div className="book-reader-chrome__fullscreen">
            <ControlButton
              label={isFullscreen ? "退出全屏" : "全屏"}
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            />
          </div>
        ) : null}
        <div className="book-reader-metaCard">
          <div className="book-reader-metaCard__row">
            <button
              type="button"
              className="book-reader-metaCard__titleButton"
              aria-expanded={isBookInfoOpen}
              aria-haspopup="dialog"
              onClick={() => setIsBookInfoOpen((open) => !open)}
            >
              {chapterTitle}
              <DownOutlined
                className={`book-reader-metaCard__chevron${isBookInfoOpen ? " book-reader-metaCard__chevron--open" : ""}`}
                aria-hidden="true"
              />
            </button>
            {progressPercentage !== null ? (
              <span className="book-reader-metaCard__progress">{progressPercentage}%</span>
            ) : null}
          </div>
          {isBookInfoOpen ? (
            <div className="book-reader-metaCard__info" role="dialog" aria-label="书籍信息">
              <p className="book-reader-metaCard__infoTitle">{book.metadata.title}</p>
              <p className="book-reader-metaCard__infoCreator">{creatorLabel}</p>
              <span className="book-reader-metaCard__infoSource">{sourceLabel}</span>
            </div>
          ) : null}
        </div>
      </header>

      <div className="book-reader-chrome__navigation">
        <ControlButton
          label={t("book-reader.actions.previousPage")}
          icon={<LeftOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.previousPage)}
          variant="nav"
        />
        <ControlButton
          label={t("book-reader.actions.nextPage")}
          icon={<RightOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.nextPage)}
          variant="nav"
        />
      </div>

      <div className="book-reader-chrome__dock">
        <ControlButton
          label="打开书库"
          icon={<FolderOpenOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.openSourcePanel)}
          active={activePanel === "source"}
          variant="dock"
        />
        <ControlButton
          label="目录"
          icon={<ReadOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.toggleContents)}
          active={activePanel === "contents"}
          variant="dock"
        />
        <ControlButton
          label="搜索"
          icon={<SearchOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.toggleSearch)}
          active={activePanel === "search"}
          variant="dock"
        />
        <ControlButton
          label="书签"
          icon={hasCurrentBookmark ? <PushpinFilled /> : <PushpinOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.toggleBookmark)}
          active={hasCurrentBookmark}
          variant="dock"
        />
        <ControlButton
          label="书签列表"
          icon={<TagsOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.toggleBookmarks)}
          active={activePanel === "bookmarks"}
          variant="dock"
        />
        <ControlButton
          label="偏好"
          icon={<ControlOutlined />}
          onClick={() => onInvokeCommand(BOOK_READER_COMMAND_IDS.togglePreferences)}
          active={activePanel === "preferences"}
          variant="dock"
        />
      </div>
    </div>
  );
}
