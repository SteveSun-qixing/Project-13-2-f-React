import { describe, expect, it } from "vitest";
import { basecardDefinition } from "../../src/index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "../../src/schema/card-config";
import {
  collectInternalResourcePaths,
  inferBookFormatFromFileName,
  inferBookMimeType,
} from "../../src/shared/utils";

describe("book basecard schema", () => {
  it("exports the formal book basecard definition contract", () => {
    expect(basecardDefinition.pluginId).toBe("chips.basecard.book");
    expect(basecardDefinition.cardType).toBe("base.book");
    expect(basecardDefinition.aliases).toContain("BookCard");
    expect(basecardDefinition.createInitialConfig("base-1")).toMatchObject({
      card_type: "base.book",
      source_type: "ebook",
    });
  });

  it("normalizes image sequence resources and collects all internal paths", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "base.book",
      source_type: "image-sequence",
      book_file: "content/book.epub",
      cover_image: "./covers/cover.jpg",
      image_sequence: [
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
        },
        {
          id: "skip",
          file_path: "../bad.jpg",
          file_name: "bad.jpg",
        },
      ],
      resource_paths: ["comic/001.jpg", "notes/extra.txt"],
    });

    expect(normalized.book_file).toBe("content/book.epub");
    expect(normalized.cover_image).toBe("covers/cover.jpg");
    expect(normalized.image_sequence).toHaveLength(1);
    expect(collectInternalResourcePaths(normalized)).toEqual([
      "content/book.epub",
      "covers/cover.jpg",
      "comic/001.jpg",
      "notes/extra.txt",
    ]);
  });

  it("keeps empty book metadata valid so placeholders can be shown", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "base.book",
      source_type: "ebook",
      book_file: "",
      book_name: "",
      book_author: "",
    });

    expect(validateBasecardConfig(normalized).valid).toBe(true);
  });

  it("infers common ebook formats and MIME hints", () => {
    expect(inferBookFormatFromFileName("Novel.EPUB")).toBe("epub");
    expect(inferBookFormatFromFileName("notes.markdown")).toBe("md");
    expect(inferBookMimeType("book.azw3")).toBe("application/vnd.amazon.ebook");
    expect(inferBookMimeType("base.pdf")).toBe("application/pdf");
  });

  it("rejects book_format values outside the supported whitelist", () => {
    const supported = normalizeBasecardConfig({
      card_type: "base.book",
      source_type: "ebook",
      book_file: "book.epub",
      book_format: "epub",
    });
    expect(validateBasecardConfig(supported).valid).toBe(true);

    const archive = normalizeBasecardConfig({
      card_type: "base.book",
      source_type: "image-sequence",
      image_sequence: [
        {
          id: "one",
          file_path: "comic/001.jpg",
          file_name: "001.jpg",
        },
      ],
      book_format: "cbz",
    });
    expect(validateBasecardConfig(archive).valid).toBe(true);

    const invalid = normalizeBasecardConfig({
      card_type: "base.book",
      source_type: "ebook",
      book_file: "book.epub",
      book_format: "hardcover",
    });
    expect(validateBasecardConfig(invalid).valid).toBe(false);
    expect(validateBasecardConfig(invalid).errors.book_format).toBeDefined();
  });
});
