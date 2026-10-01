import { describe, expect, it } from "vitest";
import {
  fileUrlToPathLike,
  formatFileSize,
  isLikelyLocalPath,
  isStreamingMediaMime,
  resolveDeliveryKind,
  resolveFileExtension,
  resolveFileName
} from "../src/domain/file-kind";

describe("文件类型工具（装载归类，矩阵迁移判例）", () => {
  it("音视频走 URI 串流，其余走字节装载", () => {
    expect(resolveDeliveryKind("video/mp4")).toBe("uri");
    expect(resolveDeliveryKind("audio/flac")).toBe("uri");
    expect(resolveDeliveryKind("application/pdf")).toBe("bytes");
    expect(resolveDeliveryKind(undefined)).toBe("bytes");
    expect(isStreamingMediaMime("IMAGE/PNG")).toBe(false);
    expect(isStreamingMediaMime("video/quicktime")).toBe(true);
  });

  it("解析文件名与扩展名", () => {
    expect(resolveFileName("/tmp/目录/演示文稿.pptx")).toBe("演示文稿.pptx");
    expect(resolveFileName("https://example.com/a/report.xlsx?download=1")).toBe("report.xlsx");
    expect(resolveFileExtension("photo.HEIC")).toBe("heic");
    expect(resolveFileExtension("无扩展名")).toBe("");
  });

  it("识别本地路径与 http(s) 资源", () => {
    expect(isLikelyLocalPath("/tmp/a.pdf")).toBe(true);
    expect(isLikelyLocalPath("file:///tmp/a.pdf")).toBe(true);
    expect(isLikelyLocalPath("C:\\Users\\demo\\a.pdf")).toBe(true);
    expect(isLikelyLocalPath("https://example.com/a.pdf")).toBe(false);
    expect(isLikelyLocalPath("chips-render://card-root/token/a.png")).toBe(false);
  });

  it("file:// URL 解码为本地路径", () => {
    expect(fileUrlToPathLike("file:///tmp/%E6%B5%8B%E8%AF%95.pdf")).toBe("/tmp/测试.pdf");
    expect(fileUrlToPathLike("/tmp/plain.pdf")).toBe("/tmp/plain.pdf");
  });

  it("格式化文件大小", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(undefined)).toBeUndefined();
  });
});
