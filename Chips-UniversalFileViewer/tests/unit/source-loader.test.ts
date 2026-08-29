import { afterEach, describe, expect, it } from "vitest";
import { createMockChipsClient, type MockChipsClient } from "chips-sdk/testing";
import { loadViewerFile, toPreviewItems } from "../../src/utils/source-loader";

const clients: MockChipsClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.restoreBridge();
  }
});

function createTrackedClient(): MockChipsClient {
  const client = createMockChipsClient();
  clients.push(client);
  return client;
}

describe("loadViewerFile", () => {
  it("音视频资源解析为可流式播放的 URI", async () => {
    const client = createTrackedClient();
    client.mockHost.setActionHandler("resource.resolve", () => ({ uri: "file:///tmp/测试视频.mp4" }));

    const loaded = await loadViewerFile(client, {
      sourceId: "/tmp/测试视频.mp4",
      filePath: "/tmp/测试视频.mp4",
      fileName: "测试视频.mp4",
      mimeType: "video/mp4",
    });

    expect(loaded.source).toBe("file:///tmp/测试视频.mp4");
    expect(loaded.fileName).toBe("测试视频.mp4");
  });

  it("本地路径资源读取字节并构造 File 对象", async () => {
    const client = createTrackedClient();
    client.mockHost.setActionHandler("file.read", () => ({
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    }));

    const loaded = await loadViewerFile(client, {
      sourceId: "/tmp/manual.pdf",
      filePath: "/tmp/manual.pdf",
      fileName: "manual.pdf",
      mimeType: "application/pdf",
    });

    expect(loaded.source).toBeInstanceOf(File);
    const file = loaded.source as File;
    expect(file.name).toBe("manual.pdf");
    expect(file.size).toBe(4);
    expect(loaded.size).toBe(4);
  });

  it("file:// URL 解码后走本地文件读取", async () => {
    const client = createTrackedClient();
    let receivedPath = "";
    client.mockHost.setActionHandler("file.read", (payload) => {
      receivedPath = (payload as { path: string }).path;
      return { content: new Uint8Array([1, 2, 3]) };
    });

    await loadViewerFile(client, {
      sourceId: "file:///tmp/%E6%8A%A5%E8%A1%A8.xlsx",
      fileName: "报表.xlsx",
      mimeType: "application/vnd.ms-excel",
    });

    expect(receivedPath).toBe("/tmp/报表.xlsx");
  });

  it("http(s) 资源直接交给引擎按 URL 加载", async () => {
    const client = createTrackedClient();

    const loaded = await loadViewerFile(client, {
      sourceId: "https://example.com/files/manual.pdf",
      fileName: "manual.pdf",
      mimeType: "application/pdf",
    });

    expect(loaded.source).toBe("https://example.com/files/manual.pdf");
  });

  it("Host 托管资源通过 resource.readBinary 读取字节", async () => {
    const client = createTrackedClient();
    client.mockHost.setActionHandler("resource.readBinary", () => ({
      data: new Uint8Array([9, 8, 7]),
    }));

    const loaded = await loadViewerFile(client, {
      sourceId: "chips-render://card-root/token/assets/demo.png",
      fileName: "demo.png",
      mimeType: "image/png",
    });

    expect(loaded.source).toBeInstanceOf(File);
    expect((loaded.source as File).size).toBe(3);
  });

  it("转换预览队列时保留文件名与 MIME", () => {
    const items = toPreviewItems([
      { source: "file:///tmp/a.mp4", fileName: "a.mp4", mimeType: "video/mp4" },
      { source: new File([new Uint8Array([1])], "b.pdf", { type: "application/pdf" }), fileName: "b.pdf", mimeType: "application/pdf" },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ fileName: "a.mp4", mimeType: "video/mp4" });
    expect(items[1]?.file).toBeInstanceOf(File);
  });
});
