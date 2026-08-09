import { useEffect } from "react";
import type { ReactElement } from "react";
import { Button } from "antd";
import { RotateRightOutlined } from "@ant-design/icons";
import "./EndedOverlay.css";

export interface EndedOverlayProps {
  title?: string;
  onReplay: () => void;
  onClose?: () => void;
  replayLabel?: string;
  closeHint?: string;
  hasNext?: boolean;
  nextLabel?: string;
  onNext?: () => void;
}

const DEFAULT_TITLE = "播放结束";
const DEFAULT_REPLAY_LABEL = "重新播放";
const DEFAULT_CLOSE_HINT = "点击空白处关闭";

export function EndedOverlay(props: EndedOverlayProps): ReactElement {
  const { title, onReplay, onClose, replayLabel, closeHint, hasNext, nextLabel, onNext } = props;
  const heading = title ?? DEFAULT_TITLE;

  useEffect(() => {
    if (!onClose) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="video-player-ended"
      role="dialog"
      aria-label={heading}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="video-player-ended__card">
        <div className="video-player-ended__icon" aria-hidden="true">
          <RotateRightOutlined />
        </div>
        <div className="video-player-ended__title">{heading}</div>
        <div className="video-player-ended__actions">
          <Button
            type="primary"
            size="large"
            className="video-player-ended__replay"
            autoFocus
            onClick={onReplay}
          >
            {replayLabel ?? DEFAULT_REPLAY_LABEL}
          </Button>
          {hasNext && onNext ? (
            <Button size="large" className="video-player-ended__next" onClick={onNext}>
              {nextLabel ?? "播放下一个"}
            </Button>
          ) : null}
        </div>
        {onClose ? <div className="video-player-ended__close-hint">{closeHint ?? DEFAULT_CLOSE_HINT}</div> : null}
      </div>
    </div>
  );
}
