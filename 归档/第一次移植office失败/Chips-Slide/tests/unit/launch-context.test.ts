import { describe, expect, it } from "vitest";
import type { Client, PlatformLaunchContext } from "chips-sdk";
import { readLaunchContext, resolveLaunchParams } from "../../src/runtime/launch-context";

describe("启动上下文参数归一", () => {
  it("surface 参数与顶层参数合并，顶层字段优先", () => {
    const context = {
      launchParams: { targetPath: "/top/deck.pptx", trigger: "resource-open-service" },
      surfaceContext: {
        launchParams: { targetPath: "/surface/deck.pptx", surfaceOnly: true },
      },
    } as unknown as PlatformLaunchContext;

    expect(resolveLaunchParams(context)).toEqual({
      targetPath: "/top/deck.pptx",
      trigger: "resource-open-service",
      surfaceOnly: true,
    });
  });

  it("readLaunchContext 输出归一后的 launchParams", () => {
    const context = {
      pluginId: "com.chips.slide",
      launchParams: { targetPath: "/top/deck.pptx" },
      surfaceContext: {
        pluginId: "com.chips.slide",
        sceneId: "start",
        kind: "window",
        launchParams: { resourceOpen: { resourceId: "pptx-resource" } },
      },
    } as unknown as PlatformLaunchContext;
    const client = {
      platform: { getLaunchContext: () => context },
    } as unknown as Client;

    expect(readLaunchContext(client).launchParams).toEqual({
      targetPath: "/top/deck.pptx",
      resourceOpen: { resourceId: "pptx-resource" },
    });
  });
});
