import { describe, expect, it } from "vitest";
import { extractZipEntry, parseZipEntries } from "../../src/shared/archive";
import { createStoredZip, JPEG_BYTES, PNG_BYTES } from "../helpers/zip";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

describe("archive image bundle utilities", () => {
  it("parses ZIP central directory metadata", () => {
    const zip = createStoredZip([
      {
        path: "comic/002.jpg",
        data: JPEG_BYTES,
        modifiedAt: new Date("2026-01-02T10:00:00"),
      },
      {
        path: "comic/readme.txt",
        data: "ignore",
      },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      path: "comic/002.jpg",
      fileName: "002.jpg",
      compressionMethod: 0,
      isDirectory: false,
    });
    expect(entries[0]?.entryTime).toBeTypeOf("number");
  });

  it("extracts stored ZIP entries for EPUB metadata parsing", async () => {
    const zip = createStoredZip([
      { path: "comic/010.jpg", data: JPEG_BYTES },
      { path: "comic/002.png", data: PNG_BYTES },
      { path: "comic/readme.txt", data: "ignore" },
    ]);
    const buffer = toArrayBuffer(zip);
    const entries = parseZipEntries(buffer);
    const pngEntry = entries.find((entry) => entry.path === "comic/002.png");

    expect(pngEntry).toBeDefined();
    await expect(extractZipEntry(buffer, pngEntry!)).resolves.toEqual(PNG_BYTES);
  });

  it("preserves ZIP entry time for EPUB cover metadata", () => {
    const zip = createStoredZip([
      {
        path: "comic/003.jpg",
        data: JPEG_BYTES,
        modifiedAt: new Date("2026-01-03T00:00:00"),
      },
      {
        path: "comic/001.jpg",
        data: JPEG_BYTES,
        modifiedAt: new Date("2026-01-01T00:00:00"),
      },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries.map((entry) => entry.entryTime)).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(((entries[0]?.entryTime) ?? 0) > ((entries[1]?.entryTime) ?? 0)).toBe(true);
  });

  it("decodes UTF-8 flagged ZIP names as UTF-8", () => {
    const zip = createStoredZip([
      {
        path: "comic/中国-封面.jpg",
        data: JPEG_BYTES,
        utf8: true,
      },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe("comic/中国-封面.jpg");
    expect(entries[0]?.fileName).toBe("中国-封面.jpg");
  });

  it("decodes non-UTF-8 flagged ZIP names with the CP437 codepage", () => {
    const zip = createStoredZip([
      {
        path: "comic/Übung-é.jpg",
        rawName: new Uint8Array([
          0x63, 0x6f, 0x6d, 0x69, 0x63, 0x2f,
          0x9a,
          0x62, 0x75, 0x6e, 0x67, 0x2d,
          0x82,
          0x2e, 0x6a, 0x70, 0x67,
        ]),
        utf8: false,
        data: JPEG_BYTES,
      },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe("comic/Übung-é.jpg");
    expect(entries[0]?.fileName).toBe("Übung-é.jpg");
  });
});
