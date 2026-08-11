import { describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

const emptyConfig: BasecardConfig = {
  card_type: "base.book",
  theme: "",
  source_type: "ebook",
  book_file: "",
  book_format: "",
  book_name: "",
  book_author: "",
  cover_image: "",
  image_sequence: [],
  image_sort_basis: "filename",
  resource_paths: [],
};

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 120);
  });
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", {
    value: files,
    configurable: true,
  });
}

function changeTextInput(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchFileDrop(target: Element, files: File[]): void {
  const event = new Event("drop", {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      files,
      items: files.map((file) => ({
        kind: "file",
        getAsFile: () => file,
      })),
      dropEffect: "none",
    },
    configurable: true,
  });

  target.dispatchEvent(event);
}

function dispatchDragEvent(target: Element, type: string, relatedTarget: EventTarget | null = null): void {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      dropEffect: "none",
    },
    configurable: true,
  });
  Object.defineProperty(event, "relatedTarget", {
    value: relatedTarget,
    configurable: true,
  });

  target.dispatchEvent(event);
}

describe("createBasecardEditorRoot", () => {
  it("imports ebook files through host resource import", async () => {
    let lastConfig: BasecardConfig | undefined;
    const importResource = vi.fn(async (input: { preferredPath?: string; file: File }) => ({
      path: input.preferredPath ?? input.file.name,
    }));

    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importResource,
    });

    const mainInput = root.querySelector('[data-role="main-file-input"]') as HTMLInputElement | null;
    if (!mainInput) {
      throw new Error("找不到主上传输入框");
    }

    setInputFiles(mainInput, [
      new File([new Uint8Array([1, 2, 3])], "novel.pdf", { type: "application/pdf" }),
    ]);
    mainInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(importResource).toHaveBeenCalledWith(expect.objectContaining({
      preferredPath: "novel.pdf",
    }));
    expect(lastConfig).toMatchObject({
      source_type: "ebook",
      book_file: "novel.pdf",
      book_format: "pdf",
      image_sequence: [],
      resource_paths: ["novel.pdf"],
    });
  });

  it("imports ebook files dropped on the main upload zone", async () => {
    let lastConfig: BasecardConfig | undefined;
    const importResource = vi.fn(async (input: { preferredPath?: string; file: File }) => ({
      path: input.preferredPath ?? input.file.name,
    }));

    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importResource,
    });

    const mainDropzone = root.querySelector('[data-role="main-dropzone"]');
    if (!mainDropzone) {
      throw new Error("找不到主上传拖放区域");
    }

    dispatchFileDrop(mainDropzone, [
      new File([new Uint8Array([4, 5, 6])], "dropped-book.pdf", { type: "application/pdf" }),
    ]);

    await flushAsyncWork();

    expect(importResource).toHaveBeenCalledWith(expect.objectContaining({
      preferredPath: "dropped-book.pdf",
    }));
    expect(lastConfig).toMatchObject({
      source_type: "ebook",
      book_file: "dropped-book.pdf",
      book_format: "pdf",
      resource_paths: ["dropped-book.pdf"],
    });
  });

  it("imports ZIP/CBZ image bundles as image resources only", async () => {
    let lastConfig: BasecardConfig | undefined;
    const importArchiveBundle = vi.fn(async () => ({
      rootDir: "comic-abc123",
      resourcePaths: [
        "comic-abc123/page-010.jpg",
        "comic-abc123/page-002.png",
      ],
      entries: [
        {
          sourcePath: "page-010.jpg",
          resourcePath: "comic-abc123/page-010.jpg",
          fileName: "page-010.jpg",
          mimeType: "image/jpeg",
          size: 4,
          compressedSize: 4,
          crc32: 1,
          offset: 0,
          isDirectory: false,
          compressionMethod: 0,
        },
        {
          sourcePath: "page-002.png",
          resourcePath: "comic-abc123/page-002.png",
          fileName: "page-002.png",
          mimeType: "image/png",
          size: 8,
          compressedSize: 8,
          crc32: 2,
          offset: 4,
          isDirectory: false,
          compressionMethod: 0,
        },
      ],
      discardedEntries: [
        {
          sourcePath: "notes/readme.txt",
          reason: "filter-mismatch",
          fileName: "readme.txt",
        },
      ],
    }));

    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importArchiveBundle,
    });

    const mainInput = root.querySelector('[data-role="main-file-input"]') as HTMLInputElement | null;
    if (!mainInput) {
      throw new Error("找不到主上传输入框");
    }

    setInputFiles(mainInput, [
      new File(["zip"], "comic.cbz", { type: "application/vnd.comicbook+zip" }),
    ]);
    mainInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(importArchiveBundle).toHaveBeenCalledWith({
      file: expect.any(File),
      preferredRootDir: "comic",
      include: {
        mimeTypes: ["image/*"],
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".avif", ".svg", ".tif", ".tiff"],
      },
      stripSingleRootDir: true,
      excludeSystemArtifacts: true,
    });
    expect(lastConfig?.source_type).toBe("image-sequence");
    expect(lastConfig?.book_file).toBe("");
    expect(lastConfig?.book_format).toBe("cbz");
    expect(lastConfig?.cover_image).toBe("comic-abc123/page-002.png");
    expect(lastConfig?.image_sequence.map((image) => image.file_path)).toEqual([
      "comic-abc123/page-002.png",
      "comic-abc123/page-010.jpg",
    ]);
    expect(lastConfig?.resource_paths).toEqual([
      "comic-abc123/page-002.png",
      "comic-abc123/page-010.jpg",
    ]);
  });

  it("registers old resources for deletion when replacing the main resource", async () => {
    let lastConfig: BasecardConfig | undefined;
    const importResource = vi.fn(async (input: { preferredPath?: string; file: File }) => ({
      path: input.preferredPath ?? input.file.name,
    }));
    const deleteResource = vi.fn(async () => undefined);
    const initialConfig: BasecardConfig = {
      ...emptyConfig,
      book_file: "old/book.epub",
      book_format: "epub",
      cover_image: "old/cover.jpg",
      resource_paths: ["old/book.epub", "old/cover.jpg"],
    };

    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importResource,
      deleteResource,
    });

    const mainInput = root.querySelector('[data-role="main-file-input"]') as HTMLInputElement | null;
    if (!mainInput) {
      throw new Error("找不到主上传输入框");
    }

    setInputFiles(mainInput, [
      new File([new Uint8Array([1, 2, 3])], "new-book.txt", { type: "text/plain" }),
    ]);
    mainInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(lastConfig?.book_file).toBe("new-book.txt");
    expect(deleteResource).toHaveBeenCalledWith("old/book.epub");
    expect(deleteResource).toHaveBeenCalledWith("old/cover.jpg");
  });

  it("emits metadata field updates even before a resource is selected", () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const nameInput = root.querySelector('[data-role="book-name-input"]') as HTMLInputElement | null;
    if (!nameInput) {
      throw new Error("找不到书名输入框");
    }

    changeTextInput(nameInput, "Manual Title");

    expect(lastConfig).toMatchObject({
      book_name: "Manual Title",
      card_type: "base.book",
    });
  });

  it("does not reset local edits when the initialConfig object identity changes", () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: {
        ...emptyConfig,
        book_name: "Initial",
      },
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const nameInput = root.querySelector('[data-role="book-name-input"]') as HTMLInputElement | null;
    if (!nameInput) {
      throw new Error("找不到书名输入框");
    }

    changeTextInput(nameInput, "Edited");

    expect(lastConfig?.book_name).toBe("Edited");
    expect((nameInput as HTMLInputElement).value).toBe("Edited");
  });

  it("reports resource deletion failures when clearing the main resource", async () => {
    const deleteResource = vi.fn(async () => {
      throw new Error("delete denied");
    });
    const initialConfig: BasecardConfig = {
      ...emptyConfig,
      book_file: "old/book.epub",
      book_format: "epub",
      book_name: "Old",
      resource_paths: ["old/book.epub"],
    };

    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: () => undefined,
      deleteResource,
    });

    const clearButton = Array.from(root.querySelectorAll("button")).find((button) => (
      button.textContent?.includes("移除资源")
    ));
    if (!clearButton) {
      throw new Error("找不到移除资源按钮");
    }

    clearButton.click();
    await flushAsyncWork();

    expect(deleteResource).toHaveBeenCalledWith("old/book.epub");
    expect(root.querySelector(".chips-book-editor__status--error")?.textContent).toContain("资源删除失败");
  });

  it("renders a numbered image list with resolved thumbnails", async () => {
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => `file:///tmp/${resourcePath}`);
    const initialConfig: BasecardConfig = {
      ...emptyConfig,
      source_type: "image-sequence",
      book_format: "cbz",
      cover_image: "comic/001.jpg",
      image_sequence: [
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
          mime_type: "image/jpeg",
        },
        {
          id: "two",
          file_path: "comic/002.jpg",
          file_name: "002.jpg",
          mime_type: "image/jpeg",
        },
      ],
      resource_paths: ["comic/001.jpg", "comic/002.jpg"],
    };

    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: () => undefined,
      resolveResourceUrl,
    });

    await flushAsyncWork();

    const items = root.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.querySelector(".chips-book-editor__image-list-index")?.textContent).toBe("1");
    expect(items[1]?.querySelector(".chips-book-editor__image-list-index")?.textContent).toBe("2");
    expect(items[0]?.querySelector("img")?.getAttribute("src")).toBe("file:///tmp/comic/001.jpg");
    expect(items[1]?.querySelector("img")?.getAttribute("src")).toBe("file:///tmp/comic/002.jpg");
  });

  it("shows thumbnail placeholders when no resolver is available", () => {
    const initialConfig: BasecardConfig = {
      ...emptyConfig,
      source_type: "image-sequence",
      book_format: "cbz",
      image_sequence: [
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
          mime_type: "image/jpeg",
        },
      ],
      resource_paths: ["comic/001.jpg"],
    };

    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: () => undefined,
    });

    const item = root.querySelector('[role="listitem"]');
    expect(item?.querySelector("img")).toBeNull();
    expect(item?.querySelector(".chips-book-editor__image-list-thumb")).not.toBeNull();
    expect(item?.querySelector(".chips-book-editor__image-list-index")?.textContent).toBe("1");
  });

  it("renders the image sort control as an antd Select", () => {
    const initialConfig: BasecardConfig = {
      ...emptyConfig,
      source_type: "image-sequence",
      book_format: "cbz",
      image_sequence: [
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
          mime_type: "image/jpeg",
        },
      ],
      resource_paths: ["comic/001.jpg"],
    };

    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: () => undefined,
    });

    const select = root.querySelector('[data-role="image-sort-select"]');
    expect(select).not.toBeNull();
    expect(select?.textContent).toContain("文件名");
    expect(root.querySelector("select")).toBeNull();
  });

  it("highlights the dropzone with drag-active while dragging over it", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: () => undefined,
    });

    const mainDropzone = root.querySelector('[data-role="main-dropzone"]');
    if (!mainDropzone) {
      throw new Error("找不到主上传拖放区域");
    }

    expect(mainDropzone.getAttribute("data-state")).toBe("idle");

    dispatchDragEvent(mainDropzone, "dragenter");
    await flushAsyncWork();
    expect(mainDropzone.getAttribute("data-state")).toBe("drag-active");

    dispatchDragEvent(mainDropzone, "dragleave", null);
    await flushAsyncWork();
    expect(mainDropzone.getAttribute("data-state")).toBe("idle");
  });

  it("keeps the dropzone highlighted while dragging across children", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: emptyConfig,
      onChange: () => undefined,
    });

    const mainDropzone = root.querySelector('[data-role="main-dropzone"]');
    if (!mainDropzone) {
      throw new Error("找不到主上传拖放区域");
    }

    const innerInput = mainDropzone.querySelector("input");
    if (!innerInput) {
      throw new Error("找不到主上传输入框");
    }

    dispatchDragEvent(mainDropzone, "dragenter");
    dispatchDragEvent(mainDropzone, "dragleave", innerInput);
    await flushAsyncWork();
    expect(mainDropzone.getAttribute("data-state")).toBe("drag-active");

    dispatchDragEvent(mainDropzone, "dragleave", null);
    await flushAsyncWork();
    expect(mainDropzone.getAttribute("data-state")).toBe("idle");
  });
});
