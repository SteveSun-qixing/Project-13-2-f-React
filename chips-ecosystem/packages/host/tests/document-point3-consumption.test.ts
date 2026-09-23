/**
 * 点位三宿主消费臂锁测（工单036 波 B2，任务 #241）：文档服务侧「不自存路径、不自算基址」。
 *
 * 权威：《04.11-04-资源管理设计》§11.3 行 19–20（`resourceLocalPathOf` / `resourceManagedUriOfPath`
 * 的 JS 投影形状冻结表）、《RFC-原生承载面扩表裁定》§6.1 消费面（`recomputeDigestFromDisk` 由
 * record 持有 `localPath` 改为经端口取回，消除 TS 私有路径缓存）、《11-文档服务设计》§4.5/§5.5
 * （保存与摘要复算口径）、§7.2（外部修改复查）。
 *
 * @remarks 本套件锁四件事：
 * 1. **现取**——挂载建立后每一次磁盘触达（指纹复查、序列化输入、受控提交、摘要复算、句柄重建）
 *    都触达作用域端口的换算口，入参逐字为记录的 `managedUri` + `nativeSession`（INV-1 回执值）；
 * 2. **零缓存**——`document:read`（走已建句柄）不触换算口，换算口不是万能前置；换算口失败即
 *    写/保存如实拒绝且**零落盘**（不回落任何本地缓存路径）；
 * 3. **无双源**——卡片窗口装载投递的 `resourceBase` 取自注册表查询返回值（哨兵覆写即反证服务侧
 *    不再做字符串切片派生）；
 * 4. **口径不放宽**——登记的 `RESOURCE_*` 码原样透传（端口头注口径），保存链路不吞成因。
 */

import { describe, expect, it } from 'vitest';

import { createDocumentService } from '../src/capabilities/document/service.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import { CARD_ID, createHarness, ctxFor, NODE_ID_ONE, portFailure, SESSION_A } from './helpers/document-fake-ports.js';

describe('点位三消费臂 · 服务侧现取路径（记录面零缓存）', () => {
  it('写 + 保存全链：每一次磁盘触达现取换算口，入参为记录 managedUri 与回执会话', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    // 打开链的解析第一跳不属换算口消费位（挂载前无会话），故此刻零现取。
    expect(harness.convertedPaths).toHaveLength(0);
    await service.executeWrite(
      { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE, value: { text: '改写' } },
      ctx,
    );
    await service.executeSave({ documentId: CARD_ID }, ctx);
    expect(harness.convertedPaths.length).toBeGreaterThanOrEqual(4);
    for (const call of harness.convertedPaths) {
      expect(call.managedUri).toBe(harness.cardUri);
      // INV-1：换算入参的会话即 `registerScope` 回执交付的原生句柄（替身自增到 1）。
      expect(call.nativeSession).toBe(1);
    }
    // 换算口的值逐项流入磁盘面入参（序列化请求与受控提交）。
    expect(harness.serializeRequests.at(-1)?.localPath).toBe(harness.cardPath);
    expect(harness.commits.at(-1)?.localPath).toBe(harness.cardPath);
  });

  it('只读链路零现取：document:read 走已建句柄，不把换算口当万能前置', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    await service.executeRead({ documentId: CARD_ID, part: 'metadata' }, ctx);
    await service.executeRead({ documentId: CARD_ID, part: 'structure' }, ctx);
    expect(harness.convertedPaths).toHaveLength(0);
  });

  it('no-op 保存（幂等支）同样经换算口复算磁盘摘要', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    const saved = await service.executeSave({ documentId: CARD_ID }, ctx);
    expect(harness.convertedPaths).toHaveLength(1);
    expect(harness.commits).toHaveLength(0);
    expect(saved.digest).not.toHaveLength(0);
  });

  it('换算口失败即写/保存如实拒绝且零落盘：登记码原样透传，不回落本地缓存路径', async () => {
    const harness = createHarness();
    const service = createDocumentService(harness.dependencies);
    const ctx = ctxFor(SESSION_A);
    await service.executeOpen({ source: harness.cardUri }, ctx);
    harness.failures.localPathOf = portFailure('RESOURCE_NOT_FOUND', '作用域已失效');
    const writeFailure = await service
      .executeWrite({ documentId: CARD_ID, part: 'metadata', value: { name: '改名' } }, ctx)
      .catch((caught: unknown) => caught);
    expect(writeFailure).toBeInstanceOf(DocumentCapabilityError);
    expect((writeFailure as DocumentCapabilityError).code).toBe('RESOURCE_NOT_FOUND');
    expect((writeFailure as DocumentCapabilityError).message).toBe('作用域已失效');
    const saveFailure = await service.executeSave({ documentId: CARD_ID }, ctx).catch((caught: unknown) => caught);
    expect((saveFailure as DocumentCapabilityError).code).toBe('RESOURCE_NOT_FOUND');
    // 零落盘、零事件：换算未达即不伪造保存成功。
    expect(harness.commits).toHaveLength(0);
    expect(harness.published.filter((event) => event.eventId === 'document:changed')).toHaveLength(0);
  });
});

describe('点位三消费臂 · 装载投递基址单源（服务侧零切片派生）', () => {
  it('resourceBase 取注册表查询返回值：哨兵覆写即反证「无第二套派生实现」', async () => {
    const harness = createHarness();
    harness.scopeRootOverrides.set(harness.cardUri, 'chips-resource://registry-sentinel/');
    const service = createDocumentService(harness.dependencies);
    await service.executeOpen({ source: harness.cardUri }, ctxFor(SESSION_A));
    const binding = service.resolveWindowDocument(harness.cardUri);
    expect(binding).not.toBeNull();
    expect(binding?.resourceBase).toBe('chips-resource://registry-sentinel/');
    // 反证服务侧词法切片：哨兵与受管引用的字面前缀不同形，切片实现必然给出 `default` 段。
    expect(binding?.resourceBase).not.toBe('chips-resource://default/');
  });

  it('注册表查无登记事实：绑定解析返回 null 并落诊断（不猜测基址）', () => {
    const harness = createHarness();
    const unregistered = 'chips-resource://registry-void/ghost.card';
    harness.scopeRootOverrides.set(unregistered, '');
    const service = createDocumentService(harness.dependencies);
    expect(service.resolveWindowDocument(unregistered)).toBeNull();
  });
});
