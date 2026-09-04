import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import type { Client, CommandSource } from "chips-sdk";
import { chipsClient } from "../runtime/chips-client";
import { useViewerBridge } from "./viewer-bridge";
import { formatMessage } from "../lib/messages";
import {
  createPdfCommands,
  getPdfCommandId,
  isPdfCommandInvokedEvent,
  pdfCommandDefinitions,
} from "./app-commands";

type CommandRegistryPhase = "idle" | "registering" | "ready" | "error";

export interface UsePdfCommandsResult {
  client: Client;
  phase: CommandRegistryPhase;
  errorCode: string | null;
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

/**
 * 应用命令装配：
 * 1. 向宿主命令系统注册可序列化命令定义，并转发宿主 invoke 事件到查看器桥；
 * 2. 向本地命令注册表登记 CommandItem（菜单 / 工具栏 / 快捷键 / 命令面板）。
 */
export function usePdfCommands(options: { client?: Client } = {}): UsePdfCommandsResult {
  const client = options.client ?? chipsClient;
  const { register } = useCommandRegistry();
  const bridge = useViewerBridge();
  const [phase, setPhase] = useState<CommandRegistryPhase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("registering");
    setErrorCode(null);

    void Promise.all(pdfCommandDefinitions.map((definition) => client.command.register(definition)))
      .then(() => {
        if (!cancelled) setPhase("ready");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPhase("error");
          setErrorCode(toErrorCode(error));
        }
      });

    const offInvoked = client.command.onInvoked((event) => {
      if (!isPdfCommandInvokedEvent(event)) return;
      const commandId = getPdfCommandId(event);
      if (!commandId || !bridge) return;
      const action: Record<string, () => void> = {
        "com.chips.pdf.file.open": () => void bridge.openDocument(),
        "com.chips.pdf.file.save": () => void bridge.saveDocument(),
        "com.chips.pdf.file.save-as": () => void bridge.saveDocumentAs(),
        "com.chips.pdf.view.zoom-in": bridge.zoomIn,
        "com.chips.pdf.view.zoom-out": bridge.zoomOut,
        "com.chips.pdf.view.zoom-reset": bridge.zoomReset,
        "com.chips.pdf.view.next-page": bridge.nextPage,
        "com.chips.pdf.view.prev-page": bridge.prevPage,
        "com.chips.pdf.view.find": bridge.toggleFind,
        "com.chips.pdf.view.sidebar": bridge.toggleSidebar,
        "com.chips.pdf.tool.select": () => bridge.setTool("select"),
        "com.chips.pdf.tool.draw": () => bridge.setTool("ink"),
        "com.chips.pdf.tool.note": () => bridge.setTool("note"),
      };
      action[commandId]?.();
    });

    return () => {
      cancelled = true;
      offInvoked();
      void Promise.all(
        pdfCommandDefinitions.map((definition) => client.command.unregister(definition.commandId)),
      ).catch(() => {});
    };
  }, [bridge, client]);

  const invokeCommand = useCallback(
    async (commandId: string, source: CommandSource): Promise<void> => {
      try {
        await client.command.invoke(commandId, {}, { source });
      } catch (error) {
        setErrorCode(toErrorCode(error));
      }
    },
    [client],
  );

  const commands = useMemo<CommandItem[]>(() => createPdfCommands(bridge), [bridge]);

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return { client, phase, errorCode, commands, invokeCommand };
}
