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

  /**
   * 可选的 Bridge 作用域令牌。
   * 用于模块插件等“嵌入式运行时”以独立 Host 身份访问系统能力。
   */
  bridgeScope?: {
    token: string;
  };

  /** SDK 调用超时时间（毫秒）。为 0 或未设置时不启用 SDK 侧超时。 */
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
  once<T>(event: string, handler: (payload: T) => void): () => void;
  emit<T>(event: string, payload: T): Promise<void>;
}

export interface CoreClient {
  readonly clientConfig: Readonly<ClientConfig>;
  invoke<I, O>(action: string, payload: I): Promise<O>;
  events: EventsApi;
}

export interface Client extends CoreClient {
  // Domain APIs 按模块挂载
  office: import("../api/office-document").OfficeDocumentApi;
  document: import("../api/document").DocumentApi;
  file: import("../api/file").FileApi;
  card: import("../api/card").CardApi;
  theme: import("../api/theme").ThemeApi;
  config: import("../api/config").ConfigApi;
  i18n: import("../api/i18n").I18nApi;
  command: import("../api/command").CommandApi;
  cliCommand: import("../api/cli-command").CliCommandApi;
  cliTask: import("../api/cli-task").CliTaskApi;
  plugin: import("../api/plugin").PluginApi;
  module: import("../api/module").ModuleApi;
  communityCardTransfer: import("../api/community-card-transfer").CommunityCardTransferApi;
  window: import("../api/window").WindowApi;
  surface: import("../api/surface").SurfaceApi;
  transfer: import("../api/transfer").TransferApi;
  association: import("../api/association").AssociationApi;
  platform: import("../api/platform").PlatformApi;
  box: import("../api/box").BoxApi;
  workspace: import("../api/workspace").WorkspaceApi;
  resource: import("../api/resource").ResourceApi;
  zip: import("../api/zip").ZipApi;
  log: import("../api/log").LogApi;
  credential: import("../api/credential").CredentialApi;
  serializer: import("../api/serializer").SerializerApi;
  controlPlane: import("../api/control-plane").ControlPlaneApi;
}

export interface InvocationContext {
  action: string;
  payload: unknown;
  attempt: number;
  error?: StandardError;
}
