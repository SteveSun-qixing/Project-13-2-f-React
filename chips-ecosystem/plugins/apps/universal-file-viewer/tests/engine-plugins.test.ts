import { describe, expect, it } from "vitest";
import { normalizeFile } from "../src/engine/detect";
import type { PreviewFile } from "../src/engine/types";
import {
  archivePlugin,
  assetPlugin,
  audioPlugin,
  cadPlugin,
  drawingPlugin,
  emailPlugin,
  epubPlugin,
  fallbackPlugin,
  gisPlugin,
  imagePlugin,
  model3dPlugin,
  officePlugin,
  ofdPlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin,
  xmindPlugin,
  xpsPlugin,
  type PreviewPlugin
} from "../src/engine";
import { createViewerPlugins } from "../src/domain/engine-plugins";
import { isPreviewableTarget } from "../src/domain/open-targets";

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

const PDF_PROLOGUE = "%PDF-1.4\n";

async function fixture(name: string, content: Uint8Array<ArrayBuffer> | string): Promise<PreviewFile> {
  return normalizeFile(new Blob([content]), name);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04] as const;
const SEVEN_Z_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] as const;
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const TTF_SIGNATURE = [0x00, 0x01, 0x00, 0x00] as const;
const PSD_SIGNATURE = [0x38, 0x42, 0x50, 0x53] as const;

const MINIMAL_GEOJSON = `{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"点A"},"geometry":{"type":"Point","coordinates":[116.4,39.9]}}]}`;
const MINIMAL_DXF = ["0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF", ""].join("\n");
const MINIMAL_GLTF = `{"asset":{"version":"2.0"},"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}]}`;
const MINIMAL_DRAWIO = `<mxfile><diagram name="页-1"><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>`;
const MINIMAL_EML = [
  "From: 发件人 <from@example.com>",
  "To: to@example.com",
  "Subject: =?utf-8?B?5L2g5aW9?=",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "你好，这是一封最小合法邮件。",
  ""
].join("\r\n");

async function expectMatch(plugin: PreviewPlugin, file: PreviewFile, expected = true): Promise<void> {
  expect(await plugin.match(file), `${plugin.name} 对 ${file.name} 应${expected ? "" : "不"}匹配`).toBe(expected);
}

