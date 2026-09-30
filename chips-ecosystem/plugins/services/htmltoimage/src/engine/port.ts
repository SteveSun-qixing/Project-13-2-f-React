/**
 * HTML 转图片服务：渲染承载端口。
 *
 * 本端口是「与渲染引擎的接口契约层」：真正的光栅化由宿主渲染承载实现
 * （Electron 离屏窗口族 / webContents.capturePage），实现必须复用平台渲染链路，
 * 禁止自建离屏渲染栈、禁止直接依赖 Electron（04-能力契约规范 §8.3 原子操作约束 3、
 * 渲染引擎设计）。实现注册与接线归属宿主渲染承载波次；在该波次收口前，
 * 服务编排以本模块的未绑定承载如实收口（CONVERTER_RENDER_FAILED +
 * details.reason=RENDER_CARRIER_UNBOUND），不做任何模拟渲染。
 */

import { RENDER_CARRIER_UNBOUND, renderFailed } from '../errors.js';
import type { IHtmlRasterEngine, IRasterizeResult } from '../types.js';

/** 未绑定承载的缺省标识。 */
export const UNBOUND_RASTER_ENGINE_ID = 'platform.render-carrier';

/**
 * 创建「未绑定」光栅化承载：调用即以 rejected Promise 抛出已登记码
 * CONVERTER_RENDER_FAILED，details.reason = RENDER_CARRIER_UNBOUND。它表达的是
 * 平台事实（渲染承载尚未在内核渲染面注册），不是降级、不是占位成功路径。
 */
export function createUnboundRasterEngine(engineId: string = UNBOUND_RASTER_ENGINE_ID): IHtmlRasterEngine {
  return {
    id: engineId,
    rasterize(): Promise<IRasterizeResult> {
      return Promise.reject(
        renderFailed('平台 HTML 渲染承载尚未接入，无法执行光栅化。', {
          engine: engineId,
          reason: RENDER_CARRIER_UNBOUND,
        })
      );
    },
  };
}
