// @vitest-environment node
/**
 * 万能文件链路 file.session.* 会话生命周期集成测试。
 *
 * 基于 Chips-SDK 的 mock 设施（createMockChipsClient）构造带 file.session 能力的
 * 客户端：mock 处理器按 `Chips-SDK/src/contracts/file.ts` 的真实方法签名与错误码
 * 约定实现（创建/打开/读取/写入/查询/持久化/关闭），并按
 * `Chips-SDK/src/api/file.ts` 的请求/响应封装约定（`{ document }`、
 * `{ document, bytes, offset, totalSize }`、`{ ack }`）返回。
 *
 * 文件内容复用 pptx-engine 引擎 API：createBlankPptx 生成最小合法 pptx 字节，
 * openPptx/insertBlankSlide/savePptx 生成写入更新，并在会话回读后重新解析，
 * 证明 file.session 链路对引擎字节语义无损。
 *
 * 环境说明：本文件不依赖 DOM（无 React 渲染），与 slide-save-chain.test.ts 一样
 * 固定在 node 环境运行——jsdom 环境下 TextEncoder 产出的 Uint8Array 与外置 CJS
 * jszip 的 instanceof 跨 realm 校验不兼容，会导致引擎保存链路被误判为非法数据。
 */
import { describe, expect, it } from "vitest";
import { createMockChipsClient, type MockChipsClient, type MockActionHandler } from "chips-sdk/testing";
import {
  FILE_ACTIONS,
  FILE_ERROR_CODES,
  type FileSessionDescriptor,
  type FileSessionWriteResult,
  type StandardError,
} from "chips-sdk";
import {
  createBlankPptx,
  insertBlankSlide,
  openPptx,
  savePptx,
} from "../../src/engine/pptx-engine/src/index";

// ============================================================================
// 测试辅助：按契约实现的内存版 file.session mock 服务
// ============================================================================

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPTX_FORMAT = "pptx";

interface MockSessionRecord {
  descriptor: FileSessionDescriptor;
  bytes: Uint8Array;
}

interface FileSessionMock {
  client: MockChipsClient;
  /** 持久化后的工作区文件（路径 → 字节），模拟宿主侧磁盘 */
  workspace: Map<string, Uint8Array>;
  /** 每个会话持久化到的工作区路径 */
  sessionPaths: Map<string, string>;
}

function toRecord(payload: unknown): Record<string, unknown> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return Uint8Array.from(value as number[]);
  }
  if (value && typeof value === "object" && "data" in value) {
    return toBytes((value as { data?: unknown }).data);
  }
  return new Uint8Array();
}

function nowIso(): string {
  return new Date().toISOString();
}

function fileNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

