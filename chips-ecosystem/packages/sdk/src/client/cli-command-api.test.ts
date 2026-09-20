/**
 * `cliCommand` 命名空间的转发行为（02-SDK-API规范 §3.5；07-CLI完整参考 §5.6、§5.8）。
 *
 * 断言口径：SDK 只做类型化封装，因此用例只验三件事——目标 `request` 收到的路由名与输入形状、
 * 结果原样透传（不缓存、不消解、不补默认值）、错误与目标缺失的 `code`（§11 约束 6、12）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipsError, SDK_BRIDGE_UNAVAILABLE } from '../errors.js';
import { assertChipsError } from '../testing/assert-chips-error.js';
import { ChipsBridge } from './chips-bridge.js';
import { createCliCommandApi } from './cli-command-api.js';
import type {
  CliCommandConflict,
  CliCommandListResult,
  CliCommandResolveResult,
  CliCommandView,
} from '../types/cli/command.js';
import type { IChipsBridge, IResourceHandle, ISubscription } from '../types/bridge.js';
import { mountWindow, windowHost, type WindowHost } from '../../tests/helpers/window.js';

/** 一条 `request` 调用的实参对。 */
interface RecordedCall {
  readonly id: string;
  readonly input: unknown;
}

/** 记录调用实参并可编排输出的 Bridge 目标。 */
interface SpiedBridge extends IChipsBridge {
  readonly calls: RecordedCall[];
}

/** 命令视图夹具（§5.6 字段清单）。 */
const VIEW: CliCommandView = {
  entryId: 'chips.official.office.cli.office.open',
  commandPath: ['office', 'open'],
  commandId: 'office:open',
  owner: 'chips.official.office',
  enabled: true,
  declaration: {
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    title: '打开办公文档',
    target: { type: 'app', pluginId: 'chips.official.office' },
  },
  conflicts: [],
};

/**
 * 构造记录 `request` 实参的 Bridge 目标。
 *
 * @param outputs - 按调用顺序取用的输出；缺省返回空对象
 * @returns 带调用轨迹的替身目标
 */
function createTarget(...outputs: unknown[]): SpiedBridge {
  const calls: RecordedCall[] = [];
  let index = 0;
  return {
    calls,
    request<TOutput>(id: string, input?: unknown): Promise<TOutput> {
      calls.push({ id, input });
      const output = index < outputs.length ? outputs[index] : {};
      index += 1;
      return Promise.resolve(output as TOutput);
    },
    subscribe: (): ISubscription => ({ dispose: (): void => undefined }),
    resource: (): IResourceHandle => ({}) as IResourceHandle,
  };
}

/**
 * 捕获调用的拒绝原因（§11 约束 6：断言只按 `code`，不碰 message 文本）。
 *
 * @param call - 被观察的调用
 * @returns 拒绝原因；调用意外成功时为 `undefined`，由用例的 `assertChipsError` 判失败
 */
async function rejection(call: Promise<unknown>): Promise<unknown> {
  return await call.then(
    (): undefined => undefined,
    (error: unknown): unknown => error
  );
}

/** 本文件用例挂载的 `window` 恢复函数。 */
let restoreWindow: (() => void) | undefined;

/**
 * 挂载 `window` 并注入指定 Bridge 目标。
 *
 * @param bridge - 要写入 `window.chips` 的目标
 * @returns 注入的 `window` 宿主，便于用例替换目标
 */
function mountWithBridge(bridge: IChipsBridge): WindowHost {
  restoreWindow = mountWindow();
  const host = windowHost();
  expect(host).toBeDefined();
  if (host === undefined) {
    throw new Error('window 夹具挂载失败');
  }
  host.chips = bridge;
  return host;
}

afterEach(() => {
  restoreWindow?.();
  restoreWindow = undefined;
});

