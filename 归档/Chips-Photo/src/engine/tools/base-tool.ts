import type { PhotoLayer, PointerInfo, ToolId, ToolOptionDescriptor } from "../types";
import type { PhotoEngine } from "../photo-engine";

export interface ToolContext {
  engine: PhotoEngine;
}

export abstract class ToolBase {
  abstract readonly id: ToolId;
  abstract readonly title: string;
  abstract readonly iconId: string;
  optionsSchema: ToolOptionDescriptor[] = [];

  protected readonly engine: PhotoEngine;

  constructor(context: ToolContext) {
    this.engine = context.engine;
  }

  abstract onPointerDown(info: PointerInfo): void;
  abstract onPointerMove(info: PointerInfo): void;
  abstract onPointerUp(info: PointerInfo): void;

  onActivate?(): void;
  onDeactivate?(): void;
  onKeyDown?(event: KeyboardEvent): boolean;
  renderOverlay?(ctx: CanvasRenderingContext2D): void;

  getOption<K extends string>(key: K): unknown {
    return this.engine.getToolOption(this.id, key);
  }

  getNumberOption(key: string, fallback = 0): number {
    const value = this.engine.getToolOption(this.id, key);
    return typeof value === "number" ? value : fallback;
  }

  getStringOption(key: string, fallback = ""): string {
    const value = this.engine.getToolOption(this.id, key);
    return typeof value === "string" ? value : fallback;
  }

  getBooleanOption(key: string, fallback = false): boolean {
    const value = this.engine.getToolOption(this.id, key);
    return typeof value === "boolean" ? value : fallback;
  }

  setOption(key: string, value: number | string | boolean): void {
    this.engine.setToolOption(this.id, key, value);
  }

  protected getSelectedLayer(): PhotoLayer | null {
    return this.engine.layers.getSelected();
  }

  protected requestRender(): void {
    this.engine.requestRender();
  }

  protected notify(): void {
    this.engine.notify();
  }
}
