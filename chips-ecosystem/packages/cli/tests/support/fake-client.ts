/**
 * 命令级测试的 `ICliClient` 测试替身：记录调用、返回预置结果、可注入错误。
 *
 * 该替身只存在于测试代码中（[禁止事项] 09：测试替身不得进入 `src/`）。
 */

import { ChipsError } from '../../src/errors.js';
import type {
  ICliArtifactCreateResult,
  ICliArtifactPackResult,
  ICliArtifactValidateResult,
  ICliClient,
  ICliCommandConflict,
  ICliCommandListResult,
  ICliCommandQuery,
  ICliCommandResolveResult,
  ICliCommandView,
  ICliDoctorReport,
  ICliLogEntry,
  ICliOpenResult,
  ICliPluginDetail,
  ICliPluginRecord,
  ICliTaskRecord,
  ICliUpdateCheckResult,
  ICliUpdateInstallResult,
  ICliWorkspaceStatus,
} from '../../src/client/types.js';

/** 任务脚本动作。 */
export type TaskAction =
  | { readonly kind: 'progress'; readonly progress: Readonly<Record<string, unknown>> }
  | { readonly kind: 'complete'; readonly output?: unknown }
  | { readonly kind: 'fail'; readonly error: { readonly code: string; readonly message: string } };

export class FakeCliClient implements ICliClient {
  public readonly calls: string[] = [];

  public workspaceStatusResult: ICliWorkspaceStatus = {
    workspace: { path: '/tmp/chips-user', kind: 'user' },
    state: { running: false },
    platformVersion: '0.1.0',
  };

  public workspaceStartResult = { running: true, pid: 4242, startedAt: '2026-09-19T00:00:00.000Z' };

  public workspaceStopResult = { running: false };

  public configListResult: unknown = { 'platform.log.level': 'info' };

  public configSetResult: unknown = { ok: true };

  public configResetResult: unknown = { ok: true };

  public logsEntries: readonly ICliLogEntry[] = [
    { timestamp: '2026-09-19T00:00:00.000Z', level: 'info', namespace: 'kernel', message: '就绪' },
  ];

  public followEntries: readonly ICliLogEntry[] = [
    {
      timestamp: '2026-09-19T00:00:01.000Z',
      level: 'warn',
      namespace: 'bridge',
      message: '慢调用',
    },
  ];

  public pluginRecords: readonly ICliPluginRecord[] = [];

  public pluginDetail: ICliPluginDetail = {
    id: 'chips.example.hello',
    version: '0.1.0',
    role: 'app',
    name: '你好世界',
    source: 'user',
    state: 'installed',
    enabled: false,
    installPath: '/tmp/plugins/hello',
    manifestPath: '/tmp/plugins/hello/manifest.yaml',
    permissions: ['resources:read'],
    grantedPermissions: ['resources:read'],
    dependencies: [],
  };

  public installResult: ICliPluginRecord = {
    id: 'chips.example.hello',
    version: '0.1.0',
    role: 'app',
    name: '你好世界',
    source: 'user',
    state: 'installed',
    enabled: false,
  };

  public openResult: ICliOpenResult = { path: '/tmp/doc.card', handler: { kind: 'shell' } };

  public updateCheckResult: ICliUpdateCheckResult = {
    currentVersion: '0.1.0',
    latestVersion: '0.1.0',
    channel: 'stable',
    updateAvailable: false,
  };

  public updateInstallResult: ICliUpdateInstallResult = { installed: false, reason: 'up-to-date' };

  public doctorResult: ICliDoctorReport = {
    workspace: { path: '/tmp/chips-user', kind: 'user' },
    checks: [
      { id: 'workspace.marker', status: 'ok', detail: '标记与保留目录有效', fixable: false },
    ],
  };

  public commandsIndex: readonly ICliCommandView[] = [];

  /** `cli.command.get` / `cli.command.resolve` 的预置返回（`conflicts` 为冲突组详情）。 */
  public resolveResult: {
    readonly command?: ICliCommandView;
    readonly conflicts?: readonly ICliCommandConflict[];
  } = {};

  public taskStatus: ICliTaskRecord['status'] = 'completed';

