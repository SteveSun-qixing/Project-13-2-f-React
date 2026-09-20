/**
 * 插件命令执行（[CLI 完整参考] §3.10、§5.3、§5.4、§5.7）。
 *
 * 时序（`app` 目标）：
 * 解析声明与参数 → 权限预检 → `cli.task.create` → 确保实例运行（启动并投递）
 * → `command:invoke`（`source: 'cli'`）→ `cli.task.bindInvocation` → 等待任务终态
 * → 结果信封。
 *
 * `service` 目标为同步能力调用，不创建任务（§5.3.1）；未声明入口级 `commandId` 的
 * `app` 目标只启动实例并立即返回（§5.3.2）。
 */

import { cliError, cliErrorWithExitCode, CliInterruptedError, toCliError } from '../errors.js';
import type { ICliCommandDeclaration, ICliCommandView, ICliTaskRecord } from '../client/types.js';
import type { ICommandContext } from '../commands/types.js';
import { createProgressWriter } from '../output/progress.js';
import type { ICommandResult } from '../output/result.js';
import { parseParameters } from '../args/parse.js';
import {
  CANCEL_CONFIRM_POLL_INTERVAL_MS,
  CANCEL_CONFIRM_POLL_LIMIT,
  LIFECYCLE_APPLY_TIMEOUT_MS,
  TASK_POLL_INTERVAL_MS,
} from '../constants.js';
import type { ICommandMatch } from './index.js';
import { commandPathKey } from './index.js';

/** 执行输入。 */
export interface IPluginCommandExecutionInput {
  readonly context: ICommandContext;
  readonly match: ICommandMatch;
}

/** 结果信封（[CLI 完整参考] §2.4）。 */
export interface IResultEnvelope {
  readonly ok: true;
  readonly entryId: string;
  readonly commandPath: string;
  readonly commandId?: string;
  readonly target: { readonly type: 'app' | 'service'; readonly pluginId: string };
  readonly output?: unknown;
  readonly task?: { readonly taskId: string; readonly status: string };
  readonly artifacts?: readonly string[];
  readonly skipped?: boolean;
  readonly launched?: boolean;
}

/** 执行插件命令。 */
export async function executePluginCommand(
  input: IPluginCommandExecutionInput
): Promise<ICommandResult> {
  const { context, match } = input;
  const command = match.command;
  const declaration = command.declaration;
  const { argv, overwriteOverride } = extractOverwrite(match.remaining, declaration);

  const parsed = parseParameters({
    argv,
    declarations: {
      arguments: declaration.arguments ?? [],
      options: declaration.options ?? [],
    },
    cwd: context.cwd,
    fileSystem: context.fileSystem,
    overwriteOverride,
  });

  const jsonPolicy = declaration.output?.json ?? 'supported';
  if (jsonPolicy === 'unsupported' && context.globals.json) {
    throw cliError('CLI_ARGUMENT_INVALID', `命令 ${command.entryId} 不支持 --json 输出`, {
      entryId: command.entryId,
      json: 'unsupported',
    });
  }

  const mode = resolveOutputMode(declaration, context.globals.json, jsonPolicy);

  if (parsed.skipped) {
    // 输出冲突策略 skip：不调用目标，结果只含 `ok`、`entryId`、`commandPath`、`target`、`skipped`（§5.4.3）。
    const skippedEnvelope = buildEnvelope(command, { skipped: true });
    return {
      json: skippedEnvelope,
      human: renderHuman(skippedEnvelope),
      mode,
      humanEnvelope: true,
    };
  }

  await assertPermissions(context, command);

  const envelope = await dispatch(context, command, parsed.payload);
  return {
    json: envelope,
    human: renderHuman(envelope),
    mode,
    humanEnvelope: true,
  };
}

