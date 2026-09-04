import type {
  EngineConfig,
  EngineSnapshot,
  Guide,
  PhotoLayer,
  Point,
  PointerInfo,
  SelectionBounds,
  ToolId,
  ToolOptionDescriptor,
} from "./types";
import { HistoryStack } from "./core/history";
import { LayersManager } from "./core/layers";
import { SelectionManager } from "./core/selection";
import { ZoomView } from "./core/zoom-view";
import { WorkspaceRenderer } from "./core/workspace";
import { PointerManager } from "./input/pointer-manager";
import { ToolBase, type ToolContext } from "./tools/base-tool";
import type { EngineAction } from "./core/action";
import { UpdateLayerAction } from "./core/layer-actions";
import { applyLayerFilters } from "./effects/live-filters";
import { clamp } from "./lib/helpers";
import { nextZoomStep, previousZoomStep } from "./core/zoom-limits";

export interface ToolDefinitionEntry {
  id: ToolId;
  title: string;
  iconId: string;
  shortcut?: string;
  create: (context: ToolContext) => ToolBase;
}

const INITIAL_CONFIG: EngineConfig = {
  width: 800,
  height: 600,
  zoom: 1,
  color: "#008800",
  colorSecond: "#ffffff",
  alpha: 255,
};

export class PhotoEngine {
  readonly layers: LayersManager;
  readonly history: HistoryStack;
  readonly selection: SelectionManager;
  readonly zoomView: ZoomView;
  readonly workspace: WorkspaceRenderer;
  readonly pointerManager: PointerManager;

  config: EngineConfig = { ...INITIAL_CONFIG };
  gridVisible = false;
  rulerVisible = false;
  guides: Guide[] = [];
  activeToolId: ToolId = "brush";
  toolOptions: Record<string, Record<string, unknown>> = {};
  toolDefinitions: ToolDefinitionEntry[] = [];
  toolInstances = new Map<ToolId, ToolBase>();
  mouseWorld: Point | null = null;
  mouseCanvas: Point | null = null;
  keyboardGuard: (() => boolean) | null = null;
  panning = false;

  private guideAutoIncrement = 1;
  private snapshotVersion = 0;
  private listeners = new Set<() => void>();
  private mainCanvasRef: HTMLCanvasElement | null = null;
  private lastNotifyTime = 0;
  private notifyScheduled = false;

  constructor() {
    this.layers = new LayersManager({
      requestRender: () => this.requestRender(),
      notify: () => this.notify(),
    });
    this.history = new HistoryStack();
    this.zoomView = new ZoomView();
    this.selection = new SelectionManager(
      {
        requestRender: () => this.requestRender(),
        notify: () => this.notify(),
      },
      this.zoomView,
    );
    this.workspace = new WorkspaceRenderer(this);
    this.pointerManager = new PointerManager(this);
    this.layers.filterHook = applyLayerFilters;
    this.zoomView.subscribe(() => this.notify());
    this.history.subscribe(() => this.notify());
    this.resetDocument();
  }

  resetDocument(): void {
    this.config = { ...INITIAL_CONFIG };
    this.guides = [];
    this.gridVisible = false;
    this.rulerVisible = false;
    this.layers.clearAllInternal();
    this.layers.insertInternal({ name: "图层 1" });
    this.zoomView.reset();
    this.requestRender();
    this.notify();
  }

  // ---------- 工具管理 ----------

  registerTools(definitions: ToolDefinitionEntry[]): void {
    this.toolDefinitions = definitions;
    this.toolInstances.clear();
    this.activeToolId = definitions[0]?.id ?? "brush";
    for (const definition of definitions) {
      this.toolInstances.set(definition.id, definition.create({ engine: this }));
    }
    this.ensureToolOptions();
    this.activateTool(this.activeToolId, false);
  }

  getToolDefinition(id: ToolId): ToolDefinitionEntry | null {
    return this.toolDefinitions.find((definition) => definition.id === id) ?? null;
  }

  getActiveToolId(): ToolId {
    return this.activeToolId;
  }

  getActiveTool(): ToolBase | null {
    return this.toolInstances.get(this.activeToolId) ?? null;
  }

  activateTool(id: ToolId, notify = true): void {
    if (this.activeToolId === id && this.toolInstances.has(id)) {
      return;
    }
    const previous = this.getActiveTool();
    previous?.onDeactivate?.();
    this.activeToolId = id;
    const next = this.getActiveTool();
    this.ensureToolOptions(id);
    next?.onActivate?.();
    this.requestRender();
    if (notify) {
      this.notify();
    }
  }

