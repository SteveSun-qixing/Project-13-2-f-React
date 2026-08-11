const UTF8_FILENAME_FLAG = 0x0800;

interface ZipFixtureEntry {
  path: string;
  data: Uint8Array | string;
  modifiedAt?: Date;
  utf8?: boolean;
  rawName?: Uint8Array;
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

const CP437_HIGH_ALIASES: Record<string, number> = {
  "\u00c7": 0x80, "\u00fc": 0x81, "\u00e9": 0x82, "\u00e2": 0x83, "\u00e4": 0x84, "\u00e0": 0x85, "\u00e5": 0x86, "\u00e7": 0x87,
  "\u00ea": 0x88, "\u00eb": 0x89, "\u00e8": 0x8a, "\u00ef": 0x8b, "\u00ee": 0x8c, "\u00ec": 0x8d, "\u00c4": 0x8e, "\u00c5": 0x8f,
  "\u00c9": 0x90, "\u00e6": 0x91, "\u00c6": 0x92, "\u00f4": 0x93, "\u00f6": 0x94, "\u00f2": 0x95, "\u00fb": 0x96, "\u00f9": 0x97,
  "\u00ff": 0x98, "\u00d6": 0x99, "\u00dc": 0x9a, "\u00a2": 0x9b, "\u00a3": 0x9c, "\u00a5": 0x9d, "\u20a7": 0x9e, "\u0192": 0x9f,
  "\u00e1": 0xa0, "\u00ed": 0xa1, "\u00f3": 0xa2, "\u00fa": 0xa3, "\u00f1": 0xa4, "\u00d1": 0xa5, "\u00aa": 0xa6, "\u00ba": 0xa7,
  "\u00bf": 0xa8, "\u2310": 0xa9, "\u00ac": 0xaa, "\u00bd": 0xab, "\u00bc": 0xac, "\u00a1": 0xad, "\u00ab": 0xae, "\u00bb": 0xaf,
};

function encodeCp437(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const codePoint = char?.charCodeAt(0) ?? 0;
    bytes[index] = codePoint < 0x80 ? codePoint : (CP437_HIGH_ALIASES[char ?? ""] ?? 0x3f);
  }

  return bytes;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function toDosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

export function createStoredZip(entries: ZipFixtureEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = entry.rawName ?? (entry.utf8 === false ? encodeCp437(entry.path) : encodeUtf8(entry.path));
    const nameFlags = entry.utf8 === false ? 0 : UTF8_FILENAME_FLAG;
    const data = typeof entry.data === "string" ? encodeUtf8(entry.data) : entry.data;
    const { date, time } = toDosDateTime(entry.modifiedAt ?? new Date("2026-01-01T00:00:00"));
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);

    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, nameFlags);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, 0);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, name.length);
    writeUint16(localView, 28, 0);
    localHeader.set(name, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, nameFlags);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, 0);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, name.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const central = concat(centralParts);
  const local = concat(localParts);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeUint32(eocdView, 0, 0x06054b50);
  writeUint16(eocdView, 4, 0);
  writeUint16(eocdView, 6, 0);
  writeUint16(eocdView, 8, entries.length);
  writeUint16(eocdView, 10, entries.length);
  writeUint32(eocdView, 12, central.length);
  writeUint32(eocdView, 16, local.length);
  writeUint16(eocdView, 20, 0);

  return concat([local, central, eocd]);
}

export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
export const PNG_BYTES = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);
