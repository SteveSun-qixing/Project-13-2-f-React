import { describe, expect, it } from "vitest";
import { createMockChipsClient } from "chips-sdk/testing";
import {
  DocumentSessionError,
  closeDocument,
  createDocument,
  openDocument,
  saveDocument,
  saveDocumentAs,
} from "../../src/bridge/document-session";

interface SessionRecord {
  sessionId: string;
  filePath: string;
  fileName: string;
  bytes: Uint8Array;
  revision: number;
}

/** 以内存会话表模拟 file.session.*（与 Host file-session-service 语义对齐的最小口径）。 */
function createSessionMock() {
  const sessions = new Map<string, SessionRecord>();
  let nextId = 1;

  const descriptor = (record: SessionRecord) => ({
    sessionId: record.sessionId,
    documentId: `doc-${record.sessionId}`,
    filePath: record.filePath,
    fileName: record.fileName,
    format: record.filePath.split(".").pop() ?? "binary",
    mimeType: "application/octet-stream",
    size: record.bytes.byteLength,
    revision: record.revision,
    status: "clean" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const actions = {
    "file.session.open": (payload: unknown) => {
      const { filePath } = payload as { filePath: string };
      const sessionId = `s-${nextId++}`;
      const bytes = new Uint8Array([1, 2, 3]);
      const record: SessionRecord = { sessionId, filePath, fileName: filePath.split("/").pop() ?? "", bytes, revision: 1 };
      sessions.set(sessionId, record);
      return { document: descriptor(record) };
    },
    "file.session.create": (payload: unknown) => {
      const { fileName, initialBytes } = payload as { fileName: string; initialBytes?: Uint8Array };
      const sessionId = `s-${nextId++}`;
      const filePath = `/ws/${fileName}`;
      const bytes = initialBytes ?? new Uint8Array();
      const record: SessionRecord = { sessionId, filePath, fileName, bytes, revision: 1 };
      sessions.set(sessionId, record);
      return { document: descriptor(record) };
    },
    "file.session.read": (payload: unknown) => {
      const { sessionId } = payload as { sessionId: string };
      const record = sessions.get(sessionId);
      if (!record) throw { code: "FILE_SESSION_NOT_FOUND", message: "not found" };
      return {
        document: descriptor(record),
        bytes: record.bytes,
        offset: 0,
        length: record.bytes.byteLength,
        totalSize: record.bytes.byteLength,
        revision: record.revision,
      };
    },
    "file.session.write": (payload: unknown) => {
      const { sessionId, bytes } = payload as { sessionId: string; bytes: Uint8Array };
      const record = sessions.get(sessionId);
      if (!record) throw { code: "FILE_SESSION_NOT_FOUND", message: "not found" };
      record.bytes = bytes;
      record.revision += 1;
      return { document: descriptor(record) };
    },
    "file.session.persist": (payload: unknown) => {
      const { sessionId, options } = payload as { sessionId: string; options?: { filePath?: string } };
      const record = sessions.get(sessionId);
      if (!record) throw { code: "FILE_SESSION_NOT_FOUND", message: "not found" };
      if (options?.filePath) record.filePath = options.filePath;
      return { document: descriptor(record) };
    },
    "file.session.close": (payload: unknown) => {
      const { sessionId } = payload as { sessionId: string };
      sessions.delete(sessionId);
      return { ack: true };
    },
    "platform.dialogSaveFile": () => ({ filePath: "/ws/另存为.docx" }),
  };

  return { actions, sessions };
}

function createClient(mock: ReturnType<typeof createSessionMock>) {
  return createMockChipsClient({
    permissions: ["file.read", "file.write", "platform.read"],
    actions: mock.actions,
  });
}

describe("文档会话助手", () => {
  it("openDocument 建立会话并读取完整字节", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    const opened = await openDocument(client, "/ws/报告.docx");
    expect(opened.path).toBe("/ws/报告.docx");
    expect(opened.name).toBe("报告.docx");
    expect(opened.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("saveDocument 写入并持久化后状态回到 clean", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    const opened = await openDocument(client, "/ws/报告.docx");
    const bytes = new Uint8Array([9, 9, 9, 9]);
    const descriptor = await saveDocument(client, opened.session.sessionId, bytes);
    expect(descriptor.revision).toBe(2);
    expect(descriptor.status).toBe("clean");
    const reread = await client.file.session.read({ sessionId: opened.session.sessionId });
    expect(reread.bytes).toEqual(bytes);
  });

  it("createDocument 携带初始字节并在工作区登记", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    const created = await createDocument(client, {
      fileName: "未命名.docx",
      format: "docx",
      initialBytes: new Uint8Array([7]),
    });
    expect(created.name).toBe("未命名.docx");
    expect(created.bytes).toEqual(new Uint8Array([7]));
    expect(mock.sessions.get(created.session.sessionId)?.bytes).toEqual(new Uint8Array([7]));
  });

  it("saveDocumentAs 走平台对话框并持久化到新路径", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    const opened = await openDocument(client, "/ws/报告.docx");
    const result = await saveDocumentAs(client, opened.session.sessionId, "报告.docx");
    expect(result?.path).toBe("/ws/另存为.docx");
    expect(result?.session.filePath).toBe("/ws/另存为.docx");
  });

  it("closeDocument 关闭后会话失效", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    const opened = await openDocument(client, "/ws/报告.docx");
    await closeDocument(client, opened.session.sessionId);
    await expect(client.file.session.read({ sessionId: opened.session.sessionId })).rejects.toMatchObject({
      code: "FILE_SESSION_NOT_FOUND",
    });
  });

  it("Host 标准错误归一化为 DocumentSessionError", async () => {
    const mock = createSessionMock();
    const client = createClient(mock);
    await expect(saveDocument(client, "missing-session", new Uint8Array())).rejects.toBeInstanceOf(
      DocumentSessionError,
    );
  });
});
