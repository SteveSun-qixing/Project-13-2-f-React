import type { PhotoEngine } from "../photo-engine";
import type { PhotoLayer } from "../types";
import { InsertLayerAction, UpdateLayerAction, DeleteLayerAction, ReorderLayerAction, SelectLayerAction, ToggleLayerVisibilityAction, ClearLayerAction } from "../core/layer-actions";
import { UpdateLayerImageAction, RasterizeLayerAction } from "../core/image-actions";
import { BundleAction } from "../core/action";
import { createCanvas } from "../lib/helpers";

export async function newLayer(
  engine: PhotoEngine,
  settings: Partial<PhotoLayer> = {},
  description = "新建图层",
): Promise<number> {
  const action = new InsertLayerAction(engine.layers, settings, description);
  await engine.doAction(action);
  return action.getLayerId() ?? 0;
}

export async function newLayerFromSelection(engine: PhotoEngine): Promise<void> {
  const selection = engine.selection.bounds;
  if (!selection || selection.width <= 0 || selection.height <= 0) {
    throw new Error("没有可用选区");
  }
  const canvas = createCanvas(selection.width, selection.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.translate(-selection.x, -selection.y);
  engine.layers.compositeToContext(ctx);
  const layer = await newLayer(
    engine,
    {
      type: "image",
      x: Math.round(selection.x),
      y: Math.round(selection.y),
      width: canvas.width,
      height: canvas.height,
      canvas,
    },
    "新建自选区",
  );
  void layer;
}

export async function duplicateLayer(engine: PhotoEngine): Promise<void> {
  const source = engine.layers.getSelected();
  if (!source) {
    return;
  }
  const clone = engine.layers.cloneLayer(source);
  clone.id = 0;
  clone.name = `${source.name} 副本`;
  const action = new InsertLayerAction(engine.layers, clone, "复制图层");
  await engine.doAction(action);
}

export async function deleteLayer(engine: PhotoEngine, layerId?: number): Promise<void> {
  const id = layerId ?? engine.layers.getSelectedId();
  if (id === null) {
    return;
  }
  if (engine.layers.getAllLayers().length <= 1) {
    await clearLayer(engine, id);
    return;
  }
  await engine.doAction(new DeleteLayerAction(engine.layers, id));
}

export async function clearLayer(engine: PhotoEngine, layerId?: number): Promise<void> {
  const id = layerId ?? engine.layers.getSelectedId();
  if (id === null) {
    return;
  }
  await engine.doAction(new ClearLayerAction(engine.layers, id));
}

export async function toggleLayerVisibility(engine: PhotoEngine, layerId?: number): Promise<void> {
  const id = layerId ?? engine.layers.getSelectedId();
  if (id === null) {
    return;
  }
  await engine.doAction(new ToggleLayerVisibilityAction(engine.layers, id));
}

export async function renameLayer(engine: PhotoEngine, layerId: number, name: string): Promise<void> {
  await engine.doAction(
    new UpdateLayerAction(engine.layers, layerId, { name }, "重命名图层"),
  );
}

export async function moveLayer(engine: PhotoEngine, direction: "up" | "down"): Promise<void> {
  const id = engine.layers.getSelectedId();
  if (id === null) {
    return;
  }
  const action = new ReorderLayerAction(engine.layers, id, direction);
  try {
    await engine.doAction(action);
  } catch {
    return;
  }
}

export async function selectLayer(engine: PhotoEngine, layerId: number): Promise<void> {
  if (engine.layers.getSelectedId() === layerId) {
    return;
  }
  await engine.doAction(new SelectLayerAction(engine.layers, layerId));
}

export async function setLayerOpacity(engine: PhotoEngine, layerId: number, opacity: number): Promise<void> {
  await engine.doAction(
    new UpdateLayerAction(engine.layers, layerId, { opacity: Math.round(opacity) }, "调整图层不透明度"),
  );
}

export async function setLayerComposition(
  engine: PhotoEngine,
  layerId: number,
  composition: GlobalCompositeOperation,
): Promise<void> {
  await engine.doAction(
    new UpdateLayerAction(engine.layers, layerId, { composition }, "调整图层混合模式"),
  );
}

export async function rasterizeLayer(engine: PhotoEngine, layerId?: number): Promise<void> {
  const id = layerId ?? engine.layers.getSelectedId();
  const layer = id === null ? null : engine.layers.getLayer(id);
  if (!layer || !layer.type || layer.type === "image") {
    return;
  }
  await engine.doAction(
    new RasterizeLayerAction(engine.layers, layer.id, (target) =>
      engine.layers.convertLayerToCanvas(target),
    ),
  );
}

export async function mergeDown(engine: PhotoEngine): Promise<void> {
  const selected = engine.layers.getSelected();
  if (!selected) {
    return;
  }
  const sorted = engine.layers.getSortedLayers();
  const index = sorted.findIndex((layer) => layer.id === selected.id);
  const below = sorted[index + 1];
  if (!below) {
    return;
  }
  const mergedCanvas = createCanvas(engine.config.width, engine.config.height);
  const ctx = mergedCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = below.opacity / 100;
  engine.layers.renderLayerObject(ctx, below);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = selected.opacity / 100;
  ctx.globalCompositeOperation = selected.composition === "source-atop" ? "source-over" : selected.composition;
  engine.layers.renderLayerObject(ctx, selected);
  ctx.restore();

  const belowUpdate = new UpdateLayerAction(
    engine.layers,
    below.id,
    { type: "image", data: null, isVector: false, composition: "source-over", opacity: 100 },
    "向下合并",
  );
  const belowImage = new UpdateLayerImageAction(engine.layers, below.id, mergedCanvas, "向下合并");
  const deleteTop = new DeleteLayerAction(engine.layers, selected.id);
  await engine.doAction(
    new BundleAction("向下合并图层", [belowUpdate, belowImage, deleteTop]),
  );
}

export async function flattenImage(engine: PhotoEngine): Promise<void> {
  const canvas = createCanvas(engine.config.width, engine.config.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  engine.layers.compositeToContext(ctx);
  const bottom = engine.layers.getAllLayers().reduce(
    (lowest, layer) => (lowest === null || layer.order < lowest.order ? layer : lowest),
    null as PhotoLayer | null,
  );
  if (!bottom) {
    return;
  }
  const actions = engine.layers.getAllLayers().map((layer) => layer.id);
  const updateBottom = new UpdateLayerAction(
    engine.layers,
    bottom.id,
    {
      type: "image",
      data: null,
      isVector: false,
      x: 0,
      y: 0,
      opacity: 100,
      composition: "source-over",
      rotate: 0,
      width: canvas.width,
      height: canvas.height,
    },
    "拼合图像",
  );
  const bottomImage = new UpdateLayerImageAction(engine.layers, bottom.id, canvas, "拼合图像");
  const deletes = engine.layers
    .getAllLayers()
    .filter((layer) => layer.id !== bottom.id)
    .map((layer) => new DeleteLayerAction(engine.layers, layer.id));
  void actions;
  await engine.doAction(new BundleAction("拼合图像", [updateBottom, bottomImage, ...deletes]));
}

export async function differencesDown(engine: PhotoEngine): Promise<void> {
  const selected = engine.layers.getSelected();
  if (!selected) {
    return;
  }
  const sorted = engine.layers.getSortedLayers();
  const index = sorted.findIndex((layer) => layer.id === selected.id);
  const below = sorted[index + 1];
  if (!below) {
    return;
  }
  const mergedCanvas = createCanvas(engine.config.width, engine.config.height);
  const ctx = mergedCanvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = below.opacity / 100;
  engine.layers.renderLayerObject(ctx, below);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = selected.opacity / 100;
  ctx.globalCompositeOperation = "difference";
  engine.layers.renderLayerObject(ctx, selected);
  ctx.restore();
  const belowUpdate = new UpdateLayerAction(
    engine.layers,
    below.id,
    { type: "image", data: null, isVector: false, composition: "source-over", opacity: 100 },
    "与下图层求差",
  );
  const belowImage = new UpdateLayerImageAction(engine.layers, below.id, mergedCanvas, "与下图层求差");
  const deleteTop = new DeleteLayerAction(engine.layers, selected.id);
  await engine.doAction(
    new BundleAction("与下图层求差", [belowUpdate, belowImage, deleteTop]),
  );
}
