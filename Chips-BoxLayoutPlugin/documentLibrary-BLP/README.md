# 文档库布局插件

文档库布局插件把箱子展示成轻量文档库：左侧是层级目录树，右侧按节点配置显示完整卡片内容或正式封面。内容态直接显示 Host 托管的卡片文档，不重复显示箱子摘要中的标题、类型、摘要、标签或独立打开入口。

## 工程定位

- 插件 ID：`chips.layout.documentlibrary.blp`
- 布局类型：`chips.layout.documentlibrary.blp`
- 显示名称：`文档库布局插件`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 目录说明

- `src/view/`：查看态页面挂载、目录树和右侧预览
- `src/editor/`：目录树、显示参数、背景区、顶部区和箱子自有资源编辑
- `src/schema/`：默认配置、归一、校验和 `assetRefs` 同步
- `src/shared/`：共享类型
- `src/lib/`：简体中文文案总表与 `formatMessage` 插值
- `contracts/`：布局配置 JSON Schema
- `tests/`：schema、查看态和编辑态单元测试
- `assets/icons/`：静态布局图标资源与来源说明

生成工程不直接读取磁盘、网络或 `.box` 文件内容。Host 是唯一运行时承载，查看器和编辑器通过 Host/SDK 正式链路装载布局文档。

## 正式导出

入口文件 `src/index.ts` 导出 `layoutDefinition`，包含：

- `createDefaultConfig`
- `normalizeConfig`
- `validateConfig`
- `getInitialQuery`
- `renderView`
- `renderEditor`

`layoutDefinition.icon` 使用正式 `IconDescriptor`：`menu_book`。构建产物由 `chipsdev-r build` 生成到 `dist/index.mjs`，打包产物由 `chipsdev-r package` 生成 `.cpk`。

## 配置模型

插件运行时对象使用 camelCase：

```ts
{
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    treeNodes: [
      {
        id: "chapter-1",
        entryId: "entry-1",
        titleOverride: "第一章",
        presentation: "content",
        collapsed: false,
        children: []
      }
    ],
    sidebarWidth: "regular",
    showSummary: true,
    background: {
      mode: "image",
      assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>...</section>"
    }
  },
  assetRefs: [
    "assets/layouts/chips.layout.documentlibrary.blp/background/hero.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case，转换由 Host/SDK/编辑引擎正式链路负责。布局插件只消费 Host 注入的运行时对象，不直接写 YAML。

`treeNodes` 只保存目录组织关系、可选 `titleOverride`、条目 `presentation` 和默认 `collapsed` 状态，不改变 `structure.yaml` 中的条目引用集合。`presentation` 为 `content | cover`；卡片默认显示内容，箱子条目固定显示封面。未放入目录树的条目会在查看态继续展示，并在编辑器中显示为“未归档条目”。

## 查看态运行时

查看态从 Host 注入的 `initialView` 首屏摘要开始渲染。后续分页通过 `runtime.listEntries({ cursor, limit })` 拉取，不自行解析 `.box/structure.yaml`。

内容态调用 `runtime.renderEntryDocument(entryId, { mode: "view", interactionPolicy: "native" })`，右侧只挂载 Host 返回的 `documentUrl`，不再在 iframe 外重复渲染条目标题、类型、摘要、标签或“打开文档”按钮。子卡片 iframe 消费 `ready/resize/resource-open/node-error/fatal-error/interaction` 消息；切换目录、切换为封面或卸载布局时调用 `runtime.releaseEntryDocument(renderSessionId)`。远程卡片当前显示明确失败态。

查看态工具栏提供目录显示/隐藏切换。隐藏目录时只移除左侧目录节点，当前选中的卡片文档继续保留，并将主网格切换为单列；该状态属于当前布局页面会话，不写入布局配置。主网格和右侧预览使用内容高度（`max-content` / `fit-content`），目录自身独立滚动，窗口尺寸变化不会再把右侧内容强制拉伸到目录高度。

封面态继续调用 `runtime.renderEntryCover(entryId)`，并用 `@chips/ui` 的 `EmbeddedDocumentFrame` 承载 Host 返回的正式封面入口。点击目录标题只切换右侧内容，不再隐式新开窗口；点击封面或封面态的“打开文档”按钮才调用 `runtime.openEntry(entryId)`。引用箱子的条目始终使用封面态，不递归展开。

布局自有背景和顶部区域资源通过 `runtime.readBoxAsset(assetPath)` 读取。`resourceUrl` 只用于当前会话预览或渲染，不写入布局配置。

顶部内容区不设固定比例和最小高度。图片模式按图片自然宽高比显示并始终撑满区域宽度，区域背景透明；HTML 模式优先按 iframe 实际内容高度显示，拿不到高度时以容器宽度的 3 倍为上限（测量值同样受该上限钳制）。背景区域保持固定 16:9 比例、cover 铺满和白底等既有行为不变，编辑器预览与查看态保持一致。

查看态还会对即将使用的条目调用 `runtime.prefetchEntries({ entryIds, targets: ["cover"] })`，并在分页、封面和箱子资源失败时显示本地化错误状态。配置中引用但当前摘要页缺失的条目会显示缺失状态，配置不会被查看态自动移除。

## 编辑器与资源桥

编辑器使用 antd 构建表单、按钮、复选框、分段控件和选择器，所有可见文案在 `src/lib/messages.ts` 中直写简体中文。

布局配置编辑通过 `onChange(next)` 输出完整归一后的配置快照。编辑器不直接写 `.box/content.yaml`、`.box/structure.yaml`、`assets/` 或文件系统。

编辑器支持：

- 排序方式：手动顺序、名称升序、名称降序；
- 目录树基础配置：添加目录、加入未归档条目、上移、下移、缩进、取消缩进、移除、标题覆盖、默认折叠；
- 条目展示方式：卡片内容、卡片封面；箱子条目固定为卡片封面；
- 侧边栏宽度：紧凑、常规、宽；
- 摘要显隐；
- 背景区和顶部内容区：无、图片、HTML。

箱子自有资源只通过 Host 注入的 asset bridge 管理：

- `importBoxAsset({ file, preferredPath })`：导入背景或顶部区域图片；
- `readBoxAsset(assetPath)`：读取 Host 受控资源 URL 用于预览；
- `deleteBoxAsset(assetPath)`：替换、清空或切换模式时删除旧资源。

配置只保存 Host 返回的 `assets/` 包内相对 `assetPath`。不要保存绝对路径、`file://`、`blob:`、`data:`、`http://`、Host 临时 `resourceUrl`、凭证或 `sessionId`。

## 资源路径规则

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
