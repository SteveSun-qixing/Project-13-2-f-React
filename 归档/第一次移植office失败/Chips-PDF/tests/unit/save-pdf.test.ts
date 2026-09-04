import { describe, expect, it } from "vitest";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { applySaveRequest, type SavePdfRequest } from "../../src/pdf/save-pdf";

/** 测试内用 pdf-lib 生成含一页文本的最小 PDF 字节 */
async function createMinimalPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText("Hello Chips PDF", {
    x: 72,
    y: 700,
    size: 24,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  return doc.save();
}

async function loadOutput(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

/** 读取第一页注释数组；无注释时返回空数组 */
function firstPageAnnots(doc: PDFDocument): PDFArray {
  const page = doc.getPages()[0] as ReturnType<PDFDocument["getPages"]>[number];
  return page.node.lookupMaybe(PDFName.of("Annots"), PDFArray) ?? doc.context.obj([]);
}

function annotDictAt(doc: PDFDocument, annots: PDFArray, index: number): PDFDict {
  const ref = annots.get(index);
  const dict = doc.context.lookupMaybe(ref, PDFDict);
  if (!dict) throw new Error(`第 ${index} 条注释不是有效字典`);
  return dict;
}

describe("applySaveRequest（pdf-lib 批注保存链路）", () => {
  it("应用一条墨迹后保存，重新加载可读到 Ink 批注", async () => {
    const source = await createMinimalPdf();
    const request: SavePdfRequest = {
      markups: [],
      drawings: [
        {
          kind: "ink",
          pageIndex: 0,
          color: [0.86, 0.22, 0.18],
          width: 2,
          paths: [
            [100, 400, 140, 430, 180, 410],
            [200, 380, 240, 420],
          ],
        },
      ],
      formValues: [],
      stamps: [],
    };

    const output = await applySaveRequest(source, request);
    expect(output).toBeInstanceOf(Uint8Array);

    const reloaded = await loadOutput(output);
    expect(reloaded.getPageCount()).toBe(1);

    const annots = firstPageAnnots(reloaded);
    expect(annots.size()).toBe(1);

    const dict = annotDictAt(reloaded, annots, 0);
    expect(dict.get(PDFName.of("Subtype"))?.toString()).toBe("/Ink");
    const inkList = dict.lookupMaybe(PDFName.of("InkList"), PDFArray);
    expect(inkList?.size()).toBe(2);
  });

  it("应用一个便签后保存，重新加载可读到 Text 批注内容与作者", async () => {
    const source = await createMinimalPdf();
    const request: SavePdfRequest = {
      markups: [],
      drawings: [
        {
          kind: "note",
          pageIndex: 0,
          color: [1, 0.78, 0.13],
          at: [120, 500],
          contents: "请复核这一段数据",
          author: "测试者",
          createdMs: Date.parse("2026-08-29T10:00:00Z"),
        },
      ],
      formValues: [],
      stamps: [],
    };

    const output = await applySaveRequest(source, request);
    const reloaded = await loadOutput(output);
    expect(reloaded.getPageCount()).toBe(1);

    const annots = firstPageAnnots(reloaded);
    expect(annots.size()).toBe(1);

    const dict = annotDictAt(reloaded, annots, 0);
    expect(dict.get(PDFName.of("Subtype"))?.toString()).toBe("/Text");
    const contents = dict.get(PDFName.of("Contents"));
    expect(contents instanceof PDFHexString).toBe(true);
    expect((contents as PDFHexString).decodeText()).toBe("请复核这一段数据");
    const author = dict.get(PDFName.of("T"));
    expect((author as PDFHexString).decodeText()).toBe("测试者");
  });

  it("页面旋转增量写入最终 /Rotate", async () => {
    const source = await createMinimalPdf();
    const request: SavePdfRequest = {
      markups: [],
      drawings: [],
      formValues: [],
      stamps: [],
      rotations: [{ pageIndex: 0, delta: 90 }],
    };

    const output = await applySaveRequest(source, request);
    const reloaded = await loadOutput(output);
    expect(reloaded.getPageCount()).toBe(1);
    expect(reloaded.getPages()[0]?.getRotation().angle).toBe(90);
  });

  it("保存请求中的文本标记会写入 Highlight 批注", async () => {
    const source = await createMinimalPdf();
    const request: SavePdfRequest = {
      markups: [
        {
          pageIndex: 0,
          type: "highlight",
          color: [1, 0.87, 0.35],
          quads: [[72, 706, 200, 706, 72, 688, 200, 688]],
        },
      ],
      drawings: [],
      formValues: [],
      stamps: [],
    };

    const output = await applySaveRequest(source, request);
    const reloaded = await loadOutput(output);
    const annots = firstPageAnnots(reloaded);
    expect(annots.size()).toBe(1);
    const dict = annotDictAt(reloaded, annots, 0);
    expect(dict.get(PDFName.of("Subtype"))?.toString()).toBe("/Highlight");
    expect(dict.lookupMaybe(PDFName.of("QuadPoints"), PDFArray)).toBeDefined();
  });
});
