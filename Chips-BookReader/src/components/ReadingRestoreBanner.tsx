import React from "react";
import type { ReadingPositionSnapshot } from "../hooks/useReadingPosition";
import "./reading-restore.css";

/**
 * 阅读恢复提示数据：由 AppRuntimeProvider 在书源变化、存在持久化位置时产出。
 */
export interface ReadingRestoreHint {
  /** 持久化的阅读位置快照。 */
  position: ReadingPositionSnapshot;
  /** 全书进度百分比（0–100，用于提示文案）。 */
  percentage: number;
}

export interface ReadingRestoreBannerProps {
  /** 恢复提示数据。 */
  hint: ReadingRestoreHint;
  /** "从头开始"回调：清除持久化位置并回到全书开头。 */
  onRestartFromBeginning: () => void;
}

function padTime(value: number): string {
  return String(value).padStart(2, "0");
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatLastReadAt(updatedAt: number, now: number): string {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return "";
  }

  const then = new Date(updatedAt);
  const reference = new Date(now);
  const timeLabel = `${padTime(then.getHours())}:${padTime(then.getMinutes())}`;
  const dayDiff = Math.round((startOfDay(reference) - startOfDay(then)) / 86_400_000);

  if (dayDiff <= 0) {
    return `今天 ${timeLabel}`;
  }

  if (dayDiff === 1) {
    return `昨天 ${timeLabel}`;
  }

  if (dayDiff < 7) {
    return `${dayDiff} 天前`;
  }

  return `${then.getFullYear()}/${then.getMonth() + 1}/${then.getDate()}`;
}

export function ReadingRestoreBanner(props: ReadingRestoreBannerProps): React.ReactElement {
  const { hint, onRestartFromBeginning } = props;
  const lastReadLabel = formatLastReadAt(hint.position.updatedAt, Date.now());

  return (
    <div className="book-reader-restoreBanner" role="status" aria-live="polite">
      <span className="book-reader-restoreBanner__message">
        已恢复到上次位置 {hint.percentage}%
        {lastReadLabel ? ` · 上次阅读于 ${lastReadLabel}` : null}
      </span>
      <button type="button" className="book-reader-restoreBanner__action" onClick={onRestartFromBeginning}>
        从头开始
      </button>
    </div>
  );
}
