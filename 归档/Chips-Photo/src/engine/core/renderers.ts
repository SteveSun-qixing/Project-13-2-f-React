import type { LayerRenderer, LayerType } from "../types";

export const rendererRegistry = new Map<LayerType, LayerRenderer>();

export function registerLayerRenderer(type: LayerType, renderer: LayerRenderer): void {
  rendererRegistry.set(type, renderer);
}

export function getLayerRenderer(type: LayerType | null): LayerRenderer | null {
  if (type === null) {
    return null;
  }
  return rendererRegistry.get(type) ?? null;
}
