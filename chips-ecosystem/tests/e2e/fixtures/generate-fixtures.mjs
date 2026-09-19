/**
 * E2E 测试夹具生成器。
 *
 * 依据《薯片生态文档库/04-文件格式规范/01-卡片文件格式.md》《02-箱子文件格式.md》生成
 * 最小富文本卡片与最小箱子的目录态 / 归档态夹具；归档一律使用 ZIP Store。
 *
 * 用法：
 *   node fixtures/generate-fixtures.mjs           # 写入 fixtures/cards 与 fixtures/boxes
 *   node fixtures/generate-fixtures.mjs --check   # 校验磁盘夹具与生成结果逐字节一致（不写盘）
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isMap, isScalar, isSeq } from 'yaml';

const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = path.join(FIXTURES_DIR, 'cards');
const BOXES_DIR = path.join(FIXTURES_DIR, 'boxes');
const CHECK_ONLY = process.argv.includes('--check');

const CHIP_STANDARDS_VERSION = '1.0.0';
const CREATED_AT = '2026-09-19T00:00:00.000Z';
const MODIFIED_AT = '2026-09-19T00:00:00.000Z';

const CARD = {
  fileBaseName: 'e2e-minimal',
  cardId: 'E2eCardRt1',
  name: 'E2E 最小富文本卡片',
  nodeId: 'E2eNodeRt1',
  cardType: 'base.richtext',
  inlineText:
    '# E2E 最小富文本卡片\n\n' +
    '这是金链路 E2E 使用的最小富文本卡片。\n\n' +
    '- 打开：document:open\n' +
    '- 渲染：基础卡片插件 renderView\n' +
    '- 编辑：document:write\n' +
    '- 保存：document:save\n',
};

const BOX = {
  fileBaseName: 'e2e-minimal',
  boxId: 'E2eBoxGrd1',
  name: 'E2E 最小箱子',
  entryId: 'E2eEntry01',
  layoutType: 'chips.layout.list',
  embeddedCardPath: 'entries/e2e-minimal.card',
};

const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 19;
const ZIP_STORE_METHOD = 0;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_VERSION_NEEDED = 20;
const ZIP_VERSION_MADE_BY = 0x031e;

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

/** 计算标准 CRC-32（与 ZIP 中央目录校验值一致）。 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 以 ZIP Store（不压缩）方式打包条目；条目顺序即传入顺序，时间戳固定以保证可复现。 */
function writeZipStore(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(ZIP_VERSION_MADE_BY, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localChunks.push(localHeader, nameBytes, data);
    centralChunks.push(centralHeader, Buffer.from(nameBytes));
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralSize, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, ...centralChunks, endOfCentralDirectory]);
}

function quoteStringScalars(node) {
  if (isScalar(node)) {
    if (typeof node.value === 'string' && !node.value.includes('\n')) {
      node.type = 'QUOTE_DOUBLE';
    }
    return;
  }
  if (isMap(node)) {
    for (const pair of node.items) {
      quoteStringScalars(pair.value);
    }
    return;
  }
  if (isSeq(node)) {
    for (const item of node.items) {
      quoteStringScalars(item);
    }
  }
}

function toYaml(value) {
  const document = new Document(value);
  if (document.contents !== null) {
    quoteStringScalars(document.contents);
  }
  return document.toString({ lineWidth: 0, blockQuote: 'literal' });
}

function cardMetadataYaml() {
  return toYaml({
    chip_standards_version: CHIP_STANDARDS_VERSION,
    card_id: CARD.cardId,
    name: CARD.name,
    created_at: CREATED_AT,
    modified_at: MODIFIED_AT,
    theme: '',
    cover_ratio: '3:4',
    tags: ['E2E', ['用途', '自动化测试']],
    visibility: 'private',
    downloadable: true,
    remixable: true,
    commentable: false,
  });
}

function cardStructureYaml() {
  return toYaml({
    structure: [{ id: CARD.nodeId, type: CARD.cardType }],
    manifest: {
      card_count: 1,
      resource_count: 0,
      resources: [],
    },
  });
}

function cardContentYaml() {
  return toYaml({
    card_type: CARD.cardType,
    content_format: 'markdown',
    content_source: 'inline',
    content_text: CARD.inlineText,
    locale: 'zh-CN',
    theme: '',
    markdown_capabilities: {
      commonmark: true,
      gfm: true,
      math: true,
      highlight: true,
      underline: true,
      superscript: true,
      subscript: true,
    },
  });
}

