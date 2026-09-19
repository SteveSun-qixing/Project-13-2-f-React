/**
 * Mock 资源夹具与句柄（02-SDK-API规范 §7.2「resource / invalidate」行、06-资源协议规范 §2、§6）。
 *
 * 职责边界：Mock 只提供资源数据与句柄状态机，不做作用域授权、协议处理器解析与字节分段读取的
 * 平台实现（§7.1）；句柄状态与错误码口径与 `IResourceHandle` 的权威说明一致——
 * `released` 之后除 `uri`、`state` 与 `release()` 外一律以 `RESOURCE_HANDLE_RELEASED` 失败。
 */

import type {
  IResourceHandle,
  IResourceMetadata,
  ResourceInvalidateReason,
  ResourceState,
  ISubscription,
} from '../types/bridge.js';
import { MOCK_ERROR_CODES, mockError } from './codes.js';

/** Mock 资源夹具。 */
export interface IMockResourceInit {
  /** 资源内容；`string` 按 UTF-8 计入 `size`。 */
  readonly data: Uint8Array | string;
  /** MIME 类型；省略时为 `application/octet-stream`。 */
  readonly mimeType?: string;
  /** 资源版本；省略时为 `1`。 */
  readonly version?: string;
}

/** `chips-resource://` 协议前缀（06-资源协议规范 §2.1）。 */
const RESOURCE_URI_PREFIX = 'chips-resource://';

/** 作用域段语法（06-资源协议规范 §2.2 authority 段）。 */
const AUTHORITY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** 缺省 MIME 与版本。 */
const DEFAULT_MIME_TYPE = 'application/octet-stream';
const DEFAULT_VERSION = '1';

/** Mock 夹具的作用域口径：内容全部驻留内存，不参与真实作用域解析。 */
const MOCK_RESOURCE_SCOPE = 'memory' as const;

/**
 * 计算夹具的字节长度。
 *
 * @param data - 资源内容
 * @returns UTF-8 字节长度
 */
function byteLength(data: Uint8Array | string): number {
  return typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength;
}

/**
 * 取夹具的字节副本。
 *
 * @param data - 资源内容
 * @returns 不与夹具共享内存的字节数组
 */
function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
}

/** 字符串是否含 ASCII 控制字符（06-资源协议规范 §2.3）。 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * 校验 `chips-resource://` URI 语法。
 *
 * 规则取自 06-资源协议规范 §2：协议前缀固定、authority 为作用域段、路径以 `/` 分隔且拒绝
 * 空段与 `.` / `..`（含一次百分号解码后）、拒绝反斜杠与控制字符与 fragment；查询串只允许
 * `external` 作用域保留。
 *
 * @param uri - 待校验的 URI
 * @returns 非法时返回拒绝原因，合法时返回 `undefined`
 */
export function mockUriFailureReason(uri: string): string | undefined {
  if (!uri.startsWith(RESOURCE_URI_PREFIX)) {
    return '协议前缀不是 chips-resource://';
  }
  const remainder = uri.slice(RESOURCE_URI_PREFIX.length);
  if (hasControlCharacter(uri)) {
    return '含 ASCII 控制字符';
  }
  if (uri.includes('\\')) {
    return '含反斜杠分隔符';
  }
  if (remainder.includes('#')) {
    return '含 fragment 段';
  }
  const queryIndex = remainder.indexOf('?');
  const pathPart = queryIndex === -1 ? remainder : remainder.slice(0, queryIndex);
  const queryPart = queryIndex === -1 ? undefined : remainder.slice(queryIndex + 1);
  if (queryPart !== undefined && queryPart.length === 0) {
    return '查询串为空';
  }
  const slashIndex = pathPart.indexOf('/');
  const authority = slashIndex === -1 ? pathPart : pathPart.slice(0, slashIndex);
  const path = slashIndex === -1 ? '' : pathPart.slice(slashIndex + 1);
  if (!AUTHORITY_PATTERN.test(authority)) {
    return '作用域段语法不合法';
  }
  if (queryPart !== undefined && authority !== 'external') {
    return '受管作用域禁止查询串';
  }
  if (path.length === 0) {
    return '缺少作用域内路径';
  }
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      return '路径段为空或为点段';
    }
  }
  // 百分号解码仅一次；解码后按 `/` 重新分段并重新执行点段校验（2.4 / 2.6 节）
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    return '百分号编码不合法';
  }
  for (const segment of decodedPath.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      return '解码后路径段为空或为点段';
    }
  }
  return undefined;
}

/** 资源夹具读取器：每次访问时读取当前资源表。 */
export type MockResourceLookup = () => IMockResourceInit | undefined;

/** 失效通知订阅项；`active` 支持同一 handler 多次订阅各自独立退订。 */
interface InvalidateEntry {
  readonly handler: (reason: ResourceInvalidateReason) => void;
  active: boolean;
}

/**
 * Mock 资源句柄。
 *
 * 状态机：`open` →（`release()`）→ `released`；`open` →（`invalidate()`）→ `invalidated`。
 * 终态不可回退，二者互斥，后到者不覆盖已到的终态。
 */
export class MockResourceHandle implements IResourceHandle {
  readonly uri: string;

  #state: ResourceState = 'open';

  #reason: ResourceInvalidateReason | undefined;

  readonly #lookup: MockResourceLookup;

  readonly #invalidateEntries: InvalidateEntry[] = [];

