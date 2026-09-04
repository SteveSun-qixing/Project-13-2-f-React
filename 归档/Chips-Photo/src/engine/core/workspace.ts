import type { Guide } from "../types";
import type { PhotoEngine } from "../photo-engine";
import { createCanvas } from "../lib/helpers";

export interface RenderTargetSize {
  width: number;
  height: number;
}

export class WorkspaceRenderer {
  private mainCanvas: HTMLCanvasElement | null = null;
  private previewCanvas: HTMLCanvasElement | null = null;
  private viewportSize: RenderTargetSize = { width: 0, height: 0 };
  private frameHandle: number | null = null;
  private needRender = true;

  constructor(private readonly engine: PhotoEngine) {}

  attachCanvas(canvas: HTMLCanvasElement, viewportWidth: number, viewportHeight: number): void {
    this.mainCanvas = canvas;
    this.resizeViewport(viewportWidth, viewportHeight);
    this.startLoop();
  }

  detachCanvas(): void {
    this.mainCanvas = null;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  attachPreviewCanvas(canvas: HTMLCanvasElement): void {
    this.previewCanvas = canvas;
    this.requestRender();
  }

  detachPreviewCanvas(): void {
    this.previewCanvas = null;
  }

  resizeViewport(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (this.viewportSize.width === nextWidth && this.viewportSize.height === nextHeight) {
      return;
    }
    this.viewportSize = { width: nextWidth, height: nextHeight };
    if (this.mainCanvas) {
      this.mainCanvas.width = Math.round(nextWidth * dpr);
      this.mainCanvas.height = Math.round(nextHeight * dpr);
      this.mainCanvas.style.width = `${nextWidth}px`;
      this.mainCanvas.style.height = `${nextHeight}px`;
    }
    this.requestRender();
  }

  getViewportSize(): RenderTargetSize {
    return { ...this.viewportSize };
  }

  requestRender(): void {
    this.needRender = true;
  }

  renderNow(): void {
    this.render();
  }

  zoomAuto(): void {
    const { width, height } = this.engine.config;
    if (this.viewportSize.width <= 0 || this.viewportSize.height <= 0 || width <= 0 || height <= 0) {
      return;
    }
    const margin = 48;
    const availableWidth = Math.max(1, this.viewportSize.width - margin * 2);
    const availableHeight = Math.max(1, this.viewportSize.height - margin * 2);
    const zoom = Math.min(availableWidth / width, availableHeight / height);
    const clamped = Math.min(zoom, 1) > 1 ? 1 : zoom;
    this.engine.setZoom(clamped);
    this.centerCanvas();
  }

  centerCanvas(): void {
    const { width, height } = this.engine.config;
    const zoom = this.engine.zoomView.getZoom();
    const panX = (this.viewportSize.width - width * zoom) / 2;
    const panY = (this.viewportSize.height - height * zoom) / 2;
    this.engine.zoomView.setPan(panX, panY);
    this.engine.requestRender();
  }

  private startLoop(): void {
    if (this.frameHandle !== null) {
      return;
    }
    const loop = () => {
      if (this.needRender) {
        this.needRender = false;
        this.render();
      }
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  private render(): void {
    const canvas = this.mainCanvas;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.engine.config;
    const zoomView = this.engine.zoomView;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    zoomView.apply(ctx, dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    this.engine.layers.setCompositionBounds(width, height);
    this.engine.layers.compositeToContext(ctx);

    if (this.engine.gridVisible) {
      this.drawGrid(ctx, width, height);
    }
    this.drawGuides(ctx);
    this.engine.selection.drawOverlay(ctx);
    const activeTool = this.engine.getActiveTool();
    if (activeTool?.renderOverlay) {
      ctx.save();
      activeTool.renderOverlay(ctx);
      ctx.restore();
    }
    ctx.restore();

    this.drawCanvasOutline(ctx, width, height);
    this.renderPreview();
    this.engine.notifyAfterRender();
  }

  private drawCanvasOutline(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    const zoomView = this.engine.zoomView;
    const zoom = zoomView.getZoom();
    const pan = zoomView.getPan();
    const x = Math.round(pan.x * dpr) + 0.5;
    const y = Math.round(pan.y * dpr) + 0.5;
    const w = width * zoom * dpr;
    const h = height * zoom * dpr;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const zoom = this.engine.zoomView.getZoom();
    let step = 50;
    while (step * zoom < 12) {
      step *= 2;
    }
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    for (let x = step; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
    ctx.beginPath();
    for (let x = step * 5; x < width; x += step * 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = step * 5; y < height; y += step * 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawGuides(ctx: CanvasRenderingContext2D): void {
    const guides = this.engine.guides;
    if (guides.length === 0) {
      return;
    }
    const zoom = this.engine.zoomView.getZoom();
    const { width, height } = this.engine.config;
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    for (const guide of guides) {
      ctx.strokeStyle = "rgba(10, 132, 255, 0.65)";
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.moveTo(guide.position, 0);
        ctx.lineTo(guide.position, height);
      } else {
        ctx.moveTo(0, guide.position);
        ctx.lineTo(width, guide.position);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderPreview(): void {
    const preview = this.previewCanvas;
    if (!preview) {
      return;
    }
    const ctx = preview.getContext("2d");
    if (!ctx) {
      return;
    }
    const { width, height } = this.engine.config;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, preview.width, preview.height);
    if (width <= 0 || height <= 0) {
      return;
    }
    const scale = Math.min(preview.width / dpr / width, preview.height / dpr / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const offsetX = (preview.width / dpr - drawWidth) / 2;
    const offsetY = (preview.height / dpr - drawHeight) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(
      this.compositePreviewSource(width, height),
      0,
      0,
      width,
      height,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
    );
    ctx.strokeStyle = "rgba(10, 132, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, drawWidth, drawHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private previewSource: HTMLCanvasElement | null = null;

  private compositePreviewSource(width: number, height: number): HTMLCanvasElement {
    if (
      !this.previewSource ||
      this.previewSource.width !== width ||
      this.previewSource.height !== height
    ) {
      this.previewSource = createCanvas(width, height);
    }
    const ctx = this.previewSource.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      this.engine.layers.compositeToContext(ctx);
    }
    return this.previewSource;
  }
}

export function drawRulerStrip(
  ctx: CanvasRenderingContext2D,
  options: {
    length: number;
    thickness: number;
    zoom: number;
    pan: number;
    axis: "x" | "y";
    dpr: number;
  },
): void {
  const { length, thickness, zoom, pan, axis, dpr } = options;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#f5f5f7";
  ctx.fillRect(0, 0, axis === "x" ? length : thickness, axis === "x" ? thickness : length);
  ctx.fillStyle = "#6e6e73";
  ctx.font = "9px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
  let step = 10;
  while (step * zoom < 8) {
    step *= 5;
  }
  const majorEvery = step * 5 < 8 * 5 ? step * 5 : step * 5;
  const startWorld = Math.floor(-pan / zoom / step) * step;
  const endWorld = (length - pan) / zoom;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  for (let world = startWorld; world <= endWorld; world += step) {
    const screen = world * zoom + pan;
    const isMajor = Math.abs(world % majorEvery) < 1e-6;
    const tick = isMajor ? thickness * 0.6 : thickness * 0.3;
    if (axis === "x") {
      ctx.moveTo(Math.round(screen) + 0.5, thickness - tick);
      ctx.lineTo(Math.round(screen) + 0.5, thickness);
    } else {
      ctx.moveTo(thickness - tick, Math.round(screen) + 0.5);
      ctx.lineTo(thickness, Math.round(screen) + 0.5);
    }
    if (isMajor) {
      if (axis === "x") {
        ctx.fillText(String(world), screen + 2, 8);
      } else {
        ctx.save();
        ctx.translate(8, screen - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(world), 0, 0);
        ctx.restore();
      }
    }
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  if (axis === "x") {
    ctx.moveTo(0, thickness - 0.5);
    ctx.lineTo(length, thickness - 0.5);
  } else {
    ctx.moveTo(thickness - 0.5, 0);
    ctx.lineTo(thickness - 0.5, length);
  }
  ctx.stroke();
}

export function guideFromEvent(
  guides: Guide[],
  axis: "x" | "y",
  position: number,
): Guide | null {
  return guides.find((guide) => guide.axis === axis && Math.abs(guide.position - position) < 4) ?? null;
}
