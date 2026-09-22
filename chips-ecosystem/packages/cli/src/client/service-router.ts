/**
 * `cli-command` / `cli-task` 对接层（[CLI 完整参考] §1.4、§5.6、§5.8）。
 *
 * 本模块是 CLI 中唯一把 {@link ICliClient} 端口映射到服务路由的位置：
 * - `cli.command.list` / `cli.command.get` / `cli.command.resolve`；
 * - `cli.task.create` / `bindInvocation` / `get` / `progress` / `complete` / `fail` / `cancel`；
 * - `command:invoke`（`source: 'cli'`）与 `service` 目标的能力调用。
 *
 * 其余平台操作（插件管理、工作区标记、配置、日志、更新、诊断、文件打开）在承载适配器
 * 缺位时相关命令返回 `CLI_TARGET_UNAVAILABLE`（[CLI 完整参考] §2.5）；开发宿主面
 * （`devHost`）已按《17-CLI承载链路契约》§5.5（Q8 裁定并轨）并入同一 carrier 协议——
 * 缺省臂经在册传输端口触达开发宿主，不存在第二套 dev 端点。
 */

import { cliError, toCliError } from '../errors.js';
import type {
  ICliAppLaunchOperations,
  ICliCapabilityInvokeResult,
  ICliCapabilityOperations,
  ICliClient,
  ICliCommandInvokeResult,
  ICliCommandListResult,
  ICliCommandOperations,
  ICliCommandQuery,
  ICliCommandResolveResult,
  ICliCommandView,
  ICliDevHostOperations,
  ICliInvoker,
  ICliPlatformOperations,
  ICliTaskRecord,
} from './types.js';

/** 对接层构造选项。 */
export interface IServiceRouterClientOptions {
  /** 传输端口；生产由 SDK 客户端（`@chips/sdk` 的 `createClient({ bridge })` 目标）提供。 */
  readonly invoker: ICliInvoker;
  /** 平台操作承载适配器。 */
  readonly platform?: ICliPlatformOperations;
  /** 应用实例确保运行适配器。 */
  readonly apps?: ICliAppLaunchOperations;
  /** 开发宿主适配器。 */
  readonly devHost?: ICliDevHostOperations;
  /** 操作日志写入器。 */
  readonly operations?: ICliClient['operations'];
  /** 本地产物引擎（`plugin create` / `pack` / `validate`）；缺省时相关命令返回 `CLI_TARGET_UNAVAILABLE`。 */
  readonly artifacts?: ICliClient['artifacts'];
}

