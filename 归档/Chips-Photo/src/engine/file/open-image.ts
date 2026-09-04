import type { PhotoEngine } from "../photo-engine";
import type { PhotoLayer } from "../types";
import { InsertLayerAction, UpdateLayerAction } from "../core/layer-actions";
import { UpdateConfigAction } from "../core/config-actions";
import { PrepareCanvasAction } from "../core/config-actions";
import { ResetLayersAction } from "../core/layer-actions";
import { UpdateLayerImageAction } from "../core/image-actions";
import { BundleAction, type EngineAction } from "../core/action";
import { createCanvas } from "../lib/helpers";

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图像加载失败"));
    image.src = src;
  });
}

export async function loadCanvasFromBlob(blob: Blob): Promise<HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const canvas = createCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    const dataUrl = await blobToDataUrl(blob);
    const image = await loadImageElement(dataUrl);
    const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return canvas;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图像数据失败"));
    reader.readAsDataURL(blob);
  });
}

export async function addImageLayerFromCanvas(
  engine: PhotoEngine,
  canvas: HTMLCanvasElement,
  name: string,
): Promise<number> {
  const config = engine.config;
  const actions: EngineAction[] = [];
  const needsResize = canvas.width > config.width || canvas.height > config.height;
  const isFirstContent = engine.layers.getAllLayers().length === 1 && engine.layers.isLayerEmpty(
    engine.layers.getAllLayers()[0]?.id ?? 0,
  );
  const nextWidth = needsResize ? Math.max(config.width, canvas.width) : config.width;
  const nextHeight = needsResize ? Math.max(config.height, canvas.height) : config.height;
  const layer: Partial<PhotoLayer> = {
    type: "image",
    name,
    x: Math.round((nextWidth - canvas.width) / 2),
    y: Math.round((nextHeight - canvas.height) / 2),
    width: canvas.width,
    height: canvas.height,
    widthOriginal: canvas.width,
    heightOriginal: canvas.height,
    canvas,
  };
  const insertAction = new InsertLayerAction(engine.layers, layer, "打开图像");
  actions.push(insertAction);
  if (needsResize) {
    actions.unshift(
      new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "打开图像"),
      new PrepareCanvasAction(engine, nextWidth, nextHeight),
    );
  }
  await engine.doAction(new BundleAction("打开图像", actions));
  void isFirstContent;
  return insertAction.getLayerId() ?? 0;
}

export async function openImageBlob(
  engine: PhotoEngine,
  blob: Blob,
  fileName: string,
): Promise<number> {
  const canvas = await loadCanvasFromBlob(blob);
  const name = fileName.replace(/\.[^.]+$/, "");
  return addImageLayerFromCanvas(engine, canvas, name);
}

export async function openImageDataUrl(
  engine: PhotoEngine,
  dataUrl: string,
  fileName: string,
): Promise<number> {
  const image = await loadImageElement(dataUrl);
  const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  const name = fileName.replace(/\.[^.]+$/, "");
  return addImageLayerFromCanvas(engine, canvas, name);
}

export async function newDocument(
  engine: PhotoEngine,
  width: number,
  height: number,
  background: "transparent" | "white",
): Promise<void> {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  const reset = new ResetLayersAction(engine.layers, false);
  const configAction = new UpdateConfigAction(engine, { width: nextWidth, height: nextHeight }, "新建图像");
  const prepareAction = new PrepareCanvasAction(engine, nextWidth, nextHeight);
  await engine.doAction(new BundleAction("新建图像", [reset, configAction, prepareAction]));
  const layer = engine.layers.insertInternal({ name: "背景" });
  if (background === "white") {
    const canvas = createCanvas(nextWidth, nextHeight);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, nextWidth, nextHeight);
    }
    await engine.doAction(
      new BundleAction("新建图像", [
        new UpdateLayerAction(engine.layers, layer.id, { type: "image", width: nextWidth, height: nextHeight }, "新建图像"),
        new UpdateLayerImageAction(engine.layers, layer.id, canvas, "新建图像"),
      ]),
    );
  } else {
    engine.layers.removeInternal(layer.id);
  }
  engine.zoomAuto();
}
