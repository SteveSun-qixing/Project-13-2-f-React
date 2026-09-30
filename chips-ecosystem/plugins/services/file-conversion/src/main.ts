/**
 * 文件转换编排服务：插件入口模块（IServicePlugin，10-服务插件接口 §2）。
 *
 * 模块顶层只声明、不产生副作用；默认导出实现 `IServicePlugin` 的服务对象。
 */

import { default as fileConversionServicePlugin } from './plugin.js';

export default fileConversionServicePlugin;
