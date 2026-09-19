import { expect, type ElectronApplication, type FrameLocator, type Page } from '@playwright/test';

import { DEFAULT_RENDER_TIMEOUT_MS } from './environment';
import type {
  ChipsResourceMetadata,
  DocumentCreateInput,
  DocumentCreateOutput,
  DocumentExportInput,
  DocumentExportOutput,
  DocumentOpenInput,
  DocumentOpenOutput,
  DocumentReadInput,
  DocumentReadOutput,
  DocumentSaveOutput,
  DocumentSessionSnapshot,
  DocumentWriteInput,
  DocumentWriteOutput,
  FrameSummary,
  ResourceSnapshot,
  WindowInfo,
  WindowListOutput,
} from './types';

/** 断言工具默认轮询间隔。 */
const POLL_INTERVAL_MS = 100;

export interface PollOptions {
  /** 超时；默认取渲染超时。 */
  readonly timeoutMs?: number;
  /** 失败信息前缀。 */
  readonly message?: string;
}

// ---------------------------------------------------------------------------
// 通用
// ---------------------------------------------------------------------------

/** 判定一个值是否为结构化桥接错误（带 `<DOMAIN>_<REASON>` 形状的 `code`）。 */
export function isChipsErrorCode(value: unknown, code?: string): boolean {
  const candidate = (value as { code?: unknown } | null | undefined)?.code;
  if (typeof candidate !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(candidate)) {
    return false;
  }
  return code === undefined || candidate === code;
}

/**
 * 订阅一次事件并等待首个载荷。
 *
 * 事件名必须来自《事件契约规范》；用法例订阅标准事件（如 `document:opened`）。
 */
export async function waitForEvent<T = unknown>(
  page: Page,
  eventId: string,
  options: PollOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  return page.evaluate(
    ({ eventId: id, timeoutMs: timeout }) =>
      new Promise<unknown>((resolve, reject) => {
        const bridge = (window as unknown as { chips: { subscribe: unknown } }).chips as {
          subscribe(eventId: string, handler: (payload: unknown) => void): { dispose(): void };
        };
        const timer = setTimeout(() => {
          subscription.dispose();
          reject(new Error(`[chips-e2e] 等待事件超时：${id}（${timeout}ms）`));
        }, timeout);
        const subscription = bridge.subscribe(id, (payload) => {
          clearTimeout(timer);
          subscription.dispose();
          resolve(payload);
        });
      }),
    { eventId, timeoutMs }
  ) as Promise<T>;
}

// ---------------------------------------------------------------------------
// 窗口断言
// ---------------------------------------------------------------------------

/** 经 `window:list` 读取调用方可访问的窗口摘要。 */
export async function listWindows(page: Page): Promise<readonly WindowInfo[]> {
  const output = await page.evaluate(async () => {
    const bridge = (window as unknown as { chips: { request: unknown } }).chips as {
      request<T>(capabilityId: string, input?: unknown): Promise<T>;
    };
    return bridge.request<WindowListOutput>('window:list', {});
  });
  return output.windows;
}

/** 等待出现满足条件的窗口；返回首个命中项。 */
export async function waitForWindow(
  page: Page,
  predicate: (windowInfo: WindowInfo) => boolean,
  options: PollOptions = {}
): Promise<WindowInfo> {
  return pollUntil(
    async () => (await listWindows(page)).find(predicate) ?? null,
    options,
    '等待窗口出现'
  );
}

/** Electron 层面统计应用窗口数量并等待达到下限。 */
export async function waitForApplicationWindows(
  app: ElectronApplication,
  minimum: number,
  options: PollOptions = {}
): Promise<readonly Page[]> {
  return pollUntil(
    () => {
      const windows = app.windows();
      return Promise.resolve(windows.length >= minimum ? windows : null);
    },
    options,
    `等待应用窗口数量达到 ${minimum}`
  );
}

/** 断言窗口列表满足条件；不满足时由 `expect` 输出差异。 */
export async function expectWindowList(
  page: Page,
  expectation: {
    readonly minimum?: number;
    readonly titleContains?: string;
    readonly state?: WindowInfo['state'];
    readonly focused?: boolean;
  }
): Promise<void> {
  const windows = await listWindows(page);
  if (expectation.minimum !== undefined) {
    expect(windows.length, '窗口数量').toBeGreaterThanOrEqual(expectation.minimum);
  }
  if (expectation.titleContains !== undefined) {
    const title = expectation.titleContains;
    expect(
      windows.some((windowInfo) => windowInfo.title.includes(title)),
      `窗口标题包含「${title}」`
    ).toBe(true);
  }
  if (expectation.state !== undefined) {
    expect(
      windows.some((windowInfo) => windowInfo.state === expectation.state),
      `存在状态为 ${expectation.state} 的窗口`
    ).toBe(true);
  }
  if (expectation.focused !== undefined) {
    expect(
      windows.some((windowInfo) => windowInfo.focused === expectation.focused),
      `存在 focused=${String(expectation.focused)} 的窗口`
    ).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// 渲染帧断言
// ---------------------------------------------------------------------------

/** 读取页面中全部 iframe 的可观察摘要（沙箱属性、尺寸）。 */
export async function listFrames(page: Page): Promise<readonly FrameSummary[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('iframe')).map((element, index) => {
      const rect = element.getBoundingClientRect();
      const sandbox = element.getAttribute('sandbox') ?? '';
      return {
        index,
        src: element.getAttribute('src') ?? '',
        sandbox: sandbox.split(/\s+/).filter((token) => token.length > 0),
        width: rect.width,
        height: rect.height,
      };
    })
  );
}

