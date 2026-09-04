import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  compressionMethod: number;
}

const workspaceRoot = path.resolve(__dirname, '../../..');
const testingSpaceRoot = path.join(workspaceRoot, 'ProductFinishedProductTestingSpace');

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('ZIP end of central directory was not found.');
}

function parseZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16(buffer, endOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    expect(readUInt32(buffer, offset)).toBe(0x02014b50);
    const compressionMethod = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    entries.push({
      name: fileName,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      compressionMethod,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readStoredEntryText(buffer: Buffer, entry: ZipEntry): string {
  expect(entry.compressionMethod).toBe(0);
  const offset = entry.localHeaderOffset;
  expect(readUInt32(buffer, offset)).toBe(0x04034b50);
  const fileNameLength = readUInt16(buffer, offset + 26);
  const extraLength = readUInt16(buffer, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  return buffer.subarray(dataOffset, dataOffset + entry.uncompressedSize).toString('utf8');
}

async function readZipFixture(relativePath: string) {
  const buffer = await fs.readFile(path.join(testingSpaceRoot, relativePath));
  const entries = parseZipEntries(buffer);
  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));

  const readYaml = (entryName: string) => {
    const entry = entryMap.get(entryName);
    if (!entry) {
      throw new Error(`Missing ZIP entry: ${entryName}`);
    }
    return yaml.parse(readStoredEntryText(buffer, entry)) as Record<string, any>;
  };

  const readText = (entryName: string) => {
    const entry = entryMap.get(entryName);
    if (!entry) {
      throw new Error(`Missing ZIP entry: ${entryName}`);
    }
    return readStoredEntryText(buffer, entry);
  };

  return { entries, entryMap, readText, readYaml };
}

describe('real finished product materials', () => {
  it('keeps the mixed rich text, image and music card package compatible with the editing runtime', async () => {
    const archive = await readZipFixture('富文本基础卡片.card');
    const metadata = archive.readYaml('.card/metadata.yaml');
    const structure = archive.readYaml('.card/structure.yaml');

    expect(metadata).toMatchObject({
      chip_standards_version: '1.0.0',
      card_id: 'bbdj4h9kz4',
      name: '富文本基础卡片',
      cover_ratio: '3:4',
    });
    expect(archive.entryMap.has('.card/cover.html')).toBe(true);
    expect(archive.entryMap.has('.card/cardcover/cover-image.png')).toBe(true);
    expect(structure.structure.map((node: { type: string }) => node.type)).toEqual([
      'base.richtext',
      'base.image',
      'base.music',
    ]);
    expect(structure.manifest.card_count).toBe(3);
    expect(structure.manifest.resources).toContainEqual(expect.objectContaining({
      path: '测试音频.mp3',
      type: 'audio/mpeg',
    }));

    const richtext = archive.readYaml('content/magrpV5bWu.yaml');
    const image = archive.readYaml('content/s2J2SH1yMR.yaml');
    const music = archive.readYaml('content/qIIDkJWai3.yaml');

    expect(richtext).toMatchObject({
      card_type: 'RichTextCard',
      content_source: 'inline',
    });
    expect(image.images).toHaveLength(10);
    expect(image.images.every((item: { file_path?: string }) => archive.entryMap.has(item.file_path ?? ''))).toBe(true);
    expect(music).toMatchObject({
      card_type: 'MusicCard',
      audio_file: '测试音频.mp3',
      album_cover: '测试音频-cover.png',
    });
    expect(archive.entryMap.has(music.audio_file)).toBe(true);
    expect(archive.entryMap.has(music.album_cover)).toBe(true);
  });

  it('keeps the food card package compatible with image and file-backed rich text cards', async () => {
    const archive = await readZipFixture('美食卡片成品/美食卡片-01-点心百宝盒.card');
    const metadata = archive.readYaml('.card/metadata.yaml');
    const structure = archive.readYaml('.card/structure.yaml');
    const image = archive.readYaml('content/PClftdAyap.yaml');
    const richtext = archive.readYaml('content/tV0osUdKMC.yaml');

    expect(metadata.name).toBe('美食卡片：点心百宝盒');
    expect(metadata.cover_ratio).toBe('3:4');
    expect(structure.structure.map((node: { type: string }) => node.type)).toEqual([
      'base.image',
      'base.richtext',
    ]);
    expect(structure.manifest.resources).toContainEqual(expect.objectContaining({
      path: 'richtext-tV0osUdKMC.md',
    }));
    expect(image.images).toHaveLength(1);
    expect(archive.entryMap.has(image.images[0]?.file_path)).toBe(true);
    expect(richtext).toMatchObject({
      card_type: 'RichTextCard',
      content_source: 'file',
      content_file: 'richtext-tV0osUdKMC.md',
    });
    expect(archive.readText(richtext.content_file)).toContain('点心百宝盒');
  });

  it('keeps the food grid box package compatible with the official box document model', async () => {
    const archive = await readZipFixture('美食网格箱子.box');
    const metadata = archive.readYaml('.box/metadata.yaml');
    const content = archive.readYaml('.box/content.yaml');
    const structure = archive.readYaml('.box/structure.yaml');

    expect(metadata).toMatchObject({
      chip_standards_version: '1.0.0',
      box_id: '3UQ4tF5Eze',
      name: '美食网格箱子',
      active_layout_type: 'chips.layout.grid',
      cover_ratio: '3:4',
    });
    expect(archive.entryMap.has('.box/cover.html')).toBe(true);
    expect(archive.entryMap.has('.box/boxcover/cover-image.png')).toBe(true);
    expect(content.active_layout_type).toBe('chips.layout.grid');
    expect(content.layout_configs['chips.layout.grid']).toMatchObject({
      schema_version: '1.0.0',
      asset_refs: [],
    });

    expect(structure.entries).toHaveLength(15);
    expect(structure.entries.every((entry: { enabled?: boolean; url?: string; snapshot?: { content_type?: string } }) => (
      entry.enabled === true
      && typeof entry.url === 'string'
      && entry.snapshot?.content_type === 'chips/card'
    ))).toBe(true);
    expect(structure.entries.map((entry: { layout_hints?: { sort_key?: string } }) => entry.layout_hints?.sort_key)).toEqual(
      Array.from({ length: 15 }, (_item, index) => String(index + 1).padStart(2, '0')),
    );
  });
});
