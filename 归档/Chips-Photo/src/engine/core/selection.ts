import type { PhotoLayer, SelectionBounds } from "../types";
import type { ZoomView } from "./zoom-view";

export interface SelectionHost {
  requestRender(): void;
  notify(): void;
}

export class SelectionManager {
  bounds: SelectionBounds | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private readonly host: SelectionHost,
    private readonly zoomView: ZoomView,
  ) {}

  setBounds(bounds: SelectionBounds | null): void {
    this.bounds = bounds;
    this.host.requestRender();
    this.host.notify();
  }

  selectAll(width: number, height: number): void {
    this.setBounds({ x: 0, y: 0, width, height });
  }

  clear(): void {
    this.setBounds(null);
  }

  isActive(): boolean {
    return this.bounds !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.bounds) {
      return;
    }
    const { x, y, width, height } = this.bounds;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(10, 132, 255, 0.12)";
    ctx.fillRect(x, y, width, height);
    ctx.lineWidth = 1 / this.zoomView.getScale();
    ctx.strokeStyle = "#0a84ff";
    ctx.setLineDash([6 / this.zoomView.getScale(), 4 / this.zoomView.getScale()]);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  intersectsLayer(layer: PhotoLayer): boolean {
    if (!this.bounds) {
      return true;
    }
    if (layer.width === null || layer.height === null) {
      return true;
    }
    const layerRight = layer.x + layer.width;
    const layerBottom = layer.y + layer.height;
    const selectionRight = this.bounds.x + this.bounds.width;
    const selectionBottom = this.bounds.y + this.bounds.height;
    return (
      layer.x < selectionRight &&
      layerRight > this.bounds.x &&
      layer.y < selectionBottom &&
      layerBottom > this.bounds.y
    );
  }
}
