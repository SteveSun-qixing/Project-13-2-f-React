/**
 * `cliTask` 命名空间形状（02-SDK-API规范 §3.5；07-CLI完整参考 §5.6、§5.7、§5.8）。
 *
 * 口径：
 * - 任务记录与状态复用 `../capabilities/cli-task.ts` 的 `CliTaskRecord` / `CliTaskStatus`
 *   （04-能力契约规范 §7.17 登记的同一形状），本文件不重复定义（§11 约束 5、约束 12）；
 * - 传输裁决（§3.5 两行表格的落法，见 RFC-SDK主入口CLI面收口 5.3）：
 *   `active` / `get` / `progress` / `complete` / `fail` 走 §5.6 登记的 Bridge 能力
 *   `cli:task-active` 至 `cli:task-fail`（插件可达、空权限、owner 归属校验）；
 *   `create` / `bindInvocation` / `cancel` 无能力登记，只走 §5.8 的平台服务路由
 *   `cli.task.*`（`@chips/cli` 与平台组件注入传输后可用，插件不得直接调用内核路由）；
 * - 生命周期规则（终态不可逆、取消、退出前必须上报终态）以 §5.7 为权威，由平台判定，
 *   SDK 只转发并解包 `{ task }` / `{ task? }` 信封。
 */

import type { CliTaskRecord } from '../capabilities/cli-task.js';

/**
 * `ChipsBridge.cliTask` 命名空间形状（07-CLI完整参考 §5.6）。
 */
export interface CliTaskApi {
  /**
   * 创建任务（CLI 调度链路专用，服务路由 `cli.task.create`）。
   *
   * @param input - owner 插件 ID、运行时命令 ID 与可选命令路径
   * @returns 新建的 `running` 任务记录
   */
  create(input: {
    readonly pluginId: string;
    readonly commandId: string;
    readonly commandPath?: readonly string[];
  }): Promise<CliTaskRecord>;

  /**
   * 把任务与一次调用绑定（CLI 调度链路专用，服务路由 `cli.task.bindInvocation`）。
   *
   * @param input - 任务 ID 与可选的调用 ID、会话 ID
   * @returns 绑定后的任务记录
   */
  bindInvocation(input: {
    readonly taskId: string;
    readonly invocationId?: string;
    readonly sessionId?: string;
  }): Promise<CliTaskRecord>;

  /**
   * 读取任务（能力 `cli:task-get`；owner 归属校验，长任务据此检查取消终态）。
   *
   * @param taskId - 任务 ID
   * @returns 任务记录
   */
  get(taskId: string): Promise<CliTaskRecord>;

  /**
   * 取调用插件当前 `running` 任务（能力 `cli:task-active`）。
   *
   * @param commandId - 运行时命令 ID
   * @returns 当前运行中的任务；命令未声明 `job.wait` 等无任务情形返回 `undefined`
   */
  active(commandId: string): Promise<CliTaskRecord | undefined>;

  /**
   * 上报进度（能力 `cli:task-progress`；`percent` 与 `stage` 参与 CLI 进度展示）。
   *
   * @param taskId - 任务 ID
   * @param progress - 任意 JSON 对象
   * @returns 上报后的任务记录
   */
  progress(taskId: string, progress: Readonly<Record<string, unknown>>): Promise<CliTaskRecord>;

  /**
   * 上报完成终态（能力 `cli:task-complete`；终态不可逆）。
   *
   * @param taskId - 任务 ID
   * @param output - 作为结果信封 `output` 输出的产物
   * @returns 终态任务记录
   */
  complete(taskId: string, output?: unknown): Promise<CliTaskRecord>;

  /**
   * 上报失败终态（能力 `cli:task-fail`）。
   *
   * @param taskId - 任务 ID
   * @param error - 应用错误对象，平台归一为 `{ code, message, details?, retryable? }`，
   *   无 `code` 时按 `CLI_TASK_FAILED` 收口
   * @returns 终态任务记录
   */
  fail(taskId: string, error: unknown): Promise<CliTaskRecord>;

  /**
   * 请求取消任务（CLI 侧方法，插件不调用；服务路由 `cli.task.cancel`）。
   *
   * @param taskId - 任务 ID
   * @returns 取消后的任务记录
   */
  cancel(taskId: string): Promise<CliTaskRecord>;
}
