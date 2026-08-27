# Chips Community Transfer

官方社区卡片传输模块，提供 `community.card.transfer` 能力。该模块只在薯片客户端/Host 中运行，浏览器 Web 运行时不加载。

## 职责

- 在用户设备上解包完整离线 `.card`。
- 扫描卡片内部资源和封面资源。
- 通过社区 `card-transfer` 控制面申请对象存储上传地址。
- 将资源和网络资源卡片直接上传到对象存储。
- 把配置中的卡片根相对资源路径改写为对象存储/CDN URL。
- 生成可逆恢复清单，记录原始路径、网络 URL 和 ZIP Store 条目信息。
- 从客户端下载社区卡片时，按下载计划取回网络资源卡片和资源，恢复原始相对路径并重新打包完整离线卡片。
- 打开远程社区卡片页面时，委托 Host 外部打开能力处理。
- 上传 `.box` 箱子时，收集散落卡片（`file://` 引用）逐个走卡片上传链路，内嵌/网络卡片跳过，回写工作副本 structure.yaml 后通过 `contentType: 'box'` 控制面会话直传对象存储。
- **两种发布模式（`publish.includeRenderArtifacts`）**：
  - `false`（默认）：仅上传源文件，渲染由服务器负责（社区服务器模式）；
  - `true`：客户端调用 Host 的文件转换模块（`converter.file.convert`）把卡片渲染为 HTML 产物，连同封面产物（`.card/cover.html` 与 `cardcover/`）一并直传对象存储，服务器直接发布（个人服务器模式）。

社区服务器只保存元数据、对象位置、恢复清单和渲染任务状态；文件字节由对象存储/CDN 承担。

## 能力

```ts
community.card.transfer / upload
community.card.transfer / download
community.card.transfer / openRemote
community.card.transfer / uploadBox
```

输入输出契约见：

- `contracts/upload.input.schema.json`
- `contracts/upload.output.schema.json`
- `contracts/download.input.schema.json`
- `contracts/download.output.schema.json`
- `contracts/openRemote.input.schema.json`
- `contracts/openRemote.output.schema.json`
- `contracts/uploadBox.input.schema.json`
- `contracts/uploadBox.output.schema.json`

## 运行边界

- Desktop Host：支持上传、下载、远程打开、箱子上传。
- Mobile Host/PAL：按同一能力契约支持。
- Web 浏览器：不支持上传、下载和打包；浏览器只负责社区网页查看。

## 验证

- `npm test`
- `npm run build`
- `npm run validate`，该命令会通过 `prevalidate` 自动先构建 `dist/index.mjs`
