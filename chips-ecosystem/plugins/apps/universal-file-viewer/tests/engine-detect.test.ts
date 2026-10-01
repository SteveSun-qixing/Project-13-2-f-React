import { describe, expect, it } from "vitest";
import {
  getExtension,
  hasExplicitMimeType,
  isTextLike,
  normalizeFile
} from "../src/engine/detect";
import { decodeTextBuffer, decodeTextBytes, escapeHtml, resolveFormat } from "../src/engine/plugins/utils";

/** 构造带真实签名的最小字节样本。 */
function bytesOf(...chunks: Array<number | string | readonly number[]>): Uint8Array<ArrayBuffer> {
  const flat: number[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === "number") {
      flat.push(chunk);
    } else if (typeof chunk === "string") {
      flat.push(...new TextEncoder().encode(chunk));
    } else {
      flat.push(...chunk);
    }
  }
  const out = new Uint8Array(flat.length);
  out.set(flat);
  return out;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04] as const;
const PDF_PROLOGUE = "%PDF-1.4\n";

/** 通过 normalizeFile 的 ArrayBuffer 路径读取总表（引擎真实读取面）。 */
async function extensionMimeLookup(extension: string): Promise<string> {
  const file = await normalizeFile(new ArrayBuffer(0), `probe.${extension}`);
  return file.mimeType;
}

describe("detect：扩展名→MIME 总表（G-4 单一事实源抽查）", () => {
  it("覆盖图片、音视频、版式、文档与 GIS 核心格式", async () => {
    const samples: Array<[string, string]> = [
      ["png", "image/png"],
      ["svg", "image/svg+xml"],
      ["heic", "image/heic"],
      ["tif", "image/tiff"],
      ["mp4", "video/mp4"],
      ["mkv", "video/x-matroska"],
      ["m3u8", "application/vnd.apple.mpegurl"],
      ["flac", "audio/flac"],
      ["opus", "audio/opus"],
      ["pdf", "application/pdf"],
      ["epub", "application/epub+zip"],
      ["xps", "application/vnd.ms-xpsdocument"],
      ["ofd", "application/ofd"],
      ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["doc", "application/msword"],
      ["rtf", "application/rtf"],
      ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      ["odt", "application/vnd.oasis.opendocument.text"],
      ["zip", "application/zip"],
      ["7z", "application/x-7z-compressed"],
      ["xz", "application/x-xz"],
      ["eml", "message/rfc822"],
      ["msg", "application/vnd.ms-outlook"],
      ["gltf", "model/gltf+json"],
      ["stl", "model/stl"],
      ["dxf", "image/vnd.dxf"],
      ["dwg", "application/acad"],
      ["geojson", "application/geo+json"],
      ["kml", "application/vnd.google-earth.kml+xml"],
      ["drawio", "application/vnd.jgraph.mxfile"],
      ["xmind", "application/vnd.xmind.workbook"],
      ["ttf", "font/ttf"],
      ["psd", "image/vnd.adobe.photoshop"],
      ["parquet", "application/vnd.apache.parquet"],
      ["mmd", "text/vnd.mermaid"]
    ];
    for (const [extension, expected] of samples) {
      expect(await extensionMimeLookup(extension), `扩展名 .${extension} 应映射为 ${expected}`).toBe(expected);
      expect(getExtension(`${extension}-probe.${extension}`)).toBe(extension);
    }
  });

  it("无扩展名与多段扩展名解析", () => {
    expect(getExtension("无扩展名")).toBe("");
    expect(getExtension("archive.tar.gz")).toBe("gz");
    expect(getExtension("图片.HEIC")).toBe("heic");
    expect(getExtension("read.me?v=1#x")).toBe("me");
  });
});

