import { describe, expect, it } from 'vitest';
import { guessMimeType } from '../../src/shared/mime';

describe('shared/mime 契约测试', () => {
  it('识别图片类型', () => {
    expect(guessMimeType('a.png')).toBe('image/png');
    expect(guessMimeType('a.jpg')).toBe('image/jpeg');
    expect(guessMimeType('a.jpeg')).toBe('image/jpeg');
    expect(guessMimeType('a.gif')).toBe('image/gif');
    expect(guessMimeType('a.webp')).toBe('image/webp');
    expect(guessMimeType('a.svg')).toBe('image/svg+xml');
    expect(guessMimeType('a.bmp')).toBe('image/bmp');
    expect(guessMimeType('a.avif')).toBe('image/avif');
    expect(guessMimeType('a.tiff')).toBe('image/tiff');
    expect(guessMimeType('a.tif')).toBe('image/tiff');
  });

  it('识别文档类型', () => {
    expect(guessMimeType('a.html')).toBe('text/html');
    expect(guessMimeType('a.htm')).toBe('text/html');
    expect(guessMimeType('a.css')).toBe('text/css');
    expect(guessMimeType('a.js')).toBe('text/javascript');
    expect(guessMimeType('a.json')).toBe('application/json');
    expect(guessMimeType('a.yaml')).toBe('application/yaml');
    expect(guessMimeType('a.yml')).toBe('application/yaml');
    expect(guessMimeType('a.pdf')).toBe('application/pdf');
    expect(guessMimeType('a.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(guessMimeType('a.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(guessMimeType('a.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(guessMimeType('a.csv')).toBe('text/csv');
    expect(guessMimeType('a.txt')).toBe('text/plain');
    expect(guessMimeType('a.md')).toBe('text/markdown');
  });

  it('识别媒体类型', () => {
    expect(guessMimeType('a.mp4')).toBe('video/mp4');
    expect(guessMimeType('a.webm')).toBe('video/webm');
    expect(guessMimeType('a.mp3')).toBe('audio/mpeg');
    expect(guessMimeType('a.wav')).toBe('audio/wav');
  });

  it('大小写不敏感', () => {
    expect(guessMimeType('A.PNG')).toBe('image/png');
    expect(guessMimeType('a/Deep/Path/Photo.JPEG')).toBe('image/jpeg');
  });

  it('未知类型回退 octet-stream', () => {
    expect(guessMimeType('a.unknown')).toBe('application/octet-stream');
    expect(guessMimeType('noextension')).toBe('application/octet-stream');
  });

  it('忽略 URL 查询参数和片段', () => {
    expect(guessMimeType('https://example.test/report.xlsx?download=1#sheet')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});
