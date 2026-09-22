/**
 * `CliClient` 端口：CLI 命令层与平台之间的唯一接缝。
 *
 * 设计约束：
 * - 平台访问一律经该端口，命令实现不直连内核路由、Bridge、宿主或 Electron（[CLI 完整参考] §六.2）；
 * - `cliCommand` / `cliTask` 两组严格对应 `cli-command` / `cli-task` 契约的服务路由
 *   （[CLI 完整参考] §5.8），由 {@link createServiceRouterClient} 映射；
 * - 插件管理、工作区标记、配置、日志、更新、诊断、文件打开、应用实例确保运行等平台操作
 *   属平台运行时职责，由承载适配器实现（平台发行包/宿主提供，接口形状即本文件端口）；
 * - 命令级测试注入本端口的测试替身，不依赖任何真实运行时。
 */

import type { IFileSystemPort } from '../args/filesystem.js';
import type { IParameterDeclaration } from '../args/types.js';

/** 能力/服务路由调用端口；`IChipsBridge`（`@chips/bridge`）在结构上满足该端口。 */
export interface ICliInvoker {
  request<TOutput = unknown>(id: string, input?: unknown): Promise<TOutput>;
}

/** 工作区种类（[13-工作区设计] §7.1）。 */
export type CliWorkspaceKind = 'user' | 'dev';

/** 工作区运行标记（`host-state.json`）。 */
export interface ICliWorkspaceState {
  readonly running: boolean;
  readonly pid?: number;
  readonly startedAt?: string;
}

/** `chips status` 输出（[CLI 完整参考] §3.2.3）。 */
export interface ICliWorkspaceStatus {
  readonly workspace: { readonly path: string; readonly kind: CliWorkspaceKind };
  readonly state: ICliWorkspaceState;
  readonly platformVersion: string;
}

/** 配置层级（[10-配置系统设计] §2.2）。 */
export type CliConfigLayer = 'user' | 'workspace';

/** 日志级别。 */
export type CliLogLevel = 'error' | 'warn' | 'info' | 'debug';

