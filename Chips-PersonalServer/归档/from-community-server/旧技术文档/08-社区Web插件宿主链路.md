# 社区 Web 插件宿主链路

## 1. 文档定位

本文档记录 `Chips-CommunityPlatformServer` 内部已经落地的浏览器侧应用插件宿主链路。

它描述的是社区服务器自己的正式实现，不额外定义生态公共协议；公共 Host / Bridge / Manifest 口径仍以 `生态共用技术文档/` 为准。

最后核对时间：2026-07-06。

## 2. 当前目标

社区网页当前已经支持：

1. 在浏览器里正式承载原版 `type: app` 插件；
2. 让 `/cards/:cardId` 直接进入原版 `com.chips.card-viewer`；
3. 让卡片内图片、音乐、视频、电子书等资源点击后通过正式 `resource.open` 打开对应原版 Web 应用插件；
4. `/cards/:cardId` 打开前只读取轻量 `open-view` 数据，`coverRatio` 走普通列，不把 `cardMetadata` / `cardStructure` JSONB 放入打开热路径；
5. 不再依赖临时重写的网页查看器页面。

## 3. 服务端入口

服务端当前新增以下 Web Runtime 路由：

- `POST /api/v1/host/plugin-sessions`
- `GET /api/v1/host/plugin-sessions/:sessionId`
- `DELETE /api/v1/host/plugin-sessions/:sessionId`
- `POST /api/v1/host/resource-open-plan`
- `GET /api/v1/host/plugin-sessions/:sessionId/entry`
- `GET /api/v1/host/plugin-sessions/:sessionId/theme.css`
- `GET /api/v1/host/plugin-sessions/:sessionId/bootstrap.js`
- `GET /api/v1/host/theme-assets/:themeId/*`
- `GET /api/v1/host/plugin-sessions/:sessionId/assets/*`

卡片打开页还使用社区内容接口：

- `GET /api/v1/cards/:cardId/open-view`

代码位置：

- `packages/server/src/routes/host-runtime.ts`
- `packages/server/src/services/host-integration.ts`
- `packages/server/src/routes/cards.ts`
- `packages/server/src/services/card.service.ts`

## 4. 服务端宿主职责

`HostIntegrationService` 当前除原有 `HeadlessHostShell` 集成外，还承担了浏览器插件会话宿主的服务端职责：

1. 安装并启用支持 `runtime.targets.web.supported = true` 的 app 插件；
2. 为浏览器创建正式插件会话，并复用 Host Runtime 的 `pluginInit / completeHandshake`；
3. 解析插件 HTML 入口与静态资源；
4. 在浏览器请求 `resource.open` 时，按正式 `resource-handler / file-handler` 能力解析目标插件；
5. 提供与桌面 Host preload 对齐的 Web 主题运行时视图，包括 `theme.css`、`theme.getAllCss`、`theme.resolve` 和主题字体资产；
6. 关闭浏览器侧插件会话。

当前默认纳入社区服务器 Host 的 app 插件：

1. `com.chips.card-viewer`
2. `com.chips.photo-viewer`
3. `com.chips.music-player`
4. `com.chips.video-player`
5. `com.chips.book-reader`

当前默认纳入社区服务器 Host 的基础卡片插件：

1. `chips.basecard.richtext`，支持 `base.richtext`
2. `chips.basecard.image`，支持 `base.image`
3. `chips.basecard.webpage`，支持 `base.webpage`
4. `chips.basecard.music`，支持 `base.music`
5. `chips.basecard.video`，支持 `base.video`
6. `chips.basecard.score`，支持 `base.score`
7. `chips.basecard.book`，支持 `base.book`
8. `chips.basecard.hyperlink`，支持 `base.hyperlink`

## 5. 前端宿主页职责

社区前台当前通过以下组件承载 Web 插件：

- `packages/web/src/components/HostedPluginSurface.tsx`
- `packages/web/src/pages/HostedPluginSessionPage.tsx`
- `packages/web/src/lib/host-runtime.ts`

外层宿主页负责：

