/**
 * `document:*` 能力的错误模型。
 *
 * 权威：`02-Bridge三层设计` §9.2（通道级错误码与 `retryable` 口径）、
 * `11-文档服务设计` §十（`DOCUMENT_*` 会话与写入错误码）、`06-文档解析器设计` §8.2
 * （解析域错误码经端口原样透传）、`04-能力契约规范` §十一（错误模型与归属）。
 *
 * @remarks
 * - 抛出的错误与 `ChipsError` 同构（`code` / `message` / `details` / `retryable`），
 *   Bridge 适配层经 `normalizeError` 原样透传本族错误码；未识别异常一律归一为
 *   `BRIDGE_INTERNAL`，不携带堆栈与内部路径。
 * - `message` 一律简体中文、面向用户；`details` 只承载结构化诊断（`documentId` / `source` /
 *   `part` / `nodeId` / `cause`），不含文件内容与凭证。
 * - 禁止自造错误码：本表错误码全部来自上述权威章节的登记表；端口（资源管理器 / 解析器）
 *   抛出的已登记码（`RESOURCE_*` / 解析域 `DOCUMENT_*`）经 {@link asDocumentCapabilityError}
 *   原样透传。
 */

/** 通道级错误码（Bridge 既有码的文档能力使用子集；文案与 `BRIDGE_ERROR_MESSAGES` 同口径）。 */
export const DOCUMENT_CHANNEL_ERROR_CODES = {
  invalidInput: 'BRIDGE_INVALID_INPUT',
  permissionDenied: 'BRIDGE_PERMISSION_DENIED',
  sessionUnknown: 'BRIDGE_SESSION_UNKNOWN',
  timeout: 'BRIDGE_TIMEOUT',
  cancelled: 'BRIDGE_CANCELLED',
  internal: 'BRIDGE_INTERNAL',
} as const;

/** 文档会话与写入域错误码（`11-文档服务设计` §10.2 新增码 + §10.1 复用码中由服务判定的两项）。 */
export const DOCUMENT_BUSINESS_ERROR_CODES = {
  notOpen: 'DOCUMENT_NOT_OPEN',
  partUnsupported: 'DOCUMENT_PART_UNSUPPORTED',
  writeConflict: 'DOCUMENT_WRITE_CONFLICT',
  sourceChanged: 'DOCUMENT_SOURCE_CHANGED',
  saveFailed: 'DOCUMENT_SAVE_FAILED',
  idConflict: 'DOCUMENT_ID_CONFLICT',
  metadataInvalid: 'DOCUMENT_METADATA_INVALID',
  structureInvalid: 'DOCUMENT_STRUCTURE_INVALID',
} as const;

/**
 * 解析域复用码（`06-文档解析器设计` §8.2）：语义权威在解析器错误表，端口抛出的同码经
 * {@link asDocumentCapabilityError} 原样透传；服务只在无需解析即可确定性判定的场景
 * 复用解析器的既有码，不另立新码（`11-文档服务设计` §10.3：同一场景不得两码并用）。
 */
export const DOCUMENT_PARSER_ERROR_CODES = {
  formatUnknown: 'DOCUMENT_FORMAT_UNKNOWN',
} as const;

/** 本模块直接构造的全部错误码。 */
export type DocumentCapabilityErrorCode =
  | (typeof DOCUMENT_CHANNEL_ERROR_CODES)[keyof typeof DOCUMENT_CHANNEL_ERROR_CODES]
  | (typeof DOCUMENT_BUSINESS_ERROR_CODES)[keyof typeof DOCUMENT_BUSINESS_ERROR_CODES]
  | (typeof DOCUMENT_PARSER_ERROR_CODES)[keyof typeof DOCUMENT_PARSER_ERROR_CODES];

/** 已登记错误码的 `retryable` 口径（`02-Bridge三层设计` §9.2 + `11-文档服务设计` §10.2）。 */
export const DOCUMENT_ERROR_RETRYABLE: Readonly<Record<DocumentCapabilityErrorCode, boolean>> = {
  BRIDGE_INVALID_INPUT: false,
  BRIDGE_PERMISSION_DENIED: false,
  BRIDGE_SESSION_UNKNOWN: false,
  BRIDGE_TIMEOUT: true,
  BRIDGE_CANCELLED: false,
  BRIDGE_INTERNAL: false,
  DOCUMENT_NOT_OPEN: false,
  DOCUMENT_PART_UNSUPPORTED: false,
  DOCUMENT_WRITE_CONFLICT: true,
  DOCUMENT_SOURCE_CHANGED: false,
  DOCUMENT_SAVE_FAILED: true,
  DOCUMENT_ID_CONFLICT: false,
  DOCUMENT_METADATA_INVALID: false,
  DOCUMENT_STRUCTURE_INVALID: false,
  DOCUMENT_FORMAT_UNKNOWN: false,
};

/** 已登记错误码的默认简体中文文案（面向用户，不暴露堆栈与内部路径）。 */
export const DOCUMENT_ERROR_MESSAGES: Readonly<Record<DocumentCapabilityErrorCode, string>> = {
  BRIDGE_INVALID_INPUT: '能力输入不合法',
  BRIDGE_PERMISSION_DENIED: '插件缺少所需权限',
  BRIDGE_SESSION_UNKNOWN: '会话不存在或已关闭',
  BRIDGE_TIMEOUT: '能力调用超时',
  BRIDGE_CANCELLED: '能力调用已取消',
  BRIDGE_INTERNAL: '平台内部错误',
  DOCUMENT_NOT_OPEN: '文档会话不存在，请重新打开文档',
  DOCUMENT_PART_UNSUPPORTED: '文档类型与请求的模型切片组合不受支持',
  DOCUMENT_WRITE_CONFLICT: '文档正被其他会话写入，请稍后重试',
  DOCUMENT_SOURCE_CHANGED: '文档已在外部修改，需要重新打开',
  DOCUMENT_SAVE_FAILED: '文档保存失败',
  DOCUMENT_ID_CONFLICT: '不同来源解析出相同文档标识，已拒绝打开',
  DOCUMENT_METADATA_INVALID: '文档元数据不符合格式要求',
  DOCUMENT_STRUCTURE_INVALID: '文档结构不符合格式要求',
  DOCUMENT_FORMAT_UNKNOWN: '文档与声明的格式不符，无法打开',
};