describe('cliCommand 的服务路由映射（§5.8 路由名 + §5.6 形状）', () => {
  it('list 省略查询参数时按空对象转发 cli.command.list', async () => {
    const result: CliCommandListResult = {
      index: { 'office open': [VIEW.entryId] },
      commands: [VIEW],
    };
    const target = createTarget(result);
    const api = createCliCommandApi(() => target);
    await expect(api.list()).resolves.toBe(result);
    expect(target.calls).toEqual([{ id: 'cli.command.list', input: {} }]);
  });

  it('list 原样透传查询参数并回传目标结果对象本身', async () => {
    const target = createTarget({ index: {}, commands: [] });
    const api = createCliCommandApi(() => target);
    const query = { targetType: 'app', includeDisabled: true } as const;
    await api.list(query);
    expect(target.calls[0]).toEqual({ id: 'cli.command.list', input: query });
  });

  it('get 转发 cli.command.get，命中时返回视图、未命中时返回 undefined', async () => {
    const hit = createTarget(VIEW);
    await expect(createCliCommandApi(() => hit).get({ entryId: VIEW.entryId })).resolves.toBe(VIEW);
    expect(hit.calls[0]).toEqual({ id: 'cli.command.get', input: { entryId: VIEW.entryId } });

    const miss = createTarget(undefined);
    await expect(createCliCommandApi(() => miss).get({ commandPath: 'office open' })).resolves.toBe(
      undefined
    );
    expect(miss.calls[0]).toEqual({ id: 'cli.command.get', input: { commandPath: 'office open' } });
  });

  it('resolve 转发 cli.command.resolve，冲突组原样透出且不做本地消解', async () => {
    const conflicts: readonly CliCommandConflict[] = [
      {
        entryId: 'chips.other.cli.office.open',
        commandPath: ['office', 'open'],
        owner: 'chips.other',
        priority: 0,
      },
    ];
    const outcome: CliCommandResolveResult = { conflicts };
    const target = createTarget(outcome);
    const api = createCliCommandApi(() => target);
    await expect(api.resolve({ commandPath: ['office', 'open'] })).resolves.toBe(outcome);
    expect(target.calls[0]).toEqual({
      id: 'cli.command.resolve',
      input: { commandPath: ['office', 'open'] },
    });
  });

  it('三个方法共用客户端目标时，经 ChipsBridge 注入的命名空间同样按调用解析', async () => {
    const client = new ChipsBridge();
    const first = createTarget({ index: {}, commands: [] });
    const host = mountWithBridge(first);
    await client.cliCommand.list();
    expect(first.calls).toEqual([{ id: 'cli.command.list', input: {} }]);
    const second = createTarget({});
    host.chips = second;
    await client.cliCommand.get({ entryId: VIEW.entryId });
    expect(second.calls).toEqual([{ id: 'cli.command.get', input: { entryId: VIEW.entryId } }]);
  });
});

describe('cliCommand 的错误口径（§6.4、§11 约束 6）', () => {
  it('平台返回多匹配错误时同实例透传，不改写 code 与 details', async () => {
    const conflict = new ChipsError({
      code: 'CLI_COMMAND_CONFLICT',
      message: '命令路径命中多个入口',
      details: { conflicts: [VIEW.entryId] },
      retryable: false,
    });
    const target: IChipsBridge = {
      request: vi.fn((): Promise<never> => Promise.reject(conflict)),
      subscribe: (): ISubscription => ({ dispose: (): void => undefined }),
      resource: (): IResourceHandle => ({}) as IResourceHandle,
    };
    const api = createCliCommandApi(() => target);
    await expect(api.resolve({ commandPath: 'office open' })).rejects.toBe(conflict);
  });

  it('目标不可用时三个方法一律异步拒绝 SDK_BRIDGE_UNAVAILABLE', async () => {
    expect(windowHost()).toBeUndefined();
    const client = new ChipsBridge();
    const api = client.cliCommand;
    const cases: readonly (readonly [string, Promise<unknown>])[] = [
      ['list', rejection(api.list())],
      ['get', rejection(api.get({ entryId: VIEW.entryId }))],
      ['resolve', rejection(api.resolve({ commandPath: 'office open' }))],
    ];
    for (const [method, outcome] of cases) {
      const caught: unknown = await outcome;
      assertChipsError(caught, SDK_BRIDGE_UNAVAILABLE);
      expect(caught.retryable, method).toBe(false);
    }
  });
});
