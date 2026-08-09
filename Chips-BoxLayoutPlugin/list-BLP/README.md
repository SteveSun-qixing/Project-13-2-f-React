# 列表布局插件

通过 `chips-scaffold-boxlayout` 生成的标准布局插件工程。

## 工程定位

- 插件 ID：`chips.layout.list`
- 布局类型：`chips.layout.list`
- 显示名称：`列表布局插件`

## 布局行为

- 查看态以等高列表行展示箱子条目；
- 每行左侧渲染正式条目封面；
- 每行右侧显示条目名称，并可按配置展示创建日期、摘要、标签和类型；
- 支持行密度、封面尺寸、排序、分组、分页数量、背景区域和顶部标题区域；
- 查看态通过 `initialView` 首屏渲染，并按需调用 `runtime.listEntries` 加载后续页；
- 条目封面只通过 `runtime.renderEntryCover` 获取，点击或键盘 Enter 激活时只调用 `runtime.openEntry`；
- 支持键盘上下导航、Home/End、Space 多选、批量选择和清除选择；
- 空态、错误态、表单、选择、复选框、分段控件和分页按钮使用 Ant Design 组件。
- 界面文案统一为简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）。

## 布局配置

`contracts/layout-config.schema.json` 与 `src/schema/layout-config.ts` 共同定义正式配置：

- `sortMode`: `manual | name-asc | name-desc`
- `rowDensity`: `compact | comfortable | spacious`
- `coverSize`: `compact | regular | large`
- `visibleFields`: `createdAt | summary | tags | type`
- `groupMode`: `none | type | tag`
- `pageSize`: `20..240`
- `background` / `topRegion`: `none | image | html`

布局自有图片资源只保存 `assets/` 相对路径，并同步到 `assetRefs`。

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

## 正式导出

入口文件 `src/index.ts` 导出：

- `layoutDefinition`
- 布局运行时、条目、配置等共享类型

其中：

- `layoutDefinition.icon` 是运行时正式图标描述符；
- `assets/icons/layout-icon.svg` 只作为静态资源保留，来源说明见 `assets/icons/SOURCE.md`。

## 常用命令

```bash
npm run lint
npm test
npm run build
npm run validate
```
