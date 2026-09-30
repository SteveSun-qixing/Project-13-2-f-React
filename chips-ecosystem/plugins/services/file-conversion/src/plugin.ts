/**
 * 服务插件入口实现（10-服务插件接口 §2 `IServicePlugin`）。
 *
 * 编排能力以 Cordis 服务形态提供，服务名 `content-file-conversion`
 * （04-能力契约规范 §8.2 文法自洽推导；§8.4 无编排角色在册 ID，
 * 见 descriptor.ts 头注与 W4 迁移日志）。兄弟服务经 `ctx.inject` 正式面注入
 * （06-服务插件开发指南 §4.1）：提供方未就绪时不注册本服务、不假接线；
 * 注入回调内完成装配与注册，服务代际随依赖 Fork 更替。
 */

import type { IServiceContext, IServicePlugin } from '@chips/sdk';

import {
  CARD_CONVERTER_SERVICE_NAME,
  FILE_CONVERSION_PLUGIN_ID,
  FILE_CONVERSION_SERVICE_NAME,
  HTML_TO_IMAGE_SERVICE_NAME,
  HTML_TO_PDF_SERVICE_NAME,
} from './descriptor.js';
import { createBridgeFilePort } from './ports.js';
import { createFileConversionService } from './executor.js';
import type { ISiblingPorts } from './types.js';

/** 读取注入面兄弟服务并做形状守卫（缺失即 TypeError，不假接线）。 */
function readSiblingPorts(scope: IServiceContext): ISiblingPorts {
  const view = scope as unknown as Partial<Record<string, unknown>>;
  const cardConverter = view[CARD_CONVERTER_SERVICE_NAME];
  const htmlToPdf = view[HTML_TO_PDF_SERVICE_NAME];
  const htmlToImage = view[HTML_TO_IMAGE_SERVICE_NAME];

  if (
    typeof cardConverter !== 'object' ||
    cardConverter === null ||
    typeof (cardConverter as ISiblingPorts['cardConverter']).cardToHtml !== 'function' ||
    typeof htmlToPdf !== 'object' ||
    htmlToPdf === null ||
    typeof (htmlToPdf as ISiblingPorts['htmlToPdf']).htmlToPdf !== 'function' ||
    typeof htmlToImage !== 'object' ||
    htmlToImage === null ||
    typeof (htmlToImage as ISiblingPorts['htmlToImage']).htmlToImage !== 'function'
  ) {
    throw new TypeError('文件转换编排依赖的兄弟服务未就绪：content-converter / content-html-to-pdf / content-html-to-image。');
  }
  return { cardConverter, htmlToPdf, htmlToImage } as ISiblingPorts;
}

class FileConversionServicePlugin implements IServicePlugin {
  public start(ctx: IServiceContext): Promise<void> {
    ctx.inject([CARD_CONVERTER_SERVICE_NAME, HTML_TO_PDF_SERVICE_NAME, HTML_TO_IMAGE_SERVICE_NAME], (scope) => {
      const siblings = readSiblingPorts(scope);
      const service = createFileConversionService({
        siblings,
        file: createBridgeFilePort(ctx.bridge),
        logger: ctx.logger,
      });
      ctx.provide(FILE_CONVERSION_SERVICE_NAME, service);
      ctx.logger.info('文件转换编排服务已注册', {
        pluginId: FILE_CONVERSION_PLUGIN_ID,
        service: FILE_CONVERSION_SERVICE_NAME,
      });
    });
    return Promise.resolve();
  }

  /** 幂等停机：服务注销随 Fork 撤销（10-服务插件接口 §6.3），本服务无自持副作用。 */
  public stop(): Promise<void> {
    return Promise.resolve();
  }

  /** 只读健康探针：编排为无状态逐腿装配，激活即健康（依赖未就绪时服务尚未注册）。 */
  public health(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** 插件入口默认导出（平台以对象方法形式调用三个生命周期方法）。 */
export default new FileConversionServicePlugin();
