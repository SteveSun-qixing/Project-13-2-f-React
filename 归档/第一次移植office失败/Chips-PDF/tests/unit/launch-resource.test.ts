import { describe, expect, it } from "vitest";
import {
  createDialogPdfTarget,
  createDroppedPdfTarget,
  resolveFileName,
  resolveLaunchPdfTarget,
} from "../../src/utils/launch-resource";

describe("resolveLaunchPdfTarget（打开目标解析优先级）", () => {
  it("优先使用 resourceOpen.filePath 恢复本地 PDF", () => {
    expect(
      resolveLaunchPdfTarget({
        launchParams: {
          targetPath: "/tmp/fallback.pdf",
          resourceOpen: {
            resourceId: "chips-resource://doc/1",
            filePath: "/tmp/demo.pdf",
            fileName: "demo.pdf",
            mimeType: "application/pdf",
          },
        },
      } as never),
    ).toEqual({
      sourceId: "/tmp/demo.pdf",
      filePath: "/tmp/demo.pdf",
      fileName: "demo.pdf",
      mimeType: "application/pdf",
      title: undefined,
    });
  });

  it("无 filePath 时回退到 launchParams.targetPath（文件关联打开）", () => {
    expect(
      resolveLaunchPdfTarget({
        launchParams: {
          targetPath: "/Users/demo/报表.pdf",
        },
      } as never),
    ).toEqual({
      sourceId: "/Users/demo/报表.pdf",
      filePath: "/Users/demo/报表.pdf",
      fileName: "报表.pdf",
      mimeType: undefined,
      title: undefined,
    });
  });

  it("远端资源场景回退到 resourceOpen.resourceId", () => {
    expect(
      resolveLaunchPdfTarget({
        launchParams: {
          resourceOpen: {
            resourceId: "https://example.com/demo.pdf",
            mimeType: "application/pdf",
            title: "远程文档",
          },
        },
      } as never),
    ).toEqual({
      sourceId: "https://example.com/demo.pdf",
      filePath: undefined,
      fileName: "demo.pdf",
      mimeType: "application/pdf",
      title: "远程文档",
    });
  });

  it("resourceOpen.payload 中的资源信息作为兜底来源", () => {
    expect(
      resolveLaunchPdfTarget({
        launchParams: {
          resourceOpen: {
            payload: {
              resource: { resourceId: "chips-resource://doc/9", fileName: "附件.pdf" },
              title: "邮件附件",
            },
          },
        },
      } as never),
    ).toEqual({
      sourceId: "chips-resource://doc/9",
      filePath: undefined,
      fileName: "附件.pdf",
      mimeType: undefined,
      title: "邮件附件",
    });
  });

  it("无任何目标信息时返回 null（停留起始页）", () => {
    expect(resolveLaunchPdfTarget(null)).toBeNull();
    expect(resolveLaunchPdfTarget({ launchParams: {} } as never)).toBeNull();
  });
});

describe("文件名与打开目标构造", () => {
  it("resolveFileName 提取末段并兼容 Windows 分隔符", () => {
    expect(resolveFileName("/Users/demo/docs/a.pdf")).toBe("a.pdf");
    expect(resolveFileName("C:\\docs\\b.pdf")).toBe("b.pdf");
    expect(resolveFileName("c.pdf")).toBe("c.pdf");
  });

  it("createDialogPdfTarget 以对话框路径构造打开目标", () => {
    expect(createDialogPdfTarget("/tmp/选中的文档.pdf")).toEqual({
      sourceId: "/tmp/选中的文档.pdf",
      filePath: "/tmp/选中的文档.pdf",
      fileName: "选中的文档.pdf",
    });
  });

  it("createDroppedPdfTarget 优先使用宿主解析的本地路径", () => {
    const file = (name: string, path?: string) =>
      ({ name, type: "application/pdf", path }) as File & { path?: string };

    const bridged = createDroppedPdfTarget(file("拖入.pdf", "/tmp/拖入.pdf"), (f) =>
      (f as File & { path?: string }).path ?? null,
    );
    expect(bridged).toEqual({
      sourceId: "/tmp/拖入.pdf",
      filePath: "/tmp/拖入.pdf",
      fileName: "拖入.pdf",
      mimeType: "application/pdf",
    });

    const unresolved = createDroppedPdfTarget(file("无路径.pdf"), () => null);
    expect(unresolved).toEqual({
      sourceId: "无路径.pdf",
      filePath: undefined,
      fileName: "无路径.pdf",
      mimeType: "application/pdf",
    });
  });
});
