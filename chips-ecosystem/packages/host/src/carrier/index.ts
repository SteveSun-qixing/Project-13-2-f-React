/**
 * 承载链路服务组合根：端点派生 → 实例身份/token → 索引/任务存储 → 路由表 → 监听服务
 * （《17-CLI承载链路契约》波 1 宿主服务端总装）。
 *
 * @remarks
 * - 端点唯一来自 `deriveCarrierEndpoints`（`@chips/bridge` 单一派生源，§2.2）；
 *   `instanceId` 与 `bearerToken` 每实例重新生成（§2.4）。
 * - 命令索引四事件重建（§5.8/波 1 派单）：宿主插件生命周期事件经
 *   {@link ICarrierService.handlePluginEvent} 触发，事件集为
 *   {@link CLI_INDEX_REBUILD_EVENTS}，其余事件不触发重建。
 */

import { randomUUID } from 'node:crypto';

import { deriveCarrierEndpoints, type ICarrierEndpoints } from '@chips/bridge';

import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createCliCommandIndex, type ICarrierPluginView } from './command-index.js';
import { generateBearerToken } from './discovery.js';
import { createCarrierRouteTable, type CommandInvokePort } from './routes.js';
import { createCarrierServer, type ICarrierSessionPort, type ICarrierServerReport } from './server.js';
import { createCliTaskStore } from './task-store.js';
import { CLI_INDEX_REBUILD_EVENTS } from './types.js';

/** 承载服务总报告（并入宿主 `report()` 诊断面）。 */
export interface ICarrierServiceReport extends ICarrierServerReport {
  readonly indexEntries: number;
  readonly activeTasks: number;
  readonly discoveryFile: string;
  readonly instanceId: string;
}

/** 承载服务接口（宿主运行时生命周期挂载面）。 */
export interface ICarrierService {
  /** `start()` 成功后调用：打开监听并初建索引；fail-closed 不抛出（§2.3/§2.5）。 */
  open(): Promise<void>;
  /** `shutdown()` 最先调用：§2.5-5 停机顺序。 */
  close(): Promise<void>;
  /** 插件生命周期事件入口（四事件触发索引重建，其余忽略）。 */
  handlePluginEvent(eventId: string): void;
  report(): ICarrierServiceReport;
  readonly endpoints: ICarrierEndpoints;
  readonly instanceId: string;
}

/** 承载服务依赖。 */
export interface ICarrierServiceDeps {
  readonly userDataPath: string;
  readonly hostVersion: string;
  readonly diagnostics: DiagnosticsSink;
  /** 统一会话注册表的承载接入端口（组合根提供，禁止第二会话表）。 */
  readonly sessions: ICarrierSessionPort;
  /** 插件装载记录快照端口（发现索引数据源）。 */
  readonly plugins: () => readonly ICarrierPluginView[];
  /** `command:invoke` 内核端口；未装配即 R3 在册臂（如实拒绝，工单039 挂账）。 */
  readonly invokeCommand?: CommandInvokePort;
}

/** 创建承载链路服务（宿主服务端总装）。 */
export function createCarrierService(deps: ICarrierServiceDeps): ICarrierService {
  const endpoints = deriveCarrierEndpoints(deps.userDataPath);
  const instanceId = randomUUID();
  const bearerToken = generateBearerToken();
  const startedAt = Date.now();
  const index = createCliCommandIndex({ plugins: deps.plugins, diagnostics: deps.diagnostics });
  const tasks = createCliTaskStore({ now: () => Date.now() });
  const routes = createCarrierRouteTable({
    index,
    tasks,
    diagnostics: deps.diagnostics,
    ...(deps.invokeCommand === undefined ? {} : { invokeCommand: deps.invokeCommand }),
  });
  const server = createCarrierServer({
    endpoints,
    instanceId,
    bearerToken,
    hostVersion: deps.hostVersion,
    startedAt,
    routes,
    sessions: deps.sessions,
    diagnostics: deps.diagnostics,
  });

  return {
    async open(): Promise<void> {
      await server.open();
      await index.rebuild();
    },

    async close(): Promise<void> {
      await server.close();
    },

    handlePluginEvent(eventId: string): void {
      if (!CLI_INDEX_REBUILD_EVENTS.includes(eventId)) {
        return;
      }
      void index.rebuild().catch((error: unknown) => {
        deps.diagnostics.error('carrier-index', '插件生命周期事件触发索引重建失败', {
          reason: error instanceof Error ? error.message : typeof error,
        });
      });
    },

    report(): ICarrierServiceReport {
      return {
        ...server.report(),
        indexEntries: index.entries().length,
        activeTasks: tasks.size,
        discoveryFile: endpoints.discoveryFile,
        instanceId,
      };
    },

    endpoints,
    instanceId,
  };
}

export type { ICarrierPluginView } from './command-index.js';
export type { ICarrierSessionPort, ICarrierServerReport } from './server.js';
export type { CommandInvokePort } from './routes.js';
export { CARRIER_ROUTE_IDS, CLI_INDEX_REBUILD_EVENTS } from './types.js';
