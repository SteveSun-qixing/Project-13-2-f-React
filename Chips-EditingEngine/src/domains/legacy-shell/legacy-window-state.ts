import type { EditorLayoutMode } from "../../../config/app-config";
import type { WorkspaceDocument } from "../workspace/types";
import { generateScopedId } from "../../legacy/utils/id";
import type {
  CardWindowConfig,
  ToolWindowConfig,
  WindowConfig,
  WindowPosition,
  WindowSize,
  WindowState,
} from "../../legacy/types/window";

export type LegacyToolComponent = "FileManager" | "EditPanel" | "CardBoxLibrary";

export interface LegacyCanvasState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface LegacyViewport {
  width: number;
  height: number;
}

export interface LegacyToolWindowTitles {
  fileManager: string;
  editPanel: string;
  cardLibrary: string;
}

export interface EditingDocumentWindowConfig extends CardWindowConfig {
  documentId: string;
  documentKind: WorkspaceDocument["kind"];
  path: string;
}

export interface EditingToolWindowConfig extends ToolWindowConfig {
  component: LegacyToolComponent;
}

export type EditingEngineWindowConfig = EditingDocumentWindowConfig | EditingToolWindowConfig;

export interface LegacyWindowShellState {
  layoutMode: EditorLayoutMode;
  windowList: EditingEngineWindowConfig[];
  focusedWindowId: string | null;
  maxZIndex: number;
  canvas: LegacyCanvasState;
}

const MIN_Z_INDEX = 100;

