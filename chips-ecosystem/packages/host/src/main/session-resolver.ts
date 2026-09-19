/**
 * IPC 来源会话解析与会话权限下行推送。
 *
 * 权威：`02-Bridge三层设计` §7.4（会话解析与绑定）、§7.1（通道总表）、
 * `01-Bridge-API规范` §4.2（会话时间线）。
 */

import type { ISessionSource } from '../runtime/contracts.js';
import type { ISessionPermissionsUpdate } from '../protocol/wire.js';
import type { IWireChipsError } from '../protocol/wire.js';
import type { ShellIpcInvokeEvent, ShellWebContents } from './shell-api.js';

/** 会话解析失败时返回的错误（`BRIDGE_SESSION_UNKNOWN`）。 */
export const BRIDGE_SESSION_UNKNOWN_ERROR: IWireChipsError = {
  code: 'BRIDGE_SESSION_UNKNOWN',
  message: '来源会话无法解析或已关闭',
  retryable: false,
};

/** 从 `webContents` 切片读取 id；不可用时返回 `null`。 */
function readWebContentsId(webContents: object): number | null {
  const id = (webContents as { id?: unknown }).id;
  return typeof id === 'number' && Number.isInteger(id) ? id : null;
}

/**
 * 按 IPC 调用来源解析会话。
 *
 * 规则：会话身份只由来源（`webContents` + frame）解析，不接受负载自报（§2.2 规则 3）。
 *
 * @param event `ipcMain.handle` 事件。
 * @param isWindowAlive 窗口存活判定；返回 `false` 视为会话已关闭。
 * @returns 会话来源；解析失败时返回 `null`，调用方按 `BRIDGE_SESSION_UNKNOWN` 拒绝。
 */
export function resolveIpcSession(
  event: ShellIpcInvokeEvent,
  isWindowAlive: (windowId: number) => boolean,
): ISessionSource | null {
  const windowId = readWebContentsId(event.sender);
  if (windowId === null || !Number.isInteger(windowId)) {
    return null;
  }
  if (!isWindowAlive(windowId)) {
    return null;
  }
  const frameId = event.senderFrame === null ? null : readFrameRoutingId(event.senderFrame);
  return { windowId, frameId };
}

/** 读取 frame routing id；不可用时返回 `null`。 */
function readFrameRoutingId(frame: object): number | null {
  const routingId = (frame as { routingId?: unknown }).routingId;
  return typeof routingId === 'number' && Number.isInteger(routingId) ? routingId : null;
}

/**
 * 向窗口推送会话权限快照。
 *
 * @param webContents 目标窗口；已销毁时返回 `false`。
 * @param channel `session:permissions` 通道名。
 * @param update 权限快照。
 * @returns 是否已投递。
 */
export function pushSessionPermissions(
  webContents: ShellWebContents,
  channel: string,
  update: ISessionPermissionsUpdate,
): boolean {
  if (webContents.isDestroyed()) {
    return false;
  }
  webContents.send(channel, update);
  return true;
}
