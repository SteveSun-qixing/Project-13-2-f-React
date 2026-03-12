import type { StandardError } from "./errors";

export type SdkEnvironment = "plugin" | "browser" | "node";

export interface ClientConfig {
  /**
   * 运行环境探测策略。
   * - `auto`：自动探测（默认）。
   * - `plugin`：强制认为在 Host 插件环境中运行。
   * - `browser`：普通浏览器环境。
   * - `node`：Node.js 环境。
   */
  environment?: "auto" | SdkEnvironment;

  /**
   * 自定义传输实现。
   * 当未提供且存在 `window.chips` 时，SDK 会自动使用 Bridge 适配器；
   * 当未提供且不存在 `window.chips` 时，调用时会抛出 `BRIDGE_UNAVAILABLE`。
   */
  transport?: (action: string, payload: unknown) => Promise<unknown>;

  /** 默认超时时间（毫秒）。具体超时由 Host/Bridge 控制，本字段仅用于未来扩展与诊断。 */
  timeoutMs?: number;

  /** 最大重试次数（仅对 retryable=true 的错误生效）。 */
  retries?: 0 | 1 | 2 | 3;

  /** 可选日志实现。 */
  logger?: SdkLogger;
}

export interface SdkLogRecord {
  level: "debug" | "info" | "warn" | "error";
  time: string;
  action?: string;
  requestId?: string;
  message?: string;
  details?: unknown;
}

export interface SdkLogger {
  debug(record: SdkLogRecord): void;
  info(record: SdkLogRecord): void;
  warn(record: SdkLogRecord): void;
  error(record: SdkLogRecord): void;
}

export interface EventsApi {
  on<T>(event: string, handler: (payload: T) => void): () => void;
  once<T>(event: string, handler: (payload: T) => void): void;
  emit<T>(event: string, payload: T): Promise<void>;
}

export interface CoreClient {
  readonly clientConfig: Readonly<ClientConfig>;
  invoke<I, O>(action: string, payload: I): Promise<O>;
  events: EventsApi;
}

export interface Client extends CoreClient {
  // Domain APIs 按模块挂载
  file: import("../api/file").FileApi;
  zip: import("../api/zip").ZipApi;
  card: import("../api/card").CardApi;
  theme: import("../api/theme").ThemeApi;
  config: import("../api/config").ConfigApi;
  i18n: import("../api/i18n").I18nApi;
  plugin: import("../api/plugin").PluginApi;
  module: import("../api/module").ModuleApi;
  window: import("../api/window").WindowApi;
  platform: import("../api/platform").PlatformApi;
  box: import("../api/box").BoxApi;
  resource: import("../api/resource").ResourceApi;
}

export interface InvocationContext {
  action: string;
  payload: unknown;
  attempt: number;
  error?: StandardError;
}
