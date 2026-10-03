/**
 * word 域保存链（导入 → 编辑基线 → 持久化编排；能力面唯一出口）。
 *
 * 落盘经 `file:*` 正式能力链（已注册契约面）：`file:read`（base64 导入）与
 * `file:write`（base64 落盘；临时文件 + 原子替换在能力侧），icon-maker 落盘臂判例同源。
 * 契约口径（08-官方应用功能总览 §七）：office 产物为普通文件，不经 `document:*`
 * 卡片/箱子链；受控提交编排归 file-processing 服务（chips.service.content-office，
 * 在途，工单059 族在册）——宿主能力未就绪时如实回码，禁止伪造成功。
 *
 * 能力调用以注入函数承载（端口反转，slide 臂 formatter 判例同型）：生产装配传
 * `chips.request`，测试传记录调用形状的 invoker。零 Node IO、零自造 ID。
 */

import type { WordDocument } from '../domain/document-model';
import { documentToMarkdown } from '../domain/markdown-mapping';
import { readWordDocument, writeWordDocument } from '../gateway/docx-gateway';

/** 能力调用形（与 `chips.request` 同签名）。 */
export type WordCapabilityRequest = (capability: string, payload: unknown) => Promise<unknown>;

/** 导入成功结果：域模型 + Markdown 编辑基线 + 原始字节（脏判基线用）+ 来源路径。 */
export interface WordImportSuccess {
  readonly status: 'imported';
  readonly path: string;
  readonly document: WordDocument;
  readonly markdown: string;
  readonly bytes: Buffer;
}

/** 导入失败结果：错误码非空、消息如实透传真实原因。 */
export interface WordImportFailure {
  readonly status: 'failed';
  readonly path: string;
  readonly errorCode: string;
  readonly message: string;
}

/** 持久化成功结果。 */
export interface WordPersistSuccess {
  readonly status: 'written';
  readonly path: string;
}

/** 持久化失败结果：错误码非空、消息如实说明未写入。 */
export interface WordPersistFailure {
  readonly status: 'failed';
  readonly path: string;
  readonly errorCode: string;
  readonly message: string;
}

/** 读取错误对象上的结构化错误码（ChipsError 或带 code 的普通对象）。 */
export function resolveErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return null;
}

/** 读取错误对象上的非空 message（无则空串）。 */
function resolveErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

/** base64 → 字节（`file:read` 契约的二进制载荷还原）。 */
export function decodeBase64Bytes(data: string): Buffer {
  return Buffer.from(data, 'base64');
}

/** 字节 → base64（`file:write` 契约的二进制载荷形态；分块避免超长字符串拼接溢出）。 */
export function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * 从路径导入 docx：`file:read`（base64）真调 → 网关解析 → 域模型 + 编辑基线。
 *
 * 能力错误与解析错误都收敛为 `failed` 结果（错误码如实上报；解析错误统一归
 * `WORD_IMPORT_PARSE_FAILED`），不抛出、不伪造成功。
 */
export async function importWordDocumentFromPath(
  request: WordCapabilityRequest,
  path: string,
): Promise<WordImportSuccess | WordImportFailure> {
  try {
    const response = (await request('file:read', { path, encoding: 'base64' })) as {
      content?: unknown;
      encoding?: unknown;
    };
    if (typeof response?.content !== 'string' || response.encoding !== 'base64') {
      return {
        status: 'failed',
        path,
        errorCode: 'WORD_IMPORT_PAYLOAD_INVALID',
        message: '导入失败：file:read 回执缺少 base64 内容字段。',
      };
    }
    const bytes = decodeBase64Bytes(response.content);
    const document = await readWordDocument(bytes);
    return { status: 'imported', path, document, markdown: documentToMarkdown(document), bytes };
  } catch (error: unknown) {
    const errorCode = resolveErrorCode(error) ?? 'WORD_IMPORT_PARSE_FAILED';
    const detail = resolveErrorMessage(error);
    return {
      status: 'failed',
      path,
      errorCode,
      message: detail.length > 0 ? `导入失败：${detail}` : `导入失败：能力返回错误（${errorCode}）。`,
    };
  }
}

/**
 * 把域文档序列化为 docx 并经 `file:write`（base64）落盘。
 *
 * 序列化在调用侧先行完成（失败臂在写入前暴露）；写入失败如实回码并说明未写入，
 * 不抛出、不重试、不伪造成功。
 */
export async function persistWordDocument(
  request: WordCapabilityRequest,
  path: string,
  document: WordDocument,
): Promise<WordPersistSuccess | WordPersistFailure> {
  let bytes: Buffer;
  try {
    bytes = await writeWordDocument(document);
  } catch (error: unknown) {
    const errorCode = resolveErrorCode(error) ?? 'WORD_EXPORT_SERIALIZE_FAILED';
    return {
      status: 'failed',
      path,
      errorCode,
      message: `导出失败：文档序列化未完成（${errorCode}）。未写入任何文件。`,
    };
  }
  try {
    await request('file:write', { path, data: encodeBase64Bytes(bytes), encoding: 'base64' });
  } catch (error: unknown) {
    const errorCode = resolveErrorCode(error) ?? 'WORD_EXPORT_WRITE_FAILED';
    const detail = resolveErrorMessage(error);
    return {
      status: 'failed',
      path,
      errorCode,
      message:
        detail.length > 0
          ? `落盘未完成：写入能力返回错误（${errorCode}；${detail}）。文档仍在编辑面，未写入任何虚假成功状态。`
          : `落盘未完成：写入能力返回错误（${errorCode}）。文档仍在编辑面，未写入任何虚假成功状态。`,
    };
  }
  return { status: 'written', path };
}
