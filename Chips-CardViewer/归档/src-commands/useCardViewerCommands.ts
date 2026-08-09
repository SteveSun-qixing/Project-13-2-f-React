import { useCallback, useEffect, useMemo, useState } from "react";
import { createCommandAdapter, type ChipsCommandAdapter } from "@chips/component-library";
import type { Client, CommandInvocationContext, CommandSource } from "chips-sdk";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import {
  cardViewerCommandDefinitions,
  createCardViewerCommandStatus,
  getCardViewerCommandHandlerId,
  isCardViewerCommandInvokedEvent,
  type CardViewerCommandId,
  type CardViewerCommandStatus,
} from "./card-viewer-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UseCardViewerCommandsOptions {
  client?: Client;
}

export interface UseCardViewerCommandsResult {
  adapter: ChipsCommandAdapter;
  phase: CommandRegistryPhase;
  errorCode: string | null;
  lastInvoked: CardViewerCommandStatus | null;
  invocationContext: CommandInvocationContext;
  invokeCommand(commandId: CardViewerCommandId, source: CommandSource): Promise<void>;
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

export function useCardViewerCommands(
  options: UseCardViewerCommandsOptions = {},
): UseCardViewerCommandsResult {
  const runtime = useAppRuntime();
  const client = options.client ?? runtime.client;
  const adapter = useMemo(() => createCommandAdapter(client), [client]);
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<CardViewerCommandStatus | null>(null);

  const invocationContext = useMemo<CommandInvocationContext>(() => {
    const context: CommandInvocationContext = {
      pluginId: runtime.environment.pluginId,
      sceneId: runtime.environment.hostSceneId,
    };
    if (runtime.environment.surfaceId) {
      context.surfaceId = runtime.environment.surfaceId;
    }
    return context;
  }, [
    runtime.environment.hostSceneId,
    runtime.environment.pluginId,
    runtime.environment.surfaceId,
  ]);

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");
    setErrorCode(null);

    Promise.all(cardViewerCommandDefinitions.map((definition) => client.command.register(definition)))
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
        if (!isCardViewerCommandInvokedEvent(event)) {
          return;
        }
        const handlerId = getCardViewerCommandHandlerId(event);
        if (!handlerId) {
          return;
        }
        setLastInvoked(createCardViewerCommandStatus(event, handlerId));
      });
    } catch (error) {
      if (!cancelled) {
        setPhase("error");
        setErrorCode(toErrorCode(error));
      }
    }

    return () => {
      cancelled = true;
      offInvoked();
      void Promise.all(
        cardViewerCommandDefinitions.map((definition) => client.command.unregister(definition.commandId)),
      ).catch(() => {});
    };
  }, [client]);

  const invokeCommand = useCallback(
    async (commandId: CardViewerCommandId, source: CommandSource): Promise<void> => {
      setErrorCode(null);
      try {
        await client.command.invoke(commandId, {}, { source, context: invocationContext });
      } catch (error) {
        setErrorCode(toErrorCode(error));
        setPhase("error");
      }
    },
    [client, invocationContext],
  );

  return {
    adapter,
    phase,
    errorCode,
    lastInvoked,
    invocationContext,
    invokeCommand,
  };
}