/** 构造对接层客户端。 */
export function createServiceRouterClient(options: IServiceRouterClientOptions): ICliClient {
  const { invoker } = options;

  const unavailable = (method: string): never => {
    throw cliError('CLI_TARGET_UNAVAILABLE', `缺少平台承载适配器：${method}`, {
      method,
      hint: '请通过 createServiceRouterClient 的平台适配器选项注入承载实现',
    });
  };

  const cliCommand = {
    async list(query?: ICliCommandQuery): Promise<ICliCommandListResult> {
      const result = await invoker.request<ICliCommandListResult>('cli.command.list', query ?? {});
      return expectListResult(result);
    },
    async get(query: ICliCommandQuery): Promise<ICliCommandView | undefined> {
      assertQuery(query);
      const result = await invoker.request<{ command?: ICliCommandView }>('cli.command.get', query);
      if (!isRecord(result)) {
        throw cliError('CLI_COMMAND_QUERY_INVALID', '命令查询返回结构非法', { query });
      }
      return result.command;
    },
    async resolve(query: ICliCommandQuery): Promise<ICliCommandResolveResult> {
      assertQuery(query);
      const result = await invoker.request<ICliCommandResolveResult>('cli.command.resolve', query);
      if (!isRecord(result)) {
        throw cliError('CLI_COMMAND_QUERY_INVALID', '命令解析返回结构非法', { query });
      }
      const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
      return result.command === undefined ? { conflicts } : { command: result.command, conflicts };
    },
  };

  const cliTask = {
    async create(input: {
      readonly pluginId: string;
      readonly commandId: string;
      readonly commandPath?: readonly string[];
    }): Promise<ICliTaskRecord> {
      return expectTask(await invoker.request<{ task: ICliTaskRecord }>('cli.task.create', input));
    },
    async bindInvocation(input: {
      readonly taskId: string;
      readonly invocationId?: string;
      readonly sessionId?: string;
    }): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.bindInvocation', input)
      );
    },
    async get(taskId: string): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.get', { taskId })
      );
    },
    async active(commandId: string): Promise<ICliTaskRecord | undefined> {
      const result = await invoker.request<{ task?: ICliTaskRecord }>('cli.task.get', {
        commandId,
        activeOnly: true,
      });
      return isRecord(result) ? result.task : undefined;
    },
    async progress(
      taskId: string,
      progress: Readonly<Record<string, unknown>>
    ): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.progress', { taskId, progress })
      );
    },
    async complete(taskId: string, output?: unknown): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.complete', { taskId, output })
      );
    },
    async fail(taskId: string, error: unknown): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.fail', { taskId, error })
      );
    },
    async cancel(taskId: string): Promise<ICliTaskRecord> {
      return expectTask(
        await invoker.request<{ task: ICliTaskRecord }>('cli.task.cancel', { taskId })
      );
    },
  };

  const commands: ICliCommandOperations = {
    async invoke(input: {
      readonly commandId: string;
      readonly payload?: unknown;
    }): Promise<ICliCommandInvokeResult> {
      return invoker.request<ICliCommandInvokeResult>('command:invoke', {
        commandId: input.commandId,
        payload: input.payload,
        source: 'cli',
      });
    },
  };

  const devHost: ICliDevHostOperations = {
    async runPlugin(input): Promise<unknown> {
      if (options.devHost !== undefined) {
        return options.devHost.runPlugin(input);
      }
      // §5.5 devHost 并轨（Q8 裁定采 (a)）：开发宿主 = 同一 carrier 协议的工作区实例，
      // 接入唯一走本链路在册传输端口（端点派生/环境覆盖面/握手全部同一条实现），
      // 不存在也不新增第二套 dev 端点协议。触达后按 §5.1 在册集合零新增纪律：
      // 「装载并投递 dev 工程」依赖宿主启动输入正式投递装配（R3，工单039 并轨挂账），
      // 本波如实收口为承载不可用定性（07.04 §4.2「承载运行时不可用 → 6」），不临时投递凑绿。
      try {
        await invoker.request('cli.command.list', {});
      } catch (error) {
        throw normalizeDevHostCarrierError(error, input.dir);
      }
      throw cliError(
        'CLI_TARGET_UNAVAILABLE',
        '开发宿主装载投递面未就绪：启动输入正式投递依赖宿主装配（工单039 R3 并轨挂账）',
        {
          method: 'devHost.runPlugin',
          dir: input.dir,
        }
      );
    },
  };

  const capabilities: ICliCapabilityOperations = {
    async invoke(input): Promise<ICliCapabilityInvokeResult> {
      const output = await invoker.request(input.capability, input.input);
      return { output };
    },
  };

  const platform: ICliPlatformOperations = {
    version: async () =>
      options.platform === undefined ? unavailable('platform.version') : options.platform.version(),
    defaultWorkspacePath: async (kind) =>
      options.platform === undefined
        ? unavailable('platform.defaultWorkspacePath')
        : options.platform.defaultWorkspacePath(kind),
    workspaceStatus: async () =>
      options.platform === undefined
        ? unavailable('platform.workspaceStatus')
        : options.platform.workspaceStatus(),
    workspaceStart: async () =>
      options.platform === undefined
        ? unavailable('platform.workspaceStart')
        : options.platform.workspaceStart(),
    workspaceStop: async () =>
      options.platform === undefined
        ? unavailable('platform.workspaceStop')
        : options.platform.workspaceStop(),
    configList: async (layer) =>
      options.platform === undefined
        ? unavailable('platform.configList')
        : options.platform.configList(layer),
    configSet: async (key, value, layer) =>
      options.platform === undefined
        ? unavailable('platform.configSet')
        : options.platform.configSet(key, value, layer),
    configReset: async (key, layer) =>
      options.platform === undefined
        ? unavailable('platform.configReset')
        : options.platform.configReset(key, layer),
    logsRead: async (input) =>
      options.platform === undefined
        ? unavailable('platform.logsRead')
        : options.platform.logsRead(input),
    logsFollow: async (input, onEntry, signal) =>
      options.platform === undefined
        ? unavailable('platform.logsFollow')
        : options.platform.logsFollow(input, onEntry, signal),
    pluginList: async (filter) =>
      options.platform === undefined
        ? unavailable('platform.pluginList')
        : options.platform.pluginList(filter),
    pluginInfo: async (pluginId) =>
      options.platform === undefined
        ? unavailable('platform.pluginInfo')
        : options.platform.pluginInfo(pluginId),
    pluginInstall: async (input) =>
      options.platform === undefined
        ? unavailable('platform.pluginInstall')
        : options.platform.pluginInstall(input),
    pluginUninstall: async (pluginId) =>
      options.platform === undefined
        ? unavailable('platform.pluginUninstall')
        : options.platform.pluginUninstall(pluginId),
    pluginEnable: async (pluginId) =>
      options.platform === undefined
        ? unavailable('platform.pluginEnable')
        : options.platform.pluginEnable(pluginId),
    pluginDisable: async (pluginId) =>
      options.platform === undefined
        ? unavailable('platform.pluginDisable')
        : options.platform.pluginDisable(pluginId),
    open: async (path) =>
      options.platform === undefined ? unavailable('platform.open') : options.platform.open(path),
    updateCheck: async (channel) =>
      options.platform === undefined
        ? unavailable('platform.updateCheck')
        : options.platform.updateCheck(channel),
    updateInstall: async (channel) =>
      options.platform === undefined
        ? unavailable('platform.updateInstall')
        : options.platform.updateInstall(channel),
    doctor: async (input) =>
      options.platform === undefined
        ? unavailable('platform.doctor')
        : options.platform.doctor(input),
  };

  const apps: ICliAppLaunchOperations = {
    async ensureRunning(input): Promise<void> {
      const apps = options.apps;
      if (apps === undefined) {
        throw cliError('CLI_TARGET_UNAVAILABLE', '缺少平台承载适配器：apps.ensureRunning', {
          method: 'apps.ensureRunning',
        });
      }
      await apps.ensureRunning(input);
    },
  };

  const operations: ICliClient['operations'] = {
    async record(record): Promise<void> {
      if (options.operations === undefined) {
        return;
      }
      await options.operations.record(record);
    },
  };

  return {
    platform,
    apps,
    devHost,
    commands,
    capabilities,
    cliCommand,
    cliTask,
    artifacts: options.artifacts ?? createUnavailableArtifacts(),
    operations,
  };
}

