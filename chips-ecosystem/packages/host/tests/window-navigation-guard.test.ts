/**
 * 工单043-A4 §四.6 导航拦截位锁测：新窗口全拒 + 导航地址白名单。
 *
 * @remarks
 * - 覆盖面：{@link attachWindowNavigationGuards} 两臂逐项呈现——`setWindowOpenHandler`
 *   无放行分支（任何地址一律 `{ action: 'deny' }` + warn 留痕）；`will-navigate` 只放行
 *   `isAllowedWindowLoadUrl` 认可的 `chips-resource://` URI，其余 `preventDefault`。
 * - 缺位臂：切片两法任一缺位（测试替身面）即跳过挂接、不抛不误记诊断——真实路径由
 *   `electron-adapter.ts` 恒供两法，缺原始方法即抛 `HostStartupError`。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  NAVIGATION_GUARD_DIAGNOSTIC_SCOPE,
  attachWindowNavigationGuards,
} from '../src/main/window-navigation-guard.js';
import type { ShellNavigationEvent, ShellWebContents } from '../src/main/shell-api.js';
import { FakeSession, FakeWebContents } from './helpers/shell-electron.js';

interface SpyDiagnostics {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function createDiagnostics(): SpyDiagnostics {
  return { warn: vi.fn(), error: vi.fn() };
}

function createContents(id = 21): FakeWebContents {
  return new FakeWebContents(id, new FakeSession(`w-${String(id)}`));
}

/** 挂接两法皆缺位的裸切片（只可能是测试替身面）。 */
function bareContents(id: number): ShellWebContents {
  return {
    id,
    session: new FakeSession(`w-${String(id)}`),
    isDestroyed(): boolean {
      return false;
    },
    send(): void {
      return undefined;
    },
    close(): void {
      return undefined;
    },
    onDestroyed(): void {
      return undefined;
    },
  };
}

/** 拦截位挂接后的替身：可直接触发两条被拦通道。 */
function attach(id: number): { contents: FakeWebContents; diagnostics: SpyDiagnostics } {
  const contents = createContents(id);
  const diagnostics = createDiagnostics();
  attachWindowNavigationGuards(contents, diagnostics);
  return { contents, diagnostics };
}

function navigationEvent(): { event: ShellNavigationEvent; prevented: () => boolean } {
  let prevented = false;
  return {
    event: {
      preventDefault(): void {
        prevented = true;
      },
    },
    prevented: () => prevented,
  };
}

describe('attachWindowNavigationGuards：新窗口请求全拒臂', () => {
  it('注册处置器：任何地址的请求一律 deny 并留 windowId + url 诊断', () => {
    const { contents, diagnostics } = attach(31);
    const handler = contents.windowOpenHandler;
    expect(handler).toBeTypeOf('function');
    if (handler === null) {
      throw new Error('处置器未注册');
    }
    const blocked = [
      'https://evil.example.com/pop',
      'file:///tmp/local.html',
      'chips-resource://platform/shell.html',
      'data:text/html,hi',
      'about:blank',
      '',
    ];
    for (const url of blocked) {
      expect(handler({ url }), url).toEqual({ action: 'deny' });
      expect(diagnostics.warn).toHaveBeenCalledWith(NAVIGATION_GUARD_DIAGNOSTIC_SCOPE, '拒绝渲染进程发起的新窗口请求', {
        windowId: 31,
        url,
        reason: 'window-open-denied',
      });
    }
    expect(diagnostics.warn).toHaveBeenCalledTimes(blocked.length);
    expect(diagnostics.error).not.toHaveBeenCalled();
  });

  it('替身通道：openWindow 端到端回 deny 回执', () => {
    const { contents } = attach(32);
    expect(contents.openWindow('https://evil.example.com/pop')).toEqual({ action: 'deny' });
  });
});

describe('attachWindowNavigationGuards：导航白名单臂', () => {
  it('chips-resource:// 放行：不 preventDefault、不记诊断', () => {
    const { contents, diagnostics } = attach(33);
    const { event, prevented } = navigationEvent();
    const handler = contents.windowOpenHandler;
    expect(handler).toBeTypeOf('function');
    // 直接以事件对象驱动监听器：放行臂必须既不拦截也不留痕。
    contents.emit('will-navigate', event, 'chips-resource://platform/shell.html');
    expect(prevented()).toBe(false);
    expect(contents.navigate('chips-resource://card-1/a.card').prevented).toBe(false);
    expect(contents.navigate('chips-resource://box-2/b.box').prevented).toBe(false);
    expect(diagnostics.warn).not.toHaveBeenCalled();
  });

  it('白名单外地址逐个拦截：https / http / file / 裸路径 / about / data / 越权 scheme / 空串', () => {
    const { contents, diagnostics } = attach(34);
    for (const url of [
      'https://evil.example.com/x',
      'http://evil.example.com/x',
      'file:///tmp/x.html',
      '/local/path.html',
      'about:blank',
      'data:text/html,<script>',
      'chrome://settings',
      'chips-resource://platform/../etc/passwd',
      '',
    ]) {
      const { prevented } = contents.navigate(url);
      expect(prevented, url).toBe(true);
      expect(diagnostics.warn).toHaveBeenCalledWith(NAVIGATION_GUARD_DIAGNOSTIC_SCOPE, '拦截非白名单窗口导航', {
        windowId: 34,
        url,
        reason: 'navigation-not-allowed',
      });
    }
    expect(diagnostics.error).not.toHaveBeenCalled();
  });

  it('拦截只作用被拦地址：拦后再放白名单地址仍正常放行', () => {
    const { contents } = attach(38);
    expect(contents.navigate('https://evil.example.com/y').prevented).toBe(true);
    expect(contents.navigate('chips-resource://platform/shell.html').prevented).toBe(false);
  });
});

describe('attachWindowNavigationGuards：切片缺位跳过臂（仅测试替身面）', () => {
  it('两法皆缺位：不挂接、不抛出、不记诊断', () => {
    const diagnostics = createDiagnostics();
    expect(() => attachWindowNavigationGuards(bareContents(35), diagnostics)).not.toThrow();
    expect(diagnostics.warn).not.toHaveBeenCalled();
    expect(diagnostics.error).not.toHaveBeenCalled();
  });

  it('只缺 onWillNavigate：同样跳过挂接（不留下半截拦截位）', () => {
    const diagnostics = createDiagnostics();
    attachWindowNavigationGuards(
      {
        ...bareContents(36),
        setWindowOpenHandler(): void {
          throw new Error('半截挂接不得发生');
        },
      },
      diagnostics,
    );
    expect(diagnostics.warn).not.toHaveBeenCalled();
  });

  it('挂接抛错如实上抛：由绑定器 fail-closed 关窗（见 web-contents-binder 锁测）', () => {
    const contents = createContents(37);
    contents.setWindowOpenHandler = (): void => {
      throw new Error('处置器注册不可用');
    };
    expect(() => attachWindowNavigationGuards(contents, createDiagnostics())).toThrow('处置器注册不可用');
  });
});
