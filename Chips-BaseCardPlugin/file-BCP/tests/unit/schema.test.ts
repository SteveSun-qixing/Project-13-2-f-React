import { describe, expect, it } from "vitest";
import { basecardDefinition } from "../../src/index";
import {
  collectBasecardResourcePaths,
  defaultBasecardConfig,
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "../../src/schema/card-config";
import {
  inferFileMimeType,
  normalizeExtension,
  resolveFileCategory,
} from "../../src/shared/file-types";
import { formatExtensionBadge, resolveFileName } from "../../src/shared/utils";

describe("file basecard schema", () => {
  it("exports the formal basecard definition contract", () => {
    expect(basecardDefinition.pluginId).toBe("chips.basecard.file");
    expect(basecardDefinition.cardType).toBe("base.file");
    expect(basecardDefinition.displayName).toBe("文件基础卡片");
    expect(basecardDefinition.aliases).toEqual(["FileCard"]);
    expect(basecardDefinition.icon).toMatchObject({
      name: "draft",
      decorative: true,
    });
    expect(basecardDefinition.previewPointerEvents).toBe("shielded");
    expect(basecardDefinition.createInitialConfig("base-1")).toMatchObject({
      card_type: "base.file",
      file_file: "",
      file_name: "",
      file_extension: "",
      cover_image: "",
    });
  });

  it("fills defaults during normalization", () => {
    expect(normalizeBasecardConfig(null)).toEqual(defaultBasecardConfig);

    const normalized = normalizeBasecardConfig({
      card_type: "base.file",
      theme: "",
      file_file: "docs\\report.pdf",
    });

    expect(normalized).toMatchObject({
      card_type: "base.file",
      file_file: "docs/report.pdf",
      file_name: "report",
      file_extension: "pdf",
      cover_image: "",
    });
  });

  it("keeps explicitly recognized file name and extension", () => {
    const normalized = normalizeBasecardConfig({
      file_file: "files/report.pdf",
      file_name: "季度报告",
      file_extension: "PDF",
    });

    expect(normalized.file_name).toBe("季度报告");
    expect(normalized.file_extension).toBe("pdf");
  });

  it("rejects empty or invalid file paths", () => {
    const emptyResult = validateBasecardConfig(
      normalizeBasecardConfig(defaultBasecardConfig),
    );
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.errors.file_file).toBe("file.validation.file_required");

    const invalidPaths = [
      "/abs.pdf",
      "./local.pdf",
      "../escape.pdf",
      "docs/../escape.pdf",
      "blob:https://example.test/file",
      "data:application/pdf;base64,AAAA",
      "file:///tmp/report.pdf",
      "C:/Users/demo/report.pdf",
      "docs/report.pdf?cache=1",
    ];

    for (const filePath of invalidPaths) {
      const result = validateBasecardConfig(
        normalizeBasecardConfig({ file_file: filePath }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.file_file).toBe("file.validation.file_path_invalid");
      expect(collectBasecardResourcePaths({ file_file: filePath })).toEqual([]);
    }
  });

  it("rejects invalid cover paths but accepts valid ones", () => {
    const invalid = validateBasecardConfig(
      normalizeBasecardConfig({
        file_file: "docs/report.pdf",
        cover_image: "https://example.test/cover.png",
      }),
    );
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.cover_image).toBe("file.validation.cover_path_invalid");

    const valid = validateBasecardConfig(
      normalizeBasecardConfig({
        file_file: "docs/report.pdf",
        cover_image: "assets\\cover.png",
      }),
    );
    expect(valid.valid).toBe(true);
  });

  it("collects deduplicated card-root resource paths", () => {
    expect(collectBasecardResourcePaths({
      file_file: "docs\\report.pdf",
      cover_image: "docs/report.pdf",
    })).toEqual(["docs/report.pdf"]);

    expect(collectBasecardResourcePaths({
      file_file: "docs/report.pdf",
      cover_image: "assets/cover.png",
    })).toEqual(["docs/report.pdf", "assets/cover.png"]);
  });

  it("resolves file categories, mime types and extension badges", () => {
    expect(resolveFileCategory("pdf")).toBe("document");
    expect(resolveFileCategory(".xlsx")).toBe("spreadsheet");
    expect(resolveFileCategory("key")).toBe("presentation");
    expect(resolveFileCategory("zip")).toBe("archive");
    expect(resolveFileCategory("flac")).toBe("audio");
    expect(resolveFileCategory("mkv")).toBe("video");
    expect(resolveFileCategory("png")).toBe("image");
    expect(resolveFileCategory("md")).toBe("text");
    expect(resolveFileCategory("tsx")).toBe("code");
    expect(resolveFileCategory("unknownext")).toBeUndefined();

    expect(inferFileMimeType("pdf")).toBe("application/pdf");
    expect(inferFileMimeType(".docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(inferFileMimeType("mp4")).toBe("video/mp4");
    expect(inferFileMimeType("unknownext")).toBeUndefined();

    expect(normalizeExtension(" .PDF ")).toBe("pdf");
    expect(resolveFileName("docs/report.pdf")).toBe("report.pdf");
    expect(formatExtensionBadge("docx")).toBe("DOCX");
    expect(formatExtensionBadge("markdown")).toBe("MARK");
    expect(formatExtensionBadge("")).toBe("");
  });
});
