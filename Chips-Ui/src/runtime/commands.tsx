import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  icon?: ReactNode;
  group?: string;
  menuId?: string;
  toolbarId?: string;
  enabled?: boolean;
  visible?: boolean;
  keywords?: string[];
  run: () => void;
}

export interface CommandGroup {
  menuId: string;
  label: string;
  commands: CommandItem[];
}

export interface CommandRegistryValue {
  commands: CommandItem[];
  register: (items: CommandItem[]) => void;
  invoke: (commandId: string) => void;
}

const CommandRegistryContext = createContext<CommandRegistryValue | null>(null);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target.getAttribute("role") === "button") {
    return true;
  }

  return target.isContentEditable;
}

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1] ?? "";
  const modifiers = parts.slice(0, -1);

  const pressedMod = event.metaKey || event.ctrlKey;
  if (modifiers.includes("Mod") !== pressedMod) {
    return false;
  }
  if (modifiers.includes("Shift") !== event.shiftKey) {
    return false;
  }
  if (modifiers.includes("Alt") !== event.altKey) {
    return false;
  }

  return normalizeKey(event.key) === normalizeKey(key);
}

export function CommandProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [commands, setCommands] = useState<CommandItem[]>([]);

  const register = useCallback((items: CommandItem[]) => {
    setCommands(items);
  }, []);

  const invoke = useCallback(
    (commandId: string) => {
      const command = commands.find((item) => item.id === commandId);
      if (command && command.enabled !== false) {
        command.run();
      }
    },
    [commands],
  );

  const value = useMemo<CommandRegistryValue>(
    () => ({ commands, register, invoke }),
    [commands, invoke, register],
  );

  return <CommandRegistryContext.Provider value={value}>{children}</CommandRegistryContext.Provider>;
}

export function useCommandRegistry(): CommandRegistryValue {
  const context = useContext(CommandRegistryContext);
  if (!context) {
    throw new Error("useCommandRegistry 必须在 CommandProvider 内使用。");
  }
  return context;
}

export function useCommandShortcuts(commands: CommandItem[]): void {
  useEffect(() => {
    if (commands.length === 0) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.isComposing) {
        return;
      }
      if (event.defaultPrevented) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      for (const command of commands) {
        if (command.enabled === false || !command.shortcut) {
          continue;
        }
        if (matchesShortcut(event, command.shortcut)) {
          event.preventDefault();
          command.run();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [commands]);
}

export function groupCommands(
  commands: CommandItem[],
  menuId: string,
  defaultLabel: string,
): CommandGroup | null {
  const items = commands.filter(
    (command) => command.visible !== false && command.menuId === menuId,
  );
  if (items.length === 0) {
    return null;
  }
  return { menuId, label: defaultLabel, commands: items };
}