export interface RenderFrameHandle {
  /** 承载帧的窗口。 */
  readonly page: Page;
  /** 帧的 DOM 摘要。 */
  readonly frame: FrameSummary;
  /** 帧内容定位器；用于 `innerText` 等断言。 */
  readonly frameLocator: FrameLocator;
}

/** 渲染帧已落位的最小高度（px）；用于排除 iframe 仅剩边框尺寸、尚未收到高度上报的状态。 */
export const DEFAULT_FRAME_MINIMUM_HEIGHT = 24;

/**
 * 等待渲染帧就绪。
 *
 * 就绪判据为《渲染引擎设计》§9.4 的外部可观察面：父帧已接受子帧上报的高度并落位，
 * iframe 尺寸大于零；不读取帧内部私有状态。默认最小高度排除「仅边框」的初始尺寸。
 */
export async function waitForRenderFrame(
  page: Page,
  options: PollOptions & { readonly minimumHeight?: number } = {}
): Promise<RenderFrameHandle> {
  const minimumHeight = options.minimumHeight ?? DEFAULT_FRAME_MINIMUM_HEIGHT;
  const frame = await pollUntil(
    async () => {
      const frames = await listFrames(page);
      return frames.find((candidate) => candidate.height >= minimumHeight) ?? null;
    },
    options,
    '等待渲染帧就绪'
  );
  return {
    page,
    frame,
    frameLocator: page.locator('iframe').nth(frame.index).contentFrame(),
  };
}

/** 在应用全部窗口中定位首个已就绪的渲染帧。 */
export async function findRenderFrame(
  app: ElectronApplication,
  options: PollOptions & { readonly minimumHeight?: number } = {}
): Promise<RenderFrameHandle> {
  const minimumHeight = options.minimumHeight ?? DEFAULT_FRAME_MINIMUM_HEIGHT;
  return pollUntil(
    async () => {
      for (const candidate of app.windows()) {
        try {
          const frames = await listFrames(candidate);
          const frame = frames.find((item) => item.height >= minimumHeight);
          if (frame !== undefined) {
            return {
              page: candidate,
              frame,
              frameLocator: candidate.locator('iframe').nth(frame.index).contentFrame(),
            };
          }
        } catch {
          // 窗口在枚举过程中被销毁属正常竞争，继续扫描其余窗口。
        }
      }
      return null;
    },
    options,
    '等待任一窗口出现渲染帧'
  );
}

/** 读取帧内可见文本。 */
export async function readFrameText(handle: RenderFrameHandle): Promise<string> {
  return handle.frameLocator.locator('body').innerText();
}

/** 等待帧内文本包含目标片段；用于查看态与编辑回流后的渲染断言。 */
export async function expectFrameContainsText(
  handle: RenderFrameHandle,
  text: string,
  options: PollOptions = {}
): Promise<void> {
  await pollUntil(
    async () => {
      try {
        const content = await readFrameText(handle);
        return content.includes(text) ? content : null;
      } catch {
        return null;
      }
    },
    options,
    `等待帧内文本包含「${text}」`
  );
}

// ---------------------------------------------------------------------------
// 资源断言
// ---------------------------------------------------------------------------

/** 经 `chips.resource(uri)` 读取元数据与内容；句柄在读取后释放。 */
export async function readResource(page: Page, uri: string): Promise<ResourceSnapshot> {
  return page.evaluate(async (target: string) => {
    const bridge = (window as unknown as { chips: { resource: unknown } }).chips as {
      resource(uri: string): {
        metadata(): Promise<ChipsResourceMetadata>;
        read(): Promise<Uint8Array>;
        release(): void;
      };
    };
    const handle = bridge.resource(target);
    try {
      const metadata = await handle.metadata();
      const bytes = await handle.read();
      const textual = /^(text\/|application\/(json|yaml|xml|markdown))/.test(metadata.mimeType);
      return {
        uri: target,
        metadata,
        text: textual ? new TextDecoder().decode(bytes) : null,
        byteLength: bytes.byteLength,
      };
    } finally {
      handle.release();
    }
  }, uri);
}

