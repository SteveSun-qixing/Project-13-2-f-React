# 重构 Host 底层打通全平台应用插件调用机制技术方案

## 1. 文档定位

本文档记录 task011 的真实落地结果，而不是前期设想稿。

当前交付目标已经收口为：

1. 把 Host 从“单体桌面运行时”重构为“Host Core + Shell”
2. 把 PAL 升级为能力分面模型
3. 在 Host 服务层正式引入 `surface / transfer / association`
4. 把应用插件启动链路升级为跨平台 `surface` 主语义
5. 把 Manifest、Bridge、SDK、Scaffold、社区服务器一起打通

## 2. 本轮已落地的核心结构

### 2.1 Host Core 与 Shell

当前 `Chips-Host` 已正式拆分出：

- `HostCore`
- `DesktopHostShell`
- `HeadlessHostShell`

代码位置：

- `Chips-Host/src/main/core/host-core.ts`
- `Chips-Host/src/main/shells/desktop-host-shell.ts`
- `Chips-Host/src/main/shells/headless-host-shell.ts`

对外包导出已同步：

- `chips-host/host-core`
- `chips-host/desktop-host-shell`
- `chips-host/headless-host-shell`

### 2.2 PAL 2.0

当前 `packages/pal` 已完成 PAL 2.0 结构升级：

- `environment`
- `surface`
- `storage`
- `selection`
- `transfer`
- `association`
- `device`
- `systemUi`
- `background`
- `ipc`
- `offscreenRender`

并提供结构化 `PalCapabilitySnapshot`。

当前已正式实现的 PAL 适配器：

- `DesktopPalAdapter`
- `HeadlessPalAdapter`

### 2.3 Host 服务域重组

当前 Host 服务域已新增：

- `surface`
- `transfer`
- `association`

并把 `platform` 收口到平台原语与离屏导出。

当前服务域总数已更新为 19 个。

### 2.4 Bridge / Runtime Client / SDK

当前 Bridge 已正式暴露新增子域：

- `surface`
- `transfer`
- `association`

SDK 已同步提供：

- `client.surface`
- `client.transfer`
- `client.association`

`platform.getCapabilities()` 已升级为结构化快照。

### 2.5 Manifest vNext

当前 Host 运行时、CLI 校验器、Scaffold 模板和官方插件清单已统一支持：

- `runtime.targets`
- `ui.surface`
- `capabilityFallbacks`

### 2.6 社区服务器接入

社区服务器当前 Host 集成已切换到：

- `HeadlessHostShell`

代码位置：

- `Chips-CommunityPlatformServer/packages/server/src/services/host-integration.ts`

## 3. 本轮最关键的架构收口

### 3.1 `surface` 成为应用插件的正式跨平台入口

本轮最关键的收口不是单独新增一个服务域，而是把应用插件主启动链路从桌面窗口思维中抽离出来。

当前正式语义：

- `surface.open({ target: { type: "plugin" } })`
  - 会创建正式插件会话
  - 会完成握手
  - 会调用 PAL `surface.open`
  - 会发布 `surface.opened / plugin.launched`

- `plugin.launch`
  - 保留为 app 插件兼容入口
  - 底层复用同一条启动链路

### 3.2 `window` 退为桌面兼容别名

`window.*` 当前仍保留，但角色已经改变：

- 它不再是未来新增跨平台能力的主语义
- 它是 `surface(kind=window)` 的桌面兼容层

### 3.3 Host Core 去平台泄漏

当前 Host Core / 服务层已经不再以 Electron 作为唯一物理宿主。

这使得：

- Desktop 继续走 Electron Shell
- 社区服务器可以直接走 Headless Shell
- Web / Mobile Shell 后续可以在不推翻 Host Core 的前提下增量接入

## 4. 本轮实际改动范围

### 4.1 Host

重点改动：

- `packages/pal`
- `packages/bridge-api`
- `src/main/core`
- `src/main/shells`
- `src/main/services/register-host-services.ts`
- `src/preload/create-bridge.ts`
- `src/runtime/plugin-runtime.ts`
- `src/shared/window-chrome.ts`

### 4.2 SDK

重点改动：

- `src/api/surface.ts`
- `src/api/transfer.ts`
- `src/api/association.ts`
- `src/api/platform.ts`
- `src/api/window.ts`
- `src/core/client.ts`
- `src/core/bridge-adapter.ts`
- `src/contracts/route-manifest.json`

### 4.3 Scaffold 与插件清单

已同步更新：

- app / card / layout / module / theme Scaffold 模板
- 官方 app / card / layout / module / theme 插件 `manifest.yaml`

### 4.4 社区服务器

已同步更新：

- Host 集成实现
- Headless 导入测试入口
- 社区前台 Web 插件宿主
- 社区前台卡片正式插件承载页

当前社区前台已正式具备以下 Web 链路：

