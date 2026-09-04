import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOptionList,
  PDFRef,
  PDFString,
  degrees,
} from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { MarkupInput } from "./annotations";
import { MARKUP_SUBTYPES } from "./annotations";
import type { DrawingInput, NoteReplyTarget } from "./drawings";
import type { FormValueInput } from "./form-catalog";

const num = (v: number): number => Math.round(v * 100) / 100;

/** 保存请求：批注、表单、印章、页面旋转/删除与元数据 */
export interface SavePdfRequest {
  markups: MarkupInput[];
  drawings: DrawingInput[];
  /** 已保存便签的就地内容改写（对象号不变，保住回复链） */
  noteEdits?: {
    pageIndex: number;
    objNum: number;
    rect: [number, number, number, number];
    oldContents: string;
    contents: string;
  }[];
  formValues: FormValueInput[];
  stamps: { pageIndex: number; image: string; rect: [number, number, number, number]; opacity?: number }[];
  /** 页面旋转增量（原始页下标 → 顺时针 90 的倍数） */
  rotations?: { pageIndex: number; delta: number }[];
  /** 待删除的原始页下标 */
  deletedPages?: number[];
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

const quadBounds = (q: readonly number[]): [number, number, number, number] => {
  const xs = [q[0] ?? 0, q[2] ?? 0, q[4] ?? 0, q[6] ?? 0];
  const ys = [q[1] ?? 0, q[3] ?? 0, q[5] ?? 0, q[7] ?? 0];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/**
 * 手写外观流（/AP /N），让阅读器按文件呈现标记而不是自行绘制——
 * Acrobat/预览/pdf.js 行为一致。高亮使用 Multiply 混合模拟荧光笔；
 * 下划线/删除线沿"视觉底边"绘制线段（pageRot 为页面最终 /Rotate；
 * 90/270 时线高沿 x 轴延伸）。
 */
function markupAppearance(
  pdfDoc: PDFDocument,
  m: MarkupInput,
  rect: number[],
  pageRot: number,
): ReturnType<PDFDocument["context"]["stream"]> {
  const [r, g, b] = m.color;
  const ops: string[] = [];
  if (m.type === "highlight") {
    ops.push("/GsM gs", `${r} ${g} ${b} rg`);
    for (const q of m.quads) {
      const [x1, y1, x2, y2] = quadBounds(q);
      ops.push(`${num(x1)} ${num(y1)} ${num(x2 - x1)} ${num(y2 - y1)} re f`);
    }
  } else {
    const t = m.type === "underline" ? 0.08 : 0.46;
    ops.push(`${r} ${g} ${b} RG`);
    for (const q of m.quads) {
      const [x1, y1, x2, y2] = quadBounds(q);
      const h = pageRot % 180 === 0 ? y2 - y1 : x2 - x1;
      ops.push(`${Math.max(0.8, num(h * 0.06))} w`);
      if (pageRot === 90) {
        const x = x2 - h * t;
        ops.push(`${num(x)} ${num(y1)} m ${num(x)} ${num(y2)} l S`);
      } else if (pageRot === 270) {
        const x = x1 + h * t;
        ops.push(`${num(x)} ${num(y1)} m ${num(x)} ${num(y2)} l S`);
      } else {
        const y = pageRot === 180 ? y2 - h * t : y1 + h * t;
        ops.push(`${num(x1)} ${num(y)} m ${num(x2)} ${num(y)} l S`);
      }
    }
  }
  return pdfDoc.context.stream(ops.join("\n"), {
    Type: "XObject",
    Subtype: "Form",
    BBox: rect,
    Resources:
      m.type === "highlight"
        ? { ExtGState: { GsM: { Type: "ExtGState", BM: "Multiply", ca: 1 } } }
        : {},
  });
}

function appendAnnot(pdfDoc: PDFDocument, page: PDFPage, annotRef: PDFRef): void {
  const existing = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (existing) {
    existing.push(annotRef);
  } else {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
  }
}

function addMarkup(pdfDoc: PDFDocument, page: PDFPage, m: MarkupInput): void {
  const xs = m.quads.flatMap((q) => [q[0] ?? 0, q[2] ?? 0, q[4] ?? 0, q[6] ?? 0]);
  const ys = m.quads.flatMap((q) => [q[1] ?? 0, q[3] ?? 0, q[5] ?? 0, q[7] ?? 0]);
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const pageRot = ((page.getRotation().angle % 360) + 360) % 360;
  const apRef = pdfDoc.context.register(markupAppearance(pdfDoc, m, rect, pageRot));
  const annot = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: MARKUP_SUBTYPES[m.type],
    Rect: rect,
    QuadPoints: m.quads.flat(),
    C: m.color,
    F: 4,
    T: "Chips PDF",
    P: page.ref,
    AP: { N: apRef },
  });
  appendAnnot(pdfDoc, page, pdfDoc.context.register(annot));
}