/** 剥离 CLI 级 `--overwrite`（仅当命令未声明同名选项时生效，§5.2）。 */
export function extractOverwrite(
  argv: readonly string[],
  declaration: ICliCommandDeclaration
): { readonly argv: readonly string[]; readonly overwriteOverride: boolean } {
  const declared = (declaration.options ?? []).some((option) => option.name === 'overwrite');
  if (declared) {
    return { argv, overwriteOverride: false };
  }
  let override = false;
  const stripped: string[] = [];
  for (const token of argv) {
    if (token === '--overwrite' || token === '--overwrite=true') {
      override = true;
      continue;
    }
    if (token === '--overwrite=false') {
      continue;
    }
    stripped.push(token);
  }
  return { argv: stripped, overwriteOverride: override };
}

function resolveOutputMode(
  declaration: ICliCommandDeclaration,
  jsonFlag: boolean,
  jsonPolicy: 'supported' | 'required' | 'unsupported'
): 'json' | 'human' {
  if (jsonFlag || jsonPolicy === 'required') {
    return 'json';
  }
  return declaration.output?.mode === 'human' ? 'human' : 'json';
}

/** 权限预检：声明权限必须已授权（§5.1、§六.5）。 */
async function assertPermissions(
  context: ICommandContext,
  command: ICliCommandView
): Promise<void> {
  const required = command.declaration.permissions ?? [];
  if (required.length === 0) {
    return;
  }
  const detail = await context.client.platform.pluginInfo(command.pluginId);
  const granted = detail.grantedPermissions;
  const missing = required.filter((permission) => !isGranted(granted, permission));
  if (missing.length > 0) {
    throw cliError('CLI_PERMISSION_DENIED', `命令所需的权限未授权：${missing.join('、')}`, {
      entryId: command.entryId,
      pluginId: command.pluginId,
      permissions: missing,
    });
  }
}

/** 授权记录（可能带限定值）是否覆盖基础权限 ID。 */
export function isGranted(granted: readonly string[], required: string): boolean {
  return granted.some((item) => item === required || item.startsWith(`${required}:`));
}

async function dispatch(
  context: ICommandContext,
  command: ICliCommandView,
  payload: Readonly<Record<string, unknown>>
): Promise<IResultEnvelope> {
  const declaration = command.declaration;
  const target = declaration.target;

  if (target.type === 'service') {
    const capability = target.capability;
    if (capability === undefined) {
      throw cliError('CLI_COMMAND_FAILED', `service 目标缺少 capability：${command.entryId}`, {
        entryId: command.entryId,
      });
    }
    const workspace = await context.workspace.resolve();
    const result = await context.client.capabilities.invoke({
      capability,
      input: payload,
      workspace: workspace.path,
    });
    // 信封的 `output` 是能力结果对象的 `output`（§2.4.5、§5.3.1）。
    return buildEnvelope(command, { output: result.output });
  }

  const commandId = declaration.commandId;
  if (commandId === undefined) {
    await withStartupTimeout(command.pluginId, () =>
      context.client.apps.ensureRunning({
        pluginId: command.pluginId,
        ...(target.surface === undefined ? {} : { surface: target.surface }),
      })
    );
    return buildEnvelope(command, { launched: true });
  }

  const job = declaration.job ?? {};
  if (job.wait === false) {
    const invokeResult = await context.client.commands.invoke({ commandId, payload });
    return buildEnvelope(command, { output: invokeResult });
  }

  const task = await context.client.cliTask.create({
    pluginId: command.pluginId,
    commandId,
    commandPath: command.commandPath,
  });
  const progress = createProgressWriter({ sink: context.io, env: context.env });
  let cancelRequested = false;
  const onAbort = (): void => {
    if (cancelRequested || job.cancelOnInterrupt !== true) {
      return;
    }
    cancelRequested = true;
    void context.client.cliTask.cancel(task.taskId).catch(() => undefined);
  };
  if (job.cancelOnInterrupt === true) {
    context.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    await withStartupTimeout(command.pluginId, () =>
      context.client.apps.ensureRunning({
        pluginId: command.pluginId,
        ...(target.surface === undefined ? {} : { surface: target.surface }),
      })
    );

    let invokeResult: { readonly invocationId: string; readonly status: string };
    try {
      invokeResult = await context.client.commands.invoke({ commandId, payload });
    } catch (error) {
      const normalized = toCliError(error);
      await context.client.cliTask.fail(task.taskId, normalized).catch(() => undefined);
      throw normalized;
    }
    await context.client.cliTask.bindInvocation({
      taskId: task.taskId,
      invocationId: invokeResult.invocationId,
    });

    const settled = await settleTask(context, task, job.cancelOnInterrupt === true);
    if (settled.status === 'failed') {
      // 任务失败终态固定以退出码 7 收口（失败类别优先于码值映射）：`cliErrorWithExitCode` 把提示
      // 登记到进程内旁表，退出码不进错误对象与输出；错误码保留应用上报的原样（§2.5、§2.6，
      // 《RFC-ChipsError统一裁定》§4.6）。
      const error = settled.error;
      const code = error !== undefined && error.code.length > 0 ? error.code : 'CLI_TASK_FAILED';
      const message =
        error !== undefined && error.message.length > 0 ? error.message : '任务执行失败';
      throw cliErrorWithExitCode(code, 7, message, { task: settled }, error?.retryable);
    }
    if (settled.status === 'cancelled') {
      throw cliError('CLI_TASK_CANCELLED', '任务已取消', { task: settled });
    }
    progress.clear();
    const envelope = buildEnvelope(command, {
      output: settled.output,
      task: { taskId: settled.taskId, status: settled.status },
    });
    const withArtifacts = attachArtifacts(envelope, declaration, settled.output);
    return withArtifacts;
  } finally {
    progress.clear();
    context.signal.removeEventListener('abort', onAbort);
  }
}

