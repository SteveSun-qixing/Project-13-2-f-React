import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommandPalette } from "./CommandPalette";
import { MenuBar, Toolbar, type ChromeTone, type MenuBarGroup } from "./MenuBar";
import { useCommandRegistry, useCommandShortcuts } from "../runtime/commands";

export interface AppChromeImmersiveProps {
  immersive?: boolean;
  immersiveContentClass?: string;
}

export interface AppChromeProps extends AppChromeImmersiveProps {
  appName?: string;
  menus?: MenuBarGroup[];
  toolbarItems?: AppChromeToolbarItem[];
  toolbarExtra?: ReactNode;
  paletteShortcut?: string;
  tone?: ChromeTone;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: React.CSSProperties;
}

export interface AppChromeToolbarItem {
  id: string;
  title: string;
  shortcut?: string;
  icon?: ReactNode;
  enabled?: boolean;
  visible?: boolean;
  run: () => void;
}

const IMMERSIVE_HOT_ZONE_HEIGHT = 16;
const IMMERSIVE_HIDE_DELAY_MS = 2500;
const IMMERSIVE_TRANSITION = "transform 0.25s ease";
const IMMERSIVE_FLOAT_SHADOW = "0 1px 0 rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)";

export function AppChrome({
  appName,
  menus = [],
  toolbarItems = [],
  toolbarExtra,
  paletteShortcut = "Mod+P",
  tone = "light",
  immersive = false,
  immersiveContentClass,
  children,
  footer,
  contentStyle,
}: AppChromeProps): React.ReactElement {
  const { commands } = useCommandRegistry();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(immersive);
  const chromeHiddenRef = useRef(chromeHidden);
  const hideTimerRef = useRef<number | null>(null);
  const hoveringTopRef = useRef(false);

  const setHidden = useCallback((hidden: boolean) => {
    if (chromeHiddenRef.current === hidden) {
      return;
    }
    chromeHiddenRef.current = hidden;
    setChromeHidden(hidden);
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setHidden(true);
    }, IMMERSIVE_HIDE_DELAY_MS);
  }, [clearHideTimer, setHidden]);

  useEffect(() => {
    if (!immersive) {
      setHidden(false);
      return;
    }

    setHidden(true);

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY <= IMMERSIVE_HOT_ZONE_HEIGHT || hoveringTopRef.current) {
        clearHideTimer();
        setHidden(false);
        return;
      }
      setHidden(false);
      scheduleHide();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (chromeHiddenRef.current) {
        setHidden(false);
        scheduleHide();
      } else {
        clearHideTimer();
        setHidden(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      clearHideTimer();
    };
  }, [clearHideTimer, immersive, scheduleHide, setHidden]);

  const paletteCommand = useMemo(
    () => ({
      id: "app.command-palette",
      title: "命令面板",
      shortcut: paletteShortcut,
      run: () => setPaletteOpen(true),
    }),
    [paletteShortcut],
  );

  const allCommands = useMemo(() => [paletteCommand, ...commands], [commands, paletteCommand]);
  useCommandShortcuts(allCommands);

  const topChrome = (
    <>
      {(menus.length > 0 || appName) && <MenuBar appName={appName} groups={menus} tone={tone} />}
      {toolbarItems.length > 0 && (
        <Toolbar
          tone={tone}
          items={toolbarItems.map((item) => ({
            id: item.id,
            title: item.title,
            shortcut: item.shortcut,
            icon: item.icon,
            enabled: item.enabled,
            visible: item.visible,
            run: item.run,
          }))}
        >
          {toolbarExtra}
        </Toolbar>
      )}
    </>
  );

  const hasTopChrome = menus.length > 0 || Boolean(appName) || toolbarItems.length > 0;

  return (
    <div
      className="chips-app-chrome"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        ...(immersive ? { position: "relative" } : {}),
      }}
    >
      {immersive && hasTopChrome ? (
        <div
          className="chips-app-chrome__top"
          onMouseEnter={() => {
            hoveringTopRef.current = true;
          }}
          onMouseLeave={() => {
            hoveringTopRef.current = false;
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            transform: chromeHidden ? "translateY(-100%)" : "translateY(0)",
            transition: IMMERSIVE_TRANSITION,
            boxShadow: chromeHidden ? "none" : IMMERSIVE_FLOAT_SHADOW,
          }}
        >
          {topChrome}
        </div>
      ) : (
        topChrome
      )}
      <div
        className={
          immersive
            ? ["chips-app-chrome__content", immersiveContentClass].filter(Boolean).join(" ")
            : "chips-app-chrome__content"
        }
        style={{ flex: 1, overflow: "auto", ...contentStyle }}
      >
        {children}
      </div>
      {footer}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        placeholder="输入命令名称…"
        emptyText="没有匹配的命令"
      />
    </div>
  );
}