function fileSessionError(code: string, message: string, details?: unknown): StandardError {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

/**
 * 构造带 file.session 能力的 mock 客户端。
 *
 * 会话存储与工作区均为实例内内存态（WeakMap 风格的实例隔离），语义对齐
 * contracts/file.ts：write 置 dirty 并递增 revision，persist 置 clean 并落工作区，
 * close 移除会话（后续访问返回 FILE_SESSION_NOT_FOUND）。
 */
function createFileSessionMockClient(): FileSessionMock {
  const workspace = new Map<string, Uint8Array>();
  const sessionPaths = new Map<string, string>();
  const sessions = new Map<string, MockSessionRecord>();
  let sessionSeed = 0;

  const requireSession = (payload: unknown): MockSessionRecord => {
    const sessionId = toRecord(payload).sessionId;
    const record = typeof sessionId === "string" ? sessions.get(sessionId) : undefined;
    if (!record) {
      throw fileSessionError(
        FILE_ERROR_CODES.SessionNotFound,
        `文件会话不存在: ${String(sessionId)}`,
        { sessionId },
      );
    }
    return record;
  };

  const updateDocument = (record: MockSessionRecord, patch: Partial<FileSessionDescriptor>): void => {
    record.descriptor = { ...record.descriptor, ...patch, updatedAt: nowIso() };
  };

  const persistSession = (record: MockSessionRecord, targetPath?: string): void => {
    const filePath = targetPath ?? sessionPaths.get(record.descriptor.sessionId) ?? record.descriptor.filePath;
    workspace.set(filePath, Uint8Array.from(record.bytes));
    sessionPaths.set(record.descriptor.sessionId, filePath);
    updateDocument(record, {
      filePath,
      fileName: fileNameFromPath(filePath),
      status: "clean",
    });
  };

  const handlers: Record<string, MockActionHandler> = {
    // 契约：FileSessionCreateRequest { format?, fileName?, initialBytes?, options? }
    [FILE_ACTIONS.SessionCreate]: (payload) => {
      const record = toRecord(payload);
      const format = String(record.format ?? PPTX_FORMAT);
      const fileName = String(record.fileName ?? `未命名文档.${format}`);
      const sessionId = `fs-session-${++sessionSeed}`;
      const bytes = toBytes(record.initialBytes);
      const descriptor: FileSessionDescriptor = {
        sessionId,
        documentId: `doc-${sessionId}`,
        filePath: `/workspace/documents/${fileName}`,
        fileName,
        format,
        mimeType: PPTX_MIME_TYPE,
        size: bytes.length,
        revision: 0,
        status: "clean",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      sessions.set(sessionId, { descriptor, bytes });
      return { document: descriptor };
    },

    // 契约：FileSessionReadRequest { sessionId, options? { offset?, length?, encoding? } }
    // SDK 封装层把 options 展开到 payload 顶层（{ sessionId, ...options }）
    [FILE_ACTIONS.SessionRead]: (payload) => {
      const record = requireSession(payload);
      const options = toRecord(toRecord(payload).options);
      const offset = typeof options.offset === "number" ? options.offset : 0;
      const length = typeof options.length === "number" ? options.length : record.bytes.length - offset;
      const bytes = record.bytes.subarray(offset, offset + length);
      return {
        document: record.descriptor,
        bytes: Uint8Array.from(bytes),
        offset,
        totalSize: record.bytes.length,
      };
    },

    // 契约：FileSessionWriteRequest { sessionId, bytes, options? { offset? } }
    [FILE_ACTIONS.SessionWrite]: (payload) => {
      const record = requireSession(payload);
      const writePayload = toRecord(payload);
      const bytes = toBytes(writePayload.bytes);
      const offset = toRecord(writePayload.options).offset;
      if (typeof offset === "number" && offset > 0) {
        const merged = new Uint8Array(Math.max(record.bytes.length, offset + bytes.length));
        merged.set(record.bytes.subarray(0, Math.min(offset, record.bytes.length)));
        merged.set(bytes, offset);
        record.bytes = merged;
      } else {
        record.bytes = bytes;
      }
      updateDocument(record, {
        size: record.bytes.length,
        revision: record.descriptor.revision + 1,
        status: "dirty",
      });
      return { document: record.descriptor };
    },

    // 契约：get(sessionId) → { document }
    [FILE_ACTIONS.SessionGet]: (payload) => {
      const record = requireSession(payload);
      return { document: record.descriptor };
    },

    // 契约：FileSessionPersistRequest { sessionId, options? { filePath?, backup? } }
    [FILE_ACTIONS.SessionPersist]: (payload) => {
      const record = requireSession(payload);
      const options = toRecord(toRecord(payload).options);
      persistSession(record, typeof options.filePath === "string" ? options.filePath : undefined);
      return { document: record.descriptor };
    },

    // 契约：FileSessionCloseRequest { sessionId, options? { persist? } }
    [FILE_ACTIONS.SessionClose]: (payload) => {
      const record = requireSession(payload);
      const options = toRecord(toRecord(payload).options);
      if (options.persist === true) {
        persistSession(record);
      }
      sessions.delete(record.descriptor.sessionId);
      return { ack: true };
    },

    // 契约：FileSessionOpenRequest { filePath, format?, options? } —— 从工作区打开已持久化文件
    [FILE_ACTIONS.SessionOpen]: (payload) => {
      const record = toRecord(payload);
      const filePath = String(record.filePath ?? "");
      const stored = workspace.get(filePath);
      if (!stored) {
        throw fileSessionError(
          FILE_ERROR_CODES.ContentInvalid,
          `工作区中不存在该文件，无法打开会话: ${filePath}`,
          { filePath },
        );
      }
      const sessionId = `fs-session-${++sessionSeed}`;
      const format = String(record.format ?? PPTX_FORMAT);
      const descriptor: FileSessionDescriptor = {
        sessionId,
        documentId: `doc-${sessionId}`,
        filePath,
        fileName: fileNameFromPath(filePath),
        format,
        mimeType: PPTX_MIME_TYPE,
        size: stored.length,
        revision: 0,
        status: "clean",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      sessions.set(sessionId, { descriptor, bytes: Uint8Array.from(stored) });
      return { document: descriptor };
    },
  };

  const client = createMockChipsClient({
    // 走 node 传输直连 mock host，二进制载荷在同一进程内按引用传递，避免桥接层干扰
    installBridge: false,
    actions: handlers,
  });

  return { client, workspace, sessionPaths };
}

/** 逐字节断言两段字节完全一致（差异时给出首个差异字节，避免超大 diff 输出）。 */
function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      expect(`字节偏移 ${i}：actual=${actual[i]} expected=${expected[i]}`).toBe("");
      return;
    }
  }
  expect(actual.length).toBeGreaterThan(0);
}