1. 请求创建插件会话；
2. 用 iframe 承载 `/api/v1/host/plugin-sessions/:sessionId/entry`；
3. 处理 iframe 内 `window.chips.invoke(...)` 发出的 Host 调用；
4. 把 `resource.open / surface.open / plugin.launch / transfer.openExternal` 等动作映射为浏览器导航行为；
5. 生产环境在路由页卸载时自动关闭会话，开发环境禁用自动清理以避免 React 开发态重复卸载把会话提前删掉。

当前正式导航策略补充：

1. 由插件内部触发的“打开新网页”动作，默认优先使用新标签页承载；
2. 若浏览器阻止弹窗，再回退到当前页导航；
3. 社区前台自己的入口路由，例如用户直接进入 `/cards/:cardId`，仍然沿用当前标签页进入。
4. 文档型宿主中的 `resource.open`，例如 `/cards/:cardId` 内点击图片、音乐、视频、电子书等基础卡片，命中二级应用后优先使用预打开的新标签页承载，让原卡片阅读页保留在当前标签页。
5. 所有插件内部发起的 `resource.open` 都保留当前页兜底；如果浏览器拦截新标签页，则由当前页接管导航，避免用户点击后没有任何可见反馈。

## 6. 浏览器侧 `window.chips` 注入

当前插件页面里的 `window.chips` 由两部分共同提供：

1. 服务端在插件入口 HTML 中注入 `<base>`、`theme.css` 与 `bootstrap.js`
2. 外层 `HostedPluginSurface` 通过 `postMessage` 接住 iframe 发出的 Host 调用

当前 bootstrap 已覆盖的本地能力包括：

1. `platform.getInfo`
2. `platform.getCapabilities`
3. `theme.getCurrent`
4. `theme.getAllCss`
5. `theme.resolve`
6. `i18n.getCurrent`
7. `resource.resolve`
8. `resource.readBinary`
9. `resource.readMetadata`
10. `platform.dialogOpenFile`
11. `platform.dialogSaveFile`
12. `platform.dialogShowMessage`
13. `platform.dialogShowConfirm`
14. `command.register`
15. `command.unregister`
16. `command.get`
17. `command.list`
18. `command.invoke`
19. `command.setState`

主题注入规则：

1. `entry` 路由会在插件自身 CSS 前插入 `/api/v1/host/plugin-sessions/:sessionId/theme.css`；
2. `theme.css` 由当前 Host active theme 生成，包含 `:root` token 变量、组件主题 CSS 与 Material Symbols `@font-face`；
3. 主题 CSS 中的 `file://` 字体资产会被重写为 `/api/v1/host/theme-assets/:themeId/*`，并由服务端限制在对应主题插件安装目录内读取；
4. 主题资产路由按资源扩展返回 Web 可消费 MIME，Material Symbols 字体当前以 `font/woff2` 响应；
5. `cpx` 长度单位会在服务端归一为浏览器可识别的 `vw`，与桌面 Host preload 的浏览器化处理保持一致；
6. `bootstrap.js` 只负责设置 `data-chips-theme-id/version` 与提供 `theme.*` Bridge 能力，不依赖内联 `<style>`，避免被插件 CSP 的 `style-src` 阻断。

其中 `resource.resolve/readBinary/readMetadata` 支持 `http://`、`https://`、`data:`、`blob:`、同源根路径 `/api/...` 与浏览器文件选择器产生的 `chips-web-file://` 资源标识，供音乐播放器、视频播放器、书籍阅读器等原版应用插件恢复封面、歌词、字幕、文档元数据等辅助资源。普通相对路径必须先由卡片单节点运行时基于资源基准 URL 归一，不由插件会话入口兜底猜测。`command.*` 在当前 Web 插件会话内维护命令注册表、命令状态和 `command.*` 事件派发，供原版应用插件的菜单、工具栏、快捷键和命令 Provider 正常初始化；不在社区服务端数据库中持久化。其余需要浏览器顶层窗口处理的动作，会转发到外层宿主页。

## 7. 正式链路

### 7.1 卡片内容页

`/cards/:cardId` 当前链路：

