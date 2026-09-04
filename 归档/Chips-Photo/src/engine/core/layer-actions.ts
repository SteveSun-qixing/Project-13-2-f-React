import type { LayerFilter, PhotoLayer, SelectionBounds } from "../types";
import type { EngineAction } from "./action";

export interface LayerActionHost {
  insertInternal(settings: Partial<PhotoLayer>): PhotoLayer;
  removeInternal(id: number): void;
  restoreInternal(layer: PhotoLayer, index: number): void;
  getLayer(id: number): PhotoLayer | null;
  indexOf(id: number): number;
  applySettings(id: number, settings: Partial<PhotoLayer>): void;
  getSelectedId(): number | null;
  selectInternal(id: number | null): void;
  setOrder(id: number, order: number): void;
  sortedOrders(): number[];
  idByOrder(order: number): number | null;
  setLayerCanvas(id: number, canvas: HTMLCanvasElement | null): void;
  getAllLayers(): PhotoLayer[];
  clearAllInternal(): void;
  cloneLayer(layer: PhotoLayer): PhotoLayer;
  restoreLayerSet(layers: PhotoLayer[]): void;
  readonly autoIncrementValue: number;
  setAutoIncrement(value: number): void;
  nextFilterId(): number;
  getSelectionBounds(): SelectionBounds | null;
  setSelectionInternal(bounds: SelectionBounds | null): void;
}

export class InsertLayerAction implements EngineAction {
  readonly id = "insert-layer";
  readonly description: string;
  memoryEstimate = 0;
  private insertedLayer: PhotoLayer | null = null;

  constructor(
    private readonly host: LayerActionHost,
    private readonly settings: Partial<PhotoLayer>,
    description = "新建图层",
  ) {
    this.description = description;
  }

  getLayerId(): number | null {
    return this.insertedLayer?.id ?? null;
  }

  do(): void {
    this.insertedLayer = this.host.insertInternal(this.settings);
  }

  undo(): void {
    if (this.insertedLayer) {
      this.host.removeInternal(this.insertedLayer.id);
    }
  }

  free(): void {
    if (this.insertedLayer) {
      this.insertedLayer.canvas = null;
    }
  }
}

export class DeleteLayerAction implements EngineAction {
  readonly id = "delete-layer";
  readonly description: string;
  memoryEstimate = 0;
  private snapshot: PhotoLayer | null = null;
  private snapshotIndex = 0;
  private wasSelected = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
  ) {
    this.description = "删除图层";
  }

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.snapshot = layer;
    this.snapshotIndex = this.host.indexOf(this.layerId);
    this.wasSelected = this.host.getSelectedId() === this.layerId;
    this.host.removeInternal(this.layerId);
    if (this.wasSelected) {
      const remaining = this.host.getAllLayers();
      const next = remaining.find((item) => item.order < layer.order) ?? remaining[0] ?? null;
      this.host.selectInternal(next ? next.id : null);
    }
  }

  undo(): void {
    if (this.snapshot) {
      this.host.restoreInternal(this.snapshot, this.snapshotIndex);
      if (this.wasSelected) {
        this.host.selectInternal(this.layerId);
      }
    }
  }

  free(): void {
    if (this.snapshot) {
      this.snapshot.canvas = null;
    }
  }
}

export class UpdateLayerAction implements EngineAction {
  readonly id = "update-layer";
  readonly description: string;
  memoryEstimate = 0;
  private previous: Partial<PhotoLayer> = {};
  private executed = false;

  constructor(
    protected readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly settings: Partial<PhotoLayer>,
    description = "更新图层",
  ) {
    this.description = description;
  }

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previous = {};
    for (const key of Object.keys(this.settings) as Array<keyof PhotoLayer>) {
      this.previous[key] = layer[key] as never;
    }
    this.host.applySettings(this.layerId, this.settings);
    this.executed = true;
  }

  undo(): void {
    if (this.executed) {
      this.host.applySettings(this.layerId, this.previous);
    }
  }
}

export class ReorderLayerAction implements EngineAction {
  readonly id = "reorder-layer";
  readonly description: string;
  memoryEstimate = 0;
  private previousOrders = new Map<number, number>();
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly direction: "up" | "down",
  ) {
    this.description = direction === "up" ? "图层上移" : "图层下移";
  }

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    const sorted = this.host.sortedOrders();
    const currentIndex = sorted.indexOf(layer.order);
    const targetIndex = this.direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      throw new Error("图层已到边界");
    }
    this.previousOrders = new Map(this.host.getAllLayers().map((item) => [item.id, item.order]));
    const neighborId = this.host.idByOrder(sorted[targetIndex]);
    if (neighborId === null) {
      throw new Error("未找到相邻图层");
    }
    this.host.setOrder(this.layerId, sorted[targetIndex]);
    this.host.setOrder(neighborId, sorted[currentIndex]);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const [id, order] of this.previousOrders) {
      this.host.setOrder(id, order);
    }
  }
}

export class SelectLayerAction implements EngineAction {
  readonly id = "select-layer";
  readonly description = "选择图层";
  memoryEstimate = 0;
  private previousId: number | null = null;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
  ) {}

  do(): void {
    this.previousId = this.host.getSelectedId();
    this.host.selectInternal(this.layerId);
  }

  undo(): void {
    this.host.selectInternal(this.previousId);
  }
}

export class ToggleLayerVisibilityAction implements EngineAction {
  readonly id = "toggle-layer-visibility";
  readonly description = "切换图层可见性";
  memoryEstimate = 0;
  private previous = true;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
  ) {}

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previous = layer.visible;
    this.host.applySettings(this.layerId, { visible: !layer.visible });
  }

  undo(): void {
    this.host.applySettings(this.layerId, { visible: this.previous });
  }
}

