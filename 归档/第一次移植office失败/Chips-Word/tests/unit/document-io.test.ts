import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocx, saveDocx } from "@genoffice/docx-engine";
import { blocksToPmDoc, pmDocToSavePlan, type PmNode } from "../../src/editor/convert";
import { parseDocxBytes, looksLikeZipContainer } from "../../src/lib/document-io";

/**
 * docStyleCss 生成样式选择器时使用浏览器 CSSOM 的 CSS.escape；
 * Node 测试环境没有该全局，按 CSSOM 规范提供一个等价转义实现。
 * 该 shim 在模块初始化阶段安装，先于任何测试用例执行。
 */
type CssGlobal = { escape?(value: string): string };
const cssGlobal = globalThis as typeof globalThis & { CSS?: CssGlobal };
if (!cssGlobal.CSS || typeof cssGlobal.CSS.escape !== "function") {
  cssGlobal.CSS = {
    ...cssGlobal.CSS,
    escape(value: string): string {
      const text = String(value);
      const first = text.charCodeAt(0);
      const leadingDigit = first >= 0x30 && first <= 0x39;
      const head = leadingDigit ? `\\${text.charAt(0)} ` : "";
      return (
        head +
        text.slice(leadingDigit ? 1 : 0).replace(
          /[^a-zA-Z0-9_\u00a0-\uffff-]/g,
          (char) => `\\${char}`,
        )
      );
    },
  };
}

const fixturePath = path.resolve(__dirname, "../fixtures/simple.docx");
const simpleDocxBytes = () => new Uint8Array(readFileSync(fixturePath));

function visibleBlockTexts(doc: PmNode): string[] {
  return (doc.content ?? [])
    .filter((node) => node.type !== "paginationGap" && node.type !== "sectionBreakMark")
    .map((node) => collectText(node));
}

function collectText(node: PmNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  return (node.content ?? []).map(collectText).join("");
}

function visibleRunTexts(blocks: Array<{ hidden?: boolean; runs?: Array<{ text?: string }> }>): string[] {
  return blocks
    .filter((block) => !block.hidden)
    .map((block) => (block.runs ?? []).map((run) => run.text ?? "").join(""));
}

describe("document-io 最小 docx 回环", () => {
  it("parseDocx → blocksToPmDoc → pmDocToSavePlan → saveDocx 产物可再次解析且内容一致", async () => {
    const bytes = simpleDocxBytes();
    const parsed = await parseDocx(bytes);
    expect(parsed.blocks.filter((block) => !block.hidden).length).toBe(3);

    const pmDoc = blocksToPmDoc(parsed.blocks);
    expect(visibleBlockTexts(pmDoc)).toEqual(["标题", "第一段。", "第二段。"]);

    const plan = pmDocToSavePlan(pmDoc, parsed.blocks);
    const savedBytes = await saveDocx(parsed, plan.saveBlocks);

    const reparsed = await parseDocx(savedBytes);
    expect(reparsed.blocks.length).toBe(parsed.blocks.length);
    expect(visibleRunTexts(reparsed.blocks)).toEqual(["标题", "第一段。", "第二段。"]);
  }, 30000);

  it("parseDocxBytes 产出编辑器文档、分节设置与文档 CSS", async () => {
    const outcome = await parseDocxBytes(simpleDocxBytes());
    expect(outcome.parsed.blocks.length).toBeGreaterThan(0);
    expect(outcome.pmDoc.type).toBe("doc");
    expect(visibleBlockTexts(outcome.pmDoc)).toEqual(["标题", "第一段。", "第二段。"]);
    expect(outcome.section.pageWidth).toBeGreaterThan(0);
    expect(outcome.section.pageHeight).toBeGreaterThan(0);
    expect(typeof outcome.css).toBe("string");
  }, 30000);

  it("OLE 复合文档魔数按加密文档拒绝，合法 zip 正常打开", async () => {
    const encryptedLike = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
    ]);
    await expect(parseDocxBytes(encryptedLike)).rejects.toMatchObject({ kind: "encrypted" });
    await expect(parseDocxBytes(simpleDocxBytes())).resolves.toBeTruthy();
  }, 30000);

  it("空字节和非 ZIP 数据在进入 JSZip 前按无效 docx 拒绝", async () => {
    expect(looksLikeZipContainer(new Uint8Array())).toBe(false);
    expect(looksLikeZipContainer(new TextEncoder().encode("not a docx"))).toBe(false);
    await expect(parseDocxBytes(new Uint8Array())).rejects.toMatchObject({
      name: "DocumentOpenError",
      kind: "parse",
      message: "文件不是有效的 .docx 压缩包",
    });
    await expect(parseDocxBytes(new TextEncoder().encode("not a docx"))).rejects.toMatchObject({
      name: "DocumentOpenError",
      kind: "parse",
      message: "文件不是有效的 .docx 压缩包",
    });
  });

  it("ZIP 外壳缺少 OOXML 文档部件时仍返回统一解析错误", async () => {
    const emptyZip = Uint8Array.from([
      0x50, 0x4b, 0x05, 0x06,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0,
    ]);
    await expect(parseDocxBytes(emptyZip)).rejects.toMatchObject({
      name: "DocumentOpenError",
      kind: "parse",
    });
  });

  it("保存计划不改写正文时跳过隐藏分节块并产出全部可见块", async () => {
    const bytes = simpleDocxBytes();
    const parsed = await parseDocx(bytes);
    const pmDoc = blocksToPmDoc(parsed.blocks);
    const plan = pmDocToSavePlan(pmDoc, parsed.blocks);
    expect(plan.saveBlocks.length).toBe(parsed.blocks.filter((block) => !block.hidden).length);
  }, 30000);
});