1. 社区前台读取 `GET /api/v1/cards/:cardId/open-view`；
2. 若 view 缓存尚未命中，服务端会补排 `community-web` 渲染任务，前台保持 `pending` 加载态并轮询 `GET /api/v1/cards/:cardId/render-status`，不得把 `rendering` 误显示为不存在；
3. `open-view` 在卡片源文件 ready 时始终返回受控封面入口 `/api/v1/cards/:cardId/cover`，封面缓存未命中时由该入口补排 `community-cover` 渲染任务并返回准备态 HTML；
4. 若 `viewState = cache_ready` 且存在 `viewUrl`，前台重新读取一次 `open-view`，确保 `cardSource` 携带最新 `coverUrl/coverRatio` 后创建 `com.chips.card-viewer` Web 会话；
5. 启动参数中写入结构化 `cardSource`，其 `documentUrl/viewUrl` 指向 `GET /api/v1/cards/:cardId/view`；
6. 原版 `CardViewer` 在 Web 场景下恢复为托管文档查看态；
7. `CardViewer` 用 iframe 承载 `/view` 重定向后的 view 渲染缓存；
8. `CardViewer` 在文档型 Web surface 中通过 `plugin.chrome.update` 发布标题、插件接管的返回语义和封面切换动作；社区宿主在 iframe 外渲染固定 chrome，并通过 `plugin.chrome.action` 把动作回传给查看器；
9. `HostedDocumentWindow` 采用“先挂载 `message/load/error` 监听，再赋值 iframe `src`”的正式时序，避免浏览器加载过快时丢失 `chips.composite:ready` 或原生 `load` 信号；
10. `HostedDocumentWindow` 消费正式 `chips.composite:resize`，测量 CardViewer 自身真实文档流高度，并向外层插件宿主页发出 `plugin.surface.resize`；
11. `HostedPluginSurface` 在 `surfaceMode = document` 下按正式高度事件同步 iframe 高度；
12. 用户最终滚动的是整个页面，而不是卡片查看器内部的小窗。

当前高度事件遵循生态公共 `DocumentSurfaceResizePayload`：

```ts
interface DocumentSurfaceResizePayload {
  height: number;
  contentHeight: number;
  safeBlockEnd: number;
  viewportHeight: number;
  reason: "initial" | "content-resize" | "asset-load" | "font-load" | "viewport-resize";
  stable: boolean;
}
```

社区链路补充实现规则：

1. `HostedDocumentWindow` 是 Web 卡片查看态的高度发布方；它不会直接把内部复合卡片高度原样透传，而是统一测量自身文档流、内部 iframe、加载态和底部阅读安全区；
2. 底部阅读安全区由 `--chips-document-safe-area-block-end` 驱动，社区宿主在 document surface 上提供默认 token 值；
3. 高度发布使用 `requestAnimationFrame` 合并，连续资源加载、字体加载和窗口缩放会先发布 `stable=false`，约 160ms 稳定窗口后再发布 `stable=true`；
4. 内容增长会即时撑开外层 iframe；内容变短时，CardViewer 与 `HostedPluginSurface` 都只在 `stable=true` 后收缩高度，避免用户阅读底部时页面突然上跳；
5. `HostedPluginSurface(surfaceMode=document)` 只负责把稳定后的文档 surface 高度应用到插件 iframe，不承担卡片内容测量职责；
6. 用户点击外层插件工具栏动作前，`HostedPluginSurface(surfaceMode=document)` 会先把插件 iframe 高度重置到当前浏览器视口并滚动到 surface 顶部，再把 `plugin.chrome.action` 投递给插件。这样从长正文切到封面时，不会让旧正文高度继续参与 CardViewer 内部 `vh` 计算；
7. CardViewer 的封面态仍使用正式 `coverUrl` iframe 展示 `.card/cover.html`，并由 `ViewerCoverSurface` 发布自己的 `plugin.surface.resize` 高度事件；社区文档流宿主下的封面态不使用旧正文高度做垂直居中基准。

### 7.2 资源打开

卡片内资源点击链路：

1. 基础卡片发出 `chips.basecard:resource-open`；
2. 复合卡片文档汇总为 `chips.composite:resource-open`；
3. 原版 `CardViewer` 调用 `client.resource.open(...)`；
4. 外层宿主页请求 `/api/v1/host/resource-open-plan`；
5. 服务端依据 `resource-handler:<intent>:<mime>` 与 `file-handler:<ext>` 能力命中 Web 可运行的 app 插件；
6. 前台创建新的目标 app Web 会话；
7. 浏览器优先在新标签页导航到 `/host/plugins/:sessionId`，若新标签页被拦截则回退为当前页导航；
8. 原版目标应用从 `launchParams.resourceOpen` 恢复资源查看态。