/** 结构化诊断载荷：只允许登记字段，不含输入原文与文件内容。 */
export interface IDocumentErrorDetails {
  readonly documentId?: string;
  readonly source?: string;
  readonly part?: string;
  readonly nodeId?: string;
  readonly kind?: string;
  readonly pointer?: string;
  readonly capabilityId?: string;
  readonly permission?: string;
  readonly reason?: string;
  /** 底层失败原因码（如保存路径底层的 `RESOURCE_*` 码，§10.3）。 */
  readonly cause?: string;
}

/** 端口透传错误（`RESOURCE_*` / 解析域 `DOCUMENT_*`）缺少消息时的兜底文案。 */
const PASSTHROUGH_FALLBACK_MESSAGE = '文档操作失败';

/**
 * 文档能力错误：`ChipsError` 的壳侧同构实现。
 *
 * @remarks
 * `only-throw-error` 要求抛出真 `Error`；本类携带与 `IChipsError` 同构的可枚举字段，
 * Bridge 适配层按结构消费（`@chips/bridge` 依赖边打通后单点收敛到其错误类）。
 * `code` 为登记码字符串：本模块直接构造时使用 {@link DocumentCapabilityErrorCode}，
 * 端口透传时保持来源登记码（`RESOURCE_*` / 解析域 `DOCUMENT_*`）原样。
 */
export class DocumentCapabilityError extends Error {
  /** 已登记错误码（`<DOMAIN>_<REASON>`）。 */
  readonly code: string;

  /** 结构化诊断。 */
  readonly details: IDocumentErrorDetails | undefined;

  /** 是否可重试。 */
  readonly retryable: boolean;

  constructor(
    code: string,
    options: { readonly message?: string; readonly details?: IDocumentErrorDetails; readonly retryable?: boolean } = {},
  ) {
    super(
      options.message ??
        (isDocumentCapabilityErrorCode(code) ? DOCUMENT_ERROR_MESSAGES[code] : PASSTHROUGH_FALLBACK_MESSAGE),
    );
    this.name = 'ChipsError';
    this.code = code;
    this.details = options.details;
    this.retryable =
      options.retryable ?? (isDocumentCapabilityErrorCode(code) ? DOCUMENT_ERROR_RETRYABLE[code] : false);
  }

  /** 归一为结构化克隆兼容的普通对象（跨 IPC 传输形态）。 */
  toPlain(): { code: string; message: string; details?: unknown; retryable: boolean } {
    const plain: { code: string; message: string; details?: unknown; retryable: boolean } = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.details !== undefined) {
      plain.details = this.details;
    }
    return plain;
  }
}

/** 判断错误码是否属于本模块直接构造的登记码集合（可取默认文案与 `retryable` 口径）。 */
export function isDocumentCapabilityErrorCode(code: string): code is DocumentCapabilityErrorCode {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_ERROR_MESSAGES, code);
}

/** 构造文档能力错误（限本模块登记码；端口透传码走 {@link asDocumentCapabilityError}）。 */
export function documentError(
  code: DocumentCapabilityErrorCode,
  options: { readonly message?: string; readonly details?: IDocumentErrorDetails; readonly retryable?: boolean } = {},
): DocumentCapabilityError {
  return new DocumentCapabilityError(code, options);
}

/** 已登记错误码的词法形态：`<DOMAIN>_<REASON>`（全大写下划线，`04-能力契约规范` §11.1）。 */
const REGISTERED_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/**
 * 任意异常 → 文档能力错误（错误归一，`02-Bridge三层设计` §9.1）：
 *
 * - `DocumentCapabilityError` 原样返回；
 * - 携带已登记码形态 `code` 的抛出值（资源管理器 `RESOURCE_*`、解析器 `DOCUMENT_*`）同构透传，
 *   `retryable` 缺省按 `false`；
 * - `AbortError` 归一为 `BRIDGE_CANCELLED`；
 * - 其余未识别异常归一为 `BRIDGE_INTERNAL`（不透出原始消息，防泄漏内部路径）。
 */
export function asDocumentCapabilityError(error: unknown): DocumentCapabilityError {
  if (error instanceof DocumentCapabilityError) {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown; details?: unknown; retryable?: unknown };
    if (typeof candidate.code === 'string' && REGISTERED_CODE_PATTERN.test(candidate.code)) {
      const message =
        typeof candidate.message === 'string' && candidate.message.length > 0 ? candidate.message : undefined;
      const details =
        typeof candidate.details === 'object' && candidate.details !== null
          ? (candidate.details as IDocumentErrorDetails)
          : undefined;
      const retryable = typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined;
      return new DocumentCapabilityError(candidate.code, {
        ...(message === undefined ? {} : { message }),
        ...(details === undefined ? {} : { details }),
        ...(retryable === undefined ? {} : { retryable }),
      });
    }
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError' &&
    typeof (error as { code?: unknown }).code !== 'string'
  ) {
    return documentError(DOCUMENT_CHANNEL_ERROR_CODES.cancelled);
  }
  return documentError(DOCUMENT_CHANNEL_ERROR_CODES.internal);
}
