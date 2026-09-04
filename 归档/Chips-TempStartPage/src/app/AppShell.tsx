import React from "react";
import { AppChrome } from "@chips/ui";
import { useAppCommands } from "../commands/useAppCommands";
import { StartPageStage } from "../components/StartPageStage";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  useAppCommands();

  return (
    <AppChrome paletteShortcut="Mod+P">
      <StartPageStage client={runtime.client} />
    </AppChrome>
  );
}
