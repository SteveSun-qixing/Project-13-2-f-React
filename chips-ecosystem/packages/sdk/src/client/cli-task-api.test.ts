/**
 * `cliTask` 命名空间的转发行为（02-SDK-API规范 §3.5；07-CLI完整参考 §5.6、§5.7、§5.8）。
 *
 * 断言口径：
 * - 插件侧五个方法必须命中 `src/generated/capability-ids.ts` 生成常量所指的能力 ID 与 §7.17
 *   登记的输入形状，并解包 `{ task }` / `{ task? }` 信封；
 * - CLI 调度侧三个方法必须命中 §5.8 的 `cli.task.*` 服务路由名；
 * - 生命周期与归属判定属平台：SDK 只透传错误与结果，不自造校验（§11 约束 12）。
 */

import { describe, expect, it, vi } from 'vitest';
import { Capability } from '../generated/capability-ids.js';
import { ChipsBridge } from './chips-bridge.js';
import { createCliTaskApi } from './cli-task-api.js';
import { ChipsError, SDK_BRIDGE_UNAVAILABLE } from '../errors.js';
import { assertChipsError } from '../testing/assert-chips-error.js';
import type { CliTaskRecord } from '../types/capabilities/cli-task.js';
import type { IChipsBridge, IResourceHandle, ISubscription } from '../types/bridge.js';

/** 一次 `request` 调用的实参对。 */
interface RecordedCall {
  readonly id: string;
  readonly input: unknown;
}

/** 记录调用实参并可编排输出的 Bridge 目标。 */
interface SpiedBridge extends IChipsBridge {
  readonly calls: RecordedCall[];
}

