/**
 * 社区平台错误归一——《社区平台 API 契约》§7.2/§7.3/§7.4 的 Web 前台客户端落点。
 *
 * - 业务码登记表与契约 §7.3 逐行对齐：未登记业务码一律归一为 `COMMUNITY_RESPONSE_INVALID`；
 * - `HTTP_REQUEST_FAILED` 沿用平台网络错误码语义（§7.4「未到达服务端」层）；
 * - 客户端只按 `code` 分支，不匹配 `message` 文本（§7.4 映射规则）。
 */

export interface CommunityErrorSpec {
  /** 契约 §7.3 登记的 HTTP 状态；`0` 表示客户端侧归一码。 */
  readonly httpStatus: number;
  /** 契约 §7.3 登记的 retryable 缺省值（响应缺省时按表内值判定）。 */
  readonly retryable: boolean;
}

function spec(httpStatus: number, retryable: boolean): CommunityErrorSpec {
  return { httpStatus, retryable };
}

/** 业务码 → 登记规格。键名与契约 §7.3 表逐行对齐，禁止增删改名。 */
export const COMMUNITY_ERROR_SPECS = {
  COMMUNITY_VALIDATION_ERROR: spec(400, false),
  COMMUNITY_AUTH_INVALID_CREDENTIALS: spec(401, false),
  COMMUNITY_AUTH_USER_EXISTS: spec(409, false),
  COMMUNITY_AUTH_ACCOUNT_LOCKED: spec(403, true),
  COMMUNITY_AUTH_TOKEN_MISSING: spec(401, false),
  COMMUNITY_AUTH_TOKEN_INVALID: spec(401, false),
  COMMUNITY_AUTH_TOKEN_EXPIRED: spec(401, false),
  COMMUNITY_AUTH_INSUFFICIENT_PERMISSION: spec(403, false),
  COMMUNITY_USER_NOT_FOUND: spec(404, false),
  COMMUNITY_USER_ACCOUNT_DISABLED: spec(403, false),
  COMMUNITY_ROOM_NOT_FOUND: spec(404, false),
  COMMUNITY_ROOM_FORBIDDEN: spec(403, false),
  COMMUNITY_CARD_NOT_FOUND: spec(404, false),
  COMMUNITY_CARD_FORBIDDEN: spec(403, false),
  COMMUNITY_CARD_VERSION_UNSUPPORTED: spec(422, false),
  COMMUNITY_CARD_RENDER_NOT_READY: spec(409, true),
  COMMUNITY_CARD_RENDER_ERROR: spec(409, true),
  COMMUNITY_BOX_NOT_FOUND: spec(404, false),
  COMMUNITY_BOX_FORBIDDEN: spec(403, false),
  COMMUNITY_BOX_VERSION_UNSUPPORTED: spec(422, false),
  COMMUNITY_UPLOAD_SESSION_NOT_FOUND: spec(404, false),
  COMMUNITY_UPLOAD_SESSION_EXPIRED: spec(410, false),
  COMMUNITY_UPLOAD_SESSION_STATE_INVALID: spec(409, false),
  COMMUNITY_OBJECT_ROLE_INVALID: spec(422, false),
  COMMUNITY_OBJECT_OWNERSHIP_MISMATCH: spec(422, false),
  COMMUNITY_OBJECT_PATH_INVALID: spec(422, false),
  COMMUNITY_OBJECT_SIZE_MISMATCH: spec(422, false),
  COMMUNITY_DOWNLOAD_SESSION_NOT_FOUND: spec(404, false),
  COMMUNITY_DOWNLOAD_SESSION_EXPIRED: spec(410, false),
  COMMUNITY_FILE_TYPE_INVALID: spec(415, false),
  COMMUNITY_FILE_TOO_LARGE: spec(413, false),
  COMMUNITY_FILE_CORRUPT: spec(422, false),
  COMMUNITY_IDEMPOTENCY_CONFLICT: spec(409, false),
  COMMUNITY_RATE_LIMITED: spec(429, true),
  COMMUNITY_SERVICE_UNAVAILABLE: spec(503, true),
  COMMUNITY_INTERNAL_ERROR: spec(500, true),
  COMMUNITY_RESPONSE_INVALID: spec(0, true),
} as const;

export type CommunityErrorCode = keyof typeof COMMUNITY_ERROR_SPECS;

/** 校验一个字符串是否为契约 §7.3 已登记业务码。 */
export function isRegisteredCommunityErrorCode(code: string): code is CommunityErrorCode {
  return Object.prototype.hasOwnProperty.call(COMMUNITY_ERROR_SPECS, code);
}

/** 未到达服务端（DNS、连接、TLS、超时）的归一码（契约 §7.4 第一层）。 */
export const HTTP_REQUEST_FAILED = 'HTTP_REQUEST_FAILED';

export type CommunityErrorDetails = Record<string, unknown>;

/** 归一后的社区 API 错误：`message` 一律简体中文、面向用户；`traceId` 只进诊断信息。 */
export class CommunityApiError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly details: CommunityErrorDetails | null;
  public readonly traceId: string | null;

  constructor(init: {
    code: string;
    message: string;
    httpStatus: number;
    retryable: boolean;
    details?: CommunityErrorDetails;
    traceId?: string | null;
  }) {
    super(init.message);
    this.name = 'CommunityApiError';
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable;
    this.details = init.details ?? null;
    this.traceId = init.traceId ?? null;
  }
}

/** 客户端侧归一错误工厂：响应信封、字段或业务码不符合契约时使用（契约 §7.3 末行）。 */
export function communityResponseInvalidError(init: {
  httpStatus: number;
  traceId?: string | null;
  detail?: CommunityErrorDetails;
}): CommunityApiError {
  const details: CommunityErrorDetails = { ...init.detail, httpStatus: init.httpStatus };
  return new CommunityApiError({
    code: 'COMMUNITY_RESPONSE_INVALID',
    message: '服务端响应格式不符合契约',
    httpStatus: init.httpStatus,
    retryable: true,
    details,
    traceId: init.traceId ?? null,
  });
}
