# 网格布局插件

通过 `chips-scaffold-boxlayout` 生成的标准布局插件工程。

## 工程定位

- 插件 ID：`chips.layout.grid`
- 布局类型：`chips.layout.grid`
- 显示名称：`网格布局插件`

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
- 空状态：`LayoutSkeleton` + 网格形态骨架原子（`SkeletonBlock` / `SkeletonLine`）+ `EmptyHint`，空箱子时以 3×2 卡片轮廓占位
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）

## 正式导出

入口文件 `src/index.ts` 导出：

- `layoutDefinition`
- `createDefaultLayoutConfig`
- `normalizeLayoutConfig`
- `validateLayoutConfig`

其中：

- `layoutDefinition.icon` 是运行时正式图标描述符；
- `assets/icons/layout-icon.svg/.png/.ico/.icns` 是插件静态身份图标四件套，来源与渲染链路说明见 `assets/icons/SOURCE.md`。

## 顶部区域与背景区域行为

- **顶部内容区（topRegion）**：无固定比例与高度限制；图片模式按图片自然宽高比显示、宽度始终撑满容器、背景透明；HTML 模式按内容实际高度显示（autoHeight），上限为容器宽度的 3 倍（maxHeightFactor=3）；
- **背景区域（background）**：固定比例 16:9、cover 覆盖显示，保持不变；
- 两类区域资源均通过 `runtime.readBoxAsset(assetPath)` 读取（箱子自有资源，路径以 `assets/` 相对路径表示）；
- 约束：顶部区域 srcdoc 内嵌脚本受布局文档 CSP 限制，见 `生态共用技术文档/插件开发/04-布局插件开发.md`「布局文档 CSP 与 srcdoc 内嵌脚本」一节。

## 常用命令

```bash
npm run build
npm run test
npm run lint
npm run validate
```
