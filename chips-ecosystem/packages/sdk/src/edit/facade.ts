/**
 * 渲染侧插件装载受管门面契约类型（12-编辑引擎设计 §4.1、受管门面 IPluginRuntime）。
 *
 * 权威归属：
 * - 形状按 12 §4.1 原文逐字落位：入参是类型标识（`cardType` / `layoutType`），不是插件 ID、
 *   路径或入口 URL；装载对象由平台注册表按 manifest `capabilities.cardTypes[].id` /
 *   `capabilities.layouts[].id` 解析（12 §4.1 规则 2）；
 * - 返回的门面方法面与角色接口一致（`renderView` / `renderEditor` / `validateConfig` /
 *   `export`），但它是平台包装对象；**插件模块本身（ESM 模块图）不交给调用方**
 *   （12 §4.1 规则 3）；`export` 不因门面装载而执行（12 §4.1 规则 5）；
 * - 装载失败不缓存失败结果；`plugin:loaded` / `plugin:unloaded` 到达后失效对应插件全部
 *   缓存（12 §4.2）；
 * - 角色入口 `IBaseCardPlugin` / `IBoxLayoutPlugin` 的权威定义在 08 §2.1 / 09 §3.1
 *   （本模块引用 `types/roles/*` 既有单点，不复制形状）。
 *
 * 命名边界（工单036 残段勘查 线①缺口③ 登记）：主入口同名 `IPluginRuntime` 已被 manifest
 * `runtime` 声明类型占用（`@chips/scaffold` 单源、02-SDK-API规范 §2.2 manifest 行在册，
 * 形状 `{ targets, background }`），与本受管门面同名不同物。本类型是渲染侧平台机制
 * （12 §4.1 规则 1：应用插件不得持有它，插件不得调用它），故只在编辑链路类型域
 * （`./index.js`）在册，不经主入口导出；两名的收口归属命名裁决波次，本单不改动
 * manifest 转发面。
 */

import type { IBaseCardPlugin } from '../types/roles/basecard.js';
import type { IBoxLayoutPlugin } from '../types/roles/boxlayout.js';

/**
 * 渲染侧插件运行时受管门面（12 §4.1 原文逐字）。
 *
 * 由平台提供（渲染侧插件运行时），是编辑链路、渲染会话与任何渲染侧代码装载插件的
 * **唯一入口**；应用与编辑链路不得自行 `import()` 插件模块（12 §2.1 末段）。
 */
export interface IPluginRuntime {
  /** 按卡片类型装载基础卡片插件；返回平台包装的受管门面（12 §4.1）。 */
  loadBaseCard(cardType: string): Promise<IBaseCardPlugin>;
  /** 按布局类型装载箱子布局插件；返回平台包装的受管门面（12 §4.1）。 */
  loadLayout(layoutType: string): Promise<IBoxLayoutPlugin>;
}
