import { resolveControlAccentPalette, type RGBColor } from "./color";

const ATMOSPHERE_VARIABLES = [
  "--color1",
  "--color2",
  "--color3",
  "--color4",
  "--color1-rgba",
  "--color2-rgba",
  "--color3-rgba",
  "--color4-rgba",
  "--control-accent-base",
  "--control-accent-strong",
  "--control-accent-rim",
  "--control-accent-glow",
  "--control-accent-foreground",
] as const;

let savedVariableValues: ReadonlyMap<string, string> | null = null;

function toRgba(color: RGBColor, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

function resolveBodyStyle(): CSSStyleDeclaration | null {
  if (typeof document === "undefined") {
    return null;
  }

  return document.body?.style ?? null;
}

function captureSavedVariableValues(style: CSSStyleDeclaration): void {
  if (savedVariableValues) {
    return;
  }

  const captured = new Map<string, string>();
  for (const name of ATMOSPHERE_VARIABLES) {
    captured.set(name, style.getPropertyValue(name));
  }
  savedVariableValues = captured;
}

export function applyAtmosphereColors(colors: readonly RGBColor[]): void {
  const style = resolveBodyStyle();
  if (!style) {
    return;
  }

  captureSavedVariableValues(style);

  colors.forEach((color, index) => {
    style.setProperty(`--color${index + 1}`, toRgba(color, 0.8));
    style.setProperty(`--color${index + 1}-rgba`, toRgba(color, 0.3));
  });

  const accentPalette = resolveControlAccentPalette(colors);
  style.setProperty("--control-accent-base", toRgba(accentPalette.base, 0.84));
  style.setProperty("--control-accent-strong", toRgba(accentPalette.strong, 0.98));
  style.setProperty("--control-accent-rim", toRgba(accentPalette.rim, 0.94));
  style.setProperty("--control-accent-glow", toRgba(accentPalette.glow, 0.56));
  style.setProperty("--control-accent-foreground", toRgba(accentPalette.foreground, 0.98));
}

export function clearAtmosphereColors(): void {
  const style = resolveBodyStyle();
  if (!style || !savedVariableValues) {
    return;
  }

  for (const name of ATMOSPHERE_VARIABLES) {
    const savedValue = savedVariableValues.get(name);
    if (savedValue && savedValue.length > 0) {
      style.setProperty(name, savedValue);
    } else {
      style.removeProperty(name);
    }
  }

  savedVariableValues = null;
}
