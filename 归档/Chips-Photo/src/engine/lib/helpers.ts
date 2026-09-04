import type { Point } from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").trim();
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (component: number) =>
    clamp(Math.round(component), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const gray = Math.round(ln * 255);
    return { r: gray, g: gray, b: gray };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, v: Math.round(max * 100) };
  }
  const s = d / max;
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function hsvToRgb(h: number, s: number, v: number): RgbColor {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  const table: Array<[number, number, number]> = [
    [vn, t, p],
    [q, vn, p],
    [p, vn, t],
    [p, q, vn],
    [t, p, vn],
    [vn, p, q],
  ];
  const [r, g, b] = table[i % 6];
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const normalized = clamp(alpha, 0, 255) / 255;
  return `rgba(${r}, ${g}, ${b}, ${round2(normalized)})`;
}

export function colorLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

export function pointsBounds(points: Array<{ x: number; y: number }>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  canvas.getContext("2d")?.drawImage(source, 0, 0);
  return canvas;
}

export function canvasMemoryEstimate(canvas: HTMLCanvasElement): number {
  return canvas.width * canvas.height * 4;
}

export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  intervalMs: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...(lastArgs as Parameters<T>));
      lastArgs = null;
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        if (lastArgs !== null) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, intervalMs - (now - lastCall));
    }
  };
}

export function snapTo(value: number, enabled: boolean, targets: number[], threshold: number): number {
  if (!enabled) {
    return value;
  }
  let best = value;
  let bestDistance = threshold;
  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best;
}

export function pointInBounds(point: Point, bounds: { x: number; y: number; width: number; height: number }): boolean {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x <= bounds.x + bounds.width &&
    point.y <= bounds.y + bounds.height
  );
}

export function rotatePoint(point: Point, center: Point, angleDegrees: number): Point {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}
