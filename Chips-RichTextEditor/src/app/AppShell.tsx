import React from "react";
import { AppChrome, type MenuBarGroup } from "@chips/ui";
import { useCommandRegistry } from "@chips/ui";
import { RichTextEditorScene } from "./RichTextEditorScene";

export function AppShell(): React.ReactElement {
  const { commands } = useCommandRegistry();

  const menus: MenuBarGroup[] = [
    { menuId: "file", label: "文件", commands },
    { menuId: "view", label: "查看", commands },
    { menuId: "edit", label: "编辑", commands },
    { menuId: "format", label: "格式", commands },
  ];

  const toolbarItems = commands.filter((command) => command.toolbarId === "document");

  return (
    <AppChrome
      appName="富文本编辑器"
      menus={menus}
      toolbarItems={toolbarItems}
      paletteShortcut="Mod+Shift+P"
    >
      <RichTextEditorScene />
    </AppChrome>
  );
}