const TOOL_WINDOW_ORDER: Array<{
  key: keyof LegacyToolWindowTitles;
  component: LegacyToolComponent;
  icon: string;
  size: WindowSize;
  getPosition(viewport: LegacyViewport): WindowPosition;
}> = [
  {
    key: "fileManager",
    component: "FileManager",
    icon: "F",
    size: { width: 320, height: 520 },
    getPosition() {
      return { x: 24, y: 96 };
    },
  },
  {
    key: "editPanel",
    component: "EditPanel",
    icon: "E",
    size: { width: 340, height: 520 },
    getPosition(viewport) {
      return { x: Math.max(24, viewport.width - 364), y: 96 };
    },
  },
  {
    key: "cardLibrary",
    component: "CardBoxLibrary",
    icon: "C",
    size: { width: 360, height: 320 },
    getPosition(viewport) {
      return { x: 24, y: Math.max(96, viewport.height - 360) };
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createToolWindow(
  component: LegacyToolComponent,
  title: string,
  icon: string,
  size: WindowSize,
  position: WindowPosition,
): EditingToolWindowConfig {
  return {
    id: `tool-window:${component}`,
    type: "tool",
    component,
    title,
    icon,
    position,
    size,
    state: "normal",
    zIndex: 0,
    resizable: true,
    draggable: true,
    closable: false,
    minimizable: true,
    dockable: true,
  };
}

function createDocumentWindow(document: WorkspaceDocument, index: number, layoutMode: EditorLayoutMode): EditingDocumentWindowConfig {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const baseX = layoutMode === "infinite-canvas" ? 380 : 0;
  const baseY = layoutMode === "infinite-canvas" ? 132 : 0;
  return {
    id: generateScopedId("card-window"),
    type: "card",
    title: document.title,
    cardId: document.id,
    documentId: document.id,
    documentKind: document.kind,
    path: document.path,
    position: { x: baseX + column * 56, y: baseY + row * 48 },
    size: { width: 920, height: 640 },
    state: "normal",
    zIndex: 0,
    isEditing: document.kind === "card",
    cardType: document.kind,
    resizable: true,
    draggable: true,
    closable: true,
    minimizable: true,
  };
}

function elevateWindow(windows: EditingEngineWindowConfig[], windowId: string, nextZIndex: number) {
  return windows.map((windowItem) =>
    windowItem.id === windowId
      ? {
          ...windowItem,
          zIndex: nextZIndex,
        }
      : windowItem,
  );
}

function isDocumentWindow(windowItem: EditingEngineWindowConfig): windowItem is EditingDocumentWindowConfig {
  return windowItem.type === "card";
}

export function createInitialLegacyWindowShellState(layoutMode: EditorLayoutMode): LegacyWindowShellState {
  return {
    layoutMode,
    windowList: [],
    focusedWindowId: null,
    maxZIndex: MIN_Z_INDEX,
    canvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };
}

export function ensureToolWindows(
  state: LegacyWindowShellState,
  viewport: LegacyViewport,
  titles: LegacyToolWindowTitles,
): LegacyWindowShellState {
  let changed = false;
  const nextWindowList = [...state.windowList];

  for (const definition of TOOL_WINDOW_ORDER) {
    const expectedTitle = titles[definition.key];
    const index = nextWindowList.findIndex(
      (windowItem): windowItem is EditingToolWindowConfig =>
        windowItem.type === "tool" && windowItem.component === definition.component,
    );

    if (index === -1) {
      nextWindowList.push(
        createToolWindow(
          definition.component,
          expectedTitle,
          definition.icon,
          definition.size,
          definition.getPosition(viewport),
        ),
      );
      changed = true;
      continue;
    }

    const current = nextWindowList[index] as EditingToolWindowConfig;
    const nextPosition = definition.getPosition(viewport);
    if (current.title !== expectedTitle) {
      nextWindowList[index] = {
        ...current,
        title: expectedTitle,
        position: current.position.x < 0 || current.position.y < 0 ? nextPosition : current.position,
      };
      changed = true;
    }
  }

  return changed
    ? {
        ...state,
        windowList: nextWindowList,
      }
    : state;
}

export function syncDocumentWindows(
  state: LegacyWindowShellState,
  documents: WorkspaceDocument[],
): LegacyWindowShellState {
  const documentIds = new Set(documents.map((document) => document.id));
  const existingDocumentWindows = state.windowList.filter(isDocumentWindow);
  const nextWindows: EditingEngineWindowConfig[] = state.windowList.filter((windowItem) => {
    if (!isDocumentWindow(windowItem)) {
      return true;
    }
    return documentIds.has(windowItem.documentId);
  });

  let changed = nextWindows.length !== state.windowList.length;

  for (const [index, document] of documents.entries()) {
    const existing = existingDocumentWindows.find((windowItem) => windowItem.documentId === document.id);
    if (existing) {
      const targetIndex = nextWindows.findIndex((windowItem) => windowItem.id === existing.id);
      const updated: EditingDocumentWindowConfig = {
        ...existing,
        title: document.title,
        path: document.path,
        documentKind: document.kind,
        cardType: document.kind,
      };
      if (JSON.stringify(updated) !== JSON.stringify(nextWindows[targetIndex])) {
        nextWindows[targetIndex] = updated;
        changed = true;
      }
      continue;
    }

    nextWindows.push(createDocumentWindow(document, index, state.layoutMode));
    changed = true;
  }

  let nextFocusedWindowId = state.focusedWindowId;
  if (nextFocusedWindowId && !nextWindows.some((windowItem) => windowItem.id === nextFocusedWindowId)) {
    nextFocusedWindowId = nextWindows.find(isDocumentWindow)?.id ?? nextWindows[0]?.id ?? null;
    changed = true;
  }

  return changed
    ? {
        ...state,
        windowList: nextWindows,
        focusedWindowId: nextFocusedWindowId,
      }
    : state;
}

export function focusWindow(state: LegacyWindowShellState, windowId: string): LegacyWindowShellState {
  const target = state.windowList.find((windowItem) => windowItem.id === windowId);
  if (!target) {
    return state;
  }
  const nextZIndex = state.maxZIndex + 1;
  return {
    ...state,
    focusedWindowId: windowId,
    maxZIndex: nextZIndex,
    windowList: elevateWindow(state.windowList, windowId, nextZIndex),
  };
}

export function closeWindow(state: LegacyWindowShellState, windowId: string): LegacyWindowShellState {
  const nextWindowList = state.windowList.filter((windowItem) => windowItem.id !== windowId);
  return {
    ...state,
    windowList: nextWindowList,
    focusedWindowId: state.focusedWindowId === windowId ? nextWindowList[0]?.id ?? null : state.focusedWindowId,
  };
}

export function moveWindow(
  state: LegacyWindowShellState,
  windowId: string,
  position: WindowPosition,
): LegacyWindowShellState {
  return {
    ...state,
    windowList: state.windowList.map((windowItem) =>
      windowItem.id === windowId
        ? {
            ...windowItem,
            position,
          }
        : windowItem,
    ),
  };
}

export function resizeWindow(
  state: LegacyWindowShellState,
  windowId: string,
  size: WindowSize,
): LegacyWindowShellState {
  const width = clamp(size.width, 240, 1600);
  const height = clamp(size.height, 180, 1200);
  return {
    ...state,
    windowList: state.windowList.map((windowItem) =>
      windowItem.id === windowId
        ? {
            ...windowItem,
            size: { width, height },
          }
        : windowItem,
    ),
  };
}

export function setWindowState(
  state: LegacyWindowShellState,
  windowId: string,
  nextState: WindowState,
): LegacyWindowShellState {
  return {
    ...state,
    windowList: state.windowList.map((windowItem) =>
      windowItem.id === windowId
        ? {
            ...windowItem,
            state: nextState,
          }
        : windowItem,
    ),
  };
}

export function setLayoutMode(
  state: LegacyWindowShellState,
  layoutMode: EditorLayoutMode,
): LegacyWindowShellState {
  if (state.layoutMode === layoutMode) {
    return state;
  }
  return {
    ...state,
    layoutMode,
  };
}

export function zoomCanvas(state: LegacyWindowShellState, delta: number): LegacyWindowShellState {
  return {
    ...state,
    canvas: {
      ...state.canvas,
      zoom: clamp(state.canvas.zoom + delta, 0.4, 2.5),
    },
  };
}

export function resetCanvas(state: LegacyWindowShellState): LegacyWindowShellState {
  return {
    ...state,
    canvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };
}

export function panCanvas(state: LegacyWindowShellState, deltaX: number, deltaY: number): LegacyWindowShellState {
  return {
    ...state,
    canvas: {
      ...state.canvas,
      panX: state.canvas.panX + deltaX,
      panY: state.canvas.panY + deltaY,
    },
  };
}

export function getDocumentWindow(
  windows: EditingEngineWindowConfig[],
  documentId: string | null,
): EditingDocumentWindowConfig | null {
  if (!documentId) {
    return null;
  }
  const target = windows.find(
    (windowItem): windowItem is EditingDocumentWindowConfig =>
      windowItem.type === "card" && windowItem.documentId === documentId,
  );
  return target ?? null;
}

export function getToolWindow(
  windows: EditingEngineWindowConfig[],
  component: LegacyToolComponent,
): EditingToolWindowConfig | null {
  const target = windows.find(
    (windowItem): windowItem is EditingToolWindowConfig =>
      windowItem.type === "tool" && windowItem.component === component,
  );
  return target ?? null;
}

export function getDockWindows(windows: EditingEngineWindowConfig[]): EditingEngineWindowConfig[] {
  return windows.filter((windowItem) => windowItem.state === "minimized");
}

export function getVisibleCanvasWindows(windows: EditingEngineWindowConfig[]): EditingEngineWindowConfig[] {
  return windows.filter((windowItem) => windowItem.state !== "minimized");
}

export function getActiveDocumentWindow(
  windows: EditingEngineWindowConfig[],
  focusedWindowId: string | null,
  activeDocumentId: string | null,
): EditingDocumentWindowConfig | null {
  const focused = windows.find(
    (windowItem): windowItem is EditingDocumentWindowConfig =>
      windowItem.type === "card" && windowItem.id === focusedWindowId,
  );
  if (focused) {
    return focused;
  }
  return getDocumentWindow(windows, activeDocumentId);
}

export function getWindow(windowList: EditingEngineWindowConfig[], windowId: string): EditingEngineWindowConfig | null {
  return windowList.find((windowItem) => windowItem.id === windowId) ?? null;
}

export function isDocumentDropEnabled(document: WorkspaceDocument | null): boolean {
  return document?.kind === "card";
}

export function getDocumentStructureLength(document: WorkspaceDocument | null): number {
  if (!document || document.kind !== "card") {
    return 0;
  }
  const structure = Array.isArray(document.ast.structure?.structure)
    ? document.ast.structure.structure
    : [];
  return structure.length;
}

export function setDocumentEditing(
  state: LegacyWindowShellState,
  documentId: string,
  isEditing: boolean,
): LegacyWindowShellState {
  return {
    ...state,
    windowList: state.windowList.map((windowItem) =>
      windowItem.type === "card" && windowItem.documentId === documentId
        ? {
            ...windowItem,
            isEditing,
          }
        : windowItem,
    ),
  };
}

export function getDocumentWindows(windows: EditingEngineWindowConfig[]): EditingDocumentWindowConfig[] {
  return windows.filter(isDocumentWindow);
}

export function isToolWindow(windowItem: WindowConfig): windowItem is EditingToolWindowConfig {
  return windowItem.type === "tool";
}
