import type { EffectParamDescriptor, PhotoLayer } from "../types";

export interface LiveFilterDefinition {
  name: string;
  title: string;
  params: EffectParamDescriptor[];
  cssFilter?: (params: Record<string, unknown>) => string;
}

export const LIVE_FILTER_DEFINITIONS: LiveFilterDefinition[] = [
  {
    name: "blur",
    title: "高斯模糊",
    params: [{ key: "value", label: "模糊半径", type: "range", min: 0, max: 40, step: 1, default: 4 }],
    cssFilter: (params) => `blur(${Number(params.value ?? 4)}px)`,
  },
  {
    name: "brightness",
    title: "亮度",
    params: [
      { key: "value", label: "亮度百分比", type: "range", min: 0, max: 300, step: 5, default: 110 },
    ],
    cssFilter: (params) => `brightness(${Number(params.value ?? 110)}%)`,
  },
  {
    name: "contrast",
    title: "对比度",
    params: [
      { key: "value", label: "对比度百分比", type: "range", min: 0, max: 300, step: 5, default: 120 },
    ],
    cssFilter: (params) => `contrast(${Number(params.value ?? 120)}%)`,
  },
  {
    name: "grayscale",
    title: "灰度",
    params: [
      { key: "value", label: "灰度百分比", type: "range", min: 0, max: 100, step: 5, default: 100 },
    ],
    cssFilter: (params) => `grayscale(${Number(params.value ?? 100)}%)`,
  },
  {
    name: "hue-rotate",
    title: "色相旋转",
    params: [{ key: "value", label: "角度", type: "range", min: 0, max: 360, step: 5, default: 90 }],
    cssFilter: (params) => `hue-rotate(${Number(params.value ?? 90)}deg)`,
  },
  {
    name: "invert",
    title: "反色",
    params: [
      { key: "value", label: "反色百分比", type: "range", min: 0, max: 100, step: 5, default: 100 },
    ],
    cssFilter: (params) => `invert(${Number(params.value ?? 100)}%)`,
  },
  {
    name: "saturate",
    title: "饱和度",
    params: [
      { key: "value", label: "饱和度百分比", type: "range", min: 0, max: 300, step: 5, default: 140 },
    ],
    cssFilter: (params) => `saturate(${Number(params.value ?? 140)}%)`,
  },
  {
    name: "sepia",
    title: "深褐色",
    params: [
      { key: "value", label: "深褐色百分比", type: "range", min: 0, max: 100, step: 5, default: 100 },
    ],
    cssFilter: (params) => `sepia(${Number(params.value ?? 100)}%)`,
  },
  {
    name: "shadow",
    title: "阴影",
    params: [
      { key: "blur", label: "模糊半径", type: "range", min: 0, max: 60, step: 1, default: 12 },
      { key: "offsetX", label: "水平偏移", type: "range", min: -60, max: 60, step: 1, default: 8 },
      { key: "offsetY", label: "垂直偏移", type: "range", min: -60, max: 60, step: 1, default: 8 },
      { key: "color", label: "阴影颜色", type: "color", default: "#000000" },
      { key: "alpha", label: "不透明度", type: "range", min: 0, max: 255, step: 1, default: 160 },
    ],
  },
];

const LIVE_FILTER_MAP = new Map(
  LIVE_FILTER_DEFINITIONS.map((definition) => [definition.name, definition]),
);

export function getLiveFilterDefinition(name: string): LiveFilterDefinition | null {
  return LIVE_FILTER_MAP.get(name) ?? null;
}

interface ShadowParams {
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
  alpha: number;
}

function resolveShadowParams(params: Record<string, unknown>): ShadowParams {
  return {
    blur: Number(params.blur ?? 12),
    offsetX: Number(params.offsetX ?? 8),
    offsetY: Number(params.offsetY ?? 8),
    color: typeof params.color === "string" ? params.color : "#000000",
    alpha: Number(params.alpha ?? 160),
  };
}

export function applyLayerFilters(
  ctx: CanvasRenderingContext2D,
  layer: PhotoLayer,
  render: () => void,
): void {
  const cssParts: string[] = [];
  let shadowParams: ShadowParams | null = null;
  for (const filter of layer.filters) {
    if (filter.disabled) {
      continue;
    }
    if (filter.name === "shadow") {
      shadowParams = resolveShadowParams(filter.params);
      continue;
    }
    const definition = getLiveFilterDefinition(filter.name);
    if (definition?.cssFilter) {
      cssParts.push(definition.cssFilter(filter.params));
    }
  }
  ctx.filter = cssParts.length > 0 ? cssParts.join(" ") : "none";
  if (shadowParams) {
    const alpha = Math.min(1, Math.max(0, shadowParams.alpha / 255));
    ctx.shadowColor = withAlpha(shadowParams.color, alpha);
    ctx.shadowBlur = shadowParams.blur;
    ctx.shadowOffsetX = shadowParams.offsetX;
    ctx.shadowOffsetY = shadowParams.offsetY;
  }
  render();
  ctx.filter = "none";
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.slice(0, 6) || "000000", 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
