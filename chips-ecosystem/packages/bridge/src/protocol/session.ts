/**
 * 会话模型（02-Bridge三层设计 §7.4、01-Bridge-API规范 §4.2）。
 *
 * 会话是插件一次运行实例与一个渲染宿主（窗口/表面）的绑定，是 Bridge 的身份与限权单位；
 * 调用方身份只由 Bridge 层按 IPC 来源（`webContents` + frame）解析，负载自报身份不参与授权。
 */

/** IPC 来源：Electron `webContents.id` 与主框架 routing id。 */
export interface ISessionSource {
  readonly windowId: number;
  readonly frameId: number;
}

/** 会话绑定与快照（不可变视图）。 */
export interface ISessionSnapshot {
  readonly sessionId: string;
  /** 反向域名插件 ID；平台会话为 `platform`。 */
  readonly pluginId: string;
  readonly windowId: number;
  readonly frameId: number;
  /** 权限快照：授权变更时整体替换并递增 `permissionVersion`。 */
  readonly grantedPermissions: ReadonlySet<string>;
  /** 会话已打开的卡片/箱子文档，用于资源作用域判定。 */
  readonly openedDocuments: ReadonlySet<string>;
  readonly state: 'active' | 'closed';
  /** 授权版本号，单调递增；用于丢弃迟到推送。 */
  readonly permissionVersion: number;
}

/** 会话创建输入。 */
export interface ISessionCreateInput {
  readonly sessionId: string;
  readonly pluginId: string;
  readonly windowId: number;
  readonly frameId: number;
  readonly grantedPermissions?: readonly string[];
  readonly openedDocuments?: readonly string[];
}
