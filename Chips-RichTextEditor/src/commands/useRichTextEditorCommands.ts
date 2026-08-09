import { useEffect, useMemo, useRef } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import {
  createRichTextEditorCommands,
  type RichTextEditorCommandHandlers,
  type RichTextEditorCommandState,
} from "./rich-text-editor-commands";

export function useRichTextEditorCommands(
  handlers: RichTextEditorCommandHandlers,
  runtimeState: RichTextEditorCommandState,
): CommandItem[] {
  const { register } = useCommandRegistry();
  const handlersRef = useRef<RichTextEditorCommandHandlers>(handlers);
  handlersRef.current = handlers;

  const commands = useMemo<CommandItem[]>(
    () =>
      createRichTextEditorCommands(
        {
          newDocument: () => void handlersRef.current.newDocument(),
          openFile: () => void handlersRef.current.openFile(),
          save: () => void handlersRef.current.save(),
          saveAs: () => void handlersRef.current.saveAs(),
          exportCard: () => void handlersRef.current.exportCard(),
          preview: () => void handlersRef.current.preview(),
          info: () => handlersRef.current.info(),
          undo: () => handlersRef.current.undo(),
          redo: () => handlersRef.current.redo(),
          find: () => handlersRef.current.find(),
          format: () => handlersRef.current.format(),
        },
        runtimeState,
      ),
    [runtimeState],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}
