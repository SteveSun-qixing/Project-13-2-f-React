import { describe, expect, it } from 'vitest';
import {
  buildNetworkPathMap,
  buildRichTextContentFileMap,
  loadRestoreManifest,
  suggestDownloadFileName,
  type RestoreManifest,
} from '../src/domain/community/restoreManifest';
import { FIXTURE_RESTORE_MANIFEST } from './fixtures/card-archive';

describe('可逆恢复清单（16-传输协议 §4.4/§4.5，真实清单夹具）', () => {
  it('结构合法清单装载成功并按 order 升序排列归档条目', () => {
    const manifest = loadRestoreManifest(FIXTURE_RESTORE_MANIFEST);
    expect(manifest).not.toBeNull();
    expect(manifest?.schemaVersion).toBe('1.0.0');
    expect(manifest?.originalFileName).toBe('tokyo-travel.card');
    expect(manifest?.cardId).toBe('1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d');
    expect(manifest?.versionId).toBe('6f7c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f');
    expect(manifest?.resources).toHaveLength(3);
    expect(manifest?.zipEntries.map((entry) => entry.order)).toEqual([0, 1, 2, 3]);
    expect(manifest?.richTextContentFiles).toEqual([
      { configPath: 'content/f6G7h8I9j0.yaml', contentFile: 'richtext/f6G7h8I9j0.md' },
    ]);
  });

  it('缺清单返回 null（上层归 CARD_TRANSFER_MANIFEST_MISSING，§4.5 第 1 步）', () => {
    expect(loadRestoreManifest(undefined)).toBeNull();
    expect(loadRestoreManifest(null)).toBeNull();
    expect(loadRestoreManifest('not-a-manifest')).toBeNull();
    expect(loadRestoreManifest({})).toBeNull();
  });

  it('结构版本不受支持或必填结构非法时如实上抛 CARD_TRANSFER_MANIFEST_INVALID', () => {
    const unsupported = { ...FIXTURE_RESTORE_MANIFEST, schemaVersion: '9.9.9' };
    expect(() => loadRestoreManifest(unsupported)).toThrowError(/结构版本不受支持/);
    const missingResources = { ...FIXTURE_RESTORE_MANIFEST, resources: undefined };
    expect(() => loadRestoreManifest(missingResources)).toThrowError(/结构非法/);
    const brokenResource = {
      ...FIXTURE_RESTORE_MANIFEST,
      resources: [{ originalRelativePath: 'images/tokyo-1.jpg' }],
    };
    expect(() => loadRestoreManifest(brokenResource)).toThrowError(/结构非法/);
  });

  it('构建 URL → 原始相对路径映射与富文本还原映射（§4.5 第 4 步）', () => {
    const manifest = loadRestoreManifest(FIXTURE_RESTORE_MANIFEST) as RestoreManifest;
    const pathMap = buildNetworkPathMap(manifest);
    expect(pathMap.size).toBe(3);
    expect(pathMap.get(FIXTURE_RESTORE_MANIFEST.resources[0].networkUrl)).toBe(
      '.card/cardcover/cover-image.png',
    );
    expect(pathMap.get(FIXTURE_RESTORE_MANIFEST.resources[2].networkUrl)).toBe('images/tokyo-1.jpg');

    const contentFileMap = buildRichTextContentFileMap(manifest);
    expect(contentFileMap.get('content/f6G7h8I9j0.yaml')).toBe('richtext/f6G7h8I9j0.md');
  });

  it('建议下载输出文件名取 originalFileName（§4.4）', () => {
    const manifest = loadRestoreManifest(FIXTURE_RESTORE_MANIFEST) as RestoreManifest;
    expect(suggestDownloadFileName(manifest)).toBe('tokyo-travel.card');
  });
});
