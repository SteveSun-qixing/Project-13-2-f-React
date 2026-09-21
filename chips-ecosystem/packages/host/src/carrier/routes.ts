/**
 * 承载链路独立服务路由表（《17-CLI承载链路契约》§5.1；§4.4-4 独立表条款）。
 *
 * 权威：§5.1 在册 `routeId` 集合（逐字冻结、不得扩充、不得别名）与错误收口；
 * 负载字段形状权威在《07-CLI完整参考》§5.6/§5.8（本模块只做派发与归一，不重定义语义）。
 *
 * @remarks
 * - 本表是宿主侧**独立服务路由表**，与 Bridge 能力注册表在两处（文档与代码）都不存在
 *   包含关系；`cli.*` 永不进能力注册表（§4.4-4 禁令、§6.1-2 不变量）。
 * - 三门判定链（§4.4-1）在承载面的落位：门一「会话登记校验」由承载服务端在派发前完成
 *   （握手登记、连接关闭即会话关闭）；门二「路由存在性」即本表查找（非在册 →
 *   `route_unregistered` 防御面）；门三「运行时权限判定」按路由语义执行——发现/任务面
 *   是平台只读与 owner 语义（§5.6/§5.8），`command:invoke` 复用既有能力路由判定链。
 * - handler 级业务错误以既有域码在封套 `error` 内如实返回（§5.1），不进 §5.3 reason 词表。
 */

import { BRIDGE_ERROR_CODES, bridgeWireError } from '../protocol/error-codes.js';
import type { IWireChipsError } from '../protocol/wire.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import type { ICarrierCommandIndex } from './command-index.js';
import type { ICliTaskCreateInput, ICliTaskStore } from './task-store.js';
import type { ICarrierCallContext, CarrierRequest, CarrierResponse, ICommandInvokeInput } from './types.js';
import { CARRIER_ROUTE_IDS, CARRIER_SERVICE_ERROR_CODES, carrierReasonError, carrierServiceError } from './types.js';

/** `command:invoke` 派发端口（内核命令系统装配后由组合根接管；缺位即未就绪臂）。 */
export type CommandInvokePort = (input: ICommandInvokeInput, context: ICarrierCallContext) => Promise<unknown>;

/** 路由表端口。 */
export interface ICarrierRouteTable {
  /** 派发一次封套请求；始终返回结构化响应，不抛出。 */
  dispatch(request: CarrierRequest, context: ICarrierCallContext): Promise<CarrierResponse>;
}

/** 路由表依赖。 */
export interface ICarrierRouteTableDeps {
  readonly index: ICarrierCommandIndex;
  readonly tasks: ICliTaskStore;
  /** `command:invoke` 端口；缺省即命令系统内核未装配臂（如实拒绝，R3/工单039 在册）。 */
  readonly invokeCommand?: CommandInvokePort;
  readonly diagnostics: DiagnosticsSink;
}

/** 单路由 handler（同步或异步返回值统一为 `unknown`，派发层不解释语义）。 */
type RouteHandler = (input: unknown, context: ICarrierCallContext) => unknown;

function requireObject(input: unknown, invalidCode: string): Record<string, unknown> {
  if (input === undefined) {
    return {};
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw carrierServiceError(invalidCode, { field: 'input' });
  }
  return input as Record<string, unknown>;
}

function requireLocatable(query: Record<string, unknown>): void {
  if (typeof query['entryId'] !== 'string' && query['commandPath'] === undefined) {
    throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
      rule: '07 §5.8 get/resolve 必须以 entryId 或 commandPath 定位',
    });
  }
}

