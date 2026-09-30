import { describe, expect, it } from 'vitest';
import {
  clampPlaybackTime,
  clampVolume,
  formatDuration,
  formatRemainingDuration,
  inferAudioMimeType,
  isAudioFilePath,
  isDirectPlayableUri,
  isImageFilePath,
  isLikelyLocalPath,
  isLyricsFilePath,
  isSupportedAudioResource,
  resolveAudioFormatLabel,
  resolveDirectoryPath,
  resolveExtension,
  resolveFileName,
  resolveFileSelection,
  resolveStem,
  resolveTrackTitle,
} from '../src/player/musicPlayer';
import type { IMusicCardOpenPayload } from '../src/player/musicPlayer';

/**
 * 格式表与纯函数域判例（随迁自旧仓 tests/unit/music-player.test.ts）。
 * 适配点：旧 chips-sdk 载荷类型收口为本地 `IMusicCardOpenPayload`（14-契约 §5.4）。
 */

describe('music player utilities（迁移判例）', () => {
  it('detects supported audio resources by extension and mime type', () => {
    expect(isSupportedAudioResource({ sourceId: '/tmp/demo.mp3' })).toBe(true);
    expect(isSupportedAudioResource({ sourceId: 'https://example.com/demo.flac' })).toBe(true);
    expect(isSupportedAudioResource({ sourceId: 'chips-resource://audio/1', mimeType: 'audio/mpeg' })).toBe(true);
    expect(isSupportedAudioResource({ sourceId: '/tmp/demo.txt' })).toBe(false);
  });

  it('resolves direct playable URIs, filenames, and companion selection', () => {
    expect(isDirectPlayableUri('https://example.com/demo.mp3')).toBe(true);
    expect(isDirectPlayableUri('blob:https://example.com/token')).toBe(true);
    expect(isDirectPlayableUri('/tmp/demo.mp3')).toBe(false);
    expect(resolveFileName('/tmp/audio/demo.flac')).toBe('demo.flac');
    expect(resolveFileName('https://example.com/audio/demo.m4a')).toBe('demo.m4a');
    expect(
      resolveFileSelection(['/tmp/audio/demo.flac', '/tmp/audio/cover.jpg', '/tmp/audio/lyrics.lrc']),
    ).toEqual({
      audioPath: '/tmp/audio/demo.flac',
      audioPaths: ['/tmp/audio/demo.flac'],
      coverPath: '/tmp/audio/cover.jpg',
      lyricsPath: '/tmp/audio/lyrics.lrc',
    });
    expect(resolveFileSelection(['/tmp/audio/a.mp3', '/tmp/audio/b.flac']).audioPaths).toEqual([
      '/tmp/audio/a.mp3',
      '/tmp/audio/b.flac',
    ]);
  });

  it('formats playback labels and clamps numeric values', () => {
    expect(formatDuration(5)).toBe('00:05');
    expect(formatDuration(3725)).toBe('01:02:05');
    expect(formatRemainingDuration(120, 15)).toBe('-01:45');
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampPlaybackTime(16, 12)).toBe(12);
    expect(clampPlaybackTime(-4, 12)).toBe(0);
  });

  it('infers titles, mime types, and auxiliary file types', () => {
    expect(resolveTrackTitle({ sourceId: '/tmp/demo.ogg', title: '演示音频' })).toBe('演示音频');
    expect(resolveTrackTitle({ sourceId: '/tmp/demo.ogg' })).toBe('demo.ogg');
    expect(inferAudioMimeType('/tmp/demo.webm')).toBe('audio/webm');
    expect(resolveAudioFormatLabel('/tmp/demo.webm')).toBe('WEBM');
    expect(resolveAudioFormatLabel('chips-resource://audio/1', 'audio/x-m4a')).toBe('M4A');
    expect(isAudioFilePath('/tmp/demo.flac')).toBe(true);
    expect(isImageFilePath('/tmp/cover.webp')).toBe(true);
    expect(isLyricsFilePath('/tmp/lyrics.txt')).toBe(true);
  });

  it('resolves path helpers for companion file discovery', () => {
    expect(resolveExtension('/tmp/audio/demo.FLAC')).toBe('.flac');
    expect(resolveStem('/tmp/audio/demo.flac')).toBe('demo');
    expect(resolveDirectoryPath('/tmp/audio/demo.flac')).toBe('/tmp/audio');
    expect(resolveDirectoryPath('demo.flac')).toBe('');
    expect(isLikelyLocalPath('/tmp/audio/demo.mp3')).toBe(true);
    expect(isLikelyLocalPath('https://example.com/demo.mp3')).toBe(false);
  });

  it('消费音乐卡片打开载荷形状（14-契约 §5.4，本地类型收口）', () => {
    const payload: IMusicCardOpenPayload = {
      kind: 'chips.music-card',
      version: '1.0.0',
      cardType: 'base.music',
      resources: {
        audio: { uri: 'chips-resource://pkg/audio.flac', relativePath: 'audio.flac' },
        cover: { uri: 'chips-resource://pkg/cover.png', relativePath: 'cover.png', mimeType: 'image/png' },
        lyrics: { uri: 'chips-resource://pkg/lyrics.lrc', relativePath: 'lyrics.lrc' },
      },
      display: { title: '夜曲', artist: '测试歌手' },
    };
    const target = {
      sourceId: payload.resources.audio.uri,
      title: payload.display.title,
      musicCard: payload,
    };
    expect(resolveTrackTitle(target)).toBe('夜曲');
  });
});
