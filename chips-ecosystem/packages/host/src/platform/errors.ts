/**
 * PAL 错误模型。
 *
 * 权威：`04-能力契约规范` §11（错误模型与错误码）、`17-跨端Shell与平台抽象设计` §3.3 SB-7。
 *
 * @remarks
 * - 端口抛出的错误与 `ChipsError` 同构（`code` / `message` / `details` / `retryable`），
 *   能力层可直接作为能力错误归一。
 * - 消息一律简体中文、面向用户；`details` 只携带结构化诊断，不含输入原文与内部路径。
 * - 启动期自检失败抛 {@link PalBootstrapError}；该错误属壳内部错误，不跨越 Bridge。
 */

/** PAL 端口使用的已登记错误码。 */
export const PAL_ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_NOT_DIRECTORY: 'FILE_NOT_DIRECTORY',
  FILE_NOT_EMPTY: 'FILE_NOT_EMPTY',
  FILE_ALREADY_EXISTS: 'FILE_ALREADY_EXISTS',
  FILE_DECODE_FAILED: 'FILE_DECODE_FAILED',
  FILE_IO_FAILED: 'FILE_IO_FAILED',
  WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',
  WINDOW_OPERATION_FAILED: 'WINDOW_OPERATION_FAILED',
  MENU_SET_FAILED: 'MENU_SET_FAILED',
  TRAY_SET_FAILED: 'TRAY_SET_FAILED',
  TRAY_ICON_INVALID: 'TRAY_ICON_INVALID',
  SHORTCUT_ACCELERATOR_INVALID: 'SHORTCUT_ACCELERATOR_INVALID',
  SHORTCUT_CONFLICT: 'SHORTCUT_CONFLICT',
  SHORTCUT_REGISTER_FAILED: 'SHORTCUT_REGISTER_FAILED',
  SYSTEM_INFO_UNAVAILABLE: 'SYSTEM_INFO_UNAVAILABLE',
  POWER_INFO_UNAVAILABLE: 'POWER_INFO_UNAVAILABLE',
  POWER_PREVENT_SLEEP_FAILED: 'POWER_PREVENT_SLEEP_FAILED',
  TRANSFER_NOT_FOUND: 'TRANSFER_NOT_FOUND',
  TRANSFER_TARGET_EXISTS: 'TRANSFER_TARGET_EXISTS',
  TRANSFER_DIGEST_MISMATCH: 'TRANSFER_DIGEST_MISMATCH',
  TRANSFER_FAILED: 'TRANSFER_FAILED',
  NOTIFICATION_UNAVAILABLE: 'NOTIFICATION_UNAVAILABLE',
  NOTIFICATION_FAILED: 'NOTIFICATION_FAILED',
  CLIPBOARD_UNAVAILABLE: 'CLIPBOARD_UNAVAILABLE',
  DIALOG_FAILED: 'DIALOG_FAILED',
  SHELL_SCHEME_DENIED: 'SHELL_SCHEME_DENIED',
  SHELL_OPEN_FAILED: 'SHELL_OPEN_FAILED',
  HTTP_URL_INVALID: 'HTTP_URL_INVALID',
  HTTP_REQUEST_FAILED: 'HTTP_REQUEST_FAILED',
  HTTP_REDIRECT_DENIED: 'HTTP_REDIRECT_DENIED',
  HTTP_BLOCKED: 'HTTP_BLOCKED',
  CONFIG_KEY_INVALID: 'CONFIG_KEY_INVALID',
  CONFIG_KEY_UNKNOWN: 'CONFIG_KEY_UNKNOWN',
  CONFIG_VALUE_INVALID: 'CONFIG_VALUE_INVALID',
  CONFIG_SCOPE_INVALID: 'CONFIG_SCOPE_INVALID',
  CONFIG_NAMESPACE_DENIED: 'CONFIG_NAMESPACE_DENIED',
  CONFIG_WRITE_FAILED: 'CONFIG_WRITE_FAILED',
  CONFIG_EXTERNAL_MODIFIED: 'CONFIG_EXTERNAL_MODIFIED',
  CONFIG_VERSION_UNSUPPORTED: 'CONFIG_VERSION_UNSUPPORTED',
  BRIDGE_CANCELLED: 'BRIDGE_CANCELLED',
  BRIDGE_TIMEOUT: 'BRIDGE_TIMEOUT',
  BRIDGE_INTERNAL: 'BRIDGE_INTERNAL',
} as const;

/** PAL 错误码。 */
export type PalErrorCode = (typeof PAL_ERROR_CODES)[keyof typeof PAL_ERROR_CODES];

