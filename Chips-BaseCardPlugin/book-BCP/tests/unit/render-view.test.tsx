import { describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { VIEW_STYLE_TEXT } from "../../src/render/view";
import type { BasecardConfig } from "../../src/schema/card-config";

function flushViewEffects(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 80);
  });
}

describe("mountBasecardView", () => {
  it("uses a borderless reading-card layout with a wide cover", () => {
    const shellRule = VIEW_STYLE_TEXT.match(
      /\.chips-book-card__surface,\n\.chips-book-card__button\s*{[^}]+}/,
    )?.[0] ?? "";
    const coverRule = VIEW_STYLE_TEXT.match(/\.chips-book-card__cover\s*{[^}]+}/)?.[0] ?? "";

    expect(shellRule).toContain("border: 0;");
    expect(shellRule).not.toContain("border: 1px");
    expect(coverRule).toContain("flex: 0 0 clamp(112px, 32%, 190px);");
    expect(coverRule).toContain("aspect-ratio: 2 / 3;");
  });

  it("renders ebook metadata and opens the card-root book resource", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const config: BasecardConfig = {
      card_type: "base.book",
      theme: "",
      source_type: "ebook",
      book_file: "books/demo.epub",
      book_format: "epub",
      book_name: "Demo Book",
      book_author: "Alice",
      cover_image: "covers/demo.jpg",
      image_sequence: [],
      image_sort_basis: "filename",
      resource_paths: ["books/demo.epub", "covers/demo.jpg"],
    };

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl: async (resourcePath) => `file:///tmp/${resourcePath}`,
      openResource,
    });

    await flushViewEffects();

    expect(container.querySelector(".chips-book-card__title")?.textContent).toBe("Demo Book");
    expect(container.querySelector(".chips-book-card__author")?.textContent).toBe("Alice");
    expect(container.textContent).toContain("EPUB");

    const button = container.querySelector(".chips-book-card__button") as HTMLButtonElement | null;
    if (!button) {
      throw new Error("找不到电子书基础卡片按钮");
    }

    button.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "books/demo.epub",
      mimeType: "application/epub+zip",
      title: "Demo Book",
      fileName: "demo.epub",
      payload: {
        kind: "chips.book-card",
        version: "1.0.0",
        cardType: "base.book",
        mode: "ebook",
        resources: {
          book: expect.objectContaining({
            resourceId: "books/demo.epub",
            relativePath: "books/demo.epub",
          }),
        },
        display: {
          title: "Demo Book",
          author: "Alice",
        },
      },
    });

    dispose();
  });

  it("opens image sequences with all ordered images in the payload", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const config: BasecardConfig = {
      card_type: "base.book",
      theme: "",
      source_type: "image-sequence",
      book_file: "",
      book_format: "cbz",
      book_name: "Comic",
      book_author: "",
      cover_image: "comic/001.jpg",
      image_sequence: [
        {
          id: "two",
          file_path: "comic/002.jpg",
          file_name: "002.jpg",
          mime_type: "image/jpeg",
          entry_time: 2,
        },
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
          mime_type: "image/jpeg",
          entry_time: 1,
        },
      ],
      image_sort_basis: "entry-time",
      resource_paths: ["comic/001.jpg", "comic/002.jpg"],
    };

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl: async (resourcePath) => `file:///tmp/${resourcePath}`,
      openResource,
    });

    await flushViewEffects();

    const button = container.querySelector(".chips-book-card__button") as HTMLButtonElement | null;
    if (!button) {
      throw new Error("找不到图片包基础卡片按钮");
    }

    button.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "comic/001.jpg",
      mimeType: "image/jpeg",
      title: "Comic",
      fileName: "001.jpg",
      payload: expect.objectContaining({
        kind: "chips.book-card",
        mode: "image-sequence",
        resources: {
          images: [
            expect.objectContaining({ resourceId: "comic/001.jpg", relativePath: "comic/001.jpg" }),
            expect.objectContaining({ resourceId: "comic/002.jpg", relativePath: "comic/002.jpg" }),
          ],
        },
      }),
    });

    dispose();
  });

  it("shows empty state when no resource is configured", () => {
    const container = document.createElement("div");
    const dispose = mountBasecardView({
      container,
      config: {
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
      },
    });

    expect(container.querySelector(".chips-book-card__empty")?.textContent).toContain("未选择电子书");
    dispose();
  });
});
