import { describe, expect, it } from "vitest";
import {
  createFileUrl,
  guessMimeType,
  joinResourcePath,
  normalizeRelativeResourcePath,
} from "../src/utils";

describe("SDK utils/path 契约测试", () => {
  describe("normalizeRelativeResourcePath", () => {
    it("规范化正斜杠与反斜杠", () => {
      expect(normalizeRelativeResourcePath("a\\b\\c.png")).toBe("a/b/c.png");
    });

    it("去除前导 ./ 与空白", () => {
      expect(normalizeRelativeResourcePath("  ./a/b.png  ")).toBe("a/b.png");
    });

    it("去除 . 段", () => {
      expect(normalizeRelativeResourcePath("a/./b.png")).toBe("a/b.png");
    });

    it("拒绝 .. 逃逸", () => {
      expect(normalizeRelativeResourcePath("../a.png")).toBeNull();
      expect(normalizeRelativeResourcePath("a/../../b.png")).toBeNull();
    });

    it("拒绝空输入与非字符串", () => {
      expect(normalizeRelativeResourcePath("")).toBeNull();
      expect(normalizeRelativeResourcePath(null)).toBeNull();
      expect(normalizeRelativeResourcePath(undefined)).toBeNull();
      expect(normalizeRelativeResourcePath(42)).toBeNull();
    });

    it("拒绝纯 . 段", () => {
      expect(normalizeRelativeResourcePath("./")).toBeNull();
    });
  });

  describe("joinResourcePath", () => {
    it("拼接并统一分隔符", () => {
      expect(joinResourcePath("a", "b", "c.png")).toBe("a/b/c.png");
      expect(joinResourcePath("a/", "", "/b//c")).toBe("a/b/c");
    });
  });

  describe("createFileUrl", () => {
    it("POSIX 路径编码", () => {
      expect(createFileUrl("/tmp/a b/c.png")).toBe("file:///tmp/a%20b/c.png");
    });

    it("Windows 盘符路径编码", () => {
      expect(createFileUrl("C:\\Users\\a\\b.png")).toBe("file:///C:/Users/a/b.png");
    });
  });
});

describe("SDK utils/mime 契约测试", () => {
  it("识别图片/文档/媒体类型", () => {
    expect(guessMimeType("a.png")).toBe("image/png");
    expect(guessMimeType("a.jpeg")).toBe("image/jpeg");
    expect(guessMimeType("a.tiff")).toBe("image/tiff");
    expect(guessMimeType("a.html")).toBe("text/html");
    expect(guessMimeType("a.yaml")).toBe("application/yaml");
    expect(guessMimeType("a.pdf")).toBe("application/pdf");
    expect(guessMimeType("a.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(guessMimeType("a.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(guessMimeType("a.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(guessMimeType("a.csv")).toBe("text/csv");
    expect(guessMimeType("a.mp4")).toBe("video/mp4");
    expect(guessMimeType("a.mp3")).toBe("audio/mpeg");
    expect(guessMimeType("A.PNG")).toBe("image/png");
    expect(guessMimeType("https://example.test/file.xlsx?download=1#sheet")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("未知类型回退 octet-stream", () => {
    expect(guessMimeType("a.unknown")).toBe("application/octet-stream");
    expect(guessMimeType("noextension")).toBe("application/octet-stream");
  });
});
