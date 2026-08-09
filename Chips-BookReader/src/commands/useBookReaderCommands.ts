import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import {
  createBookReaderCommands,
  resolveBookReaderCommandHandlerId,
  type BookReaderCommandHandlerId,
  type BookReaderCommandId,
  type BookReaderCommandRuntimeState,
} from "./book-reader-commands";

type BookReaderCommandHandler = (payload?: Record<string, unknown>) => void | Promise<void>;
type BookReaderCommandHandlerStack = Map<BookReaderCommandHandlerId, BookReaderCommandHandler[]>;

export interface UseBookReaderCommandsOptions {
  runtimeState: BookReaderCommandRuntimeState;
}

export interface UseBookReaderCommandsResult {
  commands: CommandItem[];
  invokeCommand(commandId: BookReaderCommandId, payload?: Record<string, unknown>): void;
  registerHandler(handlerId: BookReaderCommandHandlerId, handler: BookReaderCommandHandler): () => void;
}

function getTopHandler(stack: BookReaderCommandHandler[] | undefined): BookReaderCommandHandler | null {
  if (!stack || stack.length === 0) {
    return null;
  }

  return stack[stack.length - 1] ?? null;
}

export function useBookReaderCommands(options: UseBookReaderCommandsOptions): UseBookReaderCommandsResult {
  const { runtimeState } = options;
  const { register } = useCommandRegistry();
  const handlersRef = useRef<BookReaderCommandHandlerStack>(new Map());

  const dispatchCommand = useCallback(
    (commandId: BookReaderCommandId, payload?: Record<string, unknown>): void => {
      const handlerId = resolveBookReaderCommandHandlerId(commandId);
      if (!handlerId) {
        return;
      }

      const handler = getTopHandler(handlersRef.current.get(handlerId));
      if (!handler) {
        return;
      }

      void Promise.resolve(handler(payload)).catch(() => undefined);
    },
    [],
  );

  const registerHandler = useCallback(
    (handlerId: BookReaderCommandHandlerId, handler: BookReaderCommandHandler): (() => void) => {
      const stack = handlersRef.current.get(handlerId) ?? [];
      stack.push(handler);
      handlersRef.current.set(handlerId, stack);

      return () => {
        const current = handlersRef.current.get(handlerId);
        if (!current) {
          return;
        }

        const nextStack = current.filter((item) => item !== handler);
        if (nextStack.length === 0) {
          handlersRef.current.delete(handlerId);
          return;
        }

        handlersRef.current.set(handlerId, nextStack);
      };
    },
    [],
  );

  const commands = useMemo(
    () => createBookReaderCommands(dispatchCommand, runtimeState),
    [dispatchCommand, runtimeState],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  const invokeCommand = useCallback(
    (commandId: BookReaderCommandId, payload?: Record<string, unknown>): void => {
      dispatchCommand(commandId, payload);
    },
    [dispatchCommand],
  );

  return {
    commands,
    invokeCommand,
    registerHandler,
  };
}
