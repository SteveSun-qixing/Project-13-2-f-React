import { useEffect, useMemo } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import {
  createUniversalViewerCommands,
  type UniversalViewerCommandContext,
} from "./universal-viewer-commands";

const SEARCH_INPUT_SELECTOR = "[data-universal-viewer-search-input]";

export function useUniversalViewerCommands(): CommandItem[] {
  const runtime = useAppRuntime();
  const { register } = useCommandRegistry();

  const context = useMemo<UniversalViewerCommandContext>(() => ({
    hasFile: runtime.loadedFiles.length > 0,
    openFile: runtime.openFile,
    saveCopy: runtime.saveCopy,
    reload: runtime.reloadCurrent,
    runToolbarAction: (action) => {
      const toolbar = runtime.toolbarContext;
      if (!toolbar) {
        return;
      }
      if (action === "fullscreen" || action === "print") {
        if (action === "fullscreen") {
          toolbar.fullscreen();
        } else {
          toolbar.print();
        }
        return;
      }
      if (action === "search") {
        const input = document.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);
        input?.focus();
        return;
      }
      toolbar.command(action);
    },
    previousFile: () => void runtime.toolbarContext?.previous(),
    nextFile: () => void runtime.toolbarContext?.next(),
  }), [runtime]);

  const commands = useMemo(
    () => createUniversalViewerCommands(context),
    [context],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}
