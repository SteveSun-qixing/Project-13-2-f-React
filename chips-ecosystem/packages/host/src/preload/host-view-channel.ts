/**
 * 宿主内部取视图通道·窗口装载层真实传输臂（preload 侧 `ipcRenderer.invoke` 切片）。
 *
 * 权威：`05-渲染引擎设计` §2.3（`DocumentView` 经宿主内部取视图通道回传）、§2.6（构建执行位主进程）；
 * 工单035 裁定一（通道 = 壳进程↔主进程 IPC 契约、非插件能力、不经 `window.chips`）；
 * `ADR-002` §IPC 通信 / `17-跨端Shell与平台抽象设计` §3.3 SB-4（contextBridge 只暴露受限方法面、
 * 不暴露 `ipcRenderer` 原始对象）；封套与通道名的唯一契约权威在 `renderer/document-view-channel.ts`
 * （任务 #105 冻结件，头注明示「可安全 import 于主/渲染任一侧」——本模块只取其通道名常量）。
 *
 * @remarks
 * - 本臂是 `document-view-channel-client.ts` 的 `IDocumentViewChannelInvoke` 注入端口在生产语境的
 *   真实承载：窗口装载层（preload）经 `contextBridge.exposeInMainWorld(HOST_VIEW_CHANNEL_SURFACE_KEY, …)`
 *   把 {@link createHostViewChannelSurface} 产出的最小面注入卡片窗口顶层全局，RenderHost
 *   （`renderer/entries/card.ts`）读取并适配为消费端口——与 `transport.ts`「宿主 TS 层不直接 import
 *   electron、真实臂由窗口装载层注入」同型纪律。
 * - 最小暴露面（`shared/host-view-channel-surface.ts` 头注在册论证）：只暴露单方法 `requestView(payload)`，
 *   **不接受 channel 参数**，通道在内部钉死为 `DOCUMENT_VIEW_REQUEST_CHANNEL`——渲染侧借本面只能发起
 *   取视图请求，无法触达任意 IPC 通道；本面与 `window.chips` 三方法面各自独立挂载、互不重叠。
 * - 纯转发切片：不解释、不改写负载语义（请求/响应权威闸在 #105 契约两侧）；主进程未注册处理器时
 *   `ipcRenderer.invoke` 如实 reject，由渲染侧消费臂的传输归一单点收敛为在册错误码，本臂不吞错、不兜底。
 */

import { DOCUMENT_VIEW_REQUEST_CHANNEL } from '../renderer/document-view-channel.js';
import type { IHostViewChannelSurface } from '../shared/host-view-channel-surface.js';
import type { ElectronIpcRendererLike } from './transport.js';

/**
 * 构造宿主内部取视图通道的窗口装载层暴露面（真实 `ipcRenderer.invoke` 臂）。
 *
 * @param ipcRenderer `require('electron').ipcRenderer` 或测试替身（结构切片，同 `transport.ts`）。
 * @returns 单方法最小面；每次调用把负载原样投递到钉定的取视图通道。
 * @throws {Error} 缺少 `invoke` 时抛出（preload 装配缺陷，与 `createElectronPreloadTransport` 同纪律）。
 */
export function createHostViewChannelSurface(ipcRenderer: ElectronIpcRendererLike): IHostViewChannelSurface {
  if (typeof ipcRenderer?.invoke !== 'function') {
    throw new Error('宿主内部取视图通道传输臂初始化失败：ipcRenderer 形状非法');
  }
  return {
    requestView(payload: unknown): Promise<unknown> {
      return ipcRenderer.invoke(DOCUMENT_VIEW_REQUEST_CHANNEL, payload);
    },
  };
}
