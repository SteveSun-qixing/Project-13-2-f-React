/**
 * `cli-task` 唯一存储（《07-CLI完整参考》§5.6 任务模型；《17》§5.1 路由面承诺）。
 *
 * 权威：§5.6（记录形状、终态不可逆、归属校验、`fail` 错误归一）、§5.8（不得新增第二套
 * 任务存储）、《17》§5.4（任务存储为宿主内存面、无持久化承诺，重启后 `cli.task.get`
 * 如实 `CLI_TASK_NOT_FOUND`）。
 *
 * @remarks
 * 本模块是全生态**唯一**的 `cli-task` 存储实现（服务端面）；插件能力面
 * （`cli:task-*`）接线时同样消费本存储，禁止第二份表（§5.8 末行红线）。
 */

import { randomUUID } from 'node:crypto';

import { CARRIER_SERVICE_ERROR_CODES, carrierServiceError, type CliTaskStatus, type ICliTaskRecord } from './types.js';
import type { IWireChipsError } from '../protocol/wire.js';

/** 终态集合（§5.6：终态不可逆；越界跃迁 `CLI_TASK_INVALID`）。 */
const TERMINAL_STATUSES: ReadonlySet<CliTaskStatus> = new Set<CliTaskStatus>(['completed', 'failed', 'cancelled']);

/** 创建入参（§5.8 `cli.task.create` 输入）。 */
export interface ICliTaskCreateInput {
  readonly pluginId: string;
  readonly commandId: string;
  readonly commandPath?: readonly string[];
}

/** 读取选择器（§5.8：`{ taskId }` 或 `{ commandId, activeOnly: true }`）。 */
export interface ICliTaskGetSelector {
  readonly taskId?: string;
  readonly commandId?: string;
  readonly activeOnly?: boolean;
}

/** 任务存储端口。 */
export interface ICliTaskStore {
  /** 创建 `running` 任务；同一 `(pluginId, commandId)` 已有 `running` 任务时拒绝（串行调度承诺）。 */
  create(input: ICliTaskCreateInput): ICliTaskRecord;
  /** 绑定调用/会话（§5.6；绑定信息只随记录回显）。 */
  bindInvocation(input: { taskId: string; invocationId?: string; sessionId?: string }): ICliTaskRecord;
  /** 按选择器读取；不存在 `CLI_TASK_NOT_FOUND`。 */
  get(selector: ICliTaskGetSelector): ICliTaskRecord;
  /** 更新进度（任意 JSON 对象；终态后拒绝）。 */
  progress(taskId: string, progress: Readonly<Record<string, unknown>>): ICliTaskRecord;
  /** 完成终态。 */
  complete(taskId: string, output?: unknown): ICliTaskRecord;
  /** 失败终态；`error` 归一为 `{ code, message, details?, retryable? }`，无 `code` 按 `CLI_TASK_FAILED` 收口。 */
  fail(taskId: string, error: unknown): ICliTaskRecord;
  /** 取消终态（CLI 侧发起，§5.6 调用方约定）。 */
  cancel(taskId: string): ICliTaskRecord;
  /** 记录数量（诊断面）。 */
  readonly size: number;
}

/** 存储内部记录（绑定信息不回显进 §5.6 形状之外的字段）。 */
interface IStoredTask extends ICliTaskRecord {
  readonly invocationId?: string;
  readonly boundSessionId?: string;
}

