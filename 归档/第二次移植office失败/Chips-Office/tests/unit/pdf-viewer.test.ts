/**
 * PDF 查看器链路单元测试。
 *
 * 覆盖三个层面：
 * 1. 类型定义（既有用例，保持不变）；
 * 2. file-parse 浏览器安全实现的 pdfToText 真实文本抽取（测试内手写最小合法 PDF 字节）；
 * 3. usePdf 运行时逻辑（PdfRuntimeProvider 渲染探针 + file.session mock 链路，
 *    覆盖模块级 worker 注册副作用、openTarget 编排、错误路径与状态机的纯逻辑行为）。
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ChipsProvider } from "@chips/ui";
import type { Client, FileSessionDescriptor } from "chips-sdk";
import { pdfToText } from "../../src/engine/file-parse/src/pdf";
import type { PdfRuntimeValue } from "../../src/apps/pdf/hooks/usePdf";
import type { ZoomMode, ZoomState, DocumentStatus, Annotation } from "../../src/apps/pdf/types";
import { createAppMockClient } from "../../src/testing/mock-environment";

// ============================================================================
// 测试环境垫片
// ============================================================================

/**
 * 恢复 `new URL("<资产>/", import.meta.url)` 字面量的尾斜杠语义。
 *
 * 背景：pdfjs 对 cMapUrl / standardFontDataUrl 要求以 "/" 结尾，并在 getDocument
 * 时立即校验（"Invalid factory url"）。源码中的字面量均带尾斜杠；但在 vitest 的
 * jsdom 环境里，vite 的 asset-import-meta-url 插件会把该模式重写为 dev server 的
 * 绝对 URL 并丢失尾斜杠，导致 pdfjs 解析入口在测试环境中被误判为非法。
 * 此垫片仅在 URL 以 pdfjs-dist/standard_fonts 或 pdfjs-dist/cmaps 结尾且缺尾斜杠
 * 时补回源码字面量原本的 "/"，其余 URL 行为完全不变。
 */
const OriginalURL = globalThis.URL;
class TrailingSlashPreservingURL extends OriginalURL {
  constructor(url: string | URL, base?: string | URL) {
    const raw = String(url);
    super(/\/pdfjs-dist\/(standard_fonts|cmaps)$/.test(raw) ? `${raw}/` : raw, base);
  }
}
globalThis.URL = TrailingSlashPreservingURL as unknown as typeof URL;

/**
 * 补齐测试环境缺失的 Promise.try（ES2025 标准 API）。
 *
 * 背景：pdfjs-dist 6.x 的 fake worker 回退通道（LoopbackPort / message_handler）
 * 在消息分发处使用 Promise.try；Node 22 及其 jsdom 全局尚未内置该方法，缺失时
 * worker 消息处理直接抛错、getDocument 永不 settle。按 ES2025 语义补一个最小
 * 实现：同步执行回调，正常返回则 resolve，同步抛错则 reject。
 */
const PromiseCtor = Promise as unknown as { try?: unknown };
if (typeof PromiseCtor.try !== "function") {
  PromiseCtor.try = function tryPolyfill(
    this: PromiseConstructor,
    callback: (...args: unknown[]) => unknown,
    ...args: unknown[]
  ): Promise<unknown> {
    return new this((resolve, reject) => {
      try {
        resolve(callback(...args));
      } catch (error) {
        reject(error);
      }
    });
  };
}

/**
 * 补齐测试环境缺失的 Uint8Array.prototype.toHex（ES2025 标准 API）。
 *
 * 背景：pdfjs-dist 6.x 在 worker 侧用 hash.toHex() 计算文档指纹
 * （pdf.worker.mjs 的 fingerprints）；Node 22 的 Uint8Array 原型尚未内置该方法，
 * 缺失时文档解析以 UnknownErrorException 失败。按标准语义输出小写十六进制串。
 */
const Uint8ArrayProto = Uint8Array.prototype as unknown as { toHex?: unknown };
if (typeof Uint8ArrayProto.toHex !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value: function toHexPolyfill(this: Uint8Array): string {
      let out = "";
      for (const byte of this) {
        out += byte.toString(16).padStart(2, "0");
      }
      return out;
    },
    writable: true,
    configurable: true,
  });
}

// usePdf 模块顶层的 DOC_OPTIONS 在模块求值时求值 cMapUrl，因此必须在垫片安装后
// 动态导入（React act 环境标记同理先行声明）
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type UsePdfModule = typeof import("../../src/apps/pdf/hooks/usePdf");
let hookModule: UsePdfModule;

