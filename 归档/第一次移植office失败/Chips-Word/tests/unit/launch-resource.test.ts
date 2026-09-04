import { describe, expect, it } from "vitest";
import type { PlatformLaunchContext } from "chips-sdk";
import { readDocumentBytes, resolveLaunchDocumentTarget } from "../../src/utils/launch-resource";

function context(launchParams: Record<string, unknown>): PlatformLaunchContext {
  return { launchParams } as unknown as PlatformLaunchContext;
}

describe("resolveLaunchDocumentTarget 打开目标解析优先级", () => {
  it("resourceOpen.filePath 优先于 targetPath 与 resourceId", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        targetPath: "/tmp/fallback.docx",
        resourceOpen: {
          intent: "open",
          resourceId: "chips-resource://word/1",
          filePath: "/Users/demo/报告.docx",
          fileName: "报告.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          title: "季度报告",
        },
      }),
    );
    expect(target).toEqual({
      sourceId: "/Users/demo/报告.docx",
      filePath: "/Users/demo/报告.docx",
      fileName: "报告.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      title: "季度报告",
    });
  });

  it("缺少 filePath 时回退到 launchParams.targetPath", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        targetPath: "/tmp/关联打开.docx",
        resourceOpen: {
          intent: "open",
          resourceId: "chips-resource://word/2",
        },
      }),
    );
    expect(target?.sourceId).toBe("/tmp/关联打开.docx");
    expect(target?.filePath).toBe("/tmp/关联打开.docx");
    expect(target?.fileName).toBe("关联打开.docx");
  });

  it("只有 resourceId 时兜底为资源通道目标", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        resourceOpen: {
          intent: "open",
          resourceId: "https://files.example.com/remote.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }),
    );
    expect(target?.sourceId).toBe("https://files.example.com/remote.docx");
    expect(target?.filePath).toBeNull();
    expect(target?.fileName).toBe("remote.docx");
  });

  it("resourceId 为 chips-resource 协议时不当作本地路径", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        resourceOpen: {
          resourceId: "chips-resource://library/manual.docx",
          fileName: "manual.docx",
        },
      }),
    );
    expect(target?.filePath).toBeNull();
  });

  it("payload 缺失或为空对象时仍可解析目标", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        resourceOpen: {
          resourceId: "/tmp/payload-less.docx",
        },
      }),
    );
    expect(target?.sourceId).toBe("/tmp/payload-less.docx");
  });

  it("file:// URL 转换为本地文件路径", () => {
    const target = resolveLaunchDocumentTarget(
      context({
        resourceOpen: {
          resourceId: "file:///Users/demo/%E6%8A%A5%E5%91%8A.docx",
        },
      }),
    );
    expect(target?.sourceId).toBe("file:///Users/demo/%E6%8A%A5%E5%91%8A.docx");
    expect(target?.filePath).toBe("/Users/demo/报告.docx");
  });

  it("没有可用目标时返回 null（停留起始页）", () => {
    expect(resolveLaunchDocumentTarget(context({}))).toBeNull();
    expect(resolveLaunchDocumentTarget(context({ resourceOpen: { mimeType: "*/*" } }))).toBeNull();
    expect(resolveLaunchDocumentTarget(context({ targetPath: "   " }))).toBeNull();
  });
});

describe("readDocumentBytes 字节读取三通道", () => {
  it("本地路径走 client.file.read 并解包 Buffer JSON 包装", async () => {
    const calls: Array<{ path: string; options?: unknown }> = [];
    const payload = { data: Uint8Array.from([0x50, 0x4b, 0x03, 0x04]) };
    const client = {
      file: {
        read: async (path: string, options?: unknown) => {
          calls.push({ path, options });
          return payload;
        },
      },
      resource: {
        readBinary: async () => {
          throw new Error("不应走资源通道");
        },
      },
    } as never;

    const bytes = await readDocumentBytes(client, {
      sourceId: "/tmp/demo.docx",
      filePath: "/tmp/demo.docx",
      fileName: "demo.docx",
      mimeType: null,
      title: null,
    });

    expect(calls).toEqual([{ path: "/tmp/demo.docx", options: { encoding: "binary" } }]);
    expect(Array.from(bytes)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("http(s) 目标走 fetch 下载", async () => {
    const originalFetch = globalThis.fetch;
    const requested: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      requested.push(String(url));
      return new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
    }) as typeof fetch;
    try {
      const bytes = await readDocumentBytes({} as never, {
        sourceId: "https://files.example.com/remote.docx",
        filePath: null,
        fileName: "remote.docx",
        mimeType: null,
        title: null,
      });
      expect(requested).toEqual(["https://files.example.com/remote.docx"]);
      expect(Array.from(bytes)).toEqual([1, 2, 3]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("其余目标走 client.resource.readBinary", async () => {
    const requested: string[] = [];
    const client = {
      resource: {
        readBinary: async (sourceId: string) => {
          requested.push(sourceId);
          return { content: "AQID" };
        },
      },
    } as never;

    const bytes = await readDocumentBytes(client, {
      sourceId: "chips-resource://word/9",
      filePath: null,
      fileName: "remote.docx",
      mimeType: null,
      title: null,
    });

    expect(requested).toEqual(["chips-resource://word/9"]);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
