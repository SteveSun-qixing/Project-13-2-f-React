import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEmbeddedAudioMetadata, type EmbeddedAudioMetadata } from '@chips/plugin-music';
import {
  assembleTrackFromInput,
  buildTrackPresentation,
  createAudioSourceFromUri,
  fetchCompanionLyrics,
  probeAudioMetadata,
  resolveTrackFormatLabel,
} from '../src/player/trackSession';
import {
  createEmptyLyricsDocument,
  decodeTextWithFallback,
  parseLyricsText,
  type LyricsDocument,
} from '../src/player/lyrics';

/**
 * 曲目会话装配判例（重写件）。
 *
 * 「真实夹具」口径：元数据探测与歌词拉取经真实 `fetch`（data: 地址，无传输桩）取字节，
 * 解析全部走真实链（`@chips/plugin-music` 公开导出 `parseEmbeddedAudioMetadata` 与迁移件
 * `decodeTextWithFallback`/`parseLyricsText`）；仅「传输失败」路径以传输层桩表达。
 * 夹具以包根相对路径读取（vitest 以包目录为 cwd；jsdom 环境 import.meta.url 为 http 形态）。
 */

const MP3_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/metadata/sample-id3v2.mp3');
const LRC_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/lyrics/sample-timed.lrc');

function toDataUri(path: string, mimeType: string): string {
  return `data:${mimeType};base64,${readFileSync(path).toString('base64')}`;
}

const parseFixtureDirectly = (): EmbeddedAudioMetadata =>
  parseEmbeddedAudioMetadata({
    bytes: new Uint8Array(readFileSync(MP3_FIXTURE_PATH)),
    fileName: 'sample-id3v2.mp3',
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAudioSourceFromUri', () => {
  it('归一 http(s)/blob/file 地址为播放会话来源', () => {
    const remote = createAudioSourceFromUri('https://example.com/audio/晴天.mp3');
    expect(remote).toMatchObject({
      fileName: '晴天.mp3',
      title: '晴天.mp3',
      mimeType: 'audio/mpeg',
      extension: '.mp3',
      isRemote: true,
      revision: 1,
    });

    const local = createAudioSourceFromUri('file:///音乐库/夜曲.flac');
    expect(local).toMatchObject({ fileName: '夜曲.flac', isRemote: false, extension: '.flac' });

    const blob = createAudioSourceFromUri('blob:https://example.com/token');
    expect(blob?.isRemote).toBe(false);
  });

  it('data: 地址的展示名不使用 base64 载荷，MIME 取头部声明', () => {
    const source = createAudioSourceFromUri(toDataUri(MP3_FIXTURE_PATH, 'audio/mpeg'));
    expect(source?.fileName).toBe('audio-data');
    expect(source?.title).toBe('audio-data');
    expect(source?.mimeType).toBe('audio/mpeg');
    expect(source?.extension).toBeUndefined();
    expect(source?.title.length).toBeLessThan(64);
  });

  it('拒绝空输入与不可播放地址', () => {
    expect(createAudioSourceFromUri('')).toBeNull();
    expect(createAudioSourceFromUri('   ')).toBeNull();
    expect(createAudioSourceFromUri('/tmp/demo.mp3')).toBeNull();
    expect(createAudioSourceFromUri('javascript:alert(1)')).toBeNull();
  });
});

describe('assembleTrackFromInput', () => {
  it('守卫拒绝空音频地址并给出简体中文原因', () => {
    const result = assembleTrackFromInput({ audioUri: '   ' });
    expect(result).toEqual({ ok: false, error: '请输入音频地址。' });
  });

  it('守卫拒绝不可播放地址与非法伴生地址', () => {
    expect(assembleTrackFromInput({ audioUri: '/tmp/demo.mp3' }).ok).toBe(false);
    const badCompanion = assembleTrackFromInput({ audioUri: 'https://example.com/a.mp3', lyricsUri: '/tmp/a.lrc' });
    expect(badCompanion.ok).toBe(false);
    if (!badCompanion.ok) {
      expect(badCompanion.error).toContain('歌词地址不可用');
    }
  });

  it('合法地址装配成功：伴生封面进入呈现，标题入口参数优先', () => {
    const result = assembleTrackFromInput({
      audioUri: 'https://example.com/audio/晴天.mp3',
      title: '晴天（重制版）',
      coverUri: 'https://example.com/cover.png',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.presentation.title).toBe('晴天（重制版）');
      expect(result.presentation.artwork).toEqual({ kind: 'companion', uri: 'https://example.com/cover.png' });
      expect(result.presentation.lyrics).toEqual(createEmptyLyricsDocument('none'));
    }
  });
});