/** 创建独立服务路由表。 */
export function createCarrierRouteTable(deps: ICarrierRouteTableDeps): ICarrierRouteTable {
  const handlers = new Map<string, RouteHandler>();

  handlers.set('cli.command.list', (input) =>
    deps.index.list(
      input === undefined ? undefined : requireObject(input, CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid),
    ),
  );
  handlers.set('cli.command.get', (input) => {
    const query = requireObject(input, CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid);
    requireLocatable(query);
    return deps.index.get(query);
  });
  handlers.set('cli.command.resolve', (input) => {
    const query = requireObject(input, CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid);
    requireLocatable(query);
    return deps.index.resolve(query);
  });

  handlers.set('cli.task.create', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    return { task: deps.tasks.create(source as unknown as ICliTaskCreateInput) };
  });
  handlers.set('cli.task.bindInvocation', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    if (typeof source['taskId'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'taskId' });
    }
    return {
      task: deps.tasks.bindInvocation(source as Parameters<ICliTaskStore['bindInvocation']>[0]),
    };
  });
  handlers.set('cli.task.get', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    return { task: deps.tasks.get(source) };
  });
  handlers.set('cli.task.progress', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    if (typeof source['taskId'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'taskId' });
    }
    return {
      task: deps.tasks.progress(source['taskId'], (source['progress'] ?? {}) as Readonly<Record<string, unknown>>),
    };
  });
  handlers.set('cli.task.complete', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    if (typeof source['taskId'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'taskId' });
    }
    return { task: deps.tasks.complete(source['taskId'], source['output']) };
  });
  handlers.set('cli.task.fail', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    if (typeof source['taskId'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'taskId' });
    }
    return { task: deps.tasks.fail(source['taskId'], source['error']) };
  });
  handlers.set('cli.task.cancel', (input) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.taskInvalid);
    if (typeof source['taskId'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.taskInvalid, { field: 'taskId' });
    }
    return { task: deps.tasks.cancel(source['taskId']) };
  });

  handlers.set('command:invoke', async (input, context) => {
    const source = requireObject(input, CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid);
    if (typeof source['commandId'] !== 'string' || typeof source['source'] !== 'string') {
      throw carrierServiceError(CARRIER_SERVICE_ERROR_CODES.commandQueryInvalid, {
        rule: '13 §3.2 command:invoke 输入：commandId 与 source 必填',
      });
    }
    if (deps.invokeCommand === undefined) {
      // R3 在册（《17》§5.6）：app 臂「启动并投递」依赖 `handleStartupInputs` 正式投递
      // 装配；命令系统内核未装配前该路由如实拒绝，禁止临时投递凑绿（工单039 继续挂账）。
      throw carrierServiceError(
        BRIDGE_ERROR_CODES.internal,
        undefined,
        '命令系统内核未装配，command:invoke 臂未就绪（R3，工单039 在册）',
      );
    }
    return await deps.invokeCommand(source as unknown as ICommandInvokeInput, context);
  });

  const dispatch = async (request: CarrierRequest, context: ICarrierCallContext): Promise<CarrierResponse> => {
    const handler = handlers.get(request.capabilityId);
    if (handler === undefined || !(CARRIER_ROUTE_IDS as readonly string[]).includes(request.capabilityId)) {
      // 防御面：正常客户端不可能发出非在册 routeId（§5.1）。
      return {
        requestId: request.requestId,
        ok: false,
        error: carrierReasonError('route_unregistered', { routeId: request.capabilityId }),
      };
    }
    try {
      const result = await handler(request.input, context);
      return { requestId: request.requestId, ok: true, result };
    } catch (error: unknown) {
      return {
        requestId: request.requestId,
        ok: false,
        error: normalizeDispatchError(error, request.capabilityId, deps.diagnostics),
      };
    }
  };

  return { dispatch };
}

/** handler 抛出值归一为封套错误：已登记域码原样透出，其余收敛 `BRIDGE_INTERNAL`。 */
function normalizeDispatchError(error: unknown, routeId: string, diagnostics: DiagnosticsSink): IWireChipsError {
  const wire = asError(error);
  if (wire.code === BRIDGE_ERROR_CODES.internal) {
    diagnostics.error('carrier-route', `路由 handler 异常归一为内部错误`, {
      routeId,
      reason: error instanceof Error ? error.message : typeof error,
    });
  }
  return wire;
}

function asError(error: unknown): IWireChipsError {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    retryable?: unknown;
  } | null;
  if (candidate !== null && typeof candidate?.code === 'string' && typeof candidate.message === 'string') {
    return {
      code: candidate.code,
      message: candidate.message,
      ...(candidate.details === undefined ? {} : { details: candidate.details }),
      retryable: candidate.retryable === true,
    };
  }
  return bridgeWireError(BRIDGE_ERROR_CODES.internal);
}