  public taskErrorMessage: { code: string; message: string } = {
    code: 'CLI_TASK_FAILED',
    message: '任务失败',
  };

  public taskOutput: unknown = undefined;

  public taskScript: readonly TaskAction[] = [];

  public invokeError: Error | undefined;

  public invokeStatus: 'completed' | 'dispatched' = 'completed';

  public invokeResultSink: unknown = undefined;

  public capabilityResult: { output: unknown; owner?: string } = { output: { text: '你好' } };

  public ensureRunningError: Error | undefined;

  public ensureRunningCalls = 0;

  public operationsRecords: unknown[] = [];

  public createResult: ICliArtifactCreateResult = {
    pluginId: 'chips.example.hello',
    role: 'app',
    targetDir: '/tmp/hello',
    files: ['manifest.yaml', 'package.json'],
  };

  public packResult: ICliArtifactPackResult = {
    archivePath: '/tmp/hello/dist/hello-0.1.0.cpk',
    name: 'hello',
    version: '0.1.0',
    role: 'app',
    memberCount: 4,
    archiveSize: 31_334,
    digest: 'sha256:deadbeef',
    signed: false,
  };

  public validateResult: ICliArtifactValidateResult = {
    valid: true,
    stages: [
      { stage: 'archive', status: 'passed', detail: '全部成员 Stored' },
      { stage: 'layout', status: 'passed', detail: 'app 布局' },
      { stage: 'manifest', status: 'passed', detail: 'chips.example.hello@0.1.0（app）' },
      { stage: 'signature', status: 'skipped', detail: 'development 来源' },
      { stage: 'hash', status: 'passed', detail: 'sha256:deadbeef' },
    ],
  };

  public validateError: Error | undefined;

  public createError: Error | undefined;

  public packError: Error | undefined;

  public devRunResult: unknown = { ok: true };

  public devRunCalls: unknown[] = [];

