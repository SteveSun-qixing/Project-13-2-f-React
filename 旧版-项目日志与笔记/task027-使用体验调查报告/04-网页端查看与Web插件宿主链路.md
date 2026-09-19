# 04-网页端查看与Web插件宿主链路

## 现在网页不是实时渲染 .card

当前社区网页查看的主链路不是“浏览器下载 .card 然后自己解析”，也不是“服务器每次请求实时渲染”。它更像：

    上传完成
      -> Worker 下载 source.card
      -> Headless Host + CardtoHTML 模块生成 HTML 目录
      -> 上传 HTML 目录到对象存储缓存
      -> /cards/:cardId/view 命中缓存后 302 到 index.html
      -> 社区前台创建 CardViewer Web 插件会话
      -> CardViewer iframe 承载 view 缓存文档

这个设计对低性能服务器是对的。渲染只发生在上传后或缓存 miss 后，用户浏览时主要由对象存储/CDN 出流量。

## Worker 如何生成查看缓存

CardRenderCacheService.renderViewJob(...) 的过程是：

1. 从数据库拿 card 记录；
2. 确认存在 sourceCardBucket/sourceCardKey/sourceCardSha256；
3. 生成 cacheVersion，里面包含 renderer version、render profile、主题 ID、locale、源文件 hash；
4. 下载 chips-card-files/{userId}/{cardId}/source.card 到临时目录；
5. 调用 hostIntegration.convertCardToHtml(...)；
6. convertCardToHtml 通过 Headless Host 调模块能力 converter.file.convert；
7. Chips-CardtoHTML-Plugin 通过 Host 正式渲染链路把卡片导出为 HTML 目录；
8. 上传整个 HTML 目录到 chips-card-render-cache 或私有缓存 bucket；
9. 把 entryUrl/htmlUrl/status 写回数据库。

封面缓存类似，只是解包 .card 后拿 .card/cover.html 和 .card/cardcover/* 生成 community-cover 缓存。

## 前台如何打开卡片

/cards/:cardId 的前台流程是：

    GET /api/v1/cards/:cardId/open-view
      -> 如果 viewState 不是 cache_ready，显示 pending 并轮询 render-status
      -> 如果 cache_ready，拿到 viewUrl
      -> createWebPluginSession(pluginId = com.chips.card-viewer)
      -> launchParams.cardSource.documentUrl = viewUrl
      -> HostedPluginSurface iframe 打开插件入口

所以用户看到的是“网页里的 CardViewer”，而不是社区页面自己拼出来的卡片。

## Web 插件宿主做了什么

社区服务端的 /api/v1/host/plugin-sessions/:sessionId/entry 会给插件 HTML 注入：

    <base href="/api/v1/host/plugin-sessions/:sessionId/">
    <link rel="stylesheet" href="/api/v1/host/plugin-sessions/:sessionId/theme.css">
    <script src="/api/v1/host/plugin-sessions/:sessionId/bootstrap.js"></script>

bootstrap.js 会提供浏览器版 window.chips，当前覆盖的能力包括：

- platform 基本信息；
- theme.getCurrent / getAllCss / resolve；
- i18n.getCurrent；
- resource.resolve / readBinary / readMetadata；
- command 注册与调用；
- dialog 文件选择/保存等浏览器模拟能力；
- surface.open、plugin.launch、resource.open 这类需要外层网页处理的动作。

这很关键。CardViewer、MusicPlayer、PhotoViewer、VideoPlayer、BookReader 都是原版应用插件，要在网页里跑，必须有足够完整的 Web Host Runtime。

## 资源打开链路

卡片内部点击资源时，目标链路是：

    基础卡片 iframe
      -> chips.basecard:resource-open
      -> 复合卡片文档汇总 chips.composite:resource-open
      -> CardViewer 调 client.resource.open(...)
      -> HostedPluginSurface 请求 /api/v1/host/resource-open-plan
      -> 根据 mime / 扩展名命中 Web app 插件
      -> 新建目标插件 session
      -> 新标签页或当前页打开 PhotoViewer / MusicPlayer / VideoPlayer / BookReader

这里有两个易踩坑：

1. 资源 payload 不能被社区宿主“理解后重组”，必须原样透传给目标应用；
2. 私有缓存里的媒体资源必须支持 Range 请求，否则视频/音频/电子书这类查看器体验会坏。

## 服务器渲染页面还是浏览器渲染页面

当前实际是混合模式：

- 服务器/Worker 预生成可静态访问的 HTML 查看产物；
- 浏览器加载这个 HTML 并完成真实交互；
- 外层 CardViewer Web 插件提供统一查看器 chrome、封面切换、资源打开、页面高度同步。

所以它不是传统 SSR，也不是纯客户端解析 .card。对弱服务器比较合适。

## 这个方案的边界

网页端能实现“查看体验”，但不是完整编辑器：

- 可查看卡片内容；
- 可打开图片、音频、视频、电子书等资源；
- 可切换查看器封面/正文等状态；
- 可以通过 Web 插件宿主模拟部分 Host 能力；
- 但完整编辑仍应要求安装本地软件，因为编辑涉及文件系统、资源导入、打包、基础卡片编辑器、长期草稿和复杂权限。

