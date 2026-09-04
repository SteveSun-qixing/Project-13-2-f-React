import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { openPptx, type TextElement } from "@genoffice/pptx-engine";
import { SlidesDocumentSession } from "../../src/slides/session";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "../fixtures/01_standard_business.pptx");

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function openFixtureSession(): Promise<SlidesDocumentSession> {
  const bytes = new Uint8Array(readFileSync(fixturePath));
  return SlidesDocumentSession.open(bytes, "/fixtures/01_standard_business.pptx");
}

function firstTextSourceId(session: SlidesDocumentSession): string {
  const slide = session.rebuild(0);
  if (!slide) throw new Error("首页渲染失败");
  const node = slide.nodes.find(
    (n) => (n.type === "text" || n.type === "shape") && n.sourceId,
  );
  if (!node) throw new Error("首页没有可编辑文本元素");
  return node.sourceId;
}

describe("SlidesDocumentSession（本地会话）", () => {
  it("open → getRenderSlide：解析出页面渲染树", async () => {
    const session = await openFixtureSession();
    expect(session.slideCount).toBeGreaterThan(0);
    const slide = session.getRenderSlide(0);
    expect(slide).not.toBeNull();
    expect(slide?.widthPx).toBeGreaterThan(0);
    expect(slide?.heightPx).toBeGreaterThan(0);
    expect(slide?.nodes.length).toBeGreaterThan(0);
  });

  it("applyOp(setText)：文本编辑生效并重出渲染树", async () => {
    const session = await openFixtureSession();
    const sourceId = firstTextSourceId(session);
    const before = session.getRenderSlide(0);

    const result = session.applyOp({
      op: "setText",
      target: { slide: 0, el: sourceId },
      paragraphs: [
        {
          runs: [{ text: "薯片演示文稿测试文本" }],
        },
      ],
    });
    expect(result.applied).toBe(true);

    const after = session.getRenderSlide(0);
    expect(after).not.toBeNull();
    expect(after?.nodes.length).toBe(before?.nodes.length ?? 0);

    const model = session.getElement(0, sourceId);
    expect(model).not.toBeNull();
    const text =
      model && (model.type === "text" || model.type === "shape") ? model.text : undefined;
    expect(
      text?.paragraphs.flatMap((p) => p.runs).map((r) => r.text).join(""),
    ).toContain("薯片演示文稿测试文本");
  });

  it("undo/redo：快照历史可回退与重做", async () => {
    const session = await openFixtureSession();
    const sourceId = firstTextSourceId(session);
    session.applyOp({
      op: "setText",
      target: { slide: 0, el: sourceId },
      paragraphs: [{ runs: [{ text: "历史快照文本" }] }],
    });
    expect(session.canUndo).toBe(true);

    expect(session.undo()).toBe(true);
    expect(session.canRedo).toBe(true);
    expect(session.redo()).toBe(true);
  });

  it("幻灯片级操作：复制当前页后页数加一", async () => {
    const session = await openFixtureSession();
    const before = session.slideCount;
    const result = session.applyOp({ op: "duplicateSlide", target: { slide: 0 } });
    expect(result.applied).toBe(true);
    expect(session.slideCount).toBe(before + 1);
  });

  it("save：保存产物是合法 zip，可再次 open（往返一致）", async () => {
    const session = await openFixtureSession();
    const sourceId = firstTextSourceId(session);
    session.applyOp({
      op: "setText",
      target: { slide: 0, el: sourceId },
      paragraphs: [{ runs: [{ text: "保存往返校验" }] }],
    });

    const bytes = await session.save();
    expect(bytes.length).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("ppt/presentation.xml")).not.toBeNull();

    const reopened = await openPptx(bytes);
    const firstSlide = reopened.deck.slides[0];
    const text = (firstSlide?.elements ?? [])
      .filter((e): e is TextElement => e.type === "text" || e.type === "shape")
      .flatMap((e) => e.text?.paragraphs ?? [])
      .flatMap((p) => p.runs)
      .map((r) => r.text)
      .join("");
    expect(text).toContain("保存往返校验");
  });

  it("未修改文档直接保存：slide XML 逐字节透传", async () => {
    const original = new Uint8Array(readFileSync(fixturePath));
    const session = await SlidesDocumentSession.open(original, null);
    expect(session.isDirty).toBe(false);
    const out = await session.save();

    const origZip = await JSZip.loadAsync(original);
    const outZip = await JSZip.loadAsync(out);
    const opened = await openPptx(original);
    for (const slide of opened.deck.slides) {
      const a = await origZip.file(slide.path)!.async("uint8array");
      const b = await outZip.file(slide.path)!.async("uint8array");
      expect(bytesEqual(b, a)).toBe(true);
    }
  });

  it("setMeta：另存为后更新后续保存目标元信息", async () => {
    const session = await openFixtureSession();
    session.setMeta("/exports/新演示文稿.pptx", "新演示文稿.pptx");
    expect(session.metaInfo).toEqual({
      path: "/exports/新演示文稿.pptx",
      fileName: "新演示文稿.pptx",
    });
  });
});