beforeAll(async () => {
  hookModule = await import("../../src/apps/pdf/hooks/usePdf");
});

describe("PDF 类型定义", () => {
  it("ZoomState 应支持 fit-width、fit-page 和 custom 模式", () => {
    const fitWidthZoom: ZoomState = { mode: "fit-width", scale: 1.0 };
    const fitPageZoom: ZoomState = { mode: "fit-page", scale: 1.0 };
    const customZoom: ZoomState = { mode: "custom", scale: 1.5 };

    expect(fitWidthZoom.mode).toBe("fit-width");
    expect(fitPageZoom.mode).toBe("fit-page");
    expect(customZoom.mode).toBe("custom");
    expect(customZoom.scale).toBe(1.5);
  });

  it("DocumentStatus 应支持所有预期状态", () => {
    const statuses: DocumentStatus[] = ["idle", "loading", "password", "error", "ready"];

    for (const status of statuses) {
      expect(["idle", "loading", "password", "error", "ready"]).toContain(status);
    }
  });

  it("PageSize 应正确约束宽高", () => {
    const pageSize = { width: 612, height: 792 };
    expect(pageSize.width).toBeGreaterThan(0);
    expect(pageSize.height).toBeGreaterThan(0);
  });

  it("Annotation 类型应支持三种批注类型", () => {
    const highlightAnnotation: Annotation = {
      id: "1",
      pageIndex: 0,
      type: "highlight",
      rect: { x: 0, y: 0, width: 100, height: 20 },
      color: "rgba(255, 255, 0, 0.4)",
      createdAt: Date.now(),
    };

    const underlineAnnotation: Annotation = {
      id: "2",
      pageIndex: 1,
      type: "underline",
      rect: { x: 10, y: 10, width: 200, height: 5 },
      color: "rgba(0, 0, 255, 0.3)",
      createdAt: Date.now(),
    };

    const commentAnnotation: Annotation = {
      id: "3",
      pageIndex: 2,
      type: "comment",
      rect: { x: 50, y: 50, width: 150, height: 60 },
      color: "rgba(255, 0, 0, 0.2)",
      text: "这是一条批注",
      author: "测试用户",
      createdAt: Date.now(),
    };

    expect(highlightAnnotation.type).toBe("highlight");
    expect(underlineAnnotation.type).toBe("underline");
    expect(commentAnnotation.type).toBe("comment");
    expect(commentAnnotation.text).toBe("这是一条批注");
  });

  it("ZoomMode 类型应为有效枚举值", () => {
    const modes: ZoomMode[] = ["fit-width", "fit-page", "custom"];

    for (const mode of modes) {
      expect(["fit-width", "fit-page", "custom"]).toContain(mode);
    }
  });
});

// ============================================================================
// 测试辅助：手写最小合法 PDF 字节（catalog/pages/page/content stream + xref）
// ============================================================================

