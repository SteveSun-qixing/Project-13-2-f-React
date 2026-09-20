/**
 * 文档服务错误归一与事件发布口径单测（`11-文档服务设计` §4.2 失败语义、§7.3 事件发布职责、
 * §9.1 每调用查询不缓存；`02-Bridge三层设计` §9.1 错误归一）。
 *
 * 覆盖：端口登记码原样透传、未识别异常归一 `BRIDGE_INTERNAL`（跨 Bridge 不透出原始消息、
 * 诊断信息写宿主日志）、宿主诊断口缺位时不崩溃、事件发布失败不回滚已完成调用、
 * 权限快照每调用查询（撤销立即生效）、会话在途失活按 `BRIDGE_SESSION_UNKNOWN` 拒绝。
 *
 * @remarks 本套件是接管时点自 `归档/document-service-errors.test.ts.disabled.bak` 恢复的
 * 活动套件（错误面验收硬闸）：7 条用例逐项等价重写，断言口径对齐《02-Bridge三层设计》§9.1
 * 现行权威——"未识别异常归一 `BRIDGE_INTERNAL`，`message` 使用通用文案，`details` 不携带堆栈
 * 与内部路径；诊断信息写宿主日志"（防泄漏的对象是跨 Bridge 返回的错误，宿主日志承载诊断）。
 */

import { describe, expect, it } from 'vitest';

import { createDocumentService } from '../src/capabilities/document/service.js';
import type { IDocumentService } from '../src/capabilities/document/service.js';
import { DOCUMENT_CHANNEL_ERROR_CODES, DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import type { IDocumentServiceDependencies } from '../src/capabilities/document/ports.js';
import {
  CARD_ID,
  createHarness,
  ctxFor,
  NODE_ID_ONE,
  portFailure,
  SESSION_A,
} from './helpers/document-fake-ports.js';

describe('阶段异常归一', () => {
  it('端口抛出的登记码原样透传，不落内部错误', async () => {
    const harness = createHarness();
    harness.failures.open = portFailure('DOCUMENT_NOT_FOUND', '端口失败');
    const service = createDocumentService(harness.dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    expect((error as DocumentCapabilityError).code).toBe('DOCUMENT_NOT_FOUND');
    expect((error as DocumentCapabilityError).message).toBe('端口失败');
    expect(harness.logs).toEqual([]);
  });

  it('未识别异常归一为 BRIDGE_INTERNAL：跨 Bridge 不透出原始消息，诊断信息写宿主日志', async () => {
    const harness = createHarness();
    harness.failures.open = new Error('内部堆栈：/Users/private/path');
    const service = createDocumentService(harness.dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    const failure = error as DocumentCapabilityError;
    expect(failure.code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
    expect(failure.message).toBe('平台内部错误');
    expect(failure.message).not.toContain('Users');
    expect(JSON.stringify(failure.toPlain())).not.toContain('Users');
    expect(failure.retryable).toBe(false);
    expect(harness.logs).toHaveLength(1);
    expect(harness.logs[0]?.level).toBe('error');
    expect(harness.logs[0]?.message).toBe('文档能力内部错误');
    // 诊断信息写宿主日志（§9.1）：原始消息只落宿主日志面，不进入跨 Bridge 错误。
    expect(String(harness.logs[0]?.details?.error)).toContain('Users');
  });

  it('诊断口缺位时仍能完成归一并返回结构化错误', async () => {
    const harness = createHarness();
    harness.failures.open = new Error('内部堆栈');
    const dependencies: IDocumentServiceDependencies = {
      scope: harness.dependencies.scope,
      parser: harness.dependencies.parser,
      storage: harness.dependencies.storage,
      events: harness.dependencies.events,
      guard: harness.dependencies.guard,
    };
    const service: IDocumentService = createDocumentService(dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A))
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
    expect((error as DocumentCapabilityError).message).toBe('平台内部错误');
  });
});

describe('事件发布失败（§7.3：事件是通知不是状态）', () => {
  it('opened 发布失败不阻断打开结果', async () => {
    const harness = createHarness();
    harness.failures.publish = true;
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    expect(opened.documentId).toBe(CARD_ID);
    expect(harness.published).toHaveLength(0);
    expect(harness.logs.some((entry) => entry.message.includes('document:opened'))).toBe(true);
  });

  it('保存成功后的 changed / saved 发布失败不回滚落盘结果', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    await service.executeWrite(
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE, value: { text: '改写' } },
      ctx
    );
    // 写入只改内存模型、不发布事件（§4.2）：打开阶段的 opened 是唯一已发布事件。
    expect(harness.eventIds()).toEqual(['document:opened']);
    harness.failures.publish = true;
    const saved = await service.executeSave({ documentId: CARD_ID }, ctx);
    expect(saved.source).toBe(harness.cardUri);
    expect(harness.commits).toHaveLength(1);
    expect(harness.published).toHaveLength(1);
    expect(harness.logs.filter((entry) => entry.level === 'error')).toHaveLength(2);
    expect(harness.logs.some((entry) => entry.message.includes('document:changed'))).toBe(true);
    expect(harness.logs.some((entry) => entry.message.includes('document:saved'))).toBe(true);
    harness.failures.publish = false;
    const again = await service.executeSave({ documentId: CARD_ID }, ctx);
    expect(again.digest).toBe(saved.digest);
    expect(harness.commits).toHaveLength(1);
  });
});

describe('权限与会话判定入口（§9.1：每调用查询、不缓存）', () => {
  it('每次调用都重新查询权限快照，撤销后立即生效', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    expect(harness.permissionQueries.filter((entry) => entry.permission === 'resources:read').length).toBe(1);
    await service.executeRead({ documentId: CARD_ID, part: 'metadata' }, ctx);
    expect(harness.permissionQueries.filter((entry) => entry.permission === 'resources:read').length).toBe(2);
    harness.revoke(SESSION_A, 'resources:read');
    const error = await service
      .executeRead({ documentId: CARD_ID, part: 'metadata' }, ctx)
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.permissionDenied);
    expect((error as DocumentCapabilityError).details?.capabilityId).toBe('document:read');
    expect(harness.activeQueries).toHaveLength(3);
  });

  it('会话在途失活时后续调用按 BRIDGE_SESSION_UNKNOWN 拒绝', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    harness.closeSession(SESSION_A);
    const error = await service
      .executeSave({ documentId: CARD_ID }, ctx)
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.sessionUnknown);
    expect((error as DocumentCapabilityError).details?.capabilityId).toBe('document:save');
  });
});
