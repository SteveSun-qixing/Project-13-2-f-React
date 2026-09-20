/**
 * 宿主内部取视图通道·窗口装载层最小传输面（preload ↔ 壳渲染进程 RenderHost 的 contextBridge 切片）。
 *
 * 权威：
 * - `05-渲染引擎设计` §2.3（跨进程时序：`DocumentView` 经**宿主内部取视图通道**回传，壳进程↔主进程
 *   IPC，非插件能力）、§2.6（构建执行位主进程，渲染侧 RenderHost 不可直触 backing）；
 * - 工单035 裁定一（通道是宿主自有壳进程↔主进程 IPC 契约：无 capability ID、不进 Bridge 能力注册表、
 *   **不经 `window.chips` 链路**）——本模块即该「不经 `window.chips`」承载在窗口装载层的物理切片：
 *   与 `window.chips`（`01-Bridge-API规范` §2.2 冻结三方法面）**互不相干、各自独立挂载**，
 *   本面不进入 `chips` 键集、不新增任何插件可见运行时入口；
 * - `ADR-002` §IPC 通信 / `17-跨端Shell与平台抽象设计` §3.3 SB-4（preload 经 `contextBridge`
 *   暴露受限方法面，不暴露 `ipcRenderer` / `process` / `require` 原始对象）——本面按 SB-4 同纪律
 *   只暴露**单个动作方法**、通道在窗口装载层内部钉定（渲染侧无法借本面触达任意 IPC 通道）。
 *
 * @remarks
 * - 定位：本文件是**纯类型 + 纯常量**（零 `electron` / `node:*` / DOM 依赖），可安全 import 于
 *   主 / 渲染 / preload 任一侧；真实 `ipcRenderer.invoke` 臂由 `src/preload/host-view-channel.ts`
 *   实现并经 `contextBridge.exposeInMainWorld(HOST_VIEW_CHANNEL_SURFACE_KEY, …)` 注入窗口全局，
 *   壳渲染进程 RenderHost（`src/renderer/entries/card.ts`）经同名全局读取本面并适配为
 *   `document-view-channel-client.ts` 的 `IDocumentViewChannelInvoke` 注入端口。
 * - 最小暴露面论证：`IHostViewChannelSurface` 只有一个方法 `requestView(payload)`——入参为
 *   #105 冻结请求封套（`IDocumentViewBuildRequest`），出参为 #105 冻结响应封套（普通对象，跨边界
 *   已由 Electron 结构化克隆一轮）；方法**不接受 channel 参数**，通道钉死为
 *   `DOCUMENT_VIEW_REQUEST_CHANNEL`（唯一名字来源在 `renderer/document-view-channel.ts`，窗口装载层
 *   内部引用，不在本面重复声明字面量以免漂移），渲染侧借此只能发起「取视图」一种请求，不能发起
 *   任何其它 IPC 触达——这是本面区别于「裸 `ipcRenderer`」的收敛点。
 * - 信任边界：卡片窗口顶层文档只运行平台自有 RenderHost 代码（`card.ts`），插件内容一律运行在
 *   无 `preload` 语境的沙箱帧（`renderer/entries/frame.ts` 头注：子帧不加载 `window.chips`），
 *   故本宿主内部面对插件代码不可见、不可达——与 §2.3「插件不可见、不可订阅」通道定性一致。
 * - 本面不做语义校验：请求/响应权威闸在 #105 契约两侧（发送侧自检 + 到达侧防线，归
 *   `document-view-channel-client.ts` 消费臂），窗口装载层为纯转发切片（与
 *   `preload/transport.ts` `IPreloadTransport` 同纪律：只适配收发，不解释负载语义）。
 */

/**
 * 宿主内部取视图通道的 `contextBridge` 全局键（窗口装载层注入、RenderHost 读取的唯一名字来源）。
 *
 * @remarks 双下划线前缀标记「宿主内部、非公共契约面」，与插件唯一入口 `window.chips` 显式区隔；
 * 键名单点定义于此，preload 与渲染侧各自 import 本常量，杜绝两处字面量漂移。
 */
export const HOST_VIEW_CHANNEL_SURFACE_KEY = '__chipsHostViewChannel';

/**
 * 宿主内部取视图通道的窗口装载层暴露面（`contextBridge.exposeInMainWorld` 挂载的形状）。
 *
 * @remarks 单一动作方法、通道在实现侧钉定（见文件头最小暴露面论证）；入出参均为 #105 冻结封套的
 * 普通对象形态，可结构化克隆。
 */
export interface IHostViewChannelSurface {
  /**
   * 发起一次取视图请求（渲染进程 → 主进程）。
   *
   * @param payload `IDocumentViewBuildRequest` 冻结请求封套（渲染侧已过发送侧自检）。
   * @returns `DocumentViewBuildResponse` 冻结响应封套（成功 / 失败两臂普通对象，到达侧权威闸再校验）。
   */
  requestView(payload: unknown): Promise<unknown>;
}
