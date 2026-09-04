import type { PhotoLayer } from "../types";
import { cloneCanvas, createCanvas } from "../lib/helpers";
import type { EngineAction } from "./action";
import type { LayerActionHost } from "./layer-actions";

export class UpdateLayerImageAction implements EngineAction {
  readonly id = "update-layer-image";
  readonly description: string;
  memoryEstimate = 0;
  private previousCanvas: HTMLCanvasElement | null = null;
  private previousWidth: number | null = null;
  private previousHeight: number | null = null;
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly canvas: HTMLCanvasElement,
    description = "更新图层图像",
  ) {
    this.description = description;
    this.memoryEstimate = canvas.width * canvas.height * 4;
  }

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previousCanvas = layer.canvas ? cloneCanvas(layer.canvas) : null;
    this.previousWidth = layer.width;
    this.previousHeight = layer.height;
    const next = cloneCanvas(this.canvas);
    this.host.setLayerCanvas(this.layerId, next);
    this.host.applySettings(this.layerId, {
      type: layer.type ?? "image",
      width: next.width,
      height: next.height,
      widthOriginal: layer.widthOriginal ?? next.width,
      heightOriginal: layer.heightOriginal ?? next.height,
    });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    this.host.setLayerCanvas(this.layerId, this.previousCanvas);
    this.host.applySettings(this.layerId, {
      width: this.previousWidth,
      height: this.previousHeight,
    });
  }

  free(): void {
    if (this.previousCanvas) {
      const freed = this.previousCanvas;
      freed.width = 1;
      freed.height = 1;
      this.previousCanvas = null;
    }
  }
}

export class RasterizeLayerAction implements EngineAction {
  readonly id = "rasterize-layer";
  readonly description = "栅格化图层";
  memoryEstimate = 0;
  private previousType: PhotoLayer["type"] = null;
  private previousData: unknown = null;
  private previousCanvas: HTMLCanvasElement | null = null;
  private previousWidth: number | null = null;
  private previousHeight: number | null = null;
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly rasterCanvasProvider: (layer: PhotoLayer) => HTMLCanvasElement,
  ) {}

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previousType = layer.type;
    this.previousData = layer.data;
    this.previousCanvas = layer.canvas;
    this.previousWidth = layer.width;
    this.previousHeight = layer.height;
    const rasterCanvas = this.rasterCanvasProvider(layer);
    this.host.setLayerCanvas(this.layerId, rasterCanvas);
    this.host.applySettings(this.layerId, {
      type: "image",
      data: null,
      isVector: false,
      width: rasterCanvas.width,
      height: rasterCanvas.height,
    });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    this.host.setLayerCanvas(this.layerId, this.previousCanvas);
    this.host.applySettings(this.layerId, {
      type: this.previousType,
      data: this.previousData,
      isVector: this.previousType !== null && this.previousType !== "image",
      width: this.previousWidth,
      height: this.previousHeight,
    });
  }
}

export class ResizeLayerImageAction implements EngineAction {
  readonly id = "resize-layer-image";
  readonly description: string;
  memoryEstimate = 0;
  private previousCanvas: HTMLCanvasElement | null = null;
  private previousWidth: number | null = null;
  private previousHeight: number | null = null;
  private previousX = 0;
  private previousY = 0;
  private executed = false;

  constructor(
    private readonly host: LayerActionHost,
    private readonly layerId: number,
    private readonly targetWidth: number,
    private readonly targetHeight: number,
    description = "缩放图层",
  ) {
    this.description = description;
  }

  do(): void {
    const layer = this.host.getLayer(this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    const source = layer.canvas;
    if (!source) {
      throw new Error("图层没有位图可缩放");
    }
    this.previousCanvas = source;
    this.previousWidth = layer.width;
    this.previousHeight = layer.height;
    this.previousX = layer.x;
    this.previousY = layer.y;
    const resized = createCanvas(this.targetWidth, this.targetHeight);
    const ctx = resized.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, resized.width, resized.height);
    }
    this.host.setLayerCanvas(this.layerId, resized);
    this.host.applySettings(this.layerId, {
      width: resized.width,
      height: resized.height,
      widthOriginal: resized.width,
      heightOriginal: resized.height,
    });
    this.executed = true;
    this.memoryEstimate = resized.width * resized.height * 4;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    this.host.setLayerCanvas(this.layerId, this.previousCanvas);
    this.host.applySettings(this.layerId, {
      width: this.previousWidth,
      height: this.previousHeight,
      x: this.previousX,
      y: this.previousY,
    });
  }
}