/** 已登记错误码的默认简体中文消息。 */
export const PAL_ERROR_MESSAGES: Readonly<Record<PalErrorCode, string>> = {
  FILE_NOT_FOUND: '目标文件或目录不存在',
  FILE_NOT_DIRECTORY: '目标不是目录',
  FILE_NOT_EMPTY: '目录非空，未请求递归操作',
  FILE_ALREADY_EXISTS: '目标已存在且未请求覆盖',
  FILE_DECODE_FAILED: '文件内容无法按声明编码解码',
  FILE_IO_FAILED: '文件读写失败',
  WINDOW_NOT_FOUND: '窗口不存在或已关闭',
  WINDOW_OPERATION_FAILED: '窗口操作失败',
  MENU_SET_FAILED: '菜单设置失败',
  TRAY_SET_FAILED: '托盘图标创建或更新失败',
  TRAY_ICON_INVALID: '托盘图标资源非法或不可解码',
  SHORTCUT_ACCELERATOR_INVALID: '快捷键文法非法',
  SHORTCUT_CONFLICT: '快捷键已被其他绑定占用',
  SHORTCUT_REGISTER_FAILED: '快捷键注册失败',
  SYSTEM_INFO_UNAVAILABLE: '系统信息读取失败',
  POWER_INFO_UNAVAILABLE: '电源状态读取失败',
  POWER_PREVENT_SLEEP_FAILED: '睡眠抑制设置失败',
  TRANSFER_NOT_FOUND: '传输任务不存在或已结束',
  TRANSFER_TARGET_EXISTS: '目标已存在且未请求覆盖',
  TRANSFER_DIGEST_MISMATCH: '下载内容与期望摘要不匹配',
  TRANSFER_FAILED: '传输失败',
  NOTIFICATION_UNAVAILABLE: '系统通知不可用',
  NOTIFICATION_FAILED: '通知发送失败',
  CLIPBOARD_UNAVAILABLE: '系统剪贴板不可用',
  DIALOG_FAILED: '对话框无法展示或返回',
  SHELL_SCHEME_DENIED: '该 scheme 不允许外部打开',
  SHELL_OPEN_FAILED: '系统默认程序打开失败',
  HTTP_URL_INVALID: 'URL 非法或 scheme 不允许',
  HTTP_REQUEST_FAILED: 'HTTP 请求失败',
  HTTP_REDIRECT_DENIED: '重定向目标超出授权',
  HTTP_BLOCKED: '请求被平台安全策略拦截',
  CONFIG_KEY_INVALID: '配置键格式非法',
  CONFIG_KEY_UNKNOWN: '配置键未注册',
  CONFIG_VALUE_INVALID: '配置值不符合约束',
  CONFIG_SCOPE_INVALID: '配置层标识非法或该层不可写',
  CONFIG_NAMESPACE_DENIED: '配置命名空间越权访问',
  CONFIG_WRITE_FAILED: '配置落盘失败',
  CONFIG_EXTERNAL_MODIFIED: '配置文件被外部修改，写入受保护',
  CONFIG_VERSION_UNSUPPORTED: '配置文件版本高于当前平台',
  BRIDGE_CANCELLED: '调用已取消',
  BRIDGE_TIMEOUT: '调用超时',
  BRIDGE_INTERNAL: '宿主内部错误',
};

/** 已登记错误码的默认 retryable 语义；权威：能力契约 §11.2–§11.4。 */
export const PAL_ERROR_RETRYABLE: Readonly<Record<PalErrorCode, boolean>> = {
  FILE_NOT_FOUND: false,
  FILE_NOT_DIRECTORY: false,
  FILE_NOT_EMPTY: false,
  FILE_ALREADY_EXISTS: false,
  FILE_DECODE_FAILED: false,
  FILE_IO_FAILED: true,
  WINDOW_NOT_FOUND: false,
  WINDOW_OPERATION_FAILED: true,
  MENU_SET_FAILED: true,
  TRAY_SET_FAILED: true,
  TRAY_ICON_INVALID: false,
  SHORTCUT_ACCELERATOR_INVALID: false,
  SHORTCUT_CONFLICT: false,
  SHORTCUT_REGISTER_FAILED: true,
  SYSTEM_INFO_UNAVAILABLE: true,
  POWER_INFO_UNAVAILABLE: true,
  POWER_PREVENT_SLEEP_FAILED: true,
  TRANSFER_NOT_FOUND: false,
  TRANSFER_TARGET_EXISTS: false,
  TRANSFER_DIGEST_MISMATCH: false,
  TRANSFER_FAILED: true,
  NOTIFICATION_UNAVAILABLE: true,
  NOTIFICATION_FAILED: true,
  CLIPBOARD_UNAVAILABLE: true,
  DIALOG_FAILED: true,
  SHELL_SCHEME_DENIED: false,
  SHELL_OPEN_FAILED: true,
  HTTP_URL_INVALID: false,
  HTTP_REQUEST_FAILED: true,
  HTTP_REDIRECT_DENIED: false,
  HTTP_BLOCKED: false,
  CONFIG_KEY_INVALID: false,
  CONFIG_KEY_UNKNOWN: false,
  CONFIG_VALUE_INVALID: false,
  CONFIG_SCOPE_INVALID: false,
  CONFIG_NAMESPACE_DENIED: false,
  CONFIG_WRITE_FAILED: true,
  CONFIG_EXTERNAL_MODIFIED: false,
  CONFIG_VERSION_UNSUPPORTED: false,
  BRIDGE_CANCELLED: false,
  BRIDGE_TIMEOUT: true,
  BRIDGE_INTERNAL: false,
};

