import type { BaseCardRecord, CompositeNodeSelection } from "chips-sdk";
import type { BaseCardEditSession, CommandHistorySnapshot } from "./types";

const DEFAULT_HISTORY_LIMIT = 100;

function normalizeValue(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => normalizeValue(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${normalizeValue(item)}`).join(",")}}`;
  }
  return JSON.stringify(null);
}

function areConfigsEqual(left: Record<string, unknown> | null, right: Record<string, unknown> | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return normalizeValue(left) === normalizeValue(right);
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function cloneHistory(
  history: CommandHistorySnapshot<Record<string, unknown>>,
): CommandHistorySnapshot<Record<string, unknown>> {
  return {
    past: history.past.map((item) => cloneConfig(item)),
    present: history.present ? cloneConfig(history.present) : null,
    future: history.future.map((item) => cloneConfig(item)),
  };
}

function createCommandTimestamp(): string {
  return new Date().toISOString();
}

function trimHistory(history: Record<string, unknown>[], limit: number): Record<string, unknown>[] {
  if (history.length <= limit) {
    return history;
  }
  return history.slice(history.length - limit);
}

export function createBaseCardEditSession(
  selectedNode: CompositeNodeSelection,
  baseCard: BaseCardRecord,
): BaseCardEditSession {
  return {
    selectedNode,
    baseCard,
    history: {
      past: [],
      present: cloneConfig(baseCard.config),
      future: [],
    },
    historyLimit: DEFAULT_HISTORY_LIMIT,
    lastCommand: {
      kind: "initialize",
      timestamp: createCommandTimestamp(),
    },
    lastSavedConfig: cloneConfig(baseCard.config),
    pendingSaveConfig: null,
    dirty: false,
    saveState: "idle",
    error: null,
  };
}

export function applyConfigChange(
  session: BaseCardEditSession,
  nextConfig: Record<string, unknown>,
): BaseCardEditSession {
  const present = session.history.present;
  if (present && areConfigsEqual(present, nextConfig)) {
    return session;
  }

  const nextPresent = cloneConfig(nextConfig);
  const nextPast = present
    ? trimHistory([...session.history.past.map((item) => cloneConfig(item)), cloneConfig(present)], session.historyLimit)
    : [...session.history.past];
  return {
    ...session,
    history: {
      past: nextPast,
      present: nextPresent,
      future: [],
    },
    lastCommand: {
      kind: "change",
      timestamp: createCommandTimestamp(),
    },
    dirty: !areConfigsEqual(nextPresent, session.lastSavedConfig),
    saveState: "pending",
    error: null,
  };
}

export function canUndo(session: BaseCardEditSession | null): boolean {
  return Boolean(session && session.history.past.length > 0 && session.history.present);
}

export function canRedo(session: BaseCardEditSession | null): boolean {
  return Boolean(session && session.history.future.length > 0);
}

export function undoConfigChange(session: BaseCardEditSession): BaseCardEditSession {
  const previous = session.history.past[session.history.past.length - 1];
  const present = session.history.present;
  if (!previous || !present) {
    return session;
  }

  const nextPast = session.history.past.slice(0, -1).map((item) => cloneConfig(item));
  return {
    ...session,
    history: {
      past: nextPast,
      present: cloneConfig(previous),
      future: [cloneConfig(present), ...session.history.future.map((item) => cloneConfig(item))],
    },
    lastCommand: {
      kind: "undo",
      timestamp: createCommandTimestamp(),
    },
    dirty: !areConfigsEqual(previous, session.lastSavedConfig),
    saveState: "pending",
    error: null,
  };
}

export function redoConfigChange(session: BaseCardEditSession): BaseCardEditSession {
  const next = session.history.future[0];
  const present = session.history.present;
  if (!next || !present) {
    return session;
  }

  return {
    ...session,
    history: {
      past: trimHistory(
        [...session.history.past.map((item) => cloneConfig(item)), cloneConfig(present)],
        session.historyLimit,
      ),
      present: cloneConfig(next),
      future: session.history.future.slice(1).map((item) => cloneConfig(item)),
    },
    lastCommand: {
      kind: "redo",
      timestamp: createCommandTimestamp(),
    },
    dirty: !areConfigsEqual(next, session.lastSavedConfig),
    saveState: "pending",
    error: null,
  };
}

export function markSavePending(session: BaseCardEditSession): BaseCardEditSession {
  return {
    ...session,
    saveState: "pending",
    lastCommand: {
      ...session.lastCommand,
    },
    error: null,
  };
}

export function markSaveInFlight(session: BaseCardEditSession): BaseCardEditSession {
  const present = session.history.present;
  return {
    ...session,
    pendingSaveConfig: present ? cloneConfig(present) : null,
    saveState: "saving",
    lastCommand: {
      ...session.lastCommand,
    },
    error: null,
  };
}

export function markSaveSucceeded(
  session: BaseCardEditSession,
  baseCard: BaseCardRecord,
): BaseCardEditSession {
  const normalizedSaved = cloneConfig(baseCard.config);
  const pendingMatchesPresent = areConfigsEqual(session.pendingSaveConfig, session.history.present);
  const nextPresent = pendingMatchesPresent ? normalizedSaved : session.history.present ? cloneConfig(session.history.present) : null;
  const nextHistory = cloneHistory(session.history);
  nextHistory.present = nextPresent;

  return {
    ...session,
    selectedNode: {
      ...session.selectedNode,
      title: baseCard.title,
      cardType: baseCard.cardType,
      pluginId: baseCard.pluginId,
    },
    baseCard,
    history: nextHistory,
    lastCommand: {
      kind: "sync",
      timestamp: createCommandTimestamp(),
    },
    lastSavedConfig: normalizedSaved,
    pendingSaveConfig: null,
    dirty: nextPresent ? !areConfigsEqual(nextPresent, normalizedSaved) : false,
    saveState: nextPresent && !areConfigsEqual(nextPresent, normalizedSaved) ? "pending" : "saved",
    error: null,
  };
}

export function markSaveFailed(session: BaseCardEditSession, message: string): BaseCardEditSession {
  return {
    ...session,
    pendingSaveConfig: null,
    saveState: "error",
    lastCommand: {
      ...session.lastCommand,
    },
    error: message,
    dirty: Boolean(session.history.present && !areConfigsEqual(session.history.present, session.lastSavedConfig)),
  };
}

export function currentEditorConfig(session: BaseCardEditSession | null): Record<string, unknown> | null {
  return session?.history.present ? cloneConfig(session.history.present) : null;
}
