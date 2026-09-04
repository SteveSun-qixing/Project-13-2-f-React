import type { PhotoLayer, SelectionBounds } from "../types";
import { cloneCanvas, createCanvas } from "../lib/helpers";
import { rendererRegistry } from "./renderers";
import type { LayerActionHost } from "./layer-actions";

export interface LayersHost {
  requestRender(): void;
  notify(): void;
}

const DEFAULT_LAYER: Omit<PhotoLayer, "id" | "order"> = {
  parentId: 0,
  name: "图层",
  type: null,
  x: 0,
  y: 0,
  width: null,
  height: null,
  widthOriginal: null,
  heightOriginal: null,
  visible: true,
  isVector: false,
  opacity: 100,
  composition: "source-over",
  rotate: 0,
  color: null,
  data: null,
  params: {},
  status: null,
  filters: [],
  canvas: null,
};

export class LayersManager implements LayerActionHost {
  private layerList: PhotoLayer[] = [];
  private autoIncrement = 1;
  private filterAutoIncrement = 1;
  private selectedId: number | null = null;
  private selectionBounds: SelectionBounds | null = null;
  private compositionWidth = 1;
  private compositionHeight = 1;

  constructor(private readonly host: LayersHost) {}

  get autoIncrementValue(): number {
    return this.autoIncrement;
  }

  setAutoIncrement(value: number): void {
    this.autoIncrement = value;
  }

  nextFilterId(): number {
    return this.filterAutoIncrement++;
  }

  getAllLayers(): PhotoLayer[] {
    return this.layerList;
  }

  getSortedLayers(): PhotoLayer[] {
    return [...this.layerList].sort((a, b) => b.order - a.order);
  }

  getLayer(id: number): PhotoLayer | null {
    return this.layerList.find((layer) => layer.id === id) ?? null;
  }

  getSelected(): PhotoLayer | null {
    return this.selectedId === null ? null : this.getLayer(this.selectedId);
  }

  getSelectedId(): number | null {
    return this.selectedId;
  }

  isVectorType(type: PhotoLayer["type"]): boolean {
    return type !== null && type !== "image";
  }

  getDimensions(): { width: number; height: number } {
    let width = 0;
    let height = 0;
    for (const layer of this.layerList) {
      if (layer.width !== null && layer.x + layer.width > width) {
        width = Math.ceil(layer.x + layer.width);
      }
      if (layer.height !== null && layer.y + layer.height > height) {
        height = Math.ceil(layer.y + layer.height);
      }
    }
    return { width, height };
  }

