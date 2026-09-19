/**
 * 命令定义与执行上下文：固定命令树与插件命令调度共用的形状。
 */

import type { IFileSystemPort } from '../args/filesystem.js';
import type { CliEntryKind, IGlobalOptions } from '../args/global-options.js';
import type { IParameterSet } from '../args/types.js';
import type { ICliClient } from '../client/types.js';
import type { IOperationLogger } from '../logging/operations.js';
import type { IOutputSink } from '../output/io.js';
import type { ICommandResult } from '../output/result.js';

/** 工作区访问器。 */
export interface IWorkspaceAccessor {
  readonly kind: CliEntryKind;
  /** 解析工作区路径：`--workspace`（仅 dev）→ `CHIPS_WORKSPACE`（dev）→ 平台缺省值。 */
  resolve(): Promise<{ readonly path: string; readonly kind: CliEntryKind }>;
}

/** 命令执行上下文：一次 CLI 调用的全部环境与依赖。 */
export interface ICommandContext {
  readonly entry: CliEntryKind;
  readonly globals: IGlobalOptions;
  readonly io: IOutputSink;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly fileSystem: IFileSystemPort;
  readonly client: ICliClient;
  readonly signal: AbortSignal;
  /** 平台版本（懒解析、best-effort）：承载环境不可用时返回 undefined。 */
  readonly resolvePlatformVersion: () => Promise<string | undefined>;
  /** 工作区访问器：仅命令真正需要时解析（本地命令不触发承载链路，§2.2）。 */
  readonly workspace: IWorkspaceAccessor;
  readonly logger: IOperationLogger;
  readonly now: () => number;
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** 已解析的命令路径（空格连接，用于日志与帮助）。 */
  readonly commandPath: string;
  /** 命令路径之后的位置与选项 token。 */
  readonly args: readonly string[];
  /** 原始 argv（未剥离全局选项，用于操作日志脱敏）。 */
  readonly argv: readonly string[];
}

/** 固定命令定义。 */
export interface ICliCommandDefinition {
  /** 命令路径段，如 `['plugin', 'create']`。 */
  readonly path: readonly string[];
  /** 一句话说明（简体中文）。 */
  readonly summary: string;
  /** 用法行（简体中文 + 命令语法）。 */
  readonly usage: string;
  /** 内建命令缺省输出形态；缺省 `json`。 */
  readonly outputMode?: 'json' | 'human';
  /** 参数声明；`help` 与解析共用。 */
  readonly parameters?: IParameterSet;
  /** 子命令提示（帮助展示）。 */
  readonly subcommands?: readonly string[];
  readonly run: (context: ICommandContext) => Promise<ICommandResult>;
}
