/**
 * 正式应用启动编排单测（金链路刀4 / 任务 #100）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、ADR-002 §进程模型。
 *
 * @remarks 壳启动（`startHostMain`）与组合根（`createProductionAssembly`）以模块替身
 * 承载，本套件只裁决启动参数解析、PAL 工厂形态与卡片窗口装载编排三条启动语义。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startHostMain: vi.fn(),
  createProductionAssembly: vi.fn(),
  createMacPalHost: vi.fn(),
}));

vi.mock('../src/main/main.js', () => ({ startHostMain: mocks.startHostMain }));
vi.mock('../src/main/production-assembly.js', () => ({
  createProductionAssembly: mocks.createProductionAssembly,
}));
vi.mock('../src/platform/mac/index.js', () => ({ createMacPalHost: mocks.createMacPalHost }));

import { OPEN_CARD_FLAG, createAppPalHost, launchHostApplication, parseAppLaunchArgs } from '../src/main/app-launch.js';
import type { PalHostContext } from '../src/main/runtime-provider.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

interface HandleStub {
  readonly handle: { application: unknown; quit: ReturnType<typeof vi.fn> };
  readonly open: ReturnType<typeof vi.fn>;
}

function createHandleStub(): HandleStub {
  const open = vi.fn().mockResolvedValue(undefined);
  return {
    handle: { application: { cardWindowOrchestrator: { open } }, quit: vi.fn() },
    open,
  };
}

const context: PalHostContext = {
  userDataPath: '/Users/tester/Library/Application Support/Chips',
  preloadPath: '/app/dist/preload/index.js',
  platformRoot: '/app/dist/renderer',
};

beforeEach(() => {
  mocks.startHostMain.mockReset();
  mocks.createProductionAssembly.mockReset();
  mocks.createMacPalHost.mockReset();
  mocks.createProductionAssembly.mockReturnValue({ assembly: true });
});

describe('parseAppLaunchArgs', () => {
  it('旗标常量为 --chips-open-card', () => {
    expect(OPEN_CARD_FLAG).toBe('--chips-open-card');
  });

  it('空参数返回空序列', () => {
    expect(parseAppLaunchArgs([])).toEqual([]);
  });

  it('支持 `<flag> <值>` 与 `<flag>=<值>` 两种形态并按出现顺序收集', () => {
    expect(
      parseAppLaunchArgs([
        '--flag-other',
        OPEN_CARD_FLAG,
        '/docs/a.card',
        `${OPEN_CARD_FLAG}=/docs/b.card`,
        'positional',
        OPEN_CARD_FLAG,
        'chips-resource://platform/docs/c.card',
      ]),
    ).toEqual(['/docs/a.card', '/docs/b.card', 'chips-resource://platform/docs/c.card']);
  });

  it('旗标后紧跟另一旗标或终止于末尾时不消费值', () => {
    expect(parseAppLaunchArgs([OPEN_CARD_FLAG, '--chips-open-card-x'])).toEqual([]);
    expect(parseAppLaunchArgs([OPEN_CARD_FLAG])).toEqual([]);
    expect(parseAppLaunchArgs([`${OPEN_CARD_FLAG}=`])).toEqual([]);
  });
});

describe('createAppPalHost', () => {
  it('每窗口独立 chips-window-pal-<n> partition 并透传 preload 路径', () => {
    const electronModule = { marker: true };
    mocks.createMacPalHost.mockReturnValue({ palHost: true });
    const host = createAppPalHost(electronModule, context);
    expect(host).toEqual({ palHost: true });
    expect(mocks.createMacPalHost).toHaveBeenCalledTimes(1);
    const [moduleArg, optionsArg] = mocks.createMacPalHost.mock.calls[0] as [
      unknown,
      { windowOptions: () => { webPreferences: Record<string, unknown> } },
    ];
    expect(moduleArg).toBe(electronModule);
    expect(optionsArg.windowOptions()).toEqual({
      webPreferences: { preload: context.preloadPath, partition: 'chips-window-pal-1' },
    });
    expect(optionsArg.windowOptions()).toEqual({
      webPreferences: { preload: context.preloadPath, partition: 'chips-window-pal-2' },
    });
  });
});

describe('launchHostApplication', () => {
  const baseOptions = {
    electronModule: {},
    preloadPath: '/app/dist/preload/index.js',
    platformRoot: '/app/dist/renderer',
  };

  interface DiagnosticsProbe {
    readonly sink: DiagnosticsSink;
    readonly warnCalls: unknown[][];
    readonly errorCalls: unknown[][];
  }

  function createDiagnostics(): DiagnosticsProbe {
    const warnCalls: unknown[][] = [];
    const errorCalls: unknown[][] = [];
    return {
      sink: {
        warn: (...args: unknown[]) => {
          warnCalls.push(args);
        },
        error: (...args: unknown[]) => {
          errorCalls.push(args);
        },
      },
      warnCalls,
      errorCalls,
    };
  }

  it('经生产组合根启动壳并按序打开卡片窗口', async () => {
    const { handle, open } = createHandleStub();
    mocks.startHostMain.mockResolvedValue(handle);
    const diagnostics = createDiagnostics();
    const result = await launchHostApplication({
      ...baseOptions,
      diagnostics: diagnostics.sink,
      openCards: ['/docs/a.card', '/docs/b.card'],
    });
    expect(mocks.createProductionAssembly).toHaveBeenCalledTimes(1);
    const assemblyArg = mocks.createProductionAssembly.mock.calls[0] as [{ createPalHost: unknown }];
    expect(typeof assemblyArg[0].createPalHost).toBe('function');
    expect(mocks.startHostMain).toHaveBeenCalledTimes(1);
    const mainArg = (mocks.startHostMain.mock.calls[0] as [{ application?: unknown }])[0] as Record<string, unknown>;
    expect(mainArg['assembly']).toEqual({ assembly: true });
    expect(mainArg['bootstrapWindow']).toEqual({ title: '薯片' });
    expect(mainArg['preloadPath']).toBe(baseOptions.preloadPath);
    expect(mainArg['platformRoot']).toBe(baseOptions.platformRoot);
    expect(mainArg['diagnostics']).toBe(diagnostics.sink);
    expect(result).toBe(handle);
    expect(open.mock.calls).toEqual([[{ source: '/docs/a.card' }], [{ source: '/docs/b.card' }]]);
    expect(diagnostics.errorCalls).toHaveLength(0);
  });

  it('未获得单实例锁（句柄 null）时不再装载卡片窗口', async () => {
    mocks.startHostMain.mockResolvedValue(null);
    const result = await launchHostApplication({
      ...baseOptions,
      diagnostics: createDiagnostics().sink,
      openCards: ['/docs/a.card'],
    });
    expect(result).toBeNull();
  });

  it('单个卡片窗口打开失败：写诊断不终止壳，后续来源继续装载', async () => {
    const { handle, open } = createHandleStub();
    open.mockRejectedValueOnce(new Error('来源引用非法'));
    mocks.startHostMain.mockResolvedValue(handle);
    const diagnostics = createDiagnostics();
    const result = await launchHostApplication({
      ...baseOptions,
      diagnostics: diagnostics.sink,
      openCards: ['/docs/bad.card', '/docs/good.card'],
    });
    expect(result).toBe(handle);
    expect(diagnostics.errorCalls).toHaveLength(1);
    expect(diagnostics.errorCalls[0]?.[0]).toBe('window');
    expect(diagnostics.errorCalls[0]?.[1]).toBe('卡片窗口启动装载失败');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('缺省诊断口缺省存在（不传 diagnostics 也可启动）', async () => {
    const { handle, open } = createHandleStub();
    mocks.startHostMain.mockResolvedValue(handle);
    const result = await launchHostApplication({ ...baseOptions });
    expect(result).toBe(handle);
    expect(open).not.toHaveBeenCalled();
  });
});
