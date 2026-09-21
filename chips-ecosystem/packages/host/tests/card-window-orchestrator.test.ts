/**
 * 卡片窗口编排器单测（金链路刀4 / 任务 #100）。
 *
 * 权威：`05-渲染引擎设计` §3.1（渲染进程入口与安全基线）、§9.1（帧入口装载 URI 无
 * query / fragment）；`17-跨端Shell与平台抽象设计` §2.4（唯一窗口通道）。
 *
 * @remarks
 * - 走真实 `ShellWindowManager → WebContentsBinder → WindowRegistry` 链路 +
 *   Electron 替身（`tests/helpers/shell-electron.ts`），断言编排器只经唯一窗口通道。
 * - `fake.failLoadURL(CARD_WINDOW_ENTRY_URL)` 反证装载地址：编排器创建的窗口确实
 *   以登记入口 URI 执行 `loadURL`。
 */

import { describe, expect, it, vi } from 'vitest';

import { CardWindowOrchestrator } from '../src/main/card-window-orchestrator.js';
import { CARD_WINDOW_ENTRY_URL, PLATFORM_ENTRY_URLS } from '../src/main/window-entries.js';
import { ShellWindowManager } from '../src/main/window-manager.js';
import { WebContentsBinder } from '../src/main/web-contents-binder.js';
import { WindowBindings } from '../src/main/window-bindings.js';
import { WindowRegistry } from '../src/main/window-registry.js';
import { createElectronRuntime } from '../src/main/electron-adapter.js';
import { HostApplication } from '../src/main/application.js';
import { parseResourceUri } from '../src/protocol/resource-uri.js';
import { ChipsError } from '../src/preload/chips-error.js';
import type { IResourceBackend } from '../src/runtime/contracts.js';
import { createFakeElectron, type FakeBrowserWindow } from './helpers/shell-electron.js';
import { createWireError } from './helpers/wire-error.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';

const backend: IResourceBackend = {
  async read() {
    return Promise.reject(createWireError('RESOURCE_NOT_FOUND', '资源不存在'));
  },
};

interface Harness {
  readonly manager: ShellWindowManager;
  readonly orchestrator: CardWindowOrchestrator;
  readonly registry: WindowRegistry;
  readonly fake: ReturnType<typeof createFakeElectron>;
  readonly diagnostics: { warn: Mock; error: Mock };
}

type Mock = ReturnType<typeof vi.fn>;

function createHarness(): Harness {
  const fake = createFakeElectron();
  const runtime = createElectronRuntime(fake.module);
  const registry = new WindowRegistry();
  const diagnostics = { warn: vi.fn(), error: vi.fn() };
  const binder = new WebContentsBinder({
    registry,
    bindings: new WindowBindings(),
    backend,
    diagnostics,
    onClosed: () => undefined,
  });
  const manager = new ShellWindowManager({
    factory: runtime.windowFactory,
    preloadPath: '/app/dist/preload/index.js',
    binder,
    registry,
    diagnostics,
  });
  const orchestrator = new CardWindowOrchestrator({
    windowManager: manager,
    registry,
    diagnostics,
    now: () => 1_727_000_000_000,
  });
  return { manager, orchestrator, registry, fake, diagnostics };
}

function preferencesOf(window: FakeBrowserWindow): Record<string, unknown> {
  return window.options['webPreferences'] as Record<string, unknown>;
}

