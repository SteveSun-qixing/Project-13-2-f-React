# {{ DISPLAY_NAME }}

标准箱子布局插件工程。推荐通过生态 CLI 创建：

```bash
chipsdev-r create layout <targetDir>
```

## 工程定位

- 插件 ID：`{{ PLUGIN_ID }}`
- 布局类型：`{{ LAYOUT_TYPE }}`
- 显示名称：`{{ DISPLAY_NAME }}`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 目录说明

- `src/view/`：查看态页面挂载与运行时
- `src/editor/`：布局参数编辑、箱子自有资源导入和预览
- `src/schema/`：默认配置、归一、校验和 `assetRefs` 同步
- `src/shared/`：共享类型与视图辅助函数
- `src/lib/`：简体中文文案总表（`messages.ts`）
- `contracts/`：布局配置 JSON Schema
- `tests/`：schema、查看态和编辑态单元测试
- `assets/icons/`：静态布局图标资源与来源说明

生成工程不直接读取磁盘、网络或 `.box` 文件内容。Host 是唯一运行时承载，查看器和编辑器通过 Host/SDK 正式链路装载布局文档。

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（`appleTheme` 苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射，调用点使用 `formatMessage`）

## 正式导出

入口文件 `src/index.ts` 导出 `layoutDefinition`，包含：

- `createDefaultConfig`
- `normalizeConfig`
- `validateConfig`
- `getInitialQuery`
- `renderView`
- `renderEditor`

`layoutDefinition.icon` 使用正式 `IconDescriptor`。构建产物由 `chipsdev-r build` 生成到 `dist/index.mjs`，打包产物由 `chipsdev-r package` 生成 `.cpk`。

## 查看态运行时

查看态从 Host 注入的 `initialView` 首屏摘要开始渲染。后续分页通过 `runtime.listEntries({ cursor, limit })` 拉取，不自行解析 `.box/structure.yaml`。

条目封面显示优先调用 `runtime.renderEntryCover(entryId)`，并用 `@chips/ui` 的 `EmbeddedDocumentFrame` 承载 Host 返回的正式文档入口。点击封面或标题只调用 `runtime.openEntry(entryId)`，打开窗口和外部跳转由 Host 决定。

需要在布局页面内显示完整卡片时，调用 `runtime.renderEntryDocument(entryId, { mode, interactionPolicy })` 获取 Host 托管的 `documentUrl` 和 `renderSessionId`，以受控 iframe 挂载；切换条目或卸载时必须调用 `runtime.releaseEntryDocument(renderSessionId)`。布局插件不得把 `resolveEntryResource(kind: "documentFile")` 返回的原始 `.card` 文件 URL 当成可渲染网页，也不得自行解析卡片包。引用箱子的条目不支持递归内嵌，应继续显示封面或通过 `runtime.openEntry(entryId)` 打开。

布局自有背景和顶部区域资源通过 `runtime.readBoxAsset(assetPath)` 读取。`resourceUrl` 只用于当前会话预览或渲染，不写入布局配置。

查看态还会对即将使用的条目调用 `runtime.prefetchEntries({ entryIds, targets: ["cover"] })`，并在分页、封面和箱子资源失败时显示本地化错误状态。

## 编辑器与资源桥

编辑器基于 antd 受控控件构建（做法 A：原生 `<form>` + `Select` / `Segmented` / `Input.TextArea` / `Button`），通过 `ConfigProvider(locale=zh_CN, theme=appleTheme)` 接入 antd 中文文案与苹果风格 token。所有可见文案来自 `src/lib/messages.ts`。

布局配置编辑通过 `onChange(next)` 输出完整归一后的配置快照。编辑器不直接写 `.box/content.yaml`、`.box/structure.yaml`、`assets/` 或文件系统。

箱子自有资源只通过 Host 注入的 asset bridge 管理：

- `importBoxAsset({ file, preferredPath })`：导入背景或顶部区域图片；
- `readBoxAsset(assetPath)`：读取 Host 受控资源 URL 用于预览；
- `deleteBoxAsset(assetPath)`：替换、清空或切换模式时删除旧资源。

配置只保存 Host 返回的 `assets/` 包内相对 `assetPath`。不要保存绝对路径、`file://`、`blob:`、`data:`、`http://`、Host 临时 `resourceUrl`、凭证或 `sessionId`。

## 配置与 `.box` 存储边界

插件运行时对象使用 camelCase：

```ts
{
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    background: {
      mode: "image",
      assetPath: "assets/layouts/{{ LAYOUT_TYPE }}/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>...</section>"
    }
  },
  assetRefs: [
    "assets/layouts/{{ LAYOUT_TYPE }}/background/hero.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case：

```yaml
layout_configs:
  {{ LAYOUT_TYPE }}:
    schema_version: "1.0.0"
    props:
      sort_mode: "manual"
      background:
        mode: "image"
        asset_path: "assets/layouts/{{ LAYOUT_TYPE }}/background/hero.webp"
    asset_refs:
      - "assets/layouts/{{ LAYOUT_TYPE }}/background/hero.webp"
```

camelCase 与 snake_case 的转换由 Host/SDK/编辑引擎正式链路负责。布局插件只消费 Host 注入的运行时对象，不直接写 YAML。

资源路径必须以 `assets/` 开头，并且不能包含绝对路径、scheme、反斜杠、查询串、片段、空路径段或 `.` / `..` 逃逸段。TypeScript schema 与 `contracts/layout-config.schema.json` 使用同一安全口径。

## 常用命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

`npm run verify` 会依次执行 lint、typecheck、test、build、validate 和 package。发布或联调前至少运行一次 `npm run verify`。

布局插件没有独立应用窗口入口。正式联调路径是先运行 `npm run verify` 生成 `.cpk`，再通过开发工作区安装并启用插件，由箱子查看器或编辑器通过 Host/SDK 打开 `.box`。