function coverHtml(title, bodyLines) {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${title}</title>`,
    '  <style>',
    '    html, body { margin: 0; width: 100%; height: 100%; }',
    '    body {',
    '      display: grid;',
    '      place-items: center;',
    '      background: linear-gradient(135deg, #f5f7fb 0%, #eef3ff 100%);',
    '      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '      color: #111827;',
    '      text-align: center;',
    '      padding: 24px;',
    '      box-sizing: border-box;',
    '      overflow: hidden;',
    '    }',
    '    .cover-name { font-size: 24px; font-weight: 600; line-height: 1.4; word-wrap: break-word; }',
    '    .cover-note { margin-top: 8px; font-size: 14px; color: #6b7280; }',
    '  </style>',
    '</head>',
    '<body>',
    ...bodyLines,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function cardCoverHtml() {
  return coverHtml('Card Cover', [
    '  <div>',
    `    <div class="cover-name">${CARD.name}</div>`,
    '    <div class="cover-note">E2E 夹具</div>',
    '  </div>',
  ]);
}

function boxCoverHtml() {
  return coverHtml('Box Cover', [
    '  <div>',
    `    <div class="cover-name">${BOX.name}</div>`,
    '    <div class="cover-note">E2E 夹具</div>',
    '  </div>',
  ]);
}

function boxMetadataYaml() {
  return toYaml({
    chip_standards_version: CHIP_STANDARDS_VERSION,
    box_id: BOX.boxId,
    name: BOX.name,
    created_at: CREATED_AT,
    modified_at: MODIFIED_AT,
    active_layout_type: BOX.layoutType,
    cover_ratio: '3:4',
    description: '金链路 E2E 使用的最小箱子，内嵌一张最小富文本卡片。',
    tags: ['E2E', ['用途', '自动化测试']],
  });
}

function boxStructureYaml() {
  return toYaml({
    entries: [
      {
        entry_id: BOX.entryId,
        url: BOX.embeddedCardPath,
        enabled: true,
        snapshot: {
          document_id: CARD.cardId,
          title: CARD.name,
          summary: '内嵌卡片，随箱子整体分发。',
          tags: ['E2E'],
          cover: { mode: 'runtime' },
          last_known_modified_at: MODIFIED_AT,
          content_type: 'chips/card',
        },
        layout_hints: {
          sort_key: '2026-09-19',
          aspect_ratio: 0.75,
        },
      },
    ],
  });
}

function boxContentYaml() {
  return toYaml({
    active_layout_type: BOX.layoutType,
    layout_configs: {
      [BOX.layoutType]: {
        schema_version: '1.0.0',
      },
    },
  });
}

function cardFileEntries() {
  return [
    { path: '.card/cover.html', data: cardCoverHtml() },
    { path: '.card/metadata.yaml', data: cardMetadataYaml() },
    { path: '.card/structure.yaml', data: cardStructureYaml() },
    { path: `content/${CARD.nodeId}.yaml`, data: cardContentYaml() },
  ];
}

function buildFixturePlan() {
  const cardEntries = cardFileEntries();
  const cardArchive = writeZipStore(cardEntries);
  const boxEntries = [
    { path: '.box/cover.html', data: boxCoverHtml() },
    { path: '.box/content.yaml', data: boxContentYaml() },
    { path: '.box/metadata.yaml', data: boxMetadataYaml() },
    { path: '.box/structure.yaml', data: boxStructureYaml() },
    { path: BOX.embeddedCardPath, data: cardArchive },
  ];

  const files = new Map();
  for (const entry of cardEntries) {
    files.set(
      path.join('cards', `${CARD.fileBaseName}.card`, entry.path),
      Buffer.from(entry.data, 'utf8')
    );
  }
  files.set(path.join('cards', 'archive', `${CARD.fileBaseName}.card`), cardArchive);
  files.set(path.join('boxes', `${BOX.fileBaseName}.box`), writeZipStore(boxEntries));

  const manifest = {
    version: 1,
    generatedBy: 'fixtures/generate-fixtures.mjs',
    card: {
      id: CARD.cardId,
      name: CARD.name,
      nodeId: CARD.nodeId,
      cardType: CARD.cardType,
      inlineText: CARD.inlineText,
      directoryPath: `cards/${CARD.fileBaseName}.card`,
      archivePath: `cards/archive/${CARD.fileBaseName}.card`,
    },
    box: {
      id: BOX.boxId,
      name: BOX.name,
      entryId: BOX.entryId,
      layoutType: BOX.layoutType,
      embeddedCardPath: BOX.embeddedCardPath,
      archivePath: `boxes/${BOX.fileBaseName}.box`,
    },
  };
  files.set('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  return files;
}

async function collectRelativeFiles(rootDir, prefix = '') {
  const results = [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await collectRelativeFiles(path.join(rootDir, entry.name), relativePath)));
      continue;
    }
    results.push(relativePath);
  }
  return results;
}

async function verifyAgainstDisk(expectedFiles) {
  const onDisk = new Set();
  for (const relativePath of await collectRelativeFiles(CARDS_DIR)) {
    onDisk.add(`cards/${relativePath}`);
  }
  for (const relativePath of await collectRelativeFiles(BOXES_DIR)) {
    onDisk.add(`boxes/${relativePath}`);
  }

  const discrepancies = [];
  for (const [relativePath, expected] of expectedFiles) {
    const diskPath = path.join(FIXTURES_DIR, relativePath);
    let actual = null;
    try {
      actual = await readFile(diskPath);
    } catch {
      discrepancies.push(`缺失：${relativePath}`);
      continue;
    }
    if (!actual.equals(expected)) {
      discrepancies.push(`内容不一致：${relativePath}`);
    }
    onDisk.delete(relativePath);
  }
  for (const stale of onDisk) {
    discrepancies.push(`多余文件：${stale}`);
  }
  return discrepancies;
}

async function writePlan(expectedFiles) {
  await rm(CARDS_DIR, { recursive: true, force: true });
  await rm(BOXES_DIR, { recursive: true, force: true });
  for (const [relativePath, data] of expectedFiles) {
    const target = path.join(FIXTURES_DIR, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
}

async function main() {
  const expectedFiles = buildFixturePlan();
  if (CHECK_ONLY) {
    const discrepancies = await verifyAgainstDisk(expectedFiles);
    if (discrepancies.length > 0) {
      throw new Error(
        `夹具与生成结果不一致：\n${discrepancies.join('\n')}\n请运行 pnpm test:e2e:fixtures 重新生成。`
      );
    }
    console.info(`夹具校验通过：${expectedFiles.size} 个文件与生成结果逐字节一致。`);
    return;
  }
  await writePlan(expectedFiles);
  console.info(
    `夹具生成完成：${expectedFiles.size} 个文件写入 ${path.relative(process.cwd(), FIXTURES_DIR)}。`
  );
}

await main();