describe("detect：normalizeFile 真实字节装载", () => {
  it("Blob 源携带真实 PNG 签名字节与推断 MIME", async () => {
    const blob = new Blob([bytesOf(...PNG_SIGNATURE)], { type: "image/png" });
    const file = await normalizeFile(blob, "像素.png");
    expect(file.name).toBe("像素.png");
    expect(file.extension).toBe("png");
    expect(file.mimeType).toBe("image/png");
    expect(file.size).toBe(PNG_SIGNATURE.length);
    expect(file.blob).toBeInstanceOf(Blob);
    expect(hasExplicitMimeType(file)).toBe(false);
  });

  it("显式 MIME 优先于扩展名推断并记入显式集合", async () => {
    const file = await normalizeFile(new Blob([bytesOf(PDF_PROLOGUE)]), "报告.dat", "application/pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.extension).toBe("dat");
    expect(hasExplicitMimeType(file)).toBe(true);
  });

  it("ArrayBuffer 源按扩展名落入 Blob 类型", async () => {
    const file = await normalizeFile(bytesOf(...ZIP_LOCAL_HEADER).buffer, "包.zip");
    expect(file.mimeType).toBe("application/zip");
    expect(file.blob?.type).toBe("application/zip");
    expect(file.size).toBe(ZIP_LOCAL_HEADER.length);
  });

  it("远程 URL 源保留 url 并从路径取名", async () => {
    const file = await normalizeFile("https://example.com/docs/%E6%8A%A5%E5%91%8A.pdf?download=1");
    expect(file.name).toBe("报告.pdf");
    expect(file.url).toBe("https://example.com/docs/%E6%8A%A5%E5%91%8A.pdf?download=1");
    expect(file.mimeType).toBe("application/pdf");
  });
});

describe("detect：isTextLike 归类", () => {
  it("文本类扩展名与 MIME 判真", async () => {
    for (const name of ["a.ts", "b.json", "c.md", "d.csv", "e.lrc", "f.yaml", "g.html", "h.py"]) {
      const extension = getExtension(name);
      const mime = await extensionMimeLookup(extension);
      expect(isTextLike({ source: "", name, extension, mimeType: mime }), `${name} 应判为文本类`).toBe(true);
    }
  });

  it("无扩展名配置文件与特殊文件名判真", () => {
    expect(isTextLike({ source: "", name: "Dockerfile", extension: "", mimeType: "text/plain" })).toBe(true);
    expect(isTextLike({ source: "", name: "go.mod", extension: "", mimeType: "" })).toBe(true);
    expect(isTextLike({ source: "", name: "LICENSE", extension: "", mimeType: "" })).toBe(true);
    expect(isTextLike({ source: "", name: ".gitignore", extension: "gitignore", mimeType: "text/plain" })).toBe(true);
  });

  it("二进制格式判假", () => {
    expect(isTextLike({ source: "", name: "a.png", extension: "png", mimeType: "image/png" })).toBe(false);
    expect(isTextLike({ source: "", name: "a.pdf", extension: "pdf", mimeType: "application/pdf" })).toBe(false);
    expect(isTextLike({ source: "", name: "a.zip", extension: "zip", mimeType: "application/zip" })).toBe(false);
    expect(isTextLike({ source: "", name: "a.psd", extension: "psd", mimeType: "image/vnd.adobe.photoshop" })).toBe(false);
  });
});

describe("plugins/utils：文本解码与工具函数（真实字节）", () => {
  it("UTF-8 中文解码", () => {
    const encoded = new TextEncoder().encode("薯片生态·万能预览");
    expect(decodeTextBytes(encoded)).toBe("薯片生态·万能预览");
  });

  it("UTF-8 BOM 剥离", () => {
    const encoded = bytesOf(0xef, 0xbb, 0xbf, "带 BOM 的文本");
    expect(decodeTextBytes(encoded)).toBe("带 BOM 的文本");
  });

  it("UTF-16LE BOM 解码", () => {
    // “门” = U+95E8 → LE 字节序 E8 95
    const encoded = bytesOf(0xff, 0xfe, 0xe8, 0x95);
    expect(decodeTextBytes(encoded)).toBe("门");
  });

  it("GB18030 回退解码（非法 UTF-8 序列）", () => {
    // “测试”的 GB18030 编码：B2 E2 CA D4（非合法 UTF-8 序列，触发回退）
    expect(decodeTextBytes(Uint8Array.of(0xb2, 0xe2, 0xca, 0xd4))).toBe("测试");
  });

  it("decodeTextBuffer 与字节版一致", () => {
    const buffer = new TextEncoder().encode("buffer 源").buffer;
    expect(decodeTextBuffer(buffer)).toBe("buffer 源");
  });

  it("escapeHtml 转义全部危险字符", () => {
    expect(escapeHtml(`<img src="x" onerror='a'>&`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#039;a&#039;&gt;&amp;"
    );
  });

  it("resolveFormat 优先扩展名、回退 MIME 反查", () => {
    expect(resolveFormat({ extension: "docx", mimeType: "" }, { "application/msword": "doc" })).toBe("docx");
    expect(resolveFormat({ extension: "", mimeType: "application/msword" }, { "application/msword": "doc" })).toBe("doc");
    expect(resolveFormat({ extension: "", mimeType: "" }, {})).toBe("");
  });
});
