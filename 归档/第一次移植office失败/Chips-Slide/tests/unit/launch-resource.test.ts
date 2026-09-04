import { describe, expect, it } from "vitest";
import type { Client, PlatformLaunchContext } from "chips-sdk";
import {
  resolveLaunchFileTarget,
  unwrapBinaryPayload,
} from "../../src/utils/launch-resource";

function launch(params: Record<string, unknown>): PlatformLaunchContext {
  return {
    pluginId: "com.chips.slide",
    kind: "window",
    launchParams: params,
  } as unknown as PlatformLaunchContext;
}

describe("启动目标解析（解析优先级回归）", () => {
  it("resourceOpen.filePath 优先于 targetPath 与 resourceId", () => {
    const target = resolveLaunchFileTarget(
      launch({
        resourceOpen: {
          intent: "open-file",
          resourceId: "res-123",
          filePath: "/docs/deck.pptx",
          fileName: "deck.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
        targetPath: "/legacy/target.pptx",
      }),
    );
    expect(target).not.toBeNull();
    expect(target?.sourceId).toBe("/docs/deck.pptx");
    expect(target?.filePath).toBe("/docs/deck.pptx");
    expect(target?.fileName).toBe("deck.pptx");
  });

  it("无 filePath 时回退 targetPath", () => {
    const target = resolveLaunchFileTarget(
      launch({
        resourceOpen: { intent: "open-file", resourceId: "res-123" },
        targetPath: "/legacy/target.pptx",
      }),
    );
    expect(target?.sourceId).toBe("/legacy/target.pptx");
    expect(target?.filePath).toBe("/legacy/target.pptx");
  });

  it("无本地路径时使用 resourceId（资源源通道）", () => {
    const target = resolveLaunchFileTarget(
      launch({ resourceOpen: { intent: "open-file", resourceId: "res-123" } }),
    );
    expect(target?.sourceId).toBe("res-123");
    expect(target?.filePath).toBeNull();
  });

  it("无启动参数时返回 null（停留起始页）", () => {
    expect(resolveLaunchFileTarget(launch({}))).toBeNull();
    expect(resolveLaunchFileTarget(null)).toBeNull();
  });
});

describe("二进制载荷解包（Buffer JSON 包装兼容）", () => {
  it("直接透传 Uint8Array", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(unwrapBinaryPayload(bytes)).toEqual(bytes);
  });

  it("解包 ArrayBuffer", () => {
    const bytes = unwrapBinaryPayload(new Uint8Array([9, 8]).buffer);
    expect(Array.from(bytes)).toEqual([9, 8]);
  });

  it("解包 {data} 包装（Buffer JSON 形态）", () => {
    const bytes = unwrapBinaryPayload({ data: [104, 101, 108, 108, 111] });
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111]);
  });

  it("解包 {content} 包装", () => {
    const bytes = unwrapBinaryPayload({ content: [1, 2] });
    expect(Array.from(bytes)).toEqual([1, 2]);
  });

  it("裸字节数组直接转换", () => {
    const bytes = unwrapBinaryPayload([250, 199]);
    expect(Array.from(bytes)).toEqual([250, 199]);
  });
});

describe("Host 资源读取通道", () => {
  it("http(s) 资源 ID 走 Host resource.readBinary", async () => {
    const bytes = new Uint8Array([80, 75]);
    const readBinary = async (sourceId: string) => {
      expect(sourceId).toBe("https://example.com/deck.pptx");
      return bytes;
    };

    const { readLaunchFileBytes } = await import("../../src/utils/launch-resource");
    const result = await readLaunchFileBytes({ resource: { readBinary } } as unknown as Client, {
      sourceId: "https://example.com/deck.pptx",
      filePath: null,
      fileName: "deck.pptx",
      mimeType: null,
      title: null,
    });
    expect(Array.from(result)).toEqual([80, 75]);
  });

  it("file:// URL 仍走 Host resource.readBinary，不伪装成本地路径", async () => {
    const readBinary = async (sourceId: string) => {
      expect(sourceId).toBe("file:///docs/deck.pptx");
      return new Uint8Array([80, 75]);
    };
    const { readLaunchFileBytes } = await import("../../src/utils/launch-resource");
    const result = await readLaunchFileBytes({ resource: { readBinary } } as unknown as Client, {
      sourceId: "file:///docs/deck.pptx",
      filePath: "file:///docs/deck.pptx",
      fileName: "deck.pptx",
      mimeType: null,
      title: null,
    });
    expect(Array.from(result)).toEqual([80, 75]);
  });
});
