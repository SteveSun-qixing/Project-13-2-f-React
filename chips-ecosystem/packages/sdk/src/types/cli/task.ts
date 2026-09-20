/**
 * CLI 任务生命周期接口面（07-CLI完整参考 §5.6 任务接口；02-SDK-API规范 §3.5）。
 *
 * 口径：
 * - `CliTaskApi` 是 `ChipsBridge.cliTask` 只读扩展命名空间的形状，八个方法的名称、参数与
 *   返回类型逐字对齐 §5.6:79-88，本文件不定义第二套语义（§11 约束 12）；
 * - 任务记录与状态复用 `../capabilities/cli-task.js` 的既有定义（04-能力契约规范 §7.17 与
 *   §5.6 能力表登记的同一形状），不在此重复定义（§11 约束 5）；
 * - 运行位置与传输按 §3.5 表分侧：`active` / `get` / `progress` / `complete` / `fail` 面向
 *   插件运行时，经 `cli:task-active` 至 `cli:task-fail` 能力转发；`create` / `bindInvocation`
 *   / `cancel` 面向 `@chips/cli` 与平台组件，经 §5.8 的 `cli.task.*` 服务路由转发；
 *   `get` 两侧同名，取能力面（唯一有契约登记的读取面，裁决见 RFC-SDK主入口CLI面收口 5.3）；
 * - 调用方约定（§5.6）：`active` 无任务返回 `undefined`；`fail` 的 `error` 由平台归一为
 *   `{ code, message, details?, retryable? }`，无 `code` 时按 `CLI_TASK_FAILED` 收口；
 *   任务只允许所属插件读写（owner 归属校验），终态不可逆，越界上报返回 `CLI_TASK_INVALID`；
 *   `cancel` 是 CLI 侧方法，插件不调用，应用经 `get` 观察到 `cancelled` 后自行停止。
 * - 生命周期判定与错误产生全部在平台侧，SDK 实现只做类型化转发（`src/client/cli-task-api.ts`）。
 */

import type { CliTaskRecord } from '../capabilities/cli-task.js';

/**
 * `ChipsBridge.cliTask` 命名空间形状（§3.5、§5.6 任务接口）。
 *
 * 八个方法逐字对齐 §5.6:79-88；`create` / `bindInvocation` 的入参按 §5.6 以行内对象类型
 * 表达，不新增命名类型（RFC-SDK主入口CLI面收口 5.1）。
 */
export interface CliTaskApi {
  /**
   * 创建 CLI 任务（CLI 调度链路专用，走 `cli.task.create` 服务路由，§5.6、§5.8）。
   *
   * @param input - 归属插件 ID、运行时命令 ID 与可选命令路径
   * @returns 新建的 `running` 任务记录
   */
  create(input: {
    readonly pluginId: string;
    readonly commandId: string;
    readonly commandPath?: readonly string[];
  }): Promise<CliTaskRecord>;

  /**
   * 绑定任务与调用/会话（CLI 调度链路专用，走 `cli.task.bindInvocation` 服务路由，§5.6、§5.8）。
   *
   * @param input - 任务 ID 与可选调用 ID、会话 ID
   * @returns 绑定后的任务记录
   */
  bindInvocation(input: {
    readonly taskId: string;
    readonly invocationId?: string;
    readonly sessionId?: string;
  }): Promise<CliTaskRecord>;

  /**
   * 读取任务（owner 归属；长任务据此周期性检查取消终态，§5.6 调用方约定）。
   *
   * @param taskId - 任务 ID
   * @returns 任务记录
   */
  get(taskId: string): Promise<CliTaskRecord>;

  /**
   * 取得调用插件当前 `running` 任务（§5.6：同一 `(pluginId, commandId)` 同时最多一个）。
   *
   * @param commandId - 运行时命令 ID
   * @returns 当前任务记录；无任务（例如 `job.wait: false`）返回 `undefined`
   */
  active(commandId: string): Promise<CliTaskRecord | undefined>;

  /**
   * 上报进度（owner 归属；`percent` 0–100 与 `stage` 字符串参与 CLI 进度展示，§5.6、§3.10）。
   *
   * @param taskId - 任务 ID
   * @param progress - 任意 JSON 对象
   * @returns 上报后的任务记录
   */
  progress(taskId: string, progress: Readonly<Record<string, unknown>>): Promise<CliTaskRecord>;

  /**
   * 上报完成终态（owner 归属；终态不可逆，§5.6）。
   *
   * @param taskId - 任务 ID
   * @param output - 可选产物信息
   * @returns 进入终态后的任务记录
   */
  complete(taskId: string, output?: unknown): Promise<CliTaskRecord>;

  /**
   * 上报失败终态（owner 归属；`error` 由平台归一，无 `code` 时按 `CLI_TASK_FAILED` 收口，§5.6）。
   *
   * @param taskId - 任务 ID
   * @param error - 失败原因
   * @returns 进入终态后的任务记录
   */
  fail(taskId: string, error: unknown): Promise<CliTaskRecord>;

  /**
   * 发起取消请求（CLI 侧方法，插件不调用，§5.6 调用方约定；走 `cli.task.cancel` 服务路由）。
   *
   * @param taskId - 任务 ID
   * @returns 任务记录（已取消或仍 `running` 等待应用观察）
   */
  cancel(taskId: string): Promise<CliTaskRecord>;
}
