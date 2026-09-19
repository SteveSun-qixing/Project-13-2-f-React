/**
 * Bridge IPC 通道常量。
 *
 * 权威：`02-Bridge三层设计` §7.1（通道总表）。通道名固定，不得由插件自定义或拼接。
 */

/** 能力调用通道（渲染 → 主，`ipcRenderer.invoke` / `ipcMain.handle`）。 */
export const BRIDGE_REQUEST_CHANNEL = 'bridge:request';

/** 资源句柄控制通道（渲染 → 主）。 */
export const BRIDGE_RESOURCE_CHANNEL = 'bridge:resource';

/** 事件订阅控制通道（渲染 → 主）。 */
export const EVENT_CONTROL_CHANNEL = 'event:control';

/** 会话权限快照下行通道（主 → 渲染，平台内部通道，插件不可订阅）。 */
export const SESSION_PERMISSIONS_CHANNEL = 'session:permissions';

/** 事件下行通道前缀（主 → 渲染）；完整通道名为 `event:<eventId>`。 */
export const EVENT_CHANNEL_PREFIX = 'event:';

/**
 * 构造事件下行通道名。
 *
 * @param eventId 事件契约中登记的事件 ID（可含 `:`）。
 */
export function eventChannel(eventId: string): string {
  return `${EVENT_CHANNEL_PREFIX}${eventId}`;
}

/** 三通道（渲染 → 主）全集；供注册与自检使用。 */
export const RENDERER_TO_MAIN_CHANNELS = [
  BRIDGE_REQUEST_CHANNEL,
  BRIDGE_RESOURCE_CHANNEL,
  EVENT_CONTROL_CHANNEL,
] as const;
