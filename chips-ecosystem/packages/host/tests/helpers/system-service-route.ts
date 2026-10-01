/**
 * 系统服务族能力域的路由级测试跳线（仅测试代码）。
 *
 * @remarks
 * - 以真实运行时（`createHostRuntime` + 会话供给替身）走完整路由管线（权限判定 → schema 准入 →
 *   执行 → 错误归一），与 `host-runtime.test.ts` 的注册形制同族；域逻辑离线可测（端口注入）。
 * - 每次调用独立建 runtime 并 `shutdown`，用例间零共享状态。
 */

import { createHostRuntime } from '../../src/runtime/host-runtime.js';
import type { IHostCapabilityDescriptor } from '../../src/runtime/capability/contracts.js';
import type { IHostSessionGrant, IHostSessionProvisioner } from '../../src/runtime/capability/session.js';
import type { IBridgeResponse } from '../../src/protocol/wire.js';
import type { IPlatformHostChannel } from '../../src/runtime/contracts.js';
import type { IPalHost } from '../../src/platform/contracts/index.js';
import { createFakePalHost } from './fake-pal-host.js';

/** 一次路由调用的输入。 */
export interface IRouteRequestInput {
  /** 注册的能力描述符（通常为被测域工厂产出）。 */
  readonly capabilities: readonly IHostCapabilityDescriptor[];
  /** 会话授权快照（`['*']` = 平台全量）。 */
  readonly grantedPermissions: readonly string[];
  /** 目标能力 ID。 */
  readonly capabilityId: string;
  /** 能力输入。 */
  readonly input?: unknown;
}

/**
 * 经真实运行时路由一次能力调用。
 *
 * @returns 结构化响应（`ok` / `result` / `error`）。
 */
export async function routeSystemServiceRequest(input: IRouteRequestInput): Promise<IBridgeResponse> {
  const grant: IHostSessionGrant = { pluginId: 'test.plugin', grantedPermissions: input.grantedPermissions };
  const provisioner: IHostSessionProvisioner = { provision: () => grant };
  const channel: IPlatformHostChannel = { pushSessionPermissions: () => undefined };
  const runtime = createHostRuntime({ capabilities: input.capabilities, sessionProvisioner: provisioner });
  const host: IPalHost = createFakePalHost();
  await runtime.start(host, channel);
  try {
    return await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      {
        requestId: 'route-1',
        capabilityId: input.capabilityId,
        ...(input.input === undefined ? {} : { input: input.input }),
      },
    );
  } finally {
    await runtime.shutdown();
  }
}
