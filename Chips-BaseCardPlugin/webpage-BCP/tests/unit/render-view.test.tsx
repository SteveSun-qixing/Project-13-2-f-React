// @vitest-environment jsdom

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

const workspaceRoot = resolve(__dirname, "../../../..");
const testingSpaceRoot = resolve(workspaceRoot, "ProductFinishedProductTestingSpace");

function requireMaterial(relativePath: string): string {
  const filePath = resolve(testingSpaceRoot, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`真实素材缺失：${filePath}`);
  }

  return filePath;
}

function requireFileMaterial(relativePath: string): string {
  const filePath = requireMaterial(relativePath);
  if (!statSync(filePath).isFile()) {
    throw new Error(`真实素材不是文件：${filePath}`);
  }

  return filePath;
}

function requireDirectoryMaterial(relativePath: string): string {
  const dirPath = requireMaterial(relativePath);
  if (!statSync(dirPath).isDirectory()) {
    throw new Error(`真实素材不是目录：${dirPath}`);
  }

  return dirPath;
}

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "WebPageCard",
    theme: "",
    source_type: "url",
    source_url: "",
    bundle_root: "",
    entry_file: "index.html",
    resource_paths: [],
    display_mode: "fixed",
    fixed_ratio: "7:16",
    max_height_ratio: 20,
    ...overrides,
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mountBasecardView", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { chips?: unknown }).chips = {
      invoke: vi.fn(async () => ({
        content: "<!doctype html><html><head></head><body><main>bundle</main></body></html>",
      })),
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete (globalThis as typeof globalThis & { chips?: unknown }).chips;
    vi.unstubAllGlobals();
  });

  it("renders the localized empty state", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig(),
    });

    expect(container.querySelector(".chips-webpage-card__message")?.textContent).toBe("暂无网页内容");
    cleanup();
  });

  it("renders a remote webpage iframe for a valid URL source", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
      }),
    });

    await flushAsyncWork();

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://example.com/page");
    cleanup();
  });

  it("routes remote webpage open intent through openResource", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
      }),
      openResource,
    });

    await flushAsyncWork();

    const openButton = container.querySelector('[data-webpage-open-source="true"] button') as HTMLButtonElement | null;
    if (!openButton) {
      throw new Error("未找到网页打开按钮");
    }

    openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "https://example.com/page",
      mimeType: "text/html",
      title: "打开网页链接",
      payload: {
        kind: "chips.webpage-card",
        version: "1.0.0",
        cardType: "WebPageCard",
        sourceType: "url",
        url: "https://example.com/page",
      },
    });
    cleanup();
  });

  it("loads bundled index.html and injects a base href into srcdoc", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "bundle",
        bundle_root: "web-bundle",
        entry_file: "index.html",
        resource_paths: ["web-bundle/index.html"],
      }),
      resolveResourceUrl: async () => "file:///workspace/card/web-bundle/index.html",
    });

    await flushAsyncWork();

    const frame = container.querySelector("iframe");
    const srcDoc = frame?.getAttribute("srcdoc") ?? "";
    expect(srcDoc).toContain('<base href="file:///workspace/card/web-bundle/" />');
    expect(srcDoc).toContain("<main>bundle</main>");
    expect(srcDoc).toContain("chips:webpage-card:viewport");
    expect(srcDoc).toContain("--chips-webpage-card-viewport-width");
    cleanup();
  });

  it("routes bundled webpage entry open intent through openResource", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "bundle",
        bundle_root: "web-bundle",
        entry_file: "index.html",
        resource_paths: ["web-bundle/index.html", "web-bundle/assets/app.js"],
      }),
      resolveResourceUrl: async () => "file:///workspace/card/web-bundle/index.html",
      openResource,
    });

    await flushAsyncWork();

    const openButton = container.querySelector('[data-webpage-open-source="true"] button') as HTMLButtonElement | null;
    if (!openButton) {
      throw new Error("未找到网页包打开按钮");
    }

    openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "web-bundle/index.html",
      mimeType: "text/html",
      title: "打开网页包入口",
      fileName: "index.html",
      payload: {
        kind: "chips.webpage-card",
        version: "1.0.0",
        cardType: "WebPageCard",
        sourceType: "bundle",
        bundleRoot: "web-bundle",
        entryFile: "index.html",
        resourcePaths: ["web-bundle/index.html", "web-bundle/assets/app.js"],
      },
    });
    cleanup();
  });

  it("使用真实网页包目录渲染入口并通过 openResource 暴露 text/html 打开意图", async () => {
    const webpageArchivePath = requireFileMaterial("昙花网页.zip");
    expect(statSync(webpageArchivePath).size).toBeGreaterThan(0);

    const webpageDir = requireDirectoryMaterial("昙花");
    const indexPath = requireFileMaterial("昙花/index.html");
    const scriptPath = requireFileMaterial("昙花/script.js");
    const stylesPath = requireFileMaterial("昙花/styles.css");
    const indexHtml = readFileSync(indexPath, "utf-8");

    const container = document.createElement("div");
    const openResource = vi.fn();
    document.body.appendChild(container);

    (globalThis as typeof globalThis & { chips?: { invoke?: unknown } }).chips = {
      invoke: vi.fn(async (action: string, input: { path?: string }) => {
        expect(action).toBe("file.read");
        expect(input.path).toBe(indexPath);
        return { content: indexHtml };
      }),
    };

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "bundle",
        bundle_root: "昙花",
        entry_file: "index.html",
        resource_paths: ["昙花/index.html", "昙花/styles.css", "昙花/script.js"],
      }),
      resolveResourceUrl: async (resourcePath) => {
        if (resourcePath === "昙花/index.html") {
          return `file://${indexPath}`;
        }
        throw new Error(`测试未期望解析资源：${resourcePath}`);
      },
      openResource,
    });

    await flushAsyncWork();

    const frame = container.querySelector("iframe");
    const srcDoc = frame?.getAttribute("srcdoc") ?? "";
    expect(webpageDir).toContain("ProductFinishedProductTestingSpace");
    expect(scriptPath).toContain("script.js");
    expect(stylesPath).toContain("styles.css");
    expect(srcDoc).toContain(`<base href="${new URL(`file://${webpageDir}/`).href}" />`);
    expect(srcDoc).toContain("chips:webpage-card:viewport");

    const openButton = container.querySelector('[data-webpage-open-source="true"] button') as HTMLButtonElement | null;
    if (!openButton) {
      throw new Error("未找到网页包打开按钮");
    }

    openButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "昙花/index.html",
      mimeType: "text/html",
      title: "打开网页包入口",
      fileName: "index.html",
      payload: {
        kind: "chips.webpage-card",
        version: "1.0.0",
        cardType: "WebPageCard",
        sourceType: "bundle",
        bundleRoot: "昙花",
        entryFile: "index.html",
        resourcePaths: ["昙花/index.html", "昙花/styles.css", "昙花/script.js"],
      },
    });
    cleanup();
  });

  it("renders the webpage viewport without border or rounded corners", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
      }),
    });

    await flushAsyncWork();

    const styleText = container.querySelector("style")?.textContent ?? "";
    expect(styleText).toContain("border-radius: 0;");
    expect(styleText).toContain("border: 0;");
    cleanup();
  });

  it("adapts iframe height from the embedded page viewport message contract", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
        display_mode: "free",
      }),
    });

    await flushAsyncWork();

    const viewport = container.querySelector(".chips-webpage-card__viewport") as HTMLElement | null;
    const frame = container.querySelector("iframe") as HTMLIFrameElement | null;
    if (!viewport || !frame) {
      throw new Error("未找到网页预览 iframe");
    }

    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: {
        URL: "https://example.com/page",
        documentElement: {
          scrollHeight: 960,
          offsetHeight: 960,
          clientHeight: 960,
        },
        body: {
          scrollHeight: 960,
          offsetHeight: 960,
          clientHeight: 960,
          textContent: "page",
          childElementCount: 1,
        },
      },
    });
    frame.dispatchEvent(new Event("load"));
    await flushAsyncWork();

    expect(viewport.style.height).toBe("960px");
    cleanup();
  });

  it("keeps the fixed ratio viewport height in fixed display mode", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
        display_mode: "fixed",
      }),
    });

    await flushAsyncWork();

    const viewport = container.querySelector(".chips-webpage-card__viewport") as HTMLElement | null;
    expect(viewport?.style.height).toBe("1463px");
    cleanup();
  });

  it("caps free expand mode to at most 20 times the viewport width", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
        display_mode: "free",
      }),
    });

    await flushAsyncWork();

    const viewport = container.querySelector(".chips-webpage-card__viewport") as HTMLElement | null;
    const frame = container.querySelector("iframe") as HTMLIFrameElement | null;
    if (!viewport || !frame) {
      throw new Error("未找到网页预览 iframe");
    }

    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: {
        URL: "https://example.com/page",
        documentElement: {
          scrollHeight: 20000,
          offsetHeight: 20000,
          clientHeight: 20000,
        },
        body: {
          scrollHeight: 20000,
          offsetHeight: 20000,
          clientHeight: 20000,
          textContent: "page",
          childElementCount: 1,
        },
      },
    });
    frame.dispatchEvent(new Event("load"));
    await flushAsyncWork();

    expect(viewport.style.height).toBe("12800px");
    cleanup();
  });

  it("keeps a stable protocol viewport height when free mode expands the outer layout", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const originalInnerHeight = window.innerHeight;
    const originalAvailHeight = window.screen.availHeight;

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window.screen, "availHeight", {
      configurable: true,
      value: 900,
    });

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        source_type: "url",
        source_url: "https://example.com/page",
        display_mode: "free",
      }),
    });

    await flushAsyncWork();

    const viewport = container.querySelector(".chips-webpage-card__viewport") as HTMLElement | null;
    const frame = container.querySelector("iframe") as HTMLIFrameElement | null;
    if (!viewport || !frame) {
      throw new Error("未找到网页预览 iframe");
    }

    const postMessage = vi.fn();
    Object.defineProperty(frame, "contentWindow", {
      configurable: true,
      value: {
        postMessage,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: {
        URL: "https://example.com/page",
        documentElement: {
          scrollHeight: 960,
          offsetHeight: 960,
          clientHeight: 960,
        },
        body: {
          scrollHeight: 960,
          offsetHeight: 960,
          clientHeight: 960,
          textContent: "page",
          childElementCount: 1,
        },
      },
    });

    frame.dispatchEvent(new Event("load"));
    await flushAsyncWork();

    const lastMessage = postMessage.mock.calls.at(-1)?.[0] as
      | { type?: string; payload?: { height?: number; baseHeight?: number; displayMode?: string } }
      | undefined;

    expect(viewport.style.height).toBe("960px");
    expect(lastMessage?.type).toBe("chips:webpage-card:viewport");
    expect(lastMessage?.payload?.displayMode).toBe("free");
    expect(lastMessage?.payload?.height).toBe(900);
    expect(lastMessage?.payload?.baseHeight).toBe(160);
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window.screen, "availHeight", {
      configurable: true,
      value: originalAvailHeight,
    });
    cleanup();
  });
});
