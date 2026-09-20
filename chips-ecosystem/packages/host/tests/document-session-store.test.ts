/**
 * 文档记录与会话存储单测（`11-文档服务设计` §三 会话模型、§四 生命周期、§7.5 串行队列）。
 *
 * 覆盖：记录建立的幂等与句柄归属、会话默认形态与复用、身份声明三元关系的声明/撤回/冲突、
 * 记录回收条件、同文档写任务的串行化与失败隔离、拥有者会话释放的顺序语义与 `closing` 拒绝。
 */

import { describe, expect, it } from 'vitest';

import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';
import { createDocumentSessionStore } from '../src/capabilities/document/session-store.js';
import type { IDocumentSessionStore } from '../src/capabilities/document/session-store.js';
import type { IDocumentHandle } from '../src/capabilities/document/ports.js';
import type { ISourceFingerprint } from '../src/capabilities/document/digest.js';
import type { IOpenRecordInput } from '../src/capabilities/document/session-store.js';

const URI = 'chips-resource://default/card/Ab3dEf6Gh8.card';
const OTHER_URI = 'chips-resource://default/card/Zz9Yy8Xx7W.card';
const DOCUMENT_ID = 'Ab3dEf6Gh8';

/** 稳定的空指纹（存储层不解释指纹语义）。 */
const FINGERPRINT: ISourceFingerprint = { members: [{ path: 'structure.yaml', size: 1, modifiedAtMs: 1, crc32: null }] };

/** 记录建立输入。 */
function recordInput(managedUri: string, documentId = DOCUMENT_ID): IOpenRecordInput {
  return {
    managedUri,
    localPath: `/tmp/${documentId}`,
    form: 'directory',
    kind: 'card',
    documentId,
    title: '测试卡片',
    handle: { documentHandleBrand: 'chips-parser' },
    baselineMetadata: { name: '测试卡片' },
    baselineDiagnostics: [],
    baselineFingerprint: FINGERPRINT,
  };
}

/** 捕获抛出错误并断言为文档能力错误。 */
function captureError(action: () => unknown): DocumentCapabilityError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    return error as DocumentCapabilityError;
  }
  throw new Error('预期抛出错误，实际未抛出');
}

/** 测试夹具：存储 + 已释放句柄清单。 */
function createHarness(): { store: IDocumentSessionStore; released: IDocumentHandle[] } {
  const released: IDocumentHandle[] = [];
  return {
    released,
    store: createDocumentSessionStore((handle) => {
      released.push(handle);
      return Promise.resolve();
    }),
  };
}

describe('文档记录建立与回收', () => {
  it('同 URI 幂等返回既有记录，不重复建立', () => {
    const { store } = createHarness();
    const first = store.openRecord(recordInput(URI));
    const second = store.openRecord(recordInput(URI, 'OtherId12345'));
    expect(second).toBe(first);
    expect(store.recordCount()).toBe(1);
    expect(store.findRecord(URI)).toBe(first);
  });

  it('不同 URI 建立各自记录', () => {
    const { store } = createHarness();
    store.openRecord(recordInput(URI));
    store.openRecord(recordInput(OTHER_URI, 'Zz9Yy8Xx7W'));
    expect(store.recordCount()).toBe(2);
    expect(store.findRecord(OTHER_URI)).toBeDefined();
  });

  it('discardRecord 仅在无会话且记录在册时移除', () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    expect(store.discardRecord(record)).toBe(true);
    expect(store.recordCount()).toBe(0);
    expect(store.discardRecord(record)).toBe(false);
  });

  it('存在会话的记录不可丢弃', () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    expect(store.discardRecord(record)).toBe(false);
    expect(store.recordCount()).toBe(1);
  });
});

