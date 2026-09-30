/**
 * 服务插件入口对象（《10-服务插件接口》§2 角色契约）。
 *
 * - `start`：以 Cordis 服务提供 `markdown` 服务名（不注册 Bridge 能力、
 *   不进入权限映射，与《09-官方插件与应用目录》登记行逐字段一致）；
 * - `stop`：幂等 no-op——引擎实例缓存随 Fork 撤销由平台回收，服务无自有副作用；
 * - `health`：只读、幂等、无副作用（引擎为纯函数形态，恒可用）。
 */

import type { IServiceContext, IServicePlugin } from '@chips/sdk';
import { createMarkdownService } from './service.js';

/** Cordis 服务名（《09-官方插件与应用目录》`chips.service.markdown` 登记：服务名 `markdown`）。 */
export const MARKDOWN_SERVICE_NAME = 'markdown';

/**
 * 本插件入口类型：在 `IServicePlugin` 基础上把 `health()` 收紧为必选——
 * 本插件 manifest 已声明 `healthCheck`（《10-服务插件接口》§五：声明该字段必须实现 `health()`）。
 */
export interface IMarkdownServicePlugin extends IServicePlugin {
  /** 启动服务；由平台在 starting 阶段调用，返回后本插件进入 active。 */
  start(ctx: IServiceContext): Promise<void>;
  /** 停止服务；由平台在 stopping 阶段调用，必须先于 Fork 撤销完成。 */
  stop(): Promise<void>;
  /** 健康检查；只读、幂等、无副作用。 */
  health(): Promise<boolean>;
}

/** 创建服务插件入口对象（每次调用返回新对象；状态全部归属平台 Fork）。 */
export function createMarkdownPlugin(): IMarkdownServicePlugin {
  return {
    start(ctx: IServiceContext): Promise<void> {
      ctx.provide(MARKDOWN_SERVICE_NAME, createMarkdownService());
      return Promise.resolve();
    },

    stop(): Promise<void> {
      // 幂等 no-op：服务无自有定时器、订阅与持久化副作用。
      return Promise.resolve();
    },

    health(): Promise<boolean> {
      return Promise.resolve(true);
    },
  };
}
