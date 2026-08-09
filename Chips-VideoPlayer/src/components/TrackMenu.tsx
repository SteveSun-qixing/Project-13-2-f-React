import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { CheckOutlined } from "@ant-design/icons";
import "./TrackMenu.css";

export interface TrackMenuOption {
  key: string;
  label: string;
  hint?: string;
  selected: boolean;
}

export interface TrackMenuProps {
  title: string;
  options: TrackMenuOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

export function TrackMenu(props: TrackMenuProps): ReactElement {
  const { title, options, onSelect, onClose } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className="video-player-track-menu" role="menu" aria-label={title}>
      <div className="video-player-track-menu__title">{title}</div>
      <ul className="video-player-track-menu__list">
        {options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={option.selected}
              className={`video-player-track-menu__item${option.selected ? " video-player-track-menu__item--selected" : ""}`}
              onClick={() => {
                onSelect(option.key);
                onClose();
              }}
            >
              <span className="video-player-track-menu__item-label">{option.label}</span>
              {option.hint ? <span className="video-player-track-menu__item-hint">{option.hint}</span> : null}
              <span className="video-player-track-menu__item-check" aria-hidden="true">
                {option.selected ? <CheckOutlined /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
