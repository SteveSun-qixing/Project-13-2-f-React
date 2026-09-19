import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PAL_ERROR_CODES, type PalPortError } from '../src/platform/errors.js';
import { isPalPortError } from '../src/platform/errors.js';
import { createMacWindowPort, type MacWindowPortOptions } from '../src/platform/mac/window-port.js';
import { MockBrowserWindow } from './helpers/electron-mock.js';

/** 创建窗口的公共输入。 */
const WINDOW_INPUT = {
  title: '测试窗口',
  width: 1024,
  height: 720,
  url: 'chips-resource://platform/shell.html',
};

/** 创建窗口端口。 */
function createPort(options: MacWindowPortOptions = {}): ReturnType<typeof createMacWindowPort> {
  return createMacWindowPort({ BrowserWindow: MockBrowserWindow }, options);
}

/** 等待微任务与定时器推进。 */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('createMacWindowPort', () => {
  beforeEach(() => {
    MockBrowserWindow.reset();
  });

  afterEach(() => {
    MockBrowserWindow.reset();
  });

  describe('create', () => {
    it('should create a window and return the webContents id', async () => {
      const port = createPort();
      const created = await port.create(WINDOW_INPUT);

      const window = MockBrowserWindow.windows[0];
      expect(window).toBeDefined();
      expect(created.windowId).toBe(window?.webContents.id);
      expect(window?.options).toMatchObject({
        title: '测试窗口',
        width: 1024,
        height: 720,
        resizable: true,
        show: false,
      });
      expect(window?.lastLoadedUrl).toBe(WINDOW_INPUT.url);
    });

    it('should honor resizable: false', async () => {
      const port = createPort();
      await port.create({ ...WINDOW_INPUT, resizable: false });
      expect(MockBrowserWindow.windows[0]?.options.resizable).toBe(false);
    });

    it('should enforce the R17 security baseline over shell options', async () => {
      const port = createPort({
        windowOptions: () => ({
          webPreferences: {
            preload: '/app/preload.js',
            partition: 'persist:chips',
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            webSecurity: false,
          },
        }),
      });
      await port.create(WINDOW_INPUT);

      const preferences = MockBrowserWindow.windows[0]?.options.webPreferences;
      expect(preferences).toMatchObject({
        preload: '/app/preload.js',
        partition: 'persist:chips',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      });
    });

    it('should show the window after ready-to-show', async () => {
      const port = createPort();
      await port.create(WINDOW_INPUT);
      const window = MockBrowserWindow.windows[0];

      expect(window?.showCount).toBe(0);
      await flush();
      expect(window?.showCount).toBe(1);
    });

    it('should show immediately when the window cannot emit ready-to-show', async () => {
      const window = new MockBrowserWindow({ title: '无 once', width: 100, height: 100 });
      Object.defineProperty(window, 'once', { value: undefined, configurable: true });
      const ctor = class {
        static getAllWindows(): readonly MockBrowserWindow[] {
          return [window];
        }
        constructor() {
          return window;
        }
      };
      const port = createMacWindowPort({
        BrowserWindow: ctor as unknown as typeof MockBrowserWindow,
      });

      await port.create(WINDOW_INPUT);
      expect(window.showCount).toBe(1);
    });

    it('should destroy the window when loading fails', async () => {
      MockBrowserWindow.loadPlan = () => Promise.reject(new Error('load failed'));
      const port = createPort();

      await expect(port.create(WINDOW_INPUT)).rejects.toMatchObject({
        code: PAL_ERROR_CODES.WINDOW_OPERATION_FAILED,
      });
      expect(MockBrowserWindow.windows[0]?.isDestroyed()).toBe(true);
    });

    it('should not create a window when the call is aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const port = createPort();

      await expect(port.create({ ...WINDOW_INPUT, signal: controller.signal })).rejects.toMatchObject({
        code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
      });
      expect(MockBrowserWindow.windows).toHaveLength(0);
    });

    it('should not create a window when the deadline has passed', async () => {
      const port = createPort();
      await expect(port.create({ ...WINDOW_INPUT, deadline: Date.now() - 1 })).rejects.toMatchObject({
        code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
      });
      expect(MockBrowserWindow.windows).toHaveLength(0);
    });

    it('should fail with WINDOW_OPERATION_FAILED when the constructor throws', async () => {
      const failing = class {
        static getAllWindows(): readonly MockBrowserWindow[] {
          return [];
        }
        constructor() {
          throw new Error('constructor failed');
        }
      };
      const port = createMacWindowPort({
        BrowserWindow: failing as unknown as typeof MockBrowserWindow,
      });
      await expect(port.create(WINDOW_INPUT)).rejects.toMatchObject({
        code: PAL_ERROR_CODES.WINDOW_OPERATION_FAILED,
      });
    });
  });

  describe('list', () => {
    it('should summarize all live windows and skip destroyed ones', async () => {
      const port = createPort();
      const first = await port.create({ ...WINDOW_INPUT, title: '窗口一' });
      const second = await port.create({ ...WINDOW_INPUT, title: '窗口二' });
      MockBrowserWindow.windows[0]?.setTitle('窗口一-改');
      MockBrowserWindow.windows[1]?.destroy();

      const summaries = await port.list();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        windowId: first.windowId,
        title: '窗口一-改',
        state: 'normal',
        focused: false,
      });
      expect(second.windowId).toBeGreaterThan(first.windowId);
    });

    it('should report display state with fullscreen precedence', async () => {
      const port = createPort();
      await port.create(WINDOW_INPUT);
      const window = MockBrowserWindow.windows[0];

      window?.minimize();
      expect((await port.list())[0]?.state).toBe('minimized');

      window?.maximize();
      expect((await port.list())[0]?.state).toBe('maximized');

      window?.setFullScreen(true);
      expect((await port.list())[0]?.state).toBe('fullscreen');

      window?.focus();
      expect((await port.list())[0]?.focused).toBe(true);
    });
  });

  describe('window operations', () => {
    it('should focus, resize, move and retitle the window', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      const window = MockBrowserWindow.windows[0];

      await port.focus(windowId);
      await port.resize(windowId, { width: 1280, height: 800 });
      await port.move(windowId, { x: 120, y: 80 });
      await port.setTitle(windowId, '已保存');

      expect(window?.focused).toBe(true);
      expect(window?.size).toEqual({ width: 1280, height: 800 });
      expect(window?.position).toEqual({ x: 120, y: 80 });
      expect(window?.title).toBe('已保存');
    });

    it('should close the window', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      await port.close(windowId);
      expect(MockBrowserWindow.windows[0]?.isDestroyed()).toBe(true);
    });

    it('should apply every display state transition', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      const window = MockBrowserWindow.windows[0];

      await port.setState(windowId, 'fullscreen');
      expect(window?.fullscreen).toBe(true);

      await port.setState(windowId, 'maximized');
      expect(window?.fullscreen).toBe(false);
      expect(window?.maximized).toBe(true);

      await port.setState(windowId, 'minimized');
      expect(window?.minimized).toBe(true);

      await port.setState(windowId, 'normal');
      expect(window?.minimized).toBe(false);
      expect(window?.maximized).toBe(false);

      await port.setState(windowId, 'normal');
      expect(window?.isFullScreen()).toBe(false);
    });

    it('should fail with WINDOW_NOT_FOUND for unknown or destroyed windows', async () => {
      const port = createPort();
      await expect(port.focus(999)).rejects.toMatchObject({
        code: PAL_ERROR_CODES.WINDOW_NOT_FOUND,
        details: { windowId: 999 },
      });

      const { windowId } = await port.create(WINDOW_INPUT);
      MockBrowserWindow.windows[0]?.destroy();
      await expect(port.focus(windowId)).rejects.toMatchObject({
        code: PAL_ERROR_CODES.WINDOW_NOT_FOUND,
      });
    });

    it('should normalize unexpected operation failures', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      const window = MockBrowserWindow.windows[0];
      window!.setTitle = () => {
        throw new Error('native failure');
      };

      await expect(port.setTitle(windowId, 'x')).rejects.toMatchObject({
        code: PAL_ERROR_CODES.WINDOW_OPERATION_FAILED,
      });
    });

    it('should reject operations when the call deadline has passed', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      await expect(port.focus(windowId, { deadline: Date.now() - 1 })).rejects.toMatchObject({
        code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
      });
    });
  });

  describe('onSignal', () => {
    it('should emit focus and closed signals and stop after dispose', async () => {
      const port = createPort();
      const { windowId } = await port.create(WINDOW_INPUT);
      const signals: Array<{ kind: string; windowId: number }> = [];
      const subscription = port.onSignal((signal) => signals.push(signal));

      MockBrowserWindow.windows[0]?.focus();
      MockBrowserWindow.windows[0]?.close();
      expect(signals).toEqual([
        { kind: 'focused', windowId },
        { kind: 'closed', windowId },
      ]);

      subscription.dispose();
      subscription.dispose();
      MockBrowserWindow.windows[0]?.focus();
      expect(signals).toHaveLength(2);
    });
  });
});

describe('window port error normalization', () => {
  beforeEach(() => {
    MockBrowserWindow.reset();
  });

  it('should expose PalPortError with retryable semantics', async () => {
    const port = createPort();
    try {
      await port.focus(42);
      throw new Error('expected rejection');
    } catch (error) {
      expect(isPalPortError(error)).toBe(true);
      const portError = error as PalPortError;
      expect(portError.retryable).toBe(false);
      expect(portError.name).toBe('PalPortError');
      expect(typeof portError.message).toBe('string');
    }
  });

  it('should keep subscriptions isolated from each other', async () => {
    const port = createPort();
    await port.create(WINDOW_INPUT);
    const first = vi.fn();
    const second = vi.fn();
    const firstSubscription = port.onSignal(first);
    port.onSignal(second);

    MockBrowserWindow.windows[0]?.focus();
    firstSubscription.dispose();
    MockBrowserWindow.windows[0]?.focus();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
