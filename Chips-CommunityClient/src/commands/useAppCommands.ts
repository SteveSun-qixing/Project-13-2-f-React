import { useEffect, useMemo, useRef } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import { createAppCommands, type AppCommandHandlers } from "./app-commands";

export function useAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  const { register } = useCommandRegistry();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const commands = useMemo<CommandItem[]>(() => {
    return createAppCommands({
      openWorkspace: () => handlersRef.current.openWorkspace(),
      openSettings: () => handlersRef.current.openSettings(),
    });
  }, []);

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}
