import { describe, expect, it } from 'vitest';
import { parseEmbeddedAudioMetadata } from '../src/shared/audio-metadata';

/**
 * 元数据解析测试：全部夹具为测试内构造的**真实字节**（最小合法帧），
 * 断言走解析器真实解码路径，不 mock 解析器、不依赖仓外素材。
 */

const UTF8 = new TextEncoder();

function writeUInt32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function writeUInt24BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 16) & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = value & 0xff;
}

/** ID3v2.4 与标签体总长的 syncsafe 编码（每字节 7 位）。 */
function writeSyncSafe32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 21) & 0x7f;
  target[offset + 1] = (value >>> 14) & 0x7f;
  target[offset + 2] = (value >>> 7) & 0x7f;
  target[offset + 3] = value & 0x7f;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }

  return merged;
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
}

// ---------- MP4/M4A 夹具 ----------

function encodeAtom(type: string, ...payloadParts: Uint8Array[]): Uint8Array {
  const payload = concatBytes(...payloadParts);
  const bytes = new Uint8Array(8 + payload.length);
  writeUInt32BE(bytes, 0, bytes.length);
  bytes.set(asciiBytes(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function encodeDataAtom(dataType: number, value: Uint8Array): Uint8Array {
  const header = new Uint8Array(8);
  writeUInt32BE(header, 0, dataType);
  return encodeAtom('data', header, value);
}

function encodeTextItem(type: string, value: string): Uint8Array {
  return encodeAtom(type, encodeDataAtom(1, UTF8.encode(value)));
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function createTaggedM4aBytes(): Uint8Array {
  const ilst = encodeAtom(
    'ilst',
    encodeTextItem('\u00a9nam', 'Glass Harbor'),
    encodeTextItem('\u00a9ART', 'Iris'),
    encodeTextItem('\u00a9alb', 'Harbor Lights'),
    encodeTextItem('\u00a9lyr', 'Blue water in the dark'),
    encodeAtom('covr', encodeDataAtom(14, PNG_BYTES)),
  );
  const meta = encodeAtom('meta', new Uint8Array([0, 0, 0, 0]), ilst);
  const udta = encodeAtom('udta', meta);
  const moov = encodeAtom('moov', udta);
  const ftyp = encodeAtom('ftyp', asciiBytes('M4A \u0000\u0000\u0000\u0000M4A '));

  return concatBytes(ftyp, moov);
}

// ---------- ID3v2 夹具 ----------

interface IId3FrameOptions {
  /** 帧号版本：3 = v2.3（大端 32 位帧长），4 = v2.4（syncsafe 帧长）。 */
  version: 3 | 4;
}

function encodeId3Frame(frameId: string, payload: Uint8Array, options: IId3FrameOptions): Uint8Array {
  const header = new Uint8Array(10);
  header.set(asciiBytes(frameId), 0);
  if (options.version === 4) {
    writeSyncSafe32(header, 4, payload.length);
  } else {
    writeUInt32BE(header, 4, payload.length);
  }
  return concatBytes(header, payload);
}

/** 文本帧载荷：编码字节 + 文本。 */
function encodeTextFrame(encoding: number, text: Uint8Array): Uint8Array {
  return concatBytes(new Uint8Array([encoding]), text);
}

function createTaggedMp3Bytes(version: 3 | 4, ...frames: Uint8Array[]): Uint8Array {
  const bodyLength = frames.reduce((sum, frame) => sum + frame.length, 0);
  const header = new Uint8Array(10);
  header.set(asciiBytes('ID3'), 0);
  header[3] = version;
  header[4] = 0;
  header[5] = 0;
  writeSyncSafe32(header, 6, bodyLength);

  return concatBytes(header, ...frames);
}

/** USLT 载荷：编码 + 语言 + 终止符描述 + 歌词。 */
function encodeUsltPayload(lyrics: string): Uint8Array {
  return concatBytes(new Uint8Array([0x03]), asciiBytes('chi'), new Uint8Array([0x00]), UTF8.encode(lyrics));
}

/** SYLT 载荷：编码 + 语言 + 时间戳格式(1=毫秒) + 内容类型 + 终止描述 + (文本终止 + 32 位毫秒) 序列。 */
function encodeSyltPayload(entries: ReadonlyArray<readonly [string, number]>): Uint8Array {
  const parts: Uint8Array[] = [
    new Uint8Array([0x03]),
    asciiBytes('chi'),
    new Uint8Array([0x01]),
    new Uint8Array([0x00, 0x00]),
  ];
  for (const [text, timestampMs] of entries) {
    const encoded = UTF8.encode(text);
    const entry = new Uint8Array(encoded.length + 1 + 4);
    entry.set(encoded, 0);
    entry[encoded.length] = 0x00;
    writeUInt32BE(entry, encoded.length + 1, timestampMs);
    parts.push(entry);
  }
  return concatBytes(...parts);
}

/** APIC 载荷：编码 + MIME 终止 + 图片类型 + 描述终止 + 图片字节。 */
function encodeApicPayload(input: { declaredMime: string; imageBytes: Uint8Array; description?: string }): Uint8Array {
  const mimeTerminated = new Uint8Array(input.declaredMime.length + 1);
  mimeTerminated.set(UTF8.encode(input.declaredMime), 0);
  const descriptionTerminated = new Uint8Array((input.description ?? '').length + 1);
  descriptionTerminated.set(UTF8.encode(input.description ?? ''), 0);

  return concatBytes(
    new Uint8Array([0x00]),
    mimeTerminated,
    new Uint8Array([0x03]),
    descriptionTerminated,
    input.imageBytes,
  );
}

// ---------- FLAC 夹具 ----------

function encodeFlacBlock(blockType: number, isLast: boolean, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = (isLast ? 0x80 : 0x00) | blockType;
  writeUInt24BE(header, 1, payload.length);
  return concatBytes(header, payload);
}

function encodeVorbisCommentBlock(comments: ReadonlyArray<readonly [string, string]>): Uint8Array {
  const vendor = UTF8.encode('chips-test');
  const parts: Uint8Array[] = [];
  const vendorHeader = new Uint8Array(4);
  writeUInt32LE(vendorHeader, 0, vendor.length);
  parts.push(vendorHeader, vendor);

  const countHeader = new Uint8Array(4);
  writeUInt32LE(countHeader, 0, comments.length);
  parts.push(countHeader);

  for (const [key, value] of comments) {
    const entry = UTF8.encode(`${key}=${value}`);
    const entryHeader = new Uint8Array(4);
    writeUInt32LE(entryHeader, 0, entry.length);
    parts.push(entryHeader, entry);
  }

  return concatBytes(...parts);
}

function writeUInt32LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function encodeFlacPictureBlock(input: { mime: string; description: string; imageBytes: Uint8Array }): Uint8Array {
  const mime = UTF8.encode(input.mime);
  const description = UTF8.encode(input.description);
  const head = new Uint8Array(4);
  writeUInt32BE(head, 0, 3);
  const mimeHeader = new Uint8Array(4);
  writeUInt32BE(mimeHeader, 0, mime.length);
  const descriptionHeader = new Uint8Array(4);
  writeUInt32BE(descriptionHeader, 0, description.length);
  const dimensions = new Uint8Array(16);
  const dataHeader = new Uint8Array(4);
  writeUInt32BE(dataHeader, 0, input.imageBytes.length);

  return concatBytes(head, mimeHeader, mime, descriptionHeader, description, dimensions, dataHeader, input.imageBytes);
}

function createTaggedFlacBytes(input: {
  comments: ReadonlyArray<readonly [string, string]>;
  image?: { mime: string; description: string; imageBytes: Uint8Array };
}): Uint8Array {
  const blocks: Uint8Array[] = [encodeFlacBlock(4, input.image === undefined, encodeVorbisCommentBlock(input.comments))];
  if (input.image) {
    blocks.push(encodeFlacBlock(6, true, encodeFlacPictureBlock(input.image)));
  }
  return concatBytes(asciiBytes('fLaC'), ...blocks);
}

// ---------- 用例 ----------

describe('parseEmbeddedAudioMetadata — ID3v2（MP3）', () => {
  it('解析 ID3v2.3 文本帧、非同步歌词与内嵌封面', () => {
    const bytes = createTaggedMp3Bytes(
      3,
      encodeId3Frame('TIT2', encodeTextFrame(0x03, UTF8.encode('夜曲')), { version: 3 }),
      encodeId3Frame('TPE1', encodeTextFrame(0x03, UTF8.encode('周杰伦')), { version: 3 }),
      encodeId3Frame('TALB', encodeTextFrame(0x03, UTF8.encode('十一月的萧邦')), { version: 3 }),
      encodeId3Frame('USLT', encodeUsltPayload('一群嗜血的蚂蚁'), { version: 3 }),
      encodeId3Frame(
        'APIC',
        encodeApicPayload({ declaredMime: 'image/png', imageBytes: PNG_BYTES }),
        { version: 3 },
      ),
    );

    const metadata = parseEmbeddedAudioMetadata({ bytes, fileName: 'night-song.mp3', mimeType: 'audio/mpeg' });

    expect(metadata.title).toBe('夜曲');
    expect(metadata.artist).toBe('周杰伦');
    expect(metadata.album).toBe('十一月的萧邦');
    expect(metadata.lyricsText).toBe('一群嗜血的蚂蚁');
    expect(metadata.artwork?.mimeType).toBe('image/png');
    expect(Array.from(metadata.artwork?.bytes ?? [])).toEqual(Array.from(PNG_BYTES));
  });

  it('解析 ID3v2.4 syncsafe 帧长与 UTF-16 双引号文本编码', () => {
    const utf16Text = concatBytes(new Uint8Array([0xff, 0xfe]), new Uint8Array([0x1c, 0x59, 0xf2, 0x66]));
    const bytes = createTaggedMp3Bytes(
      4,
      encodeId3Frame('TIT2', encodeTextFrame(0x01, utf16Text), { version: 4 }),
      encodeId3Frame('TPE1', encodeTextFrame(0x03, UTF8.encode('Iris')), { version: 4 }),
    );

    const metadata = parseEmbeddedAudioMetadata({ bytes, fileName: 'syncsafe.mp3' });

    expect(metadata.title).toBe('夜曲');
    expect(metadata.artist).toBe('Iris');
  });

  it('解析 SYLT 同步歌词为 LRC 行', () => {
    const bytes = createTaggedMp3Bytes(
      3,
      encodeId3Frame('SYLT', encodeSyltPayload([
        ['第一句', 1_000],
        ['第二句', 3_450],
      ]), { version: 3 }),
    );

    const metadata = parseEmbeddedAudioMetadata({ bytes, fileName: 'synced.mp3', mimeType: 'audio/mpeg' });

    expect(metadata.timedLyricsText).toBe('[00:01.00]第一句\n[00:03.45]第二句');
  });

  it('封面 MIME 以真实字节嗅探为准，与声明不符时按检测类型归一', () => {
    const tiffBytes = Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]);
    const bytes = createTaggedMp3Bytes(
      3,
      encodeId3Frame(
        'APIC',
        encodeApicPayload({ declaredMime: 'image/jpeg', imageBytes: tiffBytes }),
        { version: 3 },
      ),
    );

    const metadata = parseEmbeddedAudioMetadata({ bytes, fileName: 'mismatched-cover.mp3', mimeType: 'audio/mpeg' });

    expect(metadata.artwork?.mimeType).toBe('image/tiff');
    expect(Array.from(metadata.artwork?.bytes ?? [])).toEqual(Array.from(tiffBytes));
  });

  it('截断与垃圾字节安全返回空元数据', () => {
    expect(parseEmbeddedAudioMetadata({ bytes: asciiBytes('ID3') })).toEqual({});
    expect(parseEmbeddedAudioMetadata({ bytes: new Uint8Array([0x00, 0x01, 0x02]) })).toEqual({});
    expect(parseEmbeddedAudioMetadata({ bytes: asciiBytes('not-a-tag-at-all') })).toEqual({});
  });

  it('无魔数字节按 fileName 与 mimeType 路由到对应解析臂', () => {
    expect(
      parseEmbeddedAudioMetadata({ bytes: new Uint8Array(16), fileName: 'plain.mp3', mimeType: 'audio/mpeg' }),
    ).toEqual({});
    expect(
      parseEmbeddedAudioMetadata({ bytes: new Uint8Array(16), fileName: 'plain.flac', mimeType: 'audio/flac' }),
    ).toEqual({});
    expect(
      parseEmbeddedAudioMetadata({ bytes: new Uint8Array(16), fileName: 'plain.m4a', mimeType: 'audio/mp4' }),
    ).toEqual({});
  });
});

describe('parseEmbeddedAudioMetadata — MP4/M4A', () => {
  it('解析 moov/udta/meta/ilst 文本项、歌词与封面', () => {
    const metadata = parseEmbeddedAudioMetadata({
      bytes: createTaggedM4aBytes(),
      fileName: 'glass-harbor.m4a',
      mimeType: 'audio/mp4',
    });

    expect(metadata).toMatchObject({
      title: 'Glass Harbor',
      artist: 'Iris',
      album: 'Harbor Lights',
      lyricsText: 'Blue water in the dark',
    });
    expect(metadata.artwork?.mimeType).toBe('image/png');
    expect(Array.from(metadata.artwork?.bytes ?? []).slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('covr 数据类型 13/14 直接给出 MIME，无声明时按字节嗅探', () => {
    const ilst = encodeAtom(
      'ilst',
      encodeAtom('covr', encodeDataAtom(13, PNG_BYTES)),
    );
    const bytes = concatBytes(
      encodeAtom('ftyp', asciiBytes('M4A \u0000\u0000\u0000\u0000M4A ')),
      encodeAtom('moov', encodeAtom('udta', encodeAtom('meta', new Uint8Array(4), ilst))),
    );

    const metadata = parseEmbeddedAudioMetadata({ bytes, fileName: 'typed.m4a' });

    expect(metadata.artwork?.mimeType).toBe('image/jpeg');
    expect(Array.from(metadata.artwork?.bytes ?? [])).toEqual(Array.from(PNG_BYTES));
  });
});

describe('parseEmbeddedAudioMetadata — FLAC', () => {
  it('解析 Vorbis Comment 标题、歌手、专辑与歌词，及 PICTURE 封面', () => {
    const metadata = parseEmbeddedAudioMetadata({
      bytes: createTaggedFlacBytes({
        comments: [
          ['TITLE', 'Midnight Echo'],
          ['ARTIST', 'Caro'],
          ['ALBUM', 'Northern Lights'],
          ['LYRICS', '极光下的回声'],
        ],
        image: { mime: 'image/png', description: '封面', imageBytes: PNG_BYTES },
      }),
      fileName: 'midnight-echo.flac',
      mimeType: 'audio/flac',
    });

    expect(metadata.title).toBe('Midnight Echo');
    expect(metadata.artist).toBe('Caro');
    expect(metadata.album).toBe('Northern Lights');
    expect(metadata.lyricsText).toBe('极光下的回声');
    expect(metadata.artwork?.mimeType).toBe('image/png');
    expect(metadata.artwork?.description).toBe('封面');
    expect(Array.from(metadata.artwork?.bytes ?? [])).toEqual(Array.from(PNG_BYTES));
  });

  it('歌词键回退链：LYRICS → UNSYNCEDLYRICS → UNSYNCED LYRICS', () => {
    const metadata = parseEmbeddedAudioMetadata({
      bytes: createTaggedFlacBytes({
        comments: [['UNSYNCEDLYRICS', '回退歌词']],
      }),
      fileName: 'fallback.flac',
    });

    expect(metadata.lyricsText).toBe('回退歌词');
    expect(metadata.title).toBeUndefined();
  });

  it('无封面块时 artwork 缺席，文本元数据照常解析', () => {
    const metadata = parseEmbeddedAudioMetadata({
      bytes: createTaggedFlacBytes({
        comments: [['TITLE', 'Only Text']],
      }),
      fileName: 'only-text.flac',
    });

    expect(metadata.title).toBe('Only Text');
    expect(metadata.artwork).toBeUndefined();
  });
});
