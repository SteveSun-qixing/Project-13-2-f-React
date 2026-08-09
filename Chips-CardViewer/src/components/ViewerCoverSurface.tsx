import React from "react";
import { motion } from "framer-motion";
import { EmbeddedDocumentFrame } from "@chips/ui";
import type { Client } from "chips-sdk";
import type { ViewerCoverSource } from "../types/viewer-source";
import "./ViewerCoverSurface.css";

interface ViewerCoverSurfaceProps {
  client?: Pick<Client, "events">;
  cover: ViewerCoverSource;
  title: string;
  closeLabel: string;
  unavailableLabel: string;
  onClose: () => void;
}

const COVER_SURFACE_MIN_HEIGHT = 320;
const COVER_SURFACE_SAFE_BLOCK_END_FALLBACK = 72;
const COVER_SURFACE_STABLE_DELAY_MS = 160;

const COVER_SURFACE_ENTER_ANIMATION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" },
} as const;

type CoverSurfaceResizeReason = "content-resize" | "viewport-resize";

export function resolveCoverAspectRatioStyle(ratio: string): React.CSSProperties | undefined {
  const match = ratio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) {
    return undefined;
  }

  const ratioWidth = Number(match[1]);
  const ratioHeight = Number(match[2]);
  if (!Number.isFinite(ratioWidth) || !Number.isFinite(ratioHeight) || ratioWidth <= 0 || ratioHeight <= 0) {
    return undefined;
  }

  const ratioScale = Number(Math.sqrt(ratioWidth / ratioHeight).toFixed(4));
  return {
    "--viewer-cover-ratio-width": String(ratioWidth),
    "--viewer-cover-ratio-height": String(ratioHeight),
    "--viewer-cover-ratio-scale": String(ratioScale),
    "--viewer-cover-aspect-ratio": `${ratioWidth} / ${ratioHeight}`,
  } as React.CSSProperties;
}

function getViewportHeight(): number {
  if (typeof window === "undefined" || !Number.isFinite(window.innerHeight)) {
    return COVER_SURFACE_MIN_HEIGHT;
  }
  return Math.max(COVER_SURFACE_MIN_HEIGHT, Math.ceil(window.innerHeight));
}

function readDocumentCssPixels(name: string, fallback: number): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.ceil(parsed) : fallback;
}

export function ViewerCoverSurface({
  client,
  cover,
  title,
  closeLabel,
  unavailableLabel,
  onClose,
}: ViewerCoverSurfaceProps): React.ReactElement {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const stableTimerRef = React.useRef<number | null>(null);
  const ratio = cover.ratio ?? "4:3";
  const aspectRatioStyle = resolveCoverAspectRatioStyle(ratio);

  const publishResize = React.useCallback(
    (reason: CoverSurfaceResizeReason, stable: boolean) => {
      if (!client) {
        return;
      }

      const root = rootRef.current;
      const measuredHeight = root
        ? Math.max(
            root.scrollHeight,
            root.offsetHeight,
            Math.ceil(root.getBoundingClientRect().height),
          )
        : 0;
      const contentHeight = Math.max(COVER_SURFACE_MIN_HEIGHT, measuredHeight, getViewportHeight());
      const safeBlockEnd = readDocumentCssPixels(
        "--chips-document-safe-area-block-end",
        COVER_SURFACE_SAFE_BLOCK_END_FALLBACK,
      );

      void client.events.emit("plugin.surface.resize", {
        height: contentHeight,
        contentHeight,
        safeBlockEnd,
        viewportHeight: getViewportHeight(),
        reason,
        stable,
      }).catch(() => undefined);
    },
    [client],
  );

  React.useLayoutEffect(() => {
    if (!client) {
      return undefined;
    }

    const publishStablePair = (reason: CoverSurfaceResizeReason) => {
      publishResize(reason, false);
      if (stableTimerRef.current !== null) {
        window.clearTimeout(stableTimerRef.current);
      }
      stableTimerRef.current = window.setTimeout(() => {
        stableTimerRef.current = null;
        publishResize(reason, true);
      }, COVER_SURFACE_STABLE_DELAY_MS);
    };

    publishStablePair("content-resize");

    const handleResize = () => {
      publishStablePair("viewport-resize");
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (stableTimerRef.current !== null) {
        window.clearTimeout(stableTimerRef.current);
        stableTimerRef.current = null;
      }
    };
  }, [client, cover.coverUrl, publishResize, ratio, title]);

  if (!cover.coverUrl) {
    return (
      <motion.section
        ref={rootRef}
        className="viewer-cover-surface viewer-cover-surface--state"
        aria-live="polite"
        {...COVER_SURFACE_ENTER_ANIMATION}
      >
        <div className="viewer-cover-surface__state-panel">
          <h2>{unavailableLabel}</h2>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      ref={rootRef}
      className="viewer-cover-surface"
      data-chips-app="card-viewer.cover"
      aria-label={title}
      {...COVER_SURFACE_ENTER_ANIMATION}
    >
      <div className="viewer-cover-surface__layout" style={aspectRatioStyle}>
        <div className="viewer-cover-surface__stage">
          <EmbeddedDocumentFrame
            surfaceId="viewer-cover"
            title={cover.title ?? title}
            src={cover.coverUrl}
            ratio={ratio}
            scope="viewer-cover-frame"
            onActivate={onClose}
            onFrameReady={() => undefined}
            onFrameError={() => undefined}
            sandbox="allow-scripts"
          />
          <button
            type="button"
            className="viewer-cover-surface__hit-target"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          />
        </div>
        <h2 className="viewer-cover-surface__title">{title}</h2>
      </div>
    </motion.section>
  );
}
