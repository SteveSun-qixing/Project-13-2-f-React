import React from "react";
import { AppChrome } from "@chips/ui";
import { RichTextEditorScene } from "./RichTextEditorScene";

export function AppShell(): React.ReactElement {
  return (
    <AppChrome paletteShortcut="Mod+Shift+P">
      <RichTextEditorScene />
    </AppChrome>
  );
}
