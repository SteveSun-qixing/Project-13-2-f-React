import { useMemo, useState, type ReactNode } from "react";
import { CommandPalette } from "./CommandPalette";
import { useCommandRegistry, useCommandShortcuts } from "../runtime/commands";

export interface AppChromeImmersiveProps {
  immersive?: boolean;
  immersiveContentClass?: string;
}

export interface AppChromeProps extends AppChromeImmersiveProps {
  paletteShortcut?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: React.CSSProperties;
}

export function AppChrome({
  paletteShortcut = "Mod+P",
  immersive = false,
  immersiveContentClass,
  children,
  footer,
  contentStyle,
}: AppChromeProps): React.ReactElement {
  const { commands } = useCommandRegistry();
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  return (
    <div className="chips-app-chrome" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
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
