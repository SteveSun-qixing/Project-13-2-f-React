# 分析报告：Chips-CommunityClient 新项目（2026-08-05 21:06 创建）

## 项目定位
- 薯片生态官方社区客户端应用插件（com.chips.community-client，type: app），运行于薯片 Host 桌面端。
- 与社区网页版共用同一套社区平台 HTTP API 与页面结构；客户端具备网页版没有的上传/本地查看/下载能力。
- manifest：desktop supported（web/mobile/headless 不支持）、cli.commands: chips-community open、19 项最小权限（module.invoke/credential.manage/config.write/network.request 等）。

## 目录结构（92 个将跟踪文件）
- manifest.yaml / chips.config.mjs / index.html（CSP 放行 http/https/file/blob）/ config/ / i18n（双语各 292 行）/ assets/icons/
- src/app/：AppProviders、AppRuntimeProvider、AppShell（HashRouter 9 路由 + SiteHeader 挂载）、scene-registry、app-shell.css
- src/commands/：3 条应用命令（openWorkspace/openSettings/refreshTheme）+ CommandRouterBridge
- src/runtime/：chips-client 单例、launch-context、community-runtime
- src/community/：api（请求封装 + 401 刷新队列）、contexts（Auth/Preferences）、lib（transfer 传输服务、server-config、ui）、pages（9 页）、components（SiteHeader/SiteFooter/WorkGrid/WorkTile/ProfileHero/ProfileSettingsDialog）、runtime/icons（15 个自绘 SVG）、styles/runtime.css（--ccps-* token 移植）、types
- src/preview/、src/testing/、tests/（4 unit + e2e）、技术文档/（6 份）

## 关键设计
- 认证：refreshToken 存 Host credential（community.refreshToken），accessToken 仅内存，401 自动刷新队列合并并发；启动 tryRestore 恢复会话。
- 传输：全部走 community.card.transfer 模块（openRemote/upload/download），1.2s 轮询 job、30 分钟超时；客户端不自建协议。
- 查看：卡片点击 openInLocalViewer 由本地卡片查看器渲染（不启用服务器渲染缓存链路）；CardDetailPage 已归档，路由移除。
- 与网页版差异：WorkspacePage 有真实上传入口；新增 /settings 客户端设置页、/admin 外部浏览器重定向。

## 完成度
- 完整可运行工程：无 TODO/占位；preview:smoke 与 quality:gate 全部 passed；4 个单元测试 + e2e smoke；6 份技术文档；归档符合规范。
- 注意点：
  1. 技术文档 03 与 01 仍引用已归档的 CardDetailPage/路由，存在文档漂移；
  2. downloadCard 服务实现无 UI 入口（原入口随 CardDetailPage 归档消失）——下载能力入口缺失，需确认是否有意为之；
  3. 依赖靠根工作区 workspace 解析，独立克隆需先装根依赖。