  /**
   * 平台操作替身：端口契约是 Promise，替身按同步方式记账后以 `Promise.resolve` 交付预置结果
   * （替身不存在真实的异步等待，不写 `async`）。
   */
  public readonly platform = {
    version: (): Promise<string> => {
      this.calls.push('platform.version');
      return Promise.resolve(this.workspaceStatusResult.platformVersion);
    },
    defaultWorkspacePath: (kind: 'user' | 'dev'): Promise<string> => {
      this.calls.push(`platform.defaultWorkspacePath:${kind}`);
      return Promise.resolve(kind === 'dev' ? '/tmp/chips-dev' : '/tmp/chips-user');
    },
    workspaceStatus: (): Promise<ICliWorkspaceStatus> => {
      this.calls.push('platform.workspaceStatus');
      return Promise.resolve(this.workspaceStatusResult);
    },
    workspaceStart: (): Promise<typeof this.workspaceStartResult> => {
      this.calls.push('platform.workspaceStart');
      return Promise.resolve(this.workspaceStartResult);
    },
    workspaceStop: (): Promise<typeof this.workspaceStopResult> => {
      this.calls.push('platform.workspaceStop');
      return Promise.resolve(this.workspaceStopResult);
    },
    configList: (layer?: string): Promise<unknown> => {
      this.calls.push(`platform.configList:${layer ?? 'default'}`);
      return Promise.resolve(this.configListResult);
    },
    configSet: (key: string, value: unknown, layer?: string): Promise<unknown> => {
      this.calls.push(`platform.configSet:${key}:${JSON.stringify(value)}:${layer ?? 'default'}`);
      return Promise.resolve(this.configSetResult);
    },
    configReset: (key: string, layer?: string): Promise<unknown> => {
      this.calls.push(`platform.configReset:${key}:${layer ?? 'default'}`);
      return Promise.resolve(this.configResetResult);
    },
    logsRead: (options: { lines: number; level?: string }): Promise<readonly ICliLogEntry[]> => {
      this.calls.push(`platform.logsRead:${options.lines}:${options.level ?? 'all'}`);
      return Promise.resolve(this.logsEntries);
    },
    logsFollow: (
      options: { level?: string },
      onEntry: (entry: ICliLogEntry) => void,
      _signal: AbortSignal
    ): Promise<void> => {
      this.calls.push(`platform.logsFollow:${options.level ?? 'all'}`);
      for (const entry of this.followEntries) {
        onEntry(entry);
      }
      return Promise.resolve();
    },
    pluginList: (filter: {
      role?: string;
      source?: string;
    }): Promise<readonly ICliPluginRecord[]> => {
      this.calls.push(`platform.pluginList:${filter.role ?? 'all'}:${filter.source ?? 'all'}`);
      return Promise.resolve(this.pluginRecords);
    },
    pluginInfo: (pluginId: string): Promise<ICliPluginDetail> => {
      this.calls.push(`platform.pluginInfo:${pluginId}`);
      return Promise.resolve(this.pluginDetail);
    },
    pluginInstall: (input: {
      path: string;
      source: string;
      yes: boolean;
    }): Promise<ICliPluginRecord> => {
      this.calls.push(`platform.pluginInstall:${input.path}:${input.source}:${String(input.yes)}`);
      return Promise.resolve(this.installResult);
    },
    pluginUninstall: (pluginId: string): Promise<void> => {
      this.calls.push(`platform.pluginUninstall:${pluginId}`);
      return Promise.resolve();
    },
    pluginEnable: (pluginId: string): Promise<ICliPluginRecord> => {
      this.calls.push(`platform.pluginEnable:${pluginId}`);
      return Promise.resolve({ ...this.installResult, state: 'active', enabled: true });
    },
    pluginDisable: (pluginId: string): Promise<ICliPluginRecord> => {
      this.calls.push(`platform.pluginDisable:${pluginId}`);
      return Promise.resolve({ ...this.installResult, state: 'disabled', enabled: false });
    },
    open: (path: string): Promise<ICliOpenResult> => {
      this.calls.push(`platform.open:${path}`);
      return Promise.resolve({ ...this.openResult, path });
    },
    updateCheck: (channel: string): Promise<ICliUpdateCheckResult> => {
      this.calls.push(`platform.updateCheck:${channel}`);
      return Promise.resolve(this.updateCheckResult);
    },
    updateInstall: (channel: string): Promise<ICliUpdateInstallResult> => {
      this.calls.push(`platform.updateInstall:${channel}`);
      return Promise.resolve(this.updateInstallResult);
    },
    doctor: (options: { fix: boolean; verbose: boolean }): Promise<ICliDoctorReport> => {
      this.calls.push(`platform.doctor:${String(options.fix)}:${String(options.verbose)}`);
      return Promise.resolve(this.doctorResult);
    },
  };

  /** 可注入错误的替身：预置错误一律以拒绝形态透出，与真实承载适配器一致。 */
  public readonly apps = {
    ensureRunning: (input: { pluginId: string }): Promise<void> => {
      this.ensureRunningCalls += 1;
      this.calls.push(`apps.ensureRunning:${input.pluginId}`);
      return this.ensureRunningError === undefined
        ? Promise.resolve()
        : Promise.reject(this.ensureRunningError);
    },
  };

  public readonly devHost = {
    runPlugin: (input: unknown): Promise<unknown> => {
      this.devRunCalls.push(input);
      this.calls.push('devHost.runPlugin');
      return Promise.resolve(this.devRunResult);
    },
  };

  public readonly commands = {
    invoke: (input: {
      commandId: string;
    }): Promise<{
      invocationId: string;
      commandId: string;
      target: 'main';
      status: 'completed' | 'dispatched';
    }> => {
      this.calls.push(`commands.invoke:${input.commandId}`);
      if (this.invokeError !== undefined) {
        return Promise.reject(this.invokeError);
      }
      return Promise.resolve({
        invocationId: 'inv-1',
        commandId: input.commandId,
        target: 'main',
        status: this.invokeStatus,
      });
    },
  };

  public readonly capabilities = {
    invoke: (input: { capability: string }): Promise<{ output: unknown; owner?: string }> => {
      this.calls.push(`capabilities.invoke:${input.capability}`);
      return Promise.resolve(this.capabilityResult);
    },
  };

