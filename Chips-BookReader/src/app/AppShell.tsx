import React, { useMemo } from "react";
import { AppChrome, useCommandRegistry, type MenuBarGroup } from "@chips/ui";
import { useAppRuntime } from "./AppRuntimeProvider";

const BOOK_READER_MENU_GROUPS: Array<{ menuId: string; label: string }> = [
  { menuId: "file", label: "文件" },
  { menuId: "edit", label: "编辑" },
  { menuId: "view", label: "视图" },
  { menuId: "navigate", label: "导航" },
  { menuId: "bookmarks", label: "书签" },
];

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const { commands } = useCommandRegistry();

  const menus = useMemo<MenuBarGroup[]>(() => {
    return BOOK_READER_MENU_GROUPS.flatMap(({ menuId, label }) => {
      const items = commands.filter(
        (command) => command.visible !== false && command.menuId === menuId,
      );
      return items.length > 0 ? [{ menuId, label, commands: items }] : [];
    });
  }, [commands]);

  const toolbarItems = useMemo(
    () => commands.filter((command) => command.visible !== false && command.toolbarId === "reader"),
    [commands],
  );

  return (
    <div
      data-chips-app={runtime.environment.appId}
      data-chips-scene={runtime.activeSceneId}
      data-chips-surface-kind={runtime.environment.surfaceKind}
    >
      <AppChrome
        appName="书籍阅读器"
        menus={menus}
        toolbarItems={toolbarItems}
        paletteShortcut="Mod+P"
        contentStyle={{ position: "relative", overflow: "hidden" }}
      >
        {runtime.renderReaderShell()}
      </AppChrome>
    </div>
  );
}
