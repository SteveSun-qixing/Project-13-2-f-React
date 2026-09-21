/**
 * preload 入口：把 Bridge 三方法挂载到 `window.chips`，并另立宿主内部取视图通道与卡片窗口
 * 装载输入投递两个最小面——共三个相互独立的 contextBridge 世界。
 *
 * 权威：`01-Bridge-API规范` §2.2（`contextBridge.exposeInMainWorld('chips', …)`）、
 * `ADR-002` §IPC 通信、`17-跨端Shell与平台抽象设计` §3.3 SB-4（只暴露方法面、不暴露原始对象）、
 * `05-渲染引擎设计` §2.3 + 工单035 裁定一（宿主内部通道：壳进程↔主进程 IPC、非插件能力、
 * **不经 `window.chips` 链路**）与 §10.3 待办 2（第三独立世界承载装载输入投递，
 * 单方法 `requestInit`、通道钉死、纯转发）。
 *
 * @remarks
 * - `window.chips`：只暴露 `request` / `subscribe` / `resource` 三个方法；不暴露 `ipcRenderer` /
 *   `process` / `require` 等原始对象（R2、SB-4）。该冻结三方法面**不因本波任何改动而扩宽**。
 * - 宿主内部取视图通道（`window[HOST_VIEW_CHANNEL_SURFACE_KEY]`）：与 `window.chips` **独立挂载的
 *   第二个 contextBridge 世界**，是工单035 裁定的「非 `window.chips` 承载」在窗口装载层的物理切片——
 *   单方法 `requestView(payload)`、通道在实现侧钉死（`preload/host-view-channel.ts`），服务的是壳
 *   自有 RenderHost（卡片窗口顶层只运行平台代码，插件内容运行在无 preload 语境的沙箱帧），对插件不可见。
 *   它不进入 `chips` 键集、不是插件能力、无 capability ID、不经 Bridge 能力注册表（R19 权限判定不适用于
 *   本通道两端均为平台自身代码的取视图请求）。
 * - 卡片窗口装载输入投递（`window[CARD_WINDOW_INIT_SURFACE_KEY]`）：**第三个独立 contextBridge
 *   世界**（任务 #119 契约冻结、#120 接线），单方法 `requestInit(payload)`、通道钉死
 *   `card-window-init:request`（`preload/card-window-init.ts`）——与 `chips` /
 *   `__chipsHostViewChannel` 各自独立挂载、互不扩面（两世界冻结键集零改动）。
 * - 该入口在 Electron 沙箱 preload 中运行；不得引入 `node:*`。渲染层依赖仅限 #105 冻结契约件
 *   `renderer/document-view-channel.ts`（头注明示「纯类型 + 纯函数，可安全 import 于主/渲染任一侧」，
 *   主进程侧 `capabilities/document/adapters/view-channel.ts` 已按同一方式消费）与 #119 冻结契约件
 *   `shared/card-window-init-surface.ts` 的通道名/世界键常量——两者是各自通道名的唯一权威来源，
 *   preload 侧引用它们以与主进程 `ipcMain.handle` 登记逐字对齐、杜绝漂移。
 */

import { contextBridge, ipcRenderer } from 'electron';

import { CARD_WINDOW_INIT_SURFACE_KEY } from '../shared/card-window-init-surface.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../shared/host-view-channel-surface.js';
import { createCardWindowInitSurface } from './card-window-init.js';
import { createPreloadBridge } from './bridge.js';
import { createContextBridgeSurface } from './error-surface.js';
import { createHostViewChannelSurface } from './host-view-channel.js';
import { createElectronPreloadTransport } from './transport.js';

const bridge = createPreloadBridge({
  transport: createElectronPreloadTransport(ipcRenderer),
});

// 工单038 修复：挂载面经 `createContextBridgeSurface` 归一失败臂——一切异常在跨 contextBridge 前
// 收敛为 `ChipsError.toPlain()` 同构的纯数据错误（`code`/`message`/`retryable` 恒输出、`details`
// 有值时输出），渲染侧按 `isChipsError` 结构守卫判定、`code` 分支。键集仍恰为三方法冻结面。
contextBridge.exposeInMainWorld('chips', createContextBridgeSurface(bridge));

// 宿主内部取视图通道：独立于 `window.chips` 的第二 contextBridge 世界（工单035 裁定「非 chips 链路」承载）。
contextBridge.exposeInMainWorld(HOST_VIEW_CHANNEL_SURFACE_KEY, createHostViewChannelSurface(ipcRenderer));

// 卡片窗口装载输入投递：第三独立 contextBridge 世界（工单035 §10.3 待办 2，任务 #120 接线）——
// 单方法 `requestInit`、通道钉死在 `preload/card-window-init.ts`，与上述两世界互不扩面。
contextBridge.exposeInMainWorld(CARD_WINDOW_INIT_SURFACE_KEY, createCardWindowInitSurface(ipcRenderer));

window.addEventListener('unload', () => {
  bridge.dispose();
});
