"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// Chips-BaseCardPlugin/music-BCP/src/shared/audio-metadata.ts
var audio_metadata_exports = {};
__export(audio_metadata_exports, {
  parseEmbeddedAudioMetadata: () => parseEmbeddedAudioMetadata
});
module.exports = __toCommonJS(audio_metadata_exports);

// Chips-BaseCardPlugin/music-BCP/src/shared/utils.ts
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function normalizeRelativeCardResourcePath(value) {
  if (!isNonEmptyString(value)) {
    return void 0;
  }
  const normalized = value.replace(/\\/g, "/").trim().replace(/^\.?\//, "");
  if (!normalized) {
    return void 0;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return void 0;
  }
  return segments.join("/");
}
function resolveFileName(resourcePath) {
  const normalized = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
}

// Chips-BaseCardPlugin/music-BCP/src/shared/audio-metadata.ts
function toUint8Array(input) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}
function readUInt32BE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}
function readUInt32LE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
function readUInt64BE(bytes, offset) {
  return readUInt32BE(bytes, offset) * 2 ** 32 + readUInt32BE(bytes, offset + 4);
}
function readUInt24BE(bytes, offset) {
  return bytes[offset] << 16 | bytes[offset + 1] << 8 | bytes[offset + 2];
}
function readSyncSafeInt(bytes, offset) {
  return (bytes[offset] & 127) << 21 | (bytes[offset + 1] & 127) << 14 | (bytes[offset + 2] & 127) << 7 | bytes[offset + 3] & 127;
}
function decodeIso88591(bytes) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}
function decodeUtf16(bytes, bigEndian = false) {
  let view = bytes;
  let resolvedBigEndian = bigEndian;
  if (view.length >= 2) {
    if (view[0] === 254 && view[1] === 255) {
      resolvedBigEndian = true;
      view = view.slice(2);
    } else if (view[0] === 255 && view[1] === 254) {
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
function decodeEncodedText(bytes, encoding) {
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
function readEncodedTerminatedText(bytes, startOffset, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let offset = startOffset; offset + 1 < bytes.length; offset += 2) {
      if (bytes[offset] === 0 && bytes[offset + 1] === 0) {
        return {
          text: decodeEncodedText(bytes.slice(startOffset, offset), encoding),
          nextOffset: offset + 2
        };
      }
    }
    return {
      text: decodeEncodedText(bytes.slice(startOffset), encoding),
      nextOffset: bytes.length
    };
  }
  for (let offset = startOffset; offset < bytes.length; offset += 1) {
    if (bytes[offset] === 0) {
      return {
        text: decodeEncodedText(bytes.slice(startOffset, offset), encoding),
        nextOffset: offset + 1
      };
    }
  }
  return {
    text: decodeEncodedText(bytes.slice(startOffset), encoding),
    nextOffset: bytes.length
  };
}
function stripUnsynchronization(bytes) {
  const cleaned = [];
  for (let index = 0; index < bytes.length; index += 1) {
    const current = bytes[index];
    const next = bytes[index + 1];
    cleaned.push(current);
    if (current === 255 && next === 0) {
      index += 1;
    }
  }
  return Uint8Array.from(cleaned);
}
function mergePreferredText(current, next) {
  return current?.trim() || next?.trim() || void 0;
}
function formatLrcTimestamp(timeMs) {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 6e4);
  const seconds = Math.floor(safe % 6e4 / 1e3);
  const centiseconds = Math.floor(safe % 1e3 / 10);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}]`;
}
function parseSyltFrame(payload) {
  if (payload.length < 10) {
    return void 0;
  }
  const encoding = payload[0] ?? 0;
  const timestampFormat = payload[4] ?? 0;
  let offset = 6;
  offset = readEncodedTerminatedText(payload, offset, encoding).nextOffset;
  if (timestampFormat !== 1) {
    return void 0;
  }
  const lines = [];
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
  return lines.length > 0 ? lines.join("\n") : void 0;
}
function parseId3v2(bytes) {
  if (bytes.length < 10 || decodeIso88591(bytes.slice(0, 3)) !== "ID3") {
    return {};
  }
  const version = bytes[3] ?? 0;
  const flags = bytes[5] ?? 0;
  const tagSize = readSyncSafeInt(bytes, 6);
  let tagBody = bytes.slice(10, 10 + tagSize);
  if ((flags & 128) !== 0) {
    tagBody = stripUnsynchronization(tagBody);
  }
  if ((flags & 64) !== 0 && tagBody.length >= 4) {
    const extendedHeaderSize = version === 4 ? readSyncSafeInt(tagBody, 0) : readUInt32BE(tagBody, 0) + 4;
    tagBody = tagBody.slice(Math.min(extendedHeaderSize, tagBody.length));
  }
  const metadata = {};
  for (let offset = 0; offset + 10 <= tagBody.length; ) {
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
            mimeType: mime.text || "image/jpeg",
            bytes: imageBytes,
            description: description.text
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
function parseVorbisComments(bytes) {
  const comments = {};
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
function parseFlacPicture(bytes) {
  if (bytes.length < 32) {
    return void 0;
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
    return void 0;
  }
  return {
    mimeType: mimeType || "image/jpeg",
    bytes: bytes.slice(offset, offset + dataLength),
    description
  };
}
function parseFlac(bytes) {
  if (bytes.length < 4 || decodeIso88591(bytes.slice(0, 4)) !== "fLaC") {
    return {};
  }
  const metadata = {};
  let offset = 4;
  let isLastBlock = false;
  while (!isLastBlock && offset + 4 <= bytes.length) {
    const header = bytes[offset] ?? 0;
    isLastBlock = (header & 128) !== 0;
    const blockType = header & 127;
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
      metadata.lyricsText = mergePreferredText(metadata.lyricsText, comments.LYRICS) ?? mergePreferredText(metadata.lyricsText, comments.UNSYNCEDLYRICS) ?? mergePreferredText(metadata.lyricsText, comments["UNSYNCED LYRICS"]);
    } else if (blockType === 6) {
      metadata.artwork = metadata.artwork ?? parseFlacPicture(block);
    }
  }
  return metadata;
}
var MP4_CONTAINER_TYPES = /* @__PURE__ */ new Set([
  "moov",
  "udta",
  "meta",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "ilst"
]);
function readMp4Atom(bytes, offset, end) {
  if (offset + 8 > end) {
    return void 0;
  }
  let size = readUInt32BE(bytes, offset);
  const type = decodeIso88591(bytes.slice(offset + 4, offset + 8));
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > end) {
      return void 0;
    }
    size = readUInt64BE(bytes, offset + 8);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (!Number.isFinite(size) || size < headerSize || offset + size > end) {
    return void 0;
  }
  let payloadStart = offset + headerSize;
  if (type === "meta") {
    if (payloadStart + 4 > offset + size) {
      return void 0;
    }
    payloadStart += 4;
  }
  return {
    type,
    start: offset,
    end: offset + size,
    payloadStart,
    payloadEnd: offset + size
  };
}
function decodeMp4Text(bytes, dataType) {
  if (dataType === 2) {
    return decodeUtf16(bytes).replace(/\u0000+$/g, "").trim();
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000+$/g, "").trim();
}
function inferImageMimeTypeFromBytes(bytes) {
  if (bytes.length >= 4 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }
  if (bytes.length >= 4 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70) {
    return "image/webp";
  }
  if (bytes.length >= 4 && (bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 42 && bytes[3] === 0 || bytes[0] === 77 && bytes[1] === 77 && bytes[2] === 0 && (bytes[3] === 42 || bytes[3] === 43) || bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 43 && bytes[3] === 0)) {
    return "image/tiff";
  }
  return void 0;
}
function parseMp4Cover(bytes, dataType) {
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
    return void 0;
  }
  return {
    mimeType,
    bytes
  };
}
function readMp4DataAtom(bytes, start, end) {
  for (let offset = start; offset + 8 <= end; ) {
    const atom = readMp4Atom(bytes, offset, end);
    if (!atom) {
      break;
    }
    if (atom.type === "data") {
      if (atom.payloadStart + 8 > atom.payloadEnd) {
        return void 0;
      }
      return {
        dataType: readUInt32BE(bytes, atom.payloadStart),
        value: bytes.slice(atom.payloadStart + 8, atom.payloadEnd)
      };
    }
    offset = atom.end;
  }
  return void 0;
}
function applyMp4MetadataItem(bytes, atom, metadata) {
  const data = readMp4DataAtom(bytes, atom.payloadStart, atom.payloadEnd);
  if (!data) {
    return;
  }
  switch (atom.type) {
    case "\xA9nam":
      metadata.title = mergePreferredText(metadata.title, decodeMp4Text(data.value, data.dataType));
      break;
    case "\xA9ART":
    case "aART":
      metadata.artist = mergePreferredText(metadata.artist, decodeMp4Text(data.value, data.dataType));
      break;
    case "\xA9alb":
      metadata.album = mergePreferredText(metadata.album, decodeMp4Text(data.value, data.dataType));
      break;
    case "\xA9lyr":
      metadata.lyricsText = mergePreferredText(metadata.lyricsText, decodeMp4Text(data.value, data.dataType));
      break;
    case "covr":
      metadata.artwork = metadata.artwork ?? parseMp4Cover(data.value, data.dataType);
      break;
    default:
      break;
  }
}
function visitMp4Atoms(bytes, start, end, visitor) {
  for (let offset = start; offset + 8 <= end; ) {
    const atom = readMp4Atom(bytes, offset, end);
    if (!atom) {
      break;
    }
    visitor(atom);
    if (atom.type === "ilst") {
      for (let itemOffset = atom.payloadStart; itemOffset + 8 <= atom.payloadEnd; ) {
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
function parseMp4(bytes) {
  const metadata = {};
  visitMp4Atoms(bytes, 0, bytes.length, (atom) => {
    if (atom.type !== "ilst" && atom.type.length === 4) {
      applyMp4MetadataItem(bytes, atom, metadata);
    }
  });
  return metadata;
}
function resolveExtension(fileName) {
  const lower = resolveFileName(fileName).toLowerCase();
  const index = lower.lastIndexOf(".");
  return index >= 0 ? lower.slice(index) : "";
}
function parseEmbeddedAudioMetadata(input) {
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
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a" || extension === ".m4a" || extension === ".mp4") {
    return parseMp4(bytes);
  }
  return {};
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseEmbeddedAudioMetadata
});