describe("引擎格式插件：逐格式探测路由（真实最小样本）", () => {
  it("图片插件接受真实 PNG 签名、拒绝 DXF（CAD 专属）", async () => {
    const plugin = imagePlugin();
    await expectMatch(plugin, await fixture("照片.png", bytesOf(...PNG_SIGNATURE)));
    await expectMatch(plugin, await fixture("照片.webp", bytesOf("RIFF", 0x00, 0x00, 0x00, 0x00, "WEBP")));
    await expectMatch(plugin, await fixture("图纸.dxf", bytesOf(MINIMAL_DXF)), false);
  });

  it("视频插件接受 MP4 ftyp 样本", async () => {
    const plugin = videoPlugin();
    const mp4 = bytesOf([0x00, 0x00, 0x00, 0x18], "ftypmp42", [0x00, 0x00, 0x00, 0x00], "mp42isom");
    await expectMatch(plugin, await fixture("影片.mp4", mp4));
    await expectMatch(plugin, await fixture("直播.m3u8", bytesOf("#EXTM3U\n")));
  });

  it("音频插件接受 MP3 ID3 样本", async () => {
    const plugin = audioPlugin();
    await expectMatch(plugin, await fixture("歌曲.mp3", bytesOf("ID3", [0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])));
    await expectMatch(plugin, await fixture("录音.flac", bytesOf("fLaC")));
  });

  it("PDF 插件接受 %PDF 序列样本", async () => {
    await expectMatch(pdfPlugin(), await fixture("文档.pdf", bytesOf(PDF_PROLOGUE)));
  });

  it("EPUB/XPS/OFD 版式插件按扩展名与 MIME 命中", async () => {
    await expectMatch(epubPlugin(), await fixture("书.epub", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(xpsPlugin(), await fixture("版式.xps", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(xpsPlugin(), await fixture("版式.oxps", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(ofdPlugin(), await fixture("发票.ofd", bytesOf(...ZIP_LOCAL_HEADER)));
  });

  it("Office 插件接受 OOXML/OLE/RTF 真实签名", async () => {
    const plugin = officePlugin();
    await expectMatch(plugin, await fixture("文档.docx", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(plugin, await fixture("表格.xlsx", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(plugin, await fixture("演示.pptx", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(plugin, await fixture("旧文档.doc", bytesOf(...OLE_SIGNATURE)));
    await expectMatch(plugin, await fixture("富文本.rtf", bytesOf(`{\\rtf1\\ansi}`)));
    await expectMatch(plugin, await fixture("表格.csv", bytesOf("a,b,c\n1,2,3\n")));
  });

  it("压缩包插件接受 ZIP/7z 真实签名", async () => {
    const plugin = archivePlugin();
    await expectMatch(plugin, await fixture("包.zip", bytesOf(...ZIP_LOCAL_HEADER)));
    await expectMatch(plugin, await fixture("包.7z", bytesOf(...SEVEN_Z_SIGNATURE)));
    await expectMatch(plugin, await fixture("包.tar.gz", bytesOf([0x1f, 0x8b])));
  });

  it("邮件插件接受 RFC822 样本", async () => {
    const plugin = emailPlugin();
    await expectMatch(plugin, await fixture("邮件.eml", bytesOf(MINIMAL_EML)));
    await expectMatch(plugin, await fixture("邮箱.mbox", bytesOf(`From aaa@bbb Mon Jan 01 00:00:00 2024\n${MINIMAL_EML}`)));
  });

  it("绘图插件接受 drawio XML 样本", async () => {
    await expectMatch(drawingPlugin(), await fixture("白板.drawio", bytesOf(MINIMAL_DRAWIO)));
    await expectMatch(drawingPlugin(), await fixture("白板.excalidraw", bytesOf(`{"type":"excalidraw"}`)));
  });

  it("XMind 插件按扩展名命中", async () => {
    await expectMatch(xmindPlugin(), await fixture("脑图.xmind", bytesOf(...ZIP_LOCAL_HEADER)));
  });

  it("CAD 插件接受 DXF 文本样本且 DWG 仅走兜底卡", async () => {
    const plugin = cadPlugin();
    await expectMatch(plugin, await fixture("图纸.dxf", bytesOf(MINIMAL_DXF)));
    await expectMatch(plugin, await fixture("图纸.dwg", bytesOf(...OLE_SIGNATURE)));
    await expectMatch(plugin, await fixture("模型.step", bytesOf("ISO-10303-21;")));
  });

  it("3D 插件接受 glTF JSON 样本、不抢占纯文本", async () => {
    const plugin = model3dPlugin();
    await expectMatch(plugin, await fixture("模型.gltf", bytesOf(MINIMAL_GLTF)));
    await expectMatch(plugin, await fixture("模型.stl", bytesOf("solid model\n")));
    await expectMatch(plugin, await fixture("笔记.txt", bytesOf("纯文本")), false);
  });

  it("GIS 插件接受 GeoJSON 样本", async () => {
    await expectMatch(gisPlugin(), await fixture("地图.geojson", bytesOf(MINIMAL_GEOJSON)));
  });

  it("设计资产插件接受 TTF/PSD 真实签名", async () => {
    const plugin = assetPlugin();
    await expectMatch(plugin, await fixture("字体.ttf", bytesOf(...TTF_SIGNATURE)));
    await expectMatch(plugin, await fixture("设计稿.psd", bytesOf(...PSD_SIGNATURE)));
    await expectMatch(plugin, await fixture("数据.parquet", bytesOf("PAR1")));
  });

  it("文本插件接受代码与 markdown、拒绝二进制", async () => {
    const plugin = textPlugin();
    await expectMatch(plugin, await fixture("脚本.ts", bytesOf(`const x: number = 1;\n`)));
    await expectMatch(plugin, await fixture("说明.md", bytesOf("# 标题\n")));
    await expectMatch(plugin, await fixture("歌词.lrc", bytesOf("[ti:测试]\n[00:01.00]歌词\n")));
    await expectMatch(plugin, await fixture("图.png", bytesOf(...PNG_SIGNATURE)), false);
  });

  it("fallback 兜底接受任意输入且排序在末位", async () => {
    await expectMatch(fallbackPlugin(), await fixture("未知.xyz", bytesOf([0x00, 0x01, 0x02, 0x03])));
    expect(fallbackPlugin().name).toBe("fallback");
  });
});

describe("领域装配：createViewerPlugins 顺序与配置", () => {
  const names = createViewerPlugins().map((plugin) => plugin.name);

  it("插件表按「专用在前、fallback 收尾」排序", () => {
    expect(names).toEqual([
      "image",
      "video",
      "audio",
      "pdf",
      "epub",
      "xps",
      "office",
      "ofd",
      "archive",
      "email",
      "drawing",
      "xmind",
      "cad",
      "model3d",
      "gis",
      "asset",
      "text",
      "fallback"
    ]);
  });

  it("fallback 恒在末位且表内无重复", () => {
    expect(names[names.length - 1]).toBe("fallback");
    expect(new Set(names).size).toBe(names.length);
  });

  it("DWG 二进制解码链路不在装配表内（矩阵废弃裁决）", () => {
    // 剔除 cad-dwg/cad-webgl 后，DWG 只能命中 cad 插件的元数据兜底卡，不再有解码入口。
    const viewerPlugins = createViewerPlugins();
    expect(viewerPlugins.some((plugin) => plugin.name.includes("dwg"))).toBe(false);
  });
});

describe("领域装配：isPreviewableTarget 预判", () => {
  it("支持的格式返回真", async () => {
    await expect(isPreviewableTarget(new Blob([bytesOf(PDF_PROLOGUE)]), { fileName: "文档.pdf" })).resolves.toBe(true);
    await expect(isPreviewableTarget(new Blob([bytesOf("文本")]), { fileName: "笔记.txt" })).resolves.toBe(true);
    await expect(isPreviewableTarget(new Blob([bytesOf(...ZIP_LOCAL_HEADER)]), { fileName: "包.zip" })).resolves.toBe(true);
  });

  it("未知格式不算可用预览路径（fallback 不计）", async () => {
    await expect(isPreviewableTarget(new Blob([bytesOf([0x00, 0xff, 0x00, 0xff])]), { fileName: "神秘.xyz" })).resolves.toBe(
      false
    );
  });

  it("DXF 由 CAD 插件承接（图片插件显式让位）", async () => {
    await expect(isPreviewableTarget(new Blob([bytesOf(MINIMAL_DXF)]), { fileName: "图纸.dxf" })).resolves.toBe(true);
  });
});
