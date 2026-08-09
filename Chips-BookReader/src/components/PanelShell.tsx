import React, { useId, useLayoutEffect, useRef } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { createFocusScope, restoreFocus } from "../utils/a11y";
import { ControlButton } from "./ControlButton";

export interface PanelShellProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "drawer" | "dialog";
  restoreFocusElement?: HTMLElement | null;
  focusOnMount?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function PanelShell(props: PanelShellProps): React.ReactElement {
  const {
    title,
    eyebrow,
    onClose,
    children,
    className,
    variant = "drawer",
    restoreFocusElement,
    focusOnMount = true,
    t,
  } = props;
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const focusScopeRef = useRef<ReturnType<typeof createFocusScope> | null>(null);

  useLayoutEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return undefined;
    }

    const restorePoint = restoreFocusElement
      ? {
          element: restoreFocusElement,
          restore: (options?: Parameters<typeof restoreFocus>[1]) => restoreFocus(restoreFocusElement, options),
        }
      : undefined;
    const scope = createFocusScope(panelElement, {
      restorePoint,
      fallback: panelElement,
      trap: true,
    });
    focusScopeRef.current = scope;

    if (focusOnMount && !panelElement.contains(panelElement.ownerDocument.activeElement)) {
      scope.focusFirst();
    }

    return () => {
      scope.restore();
      focusScopeRef.current = null;
    };
  }, [focusOnMount, restoreFocusElement]);

  return (
    <div className="book-reader-panelLayer" data-state="open" onClick={onClose}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          "book-reader-panel",
          variant === "drawer" ? "book-reader-panel--drawer" : "book-reader-panel--dialog",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }

          if (focusScopeRef.current?.handleKeyDown(event.nativeEvent)) {
            event.stopPropagation();
          }
        }}
      >
        <header className="book-reader-panel__header">
          <div className="book-reader-panel__copy">
            {eyebrow ? <p className="book-reader-panel__eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <ControlButton
            label={t("book-reader.actions.closePanel")}
            icon={<CloseOutlined />}
            onClick={onClose}
            variant="close"
          />
        </header>
        <div className="book-reader-panel__body">{children}</div>
      </section>
    </div>
  );
}
