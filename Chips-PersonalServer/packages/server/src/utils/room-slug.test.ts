import { describe, expect, it } from 'vitest';
import { createRoomSlugBase } from './room-slug';

describe('createRoomSlugBase', () => {
  it('normalizes spaces and casing', () => {
    expect(createRoomSlugBase('My First Room')).toBe('my-first-room');
  });

  it('drops unsupported characters and falls back safely', () => {
    expect(createRoomSlugBase('###')).toBe('room');
    expect(createRoomSlugBase('中文 Room !!!')).toBe('room');
  });

  it('keeps underscores and hyphens while trimming duplicates', () => {
    expect(createRoomSlugBase('alpha___beta---gamma')).toBe('alpha___beta-gamma');
  });
});
