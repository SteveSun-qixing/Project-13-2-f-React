/**
 * 服务插件入口实现（10-服务插件接口 §2 `IServicePlugin`）。
 *
 * 内容处理能力以 Cordis 服务形态提供（04-能力契约规范 §8.2：不注册为 Bridge 能力、
 * 不进入 R19 全表）；服务名与能力 ID 按官方登记表 §8.4（`content-converter` /
 * `content-converter.card-to-html`）。
 */

import type { IServiceContext, IServicePlugin } from '@chips/sdk';

import { convertCardToHtml } from './converter.js';
import type { IContentConverterService } from './types.js';

/** Cordis 服务名（04-能力契约规范 §8.4 登记表；内核服务文法 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`）。 */
export const CONTENT_CONVERTER_SERVICE_NAME = 'content-converter';

class CardToHtmlServicePlugin implements IServicePlugin {
  public start(ctx: IServiceContext): Promise<void> {
    const service: IContentConverterService = {
      cardToHtml: (input) => convertCardToHtml(ctx.bridge, input),
    };
    ctx.provide<IContentConverterService>(CONTENT_CONVERTER_SERVICE_NAME, service);
    ctx.logger.info('卡片 HTML 导出服务已启动', {
      pluginId: ctx.pluginId,
      service: CONTENT_CONVERTER_SERVICE_NAME,
    });
    return Promise.resolve();
  }

  /** 幂等停机：服务注销随 Fork 撤销，本服务无自持副作用。 */
  public stop(): Promise<void> {
    return Promise.resolve();
  }

  /** 只读健康探针：服务为无状态纯转换实现，激活即健康。 */
  public health(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** 入口模块默认导出（平台以对象方法形式调用三个生命周期方法）。 */
export default new CardToHtmlServicePlugin();