  getToolOption(toolId: ToolId, key: string): unknown {
    const options = this.toolOptions[toolId];
    if (options && key in options) {
      return options[key];
    }
    const definition = this.toolOptionsSchema(toolId).find((item) => item.key === key);
    return definition?.default;
  }

  setToolOption(toolId: ToolId, key: string, value: number | string | boolean): void {
    const options = this.toolOptions[toolId] ?? {};
    this.toolOptions[toolId] = { ...options, [key]: value };
    const tool = this.toolInstances.get(toolId);
    if (toolId === this.activeToolId) {
      (tool as unknown as { onOptionsChanged?: (key: string) => void })?.onOptionsChanged?.(key);
    }
    this.requestRender();
    this.notify();
  }

  onToolOptionsChanged(handlerId: ToolId, handler: (key: string) => void): void {
    const tool = this.toolInstances.get(handlerId);
    if (tool) {
      (tool as unknown as { onOptionsChanged?: (key: string) => void }).onOptionsChanged = handler;
    }
  }

  toolOptionsSchema(toolId: ToolId): ToolOptionDescriptor[] {
    return this.toolInstances.get(toolId)?.optionsSchema ?? [];
  }

  private ensureToolOptions(toolId?: ToolId): void {
    const ids = toolId ? [toolId] : this.toolDefinitions.map((definition) => definition.id);
    for (const id of ids) {
      if (this.toolOptions[id]) {
        continue;
      }
      const schema = this.toolOptionsSchema(id);
      const defaults: Record<string, unknown> = {};
      for (const descriptor of schema) {
        defaults[descriptor.key] = descriptor.default;
      }
      this.toolOptions[id] = defaults;
    }
  }

  // ---------- 历史 ----------

  async doAction(action: EngineAction, options?: { mergeWithHistory?: string[] }): Promise<void> {
    await this.history.doAction(action, options);
    this.documentDirty = true;
  }

  isDirty(): boolean {
    return this.documentDirty;
  }

  resetDirty(): void {
    this.documentDirty = false;
  }

  private documentDirty = false;

  async undo(): Promise<void> {
    await this.history.undo();
    this.requestRender();
  }

  async redo(): Promise<void> {
    await this.history.redo();
    this.requestRender();
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  // ---------- 配置 ----------

  setConfig(patch: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...patch };
    this.requestRender();
    this.notify();
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  setConfigInternal(patch: Partial<EngineConfig>): void {
    this.config = { ...this.config, ...patch };
    if (patch.width !== undefined || patch.height !== undefined) {
      this.requestRender();
    }
    this.notify();
  }

  resizeCanvasInternal(width: number, height: number): void {
    this.config = { ...this.config, width, height };
    this.requestRender();
    this.notify();
  }

  translateLayerImage(layerId: number, dx: number, dy: number): void {
    const layer = this.layers.getLayer(layerId);
    if (!layer?.canvas) {
      return;
    }
    const moved = this.createCanvasLike(layer.canvas);
    const ctx = moved.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, moved.width, moved.height);
    ctx.drawImage(layer.canvas, dx, dy);
    this.layers.setLayerCanvas(layerId, moved);
  }

  getAllLayers(): PhotoLayer[] {
    return this.layers.getAllLayers();
  }

  applySettings(layerId: number, settings: Partial<PhotoLayer>): void {
    this.layers.applySettings(layerId, settings);
  }

  private createCanvasLike(source: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    return canvas;
  }

  // ---------- 视图 ----------

  setZoom(value: number, center?: { x: number; y: number }): void {
    const viewport = this.workspace.getViewportSize();
    const focus = center ?? { x: viewport.width / 2, y: viewport.height / 2 };
    this.zoomView.scaleAt(focus.x, focus.y, value / this.zoomView.getZoom());
    this.config = { ...this.config, zoom: this.zoomView.getZoom() };
    this.requestRender();
    this.notify();
  }

  zoomIn(): void {
    this.setZoom(nextZoomStep(this.zoomView.getZoom()));
  }

  zoomOut(): void {
    this.setZoom(previousZoomStep(this.zoomView.getZoom()));
  }

  zoomOriginal(): void {
    this.setZoom(1);
  }

  zoomAuto(): void {
    this.workspace.zoomAuto();
    this.config = { ...this.config, zoom: this.zoomView.getZoom() };
    this.notify();
  }