// ============================================================================
// 最小生命周期：创建 → 写入 → 读取回读 → persist → 关闭
// ============================================================================

describe("file.session 最小生命周期（pptx-engine 最小 pptx 字节）", () => {
  it("创建会话（initialBytes 为最小 pptx）→ 回读字节一致 → 会话内字节可被引擎重新解析", async () => {
    const mock = createFileSessionMockClient();
    const { client } = mock;
    const blankBytes = await createBlankPptx();

    // 引擎前置校验：createBlankPptx 生成的是 openPptx 可解析的最小合法 pptx
    const blankDeck = await openPptx(blankBytes);
    expect(blankDeck.deck.slides).toHaveLength(1);

    const descriptor = await client.file.session.create({
      format: PPTX_FORMAT,
      fileName: "薯片演示.pptx",
      initialBytes: blankBytes,
    });

    expect(descriptor.sessionId).toBeTruthy();
    expect(descriptor.documentId).toBe(`doc-${descriptor.sessionId}`);
    expect(descriptor.format).toBe(PPTX_FORMAT);
    expect(descriptor.mimeType).toBe(PPTX_MIME_TYPE);
    expect(descriptor.fileName).toBe("薯片演示.pptx");
    expect(descriptor.filePath).toBe("/workspace/documents/薯片演示.pptx");
    expect(descriptor.size).toBe(blankBytes.length);
    expect(descriptor.revision).toBe(0);
    expect(descriptor.status).toBe("clean");
    expect(typeof descriptor.createdAt).toBe("string");
    expect(typeof descriptor.updatedAt).toBe("string");

    const read = await client.file.session.read({ sessionId: descriptor.sessionId });

    // FileSessionReadResult 契约字段
    expect(read.sessionId).toBe(descriptor.sessionId);
    expect(read.documentId).toBe(descriptor.documentId);
    expect(read.offset).toBe(0);
    expect(read.length).toBe(blankBytes.length);
    expect(read.totalSize).toBe(blankBytes.length);
    expect(read.revision).toBe(0);
    expectBytesEqual(read.bytes, blankBytes);

    // 回读字节与引擎语义无损：可直接重新解析
    const reparsedDeck = await openPptx(read.bytes);
    expect(reparsedDeck.deck.slides).toHaveLength(1);
  });

  it("写入更新字节 → 回读一致 → persist 后状态 clean → 关闭后再次读取返回 FILE_SESSION_NOT_FOUND", async () => {
    const mock = createFileSessionMockClient();
    const { client } = mock;

    // 引擎生成：初始 1 页 → 引擎编辑插入空白页 → 2 页的更新字节
    const blankBytes = await createBlankPptx();
    const opened = await openPptx(blankBytes);
    expect(insertBlankSlide(opened, 0)).not.toBeNull();
    const twoSlideBytes = await savePptx(opened);
    expect((await openPptx(twoSlideBytes)).deck.slides).toHaveLength(2);

    const descriptor = await client.file.session.create({
      format: PPTX_FORMAT,
      fileName: "薯片演示.pptx",
      initialBytes: blankBytes,
    });
    const sessionId = descriptor.sessionId;

    // 写入更新内容：FileSessionWriteResult 契约字段
    const write = (await client.file.session.write({
      sessionId,
      bytes: twoSlideBytes,
    })) as FileSessionWriteResult;
    expect(write.sessionId).toBe(sessionId);
    expect(write.documentId).toBe(descriptor.documentId);
    expect(write.revision).toBe(1);
    expect(write.size).toBe(twoSlideBytes.length);
    expect(write.status).toBe("dirty");

    // 写入后回读字节一致，且仍是引擎可解析的 2 页 pptx
    const readAfterWrite = await client.file.session.read({ sessionId });
    expect(readAfterWrite.revision).toBe(1);
    expectBytesEqual(readAfterWrite.bytes, twoSlideBytes);
    expect((await openPptx(readAfterWrite.bytes)).deck.slides).toHaveLength(2);

    // 会话元信息与写入结果同步
    const afterWrite = await client.file.session.get(sessionId);
    expect(afterWrite.revision).toBe(1);
    expect(afterWrite.status).toBe("dirty");
    expect(afterWrite.size).toBe(twoSlideBytes.length);

    // 持久化：状态回到 clean，工作区写入最新字节
    const afterPersist = await client.file.session.persist({ sessionId });
    expect(afterPersist.status).toBe("clean");
    expect(afterPersist.revision).toBe(1);
    expectBytesEqual(mock.workspace.get(afterPersist.filePath) ?? new Uint8Array(), twoSlideBytes);

    // 关闭：会话移除，后续读取按契约返回 FILE_SESSION_NOT_FOUND
    await expect(client.file.session.close({ sessionId })).resolves.toBeUndefined();
    await expect(client.file.session.read({ sessionId })).rejects.toMatchObject({
      code: FILE_ERROR_CODES.SessionNotFound,
    });
  });

  it("关闭后可按持久化路径重新 open，字节与关闭前一致（会话-文件往返）", async () => {
    const mock = createFileSessionMockClient();
    const { client } = mock;
    const blankBytes = await createBlankPptx();

    const descriptor = await client.file.session.create({
      format: PPTX_FORMAT,
      fileName: "薯片往返.pptx",
      initialBytes: blankBytes,
    });
    const sessionId = descriptor.sessionId;

    await client.file.session.write({ sessionId, bytes: blankBytes });
    await client.file.session.persist({ sessionId });
    await client.file.session.close({ sessionId });

    const reopened = await client.file.session.open({
      filePath: "/workspace/documents/薯片往返.pptx",
      format: PPTX_FORMAT,
    });
    expect(reopened.sessionId).not.toBe(descriptor.sessionId);
    expect(reopened.status).toBe("clean");

    const reread = await client.file.session.read({ sessionId: reopened.sessionId });
    expectBytesEqual(reread.bytes, blankBytes);
    expect((await openPptx(reread.bytes)).deck.slides).toHaveLength(1);
  });

  it("mock host 调用记录与 FILE_ACTIONS 路由名一一对应（契约路由口径）", async () => {
    const mock = createFileSessionMockClient();
    const { client } = mock;
    const bytes = await createBlankPptx();

    const descriptor = await client.file.session.create({
      format: PPTX_FORMAT,
      fileName: "路由对齐.pptx",
      initialBytes: bytes,
    });
    const sessionId = descriptor.sessionId;

    await client.file.session.read({ sessionId });
    await client.file.session.write({ sessionId, bytes });
    await client.file.session.get(sessionId);
    await client.file.session.persist({ sessionId });
    await client.file.session.close({ sessionId });

    const recordedActions = client.calls.map((call) => call.action);
    expect(recordedActions).toEqual([
      FILE_ACTIONS.SessionCreate,
      FILE_ACTIONS.SessionRead,
      FILE_ACTIONS.SessionWrite,
      FILE_ACTIONS.SessionGet,
      FILE_ACTIONS.SessionPersist,
      FILE_ACTIONS.SessionClose,
    ]);
    expect(FILE_ERROR_CODES.SessionNotFound).toBe("FILE_SESSION_NOT_FOUND");
  });
});