当前服务端资源计划已覆盖以下默认处理器：

1. 图片资源：`com.chips.photo-viewer`，例如 `image/png`、`image/jpeg`、`image/webp`；
2. 音频资源：`com.chips.music-player`，例如 `.mp3/.flac/.wav/.m4a/.aac/.opus/.webm`；
3. 视频资源：`com.chips.video-player`，例如 `.mp4/.webm/.mov/.m4v/.ogv`；
4. 电子书与文档资源：`com.chips.book-reader`，例如 `.epub/.pdf/.txt/.md/.fb2/.rtf/.mobi/.azw/.azw3/.djvu/.doc/.docx`。

补充约束：

1. 上游基础卡片传入的 `resource.payload` 必须原样透传到 `launchParams.resourceOpen.payload`；
2. 社区 Web Host 只负责资源路由和启动上下文组装，不解释 `chips.music-card`、`chips.video-card`、`chips.book-card` 等业务 payload；
3. 当资源 URL 本身没有扩展名时，资源计划会优先使用 `resource.fileName` 推断扩展名与 MIME 类型；
4. `GET /api/v1/cards/:cardId/render-cache/:cacheVersion/*` 与 `GET /api/v1/cards/:cardId/cover-cache/:cacheVersion/*` 作为受控缓存资源代理时必须转发浏览器 `Range` 请求，并在对象存储返回分段内容时响应 `206 Content-Range` 与 `Accept-Ranges: bytes`；视频播放器依赖该能力读取 MP4/WebM 等媒体元数据和分段内容。

## 8. Web Surface 映射

当前社区前台对 `surface` 的映射策略：

1. 在浏览器顶层由插件触发的 `route / tab / window` 打开请求，都会优先落到新标签页；
2. 若浏览器阻止弹出，则回退到当前页导航；
3. 当前没有单独实现浏览器内 modal / sheet 容器，相关请求仍会落到路由页承载。

## 9. 社区前台路由壳模式

社区前台当前把页面宿主拆为三类正式路由壳：

1. `default`
2. `document`
3. `immersive`

当前映射规则：

1. 普通社区页面走 `default`，使用朴素白色社区页面背景；其中欢迎页、简介页、认证页和工作区页挂载 `SiteFooter`，个人社区页不挂载站点页脚；
2. `/cards/:cardId` 走 `document`，关闭社区装饰背景，恢复页面级文档流滚动；
3. `/host/plugins/:sessionId` 与 `/boxes/:boxId` 当前走 `immersive`，保持沉浸式全窗插件承载；
4. `document` 和 `immersive` 两类内容直达页都不显示社区页脚。

承载约束：

1. `document` 模式下，`app-shell__main` 参与正常文档流高度计算，不使用固定定位全窗承载；
2. `HostedPluginSurface(surfaceMode=document)` 必须使用普通文档流容器，并跟随 `plugin.surface.resize` 调整 iframe 高度；
3. `immersive` 模式下，`app-shell` 与 `HostedPluginSurface` 才采用固定定位全窗承载；
4. 卡片查看页不得再复用沉浸式应用窗口样式，否则会重新制造中间小窗与内部滚动；
5. 卡片 HTML 正式导出壳层采用纯内容背景与零块向舞台留白，避免在社区 Web 查看链路顶部露出导出背景条；
6. `PhotoViewer` Web 根舞台改为纯色背景，不再额外叠加顶部渐变层。

卡片查看页当前已经拆出独立阅读体验壳层：

1. `CardViewerPageShell` 不再提供顶部菜单栏，而是提供独立悬浮返回按钮、悬浮信息窗和后续功能按钮 slot；
2. `CardViewerPageStage` 只承载卡片查看 surface，后续评论、分享、收藏等功能不得塞进 CardViewer 插件 iframe；
3. 页面底部保留轻量阅读结束空间，最后一张卡不会紧贴浏览器底边；
4. `/cards/:cardId` 不再提供“访问作者主页”入口；
5. `/cards/:cardId` 的返回按钮优先走浏览器历史；无历史时回到作者主页，再无作者信息时回到首页。
6. 卡片查看页顶部保留阅读安全区，避免悬浮控件遮挡卡片正文；卡片信息窗采用顶部居中的药丸形态，只展示卡片标题与创建日期两行信息。

