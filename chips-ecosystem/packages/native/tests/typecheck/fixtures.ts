/**
 * chips-native ABI 类型检查夹具。
 *
 * 覆盖：
 * - 全部已实现导出（值与类型）各至少一次正例调用；
 * - 阻塞导出对应的注册/请求类型形状（工单003 落地后由函数面消费）；
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
} from 'chips-native';
import {
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
export const capabilityDeadline: number | undefined = capabilityContext.deadline;
export const registrationFields: [string, string, number, string, number] = [
  registration.descriptor.id,
  registration.owner,
  registration.timeoutMs,
  registration.concurrency,
  registration.maxQueue,
];

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
