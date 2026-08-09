import { useEffect } from "react";
import type { ReactElement } from "react";
import "./KeyHelpDialog.css";

export interface KeyHelpItem {
  keys: string;
  label: string;
}

export interface KeyHelpGroup {
  title: string;
  items: KeyHelpItem[];
}

export interface KeyHelpDialogProps {
  open: boolean;
  onClose: () => void;
  groups: KeyHelpGroup[];
  title?: string;
  closeLabel?: string;
  closeButtonLabel?: string;
}

const DEFAULT_TITLE = "快捷键";
const DEFAULT_CLOSE_LABEL = "按 Esc 关闭";
const DEFAULT_CLOSE_BUTTON_LABEL = "关闭";

export function KeyHelpDialog(props: KeyHelpDialogProps): ReactElement | null {
  const { open, onClose, groups, title, closeLabel, closeButtonLabel } = props;

  useEffect(() => {
    if (!open) {
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const heading = title ?? DEFAULT_TITLE;

  return (
    <div
      className="video-player-key-help"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="video-player-key-help__dialog" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="video-player-key-help__header">
          <h2 className="video-player-key-help__title">{heading}</h2>
          <button
            type="button"
            className="video-player-key-help__close"
            aria-label={closeButtonLabel ?? DEFAULT_CLOSE_BUTTON_LABEL}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="video-player-key-help__groups">
          {groups.map((group) => (
            <section key={group.title} className="video-player-key-help__group">
              <h3 className="video-player-key-help__group-title">{group.title}</h3>
              <ul className="video-player-key-help__list">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.keys}`} className="video-player-key-help__item">
                    <kbd className="video-player-key-help__keys">{item.keys}</kbd>
                    <span className="video-player-key-help__label">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="video-player-key-help__footer">{closeLabel ?? DEFAULT_CLOSE_LABEL}</div>
      </div>
    </div>
  );
}