/** 日志条目（[04-故障排查手册] §2.2 的消费视图）。 */
export interface ICliLogEntry {
  readonly timestamp: string;
  readonly level: CliLogLevel;
  readonly namespace: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

/** 插件角色。 */
export type CliPluginRole = 'basecard' | 'boxlayout' | 'app' | 'service';

/** 插件来源（[03-插件架构设计] §4.1）。 */
export type CliPluginSource = 'builtin' | 'user' | 'development';

/** 插件状态。 */
export type CliPluginState = 'discovered' | 'installed' | 'active' | 'disabled' | 'failed';

/** 插件列表记录（[CLI 完整参考] §3.5.5）。 */
export interface ICliPluginRecord {
  readonly id: string;
  readonly version: string;
  readonly role: CliPluginRole;
  readonly name: string;
  readonly source: CliPluginSource;
  readonly state: CliPluginState;
  readonly enabled: boolean;
}

/** 插件详情（[CLI 完整参考] §3.5.5）。 */
export interface ICliPluginDetail extends ICliPluginRecord {
  readonly installPath: string;
  readonly manifestPath: string;
  readonly permissions: readonly string[];
  readonly grantedPermissions: readonly string[];
  readonly dependencies: readonly { readonly id: string; readonly version: string }[];
  readonly lastError?: { readonly code: string; readonly message: string };
}

/** CLI 入口声明（manifest `cli.commands[]`，[CLI 完整参考] §5.1）。 */
export interface ICliCommandDeclaration {
  readonly commandPath: string | readonly string[];
  readonly commandId?: string;
  readonly title: string;
  readonly description?: string;
  readonly examples?: readonly string[];
  readonly permissions?: readonly string[];
  readonly target: ICliCommandTarget;
  readonly arguments?: readonly IParameterDeclaration[];
  readonly options?: readonly IParameterDeclaration[];
  readonly output?: ICliCommandOutputDeclaration;
  readonly job?: ICliJobDeclaration;
  readonly conflict?: ICliConflictDeclaration;
}

/** 命令目标（[CLI 完整参考] §5.3）。 */
export interface ICliCommandTarget {
  readonly type: 'app' | 'service';
  readonly pluginId: string;
  readonly capability?: string;
  readonly surface?: {
    readonly open?: boolean;
    readonly focus?: boolean;
    readonly reuse?: 'always' | 'never' | 'preferred';
  };
}

/** 输出声明（[CLI 完整参考] §5.4）。 */
export interface ICliCommandOutputDeclaration {
  readonly mode?: 'human' | 'json';
  readonly json?: 'supported' | 'required' | 'unsupported';
  readonly artifacts?: readonly string[];
}

/** 任务声明（[CLI 完整参考] §5.7）。 */
export interface ICliJobDeclaration {
  readonly wait?: boolean;
  readonly cancelOnInterrupt?: boolean;
}

/** 冲突声明（[CLI 完整参考] §5.5）。 */
export interface ICliConflictDeclaration {
  readonly priority?: number;
  readonly namespace?: string;
}

/** CLI 入口视图（[CLI 完整参考] §5.1、§5.6）。 */
export interface ICliCommandView {
  readonly entryId: string;
  readonly commandPath: readonly string[];
  readonly commandId?: string;
  readonly pluginId: string;
  readonly enabled: boolean;
  readonly declaration: ICliCommandDeclaration;
  readonly conflicts: readonly ICliCommandConflict[];
}

/** 冲突条目。 */
export interface ICliCommandConflict {
  readonly entryId: string;
  readonly commandPath: readonly string[];
  readonly pluginId: string;
  readonly priority: number;
  readonly namespace?: string;
}

/** 发现查询（[CLI 完整参考] §5.6）。 */
export interface ICliCommandQuery {
  readonly entryId?: string;
  readonly commandPath?: string | readonly string[];
  readonly pluginId?: string;
  readonly targetType?: 'app' | 'service';
  readonly includeDisabled?: boolean;
}

/** 发现结果索引（条目路径 → entryId 列表）。 */
export type ICliCommandIndex = Readonly<Record<string, readonly string[]>>;

/** `cli.command.list` 结果。 */
export interface ICliCommandListResult {
  readonly index: ICliCommandIndex;
  readonly commands: readonly ICliCommandView[];
}

/** `cli.command.resolve` 结果。 */
export interface ICliCommandResolveResult {
  readonly command?: ICliCommandView;
  readonly conflicts: readonly ICliCommandConflict[];
}

/** 任务状态（[CLI 完整参考] §5.6）。 */
export type CliTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/** 任务记录。 */
export interface ICliTaskRecord {
  readonly taskId: string;
  readonly pluginId: string;
  readonly commandId: string;
  readonly commandPath?: readonly string[];
  readonly status: CliTaskStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly progress?: Readonly<Record<string, unknown>>;
  readonly output?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
    readonly retryable?: boolean;
  };
}

/** `cli-task` 契约（[CLI 完整参考] §5.6、§5.8）。 */
export interface ICliTaskApi {
  create(input: {
    readonly pluginId: string;
    readonly commandId: string;
    readonly commandPath?: readonly string[];
  }): Promise<ICliTaskRecord>;
  bindInvocation(input: {
    readonly taskId: string;
    readonly invocationId?: string;
    readonly sessionId?: string;
  }): Promise<ICliTaskRecord>;
  get(taskId: string): Promise<ICliTaskRecord>;
  active(commandId: string): Promise<ICliTaskRecord | undefined>;
  progress(taskId: string, progress: Readonly<Record<string, unknown>>): Promise<ICliTaskRecord>;
  complete(taskId: string, output?: unknown): Promise<ICliTaskRecord>;
  fail(taskId: string, error: unknown): Promise<ICliTaskRecord>;
  cancel(taskId: string): Promise<ICliTaskRecord>;
}

/** `command:invoke` 结果（[13-命令系统契约] §3.2）。 */
export interface ICliCommandInvokeResult {
  readonly invocationId: string;
  readonly commandId: string;
  readonly target: 'platform' | 'main' | 'ui';
  readonly status: 'completed' | 'dispatched';
}

