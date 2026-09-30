/**
 * 图像内容处理服务（canonical 包 `chips.service.content-image`）：
 * 服务插件入口对象（10-服务插件接口 §2 角色契约）。
 *
 * - `start`：以 Cordis 服务提供 `content-image`（04-能力契约规范 §8.4 登记的图像族
 *   服务名；不注册 Bridge 能力、不进入 R19 权限映射，与 §8.1 一致），当前只挂
 *   `pickColors` 一个已实现操作，并把两级缓存的清理登记为 Fork 副作用
 *   （10-服务插件接口 §3.8）；
 * - `stop`：幂等 no-op——服务注册随 Fork 撤销，缓存清理由 `effect` 承担；
 * - `health`：只读、幂等、无副作用（分析核心为纯函数形态，恒可用）。
 *
 * 像素来源承载：图像字节 → RGBA 像素的解码供给未在内核注册
 * （`content-image.normalize` / `transcode` 提供方在册缺位），当前以未绑定端口注册服务——
 * 服务可注入、描述符与契约完整，调用在解码一跳按已登记码 `IMAGE_DECODE_FAILED`
 * （`details.reason=PIXEL_SOURCE_UNBOUND`）如实收口，不做任何模拟像素。
 */

import type { IServiceContext, IServicePlugin } from '@chips/sdk';

import { CORDIS_SERVICE_NAME, PROVIDER_PLUGIN_ID } from './descriptor.js';
import { clearResultCache, createPickColorsService } from './service.js';
import { clearSampleCache, createUnboundDecodeEngine } from './pixel-source.js';

/** 创建服务插件入口对象（每次调用返回新对象；状态全部归属平台 Fork）。 */
export function createContentImagePlugin(): IServicePlugin {
  return {
    start(ctx: IServiceContext): Promise<void> {
      const service = createPickColorsService({
        engine: createUnboundDecodeEngine(),
        log: ctx.logger,
      });
      ctx.effect(() => {
        clearSampleCache();
        clearResultCache();
      });
      ctx.provide(CORDIS_SERVICE_NAME, service);
      ctx.logger.info('图像内容处理服务已注册', {
        service: CORDIS_SERVICE_NAME,
        provider: PROVIDER_PLUGIN_ID,
      });
      return Promise.resolve();
    },

    stop(): Promise<void> {
      // 幂等 no-op：服务注册与缓存清理随 Fork 撤销（10-服务插件接口 §3.8、§6.3）。
      return Promise.resolve();
    },

    health(): Promise<boolean> {
      return Promise.resolve(true);
    },
  };
}
