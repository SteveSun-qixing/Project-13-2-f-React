import { memo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { formatDuration } from "../utils/video-player";
import "./Timeline.css";

export interface TimelineProps {
  duration: number;
  currentTime: number;
  bufferedUntil: number;
  disabled?: boolean;
  onPreview?: (time: number) => void;
  onCommit?: (time: number) => void;
  ariaLabel?: string;
}

const KEYBOARD_STEP_SECONDS = 5;

function clampTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, value);
  }
  return Math.min(duration, Math.max(0, value));
}

export const Timeline = memo(function Timeline(props: TimelineProps): ReactElement {
  const { duration, currentTime, bufferedUntil, disabled = false, onPreview, onCommit, ariaLabel } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  function timeFromClientX(clientX: number): number {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }
    return clampTime((clientX - rect.left) / rect.width, 1) * duration;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }
    draggingRef.current = true;
    setHoverTime(null);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.currentTarget.focus();
    const next = clampTime(timeFromClientX(event.clientX), duration);
    setPreviewTime(next);
    onPreview?.(next);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }
    if (!draggingRef.current) {
      setHoverTime(clampTime(timeFromClientX(event.clientX), duration));
      return;
    }
    const next = clampTime(timeFromClientX(event.clientX), duration);
    setPreviewTime(next);
    onPreview?.(next);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled || !draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    const committed = clampTime(timeFromClientX(event.clientX), duration);
    setPreviewTime(null);
    onCommit?.(committed);
  }

  function handlePointerCancel(): void {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    setPreviewTime(null);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = clampTime(currentTime + KEYBOARD_STEP_SECONDS, duration);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = clampTime(currentTime - KEYBOARD_STEP_SECONDS, duration);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = clampTime(duration, duration);
    }

    if (next === null || next === clampTime(currentTime, duration)) {
      return;
    }

    event.preventDefault();
    onCommit?.(next);
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeBufferedUntil = clampTime(bufferedUntil, safeDuration);
  const displayedTime = previewTime !== null ? clampTime(previewTime, safeDuration) : clampTime(currentTime, safeDuration);
  const progressRatio = safeDuration > 0 ? displayedTime / safeDuration : 0;
  const bufferedRatio = safeDuration > 0 ? safeBufferedUntil / safeDuration : 0;
  const shownTime = previewTime ?? hoverTime;
  const shownRatio = shownTime !== null && safeDuration > 0 ? clampTime(shownTime, safeDuration) / safeDuration : null;

  return (
    <div
      className="video-player-timeline"
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={clampTime(currentTime, safeDuration)}
      aria-valuetext={formatDuration(clampTime(currentTime, safeDuration))}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => {
        setHoverTime(null);
      }}
      onKeyDown={handleKeyDown}
    >
      <div ref={trackRef} className="video-player-timeline__track">
        <div className="video-player-timeline__buffer" style={{ width: `${bufferedRatio * 100}%` }} />
        <div className="video-player-timeline__progress" style={{ width: `${progressRatio * 100}%` }}>
          <span className="video-player-timeline__thumb" />
        </div>
      </div>
      {shownTime !== null && shownRatio !== null ? (
        <div className="video-player-timeline__tooltip" style={{ left: `${shownRatio * 100}%` }}>
          {formatDuration(shownTime)} / {formatDuration(safeDuration)}
        </div>
      ) : null}
    </div>
  );
});