describe('CardWindowOrchestrator.open', () => {
  it('经唯一窗口通道创建卡片窗口并登记 windowId ↔ source', async () => {
    const { orchestrator, fake } = createHarness();
    const record = await orchestrator.open({ source: 'chips-resource://platform/documents/demo.card' });
    expect(fake.windows).toHaveLength(1);
    const window = fake.windows[0]!;
    expect(record.windowId).toBe(window.webContents.id);
    expect(record.source).toBe('chips-resource://platform/documents/demo.card');
    expect(record.entryUrl).toBe(CARD_WINDOW_ENTRY_URL);
    expect(record.openedAt).toBe(1_727_000_000_000);
    expect(window.options['title']).toBe('薯片 · 卡片');
    expect(window.options['width']).toBe(480);
    expect(window.options['height']).toBe(720);
    expect(orchestrator.list()).toEqual([record]);
    expect(orchestrator.find(record.source)).toBe(record);
    expect(orchestrator.sourceOf(record.windowId)).toBe(record.source);
    expect(orchestrator.find('chips-resource://platform/documents/absent.card')).toBeNull();
    expect(orchestrator.sourceOf(9999)).toBeNull();
  });

  it('装载地址锁定：窗口以登记入口 URI 执行 loadURL（失败注入反证）', async () => {
    const { orchestrator, fake } = createHarness();
    fake.failLoadURL(CARD_WINDOW_ENTRY_URL);
    await expect(orchestrator.open({ source: '/Users/tester/Documents/a.card' })).rejects.toThrow('壳窗口加载失败');
    expect(orchestrator.list()).toHaveLength(0);
  });

  it('同一 source 重复打开只前置不新建', async () => {
    const { orchestrator, fake } = createHarness();
    const source = 'chips-resource://platform/documents/dup.card';
    const first = await orchestrator.open({ source });
    const shownAfterCreate = fake.windows[0]!.shown;
    const again = await orchestrator.open({ source });
    expect(again).toBe(first);
    expect(fake.windows).toHaveLength(1);
    expect(fake.windows[0]!.shown).toBe(shownAfterCreate + 1);
  });

  it('不同 source 各自开窗口并分配独立 partition 与安全基线', async () => {
    const { orchestrator, fake } = createHarness();
    await orchestrator.open({ source: 'chips-resource://platform/documents/a.card' });
    await orchestrator.open({ source: 'chips-resource://platform/documents/b.card' });
    expect(fake.windows).toHaveLength(2);
    const partitions = fake.windows.map((window) => preferencesOf(window)['partition']);
    expect(new Set(partitions).size).toBe(2);
    for (const window of fake.windows) {
      const preferences = preferencesOf(window);
      expect(preferences['preload']).toBe('/app/dist/preload/index.js');
      expect(preferences['sandbox']).toBe(true);
      expect(preferences['contextIsolation']).toBe(true);
      expect(preferences['nodeIntegration']).toBe(false);
    }
  });

  it('自定义标题与尺寸透传窗口创建参数', async () => {
    const { orchestrator, fake } = createHarness();
    await orchestrator.open({ source: 'x.card', title: '薯片 · 预览', width: 640, height: 800 });
    const window = fake.windows[0]!;
    expect(window.options['title']).toBe('薯片 · 预览');
    expect(window.options['width']).toBe(640);
    expect(window.options['height']).toBe(800);
  });
});

describe('CardWindowOrchestrator 生命周期', () => {
  it('窗口销毁自动解绑，同 source 可再次打开', async () => {
    const { orchestrator, fake } = createHarness();
    const source = 'chips-resource://platform/documents/destroy.card';
    const record = await orchestrator.open({ source });
    fake.windows[0]!.webContents.destroy();
    expect(orchestrator.list()).toHaveLength(0);
    expect(orchestrator.find(source)).toBeNull();
    const reopened = await orchestrator.open({ source });
    expect(reopened.windowId).not.toBe(record.windowId);
    expect(fake.windows).toHaveLength(2);
  });

  it('close 对已登记窗口发起关闭；未登记 / 已销毁返回 false', async () => {
    const { orchestrator, fake } = createHarness();
    const record = await orchestrator.open({ source: 'chips-resource://platform/documents/close.card' });
    expect(orchestrator.close(9999)).toBe(false);
    expect(orchestrator.close(record.windowId)).toBe(true);
    expect(fake.windows[0]!.closed).toBe(1);
    fake.windows[0]!.webContents.destroy();
    expect(orchestrator.close(record.windowId)).toBe(false);
  });

  it('close 触发销毁事件后完成解绑', async () => {
    const { orchestrator, fake } = createHarness();
    const record = await orchestrator.open({ source: 'chips-resource://platform/documents/close2.card' });
    fake.windows[0]!.destroy();
    expect(orchestrator.find(record.source)).toBeNull();
    expect(orchestrator.list()).toHaveLength(0);
  });

  it('focus 对未登记窗口返回 false；登记窗口 show 前置', async () => {
    const { orchestrator, fake } = createHarness();
    const record = await orchestrator.open({ source: 'chips-resource://platform/documents/focus.card' });
    expect(orchestrator.focus(9999)).toBe(false);
    const before = fake.windows[0]!.shown;
    expect(orchestrator.focus(record.windowId)).toBe(true);
    expect(fake.windows[0]!.shown).toBe(before + 1);
  });
});

