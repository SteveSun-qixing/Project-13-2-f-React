import React from "react";
import { UploadOutlined } from "@ant-design/icons";

interface WindowDropOverlayProps {
  active: boolean;
  title: string;
  description: string;
}

export function WindowDropOverlay({ active, title, description }: WindowDropOverlayProps): React.ReactElement | null {
  if (!active) {
    return null;
  }

  return (
    <div className="settings-window-drop-overlay" role="status" aria-live="polite">
      <div className="settings-window-drop-overlay__panel">
        <span className="settings-window-drop-overlay__icon" aria-hidden="true">
          <UploadOutlined />
        </span>
        <span className="settings-window-drop-overlay__copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
      </div>
    </div>
  );
}
