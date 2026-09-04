import type { PhotoEngine } from "../photo-engine";
import type { PhotoLayer } from "../types";
import { PrepareCanvasAction, UpdateConfigAction } from "../core/config-actions";
import { UpdateLayerAction } from "../core/layer-actions";
import { UpdateLayerImageAction } from "../core/image-actions";
import { BundleAction, type EngineAction } from "../core/action";
import { createCanvas, normalizeAngle } from "../lib/helpers";

export async function rotateLayer(engine: PhotoEngine, angleInput: number, canResizeCanvas = true): Promise<void> {
  const layer = engine.layers.getSelected();
  if (!layer) {
    return;
  }
  const angle = normalizeAngle(angleInput);
  const actions: EngineAction[] = [
    new UpdateLayerAction(engine.layers, layer.id, { rotate: angle }, "旋转图层"),
  ];
  if (canResizeCanvas) {
    actions.push(...computeRotationCanvasActions(engine, layer, angle));
  }
  await engine.doAction(new BundleAction("旋转图层", actions));
}

function computeRotationCanvasActions(
  engine: PhotoEngine,
  layer: PhotoLayer,
  angle: number,
): EngineAction[] {
  const width = layer.width ?? engine.config.width;
  const height = layer.height ?? engine.config.height;
  const rad = (angle * Math.PI) / 180;
  const newWidth = Math.ceil(Math.round((width * Math.abs(Math.cos(rad)) + height * Math.abs(Math.sin(rad))) * 1000) / 1000);
  const newHeight = Math.ceil(Math.round((width * Math.abs(Math.sin(rad)) + height * Math.abs(Math.cos(rad))) * 1000) / 1000);
  const config = engine.config;
  if (newWidth <= config.width && newHeight <= config.height) {
    return [];
  }
  let dx = 0;
  let dy = 0;
  let nextWidth = config.width;
  let nextHeight = config.height;
  if (newWidth > config.width) {
    dx = Math.ceil((newWidth - config.width) / 2);
    nextWidth = newWidth;
  }
  if (newHeight > config.height) {
    dy = Math.ceil((newHeight - config.height) / 2);
    nextHeight = newHeight;
  }
  return [
    new UpdateLayerAction(engine.layers, layer.id, { x: layer.x + dx, y: layer.y + dy }, "旋转图层"),
    new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "旋转扩展画布"),
    new PrepareCanvasAction(engine, nextWidth, nextHeight),
  ];
}

export async function rotateLayerQuick(engine: PhotoEngine, direction: "left" | "right"): Promise<void> {
  const layer = engine.layers.getSelected();
  if (!layer) {
    return;
  }
  const delta = direction === "left" ? -90 : 90;
  await rotateLayer(engine, layer.rotate + delta);
}

export async function flipLayer(engine: PhotoEngine, axis: "vertical" | "horizontal"): Promise<void> {
  const layer = engine.layers.getSelected();
  if (!layer || layer.type !== "image" || !layer.canvas) {
    throw new Error("该图层不包含位图，请先栅格化再翻转");
  }
  const source = engine.layers.convertLayerToCanvas(layer);
  const flipped = createCanvas(source.width, source.height);
  const ctx = flipped.getContext("2d");
  if (!ctx) {
    return;
  }
  if (axis === "vertical") {
    ctx.translate(0, flipped.height);
    ctx.scale(1, -1);
  } else {
    ctx.translate(flipped.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0);
  await engine.doAction(
    new UpdateLayerImageAction(engine.layers, layer.id, flipped, axis === "vertical" ? "垂直翻转图层" : "水平翻转图层"),
  );
}

export async function setCanvasSize(
  engine: PhotoEngine,
  width: number,
  height: number,
  options: { inProportion?: boolean } = {},
): Promise<void> {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  const actions: EngineAction[] = [
    new PrepareCanvasAction(engine, nextWidth, nextHeight),
    new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "调整画布尺寸"),
  ];
  if (options.inProportion) {
    const config = engine.config;
    const widthRatio = config.width / nextWidth;
    const heightRatio = config.height / nextHeight;
    for (const layer of engine.layers.getAllLayers()) {
      actions.push(
        new UpdateLayerAction(
          engine.layers,
          layer.id,
          {
            x: Math.round(layer.x / widthRatio),
            y: Math.round(layer.y / heightRatio),
          },
          "按比例调整图层位置",
        ),
      );
    }
  }
  await engine.doAction(new BundleAction("调整画布尺寸", actions));
}

export async function resizeImage(engine: PhotoEngine, width: number, height: number): Promise<void> {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  const config = engine.config;
  const scaleX = nextWidth / config.width;
  const scaleY = nextHeight / config.height;
  const actions: EngineAction[] = [];
  for (const layer of engine.layers.getAllLayers()) {
    if (layer.canvas) {
      const resized = await resizeCanvasHighQuality(layer.canvas, nextWidth, nextHeight);
      actions.push(
        new BundleAction("缩放图层", [
          new UpdateLayerAction(
            engine.layers,
            layer.id,
            {
              x: Math.round(layer.x * scaleX),
              y: Math.round(layer.y * scaleY),
              width: resized.width,
              height: resized.height,
              widthOriginal: resized.width,
              heightOriginal: resized.height,
            },
            "缩放图层",
          ),
          new UpdateLayerImageAction(engine.layers, layer.id, resized, "缩放图层"),
        ]),
      );
    } else {
      actions.push(
        new UpdateLayerAction(
          engine.layers,
          layer.id,
          {
            x: Math.round(layer.x * scaleX),
            y: Math.round(layer.y * scaleY),
            width: layer.width === null ? null : Math.round(layer.width * scaleX),
            height: layer.height === null ? null : Math.round(layer.height * scaleY),
          },
          "缩放图层",
        ),
      );
    }
  }
  actions.push(
    new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "缩放图像"),
    new PrepareCanvasAction(engine, nextWidth, nextHeight),
  );
  await engine.doAction(new BundleAction("缩放图像", actions));
}

