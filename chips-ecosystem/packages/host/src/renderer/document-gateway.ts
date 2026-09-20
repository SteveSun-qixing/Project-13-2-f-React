/**
 * 渲染进程 document 消费面：文档能力的会话侧网关。
 *
 * 权威：`04-能力契约规范` §7.3（`document:open` / `document:read` 输入输出）、
 * `src/capabilities/document/contract.ts`（#28 已验收契约镜像，只读消费）、
 * `05-渲染引擎设计` §2.2/§2.3（请求阶段经 Bridge 能力调用）、§11（错误模型）。
 *
 * @remarks
 * - 网关只承载 `open` / `read` 两个查看态动作；`write` / `save` 属编辑链路（05.08：编辑不经帧、
 *   渲染会话不写文件），不在渲染网关面内。
 * - 两种正式形态：`createBridgeDocumentGateway`（渲染进程 `window.chips` 正式链路）与
 *   `createServiceDocumentGateway`（Headless 链路，直接消费 `IDocumentService` 执行器；测试以
 *   `tests/helpers/document-fake-ports.ts` 替身承载）。
 * - 失败归一：解析/结构域登记码 → `RENDER_DOCUMENT_INVALID`、权限拒绝 → `RENDER_RESOURCE_DENIED`
 *   （§11 触发口径逐条对应）；其余码原样透传，不发明映射。
 */

import { DOCUMENT_CAPABILITY_IDS } from '../capabilities/document/contract.js';
import type {
  IDocumentCapabilityContext,
  IDocumentOpenInput,
  IDocumentOpenOutput,
  IDocumentReadInput,
  IDocumentReadOutput,
} from '../capabilities/document/contract.js';
import type { IDocumentService } from '../capabilities/document/service.js';
import { DOCUMENT_BUSINESS_ERROR_CODES, DOCUMENT_PARSER_ERROR_CODES } from '../capabilities/document/errors.js';
import { ChipsError, toChipsError } from '../preload/chips-error.js';
import { createRenderError, RENDER_ERROR_CODES } from './codes.js';

/** 渲染进程文档网关面（查看态两动作）。 */
export interface IRenderDocumentGateway {
  /** `document:open`。 */
  open(input: IDocumentOpenInput): Promise<IDocumentOpenOutput>;
  /** `document:read`。 */
  read(input: IDocumentReadInput): Promise<IDocumentReadOutput>;
}

/** `window.chips` 方法面（渲染进程侧最小结构视图）。 */
export interface IChipsRequestFacade {
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
}

/**
 * 解析/结构域登记码集合（`open` / `read` 路径可能出现的码；触发 → `RENDER_DOCUMENT_INVALID`，
 * §11 第 1 行"解析校验失败"。写入/保存域的码不在渲染网关路径上，不纳入映射）。
 */
const DOCUMENT_INVALID_CODES: ReadonlySet<string> = new Set<string>([
  DOCUMENT_BUSINESS_ERROR_CODES.notOpen,
  DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid,
  DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid,
  DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged,
  DOCUMENT_PARSER_ERROR_CODES.formatUnknown,
]);

/**
 * 把文档域异常归一为渲染域 `ChipsError`：
 * 解析/结构域 → `RENDER_DOCUMENT_INVALID`；权限拒绝 → `RENDER_RESOURCE_DENIED`；其余码原样透传。
 */
export function normalizeDocumentFailure(error: unknown): ChipsError {
  const normalized = toChipsError(error);
  if (normalized.code === 'BRIDGE_PERMISSION_DENIED') {
    return createRenderError({ code: RENDER_ERROR_CODES.resourceDenied, details: { code: normalized.code } });
  }
  if (DOCUMENT_INVALID_CODES.has(normalized.code)) {
    return createRenderError({ code: RENDER_ERROR_CODES.documentInvalid, details: { code: normalized.code } });
  }
  return normalized;
}

/** 网关调用包装：失败统一经 {@link normalizeDocumentFailure} 归一。 */
async function callGateway<TOutput>(run: () => Promise<TOutput>): Promise<TOutput> {
  try {
    return await run();
  } catch (error) {
    throw normalizeDocumentFailure(error);
  }
}

/**
 * Bridge 形态网关：渲染进程经 `window.chips.request` 调用文档能力（R19 权限判定在 Bridge 侧完成）。
 */
export function createBridgeDocumentGateway(chips: IChipsRequestFacade): IRenderDocumentGateway {
  return {
    open(input) {
      return callGateway(() => chips.request<IDocumentOpenOutput>(DOCUMENT_CAPABILITY_IDS.open, input));
    },
    read(input) {
      return callGateway(() => chips.request<IDocumentReadOutput>(DOCUMENT_CAPABILITY_IDS.read, input));
    },
  };
}

/** 服务形态网关选项。 */
export interface IServiceDocumentGatewayOptions {
  /** Bridge 会话标识（文档服务按会话做活性与权限判定）。 */
  readonly sessionId: string;
  /** 调用方标识（诊断与审计）；缺省 `platform.render-host`。 */
  readonly callerId?: string;
}

/**
 * 服务形态网关：直接消费 `IDocumentService` 执行器（Headless 宿主与测试链路；
 * 输入输出与 Bridge 形态完全同构，调用上下文由本网关组装并如实传递）。
 */
export function createServiceDocumentGateway(
  service: IDocumentService,
  options: IServiceDocumentGatewayOptions
): IRenderDocumentGateway {
  const callerId = options.callerId ?? 'platform.render-host';
  const context = (signal?: AbortSignal): IDocumentCapabilityContext => ({
    signal: signal ?? new AbortController().signal,
    sessionId: options.sessionId,
    callerId,
  });
  return {
    open(input) {
      return callGateway(() => service.executeOpen(input, context()));
    },
    read(input) {
      return callGateway(() => service.executeRead(input, context()));
    },
  };
}
