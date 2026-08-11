# 扑克牌布局插件

薯片生态箱子布局插件，基于 `chipsdev-r create layout` 脚手架实现。

## 工程定位

- 插件 ID：`chips.layout.cardstack.blp`
- 布局类型：`chips.layout.cardstack.blp`
- 显示名称：`扑克牌布局插件`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 功能说明

扑克牌布局把箱子条目展示成一叠错位旋转的卡片。查看态只让当前顶层卡片加载真实封面、标题和摘要；下层卡片只渲染少量占位层，并且只对后续一两张条目调用 `runtime.prefetchEntries` 做温和预取。

空箱子时使用共享层 `LayoutSkeleton` / `SkeletonBlock` / `SkeletonLine` / `EmptyHint` 渲染卡堆形态骨架（居中堆叠三张卡片轮廓 + 空态提示），一眼看出本布局的形态；上传卡片后布局结构不变。

交互方式：

- 点击当前卡片：调用 `runtime.openEntry(entryId)`；
- 按钮：上一张 / 下一张；
- 键盘：方向键切换上一张或下一张；
- 滚轮：向上 / 向下切换；
- 拖拽：横向拖过阈值后切换上一张或下一张；
- 末尾行为：根据 `reviewLoop` 停止或循环。

封面必须通过 `runtime.renderEntryCover(entryId)` 获取，并用 `EmbeddedDocumentFrame` 承载 Host 返回的正式封面入口。布局插件不直接解析卡片、箱子或文件系统。

## 配置

插件运行时对象使用 camelCase：

```ts
{
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    randomSeed: "chips-cardstack",
    stackDepth: 4,
    cardSize: "regular",
    spreadRotationDeg: 5,
    swipeThreshold: 120,
    reviewLoop: "stop-at-end",
    background: {
      mode: "image",
      assetPath: "assets/layouts/chips.layout.cardstack.blp/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>...</section>"
    }
  },
  assetRefs: [
    "assets/layouts/chips.layout.cardstack.blp/background/hero.webp"
  ]
}
```

字段说明：

- `sortMode`：`manual`、`name` 或 `random`；
- `randomSeed`：稳定随机顺序种子；
- `stackDepth`：下层占位堆叠层数，范围 2-8；
- `cardSize`：`compact`、`regular` 或 `large`；
- `spreadRotationDeg`：下层错位旋转幅度，范围 0-12；
- `swipeThreshold`：拖拽切换阈值，范围 80-260；
- `reviewLoop`：`stop-at-end` 或 `loop`；
- `background` / `topRegion`：受控 iframe 区域配置；
- `assetRefs`：由配置中的安全 `assets/` 相对路径同步生成。

`.box/content.yaml` 的正式存储字段使用 snake_case，camelCase 与 snake_case 的转换由 Host/SDK/编辑引擎正式链路负责。布局插件只消费 Host 注入的运行时对象，不直接写 YAML。

## 编辑器与资源桥

编辑器通过 antd 表单控件（Select、Segmented、InputNumber、Input.TextArea 等）组织配置，所有界面文案为简体中文直写，统一维护在 `src/lib/messages.ts`。

布局配置编辑通过 `onChange(next)` 输出完整归一后的配置快照。编辑器不直接写 `.box/content.yaml`、`.box/structure.yaml`、`assets/` 或文件系统。

箱子自有资源只通过 Host 注入的 asset bridge 管理：

- `importBoxAsset({ file, preferredPath })`：导入背景或顶部区域图片；
- `readBoxAsset(assetPath)`：读取 Host 受控资源 URL 用于预览；
- `deleteBoxAsset(assetPath)`：替换、清空或切换模式时删除旧资源。

配置只保存 Host 返回的 `assets/` 包内相对 `assetPath`。不要保存绝对路径、`file://`、`blob:`、`data:`、`http://`、Host 临时 `resourceUrl`、凭证或 `sessionId`。

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

`npm run verify` 会依次执行 lint、typecheck、test、build、validate 和 package。正式联调路径是先生成 `.cpk`，再通过开发工作区安装并启用插件，由箱子查看器或编辑器通过 Host/SDK 打开 `.box`。
