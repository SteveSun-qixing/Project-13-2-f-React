import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { InputRef } from "antd";
import { Button, Empty, Input, List, Tabs } from "antd";
import { CaretLeftFilled, CaretRightFilled, CloseOutlined, SearchOutlined } from "@ant-design/icons";
import type { OutlineNode } from "./OutlinePanel";
import { OutlinePanel } from "./OutlinePanel";
import { PdfThumb } from "./PdfThumb";
import type { SidebarTab } from "../pdf/use-document-viewer";
import { formatMessage } from "../lib/messages";

export interface SidebarPanelProps {
  open: boolean;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  doc: PDFDocumentProxy | null;
  pageCount: number;
  currentPage: number;
  rotDelta: (origIdx: number) => number;
  visibleThumbs: Set<number>;
  /** 缩略图滚动容器（IntersectionObserver root） */
  thumbsRef: RefObject<HTMLDivElement>;
  setThumbRef: (idx: number) => (el: HTMLElement | null) => void;
  thumbRasterW: number;
  onThumbClick: (page: number) => void;
  onThumbContextMenu: (e: React.MouseEvent, origIdx: number) => void;
  outline: OutlineNode[] | null;
  onOutlineNode: (node: OutlineNode) => void;
  searchQuery: string;
  searchBusy: boolean;
  searchMatches: { pageIndex: number }[];
  searchCur: number;
  onSearch: (query: string) => void;
  onSearchJump: (index: number) => void;
}

/** 左侧面板：缩略图 / 书签 / 搜索结果，Tabs 切换，可折叠 */
export function SidebarPanel(props: SidebarPanelProps): ReactElement | null {
  if (!props.open) return null;
  return (
    <div className="pdf-sidebar">
      <Tabs
        className="pdf-sidebar-tabs"
        activeKey={props.tab}
        onChange={(key) => props.onTabChange(key as SidebarTab)}
        size="small"
        items={[
          {
            key: "thumbs",
            label: formatMessage("pdf.sidebar.thumbs"),
            children: props.doc ? <ThumbList {...props} /> : null,
          },
          {
            key: "outline",
            label: formatMessage("pdf.sidebar.outline"),
            children: <OutlineList outline={props.outline} onOutlineNode={props.onOutlineNode} />,
          },
          {
            key: "search",
            label: formatMessage("pdf.sidebar.search"),
            children: (
              <SearchList
                query={props.searchQuery}
                busy={props.searchBusy}
                matches={props.searchMatches}
                current={props.searchCur}
                onSearch={props.onSearch}
                onJump={props.onSearchJump}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function ThumbList(props: SidebarPanelProps): ReactElement {
  const {
    doc,
    pageCount,
    currentPage,
    rotDelta,
    visibleThumbs,
    thumbsRef,
    setThumbRef,
    thumbRasterW,
    onThumbClick,
    onThumbContextMenu,
  } = props;
  return (
    <div className="pdf-thumb-list">
      <div className="pdf-thumb-scroll" ref={thumbsRef}>
        {Array.from({ length: pageCount }, (_, idx) => {
          const page = idx + 1;
          const active = page === currentPage;
          return (
            <button
              type="button"
              key={idx}
              ref={setThumbRef(idx)}
              data-idx={idx}
              className={`pdf-thumb-item${active ? " pdf-thumb-item-active" : ""}`}
              onClick={() => onThumbClick(page)}
              onContextMenu={(e) => onThumbContextMenu(e, idx)}
              aria-label={formatMessage("pdf.status.page", { current: page, total: pageCount })}
            >
              <span className="pdf-thumb-box">
                <PdfThumb
                  doc={doc as PDFDocumentProxy}
                  pageNo={page}
                  rotationDelta={rotDelta(idx)}
                  visible={visibleThumbs.has(idx)}
                  rasterW={thumbRasterW}
                />
              </span>
              <span className="pdf-thumb-page-no">{page}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OutlineList({
  outline,
  onOutlineNode,
}: {
  outline: OutlineNode[] | null;
  onOutlineNode: (node: OutlineNode) => void;
}): ReactElement {
  if (!outline || outline.length === 0) {
    return (
      <Empty
        className="pdf-sidebar-empty"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={formatMessage("pdf.sidebar.noOutline")}
      />
    );
  }
  return (
    <div className="pdf-outline-wrap">
      <OutlinePanel outline={outline} onGoToNode={onOutlineNode} />
    </div>
  );
}

function SearchList({
  query,
  busy,
  matches,
  current,
  onSearch,
  onJump,
}: {
  query: string;
  busy: boolean;
  matches: { pageIndex: number }[];
  current: number;
  onSearch: (query: string) => void;
  onJump: (index: number) => void;
}): ReactElement {
  const inputRef = useRef<InputRef>(null);
  const focusTimer = useRef<number | null>(null);
  useEffect(() => {
    focusTimer.current = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
    };
  }, []);
  return (
    <div className="pdf-search-list">
      <Input.Search
        ref={inputRef}
        placeholder={formatMessage("pdf.sidebar.search.placeholder")}
        defaultValue={query}
        allowClear
        enterButton
        prefix={<SearchOutlined />}
        loading={busy}
        onSearch={(value) => onSearch(value)}
      />
      <div className="pdf-search-count">
        {matches.length > 0
          ? formatMessage("pdf.sidebar.search.count", { count: matches.length })
          : query.trim()
            ? formatMessage("pdf.sidebar.search.none")
            : formatMessage("pdf.sidebar.search.empty")}
      </div>
      {matches.length > 0 ? (
        <List
          className="pdf-search-results"
          size="small"
          dataSource={matches}
          renderItem={(match, index) => (
            <List.Item
              className={`pdf-search-result${index === current ? " pdf-search-result-active" : ""}`}
              onClick={() => onJump(index)}
            >
              <span className="pdf-search-result-page">
                {formatMessage("pdf.sidebar.search.page", { page: match.pageIndex + 1 })}
              </span>
            </List.Item>
          )}
        />
      ) : null}
    </div>
  );
}