/** 创建内存任务存储（时钟与 ID 生成注入化，测试可锁定）。 */
export function createCliTaskStore(
  deps: { readonly now: () => number; readonly newTaskId?: () => string } = { now: Date.now },
): ICliTaskStore {
  const tasks = new Map<string, IStoredTask>();
  const newTaskId = deps.newTaskId ?? ((): string => randomUUID());

  const mustFind = (taskId: string): IStoredTask => {
    const task = tasks.get(taskId);
    if (task === undefined) {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskNotFound, { taskId });
    }
    return task;
  };

  const mutate = (task: IStoredTask, changes: Partial<IStoredTask>): IStoredTask => {
    const next: IStoredTask = { ...task, ...changes, updatedAt: deps.now() };
    tasks.set(next.taskId, next);
    return next;
  };

  const rejectTerminal = (task: IStoredTask, action: string): void => {
    if (TERMINAL_STATUSES.has(task.status)) {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, {
        taskId: task.taskId,
        status: task.status,
        action,
      });
    }
  };

  const normalizeError = (
    error: unknown,
  ): { code: string; message: string; details?: unknown; retryable?: boolean } => {
    const fallback = {
      code: CARRIER_SERVICE_ERROR_CODES.taskFailed,
      message: '任务执行失败',
      retryable: false,
    };
    if (typeof error !== 'object' || error === null) {
      // 裸字符串错误：如实保留为 `message`（§2.5 码表只约束 code，不改写文案）。
      if (typeof error === 'string' && error.length > 0) {
        return { ...fallback, message: error };
      }
      return { ...fallback, details: { cause: String(error) } };
    }
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      retryable?: unknown;
    };
    if (typeof candidate.code !== 'string' || candidate.code.length === 0) {
      return {
        ...fallback,
        ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
        ...(candidate.details === undefined ? {} : { details: candidate.details }),
      };
    }
    return {
      code: candidate.code,
      message: typeof candidate.message === 'string' ? candidate.message : '任务执行失败',
      ...(candidate.details === undefined ? {} : { details: candidate.details }),
      retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : false,
    };
  };

  return {
    create(input: ICliTaskCreateInput): ICliTaskRecord {
      if (typeof input?.pluginId !== 'string' || input.pluginId.length === 0) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'pluginId' });
      }
      if (typeof input.commandId !== 'string' || input.commandId.length === 0) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'commandId' });
      }
      const existing = [...tasks.values()].find(
        (task) => task.pluginId === input.pluginId && task.commandId === input.commandId && task.status === 'running',
      );
      if (existing !== undefined) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, {
          rule: '07 §5.6 同一 (pluginId, commandId) 同时最多一个 running 任务',
          runningTaskId: existing.taskId,
        });
      }
      const created = deps.now();
      const record: IStoredTask = {
        taskId: newTaskId(),
        pluginId: input.pluginId,
        commandId: input.commandId,
        ...(input.commandPath === undefined ? {} : { commandPath: [...input.commandPath] }),
        status: 'running',
        createdAt: created,
        updatedAt: created,
      };
      tasks.set(record.taskId, record);
      return record;
    },

    bindInvocation(input: { taskId: string; invocationId?: string; sessionId?: string }): ICliTaskRecord {
      const task = mustFind(input.taskId);
      return mutate(task, {
        ...(typeof input.invocationId === 'string' ? { invocationId: input.invocationId } : {}),
        ...(typeof input.sessionId === 'string' ? { boundSessionId: input.sessionId } : {}),
      });
    },

    get(selector: ICliTaskGetSelector): ICliTaskRecord {
      if (typeof selector?.taskId === 'string') {
        return mustFind(selector.taskId);
      }
      if (typeof selector.commandId === 'string' && selector.activeOnly === true) {
        const running = [...tasks.values()].find(
          (task) => task.commandId === selector.commandId && task.status === 'running',
        );
        if (running === undefined) {
          throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskNotFound, {
            commandId: selector.commandId,
            activeOnly: true,
          });
        }
        return running;
      }
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, {
        rule: '07 §5.8 cli.task.get 选择器：{ taskId } 或 { commandId, activeOnly: true }',
      });
    },

    progress(taskId: string, progress: Readonly<Record<string, unknown>>): ICliTaskRecord {
      const task = mustFind(taskId);
      rejectTerminal(task, 'progress');
      if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) {
        throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'progress' });
      }
      return mutate(task, { progress: { ...progress } });
    },

    complete(taskId: string, output?: unknown): ICliTaskRecord {
      const task = mustFind(taskId);
      rejectTerminal(task, 'complete');
      return mutate(task, { status: 'completed', ...(output === undefined ? {} : { output }) });
    },

    fail(taskId: string, error: unknown): ICliTaskRecord {
      const task = mustFind(taskId);
      rejectTerminal(task, 'fail');
      return mutate(task, { status: 'failed', error: normalizeError(error) });
    },

    cancel(taskId: string): ICliTaskRecord {
      const task = mustFind(taskId);
      rejectTerminal(task, 'cancel');
      return mutate(task, { status: 'cancelled' });
    },

    get size(): number {
      return tasks.size;
    },
  };
}

/** 供路由面透传 handler 级域码错误（归一为封套 `IWireChipsError`）。 */
export function asTaskWireError(error: unknown): IWireChipsError {
  const candidate = error as Partial<IWireChipsError> | null | undefined;
  if (typeof candidate?.code === 'string' && typeof candidate.message === 'string') {
    return {
      code: candidate.code,
      message: candidate.message,
      ...(candidate.details === undefined ? {} : { details: candidate.details }),
      retryable: candidate.retryable === true,
    };
  }
  return carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid);
}
