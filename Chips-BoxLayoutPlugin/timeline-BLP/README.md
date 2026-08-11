# 时间线布局插件

时间线布局插件用于把箱子条目绑定到可编辑的时间点，并以横向或竖向时间轴浏览。工程已通过生态布局插件脚手架初始化：

```bash
chipsdev-r create layout <targetDir>
```

## 工程定位

- 插件 ID：`chips.layout.timeline.blp`
- 布局类型：`chips.layout.timeline.blp`
- 显示名称：`时间线布局插件`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 目录说明

- `src/view/`：查看态页面挂载与运行时
- `src/editor/`：布局参数编辑、箱子自有资源导入和预览
- `src/schema/`：默认配置、归一、校验和 `assetRefs` 同步
- `src/shared/`：共享类型与视图辅助函数
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 JSON Schema
- `tests/`：schema、查看态和编辑态单元测试
- `assets/icons/`：静态布局图标资源与来源说明

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

生成工程不直接读取磁盘、网络或 `.box` 文件内容。Host 是唯一运行时承载，查看器和编辑器通过 Host/SDK 正式链路装载布局文档。

## 正式导出

入口文件 `src/index.ts` 导出 `layoutDefinition`，包含：

- `createDefaultConfig`
- `normalizeConfig`
- `validateConfig`
- `getInitialQuery`
- `renderView`
- `renderEditor`

`layoutDefinition.icon` 使用正式 `IconDescriptor`。构建产物由 `chipsdev-r build` 生成到 `dist/index.mjs`，打包产物由 `chipsdev-r package` 生成 `.cpk`。

## 布局能力

时间线布局支持以下配置：

- `orientation`：`vertical` 或 `horizontal`，控制时间线方向。
- `scaleMode`：`equal-points` 或 `date-distance`，控制时间点等距排列或按可解析日期距离排列。
- `showCovers`：控制查看态是否为条目显示正式封面。
- `cardDensity`：`compact`、`comfortable`、`spacious`，控制条目卡片密度。
- `points`：时间点列表，每个时间点包含 `id`、`label`、可选 `date`、可选 `note` 与绑定的 `entryIds`。
- `background` / `topRegion`：复用受控区域配置，支持 `none`、`image`、`html`。背景区保持固定 `16:9` 比例；顶部区域无固定比例与最小高度限制，图片模式按图片自然宽高比显示并撑满容器宽度、背景透明，HTML 模式按 iframe 实际内容高度显示，上限为容器宽度 3 倍。

未绑定到任何时间点的启用条目会在查看态归入“未安排条目”，避免因为配置未完成而丢失可见内容。

## 查看态运行时

查看态从 Host 注入的 `initialView` 首屏摘要开始渲染。后续分页通过 `runtime.listEntries({ cursor, limit })` 拉取，不自行解析 `.box/structure.yaml`。

条目封面显示优先调用 `runtime.renderEntryCover(entryId)`，并用 `@chips/ui` 的 `EmbeddedDocumentFrame` 承载 Host 返回的正式文档入口。点击封面或标题只调用 `runtime.openEntry(entryId)`，打开窗口和外部跳转由 Host 决定。

布局自有背景和顶部区域资源通过 `runtime.readBoxAsset(assetPath)` 读取。`resourceUrl` 只用于当前会话预览或渲染，不写入布局配置。

查看态还会对即将使用的条目调用 `runtime.prefetchEntries({ entryIds, targets: ["cover"] })`，并在分页、封面和箱子资源失败时显示中文错误状态。

## 编辑器与资源桥

编辑器基于 Ant Design 构建表单与操作控件，所有可见文案来自 `src/lib/messages.ts` 中文文案映射（`formatMessage(key, params)` 统一插值）。

布局配置编辑通过 `onChange(next)` 输出完整归一后的配置快照。编辑器可新增、删除、重命名时间点，维护日期、说明，并把未安排条目绑定到指定时间点。编辑器不直接写 `.box/content.yaml`、`.box/structure.yaml`、`assets/` 或文件系统。

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
    orientation: "vertical",
    scaleMode: "equal-points",
    showCovers: true,
    cardDensity: "comfortable",
    points: [
      {
        id: "phase-1",
        label: "第一阶段",
        date: "2026-07-06",
        note: "项目启动",
        entryIds: ["entry-1", "entry-2"]
      }
    ],
    background: {
      mode: "image",
      assetPath: "assets/layouts/chips.layout.timeline.blp/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>...</section>"
    }
  },
  assetRefs: [
    "assets/layouts/chips.layout.timeline.blp/background/hero.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case：

```yaml
layout_configs:
  chips.layout.timeline.blp:
    schema_version: "1.0.0"
    props:
      orientation: "vertical"
      scale_mode: "equal-points"
      show_covers: true
      card_density: "comfortable"
      points:
        - id: "phase-1"
          label: "第一阶段"
          date: "2026-07-06"
          note: "项目启动"
          entry_ids:
            - "entry-1"
            - "entry-2"
      background:
        mode: "image"
        asset_path: "assets/layouts/chips.layout.timeline.blp/background/hero.webp"
    asset_refs:
      - "assets/layouts/chips.layout.timeline.blp/background/hero.webp"
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