/** 等待任务终态；中断语义按 `job.cancelOnInterrupt` 处理（§5.7）。 */
async function settleTask(
  context: ICommandContext,
  initial: ICliTaskRecord,
  cancelOnInterrupt: boolean
): Promise<ICliTaskRecord> {
  let task = initial;
  while (task.status === 'running') {
    if (context.signal.aborted) {
      return handleInterrupt(context, task, cancelOnInterrupt);
    }
    await context.sleep(TASK_POLL_INTERVAL_MS, context.signal);
    task = await context.client.cliTask.get(task.taskId);
  }
  return task;
}

async function handleInterrupt(
  context: ICommandContext,
  task: ICliTaskRecord,
  cancelOnInterrupt: boolean
): Promise<ICliTaskRecord> {
  if (!cancelOnInterrupt) {
    // 未声明 cancelOnInterrupt 的命令不进入取消链路，直接中断（退出码 130，§2.5）。
    throw new CliInterruptedError();
  }
  if (task.status !== 'running') {
    return task;
  }
  // 声明 cancelOnInterrupt 的命令：请求取消并等待取消终态（§5.7.3）。
  let current = task;
  try {
    current = await context.client.cliTask.cancel(task.taskId);
  } catch {
    // 取消请求失败按未上报任务处理，直接以取消终态收口（§5.7.5）。
    throw cliError('CLI_TASK_CANCELLED', '任务已取消', { task });
  }
  for (
    let attempt = 0;
    attempt < CANCEL_CONFIRM_POLL_LIMIT && current.status === 'running';
    attempt += 1
  ) {
    await context.sleep(CANCEL_CONFIRM_POLL_INTERVAL_MS, context.signal);
    current = await context.client.cliTask.get(task.taskId);
  }
  if (current.status === 'running') {
    throw cliError('CLI_TASK_CANCELLED', '任务已取消', { task: current });
  }
  return current;
}

