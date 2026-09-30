import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  buildContent,
  buildMusicOpenRequest,
  DEFAULT_CONFIG,
  deriveDisplayTitle,
  derivePrimaryArtist,
  readConfig,
  validateConfig,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.music',
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
    },
  };
}

const FULL_CONFIG = {
  audio_file: 'tracks/midnight-echo.mp3',
  music_name: 'Midnight Echo',
  album_cover: 'covers/midnight-echo.jpg',
  lyrics_file: 'lyrics/midnight-echo.lrc',
  production_team: [
    { id: 'team-a1b2c3', role: '歌手', people: ['Alice', 'Bob'] },
    { id: 'team-d4e5f6', role: '作曲', people: ['Caro'] },
  ],
  release_date: '2026-04-18',
  album_name: 'Northern Lights',
  language: '日语',
  genre: '流行',
};

describe('validateConfig', () => {
  it('接受空配置与未提供配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
  });

  it('接受类型合法的完整配置', () => {
    expect(validateConfig(FULL_CONFIG)).toBe(true);
  });

  it('拒绝非对象与字段类型错误', () => {
    expect(validateConfig('music')).toBe(false);
    expect(validateConfig(['audio'])).toBe(false);
    expect(validateConfig({ audio_file: 1 })).toBe(false);
    expect(validateConfig({ music_name: null })).toBe(false);
    expect(validateConfig({ production_team: {} })).toBe(false);
    expect(validateConfig({ production_team: ['歌手'] })).toBe(false);
    expect(validateConfig({ production_team: [{ id: 1, role: '歌手', people: [] }] })).toBe(false);
    expect(validateConfig({ production_team: [{ id: 't', role: '歌手', people: [1] }] })).toBe(false);
  });

  it('非空资源路径必须是合法包内相对路径', () => {
    expect(validateConfig({ audio_file: 'tracks/demo.mp3' })).toBe(true);
    expect(validateConfig({ audio_file: '../escape.mp3' })).toBe(false);
    expect(validateConfig({ audio_file: 'a\\b.mp3' })).toBe(false);
    expect(validateConfig({ audio_file: 'https://cdn.example.com/demo.mp3' })).toBe(false);
    expect(validateConfig({ album_cover: '/abs/cover.jpg' })).toBe(false);
    expect(validateConfig({ lyrics_file: './lyrics/a.lrc' })).toBe(true);
  });

  it('非空发行日期必须是 YYYY-MM-DD', () => {
    expect(validateConfig({ release_date: '2026-04-18' })).toBe(true);
    expect(validateConfig({ release_date: '2026-4-18' })).toBe(false);
    expect(validateConfig({ release_date: '今年' })).toBe(false);
    expect(validateConfig({ release_date: '' })).toBe(true);
  });
});

describe('readConfig 归一', () => {
  it('非法输入回退默认配置', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('text')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ audio_file: 42 })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ production_team: '歌手' })).toEqual(DEFAULT_CONFIG);
  });

  it('归一资源路径：剥除引导符、拒绝穿越段与非包内引用', () => {
    expect(readConfig({ audio_file: './tracks/demo.mp3' }).audio_file).toBe('tracks/demo.mp3');
    expect(readConfig({ audio_file: 'a\\b\\demo.mp3' }).audio_file).toBe('');
    expect(readConfig({ audio_file: '../escape.mp3' }).audio_file).toBe('');
    expect(readConfig({ audio_file: '/abs/demo.mp3' }).audio_file).toBe('');
    expect(readConfig({ audio_file: 'https://cdn.example.com/demo.mp3' }).audio_file).toBe('');
    expect(readConfig({ album_cover: ' covers/demo.jpg ' }).album_cover).toBe('covers/demo.jpg');
  });

  it('制作团队条目补齐稳定标识并剔除空条目', () => {
    const config = readConfig({
      production_team: [
        { role: '歌手', people: [' Alice ', 'Bob', ' '] },
        {},
        { id: 'team-x', role: '作曲' },
      ],
    });

    expect(config.production_team).toEqual([
      { id: 'team-role-1', role: '歌手', people: ['Alice', 'Bob'] },
      { id: 'team-x', role: '作曲', people: [] },
    ]);
  });

  it('裁剪字符串字段', () => {
    expect(readConfig({ music_name: ' 夜曲 ', language: ' 中文 ' })).toEqual({
      ...DEFAULT_CONFIG,
      music_name: '夜曲',
      language: '中文',
    });
  });
});

