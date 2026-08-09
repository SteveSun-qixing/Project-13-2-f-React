# 唱片布局插件

`coverFlow-BLP` 是薯片生态箱子的 Cover Flow 唱片布局插件。它把箱子条目封面组织成横向队列，中央封面放大，两侧封面通过 CSS transform 呈现斜侧面效果。

## 工程定位

- 插件 ID：`chips.layout.coverflow.blp`
- 布局类型：`chips.layout.coverflow.blp`
- 显示名称：`唱片布局插件`
- 入口产物：`dist/index.mjs`

`manifest.yaml` 的 `layout.layoutType`、`layoutDefinition.layoutType`、箱子 `metadata.active_layout_type` 与 `.box/content.yaml` 的 `layout_configs` 键必须保持一致。

## 目录说明

- `src/view/`：查看态页面挂载与运行时
- `src/editor/`：布局参数编辑与预览
- `src/schema/`：默认配置、归一和校验
- `src/shared/`：共享类型与视图辅助函数
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 schema
- `tests/`：单元测试

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

## 查看态能力

查看态从 Host 注入的 `initialView.items` 首屏摘要开始渲染。真实封面只对中央附近条目调用 `runtime.renderEntryCover(entryId)`，远端条目使用轻量占位，避免一次性解析全量封面。

卡片名称由正式封面统一显示，布局不额外渲染重复标题。封面尺寸、横向间距和舞台高度同时跟随布局容器的宽高响应式变化；布局根节点锁定在宿主可视区域内，不产生页面滚动条。

交互方式：

- 鼠标滚轮或触控板横向/纵向滑动切换焦点；
- 左右方向键切换焦点；
- Enter 打开当前中央条目；
- 点击非中央封面只切换焦点；
- 点击中央封面调用 `runtime.openEntry(entryId)`。

布局自有背景和顶部内容区通过 `runtime.readBoxAsset(assetPath)` 读取。插件不直接读取 `.box`、文件系统、网络或 Host 临时路径。

## 编辑态能力

编辑器通过组件库表单控件输出完整归一化配置快照，宿主负责持久化和自动保存。支持参数：

- `sortMode`：`manual`、`name-asc`、`name-desc`
- `coverSize`：`compact`、`regular`、`large`
- `sideAngleDeg`：15 到 75
- `centerScale`：1 到 1.5
- `spacing`：`tight`、`regular`、`wide`
- `showReflection`：是否显示封面倒影
- `wheelSensitivity`：`low`、`medium`、`high`
- `background`：背景区 iframe 资源
- `topRegion`：顶部内容区 iframe 资源

背景区和顶部内容区图片只通过 Host 注入的 asset bridge 管理：

- `importBoxAsset({ file, preferredPath })`
- `readBoxAsset(assetPath)`
- `deleteBoxAsset(assetPath)`

配置只保存 `assets/` 包内相对路径，并同步到 `assetRefs`。禁止保存绝对路径、`file://`、`blob:`、`data:`、网络 URL、凭证、会话 ID 或 Host 临时 `resourceUrl`。

## 配置示例

插件运行时对象使用 camelCase：

```ts
{
  schemaVersion: "1.0.0",
  props: {
    sortMode: "manual",
    coverSize: "regular",
    sideAngleDeg: 58,
    centerScale: 1.18,
    spacing: "regular",
    showReflection: true,
    wheelSensitivity: "medium",
    background: {
      mode: "image",
      assetPath: "assets/layouts/chips.layout.coverflow.blp/background/hero.webp"
    },
    topRegion: {
      mode: "html",
      html: "<section>唱片合集</section>"
    }
  },
  assetRefs: [
    "assets/layouts/chips.layout.coverflow.blp/background/hero.webp"
  ]
}
```

`.box/content.yaml` 的正式存储字段使用 snake_case，camelCase 与 snake_case 的转换由 Host/SDK/编辑引擎正式链路负责。

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

`npm run verify` 会依次执行 lint、typecheck、test、build、validate 和 package。正式联调路径是生成 `.cpk` 后通过开发工作区安装并启用插件，由箱子查看器或编辑器通过 Host/SDK 打开 `.box`。
