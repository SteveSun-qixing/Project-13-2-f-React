/**
 * 文档服务错误归一与事件发布口径单测（`11-文档服务设计` §4.2 失败语义、§7.3 事件发布职责）。
 *
 * 覆盖：阶段归一包装（守卫异常按登记码抛出、未识别异常归一 `BRIDGE_INTERNAL` 并落诊断日志）、
 * 事件发布失败不回滚已完成调用（只落诊断日志）、宿主诊断口缺位时不崩溃。
 */

import { describe, expect, it } from 'vitest';

import { createDocumentService } from '../src/capabilities/document/service.js';
import type { IDocumentService } from '../src/capabilities/document/service.js';
import { DOCUMENT_CHANNEL_ERROR_CODES, DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import type { IDocumentServiceDependencies } from '../src/capabilities/document/ports.js';
import {
  createCardFixture,
  createHarness,
  ctxFor,
  NODE_ID_ONE,
} from './helpers/document-fake-ports.js';

/** 端口异常替身：携带登记码的解析域错误。 */
function portFailure(code: string): Error {
  return Object.assign(new Error('端口失败'), { code });
}

describe('阶段异常归一', () => {
  it('端口抛出的登记码原样透传，不落内部错误', async () => {
    const harness = createHarness();
    harness.failOpenWith = portFailure('DOCUMENT_NOT_FOUND');
    const service = createDocumentService(harness.dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor('session-a'))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    expect((error as DocumentCapabilityError).code).toBe('DOCUMENT_NOT_FOUND');
    expect((error as DocumentCapabilityError).message).toBe('端口失败');
    expect(harness.logs).toEqual([]);
  });

  it('未识别异常归一为 BRIDGE_INTERNAL 并写宿主诊断日志（不透出原始消息）', async () => {
    const harness = createHarness();
    harness.failOpenWith = new Error('内部堆栈：/Users/private/path');
    const service = createDocumentService(harness.dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor('session-a'))
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
    expect((error as DocumentCapabilityError).message).toBe('平台内部错误');
    expect(harness.logs).toHaveLength(1);
    expect(harness.logs[0]?.level).toBe('error');
    expect(JSON.stringify(harness.logs[0])).not.toContain('Users');
  });

  it('诊断口缺位时仍能完成归一并返回结构化错误', async () => {
    const harness = createHarness();
    harness.failOpenWith = new Error('内部堆栈');
    const dependencies: IDocumentServiceDependencies = {
      scope: harness.dependencies.scope,
      parser: harness.dependencies.parser,
      storage: harness.dependencies.storage,
      events: harness.dependencies.events,
      guard: harness.dependencies.guard,
    };
    const service: IDocumentService = createDocumentService(dependencies);
    const error = await service
      .executeOpen({ source: harness.cardUri }, ctxFor('session-a'))
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
  });
});

describe('事件发布失败（§7.3：事件是通知不是状态）', () => {
  it('opened 发布失败不阻断打开结果', async () => {
    const harness = createHarness();
    harness.failPublish = true;
    const service = createDocumentService(harness.dependencies);
    const opened = await service.executeOpen({ source: harness.cardUri }, ctxFor('session-a'));
    expect(opened.documentId).toBe(createCardFixture().documentId);
    expect(harness.logs.some((entry) => entry.message.includes('document:opened'))).toBe(true);
  });

  it('保存成功后的 changed / saved 发布失败不回滚落盘结果', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor('session-a');
    await service.executeOpen({ source: harness.cardUri }, ctx);
    await service.executeWrite(
      { documentId: harness.card.documentId, part: 'content', nodeId: NODE_ID_ONE, value: { text: '改写' } },
      ctx
    );
    harness.failPublish = true;
    const saved = await service.executeSave({ documentId: harness.card.documentId }, ctx);
    expect(saved.source).toBe(harness.cardUri);
    expect(harness.commits).toHaveLength(1);
    expect(harness.published).toHaveLength(0);
    expect(harness.logs.filter((entry) => entry.level === 'error')).toHaveLength(2);
    harness.failPublish = false;
    const again = await service.executeSave({ documentId: harness.card.documentId }, ctx);
    expect(again.digest).toBe(saved.digest);
    expect(harness.commits).toHaveLength(1);
  });
});

describe('权限与会话判定入口（§9.1：每调用查询、不缓存）', () => {
  it('每次调用都重新查询权限快照，撤销后立即生效', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor('session-a');
    await service.executeOpen({ source: harness.cardUri }, ctx);
    expect(harness.permissionQueries.filter((entry) => entry.permission === 'resources:read').length).toBe(1);
    await service.executeRead({ documentId: harness.card.documentId, part: 'metadata' }, ctx);
    expect(harness.permissionQueries.filter((entry) => entry.permission === 'resources:read').length).toBe(2);
    harness.revoke('session-a', 'resources:read');
    const error = await service
      .executeRead({ documentId: harness.card.documentId, part: 'metadata' }, ctx)
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.permissionDenied);
    expect(harness.activeQueries).toHaveLength(3);
  });

  it('会话在途失活时后续调用按 BRIDGE_SESSION_UNKNOWN 拒绝', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor('session-a');
    await service.executeOpen({ source: harness.cardUri }, ctx);
    harness.closeSession('session-a');
    const error = await service
      .executeSave({ documentId: harness.card.documentId }, ctx)
      .catch((caught: unknown) => caught);
    expect((error as DocumentCapabilityError).code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.sessionUnknown);
    expect((error as DocumentCapabilityError).details?.capabilityId).toBe('document:save');
  });
});
