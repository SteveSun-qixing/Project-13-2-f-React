/* eslint-disable no-control-regex --
 * 二进制标签解析按位面剥离 NUL 填充（ID3/M4A 文本终止符与尾部补零），
 * `\u0000` 出现在正则中是本模块的解析语义而非缺陷；本文件自旧族 music-BCP
 * 逐字迁移（矩阵裁决：迁移），运行时字节逻辑不做改写。 */
import { resolveFileName } from "./utils";

export interface EmbeddedArtwork {
  mimeType: string;
  bytes: Uint8Array;
  description?: string | undefined;
}

export interface EmbeddedAudioMetadata {
  title?: string | undefined;
  artist?: string | undefined;
  album?: string | undefined;
  artwork?: EmbeddedArtwork | undefined;
  lyricsText?: string | undefined;
  timedLyricsText?: string | undefined;
}

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) {
    const buffer = new ArrayBuffer(input.byteLength);
    const output = new Uint8Array(buffer);
    output.set(input);
    return output;
  }

  return new Uint8Array(input.slice(0));
}

function ownedSlice(bytes: Uint8Array, start?: number, end?: number): Uint8Array {
  const sliced = bytes.slice(start, end);
  return toUint8Array(sliced);
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readUInt64BE(bytes: Uint8Array, offset: number): number {
  return (readUInt32BE(bytes, offset) * 2 ** 32) + readUInt32BE(bytes, offset + 4);
}

function readUInt24BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 16) | ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0);
}

function readSyncSafeInt(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] ?? 0) & 0x7f) << 21)
    | (((bytes[offset + 1] ?? 0) & 0x7f) << 14)
    | (((bytes[offset + 2] ?? 0) & 0x7f) << 7)
    | ((bytes[offset + 3] ?? 0) & 0x7f);
}

function decodeIso88591(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

function decodeUtf16(bytes: Uint8Array, bigEndian = false): string {
  let view = bytes;
  let resolvedBigEndian = bigEndian;

  if (view.length >= 2) {
    if (view[0] === 0xfe && view[1] === 0xff) {
      resolvedBigEndian = true;
      view = view.slice(2);
    } else if (view[0] === 0xff && view[1] === 0xfe) {
      resolvedBigEndian = false;
      view = view.slice(2);
    }
  }

  if (resolvedBigEndian) {
    const swapped = new Uint8Array(view.length);
    for (let index = 0; index < view.length; index += 2) {
      swapped[index] = view[index + 1] ?? 0;
      swapped[index + 1] = view[index] ?? 0;
    }
    view = swapped;
  }

  return new TextDecoder("utf-16le", { fatal: false }).decode(view).replace(/\u0000+$/g, "");
}

function decodeEncodedText(bytes: Uint8Array, encoding: number): string {
  switch (encoding) {
    case 0:
      return decodeIso88591(bytes).replace(/\u0000+$/g, "");
    case 1:
      return decodeUtf16(bytes);
    case 2:
      return decodeUtf16(bytes, true);
    case 3:
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000+$/g, "");
    default:
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000+$/g, "");
  }
}

function readEncodedTerminatedText(
  bytes: Uint8Array,
  startOffset: number,
  encoding: number,
): { text: string; nextOffset: number } {
  if (encoding === 1 || encoding === 2) {
    for (let offset = startOffset; offset + 1 < bytes.length; offset += 2) {
      if (bytes[offset] === 0 && bytes[offset + 1] === 0) {
        return {
          text: decodeEncodedText(bytes.slice(startOffset, offset), encoding),
          nextOffset: offset + 2,
        };
      }
    }

    return {
      text: decodeEncodedText(bytes.slice(startOffset), encoding),
      nextOffset: bytes.length,
    };
  }

  for (let offset = startOffset; offset < bytes.length; offset += 1) {
    if (bytes[offset] === 0) {
      return {
        text: decodeEncodedText(bytes.slice(startOffset, offset), encoding),
        nextOffset: offset + 1,
      };
    }
  }

  return {
    text: decodeEncodedText(bytes.slice(startOffset), encoding),
    nextOffset: bytes.length,
  };
}