/** PDF 内容流仅使用 ASCII 文字，避免为标准字体（Helvetica）补充编码表。 */
function buildMinimalPdf(pageTexts: string[]): Uint8Array {
  const chunks: string[] = [];
  const objectOffsets: number[] = [0];
  let cursor = 0;

  const push = (chunk: string): void => {
    chunks.push(chunk);
    cursor += chunk.length;
  };
  const addObject = (body: string): number => {
    const objectId = objectOffsets.length;
    objectOffsets.push(cursor);
    push(`${objectId} 0 obj\n${body}\nendobj\n`);
    return objectId;
  };

  push("%PDF-1.4\n");

  const fontObjectId = 3;
  const firstPageObjectId = 4;
  const pageObjectIds = pageTexts.map((_, index) => firstPageObjectId + index * 2);

  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageTexts.length} >>`,
  );
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pageTexts.forEach((text, index) => {
    const contentObjectId = firstPageObjectId + index * 2 + 1;
    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    const stream = `BT\n/F1 24 Tf\n72 700 Td\n(${text}) Tj\nET`;
    addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const startxref = cursor;
  push(`xref\n0 ${objectOffsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < objectOffsets.length; i++) {
    push(`${String(objectOffsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);

  // 结构全部为 ASCII，逐字符取码点即为精确字节
  const source = chunks.join("");
  const bytes = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i++) {
    bytes[i] = source.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** 按契约构造 file.session.* 的会话描述符（与 Chips-SDK/src/contracts/file.ts 对齐）。 */
function fileSessionDescriptor(
  overrides: Partial<FileSessionDescriptor> & { sessionId: string },
): FileSessionDescriptor {
  const nowIso = new Date().toISOString();
  return {
    documentId: `doc-${overrides.sessionId}`,
    filePath: "/workspace/documents/未命名.pdf",
    fileName: "未命名.pdf",
    format: "pdf",
    mimeType: "application/pdf",
    size: 0,
    revision: 0,
    status: "clean",
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

// ============================================================================
// 测试辅助：usePdf 运行时渲染探针
// ============================================================================

const activeRoots: Root[] = [];

type AppMockClient = ReturnType<typeof createAppMockClient>;

async function renderPdfRuntime(client: Client | null): Promise<{
  latest: () => PdfRuntimeValue;
}> {
  const capture = { current: null as PdfRuntimeValue | null };
  function Probe(): null {
    capture.current = hookModule.usePdf();
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  activeRoots.push(root);

  // ChipsProvider 必须位于 PdfRuntimeProvider 外层，hook 才能取到 client
  await act(async () => {
    root.render(
      createElement(ChipsProvider, {
        client,
        children: createElement(hookModule.PdfRuntimeProvider, {
          children: createElement(Probe),
        }),
      }),
    );
  });

  return {
    latest: () => {
      if (!capture.current) throw new Error("usePdf 运行时尚未完成首次渲染");
      return capture.current;
    },
  };
}

/** 为 mock host 注册 file.session.open/read/close 处理器，返回指定路径的最小 PDF。 */
function registerPdfSessionHandlers(
  client: AppMockClient,
  pdfBytes: Uint8Array,
  fileName: string,
): void {
  const filePath = `/workspace/documents/${fileName}`;
  client.mockHost.setActionHandler("file.session.open", (payload) => {
    const record = payload as { filePath?: string; format?: string };
    return {
      document: fileSessionDescriptor({
        sessionId: "fs-pdf-open",
        filePath: record.filePath ?? filePath,
        fileName,
        format: record.format ?? "pdf",
        size: pdfBytes.length,
      }),
    };
  });
  client.mockHost.setActionHandler("file.session.read", (payload) => {
    const record = payload as { sessionId?: string };
    expect(record.sessionId).toBe("fs-pdf-open");
    return {
      document: fileSessionDescriptor({
        sessionId: "fs-pdf-open",
        filePath,
        fileName,
        size: pdfBytes.length,
      }),
      bytes: pdfBytes,
      offset: 0,
      totalSize: pdfBytes.length,
    };
  });
  client.mockHost.setActionHandler("file.session.close", () => ({ ack: true }));
}

afterEach(async () => {
  while (activeRoots.length > 0) {
    const root = activeRoots.pop()!;
    await act(async () => {
      root.unmount();
    });
  }
});

// ============================================================================
// pdfToText：file-parse 浏览器安全实现的真实文本抽取
// ============================================================================

describe("pdfToText 真实文本抽取（file-parse 浏览器安全实现）", () => {
  it("从手写最小 PDF 字节中抽取每页一行文字，并按页以空行分隔", async () => {
    const bytes = buildMinimalPdf(["Chips PDF pipeline line one", "second page final line"]);

    const text = await pdfToText(bytes);

    expect(text).toBe("Chips PDF pipeline line one\n\nsecond page final line");
  });

  it("对非法 PDF 字节抛出解析错误，而不是静默返回空文本", async () => {
    const invalidBytes = new Uint8Array(Buffer.from("这不是一段合法的 PDF 字节", "utf-8"));

    await expect(pdfToText(invalidBytes)).rejects.toThrow();
  });
});

// ============================================================================
// usePdf：模块级 worker 注册副作用与运行时纯逻辑
// ============================================================================

describe("usePdf 运行时逻辑（渲染探针 + file.session mock 链路）", () => {
  it("导入 usePdf 模块后 globalThis.pdfjsWorker 已注册（fake worker 回退依赖）", async () => {
    expect(hookModule).toBeDefined();

    const workerGlobal = globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
    expect(workerGlobal.pdfjsWorker).toBeDefined();
    expect(workerGlobal.pdfjsWorker?.WorkerMessageHandler).toBeDefined();
  });

  it("openTarget 走通 file.session.open/read 链路并进入 ready 状态", async () => {
    const client = createAppMockClient();
    const pdfBytes = buildMinimalPdf(["Chips PDF pipeline line one", "second page final line"]);
    registerPdfSessionHandlers(client, pdfBytes, "链路演示.pdf");

    const runtime = await renderPdfRuntime(client);
    expect(runtime.latest().status).toBe("idle");

    await act(async () => {
      await runtime.latest().openTarget({
        filePath: "/workspace/documents/链路演示.pdf",
        fileName: "链路演示.pdf",
      });
    });

    expect(runtime.latest().status).toBe("ready");
    expect(runtime.latest().errorMessage).toBeNull();
    expect(runtime.latest().numPages).toBe(2);
    expect(runtime.latest().pageSizes).toEqual([
      { width: 612, height: 792 },
      { width: 612, height: 792 },
    ]);
    expect(runtime.latest().fileName).toBe("链路演示.pdf");

    const actions = client.calls.map((call) => call.action);
    expect(actions).toContain("file.session.open");
    expect(actions).toContain("file.session.read");
  });

  it("缺少 filePath 与 resourceId 时进入 error 状态并透出可读错误信息", async () => {
    const client = createAppMockClient();
    const runtime = await renderPdfRuntime(client);

    await act(async () => {
      await runtime.latest().openTarget({ fileName: "缺少来源.pdf" });
    });

    expect(runtime.latest().status).toBe("error");
    expect(runtime.latest().errorMessage).toBe("无法读取 PDF 文件：缺少文件路径或资源 ID");
    expect(runtime.latest().numPages).toBe(0);
  });

  it("页码导航、缩放钳制、旋转与批注的纯逻辑行为正确", async () => {
    const client = createAppMockClient();
    const pdfBytes = buildMinimalPdf(["Chips PDF pipeline line one", "second page final line"]);
    registerPdfSessionHandlers(client, pdfBytes, "链路演示.pdf");

    const runtime = await renderPdfRuntime(client);
    await act(async () => {
      await runtime.latest().openTarget({
        filePath: "/workspace/documents/链路演示.pdf",
        fileName: "链路演示.pdf",
      });
    });
    expect(runtime.latest().status).toBe("ready");

    // 页码导航：goToPage 拒绝小于 1 的页码；nextPage/prevPage 在 [1, numPages] 内钳制
    expect(runtime.latest().currentPage).toBe(1);
    act(() => {
      runtime.latest().goToPage(0);
    });
    expect(runtime.latest().currentPage).toBe(1);
    act(() => {
      runtime.latest().nextPage();
      runtime.latest().nextPage();
      runtime.latest().nextPage();
    });
    expect(runtime.latest().currentPage).toBe(2);
    act(() => {
      runtime.latest().prevPage();
      runtime.latest().prevPage();
    });
    expect(runtime.latest().currentPage).toBe(1);

    // 缩放：custom 模式钳制在 [0.1, 10]，预设模式使用默认 scale 1
    act(() => {
      runtime.latest().setZoom("custom", 25);
    });
    expect(runtime.latest().zoom).toEqual({ mode: "custom", scale: 10 });
    act(() => {
      runtime.latest().setZoom("custom", 0.01);
    });
    expect(runtime.latest().zoom).toEqual({ mode: "custom", scale: 0.1 });
    act(() => {
      runtime.latest().setZoom("fit-page");
    });
    expect(runtime.latest().zoom).toEqual({ mode: "fit-page", scale: 1 });

    // 旋转：全局旋转累加并按 360 取模；单页旋转同样累加到全局角度
    act(() => {
      runtime.latest().rotateAll();
      runtime.latest().rotateAll();
      runtime.latest().rotateAll();
      runtime.latest().rotateAll();
    });
    expect(runtime.latest().rotation).toBe(0);
    act(() => {
      runtime.latest().rotatePage(0, 270);
    });
    expect(runtime.latest().rotation).toBe(270);

    // 批注：新增自动生成 id 与 createdAt，更新与删除按 id 生效
    const baseAnnotation = {
      pageIndex: 0,
      type: "highlight" as const,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      color: "rgba(255, 255, 0, 0.4)",
    };
    act(() => {
      runtime.latest().addAnnotation(baseAnnotation);
    });
    const annotations = runtime.latest().annotations;
    expect(annotations).toHaveLength(1);
    expect(annotations[0]?.id).toMatch(/^ann_/);
    expect(typeof annotations[0]?.createdAt).toBe("number");

    const firstId = annotations[0]?.id ?? "";
    act(() => {
      runtime.latest().updateAnnotation(firstId, { color: "rgba(0, 0, 255, 0.5)" });
      runtime.latest().addAnnotation(baseAnnotation);
      runtime.latest().removeAnnotation(firstId);
    });
    const updatedAnnotations = runtime.latest().annotations;
    expect(updatedAnnotations).toHaveLength(1);
    expect(updatedAnnotations[0]?.id).not.toBe(firstId);
    expect(updatedAnnotations[0]?.color).toBe(baseAnnotation.color);
  });
});