  syncZoomFromView(): void {
    this.config = { ...this.config, zoom: this.zoomView.getZoom() };
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.requestRender();
    this.notify();
  }

  setRulerVisible(visible: boolean): void {
    this.rulerVisible = visible;
    this.notify();
  }

  insertGuide(axis: "x" | "y", position: number): void {
    this.guides = [...this.guides, { id: this.guideAutoIncrement++, axis, position: Math.round(position) }];
    this.requestRender();
    this.notify();
  }

  updateGuide(id: number, position: number): void {
    this.guides = this.guides.map((guide) =>
      guide.id === id ? { ...guide, position: Math.round(position) } : guide,
    );
    this.requestRender();
    this.notify();
  }

  removeGuide(id: number): void {
    this.guides = this.guides.filter((guide) => guide.id !== id);
    this.requestRender();
    this.notify();
  }

  removeGuides(): void {
    if (this.guides.length === 0) {
      return;
    }
    this.guides = [];
    this.requestRender();
    this.notify();
  }

  swapColors(): void {
    this.config = {
      ...this.config,
      color: this.config.colorSecond,
      colorSecond: this.config.color,
    };
    this.notify();
  }

  // ---------- 颜色 ----------

  setColor(color: string): void {
    this.config = { ...this.config, color };
    this.notify();
  }

  setColorSecond(color: string): void {
    this.config = { ...this.config, colorSecond: color };
    this.notify();
  }

  setAlpha(alpha: number): void {
    this.config = { ...this.config, alpha: clamp(Math.round(alpha), 0, 255) };
    this.notify();
  }

  // ---------- 图层便捷操作 ----------

  nudgeSelectedLayer(dx: number, dy: number): void {
    const layer = this.layers.getSelected();
    if (!layer) {
      return;
    }
    void this.doAction(
      new UpdateLayerAction(this.layers, layer.id, { x: layer.x + dx, y: layer.y + dy }, "移动图层"),
    );
  }

  // ---------- 画布挂载 ----------

  attachMainCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.mainCanvasRef = canvas;
    this.workspace.attachCanvas(canvas, width, height);
  }

  detachMainCanvas(): void {
    this.mainCanvasRef = null;
    this.workspace.detachCanvas();
  }

  getMainCanvas(): HTMLCanvasElement | null {
    return this.mainCanvasRef;
  }

  requestRender(): void {
    this.workspace.requestRender();
  }

  setPanningCursor(panning: boolean): void {
    this.panning = panning;
    this.notify();
  }

  // ---------- 快照与订阅 ----------

  getSnapshot(): EngineSnapshot {
    return {
      version: this.snapshotVersion,
      layers: this.layers.getSortedLayers(),
      selectedLayerId: this.layers.getSelectedId(),
      config: this.config,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      activeToolId: this.activeToolId,
      toolOptions: this.toolOptions,
      selection: this.selection.bounds,
      gridVisible: this.gridVisible,
      guides: this.guides,
      rulerVisible: this.rulerVisible,
      mouseWorld: this.mouseWorld,
      mouseCanvas: this.mouseCanvas,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    this.snapshotVersion += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }

  notifyAfterRender(): void {
    this.notify();
  }

  notifyThrottled(): void {
    const now = Date.now();
    if (now - this.lastNotifyTime >= 80) {
      this.lastNotifyTime = now;
      this.notify();
      return;
    }
    if (this.notifyScheduled) {
      return;
    }
    this.notifyScheduled = true;
    setTimeout(() => {
      this.notifyScheduled = false;
      this.lastNotifyTime = Date.now();
      this.notify();
    }, 80);
  }

  // ---------- 指针信息 ----------

  buildPointerInfoForTest(world: Point): PointerInfo {
    return {
      x: world.x,
      y: world.y,
      clickX: world.x,
      clickY: world.y,
      lastX: world.x,
      lastY: world.y,
      isDrag: false,
      isValid: true,
      pressure: 0.5,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      button: 0,
      speedAverage: 0,
    };
  }

  getSelectedLayer(): PhotoLayer | null {
    return this.layers.getSelected();
  }
}

let singletonEngine: PhotoEngine | null = null;

export function getEngine(): PhotoEngine {
  if (!singletonEngine) {
    singletonEngine = new PhotoEngine();
  }
  return singletonEngine;
}

export const engine: PhotoEngine = getEngine();
