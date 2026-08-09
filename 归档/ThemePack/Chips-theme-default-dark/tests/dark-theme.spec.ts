import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const getPath = (target: unknown, keyPath: string): unknown => {
  return keyPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, target);
};

const toLayeredKeyPath = (tokenKey: string): string => {
  const [, layer] = tokenKey.match(/^chips\.(ref|sys|comp|motion|layout)\./) ?? [];
  return layer ? `${layer}.${tokenKey}` : tokenKey;
};

const resolveToken = (tokens: Record<string, unknown>, value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const match = value.match(/^\{(.+)\}$/);
  return match ? getPath(tokens, toLayeredKeyPath(match[1] ?? "")) : value;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255) as [
    number,
    number,
    number
  ];
};

const luminance = (hex: string): number => {
  const linear = hexToRgb(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("dark theme baseline", () => {
  it("declares the dark theme identity in manifest", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const manifestRaw = await fs.readFile(path.join(projectRoot, "manifest.yaml"), "utf-8");

    expect(manifestRaw).toContain('id: "theme.theme.chips-official-default-dark-theme"');
    expect(manifestRaw).toContain('themeId: "chips-official.default-dark-theme"');
    expect(manifestRaw).toContain('isDefault: false');
  });

  it("emits a dark color-scheme baseline and dark canvas tokens", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const cssRaw = await fs.readFile(path.join(projectRoot, "dist", "theme.css"), "utf-8");
    const tokensRaw = await fs.readFile(path.join(projectRoot, "dist", "tokens.json"), "utf-8");
    const tokens = JSON.parse(tokensRaw) as {
      ref: { chips?: { ref?: { color?: Record<string, string> } } };
      sys: { chips?: { sys?: { color?: Record<string, string> } } };
    };

    expect(cssRaw).toContain('color-scheme: dark;');
    expect(cssRaw).toContain('--chips-base-shadow-color');
    expect(cssRaw).toContain('--chips-base-shadow-control');
    expect(cssRaw).toContain('--chips-base-shadow-card');
    expect(cssRaw).toContain('--chips-base-shadow-float');
    expect(cssRaw).toContain('--chips-base-edge-top');
    expect(cssRaw).toContain('--chips-base-focus-ring');
    expect(tokens.ref.chips?.ref?.color?.['gray-950']).toBe('#070b12');
    expect(tokens.ref.chips?.ref?.color?.['gray-650']).toBe('#232c3d');
    expect(tokens.sys.chips?.sys?.color?.canvas).toBe('{chips.ref.color.gray-950}');
    expect(tokens.sys.chips?.sys?.color?.primary).toBe('{chips.ref.color.blue-500}');
    expect(tokens.sys.chips?.sys?.color?.['surface-accent']).toBe('#123241');
    expect(tokens.sys.chips?.sys?.color?.['focus-ring']).toBe('{chips.ref.color.cyan-300}');
  });

  it("keeps the dark theme visual language aligned with the official theme baseline", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const [cssRaw, tokens] = await Promise.all([
      fs.readFile(path.join(projectRoot, "dist", "theme.css"), "utf-8"),
      readJson<Record<string, unknown>>(path.join(projectRoot, "dist", "tokens.json"))
    ]);

    expect(getPath(tokens, "ref.chips.ref.radius")).toMatchObject({
      xs: "8px",
      sm: "10px",
      md: "12px",
      control: "14px",
      pill: "999px"
    });
    expect(getPath(tokens, "comp.chips.comp.divider.root.color")).toBe("{chips.sys.color.border-subtle}");
    expect(getPath(tokens, "comp.chips.comp.form.control.border.idle")).toBe("{chips.sys.color.border-subtle}");
    expect(getPath(tokens, "comp.chips.comp.navigation-split-view.divider.color")).toBe(
      "{chips.sys.color.border-subtle}"
    );
    expect(cssRaw).toContain("box-shadow: var(--chips-base-shadow-control)");
    expect(cssRaw).toContain("box-shadow: var(--chips-base-shadow-card)");
    expect(cssRaw).toContain("box-shadow: var(--chips-base-shadow-float)");
    expect(cssRaw).toContain("background-color: var(--chips-base-edge-top)");
    expect(cssRaw).toContain("font-family: Inter, ui-sans-serif, system-ui");
    expect(cssRaw).not.toContain('font-family: "Roboto Flex"');
    expect(cssRaw).not.toContain("letter-spacing: 0.01em");
    expect(cssRaw).not.toContain("outline: 2px solid var(--chips-comp-button-focus-outline)");
    expect(cssRaw).not.toContain("translateY(0.5px)");
  });

  it("declares reusable dark semantic state colors", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const tokens = await readJson<Record<string, unknown>>(path.join(projectRoot, "dist", "tokens.json"));
    const sysColor = getPath(tokens, "sys.chips.sys.color") as Record<string, unknown>;
    const comp = getPath(tokens, "comp.chips.comp") as Record<string, unknown>;

    for (const tone of ["success", "warning", "info", "danger", "error"]) {
      expect(sysColor[tone], `missing ${tone}`).toBeDefined();
      expect(sysColor[`${tone}-surface`], `missing ${tone}-surface`).toBeDefined();
      expect(sysColor[`${tone}-contrast`], `missing ${tone}-contrast`).toBeDefined();
    }

    expect(getPath(comp, "badge.root.surface.success")).toBe("{chips.sys.color.success}");
    expect(getPath(comp, "badge.root.surface.warning")).toBe("{chips.sys.color.warning}");
    expect(getPath(comp, "badge.label.color.success")).toBe("{chips.sys.color.success-contrast}");
    expect(getPath(comp, "tag.root.surface.error")).toBe("{chips.sys.color.error-surface}");
    expect(getPath(comp, "spinner.status.color.info")).toBe("{chips.sys.color.info}");
    expect(getPath(comp, "loading-boundary.status.color.info")).toBe("{chips.sys.color.info}");
    expect(getPath(comp, "skeleton.status.color.info")).toBe("{chips.sys.color.info}");
  });

  it("keeps key dark contrast pairs above readable thresholds", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const tokens = await readJson<Record<string, unknown>>(path.join(projectRoot, "dist", "tokens.json"));

    const color = (keyPath: string): string => {
      const resolved = resolveToken(tokens, getPath(tokens, keyPath));
      expect(typeof resolved).toBe("string");
      return resolved as string;
    };

    const pairs: Array<[string, string, number]> = [
      ["sys.chips.sys.color.on-surface", "sys.chips.sys.color.canvas", 4.5],
      ["sys.chips.sys.color.on-surface-muted", "sys.chips.sys.color.surface", 4.5],
      ["sys.chips.sys.color.on-surface-soft", "sys.chips.sys.color.surface-raised", 4.5],
      ["sys.chips.sys.color.primary-contrast", "sys.chips.sys.color.primary", 4.5],
      ["sys.chips.sys.color.success-contrast", "sys.chips.sys.color.success", 4.5],
      ["sys.chips.sys.color.warning-contrast", "sys.chips.sys.color.warning", 4.5],
      ["sys.chips.sys.color.info-contrast", "sys.chips.sys.color.info", 4.5],
      ["sys.chips.sys.color.error-contrast", "sys.chips.sys.color.error", 4.5],
      ["sys.chips.sys.color.error", "sys.chips.sys.color.error-surface", 4.5]
    ];

    for (const [foregroundPath, backgroundPath, threshold] of pairs) {
      expect(contrastRatio(color(foregroundPath), color(backgroundPath))).toBeGreaterThanOrEqual(threshold);
    }
  });
});
