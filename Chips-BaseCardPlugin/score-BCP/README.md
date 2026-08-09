# 评分基础卡片插件

评分基础卡片插件（`chips.basecard.score`）是薯片生态的新架构基础卡片插件，用于在复合卡片中展示和编辑评分数据。插件已迁移到 React 运行时，并接入 Ant Design 组件体系。

当前正式入口契约为：

- `renderBasecardView(ctx)`：供 Host 通用查看链路与编辑引擎单卡 iframe 复用；
- `renderBasecardEditor(ctx)`：供 Host 托管编辑器与编辑引擎本地编辑面板复用；
- `basecardDefinition`：供编辑引擎运行时注册表读取 `pluginId/cardType/aliases/collectResourcePaths` 与渲染能力。

插件身份：

- 插件 ID：`chips.basecard.score`
- 基础卡片类型：`base.score`
- 配置别名：`ScoreCard`
- 入口：`dist/index.mjs`

## 当前能力

- 查看态支持四种样式：
  - `stars`：五分制星星评分（antd `Rate` 只读展示）
  - `hearts`：五分制爱心评分（antd `Rate` + 爱心图标）
  - `score`：数字分数
  - `progress`：进度条（antd `Progress`，输出正式 `role="progressbar"` 语义）
- 星星与爱心样式固定五分制，未获得项为灰色，已获得项为彩色。
- 数字分数与进度条样式提供 `total_score` 和 `score` 两个输入字段（antd `InputNumber`，`role="spinbutton"`）。
- 五分制评分支持点击与方向键调节；进度样式输出正式 `role="progressbar"` 语义。
- 查看态不添加最外层描边、背景色或阴影，只渲染评分内容本身。
- 界面文案：
  - 简体中文直写（task030 后全生态统一），文案总表见 `src/lib/messages.ts`

## 配置模型

```yaml
card_type: "ScoreCard"
theme: ""
style: "stars"
score: 4
total_score: 5
locale: "zh-CN"
```

正式类型定义见 [src/schema/card-config.ts](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/src/schema/card-config.ts)，参数说明见 [templates/parameters.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/templates/parameters.md)。

## 目录结构

```text
score-BCP/
├─ manifest.yaml
├─ package.json
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

- React 运行时；UI 组件基于 Ant Design（`antd`），查看态与编辑面板入口统一套用共享层苹果主题 `appleTheme` 与中文配置（`@chips/ui` + `ConfigProvider locale={zhCN}`），视觉与文案规范遵循 `项目日志与笔记/task030-卸担计划/` 03 / 04 / 06 / 07 章。
- 卡片格式契约（`.card` 序列化字段、`basecardDefinition`）不依赖任何 UI 框架，保持独立；`locale` 字段作为卡片格式契约字段保留，界面文案统一简体中文，不再消费多语言系统。

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

- 需求规格：[docs/requirements/01-需求规格说明书.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/docs/requirements/01-需求规格说明书.md)
- 架构设计：[docs/technical/01-架构设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/docs/technical/01-架构设计.md)
- 数据模型：[docs/technical/02-数据模型设计.md](/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-BaseCardPlugin/score-BCP/docs/technical/02-数据模型设计.md)
