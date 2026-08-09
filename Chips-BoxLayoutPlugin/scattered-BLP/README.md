# 散乱布局插件

薯片生态箱子布局插件，用于把箱子条目展示为同一平面上的随机卡片堆。下层假卡片只使用固定苹果风格色值派生的纯色占位，不请求真实封面；当前顶层条目通过 Host `runtime.renderEntryCover(entryId)` 显示正式封面，并通过 `runtime.openEntry(entryId)` 打开。

## 工程定位

- 插件 ID：`chips.layout.scattered.blp`
- 布局类型：`chips.layout.scattered.blp`
- 显示名称：`散乱布局插件`
- 入口产物：`dist/index.mjs`
- 图标描述符：`scatter_plot`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 目录说明

- `src/view/`：查看态页面挂载与散乱平面交互
- `src/editor/`：布局参数编辑、箱子自有资源导入和预览
- `src/schema/`：默认配置、归一、校验和 `assetRefs` 同步
- `src/shared/`：共享类型、帧区域辅助函数和稳定随机散落算法
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 JSON Schema
- `tests/`：schema、查看态和编辑态单元测试
- `assets/icons/`：静态布局图标资源与来源说明

生成工程不直接读取磁盘、网络或 `.box` 文件内容。Host 是唯一运行时承载，查看器和编辑器通过 Host/SDK 正式链路装载布局文档。

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

## 查看态运行时

查看态从 Host 注入的 `initialView` 首屏摘要开始渲染。布局只为顶层真实条目调用 `runtime.renderEntryCover(entryId)`；假卡片根据 `entryId + randomSeed` 计算位置、旋转和纯色，不读取条目封面、预览或文件资源。

交互方式：

- 鼠标滚轮切换顶层条目；
- 左右/上下方向键切换顶层条目；
- 上一张、下一张按钮切换顶层条目；
- 顶层封面或标题点击时调用 `runtime.openEntry(entryId)`；
- `motion: "auto"` 时按 `cycleIntervalMs` 自动轮播，并尊重系统减少动态设置；
- `motion: "reduced"` 时不自动轮播。

当切换到已加载条目的末尾附近且 Host 返回了 `nextCursor` 时，布局通过 `runtime.listEntries({ cursor, limit })` 按需补充后续摘要。对当前和后续少量顶层候选条目，布局使用 `runtime.prefetchEntries({ targets: ["cover"] })` 做温和预取。

背景和顶部内容区通过 `runtime.readBoxAsset(assetPath)` 读取箱子自有资源，图片和 HTML 都通过 `@chips/ui` 的 `EmbeddedDocumentFrame` 受控文档区域显示。`resourceUrl` 只用于当前会话渲染，不写入布局配置。

## 编辑器与资源桥

编辑器通过 antd 控件组织配置项，所有可见文案来自 `src/lib/messages.ts`。

支持的布局参数：

- `sortMode`：`manual`、`name`、`random`
- `randomSeed`：稳定随机顺序与散落位置的种子
- `visibleFakeCount`：下层纯色假卡片数量，范围 `0..18`
- `cycleIntervalMs`：自动切换间隔，范围 `3000..60000`
- `cardSize`：`compact`、`regular`、`large`
- `spread`：`calm`、`loose`、`wild`
- `motion`：`auto`、`reduced`
- `background`：背景区 FrameRegion
- `topRegion`：顶部内容区 FrameRegion

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
    sortMode: "random",
    randomSeed: "inspiration-box",
    visibleFakeCount: 9,
    cycleIntervalMs: 8000,
    cardSize: "regular",
    spread: "loose",
    motion: "auto",
    background: {
      mode: "image",
      assetPath: "assets/layouts/chips.layout.scattered.blp/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>...</section>"
    }
  },
  assetRefs: [
    "assets/layouts/chips.layout.scattered.blp/background/hero.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case：

```yaml
layout_configs:
  chips.layout.scattered.blp:
    schema_version: "1.0.0"
    props:
      sort_mode: "random"
      random_seed: "inspiration-box"
      visible_fake_count: 9
      cycle_interval_ms: 8000
      card_size: "regular"
      spread: "loose"
      motion: "auto"
      background:
        mode: "image"
        asset_path: "assets/layouts/chips.layout.scattered.blp/background/hero.webp"
    asset_refs:
      - "assets/layouts/chips.layout.scattered.blp/background/hero.webp"
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
