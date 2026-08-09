import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appConfig } from "../../config/app-config";
import { getSceneIdForReaderState } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { createFallbackSurfaceContext, readLaunchContext } from "../../src/runtime/launch-context";

function readSource(path: string): string {
  return readFileSync(resolve(__dirname, "../../", path), "utf-8");
}

describe("BookReader AppRuntime 基线", () => {
  it("将 App 入口收敛为 vNext AppRoot re-export，不再直接创建 Bridge 或 SDK client", () => {
    const appSource = readSource("src/App.tsx");

    expect(appSource.trim()).toBe('export { AppRoot as App } from "./app/AppRoot";');
    expect(appSource).not.toContain("useChipsBridge");
    expect(appSource).not.toContain("useChipsClient");
    expect(appSource).not.toContain("createClient");
  });

  it("为缺失 surfaceContext 的启动上下文补齐正式 surface fallback", () => {
    const surface = createFallbackSurfaceContext({
      pluginId: appConfig.appId,
      sessionId: "session-reader",
      sceneId: "scene-reader",
      surfaceId: "surface-reader",
      kind: "window",
      launchParams: {
        targetPath: "/tmp/book.epub",
      },
    });

    expect(surface).toMatchObject({
      pluginId: appConfig.appId,
      sessionId: "session-reader",
      sceneId: "scene-reader",
      surfaceId: "surface-reader",
      kind: "window",
      launchParams: {
        targetPath: "/tmp/book.epub",
      },
    });
    expect(surface.presentation.title).toBe("书籍阅读器");
  });

  it("读取 launch context 时保留顶层启动参数优先级并注入 surface 语义", () => {
    const client = {
      platform: {
        getLaunchContext: () => ({
          pluginId: appConfig.appId,
          sceneId: "top-scene",
          launchParams: {
            targetPath: "/tmp/top.epub",
          },
          surfaceContext: {
            sceneId: "surface-scene",
            pluginId: appConfig.appId,
            kind: "window",
            presentation: {
              title: "Surface Reader",
            },
            launchParams: {
              targetPath: "/tmp/surface.epub",
              trigger: "surface",
            },
          },
        }),
      },
    };

    const launchContext = readLaunchContext(client as never);

    expect(launchContext.sceneId).toBe("top-scene");
    expect(launchContext.surfaceContext?.sceneId).toBe("surface-scene");
    expect(launchContext.launchParams).toEqual({
      targetPath: "/tmp/top.epub",
      trigger: "surface",
    });
  });

  it("根据阅读状态解析 Document Scene", () => {
    expect(getSceneIdForReaderState({ book: null, feedback: null })).toBe("empty");
    expect(getSceneIdForReaderState({ book: null, feedback: { tone: "error", message: "failed" } })).toBe("reader-error");
    expect(getSceneIdForReaderState({ book: { sections: [] } as never, feedback: null })).toBe("reader-document");
  });

  it("本地中文文案表覆盖核心文案并支持插值", () => {
    expect(formatMessage("book-reader.labels.appName")).toBe("书籍阅读器");
    expect(formatMessage("book-reader.reader.pagePosition", { current: 3, total: 10 })).toBe("第 3 / 10 页");
  });
});
