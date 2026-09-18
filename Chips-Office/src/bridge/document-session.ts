import type { Client, FileSessionDescriptor } from "chips-sdk";
import { formatMessage } from "../lib/messages";

/**
 * 文档会话助手：四个应用桥（word/sheet/slide/pdf）共享的 file.session 链路封装。
 *
 * 生命周期对齐《15-万能文件处理协议》§5.3：open → read/write → persist → close。
 * Host 不提供隐式自动保存；各应用桥按自身防抖策略调用 saveDocument。
 */

export interface OpenedDocument {
  session: FileSessionDescriptor;
  /** 文件原始字节（只读快照；后续以 write 覆盖会话内容） */
  bytes: Uint8Array;
  name: string;
  path: string;
}

export class DocumentSessionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DocumentSessionError";
    this.code = code;
  }
}

function toDocumentSessionError(error: unknown, fallbackMessage: string): DocumentSessionError {
  const standard = error as { code?: string; message?: string } | null;
  if (standard && typeof standard.code === "string" && typeof standard.message === "string") {
    return new DocumentSessionError(standard.code, standard.message);
  }
  return new DocumentSessionError("OFFICE_OPEN_FAILED", fallbackMessage);
}

/** 按路径打开文件会话并读取完整字节。 */
export async function openDocument(
  client: Client,
  filePath: string,
  format?: string,
): Promise<OpenedDocument> {
  try {
    const session = await client.file.session.open({
      filePath,
      format,
      options: { watch: true },
    });
    const read = await client.file.session.read({ sessionId: session.sessionId });
    return {
      session,
      bytes: read.bytes,
      name: session.fileName,
      path: session.filePath,
    };
  } catch (error) {
    throw toDocumentSessionError(error, formatMessage("office.open.failed"));
  }
}

/** 在工作区创建新文档会话（initialBytes 必须是合法的目标格式字节，不允许零字节占位）。 */
export async function createDocument(
  client: Client,
  input: { fileName: string; format: string; initialBytes?: Uint8Array },
): Promise<OpenedDocument> {
  try {
    const session = await client.file.session.create({
      format: input.format,
      fileName: input.fileName,
      initialBytes: input.initialBytes,
    });
    const read = await client.file.session.read({ sessionId: session.sessionId });
    return {
      session,
      bytes: read.bytes,
      name: session.fileName,
      path: session.filePath,
    };
  } catch (error) {
    throw toDocumentSessionError(error, formatMessage("office.open.failed"));
  }
}

/** 将字节写入会话并持久化到原路径。 */
export async function saveDocument(
  client: Client,
  sessionId: string,
  bytes: Uint8Array,
): Promise<FileSessionDescriptor> {
  try {
    await client.file.session.write({ sessionId, bytes });
    return await client.file.session.persist({ sessionId });
  } catch (error) {
    throw toDocumentSessionError(error, formatMessage("office.save.failed"));
  }
}

/** 另存为：用户选择目标路径后持久化会话到新路径。取消时返回 null。 */
export async function saveDocumentAs(
  client: Client,
  sessionId: string,
  defaultName: string,
): Promise<{ path: string; session: FileSessionDescriptor } | null> {
  let targetPath: string | null;
  try {
    targetPath = await client.platform.saveFile({ defaultPath: defaultName });
  } catch {
    throw new DocumentSessionError(
      "OFFICE_SAVE_DIALOG_FAILED",
      formatMessage("office.open.fileDialogFailed"),
    );
  }
  if (!targetPath) {
    return null;
  }
  try {
    const session = await client.file.session.persist({
      sessionId,
      options: { filePath: targetPath },
    });
    return { path: session.filePath, session };
  } catch (error) {
    throw toDocumentSessionError(error, formatMessage("office.save.failed"));
  }
}

/** 关闭会话；persistDirty=true 时先保存脏数据。 */
export async function closeDocument(
  client: Client,
  sessionId: string,
  options?: { persistDirty?: boolean },
): Promise<void> {
  await client.file.session.close({ sessionId, options: { persist: options?.persistDirty ?? false } });
}