describe('文档会话', () => {
  it('新建会话为 reader、revision 0、非脏、无 savepoint', () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    const session = store.getOrCreateSession(record, 'session-a');
    expect(session).toMatchObject({
      sessionId: 'session-a',
      documentId: DOCUMENT_ID,
      managedUri: URI,
      role: 'reader',
      revision: 0,
      dirty: false,
      savepointDigest: null,
    });
    expect(session.dirtyParts.size).toBe(0);
    expect(session.overlays.contentNodes.size).toBe(0);
    expect(session.baselineFingerprint).toBe(FINGERPRINT);
  });

  it('同会话重复获取返回同一对象（会话与修订号延续）', () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    const session = store.getOrCreateSession(record, 'session-a');
    session.revision = 7;
    expect(store.getOrCreateSession(record, 'session-a')).toBe(session);
    expect(record.sessions.size).toBe(1);
  });

  it('findSession 按调用方会话与文档标识定位，recordOf 回到所属记录', () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    expect(store.findSession('session-a', DOCUMENT_ID)?.sessionId).toBe('session-a');
    expect(store.findSession('session-a', 'Zz9Yy8Xx7W')).toBeUndefined();
    expect(store.findSession('session-b', DOCUMENT_ID)).toBeUndefined();
    const session = store.findSession('session-a', DOCUMENT_ID);
    expect(session === undefined ? undefined : store.recordOf(session)).toBe(record);
  });
});

describe('会话身份声明（§3.1 单文档单来源）', () => {
  it('首次声明为 ok，同来源复用为 reuse，异源同标识为 conflict', () => {
    const { store } = createHarness();
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, URI)).toBe('ok');
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, URI)).toBe('reuse');
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, OTHER_URI)).toBe('conflict');
    expect(store.claimSessionIdentity('session-b', DOCUMENT_ID, OTHER_URI)).toBe('ok');
  });

  it('撤回后同标识可重新声明', () => {
    const { store } = createHarness();
    store.claimSessionIdentity('session-a', DOCUMENT_ID, URI);
    store.withdrawSessionIdentity('session-a', DOCUMENT_ID, OTHER_URI);
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, OTHER_URI)).toBe('conflict');
    store.withdrawSessionIdentity('session-a', DOCUMENT_ID, URI);
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, OTHER_URI)).toBe('ok');
  });

  it('撤回不匹配的声明无副作用', () => {
    const { store } = createHarness();
    expect(() => store.withdrawSessionIdentity('unknown', DOCUMENT_ID, URI)).not.toThrow();
    store.claimSessionIdentity('session-a', DOCUMENT_ID, URI);
    store.withdrawSessionIdentity('session-a', 'OtherId12345', URI);
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, OTHER_URI)).toBe('conflict');
  });
});

