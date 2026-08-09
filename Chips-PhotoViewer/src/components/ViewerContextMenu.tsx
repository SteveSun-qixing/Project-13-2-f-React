import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

export interface ViewerContextMenuItem {
  key: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

export interface ViewerContextMenuProps {
  items?: ViewerContextMenuItem[];
  children: ReactNode;
}

interface ViewerContextMenuPosition {
  x: number;
  y: number;
}

const MENU_ESTIMATED_WIDTH = 220;
const MENU_ITEM_HEIGHT = 30;
const MENU_SEPARATOR_HEIGHT = 10;
const MENU_VERTICAL_PADDING = 8;
const MENU_EDGE_GAP = 12;

export function ViewerContextMenu(props: ViewerContextMenuProps): React.ReactElement {
  const { items = [], children } = props;
  const [position, setPosition] = useState<ViewerContextMenuPosition | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((): void => {
    setPosition(null);
  }, []);

  useEffect(() => {
    if (!position) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (popupRef.current && target instanceof Node && !popupRef.current.contains(target)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [close, position]);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      event.preventDefault();
      if (items.length === 0) {
        return;
      }

      const itemCount = items.filter((item) => !item.separator).length;
      const separatorCount = items.length - itemCount;
      const menuHeight =
        itemCount * MENU_ITEM_HEIGHT + separatorCount * MENU_SEPARATOR_HEIGHT + MENU_VERTICAL_PADDING;

      setPosition({
        x: Math.min(event.clientX, Math.max(window.innerWidth - MENU_ESTIMATED_WIDTH - MENU_EDGE_GAP, MENU_EDGE_GAP)),
        y: Math.min(event.clientY, Math.max(window.innerHeight - menuHeight - MENU_EDGE_GAP, MENU_EDGE_GAP)),
      });
    },
    [items],
  );

  return (
    <div className="photo-viewer-context-menu" onContextMenu={handleContextMenu}>
      {children}
      {position ? (
        <div
          ref={popupRef}
          className="photo-viewer-context-menu__popup"
          role="menu"
          style={{ left: position.x, top: position.y }}
        >
          {items.map((item) =>
            item.separator ? (
              <div key={item.key} className="photo-viewer-context-menu__separator" role="separator" />
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className="photo-viewer-context-menu__item"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                <span className="photo-viewer-context-menu__label">{item.label}</span>
                {item.shortcut ? <kbd className="photo-viewer-context-menu__shortcut">{item.shortcut}</kbd> : null}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
