import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import type { Client, CommandSource } from "chips-sdk";
import { createPdfDocument, createSlideDocument, createWordDocument, pickOfficeDocument } from "../bridge/new-document";
import { OFFICE_SCENE_IDS } from "../app/scene-registry";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { chipsClient } from "../runtime/chips-client";
import {
  createOfficeCommandStatus,
  createOfficeCommands,
  getOfficeCommandHandlerId,
  isOfficeCommandInvokedEvent,
  OFFICE_COMMAND_IDS,
  officeCommandDefinitions,
  type OfficeCommandHandlerId,
  type OfficeCommandStatus,
} from "./office-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UseOfficeCommandsResult {
  client: Client;
  phase: CommandRegistryPhase;
  errorCode: string | null;
  lastInvoked: OfficeCommandStatus | null;
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

export function useOfficeCommands(): UseOfficeCommandsResult {
  const runtime = useAppRuntime();
  const client = runtime.client ?? chipsClient;
  const { register } = useCommandRegistry();
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<OfficeCommandStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");
    setErrorCode(null);

    Promise.all(
      officeCommandDefinitions.map((definition) => client.command.register(definition)),
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
        if (!isOfficeCommandInvokedEvent(event)) {
          return;
        }
        const handlerId = getOfficeCommandHandlerId(event);
        if (!handlerId) {
          return;
        }
        setLastInvoked(createOfficeCommandStatus(event, handlerId));
      });
    } catch (error) {
      setPhase("error");
      setErrorCode(toErrorCode(error));
    }

    return () => {
      cancelled = true;
      offInvoked();
      void Promise.all(
        officeCommandDefinitions.map((definition) => client.command.unregister(definition.commandId)),
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

  const openDocument = useCallback(async (): Promise<void> => {
    if (!runtime.client) {
      return;
    }
    try {
      const paths = await pickOfficeDocument(runtime.client);
      if (paths && paths.length > 0) {
        await runtime.openDocumentPath(paths[0]);
      }
    } catch (error) {
      setErrorCode(toErrorCode(error));
    }
  }, [runtime]);

  const createNew = useCallback(
    async (
      create: (client: Client) => Promise<{ sceneId: string; opened: { path: string } }>,
    ): Promise<void> => {
      if (!runtime.client) {
        return;
      }
      try {
        const created = await create(runtime.client);
        await runtime.openDocumentPath(created.opened.path);
      } catch (error) {
        setErrorCode(toErrorCode(error));
      }
    },
    [runtime],
  );

  const commands = useMemo<CommandItem[]>(
    () =>
      createOfficeCommands({
        openDocument: () => void invokeCommand(OFFICE_COMMAND_IDS.openDocument, "menu"),
        newWord: () => void invokeCommand(OFFICE_COMMAND_IDS.newWord, "menu"),
        newSheet: () => void invokeCommand(OFFICE_COMMAND_IDS.newSheet, "menu"),
        newSlide: () => void invokeCommand(OFFICE_COMMAND_IDS.newSlide, "menu"),
        newPdf: () => void invokeCommand(OFFICE_COMMAND_IDS.newPdf, "menu"),
      }),
    [invokeCommand],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  // 命令派发动作经 ref 取最新闭包，避免把高频变化的对象放进 lastInvoked 效应依赖。
  const commandActionsRef = useRef({
    openDocument,
    createNew,
    setStartScene: () => runtime.setActiveSceneId(OFFICE_SCENE_IDS.sheet),
  });
  commandActionsRef.current = { openDocument, createNew, setStartScene: () => runtime.setActiveSceneId(OFFICE_SCENE_IDS.sheet) };

  useEffect(() => {
    const status = lastInvoked;
    if (!status) {
      return;
    }
    const actions = commandActionsRef.current;
    if (status.handlerId === "open-document") {
      void actions.openDocument();
    } else if (status.handlerId === "new-word") {
      void actions.createNew((client) => createWordDocument(client));
    } else if (status.handlerId === "new-sheet") {
      actions.setStartScene();
    } else if (status.handlerId === "new-slide") {
      void actions.createNew((client) => createSlideDocument(client));
    } else if (status.handlerId === "new-pdf") {
      void actions.createNew((client) => createPdfDocument(client));
    }
  }, [lastInvoked]);

  return {
    client,
    phase,
    errorCode,
    lastInvoked,
    commands,
    invokeCommand,
  };
}
