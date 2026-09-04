import type { EngineConfig, PhotoLayer } from "../types";
import type { EngineAction } from "./action";

export interface ConfigActionHost {
  getConfig(): EngineConfig;
  setConfigInternal(patch: Partial<EngineConfig>): void;
  resizeCanvasInternal(width: number, height: number): void;
  getAllLayers(): PhotoLayer[];
  applySettings(id: number, settings: Partial<PhotoLayer>): void;
  translateLayerImage(id: number, dx: number, dy: number): void;
}

export class UpdateConfigAction implements EngineAction {
  readonly id = "update-config";
  readonly description: string;
  memoryEstimate = 0;
  private previous: Partial<EngineConfig> = {};
  private executed = false;

  constructor(
    private readonly host: ConfigActionHost,
    private readonly patch: Partial<EngineConfig>,
    description = "更新配置",
  ) {
    this.description = description;
  }

  do(): void {
    const config = this.host.getConfig();
    this.previous = {};
    for (const key of Object.keys(this.patch) as Array<keyof EngineConfig>) {
      (this.previous as Record<string, unknown>)[key] = config[key];
    }
    this.host.setConfigInternal(this.patch);
    this.executed = true;
  }

  undo(): void {
    if (this.executed) {
      this.host.setConfigInternal(this.previous);
    }
  }
}

export class PrepareCanvasAction implements EngineAction {
  readonly id = "prepare-canvas";
  readonly description: string;
  memoryEstimate = 0;
  private previousWidth = 0;
  private previousHeight = 0;
  private layerSnapshots: Array<{ id: number; width: number | null; height: number | null }> = [];

  constructor(
    private readonly host: ConfigActionHost,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.description = "调整画布尺寸";
  }

  do(): void {
    const config = this.host.getConfig();
    this.previousWidth = config.width;
    this.previousHeight = config.height;
    this.layerSnapshots = this.host.getAllLayers().map((layer) => ({
      id: layer.id,
      width: layer.width,
      height: layer.height,
    }));
    this.host.resizeCanvasInternal(this.width, this.height);
  }

  undo(): void {
    this.host.resizeCanvasInternal(this.previousWidth, this.previousHeight);
    for (const snapshot of this.layerSnapshots) {
      this.host.applySettings(snapshot.id, {
        width: snapshot.width,
        height: snapshot.height,
      });
    }
  }
}

export class TranslateLayerAction implements EngineAction {
  readonly id = "translate-layer";
  readonly description: string;
  memoryEstimate = 0;
  private previousX = 0;
  private previousY = 0;
  private translatedImage = false;
  private executed = false;

  constructor(
    private readonly host: ConfigActionHost,
    private readonly layerId: number,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    this.description = "平移图层";
  }

  do(): void {
    const layer = this.host.getAllLayers().find((item) => item.id === this.layerId);
    if (!layer) {
      throw new Error(`图层不存在：${this.layerId}`);
    }
    this.previousX = layer.x;
    this.previousY = layer.y;
    this.translatedImage = layer.type === "image" || layer.canvas !== null;
    this.host.applySettings(this.layerId, { x: layer.x + this.dx, y: layer.y + this.dy });
    if (this.translatedImage) {
      this.host.translateLayerImage(this.layerId, -this.dx, -this.dy);
    }
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) {
      return;
    }
    this.host.applySettings(this.layerId, { x: this.previousX, y: this.previousY });
    if (this.translatedImage) {
      this.host.translateLayerImage(this.layerId, this.dx, this.dy);
    }
  }
}
