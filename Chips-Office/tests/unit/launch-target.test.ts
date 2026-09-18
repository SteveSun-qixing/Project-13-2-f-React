import { describe, expect, it } from "vitest";
import { resolveLaunchDocumentTarget } from "../../src/bridge/launch-target";

describe("启动文档目标解析", () => {
  it("resourceOpen.filePath 优先", () => {
    const target = resolveLaunchDocumentTarget({
      targetPath: "/ws/fallback.docx",
      resourceOpen: { filePath: "/ws/primary.docx", fileName: "primary.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
    expect(target?.path).toBe("/ws/primary.docx");
    expect(target?.fileName).toBe("primary.docx");
  });

  it("无 resourceOpen 时回退 targetPath", () => {
    const target = resolveLaunchDocumentTarget({ targetPath: "/ws/doc.pdf" });
    expect(target?.path).toBe("/ws/doc.pdf");
  });

  it("resourceOpen 仅含 resourceId 时可解析", () => {
    const target = resolveLaunchDocumentTarget({
      resourceOpen: { resourceId: "res-123" },
    });
    expect(target?.path).toBe("res-123");
  });

  it("空参数返回 null", () => {
    expect(resolveLaunchDocumentTarget(undefined)).toBeNull();
    expect(resolveLaunchDocumentTarget({})).toBeNull();
    expect(resolveLaunchDocumentTarget({ resourceOpen: {} })).toBeNull();
  });
});
