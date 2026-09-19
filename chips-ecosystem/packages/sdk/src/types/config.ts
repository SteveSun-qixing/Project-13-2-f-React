/**
 * 配置层级公共类型（10-配置系统设计 §2.2；07-应用插件接口 §二、10-服务插件接口 §3.1）。
 */

/** 配置层。 */
export type ConfigLayer = 'platform' | 'user' | 'workspace' | 'plugin';

/** 可写配置层。 */
export type ConfigWriteScope = 'user' | 'workspace';