describe('CardWindowOrchestrator 来源引用校验', () => {
  const invalidCases: readonly [string, string][] = [
    ['空串', ''],
    ['全空白', '   '],
    ['含空白字符', 'chips-resource://platform/do cs.card'],
    ['超长', `chips-resource://platform/${'a'.repeat(4096)}.card`],
    ['managed scope 带 query', 'chips-resource://platform/documents/a.card?x=1'],
    ['managed scope 带 fragment', 'chips-resource://platform/documents/a.card#frag'],
  ];

  it.each(invalidCases)('%s 拒绝且不开窗口', async (_label, source) => {
    const { orchestrator, fake } = createHarness();
    await expect(orchestrator.open({ source })).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === 'BRIDGE_INVALID_INPUT',
    );
    expect(fake.windows).toHaveLength(0);
    expect(orchestrator.list()).toHaveLength(0);
  });

  it('非 chips-resource 形态（本地路径引用）语法放行：合法性裁决归文档服务', async () => {
    const { orchestrator } = createHarness();
    const record = await orchestrator.open({ source: '/Users/tester/Documents/我的卡片.card' });
    expect(orchestrator.find('/Users/tester/Documents/我的卡片.card')).toBe(record);
  });

  it('窗口创建与登记之间无第二套通道痕迹：编排器不暴露窗口创建/工厂面', () => {
    const { orchestrator } = createHarness();
    const exposed = orchestrator as unknown as Record<string, unknown>;
    expect(exposed['createWindow']).toBeUndefined();
    expect(exposed['factory']).toBeUndefined();
    expect(exposed['registry']).toBeUndefined();
    expect(exposed['windowManager']).toBeUndefined();
  });
});

describe('入口注册表（主进程侧）', () => {
  it('卡片窗口入口 URI 冻结且为合法资源 URI（无 query / fragment）', () => {
    expect(PLATFORM_ENTRY_URLS.card).toBe('chips-resource://platform/entries/card.html');
    expect(CARD_WINDOW_ENTRY_URL).toBe(PLATFORM_ENTRY_URLS.card);
    const parsed = parseResourceUri(CARD_WINDOW_ENTRY_URL);
    expect(parsed.ok).toBe(true);
  });

  it('帧入口 URI 冻结', () => {
    expect(PLATFORM_ENTRY_URLS.frame).toBe('chips-resource://platform/entries/frame.html');
  });
});

describe('HostApplication.cardWindowOrchestrator 缝口', () => {
  async function startApplication(): Promise<{
    application: HostApplication;
    fake: ReturnType<typeof createFakeElectron>;
  }> {
    const fake = createFakeElectron();
    const application = new HostApplication({
      electron: createElectronRuntime(fake.module),
      palHost: createFakePalHost(),
      runtime: createFakeRuntime().runtime,
      preloadPath: '/app/dist/preload/index.js',
      bootstrapWindow: { title: '薯片' },
      diagnostics: { warn: vi.fn(), error: vi.fn() },
    });
    await application.start();
    return { application, fake };
  }

  it('组合根暴露稳定编排器实例且与壳共用窗口通道统计', async () => {
    const { application, fake } = await startApplication();
    const orchestrator = application.cardWindowOrchestrator;
    expect(orchestrator).toBeDefined();
    expect(application.cardWindowOrchestrator).toBe(orchestrator);
    const record = await orchestrator.open({ source: 'chips-resource://platform/documents/app.card' });
    expect(fake.windows).toHaveLength(2);
    expect(application.windows.isAlive(record.windowId)).toBe(true);
    expect(application.windows.size).toBe(2);
  });
});