describe('展示派生', () => {
  it('展示标题：歌曲名优先，其次音频文件名去扩展名', () => {
    expect(deriveDisplayTitle(readConfig(FULL_CONFIG))).toBe('Midnight Echo');
    expect(deriveDisplayTitle(readConfig({ audio_file: 'tracks/midnight-echo.mp3' }))).toBe(
      'midnight-echo'
    );
    expect(deriveDisplayTitle(readConfig({}))).toBe('');
  });

  it('展示歌手：优先歌手身份，否则首个含成员身份', () => {
    expect(derivePrimaryArtist(readConfig(FULL_CONFIG))).toBe('Alice / Bob');
    expect(
      derivePrimaryArtist(
        readConfig({ production_team: [{ id: 't1', role: '作曲', people: ['Caro'] }] })
      )
    ).toBe('Caro');
    expect(derivePrimaryArtist(readConfig({}))).toBe('');
  });
});

describe('buildMusicOpenRequest（14-资源打开契约 §9.2）', () => {
  it('组装完整打开请求与音乐卡片载荷', () => {
    const request = buildMusicOpenRequest(readConfig(FULL_CONFIG));
    expect(request).not.toBeNull();
    expect(request!.intent).toBe('view');
    expect(request!.resource.uri).toBe('tracks/midnight-echo.mp3');
    expect(request!.resource.mimeType).toBe('audio/mpeg');
    expect(request!.resource.fileName).toBe('midnight-echo.mp3');
    expect(request!.resource.title).toBe('Midnight Echo');

    const payload = request!.resource.payload;
    expect(payload.kind).toBe('chips.music-card');
    expect(payload.version).toBe('1.0.0');
    expect(payload.cardType).toBe('base.music');
    expect(payload.resources.audio).toEqual({
      uri: 'tracks/midnight-echo.mp3',
      relativePath: 'midnight-echo.mp3',
      mimeType: 'audio/mpeg',
    });
    expect(payload.resources.cover).toEqual({
      uri: 'covers/midnight-echo.jpg',
      relativePath: 'midnight-echo.jpg',
    });
    expect(payload.resources.lyrics).toEqual({
      uri: 'lyrics/midnight-echo.lrc',
      relativePath: 'midnight-echo.lrc',
    });
    expect(payload.display).toEqual({ title: 'Midnight Echo', artist: 'Alice / Bob' });
  });

  it('音频缺失时返回 null；可选资源与歌手缺席时字段省略', () => {
    expect(buildMusicOpenRequest(readConfig({}))).toBeNull();

    const minimal = buildMusicOpenRequest(readConfig({ audio_file: 'song.flac' }));
    expect(minimal).not.toBeNull();
    expect(minimal!.resource.mimeType).toBe('audio/flac');
    expect(minimal!.resource.payload.resources.cover).toBeUndefined();
    expect(minimal!.resource.payload.resources.lyrics).toBeUndefined();
    expect('artist' in minimal!.resource.payload.display).toBe(false);
    expect(minimal!.resource.payload.display.title).toBe('song');
  });
});

describe('主进程纯函数', () => {
  it('createInitialContent 通过 validateConfig 并含 card_type 与 config', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe('base.music');
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('collectResourcePaths 去重且稳定排序音频、封面与歌词，外部引用不进入清单', () => {
    const basecard = createBasecard(
      buildContent({
        ...DEFAULT_CONFIG,
        audio_file: 'tracks/demo.mp3',
        album_cover: 'covers/demo.jpg',
        lyrics_file: 'covers/demo.jpg',
      })
    );
    expect(collectResourcePaths(basecard)).toEqual(['covers/demo.jpg', 'tracks/demo.mp3']);

    const external = createBasecard(
      buildContent({ ...DEFAULT_CONFIG, audio_file: 'https://cdn.example.com/demo.mp3' })
    );
    expect(collectResourcePaths(external)).toEqual([]);

    const empty = createBasecard(buildContent(DEFAULT_CONFIG));
    expect(collectResourcePaths(empty)).toEqual([]);
  });
});
