// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../../src/App";
import { renderWithAntd } from "../../src/testing/render-with-antd";
import { formatMessage } from "../../src/lib/messages";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "../..");

function grepAll(pattern: string, extraArgs: string[] = []): string {
  try {
    return execFileSync("grep", ["-rln", ...extraArgs, pattern, join(projectRoot, "src")])
      .toString()
      .trim();
  } catch {
    // grep 无匹配时以非零码退出：视为通过
    return "";
  }
}

describe("基础流程（静态契约）", () => {
  it("应用渲染：无启动目标时呈现起始页", async () => {
    const rendered = renderWithAntd(<App />);
    render(rendered.element);

    await waitFor(() => {
      expect(screen.getByText(formatMessage("start.title"))).toBeTruthy();
    });
    rendered.client.restoreBridge();
  }, 15000);

  it("src 不含 node: 导入（引擎已浏览器化）", () => {
    expect(grepAll("from 'node:")).toBe("");
  });

  it("src 不含 AI 相关引用（原 renderer/ai 目录已排除）", () => {
    expect(grepAll("ai-provider")).toBe("");
    expect(grepAll("slides-skill")).toBe("");
    expect(grepAll("layout-script")).toBe("");
  });

  it("TSX 不含内联样式（视觉统一走 CSS）", () => {
    expect(grepAll("style={{")).toBe("");
  });

  it("src 不含 TODO/FIXME 残留", () => {
    expect(grepAll("TODO", ["-i"])).toBe("");
    expect(grepAll("FIXME", ["-i"])).toBe("");
  });

  it("测试夹具为合法 pptx zip", async () => {
    const JSZip = (await import("jszip")).default;
    const bytes = new Uint8Array(
      readFileSync(join(projectRoot, "tests/fixtures/01_standard_business.pptx")),
    );
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("ppt/presentation.xml")).not.toBeNull();
  });
});