/** 与 `ChipsError` 同构的错误形状。 */
export interface PalErrorShape {
  /** 已登记错误码。 */
  readonly code: PalErrorCode;
  /** 面向用户的简体中文消息。 */
  readonly message: string;
  /** 结构化诊断。 */
  readonly details?: Readonly<Record<string, unknown>>;
  /** 是否可重试。 */
  readonly retryable: boolean;
}

/** `PalPortError` 构造选项。 */
export interface PalPortErrorOptions {
  /** 结构化诊断；不得包含输入原文、凭证与内部路径。 */
  readonly details?: Readonly<Record<string, unknown>>;
  /** 覆盖默认 retryable 语义；不传时按错误码表推导。 */
  readonly retryable?: boolean;
  /** 原始异常；仅用于本地诊断链，不序列化给插件。 */
  readonly cause?: unknown;
}

/**
 * PAL 端口错误；端口实现必须抛出本类型或同构对象。
 *
 * 权威：`04-能力契约规范` §11.1、17 号文档 SB-7。
 */
export class PalPortError extends Error implements PalErrorShape {
  /** 已登记错误码。 */
  readonly code: PalErrorCode;
  /** 结构化诊断。 */
  readonly details?: Readonly<Record<string, unknown>>;
  /** 是否可重试。 */
  readonly retryable: boolean;

  constructor(code: PalErrorCode, message?: string, options?: PalPortErrorOptions) {
    super(message ?? PAL_ERROR_MESSAGES[code]);
    this.name = 'PalPortError';
    this.code = code;
    this.retryable = options?.retryable ?? PAL_ERROR_RETRYABLE[code];
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  /** 序列化为结构化克隆兼容的普通对象。 */
  toJSON(): PalErrorShape {
    const payload: {
      code: PalErrorCode;
      message: string;
      retryable: boolean;
      details?: Readonly<Record<string, unknown>>;
    } = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.details !== undefined) {
      payload.details = this.details;
    }
    return payload;
  }
}

/** 判断值是否为 {@link PalPortError}。 */
export function isPalPortError(value: unknown): value is PalPortError {
  return value instanceof PalPortError;
}

/**
 * 把任意异常归一为 {@link PalPortError}。
 *
 * - 已是 `PalPortError` 时原样返回；
 * - `Error` 的 `code` 命中已登记错误码时按该码构造；
 * - 其余归一为 `fallbackCode`（默认 `BRIDGE_INTERNAL`，SB-7）。
 */
export function toPalPortError(
  error: unknown,
  fallbackCode: PalErrorCode = PAL_ERROR_CODES.BRIDGE_INTERNAL,
  fallbackMessage?: string,
): PalPortError {
  if (isPalPortError(error)) {
    return error;
  }
  const nodeCode = readNodeErrorCode(error);
  if (nodeCode !== null && isPalErrorCode(nodeCode)) {
    return new PalPortError(nodeCode, undefined, { cause: error });
  }
  return new PalPortError(fallbackCode, fallbackMessage, { cause: error });
}

/** 判断字符串是否为已登记错误码。 */
export function isPalErrorCode(value: string): value is PalErrorCode {
  return value in PAL_ERROR_CODES;
}

/** 读取 Node 风格异常的 `code` 字段。 */
function readNodeErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * 壳自检失败错误。
 *
 * @remarks
 * 壳启动期矩阵与端口集合不一致时抛出并终止启动（17 号文档 §2.4）；
 * 本错误属壳内部错误，不跨越 Bridge，不参与能力错误归一。
 */
export class PalBootstrapError extends Error {
  /** 固定错误码（壳内部）。 */
  readonly code = 'PAL_BOOTSTRAP_INVALID';
  /** 结构化诊断。 */
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'PalBootstrapError';
    this.details = details;
  }
}

/** 判断值是否为 {@link PalBootstrapError}。 */
export function isPalBootstrapError(value: unknown): value is PalBootstrapError {
  return value instanceof PalBootstrapError;
}
