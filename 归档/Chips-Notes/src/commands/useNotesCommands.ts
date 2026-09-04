/**
 * 薯片笔记命令注册 Hook
 *
 * 在命令注册表中登记命令。handlers 通过 ref 稳定化；
 * runtime 使用原始值参与依赖，仅在可用状态真正变化时重建命令。
 * 全局快捷键由 AppChrome 统一挂载（避免重复触发），此处不重复注册。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useCommandRegistry } from '@chips/ui';
import {
  createNotesCommands,
  type NotesCommandHandlers,
  type NotesCommandRuntime,
} from './notes-commands';

export function useNotesCommands(input: NotesCommandHandlers & { runtime: NotesCommandRuntime }): void {
  const { runtime, ...handlers } = input;
  const { register } = useCommandRegistry();

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const { isReady, hasNotebook, hasCurrentNote } = runtime;

  const commands = useMemo(
    () =>
      createNotesCommands(
        {
          newNotebook: () => handlersRef.current.newNotebook(),
          newNote: () => handlersRef.current.newNote(),
          save: () => handlersRef.current.save(),
          deleteCurrent: () => handlersRef.current.deleteCurrent(),
          formatBold: () => handlersRef.current.formatBold(),
          formatItalic: () => handlersRef.current.formatItalic(),
        },
        { isReady, hasNotebook, hasCurrentNote },
      ),
    [isReady, hasNotebook, hasCurrentNote],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);
}