export class ClearLayerAction implements EngineAction {
  readonly id = "clear-layer";
  readonly description = "清空图层";
  memoryEstimate = 0;
  private previousType: PhotoLayer["type"] = null;
  private previousData: unknown = null;
  private previousColor: string | null = null;
  private previousCanvas: HTMLCanvasElement | null = null;
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
  ) {}

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previousType = layer.type;
    this.previousData = layer.data;
    this.previousColor = layer.color;
    this.previousCanvas = layer.canvas;
    this.host.applySettings(this.layerId, { data: null, type: null, color: null });
    this.host.setLayerCanvas(this.layerId, null);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    this.host.applySettings(this.layerId, {
      type: this.previousType,
      data: this.previousData,
      color: this.previousColor,
    });
    this.host.setLayerCanvas(this.layerId, this.previousCanvas);
  }
}

export class ResetLayersAction implements EngineAction {
  readonly id = "reset-layers";
  readonly description = "重置图层";
  memoryEstimate = 0;
  private previous: PhotoLayer[] = [];
  private previousSelectedId: number | null = null;

  constructor(
    private readonly host: LayerActionHost,
    private readonly autoInsert: boolean,
  ) {}

  do(): void {
    this.previous = this.host.getAllLayers().map((layer) => this.host.cloneLayer(layer));
    this.previousSelectedId = this.host.getSelectedId();
    const previousAutoIncrement = this.host.autoIncrementValue;
    this.host.clearAllInternal();
    if (this.autoInsert) {
      this.host.insertInternal({ name: "图层 1" });
    }
    this.host.setAutoIncrement(previousAutoIncrement);
  }

  undo(): void {
    this.host.clearAllInternal();
    this.host.restoreLayerSet(this.previous);
    this.host.selectInternal(this.previousSelectedId);
  }

  free(): void {
    for (const layer of this.previous) {
      layer.canvas = null;
    }
  }
}

export class SetSelectionAction implements EngineAction {
  readonly id = "set-selection";
  readonly description = "设置选区";
  memoryEstimate = 0;
  private previous: SelectionBounds | null = null;

  constructor(
    private readonly host: LayerActionHost,
    private readonly bounds: SelectionBounds | null,
  ) {}

  do(): void {
    this.previous = this.host.getSelectionBounds();
    this.host.setSelectionInternal(this.bounds);
  }

  undo(): void {
    this.host.setSelectionInternal(this.previous);
  }
}

export class AddLayerFilterAction implements EngineAction {
  readonly id = "add-layer-filter";
  readonly description: string;
  memoryEstimate = 0;
  private filterId = 0;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly filterTitle: string,
    private readonly params: Record<string, number | string | boolean>,
  ) {
    this.description = `添加滤镜：${filterTitle}`;
  }

  do(): void {
    this.filterId = this.host.nextFilterId();
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    const filter: LayerFilter = {
      id: this.filterId,
      name: this.filterTitle,
      params: { ...this.params },
    };
    this.host.applySettings(this.layerId, { filters: [...layer.filters, filter] });
  }

  undo(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      return;
    }
    this.host.applySettings(this.layerId, {
      filters: layer.filters.filter((item) => item.id !== this.filterId),
    });
  }
}

export class DeleteLayerFilterAction implements EngineAction {
  readonly id = "delete-layer-filter";
  readonly description = "删除图层滤镜";
  memoryEstimate = 0;
  private removed: { index: number; filter: LayerFilter } | null = null;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly filterId: number,
  ) {}

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    const index = layer.filters.findIndex((item) => item.id === this.filterId);
    if (index < 0) {
      throw new Error(`滤镜不存在：${this.filterId}`);
    }
    this.removed = { index, filter: { ...layer.filters[index] } };
    this.host.applySettings(this.layerId, {
      filters: layer.filters.filter((item) => item.id !== this.filterId),
    });
  }

  undo(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer || !this.removed) {
      return;
    }
    const filters = [...layer.filters];
    filters.splice(this.removed.index, 0, this.removed.filter);
    this.host.applySettings(this.layerId, { filters });
  }
}

export class UpdateLayerFilterAction implements EngineAction {
  readonly id = "update-layer-filter";
  readonly description = "更新图层滤镜";
  memoryEstimate = 0;
  private previousParams: Record<string, number | string | boolean> | null = null;
  private previousDisabled: boolean | undefined = undefined;
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly filterId: number,
    private readonly params: Partial<Record<string, number | string | boolean>>,
    private readonly disabled?: boolean,
  ) {}

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    const filter = layer.filters.find((item) => item.id === this.filterId);
    if (!filter) {
      throw new Error(`滤镜不存在：${this.filterId}`);
    }
    this.previousParams = { ...filter.params };
    this.previousDisabled = filter.disabled;
    const mergedParams: Record<string, number | string | boolean> = { ...filter.params };
    for (const [key, value] of Object.entries(this.params)) {
      if (value !== undefined) {
        mergedParams[key] = value;
      }
    }
    this.host.applySettings(this.layerId, {
      filters: layer.filters.map((item) =>
        item.id === this.filterId
          ? {
              ...item,
              params: mergedParams,
              disabled: this.disabled ?? item.disabled,
            }
          : item,
      ),
    });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed || !this.previousParams) {
      return;
    }
    const previousParams: Record<string, number | string | boolean> = { ...this.previousParams };
    const previousDisabled = this.previousDisabled;
    this.host.applySettings(this.layerId, {
      filters: (this.host.getLayer(this.layerId)?.filters ?? []).map((item) =>
        item.id === this.filterId
          ? { ...item, params: previousParams, disabled: previousDisabled }
          : item,
      ),
    });
  }
}
