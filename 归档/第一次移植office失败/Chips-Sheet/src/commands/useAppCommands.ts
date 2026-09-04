import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import type { Client, CommandSource } from "chips-sdk";
import { chipsClient } from "../runtime/chips-client";
import {
  APP_COMMAND_IDS,
  appCommandDefinitions,
  createAppCommandStatus,
  createAppCommands,
  getAppCommandHandlerId,
  isAppCommandInvokedEvent,
  type AppCommandStatus,
} from "./app-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UseAppCommandsOptions {
  client?: Client;
  handlers?: AppCommandRunHandlers;
}

export interface AppCommandRunHandlers {
  fileOpen: () => void;
  fileSave: () => void;
  fileSaveAs: () => void;
  fileNew: () => void;
  fileExportCsv: () => void;
}

export interface UseAppCommandsResult {
  client: Client;
  phase: CommandRegistryPhase;
  errorCode: string | null;
  lastInvoked: AppCommandStatus | null;
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

export function useAppCommands(options: UseAppCommandsOptions = {}): UseAppCommandsResult {
  const client = options.client ?? chipsClient;
  const runHandlers = options.handlers;
  const { register } = useCommandRegistry();
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<AppCommandStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");
    setErrorCode(null);

    Promise.all(
      appCommandDefinitions.map((definition) => client.command.register(definition)),
    )
      .then(() => {
        if (!cancelled) {
          setPhase("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPhase("error");
          setErrorCode(toErrorCode(error));
        }
      });

    let offInvoked = () => {};
    try {
      offInvoked = client.command.onInvoked((event) => {
        if (!isAppCommandInvokedEvent(event)) {
          return;
        }
        const handlerId = getAppCommandHandlerId(event);
        if (!handlerId) {
          return;
        }
        setLastInvoked(createAppCommandStatus(event, handlerId));
      });
    } catch (error) {
      setPhase("error");
      setErrorCode(toErrorCode(error));
    }

    return () => {
      cancelled = true;
      offInvoked();
      void Promise.all(
        appCommandDefinitions.map((definition) => client.command.unregister(definition.commandId)),
      ).catch(() => {});
    };
  }, [client]);

  const invokeCommand = useCallback(
    async (commandId: string, source: CommandSource): Promise<void> => {
      setErrorCode(null);
      try {
        await client.command.invoke(commandId, {}, { source });
      } catch (error) {
        setErrorCode(toErrorCode(error));
        setPhase("error");
      }
    },
    [client],
  );

  const commands = useMemo<CommandItem[]>(
    () =>
      createAppCommands({
        fileOpen: () => {
          if (runHandlers?.fileOpen) {
            runHandlers.fileOpen();
            return;
          }
          void invokeCommand(APP_COMMAND_IDS.fileOpen, "menu");
        },
        fileSave: () => {
          if (runHandlers?.fileSave) {
            runHandlers.fileSave();
            return;
          }
          void invokeCommand(APP_COMMAND_IDS.fileSave, "menu");
        },
        fileSaveAs: () => {
          if (runHandlers?.fileSaveAs) {
            runHandlers.fileSaveAs();
            return;
          }
          void invokeCommand(APP_COMMAND_IDS.fileSaveAs, "menu");
        },
        fileNew: () => {
          if (runHandlers?.fileNew) {
            runHandlers.fileNew();
            return;
          }
          void invokeCommand(APP_COMMAND_IDS.fileNew, "menu");
        },
        fileExportCsv: () => {
          if (runHandlers?.fileExportCsv) {
            runHandlers.fileExportCsv();
            return;
          }
          void invokeCommand(APP_COMMAND_IDS.fileExportCsv, "menu");
        },
      }),
    [invokeCommand, runHandlers],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return {
    client,
    phase,
    errorCode,
    lastInvoked,
    commands,
    invokeCommand,
  };
}
