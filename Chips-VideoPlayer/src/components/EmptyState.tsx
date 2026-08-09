import type { ReactElement } from "react";
import { Button } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import "./EmptyState.css";

export interface EmptyStateProps {
  onOpen: () => void;
  dragActive?: boolean;
  hintText?: string;
  titleText?: string;
  openLabel?: string;
  dragPrompt?: string;
}

const DEFAULT_TITLE_TEXT = "将视频拖到这里，或点击选择文件";
const DEFAULT_HINT_TEXT = "MP4 · WebM · MOV · M4V";
const DEFAULT_OPEN_LABEL = "选择视频…";
const DEFAULT_DRAG_PROMPT = "松开以打开";

export function EmptyState(props: EmptyStateProps): ReactElement {
  const { onOpen, dragActive = false, hintText, titleText, openLabel, dragPrompt } = props;

  return (
    <div className="video-player-empty" aria-hidden={dragActive}>
      <div
        className={`video-player-empty__icon-wrap${dragActive ? " video-player-empty__icon-wrap--drag-active" : ""}`}
        aria-hidden="true"
      >
        <VideoCameraOutlined className="video-player-empty__icon" />
      </div>
      <div className="video-player-empty__body">
        <div className="video-player-empty__title">
          {dragActive ? dragPrompt ?? DEFAULT_DRAG_PROMPT : titleText ?? DEFAULT_TITLE_TEXT}
        </div>
        <div className="video-player-empty__hint">{hintText ?? DEFAULT_HINT_TEXT}</div>
      </div>
      <Button type="primary" size="large" className="video-player-empty__open" onClick={onOpen}>
        {openLabel ?? DEFAULT_OPEN_LABEL}
      </Button>
    </div>
  );
}