describe('同文档写任务串行队列（§7.5）', () => {
  it('任务按提交顺序串行执行且互不重叠', async () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    const log: string[] = [];
    let running = 0;
    const task = (label: string, delay: number): Promise<string> =>
      store.enqueueRecordTask(record, async () => {
        running += 1;
        expect(running).toBe(1);
        log.push(`${label}:begin`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        log.push(`${label}:end`);
        running -= 1;
        return label;
      });

    const results = await Promise.all([task('a', 10), task('b', 1), task('c', 5)]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a:begin', 'a:end', 'b:begin', 'b:end', 'c:begin', 'c:end']);
  });

  it('单任务失败不阻断后续任务，失败原样抛给调用方', async () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    const failure = await store
      .enqueueRecordTask(record, () => Promise.reject(new Error('写入失败')))
      .catch((error: unknown) => error);
    expect((failure as Error).message).toBe('写入失败');
    await expect(store.enqueueRecordTask(record, () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('不同文档的队列互不阻塞', async () => {
    const { store } = createHarness();
    const left = store.openRecord(recordInput(URI));
    const right = store.openRecord(recordInput(OTHER_URI, 'Zz9Yy8Xx7W'));
    let resolveLeft = (): void => undefined;
    const leftGate = new Promise<void>((resolve) => {
      resolveLeft = resolve;
    });
    const leftTask = store.enqueueRecordTask(left, async () => {
      await leftGate;
      return 'left';
    });
    const rightDone = await store.enqueueRecordTask(right, () => Promise.resolve('right'));
    expect(rightDone).toBe('right');
    resolveLeft();
    await expect(leftTask).resolves.toBe('left');
  });
});

describe('拥有者会话释放（§4.6）', () => {
  it('释放单会话记录：移除记录、归还租约、释放句柄并返回被移除记录', async () => {
    const { store, released } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    record.leaseHolderSessionId = 'session-a';
    store.claimSessionIdentity('session-a', DOCUMENT_ID, URI);

    const removed = await store.releaseSessionsOf('session-a');
    expect(removed).toEqual([record]);
    expect(store.recordCount()).toBe(0);
    expect(store.findRecord(URI)).toBeUndefined();
    expect(record.sessions.size).toBe(0);
    expect(record.leaseHolderSessionId).toBeNull();
    expect(released).toEqual([record.handle]);
    // 身份声明一并清除：同会话同标识可重新声明。
    expect(store.claimSessionIdentity('session-a', DOCUMENT_ID, URI)).toBe('ok');
  });

  it('多会话共享记录时只移除本会话，最后一方移除记录', async () => {
    const { store, released } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    store.getOrCreateSession(record, 'session-b');

    expect(await store.releaseSessionsOf('session-a')).toEqual([]);
    expect(store.recordCount()).toBe(1);
    expect(record.sessions.has('session-b')).toBe(true);
    expect(released).toEqual([]);

    expect(await store.releaseSessionsOf('session-b')).toEqual([record]);
    expect(store.recordCount()).toBe(0);
    expect(released).toHaveLength(1);
  });

  it('释放前等待该文档在途任务收口，未保存模型随记录一并丢弃', async () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    record.leaseHolderSessionId = 'session-a';
    const order: string[] = [];
    let releaseGate = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const inFlight = store.enqueueRecordTask(record, async () => {
      await gate;
      order.push('task');
    });
    let releaseSettled = false;
    const releasing = store.releaseSessionsOf('session-a').then((removed) => {
      releaseSettled = true;
      return removed;
    });

    // 在途任务未收口前，释放流程不得推进到移除阶段（§4.6 顺序）。
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 5);
    });
    expect(releaseSettled).toBe(false);
    expect(store.recordCount()).toBe(1);

    releaseGate();
    await inFlight;
    const removed = await releasing;
    expect(releaseSettled).toBe(true);
    expect(order).toEqual(['task']);
    expect(removed).toEqual([record]);
    expect(record.sessions.size).toBe(0);
    expect(record.leaseHolderSessionId).toBeNull();
  });

  it('closing 期间拒绝新建会话，按 BRIDGE_SESSION_UNKNOWN 返回', async () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    let releaseGate = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const inFlight = store.enqueueRecordTask(record, async () => {
      await gate;
    });
    const releasing = store.releaseSessionsOf('session-a');
    const error = captureError(() => store.getOrCreateSession(record, 'session-a'));
    expect(error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    releaseGate();
    await inFlight;
    await releasing;
    expect(store.recordCount()).toBe(0);
  });

  it('closing 期间会话查找一律落空（读/写在途请求按未打开处理）', async () => {
    const { store } = createHarness();
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    let releaseGate = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const inFlight = store.enqueueRecordTask(record, async () => {
      await gate;
    });
    const releasing = store.releaseSessionsOf('session-a');
    expect(store.findSession('session-a', DOCUMENT_ID)).toBeUndefined();
    releaseGate();
    await inFlight;
    await releasing;
  });

  it('释放无文档的会话不产生任何副作用', async () => {
    const { store, released } = createHarness();
    expect(await store.releaseSessionsOf('nobody')).toEqual([]);
    expect(released).toEqual([]);
    expect(store.recordCount()).toBe(0);
  });

  it('句柄释放失败不阻断记录移除（记录已从在册集合摘除）', async () => {
    const store = createDocumentSessionStore(() =>
      Promise.reject(Object.assign(new Error('句柄释放失败'), { code: 'DOCUMENT_IO' }))
    );
    const record = store.openRecord(recordInput(URI));
    store.getOrCreateSession(record, 'session-a');
    await expect(store.releaseSessionsOf('session-a')).rejects.toMatchObject({ code: 'DOCUMENT_IO' });
    expect(store.recordCount()).toBe(0);
  });
});
