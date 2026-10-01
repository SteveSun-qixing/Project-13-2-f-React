import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  buildContent,
  buildVideoOpenRequest,
  DEFAULT_CONFIG,
  deriveDisplayTitle,
  deriveMetaLine,
  readConfig,
  validateConfig,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.video',
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '16:9',
      tags: [],
    },
  };
}

const FULL_CONFIG = {
  video_file: 'videos/tokyo-travel.mp4',
  cover_image: 'covers/tokyo-travel.jpg',
  subtitles: [
    {
      id: 'zh-cn',
      label: '简体中文',
      language: 'zh-CN',
      kind: 'subtitles',
      file_path: 'subtitles/tokyo-travel.zh.vtt',
      default: true,
    },
    {
      id: 'en',
      label: 'English',
      language: 'en-US',
      kind: 'captions',
      file_path: 'subtitles/tokyo-travel.en.vtt',
      default: false,
    },
  ],
  playback: { autoplay: true, loop: true, muted: false, playback_rate: 1.5, start_time: 12 },
  video_title: '东京旅行记录',
  publish_time: '2026-04-18',
  creator: '薯片工作室',
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
    expect(validateConfig('video')).toBe(false);
    expect(validateConfig(['mp4'])).toBe(false);
    expect(validateConfig({ video_file: 1 })).toBe(false);
    expect(validateConfig({ cover_image: 0 })).toBe(false);
    expect(validateConfig({ video_title: null })).toBe(false);
    expect(validateConfig({ creator: 3 })).toBe(false);
    expect(validateConfig({ publish_time: true })).toBe(false);
  });

  it('非空资源路径必须是合法包内相对路径', () => {
    expect(validateConfig({ video_file: 'videos/demo.mp4' })).toBe(true);
    expect(validateConfig({ video_file: './videos/demo.mp4' })).toBe(true);
    expect(validateConfig({ video_file: '../escape.mp4' })).toBe(false);
    expect(validateConfig({ video_file: 'a\\b.mp4' })).toBe(false);
    expect(validateConfig({ video_file: 'https://cdn.example.com/demo.mp4' })).toBe(false);
    expect(validateConfig({ cover_image: '/abs/cover.jpg' })).toBe(false);
  });

  it('字幕条目必须是对象且 id 与 file_path 必填（01 §6.2）', () => {
    expect(validateConfig({ subtitles: '字幕' })).toBe(false);
    expect(validateConfig({ subtitles: ['zh'] })).toBe(false);
    expect(validateConfig({ subtitles: [null] })).toBe(false);
    expect(validateConfig({ subtitles: [{ label: '缺 id 与路径' }] })).toBe(false);
    expect(validateConfig({ subtitles: [{ id: 'zh' }] })).toBe(false);
    expect(validateConfig({ subtitles: [{ id: 'zh', file_path: '' }] })).toBe(false);
    expect(validateConfig({ subtitles: [{ id: 'zh', file_path: '../escape.vtt' }] })).toBe(false);
    expect(validateConfig({ subtitles: [{ id: '', file_path: 'subtitles/a.vtt' }] })).toBe(false);
    expect(
      validateConfig({ subtitles: [{ id: 'zh', file_path: 'subtitles/a.vtt', kind: 'dub' }] }),
    ).toBe(false);
    expect(
      validateConfig({ subtitles: [{ id: 'zh', file_path: 'subtitles/a.vtt', default: 'yes' }] }),
    ).toBe(false);
    expect(
      validateConfig({ subtitles: [{ id: 'zh', file_path: 'subtitles/a.vtt', label: 1 }] }),
    ).toBe(false);
    expect(
      validateConfig({ subtitles: [{ id: 'zh', file_path: 'subtitles/a.vtt', language: [] }] }),
    ).toBe(false);
    expect(validateConfig({ subtitles: [{ id: 'zh', file_path: 'subtitles/a.vtt' }] })).toBe(true);
  });

  it('播放参数必须落在 01 §6.2 数值域内', () => {
    expect(validateConfig({ playback: [] })).toBe(false);
    expect(validateConfig({ playback: { autoplay: 'yes' } })).toBe(false);
    expect(validateConfig({ playback: { loop: 1 } })).toBe(false);
    expect(validateConfig({ playback: { muted: null } })).toBe(false);
    expect(validateConfig({ playback: { playback_rate: 4 } })).toBe(true);
    expect(validateConfig({ playback: { playback_rate: 0.25 } })).toBe(true);
    expect(validateConfig({ playback: { playback_rate: 8 } })).toBe(false);
    expect(validateConfig({ playback: { playback_rate: 0.1 } })).toBe(false);
    expect(validateConfig({ playback: { playback_rate: '2' } })).toBe(false);
    expect(validateConfig({ playback: { start_time: 0 } })).toBe(true);
    expect(validateConfig({ playback: { start_time: -5 } })).toBe(false);
  });
});

