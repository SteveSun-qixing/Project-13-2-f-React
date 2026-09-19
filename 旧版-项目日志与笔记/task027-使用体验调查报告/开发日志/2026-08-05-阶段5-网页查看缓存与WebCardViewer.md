# 阶段5开发日志：网页查看缓存和 Web CardViewer

> 日期：2026-08-05
> 阶段：阶段 5（网页查看缓存和 Web CardViewer）
> 任务清单：P5-01 ~ P5-10

## 目标

浏览器只查看，不上传也不下载。

## 完成内容

### 查看缓存与封面缓存（P5-01 / P5-02）

`Chips-CommunityPlatformServer/packages/server/src/services/card-render-cache.service.ts`：

- `viewRenderProfile`（`community-web`）生成正文查看缓存；
- `coverRenderProfile`（`community-cover`）生成封面查看缓存；
- complete 后通过 `enqueueForCard` 调度 Worker 生成。

### 缓存与资产存储（P5-03）

- 查看缓存写入 `chips-card-render-cache`、封面缓存写入 `chips-card-cover-cache` 对象存储 bucket（私有卡片写私有 bucket，通过受控 API 代理）；
- 主题 CSS、字体、插件静态资产通过 `/api/v1/host/plugin-sessions/:id/*`、`/api/v1/host/theme-assets/:themeId/*` 正式路由提供。

### 浏览器只加载社区页面与查看缓存（P5-04 / P5-09）

- `CardDetailPage` 只加载 `open-view` 轻量字段 + `render-status` 轮询 + 缓存 `viewUrl`；
- 资源 URL 使用对象存储/CDN 稳定地址，不使用临时本地路径。

### Web CardViewer（P5-05 / P5-06 / P5-07）

- `DocumentPluginRoutePage` 启动 `com.chips.card-viewer` Web 插件会话，通过 `HostedPluginSurface` iframe 承载封面、正文、复合卡片窗口和资源打开体验；
- Web CardViewer 不显示下载 .card 功能，不显示上传入口；
- CardViewer manifest 明确 Web target 只查看。

### 客户端打开引导（P5-08）

- 新增 `DocumentPluginRoutePage` 下载提示条（`role="note"`），社区卡片详情页显示“请在薯片客户端中打开并下载”；
- 新增 i18n 文案 `card.downloadInClientHint`（zh-CN / en-US）。

### 渲染失败状态（P5-10）

- 缓存未就绪时 `CardDetailPage` 显示处理中状态（轮询 render-status）；
- 缓存生成失败时显示失败状态（render_error / error）；
- 浏览器不尝试自己解析和打包 .card。

## 验证

- Web 包 `npx tsc -p tsconfig.json --noEmit` 通过。
- 服务器全量测试通过（见阶段 3）。

## 状态

- [x] P5-01 ~ P5-10 全部完成。
- 下一阶段：阶段 6（客户端查看和下载链路）。
