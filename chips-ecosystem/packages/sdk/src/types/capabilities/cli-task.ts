/**
 * CLI 任务能力契约类型（04-能力契约规范 §7.17；任务记录与状态权威见 07-CLI完整参考 §5.6、§5.7）。
 *
 * 口径：
 * - 插件访问面只有本节 5 项能力（任务创建、绑定与取消属 CLI / 平台服务路由，插件不得
 *   直接调用内核路由，04 §7.17 约束）；
 * - 五项能力声明空权限数组：任务按 owner 归属校验，插件不能读写他人任务；
 * - `ICapabilityContracts` 中 CLI 任务五行（`cli:task-active` 至 `cli:task-fail`）的
 *   契约类型即本文件类型（04 §2.3）。
 */

/** CLI 任务状态；终态不可逆（07-CLI完整参考 §5.6、§5.7）。 */
export type CliTaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * CLI 任务记录（07-CLI完整参考 §5.6）。
 *
 * `progress` 为任意 JSON 对象，约定 `percent`（0–100）与 `stage`（字符串）参与 CLI 进度展示；
 * `error` 归一为 `{ code, message, details?, retryable? }`，无 `code` 时按 `CLI_TASK_FAILED` 收口。
 */
export interface CliTaskRecord {
  taskId: string;
  pluginId: string;
  commandId: string;
  commandPath?: string[];
  status: CliTaskStatus;
  createdAt: number;
  updatedAt: number;
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: { code: string; message: string; details?: unknown; retryable?: boolean };
}

/** `cli:task-active` 输入（04 §7.17）。 */
export interface ICliTaskActiveInput {
  readonly commandId: string;
}

/** `cli:task-active` 输出：调用插件当前 `running` 任务；无任务返回 `undefined`。 */
export interface ICliTaskActiveOutput {
  readonly task?: CliTaskRecord;
}

/** `cli:task-get` 输入（04 §7.17）。 */
export interface ICliTaskGetInput {
  readonly taskId: string;
}

/** `cli:task-get` 输出：读取任务；长任务据此检查取消终态。 */
export interface ICliTaskGetOutput {
  readonly task: CliTaskRecord;
}

/** `cli:task-progress` 输入（04 §7.17）。 */
export interface ICliTaskProgressInput {
  readonly taskId: string;
  readonly progress: Readonly<Record<string, unknown>>;
}

/** `cli:task-progress` 输出：上报后的任务记录。 */
export interface ICliTaskProgressOutput {
  readonly task: CliTaskRecord;
}

/** `cli:task-complete` 输入（04 §7.17）。 */
export interface ICliTaskCompleteInput {
  readonly taskId: string;
  readonly output?: unknown;
}

/** `cli:task-complete` 输出：上报完成终态。 */
export interface ICliTaskCompleteOutput {
  readonly task: CliTaskRecord;
}

/** `cli:task-fail` 输入（04 §7.17）。 */
export interface ICliTaskFailInput {
  readonly taskId: string;
  readonly error: unknown;
}

/** `cli:task-fail` 输出：上报失败终态。 */
export interface ICliTaskFailOutput {
  readonly task: CliTaskRecord;
}
