import { clampZoom } from "./zoom-limits";

export interface Point {
  x: number;
  y: number;
}

export class ZoomView {
  private zoomValue = 1;
  private panX = 0;
  private panY = 0;
  private listeners = new Set<() => void>();

  reset(): void {
    this.zoomValue = 1;
    this.panX = 0;
    this.panY = 0;
    this.notify();
  }

  getZoom(): number {
    return this.zoomValue;
  }

  getPan(): Point {
    return { x: this.panX, y: this.panY };
  }

  setZoom(zoom: number): void {
    this.zoomValue = clampZoom(zoom);
    this.notify();
  }

  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
    this.notify();
  }

  getState(): { zoom: number; panX: number; panY: number } {
    return { zoom: this.zoomValue, panX: this.panX, panY: this.panY };
  }

  setState(zoom: number, panX: number, panY: number): void {
    this.zoomValue = clampZoom(zoom);
    this.panX = panX;
    this.panY = panY;
    this.notify();
  }

  scaleAt(screenX: number, screenY: number, factor: number): void {
    const world = this.toWorld(screenX, screenY);
    const nextZoom = clampZoom(this.zoomValue * factor);
    this.panX = screenX - world.x * nextZoom;
    this.panY = screenY - world.y * nextZoom;
    this.zoomValue = nextZoom;
    this.notify();
  }

  move(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.notify();
  }

  toWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.panX) / this.zoomValue,
      y: (screenY - this.panY) / this.zoomValue,
    };
  }

  toScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.zoomValue + this.panX,
      y: worldY * this.zoomValue + this.panY,
    };
  }

  apply(ctx: CanvasRenderingContext2D, dpr = 1): void {
    ctx.setTransform(
      this.zoomValue * dpr,
      0,
      0,
      this.zoomValue * dpr,
      this.panX * dpr,
      this.panY * dpr,
    );
  }

  getScale(): number {
    return this.zoomValue;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
