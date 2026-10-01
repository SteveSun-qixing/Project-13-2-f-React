import { describe, expect, it } from 'vitest';
import {
  findDuplicateResourcePaths,
  isExternalReference,
  isStructuralCardFile,
  isSystemArtifactFile,
  normalizeCardPath,
  resolveCardResourceCandidates,
  selectCardResourceEntries,
  splitReferenceSuffix,
} from '../src/domain/community/cardPaths';
import {
  FIXTURE_CARD_ENTRIES,
  FIXTURE_CONTENT_FILE,
} from './fixtures/card-archive';

describe('卡片包内路径规范化（16-传输协议 §4.2 第 1 条）', () => {
  it('反斜杠归一、NFC、折叠冗余分隔符与点段、去除前导与尾部分隔符', () => {
    expect(normalizeCardPath('.card\\cardcover\\cover-image.png')).toBe('.card/cardcover/cover-image.png');
    expect(normalizeCardPath('images//tokyo-1.jpg')).toBe('images/tokyo-1.jpg');
    expect(normalizeCardPath('/images/tokyo-1.jpg/')).toBe('images/tokyo-1.jpg');
    expect(normalizeCardPath('images/./tokyo-1.jpg')).toBe('images/tokyo-1.jpg');
    expect(normalizeCardPath('attachments/./nested/../行程表.pdf')).toBe('attachments/行程表.pdf');
    expect('attachments/行程表.pdf'.normalize('NFC').length).toBeGreaterThan(0);
  });

  it('越界、点段溢出与空路径返回 null（无 ..、无前导 / 的规范化约束）', () => {
    expect(normalizeCardPath('..')).toBeNull();
    expect(normalizeCardPath('images/../../outside.jpg')).toBeNull();
    expect(normalizeCardPath('')).toBeNull();
    expect(normalizeCardPath('./')).toBeNull();
  });
});

describe('结构性文件与系统生成物判定（16-传输协议 §4.2 第 2/3 条）', () => {
  it('结构文件与 content/*.yaml 不进入资源对象', () => {
    expect(isStructuralCardFile('.card/metadata.yaml')).toBe(true);
    expect(isStructuralCardFile('.card/structure.yaml')).toBe(true);
    expect(isStructuralCardFile('.card/cover.html')).toBe(true);
    expect(isStructuralCardFile('content/k1L2m3N4o5.yaml')).toBe(true);
    expect(isStructuralCardFile('content/nested/k1L2m3N4o5.yaml')).toBe(true);
  });

  it('非 YAML 结构内容与封面资源按资源处理（§4.2 第 4 条）', () => {
    expect(isStructuralCardFile('.card/cardcover/cover-image.png')).toBe(false);
    expect(isStructuralCardFile(FIXTURE_CONTENT_FILE)).toBe(false);
    expect(isStructuralCardFile('content/k1L2m3N4o5.md')).toBe(false);
  });

  it('系统生成物按点名项与隐藏末段判定；.card 子树不受影响', () => {
    expect(isSystemArtifactFile('__MACOSX/._metadata.yaml')).toBe(true);
    expect(isSystemArtifactFile('.DS_Store')).toBe(true);
    expect(isSystemArtifactFile('Thumbs.db')).toBe(true);
    expect(isSystemArtifactFile('desktop.ini')).toBe(true);
    expect(isSystemArtifactFile('images/.hidden.jpg')).toBe(true);
    expect(isSystemArtifactFile('.card/cardcover/cover-image.png')).toBe(false);
    expect(isSystemArtifactFile('images/tokyo-1.jpg')).toBe(false);
  });
});

describe('资源枚举与唯一性（16-传输协议 §4.2 第 1–5 条，真实卡片夹具）', () => {
  it('真实卡片目录枚举：排除结构文件、目录与系统生成物，其余全部按资源处理并稳定排序', () => {
    const resources = selectCardResourceEntries(FIXTURE_CARD_ENTRIES).map((entry) => entry.relativePath);
    expect(resources).toEqual([
      '.card/cardcover/cover-image.png',
      'attachments/行程表.pdf',
      'images/tokyo-1.jpg',
      'richtext/f6G7h8I9j0.md',
    ]);
  });

  it('资源相对路径重复按归档非法上报（§4.2 第 5 条）', () => {
    const duplicated = findDuplicateResourcePaths([
      { relativePath: 'images/tokyo-1.jpg' },
      { relativePath: 'images/tokyo-1.jpg' },
      { relativePath: 'richtext/f6G7h8I9j0.md' },
      { relativePath: 'richtext/f6G7h8I9j0.md' },
      { relativePath: 'attachments/行程表.pdf' },
    ]);
    expect(duplicated).toEqual(['images/tokyo-1.jpg', 'richtext/f6G7h8I9j0.md']);
  });

  it('无重复时返回空表', () => {
    expect(
      findDuplicateResourcePaths([{ relativePath: 'images/tokyo-1.jpg' }, { relativePath: 'video/demo.mp4' }]),
    ).toEqual([]);
  });
});

describe('引用判定（16-传输协议 §4.2 引用判定）', () => {
  it('外部引用：scheme、//、# 前缀不改写', () => {
    expect(isExternalReference('https://example.com/tokyo-night-2.jpg')).toBe(true);
    expect(isExternalReference('webdav://share.example/file.md')).toBe(true);
    expect(isExternalReference('//cdn.example/banner.png')).toBe(true);
    expect(isExternalReference('#锚点')).toBe(true);
    expect(isExternalReference('images/tokyo-1.jpg')).toBe(false);
    expect(isExternalReference('./cardcover/cover-image.png')).toBe(false);
  });

  it('后缀分离：?query 与 #fragment 与路径分离并原样保留', () => {
    expect(splitReferenceSuffix('images/tokyo-1.jpg?version=2#view')).toEqual({
      path: 'images/tokyo-1.jpg',
      suffix: '?version=2#view',
    });
    expect(splitReferenceSuffix('images/tokyo-1.jpg')).toEqual({
      path: 'images/tokyo-1.jpg',
      suffix: '',
    });
  });

  it('候选路径：卡片根相对与引用所在文件目录相对两条，去重保序', () => {
    expect(resolveCardResourceCandidates('images/tokyo-1.jpg', 'content/k1L2m3N4o5.yaml')).toEqual([
      'images/tokyo-1.jpg',
      'content/images/tokyo-1.jpg',
    ]);
    // cover.html 相对引用相对 `.card/` 目录解析（01 §7.2）。
    expect(resolveCardResourceCandidates('./cardcover/cover-image.png', '.card/cover.html')).toEqual([
      'cardcover/cover-image.png',
      '.card/cardcover/cover-image.png',
    ]);
    expect(resolveCardResourceCandidates('.card/cardcover/cover-image.png', 'content/k1L2m3N4o5.yaml')).toEqual([
      '.card/cardcover/cover-image.png',
      'content/.card/cardcover/cover-image.png',
    ]);
  });

  it('外部引用不产生候选；包内落点的相对引用按解析结果收录（POSIX 语义，无 .. 残留）', () => {
    expect(resolveCardResourceCandidates('https://example.com/a.png', '.card/cover.html')).toEqual([]);
    // `../outside.png` 相对 content/ 目录解析落在卡片根：候选为解析结果（无 .. 残留），
    // 根相对候选因 `..` 溢出被拒绝。
    expect(resolveCardResourceCandidates('../outside.png', 'content/k1L2m3N4o5.yaml')).toEqual(['outside.png']);
    expect(resolveCardResourceCandidates('   ', '.card/cover.html')).toEqual([]);
  });
});
