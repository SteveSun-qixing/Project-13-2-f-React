import React, { useMemo } from "react";
import { Button, Slider, Tooltip } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { ReadingProgress } from "../engine/types";

export interface ProgressBarBookmark {
  sectionIndex: number;
  scrollFraction: number;
  readingMode: string;
}

export interface ProgressBarSectionMark {
  fraction: number;
  title: string;
}

export interface ProgressBarProps {
  progress: ReadingProgress | null;
  onSeek: (fraction: number) => void;
  bookmarks?: ProgressBarBookmark[];
  sectionMarks?: ProgressBarSectionMark[];
  sectionWeights?: number[];
  onBookmarkClick?: (bookmark: ProgressBarBookmark) => void;
  onPreviousSection?: () => void;
  onNextSection?: () => void;
  canPreviousSection?: boolean;
  canNextSection?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function computeBookmarkFraction(
  bookmark: ProgressBarBookmark,
  weights: number[] | undefined,
  sectionCount: number,
): number {
  const withinSection = clampFraction(bookmark.scrollFraction);
  if (weights && bookmark.sectionIndex >= 0 && bookmark.sectionIndex < weights.length) {
    const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (totalWeight > 0) {
      const beforeWeight = weights
        .slice(0, bookmark.sectionIndex)
        .reduce((sum, weight) => sum + Math.max(0, weight), 0);
      const currentWeight = Math.max(0, weights[bookmark.sectionIndex]);
      return clampFraction((beforeWeight + currentWeight * withinSection) / totalWeight);
    }
  }
  const count = Math.max(1, sectionCount);
  return clampFraction((bookmark.sectionIndex + withinSection) / count);
}

function resolveTrackChapter(
  fraction: number,
  marks: ProgressBarSectionMark[] | undefined,
  fallbackTitle: string,
): { title: string; start: number; end: number } {
  if (marks && marks.length > 0) {
    let index = 0;
    for (let i = 0; i < marks.length; i += 1) {
      if (marks[i].fraction <= fraction) {
        index = i;
      } else {
        break;
      }
    }
    const start = index === 0 && marks[0].fraction > 0 ? 0 : marks[index].fraction;
    const end = index + 1 < marks.length ? marks[index + 1].fraction : 1;
    return { title: marks[index].title, start, end };
  }
  return { title: fallbackTitle, start: 0, end: 1 };
}

export function ProgressBar(props: ProgressBarProps): React.ReactElement | null {
  const {
    progress,
    onSeek,
    bookmarks,
    sectionMarks,
    sectionWeights,
    onBookmarkClick,
    onPreviousSection,
    onNextSection,
    canPreviousSection,
    canNextSection,
    t,
  } = props;

  const sectionMarkers = useMemo(() => {
    return (sectionMarks ?? []).map((mark) => ({
      ...mark,
      fraction: clampFraction(mark.fraction),
    }));
  }, [sectionMarks]);

  const bookmarkMarkers = useMemo(() => {
    if (!progress || !bookmarks || bookmarks.length === 0) {
      return [];
    }
    return bookmarks.map((bookmark) => ({
      bookmark,
      fraction: computeBookmarkFraction(bookmark, sectionWeights, progress.sectionCount),
      title: sectionMarks?.[bookmark.sectionIndex]?.title,
    }));
  }, [bookmarks, progress, sectionMarks, sectionWeights]);

  if (!progress) {
    return null;
  }

  const sectionValue = Math.round(progress.bookFraction * 1000);
  const pageLabel =
    progress.readingMode === "paginated"
      ? t("book-reader.reader.pagePosition", {
          current: progress.currentPage,
          total: progress.totalPages,
        })
      : `${Math.round(progress.sectionFraction * 100)}%`;
  const progressLabel = t("book-reader.reader.bookProgress", {
    percentage: progress.bookPercentage,
  });

  return (
    <section className="book-reader-progress" aria-label={t("book-reader.labels.progress")}>
      <div className="book-reader-progress__meta">
        <span className="book-reader-progress__section">{progress.sectionTitle}</span>
        <span className="book-reader-progress__label">
          {pageLabel} · {progressLabel}
        </span>
      </div>
      <div className="book-reader-progress__controls">
        <Button
          type="text"
          className="book-reader-progress__chapterButton"
          aria-label="上一章"
          title="上一章"
          icon={<LeftOutlined />}
          disabled={canPreviousSection !== true}
          onClick={() => onPreviousSection?.()}
        />
        <div className="book-reader-progress__track">
          <div className="book-reader-progress__overlay">
            {sectionMarkers.map((mark, index) => (
              <Tooltip key={`section-mark-${index}`} title={mark.title}>
                <span
                  className="book-reader-progress__markHit"
                  aria-hidden="true"
                  style={{ "--book-reader-progress-fraction": mark.fraction } as React.CSSProperties}
                >
                  <span className="book-reader-progress__mark" />
                </span>
              </Tooltip>
            ))}
            {bookmarkMarkers.map((marker, index) => (
              <Tooltip key={`bookmark-${index}`} title={marker.title}>
                <button
                  type="button"
                  className="book-reader-progress__bookmark"
                  style={{ "--book-reader-progress-fraction": marker.fraction } as React.CSSProperties}
                  aria-label={marker.title ? `书签：${marker.title}` : "书签"}
                  onClick={() => onBookmarkClick?.(marker.bookmark)}
                />
              </Tooltip>
            ))}
          </div>
          <Slider
            min={0}
            max={1000}
            step={1}
            value={sectionValue}
            aria-label={t("book-reader.labels.progress")}
            tooltip={{
              formatter: (value) => {
                const fraction = clampFraction((value ?? sectionValue) / 1000);
                const chapter = resolveTrackChapter(fraction, sectionMarks, progress.sectionTitle);
                const percentage = Math.round(
                  clampFraction((fraction - chapter.start) / Math.max(chapter.end - chapter.start, Number.EPSILON)) *
                    100,
                );
                return `${chapter.title} · ${percentage}%`;
              },
            }}
            onChange={(value) => {
              onSeek(value / 1000);
            }}
          />
        </div>
        <Button
          type="text"
          className="book-reader-progress__chapterButton"
          aria-label="下一章"
          title="下一章"
          icon={<RightOutlined />}
          disabled={canNextSection !== true}
          onClick={() => onNextSection?.()}
        />
      </div>
    </section>
  );
}
