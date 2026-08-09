import type { ReactElement, ReactNode } from "react";
import "./Osd.css";

export interface OsdData {
  key: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  progress?: number;
}

export interface OsdProps {
  osd: OsdData | null;
  onDismiss?: () => void;
}

const OSD_ENTER_ANIMATION = "video-player-osd-enter";

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function Osd(props: OsdProps): ReactElement | null {
  const { osd, onDismiss } = props;

  if (!osd) {
    return null;
  }

  const progress = typeof osd.progress === "number" ? clampProgress(osd.progress) : null;

  return (
    <div className="video-player-osd" role="status" aria-live="polite">
      <div
        key={osd.key}
        className="video-player-osd__card"
        onAnimationEnd={(event) => {
          if (event.animationName === OSD_ENTER_ANIMATION && event.target === event.currentTarget) {
            onDismiss?.();
          }
        }}
      >
        {osd.icon ? (
          <div className="video-player-osd__icon" aria-hidden="true">
            {osd.icon}
          </div>
        ) : null}
        <div className="video-player-osd__title">{osd.title}</div>
        {osd.subtitle ? <div className="video-player-osd__subtitle">{osd.subtitle}</div> : null}
        {progress !== null ? (
          <div className="video-player-osd__progress" aria-hidden="true">
            <span className="video-player-osd__progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
