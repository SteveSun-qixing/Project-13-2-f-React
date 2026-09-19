import { describe, expect, it } from 'vitest';

import { constantName, findNameCollisions } from '../src/naming.js';

describe('constantName', () => {
  it('转换冒号、连字符与驼峰', () => {
    expect(constantName('file:read')).toBe('FILE_READ');
    expect(constantName('cli:task-active')).toBe('CLI_TASK_ACTIVE');
    expect(constantName('window:setTitle')).toBe('WINDOW_SET_TITLE');
    expect(constantName('shell:openExternal')).toBe('SHELL_OPEN_EXTERNAL');
    expect(constantName('BRIDGE_TIMEOUT')).toBe('BRIDGE_TIMEOUT');
  });
});

describe('findNameCollisions', () => {
  it('检测冲突', () => {
    expect(findNameCollisions(['window:setTitle', 'window:set-title'])).toEqual([
      { name: 'WINDOW_SET_TITLE', ids: ['window:setTitle', 'window:set-title'] },
    ]);
    expect(findNameCollisions(['file:read', 'file:write'])).toEqual([]);
  });
});