export async function resizeCanvasHighQuality(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const target = createCanvas(width, height);
  const ratio = source.width / width;
  if (ratio <= 2) {
    const ctx = target.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, target.width, target.height);
    }
    return target;
  }
  const { default: pica } = await import("pica");
  const picaInstance = pica();
  await picaInstance.resize(source, target);
  return target;
}

export async function translateLayerTo(engine: PhotoEngine, x: number, y: number): Promise<void> {
  const layer = engine.layers.getSelected();
  if (!layer) {
    return;
  }
  await engine.doAction(
    new UpdateLayerAction(engine.layers, layer.id, { x: Math.round(x), y: Math.round(y) }, "平移图层"),
  );
}

export async function setLayerRotation(engine: PhotoEngine, angle: number): Promise<void> {
  const layer = engine.layers.getSelected();
  if (!layer) {
    return;
  }
  await engine.doAction(
    new UpdateLayerAction(engine.layers, layer.id, { rotate: normalizeAngle(angle) }, "调整图层角度"),
  );
}

interface TrimOptions {
  trimLayer: boolean;
  trimAll: boolean;
  power: number;
  removeWhite: boolean;
}

export async function trimImage(engine: PhotoEngine, options: TrimOptions): Promise<void> {
  if (options.trimLayer) {
    const layer = engine.layers.getSelected();
    if (layer && layer.type === "image") {
      const actions = computeTrimLayerActions(engine, layer, options);
      if (actions.length > 0) {
        await engine.doAction(new BundleAction("裁切图层", actions));
      }
    }
  }
  if (options.trimAll) {
    const actions = computeTrimAllActions(engine, options);
    if (actions.length > 0) {
      await engine.doAction(new BundleAction("裁切边界", actions));
    }
  }
}

function isPixelEmpty(data: Uint8ClampedArray, index: number, power: number, removeWhite: boolean): boolean {
  const alpha = data[index + 3];
  if (alpha <= power) {
    return true;
  }
  if (removeWhite) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    if (r > 255 - power && g > 255 - power && b > 255 - power) {
      return true;
    }
  }
  return false;
}

function computeTrimLayerActions(
  engine: PhotoEngine,
  layer: PhotoLayer,
  options: TrimOptions,
): EngineAction[] {
  const canvas = layer.canvas;
  if (!canvas) {
    return [];
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [];
  }
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!isPixelEmpty(data, index, options.power, options.removeWhite)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === width - 1 && maxY === height - 1)) {
    return [];
  }
  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmed = createCanvas(trimmedWidth, trimmedHeight);
  trimmed
    .getContext("2d")
    ?.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
  return [
    new UpdateLayerAction(
      engine.layers,
      layer.id,
      {
        x: layer.x + minX,
        y: layer.y + minY,
        width: trimmedWidth,
        height: trimmedHeight,
        widthOriginal: trimmedWidth,
        heightOriginal: trimmedHeight,
      },
      "裁切图层",
    ),
    new UpdateLayerImageAction(engine.layers, layer.id, trimmed, "裁切图层"),
  ];
}

function computeTrimAllActions(engine: PhotoEngine, options: TrimOptions): EngineAction[] {
  const config = engine.config;
  const probe = createCanvas(config.width, config.height);
  const ctx = probe.getContext("2d");
  if (!ctx) {
    return [];
  }
  engine.layers.compositeToContext(ctx);
  const data = ctx.getImageData(0, 0, probe.width, probe.height).data;
  let minX = probe.width;
  let minY = probe.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      const index = (y * probe.width + x) * 4;
      if (!isPixelEmpty(data, index, options.power, options.removeWhite)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === probe.width - 1 && maxY === probe.height - 1)) {
    return [];
  }
  const nextWidth = maxX - minX + 1;
  const nextHeight = maxY - minY + 1;
  const actions: EngineAction[] = [
    new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "裁切边界"),
    new PrepareCanvasAction(engine, nextWidth, nextHeight),
  ];
  for (const layer of engine.layers.getAllLayers()) {
    actions.push(
      new UpdateLayerAction(
        engine.layers,
        layer.id,
        { x: layer.x - minX, y: layer.y - minY },
        "裁切边界",
      ),
    );
  }
  return actions;
}

export async function cropToSelection(engine: PhotoEngine): Promise<void> {
  const selection = engine.selection.bounds;
  if (!selection || selection.width <= 0 || selection.height <= 0) {
    throw new Error("没有可用选区");
  }
  const actions: EngineAction[] = [
    new UpdateConfigAction(
      engine,
      { width: Math.round(selection.width), height: Math.round(selection.height) },
      "裁剪画布",
    ),
    new PrepareCanvasAction(engine, Math.round(selection.width), Math.round(selection.height)),
  ];
  for (const layer of engine.layers.getAllLayers()) {
    actions.push(
      new UpdateLayerAction(
        engine.layers,
        layer.id,
        { x: layer.x - Math.round(selection.x), y: layer.y - Math.round(selection.y) },
        "裁剪画布",
      ),
    );
  }
  await engine.doAction(new BundleAction("裁剪画布", actions));
}
