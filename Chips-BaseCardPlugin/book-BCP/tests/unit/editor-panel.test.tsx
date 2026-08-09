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
});
