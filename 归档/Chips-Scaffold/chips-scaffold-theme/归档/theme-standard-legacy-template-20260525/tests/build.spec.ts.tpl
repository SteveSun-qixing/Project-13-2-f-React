import fs from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const run = (cmd: string, cwd: string): void => {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, CI: "true" } });
};

describe("theme build pipeline", () => {
  it("runs build script without errors", () => {
    const projectRoot = path.resolve(__dirname, "..");
    run("npm run build", projectRoot);
    expect(true).toBe(true);
  });

  it("emits runtime icon fonts into dist and injects font-face declarations", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const themeCss = await fs.readFile(path.join(projectRoot, "dist", "theme.css"), "utf-8");

    expect(themeCss).toContain("Material Symbols Outlined");
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
});
