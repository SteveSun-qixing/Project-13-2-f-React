'use strict';
/**
 * `chips-native.node` 测试替身（工单 025 原生绑定单测的「可用面」夹具，非生产实现）。
 *
 * 契约形状：工单 025 时在册 15 导出（`packages/native/abi/export-surface.json` 当时全表面
 * 形态；现面已扩至 53 项——波 A1 任务 #209 三补名后，解析 / 资源 / 审计域不在本夹具承载面
 * 内，本夹具只服务 Bridge 域装载闸与消费链）+
 * `abiVersion: 1` + `coreVersion: '0.1.0'`。全部 Bridge 域调用记录进 `__calls`，
 * `bridgeRequest` 行为按 `requestId` 编排：
 * - `r-echo`：成功，返回 `{ echo: input }`；
 * - `r-code`：拒绝并携带 `ChipsError` 同构 `Error`（`code`/`retryable`/`details`，§8.5 形态）；
 * - 其余：拒绝普通 `Error('无码异常')`（非该形状，适配层应归一 `BRIDGE_INTERNAL`）。
 */

const calls = [];

function sessionUnknownError() {
  const error = new Error('来源会话无法解析或已关闭，调用被拒绝');
  error.code = 'BRIDGE_SESSION_UNKNOWN';
  error.retryable = false;
  error.details = { capabilityId: 'probe:echo', sessionId: 7 };
  return error;
}

/** 提供方未激活的注册拒绝（真实内核 §5.1 前置校验在扩展导出落地前的必然形态）。 */
function providerNotActiveError(capabilityId) {
  const error = new Error('能力提供方尚未激活：chips.official.host');
  error.code = 'KERNEL_INVALID_TRANSITION';
  error.retryable = false;
  error.details = { capabilityId };
  return error;
}

module.exports = {
  __calls: calls,
  coreVersion() {
    return '0.1.0';
  },
  coreAbiVersion() {
    return 1;
  },
  contextProvide() {},
  contextInject() {
    return 0;
  },
  contextGet() {
    return undefined;
  },
  contextOn() {
    return 0;
  },
  contextUnsubscribe() {},
  contextEmit() {},
  contextEffect() {},
  createCancelToken() {
    return {};
  },
  cancelTokenCancel() {},
  bridgeRegister(registration) {
    calls.push({ kind: 'register', registration });
    if (registration.descriptor.id === 'probe:reject') {
      // 等价复现工单 025 实测内核行为：提供方激活通道缺位时注册被内核拒绝。
      throw providerNotActiveError(registration.descriptor.id);
    }
  },
  bridgeUnregister(capabilityId) {
    calls.push({ kind: 'unregister', capabilityId });
  },
  bridgeRequest(request) {
    calls.push({ kind: 'request', request });
    if (request.requestId === 'r-echo') {
      return Promise.resolve({ echo: request.input });
    }
    if (request.requestId === 'r-code') {
      return Promise.reject(sessionUnknownError());
    }
    return Promise.reject(new Error('无码异常'));
  },
  bridgeCancelSession(sessionId) {
    calls.push({ kind: 'cancel-session', sessionId });
  },
};
