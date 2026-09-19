import { canvasToPngBytes, renderIconCanvas } from "./canvas-renderer";
import { createIcnsFile } from "./icns";
import { createIcoFile } from "./ico";
import { createZipStore } from "./zip-store";
import type { BinaryIconFile, IconOutputFormat, RenderIconOptions } from "./types";

const FORMAT_MIME_TYPES: Record<IconOutputFormat, string> = {
  png: "image/png",
  ico: "image/x-icon",
  icns: "image/icns",
};

const ICO_MAX_SIZE = 256;

function resolveBaseName(options: RenderIconOptions): string {
  if (options.sourceMode === "image" && options.imageSource) {
    return options.imageSource.baseName;
  }
  return options.selectedGlyph?.label.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() || "icon";
}

function resolveIcnsType(size: number): string {
  if (size <= 16) {
    return "ic04";
  }
  if (size <= 32) {
    return "ic05";
  }
  if (size <= 64) {
    return "ic12";
  }
  if (size <= 128) {
    return "ic07";
  }
  if (size <= 256) {
    return "ic08";
  }
  return "ic09";
}

async function renderPng(options: RenderIconOptions, size = options.size): Promise<Uint8Array> {
  const canvas = await renderIconCanvas({
    ...options,
    size,
  });
  return canvasToPngBytes(canvas);
}

async function createPngIcon(options: RenderIconOptions, baseName: string): Promise<BinaryIconFile> {
  const bytes = await renderPng(options);
  return {
    fileName: `${baseName}.png`,
    mimeType: FORMAT_MIME_TYPES.png,
    bytes,
  };
}

async function createIcoIcon(options: RenderIconOptions, baseName: string): Promise<BinaryIconFile> {
  const icoSize = Math.min(options.size, ICO_MAX_SIZE);
  const pngBytes = await renderPng(options, icoSize);
  return {
    fileName: `${baseName}.ico`,
    mimeType: FORMAT_MIME_TYPES.ico,
    bytes: createIcoFile([{ size: icoSize, pngBytes }]),
  };
}

async function createIcnsIcon(options: RenderIconOptions, baseName: string): Promise<BinaryIconFile> {
  const pngBytes = await renderPng(options);
  return {
    fileName: `${baseName}.icns`,
    mimeType: FORMAT_MIME_TYPES.icns,
    bytes: createIcnsFile([{ type: resolveIcnsType(options.size), pngBytes }]),
  };
}

export async function generateIconFiles(options: RenderIconOptions): Promise<BinaryIconFile[]> {
  const baseName = resolveBaseName(options);
  const creators: Record<IconOutputFormat, () => Promise<BinaryIconFile>> = {
    png: () => createPngIcon(options, baseName),
    ico: () => createIcoIcon(options, baseName),
    icns: () => createIcnsIcon(options, baseName),
  };

  return Promise.all(options.settings.formats.map((format) => creators[format]()));
}

export async function generateIconZip(options: RenderIconOptions, zipName = "icons.zip"): Promise<BinaryIconFile> {
  const files = await generateIconFiles(options);
  return {
    fileName: zipName,
    mimeType: "application/zip",
    bytes: createZipStore(files.map((file) => ({
      path: file.fileName,
      bytes: file.bytes,
    }))),
  };
}
