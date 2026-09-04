import { describe, expect, it, vi } from "vitest";
import type { Client } from "chips-sdk";
import { readPdfBytes } from "../../src/runtime/file-access";

describe("readPdfBytes", () => {
  it("通过 Host resource.readBinary 读取远程资源", async () => {
    const readBinary = vi.fn(async () => ({ data: new Uint8Array([1, 2, 3]) }));
    const client = { resource: { readBinary } } as unknown as Client;

    await expect(
      readPdfBytes(client, {
        sourceId: "https://example.com/document.pdf",
        fileName: "document.pdf",
      }),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(readBinary).toHaveBeenCalledWith("https://example.com/document.pdf");
  });

  it("本地文件路径通过 Host file.read 读取", async () => {
    const read = vi.fn(async () => ({ content: new Uint8Array([4, 5]) }));
    const client = { file: { read } } as unknown as Client;

    await expect(
      readPdfBytes(client, {
        sourceId: "/tmp/document.pdf",
        filePath: "/tmp/document.pdf",
        fileName: "document.pdf",
      }),
    ).resolves.toEqual(new Uint8Array([4, 5]));
    expect(read).toHaveBeenCalledWith("/tmp/document.pdf", { encoding: "binary" });
  });
});
