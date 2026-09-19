import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { resolveFixturesRoot, type FixtureManifest } from '../src';

/**
 * 产品级夹具校验：对 `fixtures/` 的提交产物逐项对照
 * 《04-文件格式规范/01-卡片文件格式》《02-箱子文件格式》与《05-ID生成规范》。
 *
 * `--check` 保证夹具逐字节可复现；本文件保证夹具语义是产品级数据，而非示意 JSON。
 */

const fixturesRoot = resolveFixturesRoot();
const manifest = JSON.parse(
  readFileSync(path.join(fixturesRoot, 'manifest.json'), 'utf8')
) as FixtureManifest;

const ID_PATTERN = /^[0-9A-Za-z]{10}$/;
const COVER_RATIOS = ['1:1', '1:1.414', '2:3', '3:4', '1:1.618', '16:9', '2:1', '9:19.5', '1.58:1'];

interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

/** 读取 ZIP Store 归档条目（夹具生成器只使用 Store 方法，故按本地头顺序解析）。 */
function readZipStore(source: string | Buffer): ZipEntry[] {
  const bytes = typeof source === 'string' ? readFileSync(source) : source;
  const label = typeof source === 'string' ? source : '<内嵌归档>';
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    expect(method, `${label} 必须使用 ZIP Store`).toBe(0);
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const dataStart = offset + 30 + nameLength + extraLength;
    entries.push({ name, data: bytes.subarray(dataStart, dataStart + size) });
    offset = dataStart + size;
  }
  expect(offset + 22, `${label} 缺少中央目录`).toBeLessThanOrEqual(bytes.length);
  expect(bytes.readUInt32LE(offset), `${label} 中央目录签名`).toBe(0x02014b50);
  return entries;
}

function listFiles(root: string, prefix = ''): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...listFiles(path.join(root, entry.name), relative));
    } else {
      results.push(relative);
    }
  }
  return results;
}

function expectDocumentInfo(record: Record<string, unknown>): void {
  expect(record.chip_standards_version, 'chip_standards_version').toMatch(/^\d+\.\d+\.\d+$/);
  expect(typeof record.name, 'name').toBe('string');
  expect(new Date(String(record.created_at)).toString(), 'created_at').not.toBe('Invalid Date');
  expect(new Date(String(record.modified_at)).toString(), 'modified_at').not.toBe('Invalid Date');
}

