import { useEffect, useMemo, useState } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import type { Client } from "chips-sdk";
import { chipsClient } from "../runtime/chips-client";
import {
  appCommandDefinitions,
  createAppCommandStatus,
  createAppCommands,
  getAppCommandHandlerId,
  isAppCommandInvokedEvent,
  type AppCommandHandlers,
  type AppCommandStatus,
} from "./app-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UseAppCommandsOptions {
  client?: Client;
  handlers?: AppCommandHandlers;
}

export interface UseAppCommandsResult {
  client: Client;
  phase: CommandRegistryPhase;
  errorCode: string | null;
  lastInvoked: AppCommandStatus | null;
  commands: CommandItem[];
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
  const handlers = options.handlers;
  const { register } = useCommandRegistry();
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<AppCommandStatus | null>(null);
  const [invokedCounter, setInvokedCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");
    setErrorCode(null);

    Promise.all(appCommandDefinitions.map((definition) => client.command.register(definition)))
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
        setInvokedCounter((count) => count + 1);
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

  const commands = useMemo<CommandItem[]>(() => {
    const safeHandlers: AppCommandHandlers = handlers ?? {
      fileNew: () => {},
      fileOpen: () => {},
      fileSave: () => {},
      fileSaveAs: () => {},
      filePrint: () => {},
      viewZoomIn: () => {},
      viewZoomOut: () => {},
      viewZoomReset: () => {},
    };
    return createAppCommands(safeHandlers);
  }, [handlers, invokedCounter]);

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return {
    client,
    phase,
    errorCode,
    lastInvoked,
    commands,
  };
}