function createUnavailableArtifacts(): ICliClient['artifacts'] {
  // 端口契约是 Promise：缺失引擎时以拒绝形态透出 `CLI_TARGET_UNAVAILABLE`，不做同步抛出。
  const unavailable = (method: string): Promise<never> =>
    Promise.reject(cliError('CLI_TARGET_UNAVAILABLE', `缺少本地产物引擎：${method}`, { method }));
  return {
    create: () => unavailable('artifacts.create'),
    pack: () => unavailable('artifacts.pack'),
    validate: () => unavailable('artifacts.validate'),
  };
}

/**
 * devHost 并轨臂触达承载面的错误归一（《17》§5.5；07.04 §4.2「承载运行时不可用 →
 * `CLI_TARGET_UNAVAILABLE` / 6」）。
 *
 * @remarks 严格环境面（`CLI_PATH_INVALID`/`CLI_ARGUMENT_INVALID`，§2.6）与按需启动预算面
 * （`CLI_TIMEOUT`，§5.2-4）语义在册、原样透传；其余触达失败（含发现阶段定性与未识别异常）
 * 统一收口为 6——不带发现阶段 → 3 旁表提示（该提示的 §2.3 语义只属于插件命令发现链）。
 */
function normalizeDevHostCarrierError(error: unknown, dir: string): unknown {
  const normalized = toCliError(error);
  const passthroughCodes: readonly string[] = [
    'CLI_PATH_INVALID',
    'CLI_ARGUMENT_INVALID',
    'CLI_TIMEOUT',
  ];
  if (passthroughCodes.includes(normalized.code)) {
    return normalized;
  }
  return cliError('CLI_TARGET_UNAVAILABLE', undefined, {
    method: 'devHost.runPlugin',
    dir,
    reason: normalized.message,
  });
}

function assertQuery(query: ICliCommandQuery): void {
  if (query.entryId === undefined && query.commandPath === undefined) {
    throw cliError('CLI_COMMAND_QUERY_INVALID', '命令查询必须携带 entryId 或 commandPath', {
      query,
    });
  }
  if (
    query.targetType !== undefined &&
    query.targetType !== 'app' &&
    query.targetType !== 'service'
  ) {
    throw cliError('CLI_COMMAND_QUERY_INVALID', 'targetType 只能为 app 或 service', {
      targetType: query.targetType,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function expectListResult(value: unknown): ICliCommandListResult {
  if (!isRecord(value) || !Array.isArray(value.commands)) {
    throw cliError('CLI_COMMAND_QUERY_INVALID', '命令索引返回结构非法');
  }
  return {
    index: isRecord(value.index) ? (value.index as ICliCommandListResult['index']) : {},
    commands: value.commands as readonly ICliCommandView[],
  };
}

function expectTask(value: unknown): ICliTaskRecord {
  if (!isRecord(value) || !isRecord(value.task)) {
    throw cliError('CLI_TASK_INVALID', '任务路由返回结构非法');
  }
  return value.task as unknown as ICliTaskRecord;
}
