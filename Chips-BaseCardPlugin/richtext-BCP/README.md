# 富文本基础卡片插件

## 简介

`chips.basecard.richtext` 是薯片生态的富文本基础卡片插件，当前正式版本采用：

- `Milkdown` 作为编辑内核；
- 文本选区触发的图标悬浮工具框作为核心编辑交互；
- 编辑区右键菜单承载块级操作；
- Markdown 作为唯一正式内容格式；
- `<= 200` 字内容保存在 `content/*.yaml`；
- `> 200` 字内容保存为卡片根目录 `.md` 文件，并在内容配置中保存引用。

当前正式 Markdown 渲染栈已覆盖：

- CommonMark / GFM 基础能力
- 删除线、表格、任务列表
- 高亮 `==text==`
- 下划线 `++text++`
- 上标 `^text^`
- 下标 `~text~`
- 数学公式 `remark-math + KaTeX`

当前工程把所有 `@milkdown/*` 依赖固定到同一精确版本，避免多版本上下文切裂导致编辑器或查看态初始化失败。

- 界面文案：简体中文直写（task030 后全生态统一），文案总表见 `src/lib/messages.ts`
- 图标：悬浮工具框与右键菜单统一使用 `@ant-design/icons`，antd 无对应物时使用等宽文本字形（`H1`/`H2`/`H3`、`¶`、`❝`）
- 视觉：固定为生态统一苹果风格（固定色值 + 共享层 `appleTheme`），不消费已废弃的主题系统变量

## 正式导出

插件入口 `src/index.ts` 导出：

- `renderBasecardView(ctx)`
- `renderBasecardEditor(ctx)`
- `basecardDefinition`

其中：

- `basecardDefinition.cardType = "base.richtext"` 与 `manifest.yaml -> capabilities.cardTypes` 保持一致；
- `basecardDefinition.aliases = ["RichTextCard"]` 仅负责输入归一中的历史类型别名；
- `basecardDefinition.createInitialConfig()` 默认生成 Markdown inline 配置；
- `basecardDefinition.icon` 是运行时正式图标描述符；
- `assets/icons/basecard-icon.svg` 只作为静态资源保留，来源说明见 `assets/icons/SOURCE.md`。

## 配置结构

当前正式配置模型位于 `src/schema/card-config.ts`：

- `card_type: "base.richtext"`
- `theme?: string`
- `locale?: string`
- `content_format: "markdown"`
- `content_source: "inline" | "file"`
- `content_text?: string`
- `content_file?: string`
- `markdown_capabilities`：显式声明 CommonMark、GFM、数学公式、高亮、下划线、上标和下标能力。

## 开发命令

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/richtext-BCP
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

## 文档

- 需求文档：`docs/requirements/01-需求规格说明书.md`
- 技术文档：`docs/technical/01-架构设计.md`
- 数据模型：`docs/technical/02-数据模型设计.md`
- 开发计划：`docs/development/00-开发计划总览.md`
- 旧版 HTML 方案归档：`归档/20260324-富文本基础卡片旧版HTML方案`