/** 启动等待超时：沿用内核 `LIFECYCLE_APPLY_TIMEOUT`（30s），超时返回 `CLI_TIMEOUT`（§5.3.2）。 */
async function withStartupTimeout<T>(pluginId: string, action: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        cliError('CLI_TIMEOUT', '等待应用实例启动与命令注册超时', {
          pluginId,
          timeoutMs: LIFECYCLE_APPLY_TIMEOUT_MS,
        })
      );
    }, LIFECYCLE_APPLY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([action(), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/** 构造结果信封。 */
function buildEnvelope(
  command: ICliCommandView,
  extra: {
    readonly output?: unknown;
    readonly task?: { readonly taskId: string; readonly status: string };
    readonly artifacts?: readonly string[];
    readonly skipped?: boolean;
    readonly launched?: boolean;
  }
): IResultEnvelope {
  const envelope: {
    ok: true;
    entryId: string;
    commandPath: string;
    commandId?: string;
    target: { type: 'app' | 'service'; pluginId: string };
    output?: unknown;
    task?: { taskId: string; status: string };
    artifacts?: readonly string[];
    skipped?: boolean;
    launched?: boolean;
  } = {
    ok: true,
    entryId: command.entryId,
    commandPath: commandPathKey(command.commandPath),
    target: { type: command.declaration.target.type, pluginId: command.pluginId },
  };
  const commandId = command.commandId ?? command.declaration.commandId;
  if (commandId !== undefined && command.declaration.target.type === 'app') {
    // `commandId` 仅在 app 目标下进入信封（§2.4.4）。
    envelope.commandId = commandId;
  }
  if (extra.output !== undefined) {
    envelope.output = extra.output;
  }
  if (extra.task !== undefined) {
    envelope.task = extra.task;
  }
  if (extra.artifacts !== undefined) {
    envelope.artifacts = extra.artifacts;
  }
  if (extra.skipped === true) {
    envelope.skipped = true;
  }
  if (extra.launched === true) {
    envelope.launched = true;
  }
  return envelope;
}

/** 按 `output.artifacts` 点分路径提取产物；数组值展开为多行（§5.4）。 */
function attachArtifacts(
  envelope: IResultEnvelope,
  declaration: ICliCommandDeclaration,
  output: unknown
): IResultEnvelope {
  const paths = declaration.output?.artifacts;
  if (paths === undefined || paths.length === 0 || output === undefined) {
    return envelope;
  }
  const artifacts = paths
    .flatMap((path) => readDottedPath(output, path))
    .filter((item): item is string => typeof item === 'string');
  if (artifacts.length === 0) {
    return envelope;
  }
  return { ...envelope, artifacts };
}

/** 读取点分路径；数组自动展开（§5.4.1）。 */
export function readDottedPath(root: unknown, path: string): unknown[] {
  let current: unknown[] = [root];
  for (const segment of path.split('.')) {
    const next: unknown[] = [];
    for (const item of current) {
      if (Array.isArray(item)) {
        for (const element of item) {
          next.push(...readSegment(element, segment));
        }
        continue;
      }
      next.push(...readSegment(item, segment));
    }
    current = next;
  }
  return current;
}

function readSegment(value: unknown, segment: string): readonly unknown[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const record = value as Record<string, unknown>;
  if (!(segment in record)) {
    return [];
  }
  const found = record[segment];
  return Array.isArray(found) ? [...(found as readonly unknown[])] : [found];
}

/**
 * human 六段式摘要（[CLI 完整参考] §2.4.5、§5.9）：
 * `完成 / 命令 / 目标 / 任务 / 产物 / 输出`，只展示声明 `output.artifacts` 命中的路径与
 * 通用 `output` 摘要，不猜测插件私有字段；已按 `artifacts` 展示产物时不再重复输出段。
 */
export function renderHuman(envelope: IResultEnvelope): readonly string[] {
  const lines: string[] = ['完成'];
  lines.push(`命令: ${envelope.commandPath}`);
  if (envelope.target.type === 'service') {
    lines.push(`目标: service ${envelope.target.pluginId}`);
  } else {
    lines.push(
      `目标: app ${envelope.target.pluginId}${envelope.commandId === undefined ? '' : ` ${envelope.commandId}`}`
    );
  }
  if (envelope.task !== undefined) {
    lines.push(`任务: ${envelope.task.status}`);
  }
  if (envelope.artifacts !== undefined && envelope.artifacts.length > 0) {
    lines.push('产物:');
    for (const artifact of envelope.artifacts) {
      lines.push(`- ${artifact}`);
    }
  } else if (envelope.skipped === true) {
    lines.push('结果: 已跳过（输出冲突策略 skip，未调用目标）');
  } else if (envelope.launched === true) {
    lines.push('结果: 已启动目标实例');
  } else if (envelope.output !== undefined) {
    lines.push('输出:');
    lines.push(JSON.stringify(envelope.output));
  }
  return lines;
}