  isLayerEmpty(id: number): boolean {
    const layer = this.getLayer(id);
    if (!layer) {
      return true;
    }
    if (layer.canvas && layer.width !== null && layer.height !== null) {
      const sampleWidth = Math.max(1, Math.min(layer.canvas.width, Math.ceil(layer.width)));
      const sampleHeight = Math.max(1, Math.min(layer.canvas.height, Math.ceil(layer.height)));
      const ctx = layer.canvas.getContext("2d");
      if (!ctx) {
        return false;
      }
      const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] !== 0) {
          return false;
        }
      }
      return true;
    }
    if (layer.type === "brush" || layer.type === "pencil") {
      return !Array.isArray(layer.data) || (layer.data as unknown[]).length === 0;
    }
    if (layer.type === "text") {
      return !Array.isArray(layer.data) || (layer.data as unknown[]).length === 0;
    }
    return layer.data === null || layer.data === undefined;
  }

  // ---------- LayerActionHost ----------

  insertInternal(settings: Partial<PhotoLayer>): PhotoLayer {
    const layer: PhotoLayer = {
      ...DEFAULT_LAYER,
      ...settings,
      id: settings.id ?? this.autoIncrement,
      order: settings.order ?? this.nextOrder(),
    };
    if (settings.isVector === undefined) {
      layer.isVector = this.isVectorType(layer.type);
    }
    if (layer.id >= this.autoIncrement) {
      this.autoIncrement = layer.id + 1;
    }
    this.layerList.push(layer);
    if (this.selectedId === null) {
      this.selectedId = layer.id;
    }
    this.host.requestRender();
    this.host.notify();
    return layer;
  }

  removeInternal(id: number): void {
    this.layerList = this.layerList.filter((layer) => layer.id !== id);
    if (this.selectedId === id) {
      const sorted = this.getSortedLayers();
      this.selectedId = sorted.length > 0 ? sorted[0].id : null;
    }
    this.host.requestRender();
    this.host.notify();
  }

  restoreInternal(layer: PhotoLayer, index: number): void {
    if (this.layerList.some((item) => item.id === layer.id)) {
      return;
    }
    const clamped = Math.max(0, Math.min(index, this.layerList.length));
    this.layerList.splice(clamped, 0, layer);
    if (layer.id >= this.autoIncrement) {
      this.autoIncrement = layer.id + 1;
    }
    this.host.requestRender();
    this.host.notify();
  }

  indexOf(id: number): number {
    return this.layerList.findIndex((layer) => layer.id === id);
  }

  applySettings(id: number, settings: Partial<PhotoLayer>): void {
    const layer = this.getLayer(id);
    if (!layer) {
      return;
    }
    Object.assign(layer, settings);
    this.host.requestRender();
    this.host.notify();
  }

  selectInternal(id: number | null): void {
    this.selectedId = id;
    this.host.requestRender();
    this.host.notify();
  }

  setOrder(id: number, order: number): void {
    const layer = this.getLayer(id);
    if (layer) {
      layer.order = order;
    }
  }

  sortedOrders(): number[] {
    return this.layerList.map((layer) => layer.order).sort((a, b) => b - a);
  }

  idByOrder(order: number): number | null {
    const layer = this.layerList.find((item) => item.order === order);
    return layer ? layer.id : null;
  }

  setLayerCanvas(id: number, canvas: HTMLCanvasElement | null): void {
    const layer = this.getLayer(id);
    if (!layer) {
      return;
    }
    layer.canvas = canvas;
    this.host.requestRender();
    this.host.notify();
  }

  clearAllInternal(): void {
    this.layerList = [];
    this.selectedId = null;
    this.host.requestRender();
    this.host.notify();
  }

  cloneLayer(layer: PhotoLayer): PhotoLayer {
    return {
      ...layer,
      params: { ...layer.params },
      filters: layer.filters.map((filter) => ({ ...filter, params: { ...filter.params } })),
      canvas: layer.canvas ? cloneCanvas(layer.canvas) : null,
    };
  }

  restoreLayerSet(layers: PhotoLayer[]): void {
    this.layerList = layers;
    if (
      layers.length > 0 &&
      (this.selectedId === null || !layers.some((layer) => layer.id === this.selectedId))
    ) {
      const sorted = [...layers].sort((a, b) => b.order - a.order);
      this.selectedId = sorted[0].id;
    }
    if (this.selectedId !== null && layers.length === 0) {
      this.selectedId = null;
    }
    for (const layer of layers) {
      if (layer.id >= this.autoIncrement) {
        this.autoIncrement = layer.id + 1;
      }
    }
    this.host.requestRender();
    this.host.notify();
  }

  getSelectionBounds(): SelectionBounds | null {
    return this.selectionBounds;
  }

  setSelectionInternal(bounds: SelectionBounds | null): void {
    this.selectionBounds = bounds;
    this.host.requestRender();
    this.host.notify();
  }

  // ---------- 绘制 ----------

  setCompositionBounds(width: number, height: number): void {
    this.compositionWidth = Math.max(1, width);
    this.compositionHeight = Math.max(1, height);
  }

  renderLayerObject(ctx: CanvasRenderingContext2D, layer: PhotoLayer): void {
    if (layer.type === "image") {
      if (layer.canvas) {
        ctx.translate(layer.x, layer.y);
        if (layer.rotate !== 0) {
          const centerX = (layer.width ?? layer.canvas.width) / 2;
          const centerY = (layer.height ?? layer.canvas.height) / 2;
          ctx.translate(centerX, centerY);
          ctx.rotate((layer.rotate * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }
        ctx.drawImage(layer.canvas, 0, 0);
      }
      return;
    }
    const renderer = layer.type ? rendererRegistry.get(layer.type) : null;
    if (renderer) {
      renderer(ctx, layer);
    }
  }

  renderSingleLayer(ctx: CanvasRenderingContext2D, layer: PhotoLayer): void {
    ctx.save();
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.composition;
    if (layer.filters.length > 0 && this.filterHook) {
      this.filterHook(ctx, layer, () => this.renderLayerObject(ctx, layer));
    } else {
      this.renderLayerObject(ctx, layer);
    }
    ctx.restore();
  }

  filterHook:
    | ((ctx: CanvasRenderingContext2D, layer: PhotoLayer, render: () => void) => void)
    | null = null;

  compositeToContext(
    ctx: CanvasRenderingContext2D,
    options?: { onlyLayerId?: number; includeHidden?: boolean },
  ): void {
    const sorted = this.getSortedLayers();
    for (const layer of sorted) {
      const onlyLayerId = options?.onlyLayerId;
      if (onlyLayerId !== undefined && layer.id !== onlyLayerId) {
        continue;
      }
      if (!layer.visible && layer.id !== onlyLayerId && !options?.includeHidden) {
        continue;
      }
      if (layer.composition === "source-atop") {
        const isolated = createCanvas(this.compositionWidth, this.compositionHeight);
        const isolatedCtx = isolated.getContext("2d");
        if (isolatedCtx) {
          isolatedCtx.save();
          isolatedCtx.globalAlpha = layer.opacity / 100;
          this.renderLayerObject(isolatedCtx, layer);
          isolatedCtx.restore();
          ctx.drawImage(isolated, 0, 0);
        }
        continue;
      }
      this.renderSingleLayer(ctx, layer);
    }
  }

  convertLayerToCanvas(layer: PhotoLayer, canTrim = false): HTMLCanvasElement {
    const canvasWidth = Math.max(1, Math.ceil(layer.width ?? this.compositionWidth));
    const canvasHeight = Math.max(1, Math.ceil(layer.height ?? this.compositionHeight));
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas;
    }
    ctx.translate(-layer.x, -layer.y);
    ctx.save();
    this.renderLayerObject(ctx, layer);
    ctx.restore();
    if (canTrim) {
      return trimCanvas(canvas) ?? canvas;
    }
    return canvas;
  }

  private nextOrder(): number {
    return this.layerList.reduce((max, layer) => Math.max(max, layer.order), 0) + 1;
  }
}

export function trimCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = source.getContext("2d");
  if (!ctx) {
    return null;
  }
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha !== 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) {
    return null;
  }
  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmed = createCanvas(trimmedWidth, trimmedHeight);
  trimmed.getContext("2d")?.drawImage(
    source,
    minX,
    minY,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight,
  );
  return trimmed;
}