  constructor(uri: string, lookup: MockResourceLookup) {
    this.uri = uri;
    this.#lookup = lookup;
  }

  /** 当前句柄状态。 */
  get state(): ResourceState {
    return this.#state;
  }

  /**
   * 读取元数据；首次调用即夹具读取，不模拟主进程 `open` 往返。
   *
   * @returns 元数据；句柄终态或未登记资源时以对应错误码拒绝
   */
  async metadata(): Promise<IResourceMetadata> {
    const fixture = this.#requireFixture();
    return {
      uri: this.uri,
      size: byteLength(fixture.data),
      mimeType: fixture.mimeType ?? DEFAULT_MIME_TYPE,
      version: fixture.version ?? DEFAULT_VERSION,
      scope: MOCK_RESOURCE_SCOPE,
    };
  }

  /**
   * 读取完整字节。
   *
   * @returns 不与夹具共享内存的字节数组；句柄终态或未登记资源时以对应错误码拒绝
   */
  async read(): Promise<Uint8Array> {
    return toBytes(this.#requireFixture().data);
  }

  /**
   * 按偏移读取片段。
   *
   * @param offset - 起始字节偏移
   * @param length - 读取长度，至少为 1
   * @returns 片段字节；越界以 `BRIDGE_INVALID_INPUT` 拒绝
   */
  async readRange(offset: number, length: number): Promise<Uint8Array> {
    const bytes = toBytes(this.#requireFixture().data);
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 1) {
      throw mockError(MOCK_ERROR_CODES.invalidInput, '资源读取范围不合法', {
        uri: this.uri,
        offset,
        length,
      });
    }
    if (offset + length > bytes.byteLength) {
      throw mockError(MOCK_ERROR_CODES.invalidInput, '资源读取范围超出资源长度', {
        uri: this.uri,
        offset,
        length,
        size: bytes.byteLength,
      });
    }
    return bytes.subarray(offset, offset + length);
  }

  /**
   * 流式读取整个资源。
   *
   * @returns 字节流；句柄终态或未登记资源时，流以对应错误立即失败
   */
  stream(): ReadableStream<Uint8Array> {
    let chunk: Uint8Array;
    try {
      chunk = toBytes(this.#requireFixture().data);
    } catch (error) {
      return new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.error(error);
        },
      });
    }
    return new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(chunk);
        controller.close();
      },
    });
  }

  /**
   * 释放句柄；幂等，释放后不再接收失效通知。
   */
  release(): void {
    if (this.#state === 'released') {
      return;
    }
    this.#state = 'released';
    this.#invalidateEntries.length = 0;
  }

  /**
   * 订阅失效通知。
   *
   * 与 06-资源协议规范 6.4 一致：句柄已失效后再注册，下一微任务立即回调一次失效原因，
   * 返回的订阅已是失效态（`dispose()` 无操作）；句柄已释放则拒绝 `RESOURCE_HANDLE_RELEASED`。
   *
   * @param handler - 失效原因回调；同一 handler 多次订阅各自独立
   * @returns 可退订句柄，`dispose()` 幂等
   * @throws ChipsError 句柄已释放时抛 `RESOURCE_HANDLE_RELEASED`
   */
  onInvalidate(handler: (reason: ResourceInvalidateReason) => void): ISubscription {
    if (this.#state === 'released') {
      throw mockError(MOCK_ERROR_CODES.handleReleased, '资源句柄已释放，无法订阅失效通知', {
        uri: this.uri,
      });
    }
    if (this.#state === 'invalidated') {
      const reason = this.#reason;
      if (reason !== undefined) {
        queueMicrotask(() => {
          handler(reason);
        });
      }
      return {
        dispose: (): void => undefined,
      };
    }
    const entry: InvalidateEntry = { handler, active: true };
    this.#invalidateEntries.push(entry);
    return {
      dispose: (): void => {
        if (!entry.active) {
          return;
        }
        entry.active = false;
        const index = this.#invalidateEntries.indexOf(entry);
        if (index !== -1) {
          this.#invalidateEntries.splice(index, 1);
        }
      },
    };
  }

  /**
   * 使句柄失效并同步派发失效原因；终态句柄不再受影响。
   *
   * @param reason - 失效原因
   */
  invalidate(reason: ResourceInvalidateReason): void {
    if (this.#state !== 'open') {
      return;
    }
    this.#state = 'invalidated';
    this.#reason = reason;
    const entries = [...this.#invalidateEntries];
    this.#invalidateEntries.length = 0;
    for (const entry of entries) {
      entry.active = false;
      entry.handler(reason);
    }
  }

  /**
   * 终态检查与夹具读取。
   *
   * @returns 资源夹具
   * @throws ChipsError 句柄 `released` / `invalidated` 或资源未登记时按对应错误码抛出
   */
  #requireFixture(): IMockResourceInit {
    if (this.#state === 'released') {
      throw mockError(MOCK_ERROR_CODES.handleReleased, '资源句柄已释放，无法继续访问', {
        uri: this.uri,
      });
    }
    if (this.#state === 'invalidated') {
      throw mockError(MOCK_ERROR_CODES.handleInvalidated, '资源句柄已失效，请重新获取句柄', {
        uri: this.uri,
      });
    }
    const fixture = this.#lookup();
    if (fixture === undefined) {
      throw mockError(MOCK_ERROR_CODES.notFound, '资源不存在或未在 Mock 中登记', {
        uri: this.uri,
      });
    }
    return fixture;
  }
}