/** 任务记录夹具（07-CLI完整参考 §5.6 `CliTaskRecord`）。 */
const RUNNING: CliTaskRecord = {
  taskId: 'task-01',
  pluginId: 'chips.official.office',
  commandId: 'office:open',
  commandPath: ['office', 'open'],
  status: 'running',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

/**
 * 构造记录 `request` 实参的 Bridge 目标。
 *
 * @param outputs - 按调用顺序取用的输出；缺省返回 `{ task: RUNNING }`
 * @returns 带调用轨迹的替身目标
 */
function createTarget(...outputs: unknown[]): SpiedBridge {
  const calls: RecordedCall[] = [];
  let index = 0;
  return {
    calls,
    request<TOutput>(id: string, input?: unknown): Promise<TOutput> {
      calls.push({ id, input });
      const output = outputs[index] ?? { task: RUNNING };
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

describe('cliTask 的插件侧能力映射（§5.6 能力表 + §7.17 契约）', () => {
  it('active 取生成常量所指能力 ID，输入为 commandId 并解包 task', async () => {
    const target = createTarget({ task: RUNNING });
    await expect(createCliTaskApi(() => target).active('office:open')).resolves.toBe(RUNNING);
    expect(target.calls[0]).toEqual({
      id: Capability.CLI_TASK_ACTIVE,
      input: { commandId: 'office:open' },
    });
    expect(Capability.CLI_TASK_ACTIVE).toBe('cli:task-active');
  });

  it('active 在无任务情形返回 undefined，不补占位记录', async () => {
    const target = createTarget({});
    await expect(createCliTaskApi(() => target).active('office:open')).resolves.toBeUndefined();
  });

  it('get / progress / complete / fail 逐项命中登记的四个能力 ID', async () => {
    const target = createTarget();
    const api = createCliTaskApi(() => target);
    await api.get('task-01');
    await api.progress('task-01', { stage: '写入中', percent: 80 });
    await api.complete('task-01', { files: ['/tmp/报告.pdf'] });
    await api.fail('task-01', { code: 'APP_COMMAND_FAILED', message: '应用处理失败' });
    expect(target.calls).toEqual([
      { id: 'cli:task-get', input: { taskId: 'task-01' } },
      {
        id: 'cli:task-progress',
        input: { taskId: 'task-01', progress: { stage: '写入中', percent: 80 } },
      },
      {
        id: 'cli:task-complete',
        input: { taskId: 'task-01', output: { files: ['/tmp/报告.pdf'] } },
      },
      {
        id: 'cli:task-fail',
        input: {
          taskId: 'task-01',
          error: { code: 'APP_COMMAND_FAILED', message: '应用处理失败' },
        },
      },
    ]);
    expect(Capability.CLI_TASK_GET).toBe('cli:task-get');
    expect(Capability.CLI_TASK_PROGRESS).toBe('cli:task-progress');
    expect(Capability.CLI_TASK_COMPLETE).toBe('cli:task-complete');
    expect(Capability.CLI_TASK_FAIL).toBe('cli:task-fail');
  });

  it('complete 省略 output 时不写入该键，保持 §7.17 的可选字段语义', async () => {
    const target = createTarget({ task: RUNNING });
    await createCliTaskApi(() => target).complete('task-01');
    expect(target.calls[0]).toEqual({ id: 'cli:task-complete', input: { taskId: 'task-01' } });
  });
});

describe('cliTask 的 CLI 调度侧路由映射（§5.8）', () => {
  it('create / bindInvocation / cancel 命中 cli.task.* 路由并解包任务记录', async () => {
    const bound: CliTaskRecord = { ...RUNNING, status: 'running' };
    const cancelled: CliTaskRecord = { ...RUNNING, status: 'cancelled' };
    const target = createTarget({ task: RUNNING }, { task: bound }, { task: cancelled });
    const api = createCliTaskApi(() => target);
    await expect(
      api.create({
        pluginId: 'chips.official.office',
        commandId: 'office:open',
        commandPath: ['office', 'open'],
      })
    ).resolves.toBe(RUNNING);
    await expect(api.bindInvocation({ taskId: 'task-01', invocationId: 'inv-01' })).resolves.toBe(
      bound
    );
    await expect(api.cancel('task-01')).resolves.toBe(cancelled);
    expect(target.calls).toEqual([
      {
        id: 'cli.task.create',
        input: {
          pluginId: 'chips.official.office',
          commandId: 'office:open',
          commandPath: ['office', 'open'],
        },
      },
      { id: 'cli.task.bindInvocation', input: { taskId: 'task-01', invocationId: 'inv-01' } },
      { id: 'cli.task.cancel', input: { taskId: 'task-01' } },
    ]);
  });
});

describe('cliTask 的错误与目标解析口径（§6.4、§3.2）', () => {
  it('平台以 CLI_TASK_INVALID 拒绝时同实例透传，SDK 不改写错误码', async () => {
    const invalid = new ChipsError({
      code: 'CLI_TASK_INVALID',
      message: '任务已进入终态，上报被拒绝',
      details: { taskId: 'task-01', status: 'completed' },
      retryable: false,
    });
    const target: IChipsBridge = {
      request: vi.fn((): Promise<never> => Promise.reject(invalid)),
      subscribe: (): ISubscription => ({ dispose: (): void => undefined }),
      resource: (): IResourceHandle => ({}) as IResourceHandle,
    };
    await expect(createCliTaskApi(() => target).complete('task-01')).rejects.toBe(invalid);
  });

  it('默认客户端未绑定目标时八个方法一律异步拒绝 SDK_BRIDGE_UNAVAILABLE', async () => {
    const client = new ChipsBridge();
    const api = client.cliTask;
    const cases: readonly (readonly [string, Promise<unknown>])[] = [
      ['active', rejection(api.active('office:open'))],
      ['get', rejection(api.get('task-01'))],
      ['progress', rejection(api.progress('task-01', {}))],
      ['complete', rejection(api.complete('task-01'))],
      ['fail', rejection(api.fail('task-01', 'boom'))],
      [
        'create',
        rejection(api.create({ pluginId: 'chips.official.office', commandId: 'office:open' })),
      ],
      ['bindInvocation', rejection(api.bindInvocation({ taskId: 'task-01' }))],
      ['cancel', rejection(api.cancel('task-01'))],
    ];
    for (const [method, outcome] of cases) {
      const caught: unknown = await outcome;
      assertChipsError(caught, SDK_BRIDGE_UNAVAILABLE);
      expect(caught.retryable, method).toBe(false);
    }
  });
});