// ============================================================================
// 错误路径
// ============================================================================

describe("file.session 错误路径（契约 FILE_* 错误码）", () => {
  it("读取不存在的会话返回 FILE_SESSION_NOT_FOUND（契约错误码常量）", async () => {
    const { client } = createFileSessionMockClient();

    const error = await client.file.session
      .read({ sessionId: "fs-not-exists" })
      .then(
        () => {
          throw new Error("期望读取不存在的会话失败，但调用成功了");
        },
        (caught: unknown) => caught as StandardError,
      );

    expect(error.code).toBe(FILE_ERROR_CODES.SessionNotFound);
    expect(error.code).toBe("FILE_SESSION_NOT_FOUND");
    expect(typeof error.message).toBe("string");
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("对已关闭会话的 get / persist 同样返回 FILE_SESSION_NOT_FOUND", async () => {
    const { client } = createFileSessionMockClient();
    const bytes = await createBlankPptx();

    const descriptor = await client.file.session.create({
      format: PPTX_FORMAT,
      fileName: "已关闭.pptx",
      initialBytes: bytes,
    });
    await client.file.session.close({ sessionId: descriptor.sessionId });

    for (const attempt of [
      () => client.file.session.get(descriptor.sessionId),
      () => client.file.session.persist({ sessionId: descriptor.sessionId }),
      () => client.file.session.write({ sessionId: descriptor.sessionId, bytes }),
    ]) {
      const error = await attempt().then(
        () => {
          throw new Error("期望对已关闭会话的操作失败，但调用成功了");
        },
        (caught: unknown) => caught as StandardError,
      );
      expect(error.code).toBe(FILE_ERROR_CODES.SessionNotFound);
    }
  });

  it("打开工作区中不存在的文件返回 FILE_CONTENT_INVALID（mock 会话语义）", async () => {
    const { client } = createFileSessionMockClient();

    const error = await client.file.session
      .open({ filePath: "/workspace/documents/不存在.pptx", format: PPTX_FORMAT })
      .then(
        () => {
          throw new Error("期望打开不存在的文件失败，但调用成功了");
        },
        (caught: unknown) => caught as StandardError,
      );

    expect(error.code).toBe(FILE_ERROR_CODES.ContentInvalid);
  });

  it("SDK 客户端参数校验：空 sessionId 与非字节写入分别返回 INVALID_ARGUMENT", async () => {
    const { client } = createFileSessionMockClient();

    const emptySessionError = await client.file.session
      .read({ sessionId: "" })
      .then(
        () => {
          throw new Error("期望空 sessionId 校验失败，但调用成功了");
        },
        (caught: unknown) => caught as StandardError,
      );
    expect(emptySessionError.code).toBe("INVALID_ARGUMENT");

    const invalidBytesError = await client.file.session
      .write({
        sessionId: "fs-any",
        bytes: "不是字节" as unknown as Uint8Array,
      })
      .then(
        () => {
          throw new Error("期望非 Uint8Array 写入校验失败，但调用成功了");
        },
        (caught: unknown) => caught as StandardError,
      );
    expect(invalidBytesError.code).toBe("INVALID_ARGUMENT");
  });
});
