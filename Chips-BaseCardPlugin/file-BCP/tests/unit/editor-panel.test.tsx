import { describe, it, expect, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

async function waitForEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForEffects();
    }
  }
  throw lastError;
}

function buildConfig(overrides: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "base.file",
    theme: "",
    file_file: "",
    file_name: "",
    file_extension: "",
    cover_image: "",
    ...overrides,
  };
}

function createFakeFileList(file: File): FileList {
  const list = [file] as unknown as FileList;
  list.item = (index: number) => (index === 0 ? file : null);
  Object.defineProperty(list, "length", { value: 1 });
  return list;
}

function dropFile(root: ParentNode, file: File): void {
  const dropzone = root.querySelector('[data-role="file-dropzone"]') as HTMLElement | null;
  if (!dropzone) {
    throw new Error("找不到文件上传区域");
  }

  const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(dropEvent, "dataTransfer", {
    value: {
      files: createFakeFileList(file),
    },
  });
  dropzone.dispatchEvent(dropEvent);
}

describe("createBasecardEditorRoot", () => {
  it("renders the upload dropzone when no file is imported", () => {
    const root = createBasecardEditorRoot({
      initialConfig: buildConfig(),
      onChange: () => undefined,
    });

    expect(root.getAttribute("data-chips-file-editor-root")).toBe("true");
    expect(root.querySelector('[data-role="file-dropzone"]')).toBeTruthy();
    expect(root.querySelector('[data-role="file-input"]')).toBeTruthy();
    expect(root.querySelector('[data-role="remove-file"]')).toBeNull();
  });

  it("imports a file, auto-recognizes name and extension, and supports deletion", async () => {
    const file = new File(["demo"], "季度报告 Final.pdf", { type: "application/pdf" });
    const importResource = vi.fn(async () => ({ path: "季度报告-Final.pdf" }));
    const deleteResource = vi.fn(async () => undefined);
    const configs: BasecardConfig[] = [];

    const root = createBasecardEditorRoot({
      initialConfig: buildConfig(),
      onChange: (next) => {
        configs.push(next);
      },
      importResource,
      deleteResource,
    });

    dropFile(root, file);
    await waitForEffects();

    expect(importResource).toHaveBeenCalledWith({
      file,
      preferredPath: "季度报告-Final.pdf",
    });
    await waitForAssertion(() => {
      expect(configs[configs.length - 1]).toMatchObject({
        card_type: "base.file",
        file_file: "季度报告-Final.pdf",
        file_name: "季度报告 Final",
        file_extension: "pdf",
      });
      expect(root.querySelector('[data-role="file-resource"]')).toBeTruthy();
    });

    const nameValue = root.querySelector('[data-field="file_name"] .chips-file-editor__field-value');
    expect(nameValue?.textContent).toBe("季度报告 Final");
    const extensionValue = root.querySelector(
      '[data-field="file_extension"] .chips-file-editor__field-value',
    );
    expect(extensionValue?.textContent).toBe("PDF");

    const removeButton = root.querySelector('[data-role="remove-file"]') as HTMLButtonElement;
    expect(removeButton).toBeTruthy();
    removeButton.click();
    await waitForEffects();

    expect(deleteResource).toHaveBeenCalledWith("季度报告-Final.pdf");
    await waitForAssertion(() => {
      expect(configs[configs.length - 1]).toMatchObject({
        file_file: "",
        file_name: "",
        file_extension: "",
      });
      expect(root.querySelector('[data-role="file-dropzone"]')).toBeTruthy();
    });
  });

  it("shows an error when the host does not provide resource import", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: buildConfig(),
      onChange: () => undefined,
    });

    dropFile(root, new File(["demo"], "report.pdf", { type: "application/pdf" }));
    await waitForEffects();

    await waitForAssertion(() => {
      expect(root.textContent).toContain("当前宿主没有提供正式资源导入能力。");
    });
  });

  it("rolls back the imported resource when import fails", async () => {
    const file = new File(["demo"], "report.pdf", { type: "application/pdf" });
    const importResource = vi.fn(async () => {
      throw new Error("磁盘已满");
    });
    const deleteResource = vi.fn(async () => undefined);

    const root = createBasecardEditorRoot({
      initialConfig: buildConfig(),
      onChange: () => undefined,
      importResource,
      deleteResource,
    });

    dropFile(root, file);
    await waitForEffects();

    await waitForAssertion(() => {
      expect(root.textContent).toContain("磁盘已满");
    });
    expect(deleteResource).not.toHaveBeenCalled();
    expect(root.querySelector('[data-role="file-dropzone"]')).toBeTruthy();
  });

  it("keeps the panel usable while an upload is in progress", async () => {
    let releaseImport: ((value: { path: string }) => void) | undefined;
    const importResource = vi.fn(
      () => new Promise<{ path: string }>((resolve) => {
        releaseImport = resolve;
      }),
    );

    const root = createBasecardEditorRoot({
      initialConfig: buildConfig(),
      onChange: () => undefined,
      importResource,
    });

    dropFile(root, new File(["demo"], "report.pdf", { type: "application/pdf" }));
    await waitForEffects();

    const dropzone = root.querySelector('[data-role="file-dropzone"]') as HTMLElement;
    expect(dropzone.getAttribute("data-state")).toBe("busy");

    releaseImport?.({ path: "report.pdf" });
    await waitForAssertion(() => {
      expect(root.querySelector('[data-role="file-resource"]')).toBeTruthy();
    });
  });
});