/** 断言资源元数据满足期望。 */
export async function expectResource(
  page: Page,
  uri: string,
  expectation: {
    readonly mimeType?: string;
    readonly scope?: ChipsResourceMetadata['scope'];
    readonly minimumSize?: number;
    readonly textContains?: string;
  }
): Promise<ResourceSnapshot> {
  const snapshot = await readResource(page, uri);
  if (expectation.mimeType !== undefined) {
    expect(snapshot.metadata.mimeType, '资源 MIME').toBe(expectation.mimeType);
  }
  if (expectation.scope !== undefined) {
    expect(snapshot.metadata.scope, '资源作用域').toBe(expectation.scope);
  }
  if (expectation.minimumSize !== undefined) {
    expect(snapshot.byteLength, '资源字节数').toBeGreaterThanOrEqual(expectation.minimumSize);
  }
  if (expectation.textContains !== undefined) {
    expect(snapshot.text ?? '', '资源文本内容').toContain(expectation.textContains);
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// 文档会话断言
// ---------------------------------------------------------------------------

/** `document:create`：新建文档并返回稳定标识与受管引用。 */
export async function createDocument(
  page: Page,
  input: DocumentCreateInput
): Promise<DocumentCreateOutput> {
  return requestCapability<DocumentCreateOutput>(page, 'document:create', input);
}

/** `document:open`：打开文档并返回会话入口字段。 */
export async function openDocument(
  page: Page,
  input: DocumentOpenInput
): Promise<DocumentOpenOutput> {
  return requestCapability<DocumentOpenOutput>(page, 'document:open', input);
}

/** `document:read`：读取模型切片。 */
export async function readDocumentPart<TValue = unknown>(
  page: Page,
  input: DocumentReadInput
): Promise<DocumentReadOutput<TValue>> {
  return requestCapability<DocumentReadOutput<TValue>>(page, 'document:read', input);
}

/** `document:write`：写入模型切片并返回推进后的修订号。 */
export async function writeDocumentPart(
  page: Page,
  input: DocumentWriteInput
): Promise<DocumentWriteOutput> {
  return requestCapability<DocumentWriteOutput>(page, 'document:write', input);
}

/** `document:save`：持久化并返回保存后的引用与摘要。 */
export async function saveDocument(page: Page, documentId: string): Promise<DocumentSaveOutput> {
  return requestCapability<DocumentSaveOutput>(page, 'document:save', { documentId });
}

/** `document:export`：以归档或目录形态导出文档。 */
export async function exportDocument(
  page: Page,
  input: DocumentExportInput
): Promise<DocumentExportOutput> {
  return requestCapability<DocumentExportOutput>(page, 'document:export', input);
}

/** 组合读取一次文档会话的 metadata / structure / content（卡片需给 `nodeId`）。 */
export async function readDocumentSession(
  page: Page,
  options: { readonly documentId: string; readonly nodeId?: string }
): Promise<DocumentSessionSnapshot> {
  const metadata = await readDocumentPart<Record<string, unknown>>(page, {
    documentId: options.documentId,
    part: 'metadata',
  });
  const structure = await readDocumentPart<Record<string, unknown>>(page, {
    documentId: options.documentId,
    part: 'structure',
  });
  const content =
    options.nodeId === undefined
      ? null
      : (
          await readDocumentPart<Record<string, unknown>>(page, {
            documentId: options.documentId,
            part: 'content',
            nodeId: options.nodeId,
          })
        ).value;
  return { metadata: metadata.value, structure: structure.value, content };
}

/** 轮询文档切片直到满足条件；用于「写入后回流」类断言。 */
export async function waitForDocumentPart<TValue = unknown>(
  page: Page,
  input: DocumentReadInput,
  predicate: (output: DocumentReadOutput<TValue>) => boolean,
  options: PollOptions = {}
): Promise<DocumentReadOutput<TValue>> {
  return pollUntil(
    async () => {
      try {
        const output = await readDocumentPart<TValue>(page, input);
        return predicate(output) ? output : null;
      } catch {
        return null;
      }
    },
    options,
    '等待文档切片满足条件'
  );
}

/** 断言修订号严格递增（会话内 `document:write` 每次成功恰前进一次）。 */
export function expectRevisionAdvanced(previous: number, next: number): void {
  expect(next, 'document:write 后 revision').toBeGreaterThan(previous);
}

/** 断言统一摘要格式（`sha256:<hex>`）。 */
export function expectContentDigest(digest: string): void {
  expect(digest, '内容摘要').toMatch(/^sha256:[0-9a-f]{64}$/);
}

async function requestCapability<TOutput>(
  page: Page,
  capabilityId: string,
  input: unknown
): Promise<TOutput> {
  return page.evaluate(
    async ({ capabilityId: id, input: payload }): Promise<TOutput> => {
      const bridge = (window as unknown as { chips: { request: unknown } }).chips as {
        request<T>(capabilityId: string, input?: unknown): Promise<T>;
      };
      return bridge.request<TOutput>(id, payload);
    },
    { capabilityId, input }
  );
}

async function pollUntil<T>(
  probe: () => Promise<T | null>,
  options: PollOptions,
  fallbackMessage: string
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (;;) {
    try {
      const value = await probe();
      if (value !== null) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      const suffix = lastError === undefined ? '' : `；最后错误：${formatError(lastError)}`;
      throw new Error(
        `[chips-e2e] ${options.message ?? fallbackMessage}超时（${timeoutMs}ms）${suffix}`
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