function stripUnsynchronization(bytes: Uint8Array): Uint8Array {
  const cleaned: number[] = [];

  for (let index = 0; index < bytes.length; index += 1) {
    const current = bytes[index] ?? 0;
    const next = bytes[index + 1];
    cleaned.push(current);

    if (current === 0xff && next === 0x00) {
      index += 1;
    }
  }

  const buffer = new ArrayBuffer(cleaned.length);
  const output = new Uint8Array(buffer);
  output.set(cleaned);
  return output;
}

function mergePreferredText(current: string | undefined, next: string | undefined): string | undefined {
  return current?.trim() || next?.trim() || undefined;
}

function normalizeMimeType(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "image/jpg") {
    return "image/jpeg";
  }

  return normalized;
}

function detectImageMimeType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12
    && decodeIso88591(bytes.slice(0, 4)) === "RIFF"
    && decodeIso88591(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 6
    && (decodeIso88591(bytes.slice(0, 6)) === "GIF87a" || decodeIso88591(bytes.slice(0, 6)) === "GIF89a")
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 4
    && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
      || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && (bytes[3] === 0x2a || bytes[3] === 0x2b))
      || (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00))
  ) {
    return "image/tiff";
  }

  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }

  return undefined;
}

function resolveArtworkMimeType(bytes: Uint8Array, declaredMimeType?: string): string {
  return detectImageMimeType(bytes) ?? normalizeMimeType(declaredMimeType) ?? "image/jpeg";
}

function formatLrcTimestamp(timeMs: number): string {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const centiseconds = Math.floor((safe % 1_000) / 10);

  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
}

