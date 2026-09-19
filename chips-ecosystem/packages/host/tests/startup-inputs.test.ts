import { describe, expect, it } from 'vitest';

import { parseStartupInputs, StartupInputQueue, WORKSPACE_SWITCH_PREFIX } from '../src/main/startup-inputs.js';

describe('parseStartupInputs', () => {
  it('把普通参数解析为打开请求并归一相对路径', () => {
    const inputs = parseStartupInputs(['./cards/a.card', '/tmp/b.box'], '/work');
    expect(inputs).toEqual([
      { kind: 'open', path: '/work/cards/a.card' },
      { kind: 'open', path: '/tmp/b.box' },
    ]);
  });

  it('解析 --workspace= 开关', () => {
    expect(parseStartupInputs([`${WORKSPACE_SWITCH_PREFIX}./dev`], '/work')).toEqual([
      { kind: 'workspace', path: '/work/dev' },
    ]);
    expect(parseStartupInputs(['--workspace='], '/work')).toEqual([]);
    expect(parseStartupInputs(['--workspace=   '], '/work')).toEqual([]);
  });

  it('忽略未知开关与空参数', () => {
    expect(parseStartupInputs(['--inspect', '-psn_0_1', '', '--flag=1'], '/work')).toEqual([]);
  });
});

describe('StartupInputQueue', () => {
  it('按 FIFO 取队并清空', () => {
    const queue = new StartupInputQueue();
    queue.push([{ kind: 'open', path: '/a' }]);
    queue.push([
      { kind: 'workspace', path: '/w' },
      { kind: 'open', path: '/b' },
    ]);
    expect(queue.size).toBe(3);
    expect(queue.drain()).toEqual([
      { kind: 'open', path: '/a' },
      { kind: 'workspace', path: '/w' },
      { kind: 'open', path: '/b' },
    ]);
    expect(queue.size).toBe(0);
    expect(queue.drain()).toEqual([]);
  });
});