describe('readConfig 归一', () => {
  it('非法输入回退默认配置', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('video')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ video_file: 42 })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ subtitles: '字幕' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ playback: '快' })).toEqual({ ...DEFAULT_CONFIG });
  });

  it('归一资源路径：剥除引导符、拒绝穿越段与非包内引用', () => {
    expect(readConfig({ video_file: './videos/demo.mp4' }).video_file).toBe('videos/demo.mp4');
    expect(readConfig({ video_file: ' a\\b\\demo.mp4 ' }).video_file).toBe('');
    expect(readConfig({ video_file: '../escape.mp4' }).video_file).toBe('');
    expect(readConfig({ video_file: '/abs/demo.mp4' }).video_file).toBe('');
    expect(readConfig({ video_file: 'https://cdn.example.com/demo.mp4' }).video_file).toBe('');
    expect(readConfig({ cover_image: ' covers/demo.jpg ' }).cover_image).toBe('covers/demo.jpg');
  });

  it('归一播放参数：布尔只认 true、倍速钳制 0.25~4、起始秒数非负', () => {
    expect(readConfig({ playback: { autoplay: 1, loop: 'yes', muted: true } }).playback).toEqual({
      autoplay: false,
      loop: false,
      muted: true,
      playback_rate: 1,
      start_time: 0,
    });
    expect(readConfig({ playback: { playback_rate: 8 } }).playback.playback_rate).toBe(4);
    expect(readConfig({ playback: { playback_rate: 0.1 } }).playback.playback_rate).toBe(0.25);
    expect(readConfig({ playback: { playback_rate: 1.234 } }).playback.playback_rate).toBe(1.23);
    expect(readConfig({ playback: { start_time: -10 } }).playback.start_time).toBe(0);
    expect(readConfig({ playback: { start_time: 12.3456 } }).playback.start_time).toBe(12.346);
    expect(readConfig({ playback: { playback_rate: '2' } }).playback.playback_rate).toBe(2);
  });

  it('字幕条目补齐稳定标识并裁剪字段，kind 非法回退 subtitles', () => {
    const config = readConfig({
      subtitles: [
        { label: '简体中文', language: ' zh-CN ', kind: 'captions', file_path: './subtitles/a.vtt' },
        {},
        '字幕',
        { id: 'en', kind: 'dub' },
      ],
    });

    expect(config.subtitles).toEqual([
      {
        id: 'subtitle-1',
        label: '简体中文',
        language: 'zh-CN',
        kind: 'captions',
        file_path: 'subtitles/a.vtt',
        default: false,
      },
      { id: 'en', label: '', language: '', kind: 'subtitles', file_path: '', default: false },
    ]);
  });

  it('默认字幕最多保留一轨（取首个 default 为真的条目）', () => {
    const config = readConfig({
      subtitles: [
        { id: 'zh', file_path: 'subtitles/a.vtt', default: true },
        { id: 'en', file_path: 'subtitles/b.vtt', default: true },
      ],
    });

    expect(config.subtitles.map((track) => track.default)).toEqual([true, false]);
  });

  it('裁剪字符串字段', () => {
    expect(readConfig({ video_title: ' 夜曲 ', creator: ' 薯片工作室 ' })).toEqual({
      ...DEFAULT_CONFIG,
      video_title: '夜曲',
      creator: '薯片工作室',
    });
  });
});

describe('展示派生', () => {
  it('展示标题：视频标题优先，其次视频文件名去扩展名', () => {
    expect(deriveDisplayTitle(readConfig(FULL_CONFIG))).toBe('东京旅行记录');
    expect(deriveDisplayTitle(readConfig({ video_file: 'videos/tokyo-travel.mp4' }))).toBe(
      'tokyo-travel',
    );
    expect(deriveDisplayTitle(readConfig({}))).toBe('');
  });

  it('元信息行：创作者与发布时间以间隔号连接，缺席回退空串', () => {
    expect(deriveMetaLine(readConfig(FULL_CONFIG))).toBe('薯片工作室 · 2026-04-18');
    expect(deriveMetaLine(readConfig({ creator: '薯片工作室' }))).toBe('薯片工作室');
    expect(deriveMetaLine(readConfig({ publish_time: '2026-04-18' }))).toBe('2026-04-18');
    expect(deriveMetaLine(readConfig({}))).toBe('');
  });
});