## 9.1 打开页预取与资源预连接

社区前台当前为卡片与箱子打开页补充了两类轻量加速：

1. `packages/web/src/lib/card-open-view-prefetch.ts`
   - 以 `cardId` 为 key 维护内存 Promise 缓存；
   - `CardDetailPage` 读取缓存命中结果，否则发起 `GET /api/v1/cards/:cardId/open-view`；
   - 失败请求会从缓存移除，避免缓存错误状态。
2. `packages/web/src/lib/box-detail-prefetch.ts`
   - 以 `boxId` 为 key 维护内存 Promise 缓存，镜像卡片预取模式；
   - `BoxDetailPage` 读取缓存命中结果，否则发起 `GET /api/v1/boxes/:boxId`；
   - 失败请求会从缓存移除，避免缓存错误状态。
3. `packages/web/src/components/WorkTile.tsx`
   - 对不处于管理模式的作品瓦片启用预取，按类型分发：`card` 走 `prefetchCardOpenView`，`box` 走 `prefetchBoxDetail`；
   - hover、focus 和接近视口（IntersectionObserver）时会调用对应预取；
   - 管理模式下不触发打开页预取；封面仍按原分支渲染（卡片 coverUrl 走 iframe，箱子 coverUrl 走 img，缺失时显示占位）。

前端启动时还会执行 `packages/web/src/lib/resource-hints.ts`：

- 默认对 `https://file.chipscard.space` 写入 `dns-prefetch` 与 `preconnect`；
- 若配置 `VITE_CCPS_RESOURCE_ORIGIN`，则使用该来源；
- 若资源来源与当前页面同源，则不写入额外 hint。

这些动作只预热轻量 API 与对象存储连接，不提前创建 Host 插件会话，也不绕开 `com.chips.card-viewer`。

## 10. Web 手势接管约束

`PhotoViewer` 在 Web 宿主下需要完整接管用户的缩放和平移手势。

当前实现约束：

1. 视口元素通过原生非被动 `wheel` 监听处理缩放与平移；
2. 当命中图片查看交互时，阻止浏览器默认的页面缩放与页面滚动；
3. 额外拦截 `gesturestart / gesturechange / gestureend`，降低触控板缩放联动浏览器缩放的概率；
4. 视口与根页面统一启用 `overscroll-behavior: none`。

## 11. 当前实现边界

1. 这条链路已经满足社区前台“原版插件正式接入 Web”的业务要求；
2. 当前落地点是社区服务器内部 Web 插件宿主，不等价于 `chips-host` 已对外发布通用 `WebHostShell` 包导出；
3. Web 场景下承载远端卡片 HTML 或图片资源的 app 插件，入口 HTML 的 CSP 必须显式放行 `http:` 与 `https:` 的 `img-src / font-src / connect-src / frame-src`；
4. 对象存储中历史导出的卡片 HTML 如果早于本轮 Host 输出修正，重新导出后才能获得新的 HTML CSP；
5. 社区前台归档目录中的临时图片查看页实现已停用，不再参与正式编译。

## 12. 本地联调补充

当前社区前台开发代理已支持通过环境变量覆盖目标实例：

1. `CCPS_WEB_PORT`
2. `CCPS_API_PROXY_TARGET`
3. `CCPS_CDN_PROXY_TARGET`

这使得当前分支可以在不停止旧版 `3000 / 5173` 进程的情况下，额外拉起一套新的联调实例，例如：

1. 社区 API：`PORT=3001 BASE_URL=http://localhost:3001 npm run dev`
2. 社区前台：`CCPS_WEB_PORT=5175 CCPS_API_PROXY_TARGET=http://localhost:3001 CCPS_CDN_PROXY_TARGET=http://localhost:9000 npm run dev`

补充约束：

1. `HeadlessHostShell` 启动前，默认纳入安装的 `Chips-BoxLayoutPlugin/grid-BLP` 必须先完成构建，使其 `dist/` 入口存在；
2. 若默认 layout 插件尚未构建，服务端会在 Host 插件安装阶段报 `PLUGIN_ENTRY_NOT_FOUND: dist`，而不是进入业务接口阶段。
