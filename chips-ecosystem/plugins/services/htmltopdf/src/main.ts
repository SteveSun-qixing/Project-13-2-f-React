/**
 * HTML 转 PDF 服务：插件入口模块（IServicePlugin，10-服务插件接口 §2）。
 *
 * start 期间把 content-html-to-pdf Cordis 服务注册进内核；
 * 模块顶层只声明、不产生副作用。
 */

import type { IServiceContext, IServicePlugin } from '@chips/sdk';

import { CORDIS_SERVICE_NAME, CONTENT_CAPABILITY_ID } from './descriptor.js';
import { createUnboundPrintEngine } from './engine/port.js';
import { createHtmlToPdfService } from './service.js';

/**
 * 服务插件实现。
 *
 * 打印承载：宿主渲染承载（Electron 离屏窗口族 / webContents.printToPDF）尚未
 * 在内核渲染面注册（渲染承载归属波次缺位），当前以未绑定承载注册服务——
 * 服务可注入、描述符与契约完整，调用在打印一跳按已登记码
 * CONVERTER_RENDER_FAILED（details.reason=RENDER_CARRIER_UNBOUND）如实收口。
 */
class HtmlToPdfServicePlugin implements IServicePlugin {
  start(ctx: IServiceContext): Promise<void> {
    const service = createHtmlToPdfService({ engine: createUnboundPrintEngine() });
    ctx.provide(CORDIS_SERVICE_NAME, service);
    ctx.logger.info('HTML 转 PDF 服务已注册', {
      service: CORDIS_SERVICE_NAME,
      capability: CONTENT_CAPABILITY_ID,
    });
    return Promise.resolve();
  }

  stop(): Promise<void> {
    // 服务注册随 Fork 自动撤销（10-服务插件接口 §6.3），无额外清理面。
    return Promise.resolve();
  }

  health(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

export default new HtmlToPdfServicePlugin();
