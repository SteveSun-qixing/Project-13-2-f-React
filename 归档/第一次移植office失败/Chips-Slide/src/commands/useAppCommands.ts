import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import type { Client, CommandSource } from "chips-sdk";
import { chipsClient } from "../runtime/chips-client";
import { appCommandDefinitions, createAppCommands, type AppCommandHandlers } from "./app-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UseAppCommandsOptions {
  client?: Client;
  handlers: AppCommandHandlers;
}

export interface UseAppCommandsResult {
  client: Client;
  phase: CommandRegistryPhase;
  commands: CommandItem[];
  invokeCommand(commandId: string, source: CommandSource): Promise<void>;
}

function toErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  return "COMMAND_RUNTIME_ERROR";
}

export function useAppCommands(options: UseAppCommandsOptions): UseAppCommandsResult {
  const client = options.client ?? chipsClient;
  const handlers = options.handlers;
  const { register } = useCommandRegistry();
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");

    Promise.all(
      appCommandDefinitions.map((definition) => client.command.register(definition)),
    )
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
      void Promise.all(
        appCommandDefinitions.map((definition) =>
          client.command.unregister(definition.commandId),
        ),
      ).catch(() => {});
    };
  }, [client]);

  const commands = useMemo<CommandItem[]>(() => createAppCommands(handlers), [handlers]);

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  const invokeCommand = useCallback(async (commandId: string, source: CommandSource) => {
    await client.command.invoke(commandId, {}, { source });
  }, [client]);

  return { client, phase, commands, invokeCommand };
}
