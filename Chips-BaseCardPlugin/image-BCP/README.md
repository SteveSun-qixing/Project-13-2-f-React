# 图片基础卡片插件

图片基础卡片插件（`chips.basecard.image`）是薯片生态的新架构基础卡片插件，用于在复合卡片中展示和编辑图片内容。插件已迁移到 React 运行时，并正式接入卡片根目录资源链路。

当前正式入口契约为：

- `renderBasecardView(ctx)`：供 Host 通用查看链路与编辑引擎单卡 iframe 复用；
- `renderBasecardEditor(ctx)`：供 Host 托管编辑器与编辑引擎本地编辑面板复用；
- `basecardDefinition`：供编辑引擎运行时注册表读取 `pluginId/cardType/aliases/collectResourcePaths` 与渲染能力。
- 运行时图标统一使用 `basecardDefinition.icon`；
- `assets/icons/basecard-icon.svg` 只作为静态资源保留，来源说明见 `assets/icons/SOURCE.md`。

## 当前能力

- 查看态支持四种正式布局：
  - `single`
  - `grid`
  - `long-scroll`
  - `horizontal-scroll`
- 当图片数量小于等于 1 时，渲染态自动使用单图布局。
- 编辑态支持：
  - 本地图片导入
  - TIFF 图片通过宿主 `convertTiffToPng(...)` 转换为 PNG 后写入正式配置
  - 外部 URL 添加
  - 3 列无限缩略图列表
  - 缩略图表面不显示名称和操作按钮
  - 占位插入式拖拽排序
  - 鼠标旁显示浮动缩略图拖拽预览
  - 拖拽到底部固定删除区删除图片
  - 末尾灰色加号卡片展开底部添加区域
  - 选中图片后编辑标题与替代文本
  - 选中图片后通过本地文件或外部 URL 替换当前图片
  - 清空全部
  - 撤销 / 重做
  - 单图 / 多图分场景布局配置
  - 无顶部固定工具栏的分区式编辑面板
  - 面向右侧窄编辑面板的响应式布局优化
  - 图片列表区就地继续添加图片
  - 图片资源解析失败后的自动重试恢复
- 界面文案：
  - 简体中文直写（task030 后全生态统一），文案总表见 `src/lib/messages.ts`

## 资源规则

- `source = "file"` 的资源路径统一记录为相对于卡片根目录的路径，例如 `cover.png`、`gallery-shot.webp`。
- 插件不会把图片写入 `content/`、`images/` 等子目录，也不会把 `blob:`、`data:`、系统绝对路径写回配置。
- 编辑态所有本地文件导入、预览解析、资源释放、资源删除都通过宿主资源桥完成：
  - `importResource(...)`
  - `convertTiffToPng(...)`
  - `resolveResourceUrl(...)`
  - `releaseResourceUrl(...)`
  - `deleteResource(...)`
- TIFF 导入链路先把源文件作为卡片根目录资源导入，再请求宿主转换为 PNG；正式配置只保存最终 PNG 相对路径，源 TIFF 不进入 `images[*].file_path`。
- 插件本身不设置图片数量上限和图片大小上限。

## 配置模型

```yaml
card_type: "ImageCard"
theme: ""
images:
  - id: "img-cover"
    source: "file"
    file_path: "cover.png"
    alt: "封面图"
    title: "封面"
  - id: "img-remote"
    source: "url"
    url: "https://example.com/banner.webp"
    alt: "远程横幅"
    title: "Banner"
layout_type: "grid"
layout_options:
  grid_mode: "3x3"
  single_width_percent: 100
  single_alignment: "center"
  spacing_mode: "comfortable"
```

正式类型定义见 [src/schema/card-config.ts](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/image-BCP/src/schema/card-config.ts)。

## 目录结构

```text
image-BCP/
├─ src/
│  ├─ index.ts
│  ├─ lib/
│  │  └─ messages.ts
│  ├─ editor/
│  │  ├─ panel.tsx
│  │  └─ runtime.ts
│  ├─ render/
│  │  ├─ view.tsx
│  │  └─ runtime.ts
│  ├─ schema/
│  │  └─ card-config.ts
│  └─ shared/
│     └─ utils.ts
├─ 归档/
├─ templates/
├─ docs/
└─ tests/
```

## 技术栈

- React 运行时；UI 组件基于 Ant Design（`antd`），编辑器面板入口统一套用共享层苹果主题 `appleTheme`（`@chips/ui`），视觉与文案规范遵循 `项目日志与笔记/task030-卸担计划/` 03 / 04 / 06 / 07 章。
- 卡片格式契约（`.card` 序列化字段、`basecardDefinition`、Host 资源桥链路）不依赖任何 UI 框架，保持独立。

## 开发与验证

在插件目录执行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

如果需要本地开发服务：

```bash
npm run dev
```

## 相关文档

- 需求规格：[docs/requirements/01-需求规格说明书.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/image-BCP/docs/requirements/01-需求规格说明书.md)
- 架构设计：[docs/technical/01-架构设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/image-BCP/docs/technical/01-架构设计.md)
- 数据模型：[docs/technical/02-数据模型设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/image-BCP/docs/technical/02-数据模型设计.md)
- 开发计划：[docs/development/00-开发计划总览.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/image-BCP/docs/development/00-开发计划总览.md)
