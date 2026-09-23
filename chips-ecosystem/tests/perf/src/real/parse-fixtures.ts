import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 解析域真测夹具生成器（工单056 · 形 A）。
 *
 * 夹具为**真实 `.card` / `.box` 归档字节**（ZIP Store 形态），字段模型逐字取自
 * 《04-文件格式规范》：卡片 `structure.yaml` schema（§5.1：`id` 10 位 Base62、
 * `manifest.card_count/resource_count` 必填）与箱子校验规则（§13：四文件必备、
 * `entry_id` 10 位 Base62 唯一、内嵌引用必须存在、外部引用为绝对 URL）。
 * 箱子 10 000 条目一律采用**外部绝对 URL 引用**（§13.2 合法形态），解析期不存在
 * 包内目标缺失诊断；卡片携带 9 MiB 在册资源清单（§8.4 资源字节永不进入解析计时）。
 *
 * 纪律：
 * - >1 MB 的二进制夹具**一律运行时生成、禁入库**（派单书红线）；
 * - 生成完全确定性（固定时间戳、固定字节填充、固定条目顺序），同参数两次生成
 *   逐字节一致（`tests/parser-real.test.ts` 锁测）；
 * - ZIP Store 写侧格式与 `tests/e2e/fixtures/generate-fixtures.mjs` 同一族规
 *  （方法 0、UTF-8 标志、固定 DOS 时间戳），读取侧由 `chips-parser` 内核验收。
 */

/** 卡片夹具条目与规模口径（《文档解析器设计》§9.2：10 MB = 1 MB YAML + 9 MB 资源）。 */
export const PERF_CARD_YAML_TARGET_BYTES = 1 * 1024 * 1024;
export const PERF_CARD_RESOURCE_BYTES = 9 * 1024 * 1024;
/** 箱子夹具条目数（`parse_entries_10k_ms` 基准口径）。 */
export const PERF_BOX_ENTRY_COUNT = 10_000;

/** 夹具内稳定身份（10 位 Base62/字母数字；与生成算法无关，钉死以免漂移）。 */
export const PERF_CARD_ID = 'PerfCardId';
export const PERF_CARD_NODE_ID = 'PerfCardN0';
export const PERF_BOX_ID = 'PerfBox10k';
export const PERF_FIXTURE_STANDARDS_VERSION = '1.0.0';
const FIXED_TIMESTAMP_ISO = '2026-09-19T00:00:00.000Z';

const ZIP_VERSION_NEEDED = 20;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const ZIP_VERSION_MADE_BY = 0x031e;
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 19;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

/** 标准 CRC-32（ZIP 中央目录校验值）。 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    const lookup = CRC32_TABLE[index];
    if (lookup === undefined) {
      throw new Error(`CRC-32 查表索引越界：${String(index)}`);
    }
    crc = lookup ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP Store 归档条目。 */
export interface ZipStoreEntry {
  readonly path: string;
  readonly data: Uint8Array | string;
}

