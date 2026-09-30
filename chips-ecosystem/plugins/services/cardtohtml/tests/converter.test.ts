/**
 * cardToHtml 编排断言：端到端目录态导出、输出冲突与覆盖、zip 诚实拒绝、
 * 资源缺失警告、节点缺失跳过、空文档与选项分支。
 */

import { ChipsError } from '@chips/sdk';

import { describe, expect, it } from 'vitest';

import { convertCardToHtml } from '../src/converter.js';
import { CONTENT_ASSET_DIR, ENTRY_FILE, MANIFEST_FILE } from '../src/html.js';
import { CONVERTER_ERROR_CODES } from '../src/errors.js';
import {
  DOCUMENT_FIXTURE,
  OUTPUT_PATH,
  SOURCE_PATH,
  baseInput,
  createFakeBridge,
  errorCodeOf,
} from './helpers.js';

describe('端到端目录态导出', () => {
  it('产出 index.html 与 conversion-manifest.json，回执字段齐全，资源按计划复制', async () => {
    const { bridge, state } = createFakeBridge();
    const result = await convertCardToHtml(bridge, baseInput());

    expect(result.packageMode).toBe('directory');
    expect(result.outputPath).toBe(OUTPUT_PATH);
    expect(result.entryFile).toBe(ENTRY_FILE);
    expect(result.manifestFile).toBe(MANIFEST_FILE);
    expect(result.documentId).toBe(DOCUMENT_FIXTURE.documentId);
    expect(result.digest).toBe(DOCUMENT_FIXTURE.digest);
    expect(result.assetCount).toBe(2);
    expect(result.warnings).toBeUndefined();

    const indexWrite = state.writes.find((write) => write.path.endsWith(`/${ENTRY_FILE}`));
    expect(indexWrite).toBeDefined();
    expect(indexWrite?.path).toBe(`${OUTPUT_PATH}/${ENTRY_FILE}`);
    expect(indexWrite?.data).toContain('<h1 class="chips-export-card__title">测试卡片</h1>');
    expect(indexWrite?.data).toContain('./assets/content/resources/pictures/photo.png');

    const manifestWrite = state.writes.find((write) => write.path.endsWith(`/${MANIFEST_FILE}`));
    expect(manifestWrite).toBeDefined();
    const manifest = JSON.parse(manifestWrite?.data ?? '{}') as Record<string, unknown>;
    expect(manifest['type']).toBe('card-to-html');
    expect(manifest['schemaVersion']).toBe('1.0.0');

    expect(state.copies.map((copy) => copy.target)).toEqual([
      `${OUTPUT_PATH}/${CONTENT_ASSET_DIR}/resources/pictures/photo.png`,
      `${OUTPUT_PATH}/${CONTENT_ASSET_DIR}/resources/files/notes.txt`,
    ]);
    expect(state.copies.every((copy) => copy.source.startsWith(`${SOURCE_PATH}/`))).toBe(true);
    expect(state.mkdirs.some((path) => path === OUTPUT_PATH)).toBe(true);
  });

  it('复制的目标目录逐个先行创建（mkdir 先于 copy）', async () => {
    const { bridge, state } = createFakeBridge();
    await convertCardToHtml(bridge, baseInput());
    for (const copy of state.copies) {
      const parent = copy.target.split('/').slice(0, -1).join('/');
      const mkdirIndex = state.mkdirs.indexOf(parent);
      expect(mkdirIndex).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('输出就绪与冲突', () => {
  it('输出已存在且未请求覆盖时以 CONVERTER_INPUT_UNSUPPORTED 拒绝，且不写产物', async () => {
    const { bridge, state } = createFakeBridge({ outputExists: true });
    const error = await convertCardToHtml(bridge, baseInput()).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.inputUnsupported);
    expect(state.writes).toEqual([]);
    expect(state.copies).toEqual([]);
  });

  it('输出已存在且 overwrite=true 时先删除旧目标再导出', async () => {
    const { bridge, state } = createFakeBridge({ outputExists: true });
    const result = await convertCardToHtml(bridge, baseInput({ output: { path: OUTPUT_PATH, overwrite: true } }));
    expect(result.assetCount).toBe(2);
    expect(state.deletes.some((entry) => entry.path === OUTPUT_PATH && entry.recursive)).toBe(true);
    expect(state.writes.length).toBe(2);
  });

  it('输出目录不能为文件系统根', async () => {
    const { bridge } = createFakeBridge();
    const error = await convertCardToHtml(bridge, baseInput({ output: { path: '/' } })).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.inputUnsupported);
  });
});

describe('压缩态诚实拒绝', () => {
  it('packageMode=zip 以 CONVERTER_INPUT_UNSUPPORTED 拒绝，details 标明宿主压缩域缺位', async () => {
    const { bridge, state } = createFakeBridge();
    const error = await convertCardToHtml(
      bridge,
      baseInput({ output: { path: `${OUTPUT_PATH}.zip`, packageMode: 'zip', overwrite: true } })
    ).then(
      (value) => value,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.inputUnsupported);
    expect(JSON.stringify(error)).toContain('zip-package-mode-unavailable');
    expect(state.writes).toEqual([]);
  });
});

describe('输入归一', () => {
  it.each([
    ['非对象输入', null],
    ['缺 source', { output: { path: OUTPUT_PATH } }],
    ['缺 output', { source: SOURCE_PATH }],
    ['缺 output.path', { source: SOURCE_PATH, output: {} }],
    ['packageMode 非法', { source: SOURCE_PATH, output: { path: OUTPUT_PATH, packageMode: 'rar' } }],
  ])('%s 以 CONVERTER_INPUT_UNSUPPORTED 拒绝', async (_label, input) => {
    const { bridge } = createFakeBridge();
    const error = await convertCardToHtml(bridge, input).then(
      (value) => value,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.inputUnsupported);
  });
});

describe('文档消费分支', () => {
  it('来源非卡片（box）时以 CONVERTER_INPUT_UNSUPPORTED 拒绝', async () => {
    const { bridge } = createFakeBridge({
      fixture: { ...DOCUMENT_FIXTURE, kind: 'box' },
    });
    const error = await convertCardToHtml(bridge, baseInput()).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.inputUnsupported);
  });

  it('document:open 的宿主错误原样透传', async () => {
    const { bridge } = createFakeBridge({
      failOpenWith: new ChipsError({ code: 'DOCUMENT_NOT_FOUND', message: '文档不存在' }),
    });
    const error = await convertCardToHtml(bridge, baseInput()).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe('DOCUMENT_NOT_FOUND');
  });

  it('元数据切片形状不合法时以 CONVERTER_RENDER_FAILED 拒绝', async () => {
    const { bridge } = createFakeBridge({
      fixture: { ...DOCUMENT_FIXTURE, metadata: { card_id: 'card-1' } },
    });
    const error = await convertCardToHtml(bridge, baseInput()).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.renderFailed);
  });

  it('内容节点缺失时记录 CONVERTER_NODE_UNAVAILABLE 警告并继续导出', async () => {
    const { bridge } = createFakeBridge({
      fixture: {
        ...DOCUMENT_FIXTURE,
        contentByNode: { 'node-1': DOCUMENT_FIXTURE.contentByNode['node-1']! },
      },
    });
    const result = await convertCardToHtml(bridge, baseInput());
    expect(result.warnings?.map((warning) => warning.code)).toEqual(['CONVERTER_NODE_UNAVAILABLE']);
  });

  it('空文档（无结构节点）导出成功且 assetCount 为 0', async () => {
    const { bridge, state } = createFakeBridge({
      fixture: { ...DOCUMENT_FIXTURE, structure: [], manifest: {}, contentByNode: {} },
    });
    const result = await convertCardToHtml(bridge, baseInput());
    expect(result.assetCount).toBe(0);
    expect(result.warnings).toBeUndefined();
    const indexWrite = state.writes.find((write) => write.path.endsWith(`/${ENTRY_FILE}`));
    expect(indexWrite?.data).not.toContain('<section class="chips-export-node"');
  });
});

describe('资源复制分支', () => {
  it('资源缺失按 CONVERTER_RESOURCE_MISSING 警告收口，不中断导出', async () => {
    const { bridge } = createFakeBridge({
      missingResources: [`${SOURCE_PATH}/resources/files/notes.txt`],
    });
    const result = await convertCardToHtml(bridge, baseInput());
    expect(result.assetCount).toBe(1);
    expect(result.warnings?.map((warning) => warning.code)).toEqual(['CONVERTER_RESOURCE_MISSING']);
  });

  it('includeAssets=false 不复制资源并记录 CONVERTER_ASSETS_SKIPPED', async () => {
    const { bridge, state } = createFakeBridge();
    const result = await convertCardToHtml(bridge, baseInput({ options: { includeAssets: false } }));
    expect(result.assetCount).toBe(0);
    expect(state.copies).toEqual([]);
    expect(result.warnings?.map((warning) => warning.code)).toEqual(['CONVERTER_ASSETS_SKIPPED']);
    const indexWrite = state.writes.find((write) => write.path.endsWith(`/${ENTRY_FILE}`));
    expect(indexWrite?.data).toContain('src="resources/pictures/photo.png"');
  });
});

describe('清单与失败清理', () => {
  it('includeManifest=false 不写清单并记录 CONVERTER_MANIFEST_SKIPPED', async () => {
    const { bridge, state } = createFakeBridge();
    const result = await convertCardToHtml(
      bridge,
      baseInput({ options: { includeManifest: false } })
    );
    expect(result.manifestFile).toBeUndefined();
    expect(state.writes.length).toBe(1);
    expect(result.warnings?.map((warning) => warning.code)).toEqual(['CONVERTER_MANIFEST_SKIPPED']);
  });

  it('失败时对已准备的输出目录做尽力清理', async () => {
    const { bridge, state } = createFakeBridge({
      fixture: { ...DOCUMENT_FIXTURE, metadata: { card_id: 'card-1' } },
    });
    const error = await convertCardToHtml(bridge, baseInput()).then(
      () => undefined,
      (caught: unknown) => caught
    );
    expect(errorCodeOf(error)).toBe(CONVERTER_ERROR_CODES.renderFailed);
    expect(state.deletes.some((entry) => entry.path === OUTPUT_PATH)).toBe(true);
  });
});
