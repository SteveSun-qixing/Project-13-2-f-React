# 瀑布流布局插件

通过 `chipsdev-r create layout` 初始化，并基于正式箱子布局插件契约实现的瀑布流布局。

## 工程定位

- 插件 ID：`chips.layout.masonry.blp`
- 布局类型：`chips.layout.masonry.blp`
- 显示名称：`瀑布流布局插件`
- 入口产物：`dist/index.mjs`

## 目录说明

- `src/view/`：查看态页面挂载与运行时
- `src/editor/`：布局参数编辑与预览
- `src/schema/`：默认配置、归一和校验
- `src/shared/`：共享类型
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 schema
- `tests/`：单元测试

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

## 布局行为

- 查看态按条目封面比例和摘要高度估算视觉高度，使用最短列算法把条目分配到多列。
- 空箱子时展示瀑布流形态骨架空态：3 列错落卡片轮廓（`LayoutSkeleton` + `SkeletonBlock`/`SkeletonLine` + `EmptyHint`），上传条目后切换为真实瀑布流网格。
- 列宽模式支持 `compact`、`auto`、`wide`，不暴露固定列数输入。
- 条目间距支持紧凑、常规、舒展。
- 标题可显示在封面下方、覆盖在封面上或隐藏。
- 摘要可单独开启或关闭。
- 分页数量限制在 `20..240`。
- 背景区和顶部标题区沿用正式 Frame Region 资源桥。

## 运行时边界

- 首屏使用 Host 注入的 `initialView`。
- 后续分页通过 `runtime.listEntries`。
- 条目封面通过 `runtime.renderEntryCover(entryId)`。
- 点击封面或标题只调用 `runtime.openEntry(entryId)`。
- 背景与顶部区域图片通过 `runtime.readBoxAsset(assetPath)` 读取。
- 配置只保存 `assets/` 相对路径，不保存临时 URL、绝对路径或凭证。

## 配置字段

- `sortMode`: `manual | name-asc | name-desc`
- `columnMode`: `auto | compact | wide`
- `gap`: `compact | regular | spacious`
- `titleMode`: `below-cover | overlay | hidden`
- `showSummary`: `boolean`
- `pageSize`: `20..240`
- `background` / `topRegion`: `none | image | html`

## 正式导出

入口文件 `src/index.ts` 导出：

- `layoutDefinition`
- `createDefaultLayoutConfig`
- `normalizeLayoutConfig`
- `validateLayoutConfig`

## 常用命令

```bash
npm run build
npm run test
npm run lint
npm run typecheck
npm run validate
npm run verify
```