describe('probeAudioMetadata（真实 fetch + 真实解析链）', () => {
  it('data: 地址取真实夹具字节并解析出 ID3v2 标签', async () => {
    const source = createAudioSourceFromUri(toDataUri(MP3_FIXTURE_PATH, 'audio/mpeg'));
    if (!source) {
      throw new Error('夹具来源装配失败');
    }

    const metadata = await probeAudioMetadata(source);

    expect(metadata).not.toBeNull();
    expect(metadata?.title).toBe('示例曲目');
    expect(metadata?.artist).toBe('示例歌手');
    expect(metadata?.album).toBe('示例专辑');
    expect(metadata?.lyricsText).toContain('嵌入歌词第一行');
    expect(metadata?.artwork?.mimeType).toBe('image/png');
    expect(Array.from(metadata?.artwork?.bytes.slice(0, 4) ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('与 basecards 公开导出直读结果一致（复用红线：单一解析源）', async () => {
    const source = createAudioSourceFromUri(toDataUri(MP3_FIXTURE_PATH, 'audio/mpeg'));
    if (!source) {
      throw new Error('夹具来源装配失败');
    }

    const direct = parseFixtureDirectly();
    const probed = await probeAudioMetadata(source);

    expect(probed?.title).toBe(direct.title);
    expect(probed?.artist).toBe(direct.artist);
    expect(probed?.album).toBe(direct.album);
  });

  it('file: 地址在渲染会话无字节通道时如实返回 null', async () => {
    const source = createAudioSourceFromUri('file:///音乐库/夜曲.flac');
    if (!source) {
      throw new Error('夹具来源装配失败');
    }
    await expect(probeAudioMetadata(source)).resolves.toBeNull();
  });

  it('传输失败如实返回 null（传输层桩，解析不经桩）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    const source = createAudioSourceFromUri('https://example.com/audio/晴天.mp3');
    if (!source) {
      throw new Error('夹具来源装配失败');
    }
    await expect(probeAudioMetadata(source)).resolves.toBeNull();
  });
});

describe('fetchCompanionLyrics（真实 fetch + 真实解析链）', () => {
  it('data: 地址取真实 LRC 夹具并解析为 timed 文档', async () => {
    const document = await fetchCompanionLyrics(toDataUri(LRC_FIXTURE_PATH, 'text/plain'));

    expect(document?.mode).toBe('timed');
    expect(document?.source).toBe('companion');
    expect(document?.metadata.title).toBe('夜曲');
    expect(document?.lines).toHaveLength(5);
  });

  it('非歌词内容与传输失败如实返回 null', async () => {
    const blank = 'data:text/plain;base64,' + Buffer.from('   \n\n', 'utf8').toString('base64');
    await expect(fetchCompanionLyrics(blank)).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    await expect(fetchCompanionLyrics('https://example.com/lyrics.lrc')).resolves.toBeNull();
  });
});

describe('buildTrackPresentation（优先级裁决）', () => {
  it('展示字段：卡片展示段 > 嵌入标签 > 来源名；专辑取嵌入标签', () => {
    const source = createAudioSourceFromUri('https://example.com/audio/晴天.mp3');
    if (!source) {
      throw new Error('夹具来源装配失败');
    }
    const metadata = parseFixtureDirectly();

    const withCard = buildTrackPresentation({
      source,
      metadata,
      cardDisplay: { title: '展示标题', artist: '展示歌手' },
    });
    expect(withCard.title).toBe('展示标题');
    expect(withCard.artist).toBe('展示歌手');
    expect(withCard.album).toBe('示例专辑');

    const withMetadataOnly = buildTrackPresentation({ source, metadata });
    expect(withMetadataOnly.title).toBe('晴天.mp3');
    expect(withMetadataOnly.artist).toBe('示例歌手');
  });

  it('歌词：伴生 > 嵌入 timed > 嵌入 plain > 空文档；封面：伴生 > 嵌入 > 默认', () => {
    const source = createAudioSourceFromUri('https://example.com/audio/晴天.mp3');
    if (!source) {
      throw new Error('夹具来源装配失败');
    }
    const metadata = parseFixtureDirectly();
    const companion = parseLyricsFixture();

    const companionFirst = buildTrackPresentation({
      source,
      metadata,
      companionLyrics: companion,
      companionCoverUri: 'https://example.com/cover.png',
    });
    expect(companionFirst.lyrics.source).toBe('companion');
    expect(companionFirst.artwork).toMatchObject({ kind: 'companion', uri: 'https://example.com/cover.png' });

    const embeddedFirst = buildTrackPresentation({ source, metadata });
    expect(embeddedFirst.lyrics.source).toBe('embedded');
    // USLT 嵌入文本携带时间轴 → 解析为 timed 模式（真实解析语义）。
    expect(embeddedFirst.lyrics.mode).toBe('timed');
    expect(embeddedFirst.artwork).toMatchObject({ kind: 'embedded', cacheKey: `${source.sourceId}#1` });

    const bare = buildTrackPresentation({ source });
    expect(bare.lyrics).toEqual(createEmptyLyricsDocument('none'));
    expect(bare.artwork).toEqual({ kind: 'default' });
  });

  it('格式徽标：扩展名优先，data: 地址按 MIME 子类型', () => {
    const mp3 = createAudioSourceFromUri('https://example.com/audio/晴天.mp3');
    const data = createAudioSourceFromUri(toDataUri(MP3_FIXTURE_PATH, 'audio/mpeg'));
    if (!mp3 || !data) {
      throw new Error('夹具来源装配失败');
    }
    expect(resolveTrackFormatLabel(buildTrackPresentation({ source: mp3 }))).toBe('MP3');
    expect(resolveTrackFormatLabel(buildTrackPresentation({ source: data }))).toBe('MPEG');
  });
});

// 真实 LRC 夹具 → 迁移件解析链（经 buildTrackPresentation 消费的伴生文档形态）。
const parseLyricsFixture = (): LyricsDocument =>
  parseLyricsText(decodeTextWithFallback(new Uint8Array(readFileSync(LRC_FIXTURE_PATH))), 'companion');
