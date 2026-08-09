import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateTheme } from "../src/validate-theme";

const run = (cmd: string, cwd: string): void => {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, CI: "true" } });
};

describe("theme build pipeline", () => {
  it("runs build script without errors", () => {
    const projectRoot = path.resolve(__dirname, "..");
    // 这里假定依赖已安装，脚本在 CI 或本地开发环境中执行。
    run("npm run build", projectRoot);
    expect(true).toBe(true);
  }, 30000);

  it("emits runtime icon fonts into dist and injects font-face declarations", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const themeCss = await fs.readFile(path.join(projectRoot, "dist", "theme.css"), "utf-8");

    expect(themeCss).toContain("Material Symbols Outlined");
    expect(themeCss).toContain('data-scope="text"');
    expect(themeCss).toContain('data-scope="label"');
    expect(themeCss).toContain('data-scope="icon-button"');
    expect(themeCss).toContain('data-scope="badge"');
    expect(themeCss).toContain('data-scope="progress"');
    expect(themeCss).toContain('data-scope="text-field"');
    expect(themeCss).toContain('data-scope="text-area"');
    expect(themeCss).toContain('data-scope="search-field"');
    expect(themeCss).toContain('data-scope="secure-field"');
    expect(themeCss).toContain('data-scope="segmented-control"');
    expect(themeCss).toContain('data-scope="combo-box"');
    expect(themeCss).toContain('data-scope="number-input"');
    expect(themeCss).toContain('data-scope="stepper"');
    expect(themeCss).toContain('data-scope="slider"');
    expect(themeCss).toContain('data-scope="date-picker"');
    expect(themeCss).toContain('data-scope="time-picker"');
    expect(themeCss).toContain('data-scope="image"');
    expect(themeCss).toContain('data-scope="media"');
    expect(themeCss).toContain('data-scope="error-state"');
    expect(themeCss).toContain("--chips-comp-date-picker-cell-surface-selected");
    expect(themeCss).toContain("--chips-comp-time-picker-option-surface-selected");
    expect(themeCss).toContain("--chips-comp-image-fallback-surface");
    expect(themeCss).toContain("--chips-comp-media-control-surface-idle");
    expect(themeCss).toContain("--chips-comp-error-state-status-color-error");
    expect(themeCss).toContain("--chips-comp-icon-root-color");
    expect(themeCss).toContain("data-tone=\"accent\"");
    expect(themeCss).toContain("--chips-comp-icon-root-color-accent");
    expect(themeCss).toContain("--chips-comp-toolbar-item-icon-size");
    expect(themeCss).toContain("--chips-base-shadow-control");
    expect(themeCss).toContain("--chips-base-shadow-card");
    expect(themeCss).toContain("--chips-base-shadow-float");
    expect(themeCss).toContain("--chips-base-control-height");
    expect(themeCss).toContain("background-color: var(--chips-base-edge-top)");
    expect(themeCss).toContain('data-scope="view"');
    expect(themeCss).toContain('data-scope="split-view"');
    expect(themeCss).toContain('data-scope="navigation-split-view"');
    expect(themeCss).toContain('data-scope="dialog"][data-part="header"');
    expect(themeCss).toContain('data-scope="dialog"][data-part="body"');
    expect(themeCss).toContain('data-scope="dialog"][data-part="actions"');
    expect(themeCss).not.toContain('data-scope="dialog"][data-part="title"');
    expect(themeCss).not.toContain("--chips-comp-dialog-title-color");
    expect(themeCss).toContain("var(--chips-layout-size-grid-min-item");
    expect(themeCss).toContain('[data-scope="select"][data-part="root"]');
    expect(themeCss).toContain("grid-template-columns: minmax(0, max-content)");
    expect(themeCss).toContain("inset-block-start: calc(100% + var(--chips-select-content-gutter");
    expect(themeCss).toContain("z-index: var(--chips-layout-z-index-overlay, 1000)");
    expect(themeCss).toContain("overscroll-behavior: contain");
    await expect(
      fs.access(path.join(projectRoot, "dist", "icons", "variablefont", "MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2"))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(projectRoot, "dist", "icons", "variablefont", "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2"))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(projectRoot, "dist", "icons", "variablefont", "MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2"))
    ).resolves.toBeUndefined();
  });

  it("covers every component contract scope with theme CSS selectors", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const [themeCss, validation] = await Promise.all([
      fs.readFile(path.join(projectRoot, "dist", "theme.css"), "utf-8"),
      validateTheme(projectRoot)
    ]);
    const missingScopes = validation.contract.components
      .map((component) => component.scope)
      .filter((scope) => !themeCss.includes(`data-scope="${scope}"`))
      .sort();

    expect(missingScopes).toEqual([]);
    expect(themeCss).toContain('data-scope="toolbar"');
    expect(themeCss).toContain('data-scope="menu-bar"');
    expect(themeCss).toContain('data-scope="context-menu"');
    expect(themeCss).toContain('data-scope="shortcut"');
    expect(themeCss).toContain('data-motion="overlay-enter"');
    expect(themeCss).toContain('data-motion="menu-enter"');
    expect(themeCss).toContain('data-motion="list-reorder"');
    expect(themeCss).toContain('prefers-reduced-motion: reduce');
  });
});