1. `/cards/:cardId` 不再直接重定向到对象存储静态 HTML；
2. 社区前台会先创建 `com.chips.card-viewer` 的 Web 插件会话；
3. 原版 `CardViewer` 在 Web 场景下以托管文档方式承载卡片 HTML；
4. 卡片内部图片点击会通过正式 `resource.open` 匹配 `com.chips.photo-viewer`；
5. 社区前台跳转 `/host/plugins/:sessionId`，承载原版 `PhotoViewer` Web 会话；
6. 原版 `CardViewer / PhotoViewer` 插件入口 CSP 已放开 Web 宿主所需的 `http / https` 远端内容语义；
7. `HostedDocumentWindow` 已改为“监听先于赋值 `src`”的正式宿主时序，避免 Web 文档超快加载导致 ready/load 信号丢失；
8. 插件内触发的新网页打开动作已统一优先映射为新标签页承载；
9. 社区前台内容直达页已拆分为 `document` 与 `immersive` 两类正式路由壳，而不是继续共用一套固定定位全窗承载；
10. `/cards/:cardId` 已改为 `document` 模式，用户滚动的是整个页面，不再是在中间小窗口里滚动卡片；
11. `HostedDocumentWindow` 会把正式 `chips.composite:resize` 回传为 `plugin.surface.resize`，由社区宿主页驱动卡片页 iframe 高度；
12. `PhotoViewer` 已补齐 Web 下的原生非被动 `wheel` 与 `gesture*` 拦截，降低浏览器默认缩放/滚动与应用交互串扰；
13. `CardViewer` 与 `PhotoViewer` 根视口样式已按 `surfaceMode` 区分 `document` / `immersive` 两类语义，减少背景露底与额外滚动；
14. 卡片 HTML 正式导出壳层已移除顶部渐变和块向舞台留白，社区 Web 中打开卡片时不再额外叠加导出背景条；
15. 临时图片查看页实现已归档，不再参与正式编译。
16. 社区前台开发代理已支持通过环境变量切换 API / CDN 目标实例，便于在本机多套 dev 进程并存时验证新架构链路。

## 5. 验证结果

本轮已完成的关键验证：

- `Chips-Host`
  - `npm run build`
  - `npm test -- tests/unit/card-service-rendering.test.ts tests/integration/host-services.test.ts tests/unit/resource-open-service.test.ts`
- `Chips-CommunityPlatformServer/packages/server`
  - `npm run build`
- `Chips-CommunityPlatformServer/packages/web`
  - `npm run build`
- `Chips-BoxLayoutPlugin`
  - `npm run build`
- `Chips-PhotoViewer`
  - `npx vitest run tests/unit/launch-resource.test.ts tests/unit/image-viewer.test.ts`
- `Chips-CardViewer`
  - `npm run build`
- `Chips-PhotoViewer`
  - `npm run build`
- 本地最新实例联调验证
  - 启动 `@ccps/server` 于 `http://localhost:3001`
  - 启动 `@ccps/web` 于 `http://localhost:5175`
  - 验证 `GET /api/v1/discover/cards` 返回 ready 卡片
  - 验证 `/api/v1/host/resource-open-plan` 能正确命中 `com.chips.photo-viewer`
  - 验证 `com.chips.card-viewer` Web 会话可创建，并且 `entry / bootstrap.js / assets/*` 全部返回 `200`
  - 验证 `com.chips.photo-viewer` Web 会话可创建，并且 `entry / bootstrap.js / assets/*` 全部返回 `200`
  - 验证 `PhotoViewer` bootstrap 已收到正式 `launchParams.resourceOpen`
  - 验证 `CardViewer` bootstrap 已收到正式 `community-card-route + webDocumentUrl`
- `Chips-Scaffold/chips-scaffold-app`
  - `npm test`
  - `npm run test:templates`
- `Chips-Scaffold/chips-scaffold-module`
  - `npm test`
  - `npm run test:templates`
- `Chips-Scaffold/chips-scaffold-basecard`
  - `npm test`
  - `npm run test:templates`
- `Chips-Scaffold/chips-scaffold-boxlayout`
  - `npm test`
  - `npm run test:templates`
- `Chips-Scaffold/chips-scaffold-theme`
  - `npm test`

补充说明：

- 用户已明确要求不必执行完整全套测试；
- 本轮主要补做与正式 Web 插件宿主、资源打开链路、卡片 HTML 输出直接相关的定向构建与定向测试；
- 本机浏览器自动化运行时对 Playwright 启动系统 Chrome 存在限制，因此本轮真实链路核查以“最新 dev 实例 + HTTP / 插件会话 / 资源规划接口联调”方式完成。

## 6. 当前已知边界

### 6.1 已完成的目标

- Desktop / Headless 的统一 Host Core 已建立
- 应用插件跨平台启动主语义已完成收口
- 公共契约与官方模板已统一

### 6.2 当前仍未在本轮交付的部分

- 对外独立发布的 `chips-host/web-host-shell`
- `MobileHostShell`

但这两部分现在已经是“在已冻结契约上继续增量实现”的问题，不再需要重新推翻 Host / PAL / Bridge / Manifest 主设计；社区服务器自己的正式 Web 插件宿主链路已经可用。

## 7. 结论

task011 已经把这轮最关键的底层重构做实：

1. Host 不再被 Electron 物理形态锁死
2. 应用插件不再被桌面 `window` 语义锁死
3. 社区服务器已经可以复用同一 Host Core
4. 社区前台已经可以正式承载原版 `CardViewer / PhotoViewer` Web 会话
5. Web / Mobile 后续扩展已经有统一的正式入口和契约基础