  public readonly cliCommand = {
    list: (): Promise<ICliCommandListResult> => {
      this.calls.push('cliCommand.list');
      return Promise.resolve({ index: {}, commands: this.commandsIndex });
    },
    get: (query: ICliCommandQuery): Promise<ICliCommandView | undefined> => {
      this.calls.push(`cliCommand.get:${JSON.stringify(query)}`);
      return Promise.resolve(this.resolveResult.command);
    },
    resolve: (query: ICliCommandQuery): Promise<ICliCommandResolveResult> => {
      this.calls.push(`cliCommand.resolve:${JSON.stringify(query)}`);
      const command = this.resolveResult.command;
      return Promise.resolve({
        ...(command === undefined ? {} : { command }),
        conflicts: this.resolveResult.conflicts ?? [],
      });
    },
  };

  public readonly cliTask = {
    create: (input: { pluginId: string; commandId: string }): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.create:${input.commandId}`);
      return Promise.resolve(this.taskRecord('running'));
    },
    bindInvocation: (input: { taskId: string }): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.bindInvocation:${input.taskId}`);
      return Promise.resolve(this.taskRecord(this.taskStatus));
    },
    get: (taskId: string): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.get:${taskId}`);
      return Promise.resolve(this.taskRecord(this.taskStatus));
    },
    active: (commandId: string): Promise<ICliTaskRecord | undefined> => {
      this.calls.push(`cliTask.active:${commandId}`);
      return Promise.resolve(undefined);
    },
    progress: (taskId: string): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.progress:${taskId}`);
      return Promise.resolve(this.taskRecord('running'));
    },
    complete: (taskId: string): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.complete:${taskId}`);
      return Promise.resolve(this.taskRecord('completed'));
    },
    fail: (taskId: string): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.fail:${taskId}`);
      return Promise.resolve(this.taskRecord('failed'));
    },
    cancel: (taskId: string): Promise<ICliTaskRecord> => {
      this.calls.push(`cliTask.cancel:${taskId}`);
      this.taskStatus = 'cancelled';
      return Promise.resolve(this.taskRecord('cancelled'));
    },
  };

  public readonly artifacts = {
    create: (input: {
      role: string;
      pluginId: string;
      name: string;
      dir: string;
    }): Promise<ICliArtifactCreateResult> => {
      this.calls.push(`artifacts.create:${input.role}:${input.pluginId}:${input.dir}`);
      if (this.createError !== undefined) {
        return Promise.reject(this.createError);
      }
      return Promise.resolve({
        ...this.createResult,
        pluginId: input.pluginId,
        targetDir: input.dir,
      });
    },
    pack: (input: { dir: string; sign: boolean }): Promise<ICliArtifactPackResult> => {
      this.calls.push(`artifacts.pack:${input.dir}:${String(input.sign)}`);
      if (this.packError !== undefined) {
        return Promise.reject(this.packError);
      }
      return Promise.resolve(this.packResult);
    },
    validate: (input: {
      path: string;
      source: string;
      trustRootsFile?: string;
    }): Promise<ICliArtifactValidateResult> => {
      this.calls.push(
        `artifacts.validate:${input.path}:${input.source}` +
          (input.trustRootsFile === undefined ? '' : `:trust=${input.trustRootsFile}`)
      );
      if (this.validateError !== undefined) {
        return Promise.reject(this.validateError);
      }
      return Promise.resolve(this.validateResult);
    },
  };

  public readonly operations = {
    record: (record: unknown): Promise<void> => {
      this.operationsRecords.push(record);
      return Promise.resolve();
    },
  };

  private taskRecord(status: ICliTaskRecord['status']): ICliTaskRecord {
    const record: ICliTaskRecord = {
      taskId: 'task-1',
      pluginId: 'chips.official.office',
      commandId: 'office:open',
      status,
      createdAt: 1,
      updatedAt: 2,
    };
    if (status === 'failed') {
      return { ...record, error: this.taskErrorMessage };
    }
    if (this.taskOutput !== undefined && status === 'completed') {
      return { ...record, output: this.taskOutput };
    }
    return record;
  }
}

/** 构造任务失败错误（便于断言退出码 7）。 */
export function taskFailure(code: string, message: string): ChipsError {
  return new ChipsError({ code, message });
}