/** 以 ZIP Store（不压缩）打包条目；条目顺序即传入顺序，时间戳固定保证逐字节可复现。 */
export function writeZipStore(entries: readonly ZipStoreEntry[]): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.path);
    const data = typeof entry.data === 'string' ? new TextEncoder().encode(entry.data) : entry.data;
    const checksum = crc32(data);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, ZIP_VERSION_NEEDED, true);
    localHeader.setUint16(6, ZIP_UTF8_FLAG, true);
    localHeader.setUint16(8, ZIP_STORE_METHOD, true);
    localHeader.setUint16(10, DOS_TIME, true);
    localHeader.setUint16(12, DOS_DATE, true);
    localHeader.setUint32(14, checksum, true);
    localHeader.setUint32(18, data.length, true);
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, ZIP_VERSION_MADE_BY, true);
    centralHeader.setUint16(6, ZIP_VERSION_NEEDED, true);
    centralHeader.setUint16(8, ZIP_UTF8_FLAG, true);
    centralHeader.setUint16(10, ZIP_STORE_METHOD, true);
    centralHeader.setUint16(12, DOS_TIME, true);
    centralHeader.setUint16(14, DOS_DATE, true);
    centralHeader.setUint32(16, checksum, true);
    centralHeader.setUint32(20, data.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, (0o100644 << 16) >>> 0, true);
    centralHeader.setUint32(42, offset, true);

    localChunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);
    centralChunks.push(new Uint8Array(centralHeader.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endOfCentralDirectory = new DataView(new ArrayBuffer(22));
  endOfCentralDirectory.setUint32(0, 0x06054b50, true);
  endOfCentralDirectory.setUint16(4, 0, true);
  endOfCentralDirectory.setUint16(6, 0, true);
  endOfCentralDirectory.setUint16(8, entries.length, true);
  endOfCentralDirectory.setUint16(10, entries.length, true);
  endOfCentralDirectory.setUint32(12, centralSize, true);
  endOfCentralDirectory.setUint32(16, offset, true);
  endOfCentralDirectory.setUint16(20, 0, true);

  const total = localChunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralSize + 22;
  const archive = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of [...localChunks, ...centralChunks]) {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  }
  archive.set(new Uint8Array(endOfCentralDirectory.buffer), cursor);
  return archive;
}

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 把非负整数确定性地编码为 10 位 Base62 标识（左侧补 `0`；§13.2 `entry_id` 形状）。 */
export function base62Id(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Base62 标识序号必须是非负整数：${String(index)}`);
  }
  let value = index;
  let text = '';
  do {
    text = BASE62_ALPHABET[value % 62] + text;
    value = Math.floor(value / 62);
  } while (value > 0);
  if (text.length > 10) {
    throw new Error(`Base62 标识序号超出 10 位容量：${String(index)}`);
  }
  return text.padStart(10, '0');
}

/** 确定性资源字节填充（与合成夹具族同式：`(index * 31 + 7) % 251`）。 */
function deterministicResourceBytes(bytes: number): Uint8Array {
  const payload = new Uint8Array(bytes);
  for (let index = 0; index < bytes; index += 1) {
    payload[index] = (index * 31 + 7) % 251;
  }
  return payload;
}

/** 生成 ≥ targetBytes 的确定性 Markdown 文本（每行自带序号，无随机源）。 */
function deterministicMarkdown(targetBytes: number): string {
  const lines: string[] = ['# 性能真测 10 MB 卡片\n\n'];
  let bytes = new TextEncoder().encode(lines.join('')).byteLength;
  let index = 0;
  while (bytes < targetBytes) {
    const line = `## 段落 ${String(index).padStart(6, '0')}\n\n- 行 ${String(index).padStart(6, '0')}：确定性填充文本，用于把 content YAML 推过 1 MiB 基准口径。\n`;
    lines.push(line);
    bytes += new TextEncoder().encode(line).byteLength;
    index += 1;
  }
  return lines.join('');
}

function cardCoverHtml(): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>Perf Card 10MB</title>',
    '</head>',
    '<body>',
    '  <div>薯片性能真测 10 MB 卡片夹具</div>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function cardMetadataYaml(): string {
  return [
    `chip_standards_version: "${PERF_FIXTURE_STANDARDS_VERSION}"`,
    `card_id: "${PERF_CARD_ID}"`,
    'name: "性能真测 10 MB 卡片"',
    `created_at: "${FIXED_TIMESTAMP_ISO}"`,
    `modified_at: "${FIXED_TIMESTAMP_ISO}"`,
    'theme: ""',
    'cover_ratio: "3:4"',
    'tags: ["perf", ["用途", "性能真测"]]',
    'visibility: "private"',
    'downloadable: true',
    'remixable: true',
    'commentable: false',
    '',
  ].join('\n');
}

function cardStructureYaml(): string {
  return [
    'structure:',
    `  - id: "${PERF_CARD_NODE_ID}"`,
    '    type: "base.richtext"',
    'manifest:',
    '  card_count: 1',
    '  resource_count: 1',
    '  resources:',
    '    - path: "perf/blob-0.bin"',
    `      size: ${String(PERF_CARD_RESOURCE_BYTES)}`,
    '      type: "application/octet-stream"',
    '',
  ].join('\n');
}