function parseSyltFrame(payload: Uint8Array): string | undefined {
  if (payload.length < 10) {
    return undefined;
  }

  const encoding = payload[0] ?? 0;
  const timestampFormat = payload[4] ?? 0;
  let offset = 6;
  offset = readEncodedTerminatedText(payload, offset, encoding).nextOffset;

  if (timestampFormat !== 1) {
    return undefined;
  }

  const lines: string[] = [];

  while (offset < payload.length) {
    const parsedText = readEncodedTerminatedText(payload, offset, encoding);
    offset = parsedText.nextOffset;
    if (offset + 4 > payload.length) {
      break;
    }

    const timestamp = readUInt32BE(payload, offset);
    offset += 4;

    const text = parsedText.text.trim();
    if (text) {
      lines.push(`${formatLrcTimestamp(timestamp)}${text}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function parseId3v2(bytes: Uint8Array): EmbeddedAudioMetadata {
  if (bytes.length < 10 || decodeIso88591(bytes.slice(0, 3)) !== "ID3") {
    return {};
  }

  const version = bytes[3] ?? 0;
  const flags = bytes[5] ?? 0;
  const tagSize = readSyncSafeInt(bytes, 6);
  let tagBody = ownedSlice(bytes, 10, 10 + tagSize);

  if ((flags & 0x80) !== 0) {
    tagBody = stripUnsynchronization(tagBody);
  }

  if ((flags & 0x40) !== 0 && tagBody.length >= 4) {
    const extendedHeaderSize = version === 4 ? readSyncSafeInt(tagBody, 0) : readUInt32BE(tagBody, 0) + 4;
    tagBody = tagBody.slice(Math.min(extendedHeaderSize, tagBody.length));
  }

  const metadata: EmbeddedAudioMetadata = {};

  for (let offset = 0; offset + 10 <= tagBody.length;) {
    const frameId = decodeIso88591(tagBody.slice(offset, offset + 4));
    if (!frameId.trim() || /^\x00+$/u.test(frameId)) {
      break;
    }

    const frameSize = version === 4 ? readSyncSafeInt(tagBody, offset + 4) : readUInt32BE(tagBody, offset + 4);
    if (frameSize <= 0 || offset + 10 + frameSize > tagBody.length) {
      break;
    }

    const payload = tagBody.slice(offset + 10, offset + 10 + frameSize);

    switch (frameId) {
      case "TIT2":
        metadata.title = mergePreferredText(metadata.title, decodeEncodedText(payload.slice(1), payload[0] ?? 0).trim());
        break;
      case "TPE1":
        metadata.artist = mergePreferredText(metadata.artist, decodeEncodedText(payload.slice(1), payload[0] ?? 0).trim());
        break;
      case "TALB":
        metadata.album = mergePreferredText(metadata.album, decodeEncodedText(payload.slice(1), payload[0] ?? 0).trim());
        break;
      case "USLT": {
        const encoding = payload[0] ?? 0;
        const descriptor = readEncodedTerminatedText(payload, 4, encoding);
        const lyricsText = decodeEncodedText(payload.slice(descriptor.nextOffset), encoding).trim();
        metadata.lyricsText = mergePreferredText(metadata.lyricsText, lyricsText);
        break;
      }
      case "SYLT":
        metadata.timedLyricsText = mergePreferredText(metadata.timedLyricsText, parseSyltFrame(payload));
        break;
      case "APIC": {
        const encoding = payload[0] ?? 0;
        const mime = readEncodedTerminatedText(payload, 1, 0);
        const pictureTypeOffset = mime.nextOffset;
        const description = readEncodedTerminatedText(payload, pictureTypeOffset + 1, encoding);
        const imageBytes = payload.slice(description.nextOffset);
        if (imageBytes.length > 0) {
          metadata.artwork = {
            mimeType: resolveArtworkMimeType(imageBytes, mime.text),
            bytes: imageBytes,
            description: description.text,
          };
        }
        break;
      }
      default:
        break;
    }

    offset += 10 + frameSize;
  }

  return metadata;
}

function parseVorbisComments(bytes: Uint8Array): Record<string, string> {
  const comments: Record<string, string> = {};
  if (bytes.length < 8) {
    return comments;
  }

  let offset = 0;
  const vendorLength = readUInt32LE(bytes, offset);
  offset += 4 + vendorLength;
  if (offset + 4 > bytes.length) {
    return comments;
  }

  const commentCount = readUInt32LE(bytes, offset);
  offset += 4;

  for (let index = 0; index < commentCount; index += 1) {
    if (offset + 4 > bytes.length) {
      break;
    }

    const length = readUInt32LE(bytes, offset);
    offset += 4;
    if (offset + length > bytes.length) {
      break;
    }

    const entry = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(offset, offset + length));
    offset += length;

    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim().toUpperCase();
    const value = entry.slice(separatorIndex + 1).trim();
    if (key && value) {
      comments[key] = value;
    }
  }

  return comments;
}

function parseFlacPicture(bytes: Uint8Array): EmbeddedArtwork | undefined {
  if (bytes.length < 32) {
    return undefined;
  }

  let offset = 0;
  offset += 4;

  const mimeLength = readUInt32BE(bytes, offset);
  offset += 4;
  const mimeType = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(offset, offset + mimeLength));
  offset += mimeLength;

  const descriptionLength = readUInt32BE(bytes, offset);
  offset += 4;
  const description = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(offset, offset + descriptionLength));
  offset += descriptionLength;

  offset += 16;
  const dataLength = readUInt32BE(bytes, offset);
  offset += 4;

  if (offset + dataLength > bytes.length) {
    return undefined;
  }

  return {
    mimeType: resolveArtworkMimeType(bytes.slice(offset, offset + dataLength), mimeType),
    bytes: bytes.slice(offset, offset + dataLength),
    description,
  };
}

function parseFlac(bytes: Uint8Array): EmbeddedAudioMetadata {
  if (bytes.length < 4 || decodeIso88591(bytes.slice(0, 4)) !== "fLaC") {
    return {};
  }

  const metadata: EmbeddedAudioMetadata = {};
  let offset = 4;
  let isLastBlock = false;

  while (!isLastBlock && offset + 4 <= bytes.length) {
    const header = bytes[offset] ?? 0;
    isLastBlock = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLength = readUInt24BE(bytes, offset + 1);
    offset += 4;

    if (offset + blockLength > bytes.length) {
      break;
    }

    const block = bytes.slice(offset, offset + blockLength);
    offset += blockLength;

    if (blockType === 4) {
      const comments = parseVorbisComments(block);
      metadata.title = mergePreferredText(metadata.title, comments.TITLE);
      metadata.artist = mergePreferredText(metadata.artist, comments.ARTIST);
      metadata.album = mergePreferredText(metadata.album, comments.ALBUM);
      metadata.lyricsText =
        mergePreferredText(metadata.lyricsText, comments.LYRICS)
        ?? mergePreferredText(metadata.lyricsText, comments.UNSYNCEDLYRICS)
        ?? mergePreferredText(metadata.lyricsText, comments["UNSYNCED LYRICS"]);
    } else if (blockType === 6) {
      metadata.artwork = metadata.artwork ?? parseFlacPicture(block);
    }
  }

  return metadata;
}

type Mp4Atom = {
  type: string;
  start: number;
  end: number;
  payloadStart: number;
  payloadEnd: number;
};

const MP4_CONTAINER_TYPES = new Set([
  "moov",
  "udta",
  "meta",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "ilst",
]);

function readMp4Atom(bytes: Uint8Array, offset: number, end: number): Mp4Atom | undefined {
  if (offset + 8 > end) {
    return undefined;
  }

  let size = readUInt32BE(bytes, offset);
  const type = decodeIso88591(bytes.slice(offset + 4, offset + 8));
  let headerSize = 8;

  if (size === 1) {
    if (offset + 16 > end) {
      return undefined;
    }

    size = readUInt64BE(bytes, offset + 8);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }

  if (!Number.isFinite(size) || size < headerSize || offset + size > end) {
    return undefined;
  }

  let payloadStart = offset + headerSize;
  if (type === "meta") {
    if (payloadStart + 4 > offset + size) {
      return undefined;
    }

    payloadStart += 4;
  }

  return {
    type,
    start: offset,
    end: offset + size,
    payloadStart,
    payloadEnd: offset + size,
  };
}

function decodeMp4Text(bytes: Uint8Array, dataType: number): string {
  if (dataType === 2) {
    return decodeUtf16(bytes).replace(/\u0000+$/g, "").trim();
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000+$/g, "").trim();
}

function inferImageMimeTypeFromBytes(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 4
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 4
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
  ) {
    return "image/webp";
  }

  if (
    bytes.length >= 4
    && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
      || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && (bytes[3] === 0x2a || bytes[3] === 0x2b))
      || (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00))
  ) {
    return "image/tiff";
  }

  return undefined;
}

function parseMp4Cover(bytes: Uint8Array, dataType: number): EmbeddedArtwork | undefined {
  const mimeType = (() => {
    switch (dataType) {
      case 13:
        return "image/jpeg";
      case 14:
        return "image/png";
      case 27:
        return "image/bmp";
      default:
        return inferImageMimeTypeFromBytes(bytes);
    }
  })();

  if (!mimeType || bytes.length === 0) {
    return undefined;
  }

  return {
    mimeType,
    bytes,
  };
}

function readMp4DataAtom(bytes: Uint8Array, start: number, end: number): { dataType: number; value: Uint8Array } | undefined {
  for (let offset = start; offset + 8 <= end;) {
    const atom = readMp4Atom(bytes, offset, end);
    if (!atom) {
      break;
    }

    if (atom.type === "data") {
      if (atom.payloadStart + 8 > atom.payloadEnd) {
        return undefined;
      }

      return {
        dataType: readUInt32BE(bytes, atom.payloadStart),
        value: bytes.slice(atom.payloadStart + 8, atom.payloadEnd),
      };
    }

    offset = atom.end;
  }

  return undefined;
}

function applyMp4MetadataItem(bytes: Uint8Array, atom: Mp4Atom, metadata: EmbeddedAudioMetadata): void {
  const data = readMp4DataAtom(bytes, atom.payloadStart, atom.payloadEnd);
  if (!data) {
    return;
  }

  switch (atom.type) {
    case "\u00a9nam":
      metadata.title = mergePreferredText(metadata.title, decodeMp4Text(data.value, data.dataType));
      break;
    case "\u00a9ART":
    case "aART":
      metadata.artist = mergePreferredText(metadata.artist, decodeMp4Text(data.value, data.dataType));
      break;
    case "\u00a9alb":
      metadata.album = mergePreferredText(metadata.album, decodeMp4Text(data.value, data.dataType));
      break;
    case "\u00a9lyr":
      metadata.lyricsText = mergePreferredText(metadata.lyricsText, decodeMp4Text(data.value, data.dataType));
      break;
    case "covr":
      metadata.artwork = metadata.artwork ?? parseMp4Cover(data.value, data.dataType);
      break;
    default:
      break;
  }
}

function visitMp4Atoms(
  bytes: Uint8Array,
  start: number,
  end: number,
  visitor: (atom: Mp4Atom) => void,
): void {
  for (let offset = start; offset + 8 <= end;) {
    const atom = readMp4Atom(bytes, offset, end);
    if (!atom) {
      break;
    }

    visitor(atom);

    if (atom.type === "ilst") {
      for (let itemOffset = atom.payloadStart; itemOffset + 8 <= atom.payloadEnd;) {
        const itemAtom = readMp4Atom(bytes, itemOffset, atom.payloadEnd);
        if (!itemAtom) {
          break;
        }

        visitor(itemAtom);
        itemOffset = itemAtom.end;
      }
    } else if (MP4_CONTAINER_TYPES.has(atom.type)) {
      visitMp4Atoms(bytes, atom.payloadStart, atom.payloadEnd, visitor);
    }

    offset = atom.end;
  }
}

function parseMp4(bytes: Uint8Array): EmbeddedAudioMetadata {
  const metadata: EmbeddedAudioMetadata = {};

  visitMp4Atoms(bytes, 0, bytes.length, (atom) => {
    if (atom.type !== "ilst" && atom.type.length === 4) {
      applyMp4MetadataItem(bytes, atom, metadata);
    }
  });

  return metadata;
}

function resolveExtension(fileName: string): string {
  const lower = resolveFileName(fileName).toLowerCase();
  const index = lower.lastIndexOf(".");
  return index >= 0 ? lower.slice(index) : "";
}

export function parseEmbeddedAudioMetadata(input: {
  bytes: ArrayBuffer | Uint8Array;
  fileName?: string;
  mimeType?: string;
}): EmbeddedAudioMetadata {
  const bytes = toUint8Array(input.bytes);
  const mimeType = input.mimeType?.trim().toLowerCase();
  const extension = resolveExtension(input.fileName ?? "");

  if (bytes.length >= 3 && decodeIso88591(bytes.slice(0, 3)) === "ID3") {
    return parseId3v2(bytes);
  }

  if (bytes.length >= 4 && decodeIso88591(bytes.slice(0, 4)) === "fLaC") {
    return parseFlac(bytes);
  }

  if (bytes.length >= 8 && decodeIso88591(bytes.slice(4, 8)) === "ftyp") {
    return parseMp4(bytes);
  }

  if (mimeType === "audio/mpeg" || extension === ".mp3") {
    return parseId3v2(bytes);
  }

  if (mimeType === "audio/flac" || extension === ".flac") {
    return parseFlac(bytes);
  }

  if (
    mimeType === "audio/mp4"
    || mimeType === "audio/x-m4a"
    || extension === ".m4a"
    || extension === ".mp4"
  ) {
    return parseMp4(bytes);
  }

  return {};
}
