/**
 * 个人服务器业务码登记表——《个人服务器 API 契约》§7.2 的服务端落点。
 *
 * 本表是服务端唯一允许输出的业务码集合（§2.2：未登记业务码不得出现在响应中）；
 * 个人服务器业务码不设来源前缀（契约 §7.2 首行）。每个码固定绑定契约登记的
 * HTTP 状态与 `retryable` 缺省值。新增错误码必须先在契约 §7.2 登记后才能进入本表。
 */

export interface ErrorSpec {
  /** 契约 §7.2 登记的 HTTP 状态；`0` 表示客户端侧归一码，服务端不直接输出。 */
  readonly httpStatus: number;
  /** 契约 §7.2 登记的 retryable 缺省值（响应缺省时客户端按表内值判定）。 */
  readonly retryable: boolean;
}

function spec(httpStatus: number, retryable: boolean): ErrorSpec {
  return { httpStatus, retryable };
}

/**
 * 业务码 → 登记规格。键名与契约 §7.2 表逐行对齐，禁止增删改名。
 */
export const PersonalErrorCode = {
  API_TOKEN_INVALID: spec(401, false),
  VALIDATION_ERROR: spec(400, false),
  CARD_NOT_FOUND: spec(404, false),
  CARD_RENDER_NOT_READY: spec(409, true),
  BOX_NOT_FOUND: spec(404, false),
  UPLOAD_SESSION_NOT_FOUND: spec(404, false),
  UPLOAD_SESSION_EXPIRED: spec(400, false),
  DOWNLOAD_SESSION_NOT_FOUND: spec(404, false),
  FILE_TOO_LARGE: spec(413, false),
  FILE_TYPE_INVALID: spec(415, false),
  FILE_CORRUPT: spec(400, false),
  NOT_FOUND: spec(404, false),
  SERVICE_UNAVAILABLE: spec(503, true),
  INTERNAL_ERROR: spec(500, true),
  // 客户端侧归一码（契约 §7.2 末行）：服务端不输出，仅登记保持全表完整。
  RESPONSE_INVALID: spec(0, true),
} as const;

export type PersonalErrorCodeType = keyof typeof PersonalErrorCode;

/** 校验一个字符串是否为已登记业务码。 */
export function isRegisteredErrorCode(code: string): code is PersonalErrorCodeType {
  return Object.prototype.hasOwnProperty.call(PersonalErrorCode, code);
}