function cardContentYaml(): string {
  const markdown = deterministicMarkdown(PERF_CARD_YAML_TARGET_BYTES);
  const indented = markdown
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');
  return [
    'card_type: "base.richtext"',
    'content_format: "markdown"',
    'content_source: "inline"',
    'content_text: |-',
    indented,
    'locale: "zh-CN"',
    'theme: ""',
    '',
  ].join('\n');
}

/** 生成 10 MB 真测卡片归档（1 MiB+ content YAML + 9 MiB 在册资源字节，ZIP Store）。 */
export function buildPerfCard10mbArchive(): Uint8Array {
  return writeZipStore([
    { path: '.card/cover.html', data: cardCoverHtml() },
    { path: '.card/metadata.yaml', data: cardMetadataYaml() },
    { path: '.card/structure.yaml', data: cardStructureYaml() },
    { path: `content/${PERF_CARD_NODE_ID}.yaml`, data: cardContentYaml() },
    { path: 'perf/blob-0.bin', data: deterministicResourceBytes(PERF_CARD_RESOURCE_BYTES) },
  ]);
}

function boxStructureYaml(entryCount: number): string {
  const lines: string[] = ['entries:'];
  for (let index = 0; index < entryCount; index += 1) {
    const entryId = base62Id(index);
    lines.push(`  - entry_id: "${entryId}"`);
    lines.push(`    url: "file:///chips-perf-fixture/entries/${entryId}.card"`);
    lines.push('    enabled: true');
  }
  return `${lines.join('\n')}\n`;
}

/** 生成 10 000 条目真测箱子归档（外部绝对 URL 引用形态，`entryCount` 可缩小供测试）。 */
export function buildPerfBox10kArchive(entryCount: number = PERF_BOX_ENTRY_COUNT): Uint8Array {
  if (!Number.isInteger(entryCount) || entryCount < 1) {
    throw new Error(`箱子条目数必须是 ≥1 的整数：${String(entryCount)}`);
  }
  return writeZipStore([
    { path: '.box/cover.html', data: cardCoverHtml() },
    {
      path: '.box/content.yaml',
      data: [
        'active_layout_type: "chips.layout.list"',
        'layout_configs:',
        '  "chips.layout.list":',
        '    schema_version: "1.0.0"',
        '',
      ].join('\n'),
    },
    {
      path: '.box/metadata.yaml',
      data: [
        `chip_standards_version: "${PERF_FIXTURE_STANDARDS_VERSION}"`,
        `box_id: "${PERF_BOX_ID}"`,
        'name: "性能真测 10000 条目箱子"',
        `created_at: "${FIXED_TIMESTAMP_ISO}"`,
        `modified_at: "${FIXED_TIMESTAMP_ISO}"`,
        'active_layout_type: "chips.layout.list"',
        'cover_ratio: "3:4"',
        'description: "薯片性能真测解析域箱子夹具（10 000 外部引用条目）"',
        'tags: ["perf"]',
        '',
      ].join('\n'),
    },
    { path: '.box/structure.yaml', data: boxStructureYaml(entryCount) },
  ]);
}

/** 落盘后的夹具路径清单。 */
export interface PerfParseFixturePaths {
  readonly cardPath: string;
  readonly boxPath: string;
  readonly cardBytes: number;
  readonly boxBytes: number;
}

/** 把两份夹具确定性写入 `dir`（幂等：同内容重复写字节一致），返回绝对路径与规模。 */
export async function writePerfParseFixtures(dir: string): Promise<PerfParseFixturePaths> {
  const cardArchive = buildPerfCard10mbArchive();
  const boxArchive = buildPerfBox10kArchive();
  await mkdir(dir, { recursive: true });
  const cardPath = join(dir, 'perf-card-10mb.card');
  const boxPath = join(dir, 'perf-box-10k.box');
  await writeFile(cardPath, cardArchive);
  await writeFile(boxPath, boxArchive);
  return { cardPath, boxPath, cardBytes: cardArchive.byteLength, boxBytes: boxArchive.byteLength };
}
