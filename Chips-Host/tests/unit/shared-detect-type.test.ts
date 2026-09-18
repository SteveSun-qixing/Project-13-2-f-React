import { describe, expect, it } from 'vitest';
import { detectTypeByPath } from '../../src/shared/detect-type';

describe('shared/detect-type 契约测试', () => {
  it('识别 .card 文件', () => {
    expect(detectTypeByPath('/tmp/hello.card')).toEqual({
      documentType: 'card',
      mimeType: 'application/vnd.chips.card+zip',
      category: 'document',
      extension: 'card',
      size: null,
    });
  });

  it('识别 .box 文件', () => {
    expect(detectTypeByPath('/tmp/hello.box')).toEqual({
      documentType: 'box',
      mimeType: 'application/vnd.chips.box+zip',
      category: 'document',
      extension: 'box',
      size: null,
    });
  });

  it('大小写不敏感识别文档', () => {
    expect(detectTypeByPath('/tmp/Hello.CARD').documentType).toBe('card');
    expect(detectTypeByPath('/tmp/Hello.Box').documentType).toBe('box');
  });

  it('识别图片', () => {
    expect(detectTypeByPath('/tmp/a.png')).toEqual({
      documentType: null,
      mimeType: 'image/png',
      category: 'image',
      extension: 'png',
      size: null,
    });
    expect(detectTypeByPath('/tmp/a.jpeg').category).toBe('image');
  });

  it('识别视频与音频', () => {
    expect(detectTypeByPath('/tmp/a.mp4').category).toBe('video');
    expect(detectTypeByPath('/tmp/a.mov').category).toBe('video');
    expect(detectTypeByPath('/tmp/a.mp3').category).toBe('audio');
    expect(detectTypeByPath('/tmp/a.m4a').category).toBe('audio');
  });

  it('识别 html 与文本', () => {
    expect(detectTypeByPath('/tmp/a.html')).toEqual({
      documentType: null,
      mimeType: 'text/html',
      category: 'html',
      extension: 'html',
      size: null,
    });
    expect(detectTypeByPath('/tmp/a.md').category).toBe('text');
  });

  it('识别 office 与 pdf 为 document', () => {
    expect(detectTypeByPath('/tmp/a.pdf').category).toBe('document');
    expect(detectTypeByPath('/tmp/a.docx').category).toBe('document');
    expect(detectTypeByPath('/tmp/a.doc').category).toBe('document');
    expect(detectTypeByPath('/tmp/a.pptx').documentType).toBe('slide');
    expect(detectTypeByPath('/tmp/a.xlsx').documentType).toBe('sheet');
    expect(detectTypeByPath('/tmp/a.xlsx').category).toBe('document');
    expect(detectTypeByPath('/tmp/a.pdf', 128).size).toBe(128);
  });

  it('识别压缩包为 archive', () => {
    expect(detectTypeByPath('/tmp/a.zip').category).toBe('archive');
    expect(detectTypeByPath('/tmp/a.cpk').category).toBe('archive');
  });

  it('未知类型回退 unknown', () => {
    expect(detectTypeByPath('/tmp/a.xyz')).toEqual({
      documentType: null,
      mimeType: 'application/octet-stream',
      category: 'unknown',
      extension: 'xyz',
      size: null,
    });
  });
});
