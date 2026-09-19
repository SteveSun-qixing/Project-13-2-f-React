import type { Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import {
  expectContentDigest,
  expectFrameContainsText,
  expectRevisionAdvanced,
  expectWindowList,
  isChipsErrorCode,
  listWindows,
  waitForWindow,
  type RenderFrameHandle,
  type WindowInfo,
} from '../src';

const WINDOWS: readonly WindowInfo[] = [
  { windowId: 1, title: '壳窗口', state: 'normal', focused: true },
  { windowId: 2, title: 'E2E 最小富文本卡片 - 查看', state: 'normal', focused: false },
];

function fakePageWithWindows(provider: () => unknown): Page {
  return { evaluate: vi.fn(() => Promise.resolve(provider())) } as unknown as Page;
}

describe('断言工具', () => {
  it('识别结构化桥接错误码', () => {
    expect(isChipsErrorCode({ code: 'BRIDGE_PERMISSION_DENIED' })).toBe(true);
    expect(isChipsErrorCode({ code: 'BRIDGE_PERMISSION_DENIED' }, 'BRIDGE_PERMISSION_DENIED')).toBe(
      true
    );
    expect(isChipsErrorCode({ code: 'BRIDGE_PERMISSION_DENIED' }, 'DOCUMENT_NOT_OPEN')).toBe(false);
    expect(isChipsErrorCode({ code: 'not-a-code' })).toBe(false);
    expect(isChipsErrorCode(new Error('boom'))).toBe(false);
    expect(isChipsErrorCode(null)).toBe(false);
  });

  it('读取窗口列表并按条件轮询', async () => {
    const page = fakePageWithWindows(() => ({ windows: WINDOWS }));
    const windows = await listWindows(page);
    expect(windows).toHaveLength(2);

    let polls = 0;
    const delayedPage = fakePageWithWindows(() => {
      polls += 1;
      return { windows: polls >= 2 ? WINDOWS : [WINDOWS[0]] };
    });
    const matched = await waitForWindow(delayedPage, (item) => item.title.includes('卡片'), {
      timeoutMs: 2_000,
    });
    expect(matched.windowId).toBe(2);
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it('窗口条件不满足时超时并给出阶段信息', async () => {
    const page = fakePageWithWindows(() => ({ windows: [WINDOWS[0]] }));
    await expect(
      waitForWindow(page, (item) => item.title.includes('不存在'), { timeoutMs: 300 })
    ).rejects.toThrow(/等待窗口出现/);
  });

  it('窗口列表断言覆盖数量、标题与状态', async () => {
    const page = fakePageWithWindows(() => ({ windows: WINDOWS }));
    await expectWindowList(page, { minimum: 2, titleContains: '卡片', state: 'normal' });
    await expect(expectWindowList(page, { minimum: 3 })).rejects.toThrow();
    await expect(expectWindowList(page, { titleContains: '不存在的标题' })).rejects.toThrow();
  });

  it('帧文本断言支持轮询命中', async () => {
    let polls = 0;
    const handle = {
      page: fakePageWithWindows(() => ({})),
      frame: { index: 0, src: 'frame.html', sandbox: ['allow-scripts'], width: 600, height: 120 },
      frameLocator: {
        locator: () => ({
          innerText: () => {
            polls += 1;
            return Promise.resolve(polls >= 2 ? '正文内容：E2E' : '');
          },
        }),
      },
    } as unknown as RenderFrameHandle;
    await expectFrameContainsText(handle, 'E2E', { timeoutMs: 2_000 });
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it('摘要与修订号断言', () => {
    const digest = `sha256:${'a'.repeat(64)}`;
    expect(() => expectContentDigest(digest)).not.toThrow();
    expect(() => expectContentDigest('sha256:short')).toThrow();
    expect(() => expectRevisionAdvanced(1, 2)).not.toThrow();
    expect(() => expectRevisionAdvanced(2, 2)).toThrow();
  });
});
