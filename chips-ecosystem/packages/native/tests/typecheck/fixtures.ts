/**
 * chips-native ABI 类型检查夹具。
 *
 * 覆盖：
 * - 全部已实现导出（值与类型）各至少一次正例调用（含 Bridge 能力执行四导出）；
 * - 注册/请求类型形状（`INativeCapabilityRegistration` / `INativeBridgeRequest`）；
 * - `@ts-expect-error` 负例：参数类型、返回类型与必填字段必须被拒绝。
 *
 * 本文件只做类型检查（`tsc --noEmit`），不产生运行时代码。
 */

import type {
  CancelTokenHandle,
  ContextHandle,
  INativeBridgeRequest,
  INativeCapabilityContext,
  INativeCapabilityRegistration,
  INativeProviderRegistration,
  INativeSessionRegistration,
} from 'chips-native';
import {
  bridgeActivateProvider,
  bridgeCancelSession,
  bridgeCloseSession,
  bridgeDeactivateProvider,
  bridgeGrantCapabilityId,
  bridgeOpenSession,
  bridgeRegister,
  bridgeRequest,
  bridgeShutdown,
  bridgeUnregister,
  cancelTokenCancel,
  contextEffect,
  contextEmit,
  contextGet,
  contextInject,
  contextOn,
  contextProvide,
  contextUnsubscribe,
  coreAbiVersion,
  coreVersion,
  createCancelToken,
} from 'chips-native';

declare const handle: ContextHandle;
declare const token: CancelTokenHandle;
declare const request: INativeBridgeRequest;
declare const capabilityContext: INativeCapabilityContext;
declare const registration: INativeCapabilityRegistration;

export const version: string = coreVersion();
export const abiVersion: number = coreAbiVersion();

contextProvide(handle, 'index', { enqueue: () => undefined });
contextInject(handle, ['index'] as const, (ctx: ContextHandle) => {
  contextEffect(ctx, () => undefined);
});

export const service: unknown = contextGet(handle, 'index');

const listener: (payload: unknown) => void = () => undefined;
export const subscription: number = contextOn(handle, 'document:changed', listener, false);
contextUnsubscribe(handle, subscription);
contextEmit(handle, 'document:changed', { uri: 'chips-resource://card-001' });

export const cancelToken: CancelTokenHandle = createCancelToken();
cancelTokenCancel(token);

export const requestFields: [string, string, number, unknown] = [
  request.requestId,
  request.capabilityId,
  request.sessionId,
  request.input,
];
export const requestBin: Record<string, Uint8Array> | undefined = request.bin;
export const capabilitySignal: AbortSignal = capabilityContext.signal;
export const capabilityDeadline: number = capabilityContext.deadline;
export const registrationFields: [string, string, number, string, number] = [
  registration.descriptor.id,
  registration.owner,
  registration.timeoutMs,
  registration.concurrency,
  registration.maxQueue,
];

// Bridge 能力执行四导出：正例调用。
const registrationFixture: INativeCapabilityRegistration = {
  descriptor: { id: 'file:read', schema: { type: 'object' }, permissions: [] },
  owner: 'chips.official.host',
  timeoutMs: 30000,
  concurrency: 'parallel',
  maxQueue: 32,
  handler: async (input: unknown, ctx: INativeCapabilityContext): Promise<unknown> =>
    ctx.deadline > 0 ? input : undefined,
};
bridgeRegister(registrationFixture);
bridgeUnregister(registrationFixture.descriptor.id);
export const bridgeResponse: Promise<unknown> = bridgeRequest(request);
bridgeCancelSession(request.sessionId);

// 激活与会话扩展六导出：正例调用。
const providerFixture: INativeProviderRegistration = {
  id: 'chips.official.host',
  kind: 'platformService',
  permissions: ['filesystem:read'],
};
bridgeActivateProvider(providerFixture);
bridgeDeactivateProvider(providerFixture.id);
bridgeGrantCapabilityId('file:read', providerFixture.id);
const sessionFixture: INativeSessionRegistration = {
  sessionId: 1,
  pluginId: 'chips.official.editor',
  grantedPermissions: ['filesystem:read'],
};
bridgeOpenSession(sessionFixture);
bridgeCloseSession(sessionFixture.sessionId);
bridgeShutdown();

// 负例：以下写法必须被类型系统拒绝。
// @ts-expect-error coreAbiVersion 返回 number，不能赋给 string
export const wrongVersion: string = coreAbiVersion();
// @ts-expect-error name 必须是 string
contextProvide(handle, 1, {});
// @ts-expect-error get 必须提供 name
contextGet(handle);
// @ts-expect-error token 必须是 number
contextUnsubscribe(handle, 'token');
// @ts-expect-error once 必须是 boolean
contextOn(handle, 'document:changed', listener, 'yes');
// @ts-expect-error 清理函数不能是数字
contextEffect(handle, 1);
// @ts-expect-error INativeBridgeRequest 缺少必填字段
export const incompleteRequest: INativeBridgeRequest = { requestId: 'r1' };
// @ts-expect-error bridgeRequest 必须提供请求对象
bridgeRequest();
// @ts-expect-error bridgeUnregister 的参数必须是字符串
bridgeUnregister(1);
// @ts-expect-error bridgeCancelSession 的参数必须是数值会话 ID
bridgeCancelSession('session-1');
// @ts-expect-error handler 缺失的注册对象不可注册
bridgeRegister({ ...registrationFixture, handler: undefined });
// @ts-expect-error provider kind 只能是 'platformService' 或 'servicePlugin'
bridgeActivateProvider({ ...providerFixture, kind: 'unknownKind' });
// @ts-expect-error 提供方登记缺少必填 permissions
bridgeActivateProvider({ id: 'x', kind: 'platformService' });
// @ts-expect-error bridgeDeactivateProvider 的参数必须是字符串
bridgeDeactivateProvider(1);
// @ts-expect-error bridgeGrantCapabilityId 需要 capabilityId 与 owner 两个参数
bridgeGrantCapabilityId('file:read');
// @ts-expect-error bridgeGrantCapabilityId 的 owner 必须是字符串
bridgeGrantCapabilityId('file:read', 2);
// @ts-expect-error 会话登记缺少必填 pluginId
bridgeOpenSession({ sessionId: 1, grantedPermissions: [] });
// @ts-expect-error bridgeCloseSession 的参数必须是数值会话 ID
bridgeCloseSession('session-1');
// @ts-expect-error bridgeShutdown 不接受参数
bridgeShutdown(1);