describe('产品级夹具', () => {
  it('清单标识符合 10 位 Base62 规范且路径真实存在', () => {
    expect(manifest.card.id).toMatch(ID_PATTERN);
    expect(manifest.card.nodeId).toMatch(ID_PATTERN);
    expect(manifest.box.id).toMatch(ID_PATTERN);
    expect(manifest.box.entryId).toMatch(ID_PATTERN);

    expect(manifest.card.directoryPath).toBe('cards/e2e-minimal.card');
    expect(manifest.card.archivePath).toBe('cards/archive/e2e-minimal.card');
    expect(manifest.box.archivePath).toBe('boxes/e2e-minimal.box');
    for (const relativePath of [
      manifest.card.directoryPath,
      manifest.card.archivePath,
      manifest.box.archivePath,
    ]) {
      expect(existsSync(path.join(fixturesRoot, relativePath)), relativePath).toBe(true);
    }
  });

  it('目录态卡片符合卡片文件格式', () => {
    const cardRoot = path.join(fixturesRoot, manifest.card.directoryPath);
    const metadata = parse(
      readFileSync(path.join(cardRoot, '.card', 'metadata.yaml'), 'utf8')
    ) as Record<string, unknown>;
    expectDocumentInfo(metadata);
    expect(metadata.card_id).toMatch(ID_PATTERN);
    expect(metadata.card_id).toBe(manifest.card.id);
    expect(metadata.cover_ratio).toBe('3:4');
    expect(COVER_RATIOS).toContain(String(metadata.cover_ratio));
    expect(Array.isArray(metadata.tags)).toBe(true);

    const structure = parse(
      readFileSync(path.join(cardRoot, '.card', 'structure.yaml'), 'utf8')
    ) as {
      structure: { id: string; type: string }[];
      manifest: { card_count: number; resource_count: number; resources: unknown[] };
    };
    expect(structure.structure).toHaveLength(1);
    expect(structure.manifest.card_count).toBe(structure.structure.length);
    expect(structure.manifest.resource_count).toBe(structure.manifest.resources.length);
    const node = structure.structure[0];
    expect(node?.id).toMatch(ID_PATTERN);
    expect(node?.id).toBe(manifest.card.nodeId);
    expect(node?.type).toBe('base.richtext');

    const content = parse(
      readFileSync(path.join(cardRoot, 'content', `${manifest.card.nodeId}.yaml`), 'utf8')
    ) as Record<string, unknown>;
    expect(content.card_type).toBe(node?.type);
    expect(content.content_format).toBe('markdown');
    expect(content.content_source).toBe('inline');
    expect(String(content.content_text)).toContain(manifest.card.name);
    expect(content.markdown_capabilities).toBeTypeOf('object');

    const cover = readFileSync(path.join(cardRoot, '.card', 'cover.html'), 'utf8');
    expect(cover.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(cover).toContain('charset="UTF-8"');
    expect(cover).not.toMatch(/https?:\/\//);
  });

  it('归档态卡片与目录态逐字节一致', () => {
    const cardRoot = path.join(fixturesRoot, manifest.card.directoryPath);
    const archivePath = path.join(fixturesRoot, manifest.card.archivePath);
    const archived = new Map(readZipStore(archivePath).map((entry) => [entry.name, entry.data]));

    const directoryFiles = listFiles(cardRoot);
    expect([...archived.keys()].sort()).toEqual([...directoryFiles].sort());
    for (const relative of directoryFiles) {
      expect(
        archived.get(relative)?.equals(readFileSync(path.join(cardRoot, relative))),
        relative
      ).toBe(true);
    }
  });

  it('箱子符合箱子文件格式且内嵌卡片完整', () => {
    const boxPath = path.join(fixturesRoot, manifest.box.archivePath);
    const entries = readZipStore(boxPath);
    const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
    expect([...byName.keys()].sort()).toEqual(
      [
        '.box/content.yaml',
        '.box/cover.html',
        '.box/metadata.yaml',
        '.box/structure.yaml',
        manifest.box.embeddedCardPath,
      ].sort()
    );

    const metadata = parse(byName.get('.box/metadata.yaml')?.toString('utf8') ?? '') as Record<
      string,
      unknown
    >;
    expectDocumentInfo(metadata);
    expect(metadata.box_id).toMatch(ID_PATTERN);
    expect(metadata.box_id).toBe(manifest.box.id);
    expect(metadata.active_layout_type).toBe(manifest.box.layoutType);

    const content = parse(byName.get('.box/content.yaml')?.toString('utf8') ?? '') as Record<
      string,
      unknown
    >;
    expect(content.active_layout_type).toBe(metadata.active_layout_type);
    expect(content.layout_configs).toBeTypeOf('object');

    const structure = parse(byName.get('.box/structure.yaml')?.toString('utf8') ?? '') as {
      entries: {
        entry_id: string;
        url: string;
        enabled: boolean;
        snapshot?: { document_id?: string; content_type?: string };
      }[];
    };
    expect(structure.entries).toHaveLength(1);
    const entry = structure.entries[0];
    expect(entry?.entry_id).toMatch(ID_PATTERN);
    expect(entry?.entry_id).toBe(manifest.box.entryId);
    expect(entry?.url).toBe(manifest.box.embeddedCardPath);
    expect(entry?.url.endsWith('.card')).toBe(true);
    expect(entry?.enabled).toBe(true);
    expect(entry?.snapshot?.document_id).toBe(manifest.card.id);
    expect(entry?.snapshot?.content_type).toBe('chips/card');

    const embedded = byName.get(manifest.box.embeddedCardPath);
    expect(embedded, '箱子内嵌卡片').toBeDefined();
    if (embedded === undefined) {
      return;
    }
    expect(embedded.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');

    const cardRoot = path.join(fixturesRoot, manifest.card.directoryPath);
    const innerEntries = new Map(readZipStore(embedded).map((inner) => [inner.name, inner.data]));
    const directoryFiles = listFiles(cardRoot);
    expect([...innerEntries.keys()].sort()).toEqual([...directoryFiles].sort());
    for (const relative of directoryFiles) {
      expect(
        innerEntries.get(relative)?.equals(readFileSync(path.join(cardRoot, relative))),
        relative
      ).toBe(true);
    }
  });
});
