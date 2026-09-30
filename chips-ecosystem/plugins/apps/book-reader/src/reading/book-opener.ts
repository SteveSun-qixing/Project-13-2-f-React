/**
 * 打开臂（《14-资源打开与默认处理器契约》§5、§9）：
 *
 * - 被打开臂：经 `chips.subscribe('resource:opened')`（§5.5 标准事件）接收上下文，
 *   以 `chips.resource(uri)` 资源句柄读取字节——`read()` 单次上限 8 MiB
 *   （06-资源协议规范 §六），超限属于流式承载链路（15-契约 §五）未落，如实报错；
 * - 发起臂：应用内发起的书籍打开一律经 `chips.request('resource:open', …)` 正式面
 *   请求书籍槽位路由，禁止绕过路由直连文件系统。
 */

import { chips, type IResourceOpenContext, type IResourceOpenRequest } from '@chips/sdk';
import { createBookSourceDescriptor, type BookSourceDescriptor } from '../core/book-model';

/** `read()` 单次读取上限（06-资源协议规范 §六）。 */
export const RESOURCE_READ_MAX_BYTES = 8 * 1024 * 1024;

/** 打开臂失败形态：界面按形态给出行内简体中文提示，不伪造成功。 */
export type BookOpenFailure =
  | { kind: 'resource-unavailable'; message: string }
  | { kind: 'too-large'; message: string; size: number }
  | { kind: 'unsupported'; message: string }
  | { kind: 'invalid'; message: string };

export type BookOpenOutcome =
  | { kind: 'ok'; bytes: Uint8Array; source: BookSourceDescriptor; mimeType: string }
  | { kind: 'failure'; failure: BookOpenFailure };

/** 把资源打开上下文收窄为书源描述符（标题、MIME 与格式按上下文补全）。 */
export function createSourceFromOpenContext(context: IResourceOpenContext): BookSourceDescriptor {
  const payload = context.payload as
    { display?: { title?: unknown; author?: unknown } } | undefined;
  const displayTitle = typeof payload?.display?.title === 'string' ? payload.display.title : '';
  const displayAuthor = typeof payload?.display?.author === 'string' ? payload.display.author : '';
  const fileName = context.fileName ?? context.uri.split('/').pop()?.split('?')[0] ?? context.uri;

  return createBookSourceDescriptor({
    sourceId: context.uri,
    fileName,
    mimeType: context.mimeType,
    title: displayTitle || context.title || fileName,
    author: displayAuthor || undefined,
  });
}

/** 组装 `resource:open` 正式面请求（发起臂；MIME 省略，由平台按扩展名推断，14 §2.2）。 */
export function buildResourceOpenRequest(input: {
  uri: string;
  fileName?: string;
  title?: string;
}): IResourceOpenRequest {
  return {
    intent: 'view',
    resource: {
      uri: input.uri,
      ...(input.fileName === undefined ? {} : { fileName: input.fileName }),
      ...(input.title === undefined ? {} : { title: input.title }),
    },
  };
}

/** 经 `resource:open` 正式面发起书籍打开（宿主路由未就绪时按原样抛错，由界面行内呈现）。 */
export async function requestBookOpen(input: {
  uri: string;
  fileName?: string;
  title?: string;
}): Promise<void> {
  await chips.request('resource:open', buildResourceOpenRequest(input));
}

/** 以资源句柄读取书籍字节（8 MiB 上限守卫；超限不降级、不伪造）。 */
export async function readBookFromUri(
  uri: string,
  source: BookSourceDescriptor
): Promise<BookOpenOutcome> {
  let handle: ReturnType<typeof chips.resource>;
  try {
    handle = chips.resource(uri);
  } catch (error: unknown) {
    return {
      kind: 'failure',
      failure: {
        kind: 'resource-unavailable',
        message: toFailureMessage(error, '资源通道不可用，无法读取该书籍资源。'),
      },
    };
  }

  let metadata: { size: number; mimeType: string };
  try {
    const resolved = await handle.metadata();
    metadata = { size: resolved.size, mimeType: resolved.mimeType };
  } catch (error: unknown) {
    return {
      kind: 'failure',
      failure: {
        kind: 'resource-unavailable',
        message: toFailureMessage(error, '资源元数据读取失败，无法打开该书籍资源。'),
      },
    };
  }

  if (metadata.size > RESOURCE_READ_MAX_BYTES) {
    return {
      kind: 'failure',
      failure: {
        kind: 'too-large',
        size: metadata.size,
        message: `该书籍约 ${Math.ceil(metadata.size / (1024 * 1024))} MiB，超过单次读取上限 8 MiB；流式读取链路尚未就绪，暂无法打开。`,
      },
    };
  }

  try {
    const bytes = await handle.read();
    return {
      kind: 'ok',
      bytes,
      source: { ...source, resourceUri: uri },
      mimeType: metadata.mimeType || source.mimeType || '',
    };
  } catch (error: unknown) {
    return {
      kind: 'failure',
      failure: {
        kind: 'resource-unavailable',
        message: toFailureMessage(error, '书籍资源读取失败，无法打开该书籍。'),
      },
    };
  }
}

function toFailureMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return `${fallback}（${message.trim()}）`;
    }
  }
  return fallback;
}