/** CLI 操作日志记录（[CLI 完整参考] §2.8）。 */
export interface ICliOperationRecord {
  readonly namespace: 'cli';
  readonly action: 'operation.execute';
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** 插件安装输入。 */
export interface ICliPluginInstallInput {
  readonly path: string;
  /** `development` 来源仅在开发入口可用（[CLI 完整参考] §3.5.4）。 */
  readonly source: CliPluginSource;
  /** 未签名发布者的显式确认（非交互环境必须）。 */
  readonly yes: boolean;
}

/** 更新渠道（[06-更新与分发规范] §2）。 */
export type CliUpdateChannel = 'stable' | 'beta';

/** 更新检查结果。 */
export interface ICliUpdateCheckResult {
  readonly currentVersion: string;
  readonly latestVersion: string | null;
  readonly channel: CliUpdateChannel;
  readonly updateAvailable: boolean;
  readonly publishedAt?: string;
  readonly notesUrl?: string;
  readonly reason?: string;
}

/** 更新安装结果。 */
export interface ICliUpdateInstallResult {
  readonly installed: boolean;
  readonly version?: string;
  readonly reason?: string;
}

/** 诊断检查项。 */
export interface ICliDoctorCheck {
  readonly id: string;
  readonly status: 'ok' | 'warn' | 'error';
  readonly detail: string;
  readonly fixable: boolean;
}

/** 诊断报告。 */
export interface ICliDoctorReport {
  readonly workspace: { readonly path: string; readonly kind: CliWorkspaceKind };
  readonly checks: readonly ICliDoctorCheck[];
}

/** 打开结果。 */
export interface ICliOpenResult {
  readonly path: string;
  readonly handler:
    { readonly pluginId: string; readonly kind: 'app' | 'service' } | { readonly kind: 'shell' };
}

/** 脚手架计划（`@chips/sdk/scaffold` 的 `IScaffoldPlan` 消费视图）。 */
export interface IScaffoldPlan {
  readonly targetDir: string;
  readonly files: readonly { readonly path: string; readonly content: string }[];
  readonly manifest: {
    readonly id: string;
    readonly version: string;
    readonly type: CliPluginRole;
    readonly name: string;
  };
}

/** `plugin create` 结果。 */
export interface ICliArtifactCreateResult {
  readonly pluginId: string;
  readonly role: CliPluginRole;
  readonly targetDir: string;
  readonly files: readonly string[];
}

/** `plugin pack` 结果。 */
export interface ICliArtifactPackResult {
  readonly archivePath: string;
  readonly name: string;
  readonly version: string;
  readonly role: CliPluginRole;
  readonly memberCount: number;
  readonly archiveSize: number;
  readonly digest: string;
  readonly signed: boolean;
}

/** 五阶段校验的阶段结果。 */
export interface ICliArtifactStageResult {
  readonly stage: 'archive' | 'layout' | 'manifest' | 'signature' | 'hash';
  readonly status: 'passed' | 'skipped' | 'failed';
  readonly detail: string;
}

/** `plugin validate` 结果。 */
export interface ICliArtifactValidateResult {
  readonly valid: boolean;
  readonly stages: readonly ICliArtifactStageResult[];
  readonly warnings?: readonly string[];
}

/** 本地产物引擎端口（`plugin create` / `pack` / `validate`）。 */
export interface ICliArtifactsApi {
  create(input: {
    readonly role: CliPluginRole;
    readonly pluginId: string;
    readonly name: string;
    readonly dir: string;
    readonly fileSystem: IFileSystemPort;
  }): Promise<ICliArtifactCreateResult>;
  pack(input: {
    readonly dir: string;
    readonly out?: string;
    readonly sign: boolean;
    readonly keyId?: string;
    /** 签名私钥文件路径（`CHIPS_SIGNING_KEY_FILE`）；只以文件路径注入，禁止出现在命令行（§2.7、§2.8）。 */
    readonly signingKeyFile?: string;
    readonly fileSystem: IFileSystemPort;
  }): Promise<ICliArtifactPackResult>;
  validate(input: {
    readonly path: string;
    readonly source: CliPluginSource;
    /** 平台版本；承载环境不可用时缺省，`engines.chips` 仅校验语法（以告警呈现）。 */
    readonly platformVersion?: string;
    /**
     * 信任注册文件路径（`CHIPS_TRUST_ROOTS_FILE`，[CLI 完整参考] §2.7）；
     * 只以文件路径注入，给出时覆盖构造期 `trustRoots`（[插件包格式] §6.3）。
     */
    readonly trustRootsFile?: string;
    readonly fileSystem: IFileSystemPort;
  }): Promise<ICliArtifactValidateResult>;
}

/** 开发宿主 `run` 输入。 */
export interface ICliDevRunInput {
  readonly dir: string;
  readonly workspace: string;
}

/** 开发宿主服务能力调用输入。 */
export interface ICliDevServiceInvokeInput {
  readonly capability: string;
  readonly dir?: string;
  readonly input: unknown;
  readonly workspace: string;
}

/** 平台操作端口：由承载适配器（平台发行包/宿主）实现。 */
export interface ICliPlatformOperations {
  version(): Promise<string>;
  /** 缺省工作区路径：`user` 为平台绑定的用户工作区；`dev` 为 `${userData}/dev/workspace`（[CLI 完整参考] §2.2）。 */
  defaultWorkspacePath(kind: CliWorkspaceKind): Promise<string>;
  workspaceStatus(): Promise<ICliWorkspaceStatus>;
  workspaceStart(): Promise<ICliWorkspaceState>;
  workspaceStop(): Promise<ICliWorkspaceState>;
  configList(layer: CliConfigLayer | undefined): Promise<unknown>;
  configSet(key: string, value: unknown, layer: CliConfigLayer | undefined): Promise<unknown>;
  configReset(key: string, layer: CliConfigLayer | undefined): Promise<unknown>;
  logsRead(options: {
    readonly lines: number;
    readonly level?: CliLogLevel;
  }): Promise<readonly ICliLogEntry[]>;
  logsFollow(
    options: { readonly level?: CliLogLevel },
    onEntry: (entry: ICliLogEntry) => void,
    signal: AbortSignal
  ): Promise<void>;
  pluginList(filter: {
    readonly role?: CliPluginRole;
    readonly source?: CliPluginSource;
  }): Promise<readonly ICliPluginRecord[]>;
  pluginInfo(pluginId: string): Promise<ICliPluginDetail>;
  pluginInstall(input: ICliPluginInstallInput): Promise<ICliPluginRecord>;
  pluginUninstall(pluginId: string): Promise<void>;
  pluginEnable(pluginId: string): Promise<ICliPluginRecord>;
  pluginDisable(pluginId: string): Promise<ICliPluginRecord>;
  open(path: string): Promise<ICliOpenResult>;
  updateCheck(channel: CliUpdateChannel): Promise<ICliUpdateCheckResult>;
  updateInstall(channel: CliUpdateChannel): Promise<ICliUpdateInstallResult>;
  doctor(options: { readonly fix: boolean; readonly verbose: boolean }): Promise<ICliDoctorReport>;
}

/** 应用实例确保运行（"启动并投递" 的平台侧）：未运行时按正式启动链路启动并等待入口级 `commandId` 注册。 */
export interface ICliAppLaunchOperations {
  ensureRunning(input: {
    readonly pluginId: string;
    readonly surface?: ICliCommandTarget['surface'];
  }): Promise<void>;
}

/** 开发宿主操作端口。 */
export interface ICliDevHostOperations {
  runPlugin(input: ICliDevRunInput): Promise<unknown>;
}

/** 能力调用端口（`service` 目标与开发侧能力联调的统一入口）。 */
export interface ICliCapabilityOperations {
  invoke(input: ICliDevServiceInvokeInput): Promise<ICliCapabilityInvokeResult>;
}

/** 能力调用结果：`owner` 为能力提供方插件 ID（可缺省，开发宿主可返回）。 */
export interface ICliCapabilityInvokeResult {
  readonly output: unknown;
  readonly owner?: string;
}

/** 命令调用端口（`command:invoke` 的 CLI 侧包装）。 */
export interface ICliCommandOperations {
  invoke(input: {
    readonly commandId: string;
    readonly payload?: unknown;
  }): Promise<ICliCommandInvokeResult>;
}

/** CLI 客户端（命令层的唯一平台接缝）。 */
export interface ICliClient {
  readonly platform: ICliPlatformOperations;
  readonly apps: ICliAppLaunchOperations;
  readonly devHost: ICliDevHostOperations;
  readonly commands: ICliCommandOperations;
  readonly capabilities: ICliCapabilityOperations;
  readonly cliCommand: {
    list(query?: ICliCommandQuery): Promise<ICliCommandListResult>;
    get(query: ICliCommandQuery): Promise<ICliCommandView | undefined>;
    resolve(query: ICliCommandQuery): Promise<ICliCommandResolveResult>;
  };
  readonly cliTask: ICliTaskApi;
  readonly artifacts: ICliArtifactsApi;
  readonly operations: {
    record(record: ICliOperationRecord): Promise<void>;
  };
  /**
   * 客户端资源释放（可选项；bin 生命周期挂点，《17》§5.2 波 3 装配）：
   * 生产承载装配在此关闭常驻 carrier 会话，保证 CLI 进程「一次调用一连接」用后即别、
   * 事件Loop 无悬挂 socket；无会话时为空操作。
   */
  readonly dispose?: () => void | Promise<void>;
}