describe('buildVideoOpenRequest（14-资源打开契约 §5.4）', () => {
  it('组装完整打开请求与视频卡片载荷', () => {
    const request = buildVideoOpenRequest(readConfig(FULL_CONFIG));
    expect(request).not.toBeNull();
    expect(request!.intent).toBe('view');
    expect(request!.resource.uri).toBe('videos/tokyo-travel.mp4');
    expect(request!.resource.mimeType).toBe('video/mp4');
    expect(request!.resource.fileName).toBe('tokyo-travel.mp4');
    expect(request!.resource.title).toBe('东京旅行记录');

    const payload = request!.resource.payload;
    expect(payload.kind).toBe('chips.video-card');
    expect(payload.version).toBe('1.0.0');
    expect(payload.cardType).toBe('base.video');
    expect(payload.resources.video).toEqual({
      uri: 'videos/tokyo-travel.mp4',
      relativePath: 'videos/tokyo-travel.mp4',
      fileName: 'tokyo-travel.mp4',
      mimeType: 'video/mp4',
    });
    expect(payload.resources.cover).toEqual({
      uri: 'covers/tokyo-travel.jpg',
      relativePath: 'covers/tokyo-travel.jpg',
      fileName: 'tokyo-travel.jpg',
    });
    expect(payload.resources.subtitles).toEqual([
      {
        uri: 'subtitles/tokyo-travel.zh.vtt',
        relativePath: 'subtitles/tokyo-travel.zh.vtt',
        fileName: 'tokyo-travel.zh.vtt',
        mimeType: 'text/vtt',
        id: 'zh-cn',
        label: '简体中文',
        language: 'zh-CN',
        kind: 'subtitles',
        default: true,
      },
      {
        uri: 'subtitles/tokyo-travel.en.vtt',
        relativePath: 'subtitles/tokyo-travel.en.vtt',
        fileName: 'tokyo-travel.en.vtt',
        mimeType: 'text/vtt',
        id: 'en',
        label: 'English',
        language: 'en-US',
        kind: 'captions',
        default: false,
      },
    ]);
    expect(payload.display).toEqual({
      title: '东京旅行记录',
      creator: '薯片工作室',
      publishTime: '2026-04-18',
    });
    expect(payload.playback).toEqual({
      autoplay: true,
      loop: true,
      muted: false,
      playbackRate: 1.5,
      startTime: 12,
    });
  });

  it('视频缺失时返回 null；可选资源与展示字段缺席时省略', () => {
    expect(buildVideoOpenRequest(readConfig({}))).toBeNull();

    const minimal = buildVideoOpenRequest(readConfig({ video_file: 'clips/demo.webm' }));
    expect(minimal).not.toBeNull();
    expect(minimal!.resource.mimeType).toBe('video/webm');
    expect(minimal!.resource.payload.resources.cover).toBeUndefined();
    expect(minimal!.resource.payload.resources.subtitles).toBeUndefined();
    expect('creator' in minimal!.resource.payload.display).toBe(false);
    expect('publishTime' in minimal!.resource.payload.display).toBe(false);
    expect(minimal!.resource.payload.display.title).toBe('demo');
    expect(minimal!.resource.payload.playback).toEqual({
      autoplay: false,
      loop: false,
      muted: false,
      playbackRate: 1,
      startTime: 0,
    });
  });

  it('路径非法或为空的字幕条目不进入载荷', () => {
    const request = buildVideoOpenRequest(
      readConfig({
        video_file: 'videos/demo.mp4',
        subtitles: [
          { id: 'zh', file_path: 'subtitles/a.vtt' },
          { id: 'draft', label: '还没填路径' },
        ],
      }),
    );
    expect(request).not.toBeNull();
    expect(request!.resource.payload.resources.subtitles?.length).toBe(1);
    expect(request!.resource.payload.resources.subtitles?.[0]?.id).toBe('zh');
  });
});

describe('主进程纯函数', () => {
  it('createInitialContent 通过 validateConfig 并含 card_type 与 config', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe('base.video');
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('collectResourcePaths 去重稳定排序视频、封面与字幕，外部引用不进入清单', () => {
    const basecard = createBasecard(
      buildContent({
        ...DEFAULT_CONFIG,
        video_file: 'videos/demo.mp4',
        cover_image: 'covers/demo.jpg',
        subtitles: [
          { id: 'zh', file_path: 'subtitles/demo.zh.vtt', label: '', language: '', kind: 'subtitles', default: true },
          { id: 'en', file_path: 'covers/demo.jpg', label: '', language: '', kind: 'subtitles', default: false },
        ],
      }),
    );
    expect(collectResourcePaths(basecard)).toEqual([
      'covers/demo.jpg',
      'subtitles/demo.zh.vtt',
      'videos/demo.mp4',
    ]);

    const external = createBasecard(
      buildContent({ ...DEFAULT_CONFIG, video_file: 'https://cdn.example.com/demo.mp4' }),
    );
    expect(collectResourcePaths(external)).toEqual([]);

    const empty = createBasecard(buildContent(DEFAULT_CONFIG));
    expect(collectResourcePaths(empty)).toEqual([]);
  });
});