/** 椭圆的四段贝塞尔近似 */
function ellipseOps(x1: number, y1: number, x2: number, y2: number): string[] {
  const k = 0.5522847;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  const n = num;
  return [
    `${n(cx + rx)} ${n(cy)} m`,
    `${n(cx + rx)} ${n(cy + k * ry)} ${n(cx + k * rx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)} c`,
    `${n(cx - k * rx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + k * ry)} ${n(cx - rx)} ${n(cy)} c`,
    `${n(cx - rx)} ${n(cy - k * ry)} ${n(cx - k * rx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)} c`,
    `${n(cx + k * rx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - k * ry)} ${n(cx + rx)} ${n(cy)} c`,
    "S",
  ];
}

/** epoch 毫秒 → PDF 日期字符串，例如 D:20260812175959+08'00' */
function pdfDateString(ms: number): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` +
    `${sign}${p(Math.floor(abs / 60))}'${p(abs % 60)}'`
  );
}

const NOTE_RECT_TOL = 2;

/** 顶点左上角在容差内——这是 pdf.js 将无 AP 的 Text 批注矩形调整为默认图标尺寸后仍成立的唯一身份特征 */
const noteRectsClose = (a: readonly number[], b: readonly number[]): boolean =>
  Math.abs(Math.min(a[0] ?? 0, a[2] ?? 0) - Math.min(b[0] ?? 0, b[2] ?? 0)) <= NOTE_RECT_TOL &&
  Math.abs(Math.max(a[1] ?? 0, a[3] ?? 0) - Math.max(b[1] ?? 0, b[3] ?? 0)) <= NOTE_RECT_TOL;

/** 定位回复指向的已保存 Text 批注（/IRT 目标）：按矩形 + 内容匹配，对象号仅作并列消歧 */
function findNoteAnnotRef(
  pdfDoc: PDFDocument,
  page: PDFPage,
  target: NoteReplyTarget,
): PDFRef | null {
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annots) return null;
  const matches: PDFRef[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    if (!(ref instanceof PDFRef)) continue;
    const dict = pdfDoc.context.lookupMaybe(ref, PDFDict);
    if (!dict || dict.lookupMaybe(PDFName.of("Subtype"), PDFName) !== PDFName.of("Text")) continue;
    const rectArr = dict.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!rectArr || rectArr.size() !== 4) continue;
    const rect: number[] = [];
    for (let j = 0; j < rectArr.size(); j++) {
      const v = rectArr.lookupMaybe(j, PDFNumber);
      if (v) rect.push(v.asNumber());
    }
    if (rect.length !== 4 || !noteRectsClose(rect, target.rect)) continue;
    const contents = dict.lookup(PDFName.of("Contents"));
    const text =
      contents instanceof PDFString || contents instanceof PDFHexString ? contents.decodeText() : "";
    if (text !== target.contents) continue;
    if (ref.objectNumber === target.objNum) return ref;
    matches.push(ref);
  }
  return matches[0] ?? null;
}

/** 绘图批注：Ink/Square/Circle/Line 手写外观流；便签为标准 Text 批注（阅读器绘制图标） */
function addDrawing(
  pdfDoc: PDFDocument,
  page: PDFPage,
  d: DrawingInput,
  noteRefs: Map<string, PDFRef>,
): void {
  if (d.kind === "note") {
    const [x, y] = d.at;
    const annot = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [num(x), num(y - 18), num(x + 20), num(y)],
      Name: "Comment",
      C: d.color,
      F: 4,
      P: page.ref,
    });
    annot.set(PDFName.of("Contents"), PDFHexString.fromText(d.contents));
    annot.set(PDFName.of("T"), PDFHexString.fromText(d.author || "Chips PDF"));
    const when = pdfDateString(d.createdMs ?? Date.now());
    annot.set(PDFName.of("CreationDate"), PDFString.of(when));
    annot.set(PDFName.of("M"), PDFString.of(when));
    // 回复 → 标准 /IRT 链。父级无法解析时降级为根便签，不丢内容。
    const parentRef = d.replyToLocalId
      ? (noteRefs.get(d.replyToLocalId) ?? null)
      : d.replyToSaved
        ? findNoteAnnotRef(pdfDoc, page, d.replyToSaved)
        : null;
    if (parentRef) {
      annot.set(PDFName.of("IRT"), parentRef);
      annot.set(PDFName.of("RT"), PDFName.of("R"));
    }
    const ref = pdfDoc.context.register(annot);
    if (d.localId) noteRefs.set(d.localId, ref);
    appendAnnot(pdfDoc, page, ref);
    return;
  }

  const [r, g, b] = d.color;
  const ops: string[] = [`${num(d.width)} w 1 J 1 j ${r} ${g} ${b} RG`];
  let xs: number[] = [];
  let ys: number[] = [];
  let subtype: string;

  if (d.kind === "ink") {
    subtype = "Ink";
    for (const path of d.paths) {
      if (path.length < 4) continue;
      ops.push(`${num(path[0] ?? 0)} ${num(path[1] ?? 0)} m`);
      for (let i = 2; i < path.length; i += 2) {
        ops.push(`${num(path[i] ?? 0)} ${num(path[i + 1] ?? 0)} l`);
      }
      ops.push("S");
      for (let i = 0; i < path.length; i += 2) {
        xs.push(path[i] ?? 0);
        ys.push(path[i + 1] ?? 0);
      }
    }
  } else if (d.kind === "rect" || d.kind === "ellipse") {
    const [x1, y1, x2, y2] = d.rect;
    subtype = d.kind === "rect" ? "Square" : "Circle";
    if (d.kind === "rect") ops.push(`${num(x1)} ${num(y1)} ${num(x2 - x1)} ${num(y2 - y1)} re S`);
    else ops.push(...ellipseOps(x1, y1, x2, y2));
    xs = [x1, x2];
    ys = [y1, y2];
  } else {
    const [fx, fy] = d.from;
    const [tx, ty] = d.to;
    subtype = "Line";
    ops.push(`${num(fx)} ${num(fy)} m ${num(tx)} ${num(ty)} l S`);
    xs = [fx, tx];
    ys = [fy, ty];
    if (d.kind === "arrow") {
      const ang = Math.atan2(ty - fy, tx - fx);
      const len = Math.max(9, d.width * 4.5);
      for (const off of [-0.45, 0.45]) {
        const hx = tx - len * Math.cos(ang + off);
        const hy = ty - len * Math.sin(ang + off);
        ops.push(`${num(tx)} ${num(ty)} m ${num(hx)} ${num(hy)} l S`);
        xs.push(hx);
        ys.push(hy);
      }
    }
  }

  const pad = d.width + 2;
  const rect = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const ap = pdfDoc.context.stream(ops.join("\n"), { Type: "XObject", Subtype: "Form", BBox: rect });
  const annot = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: subtype,
    Rect: rect,
    C: d.color,
    F: 4,
    P: page.ref,
    BS: { W: d.width },
    AP: { N: pdfDoc.context.register(ap) },
  });
  if (d.kind === "ink") annot.set(PDFName.of("InkList"), pdfDoc.context.obj(d.paths));
  if (d.kind === "line" || d.kind === "arrow") {
    annot.set(PDFName.of("L"), pdfDoc.context.obj([...d.from, ...d.to]));
  }
  annot.set(PDFName.of("T"), PDFHexString.fromText("Chips PDF"));
  appendAnnot(pdfDoc, page, pdfDoc.context.register(annot));
}

function applyFormValues(pdfDoc: PDFDocument, values: FormValueInput[]): void {
  const form = pdfDoc.getForm();
  for (const v of values) {
    if (v.kind === "text") {
      form.getTextField(v.name).setText(v.value ?? "");
    } else if (v.kind === "radio") {
      const rg = form.getRadioGroup(v.name);
      if (v.value) rg.select(v.value);
      else rg.clear();
    } else if (v.kind === "choice") {
      const f = form.getField(v.name);
      if (f instanceof PDFDropdown || f instanceof PDFOptionList) {
        if (v.value) f.select(v.value);
        else f.clear();
      }
    } else {
      const cb = form.getCheckBox(v.name);
      if (v.checked) cb.check();
      else cb.uncheck();
    }
  }
}

function applyMetadata(pdfDoc: PDFDocument, meta: NonNullable<SavePdfRequest["metadata"]>): void {
  if (meta.title !== undefined) pdfDoc.setTitle(meta.title);
  if (meta.author !== undefined) pdfDoc.setAuthor(meta.author);
  if (meta.subject !== undefined) pdfDoc.setSubject(meta.subject);
  if (meta.keywords !== undefined) {
    pdfDoc.setKeywords(
      meta.keywords
        .split(/[,，;；]/)
        .map((k) => k.trim())
        .filter(Boolean),
    );
  }
  pdfDoc.setModificationDate(new Date());
}

/**
 * 将保存请求应用到 PDF 字节并返回新字节（未匹配的便签改写静默跳过，
 * 与原 GenOffice 行为一致）。所有页下标均针对原始页序；删除页最后执行。
 */
export async function applySaveRequest(
  bytes: Uint8Array,
  request: SavePdfRequest,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (request.formValues.length > 0) applyFormValues(pdfDoc, request.formValues);
  const pages = pdfDoc.getPages();
  // 先应用旋转，让标记外观流按页面最终朝向绘制线段
  for (const r of request.rotations ?? []) {
    const page = pages[r.pageIndex];
    if (page) page.setRotation(degrees((page.getRotation().angle + r.delta) % 360));
  }
  for (const m of request.markups) {
    const page = pages[m.pageIndex];
    if (page) addMarkup(pdfDoc, page, m);
  }
  const noteRefs = new Map<string, PDFRef>();
  for (const d of request.drawings) {
    const page = pages[d.pageIndex];
    if (!page) continue;
    addDrawing(pdfDoc, page, d, noteRefs);
  }
  // 便签内容改写在绘图之后：上面新增的回复按旧内容定位 /IRT 父级
  for (const e of request.noteEdits ?? []) {
    const page = pages[e.pageIndex];
    if (!page) continue;
    const ref = findNoteAnnotRef(pdfDoc, page, {
      objNum: e.objNum,
      rect: e.rect,
      contents: e.oldContents,
    });
    const dict = ref ? pdfDoc.context.lookupMaybe(ref, PDFDict) : null;
    if (!dict) continue;
    dict.set(PDFName.of("Contents"), PDFHexString.fromText(e.contents));
    dict.set(PDFName.of("M"), PDFString.of(pdfDateString(Date.now())));
  }
  for (const s of request.stamps) {
    const page = pages[s.pageIndex];
    if (!page) continue;
    const png = await pdfDoc.embedPng(s.image);
    const [x1, y1, x2, y2] = s.rect;
    page.drawImage(png, {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      opacity: s.opacity ?? 1,
    });
  }
  if (request.metadata) applyMetadata(pdfDoc, request.metadata);
  // 删除页最后执行（降序）；其余操作全部针对原始页下标
  for (const idx of [...(request.deletedPages ?? [])].sort((a, b) => b - a)) {
    if (idx >= 0 && idx < pdfDoc.getPageCount() && pdfDoc.getPageCount() > 1) {
      pdfDoc.removePage(idx);
    }
  }
  try {
    return await pdfDoc.save({ useObjectStreams: false });
  } catch (err) {
    // 超出 WinAnsi 的表单值（如 CJK）会让 pdf-lib 外观生成失败：
    // 跳过并设置 NeedAppearances，由阅读器重建外观（Acrobat/pdf.js 均支持）
    if (request.formValues.length === 0) throw err;
    pdfDoc.getForm().acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);
    return await pdfDoc.save({ useObjectStreams: false, updateFieldAppearances: false });
  }
}
