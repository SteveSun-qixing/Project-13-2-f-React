import { describe, expect, it } from "vitest";
import { createIcnsFile } from "../../src/icon-workbench/icns";
import { createIcoFile } from "../../src/icon-workbench/ico";
import { stripExtension, toSafeFileName } from "../../src/icon-workbench/file-names";
import { createZipStore } from "../../src/icon-workbench/zip-store";

const tinyPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

describe("icon encoder core", () => {
  it("normalizes output file names", () => {
    expect(stripExtension("My App Icon.svg")).toBe("My App Icon");
    expect(toSafeFileName("My App Icon.svg")).toBe("My-App-Icon.svg");
  });

  it("creates an ICO container with PNG image entries", () => {
    const ico = createIcoFile([
      { size: 16, pngBytes: tinyPng },
      { size: 256, pngBytes: tinyPng },
    ]);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(0);
  });

  it("rejects ICO payloads larger than 256 pixels", () => {
    expect(() => createIcoFile([{ size: 512, pngBytes: tinyPng }])).toThrow();
  });

  it("creates an ICNS container with big-endian length fields", () => {
    const icns = createIcnsFile([{ type: "ic09", pngBytes: tinyPng }]);
    const view = new DataView(icns.buffer);

    expect(ascii(icns, 0, 4)).toBe("icns");
    expect(view.getUint32(4, false)).toBe(icns.byteLength);
    expect(ascii(icns, 8, 4)).toBe("ic09");
    expect(view.getUint32(12, false)).toBe(tinyPng.byteLength + 8);
  });

  it("creates a ZIP Store archive for generated icon output", () => {
    const zip = createZipStore([
      { path: "demo.png", bytes: tinyPng },
    ]);
    const view = new DataView(zip.buffer);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(ascii(zip, 30, "demo.png".length)).toBe("demo.png");
    expect(view.getUint32(zip.byteLength - 22, true)).toBe(0x06054b50);
  });
});
