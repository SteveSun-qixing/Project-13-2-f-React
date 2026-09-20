/**
 * `ChipsBridge.cliTask` 只读扩展命名空间（02-SDK-API规范 §3.5；07-CLI完整参考 §5.6、§5.7、§5.8）。
 *
 * 传输裁决（见 RFC-SDK主入口CLI面收口 5.3）：
 * - `active` / `get` / `progress` / `complete` / `fail` 走 §5.6 登记的 Bridge 能力
 *   `cli:task-active` 至 `cli:task-fail`，能力 ID 取 `src/generated/capability-ids.ts` 的
 *   生成常量，输入输出取 04-能力契约规范 §7.17 已登记的契约接口，SDK 不重复定义形状；
 * - `create` / `bindInvocation` / `cancel` 无能力登记，只走 §5.8 的平台服务路由
 *   `cli.task.create` / `cli.task.bindInvocation` / `cli.task.cancel`，仅对注入服务传输的
 *   客户端（`@chips/cli` 与平台组件）可用；
 * - 生命周期判定（终态不可逆、越界上报 `CLI_TASK_INVALID`、owner 归属校验）全部在平台侧，
 *   SDK 只解 `{ task }` / `{ task? }` 信封并原样透传错误（§11 约束 12、§6.4）。
 */

import { Capability } from '../generated/capability-ids.js';
import type {
  ICliTaskActiveInput,
  ICliTaskActiveOutput,
  ICliTaskCompleteInput,
  ICliTaskCompleteOutput,
  ICliTaskFailInput,
  ICliTaskFailOutput,
  ICliTaskGetInput,
  ICliTaskGetOutput,
  ICliTaskProgressInput,
  ICliTaskProgressOutput,
  CliTaskRecord,
} from '../types/capabilities/cli-task.js';
import type { CliTaskApi } from '../types/cli/task.js';
import { invokeTarget, type TargetResolver } from './target-invocation.js';

/** 服务路由名：任务创建（07-CLI完整参考 §5.8 路由表）。 */
export const CLI_TASK_CREATE_ROUTE = 'cli.task.create';

/** 服务路由名：任务与调用绑定（07-CLI完整参考 §5.8 路由表）。 */
export const CLI_TASK_BIND_INVOCATION_ROUTE = 'cli.task.bindInvocation';

/** 服务路由名：取消请求（07-CLI完整参考 §5.8 路由表，插件不调用）。 */
export const CLI_TASK_CANCEL_ROUTE = 'cli.task.cancel';

/** `cli.task.*` 路由的输出信封，与 §7.17 `cli:task-get` 的 `{ task }` 同形。 */
type TaskRouteOutput = Pick<ICliTaskGetOutput, 'task'>;

/**
 * 构造 CLI 任务生命周期命名空间。
 *
 * @param resolveTarget - 目标 Bridge 解析函数，由 `ChipsBridge` 注入
 * @returns 只读的 `cliTask` 命名空间实现
 */
export function createCliTaskApi(resolveTarget: TargetResolver): CliTaskApi {
  return {
    create(input): Promise<CliTaskRecord> {
      return invokeTarget<TaskRouteOutput>(
        resolveTarget,
        CLI_TASK_CREATE_ROUTE,
        input
      ).then((output) => output.task);
    },
    bindInvocation(input): Promise<CliTaskRecord> {
      return invokeTarget<TaskRouteOutput>(
        resolveTarget,
        CLI_TASK_BIND_INVOCATION_ROUTE,
        input
      ).then((output) => output.task);
    },
    get(taskId): Promise<CliTaskRecord> {
      const payload: ICliTaskGetInput = { taskId };
      return invokeTarget<ICliTaskGetOutput>(resolveTarget, Capability.CLI_TASK_GET, payload).then(
        (output) => output.task
      );
    },
    active(commandId): Promise<CliTaskRecord | undefined> {
      // §5.6：无任务（例如命令未声明 `job.wait`）即 `task` 缺省，返回 undefined，不补占位记录。
      const payload: ICliTaskActiveInput = { commandId };
      return invokeTarget<ICliTaskActiveOutput>(
        resolveTarget,
        Capability.CLI_TASK_ACTIVE,
        payload
      ).then((output) => output.task);
    },
    progress(taskId, progress): Promise<CliTaskRecord> {
      const payload: ICliTaskProgressInput = { taskId, progress };
      return invokeTarget<ICliTaskProgressOutput>(
        resolveTarget,
        Capability.CLI_TASK_PROGRESS,
        payload
      ).then((output) => output.task);
    },
    complete(taskId, output): Promise<CliTaskRecord> {
      const payload: ICliTaskCompleteInput = {
        taskId,
        ...(output === undefined ? {} : { output }),
      };
      return invokeTarget<ICliTaskCompleteOutput>(
        resolveTarget,
        Capability.CLI_TASK_COMPLETE,
        payload
      ).then((record) => record.task);
    },
    fail(taskId, error): Promise<CliTaskRecord> {
      const payload: ICliTaskFailInput = { taskId, error };
      return invokeTarget<ICliTaskFailOutput>(
        resolveTarget,
        Capability.CLI_TASK_FAIL,
        payload
      ).then((record) => record.task);
    },
    cancel(taskId): Promise<CliTaskRecord> {
      return invokeTarget<TaskRouteOutput>(resolveTarget, CLI_TASK_CANCEL_ROUTE, { taskId }).then(
        (output) => output.task
      );
    },
  };
}
