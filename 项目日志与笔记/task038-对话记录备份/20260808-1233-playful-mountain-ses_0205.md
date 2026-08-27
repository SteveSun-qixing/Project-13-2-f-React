# 会话记录：playful-mountain

- 会话 ID：ses_0205a9591ffelY8mNXwusCsn1t
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-08 12:33:07

---

## 2026-08-08 12:33:07

续作薯片生态脚手架模板的 antd 化（app-standard 模板已完成，你处理 basecard 与 boxlayout）。不做 Git 提交。

## 背景
task030 卸担计划：废弃 @chips/component-library，改用 antd v6 + @chips/ui + 简体中文直写。`Chips-Scaffold/chips-scaffold-app/templates/app-standard/` 已完成 antd 化（参照它的完成形态）。`chips-scaffold-basecard` 与 `chips-scaffold-boxlayout` 模板仍是旧体系，需要同步。

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/04-组件映射对照表.md（重点第 11 节 v2、第 12 节 image-BCP/grid-BLP 样板实证、第 8 节 ChipsForm 做法 A）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/09-基础卡片与布局插件重构标准.md

## 样板（已迁移完成的实际 BCP/BLP，参照其最终形态）
- BCP：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BaseCardPlugin/image-BCP（package.json/src/editor/panel.tsx/src/render/view.tsx/src/lib/messages.ts）
- BLP：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BoxLayoutPlugin/grid-BLP（package.json/src/editor/*/src/view/*/src/shared/frame-region.tsx/src/lib/messages.ts）
- 共享层：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-Ui（appleTheme、EmbeddedDocumentFrame{title,src,srcDoc,ratio,scope,surfaceId,sandbox,onActivate,onFrameReady,onFrameError} 等）

## 你的文件域
### 1. `Chips-Scaffold/chips-scaffold-basecard/templates/card-standard/`
- package.json.tpl：依赖改 antd 6.5.4、@ant-design/icons 6.3.2、dayjs 1.11.21、@chips/ui 0.1.0；移除 @chips/component-library
- src/editor/panel.tsx.tpl：ChipsForm→受控 State 做法 A（原生 form + antd 控件：Input/InputNumber/Segmented/Switch/Select/Button 等）；ConfigProvider(locale zhCN, theme appleTheme) 包裹；参照 image-BCP 最终形态
- src/render/view.tsx.tpl：ChipsImage→antd Image、ChipsText→Typography 等；渲染 DOM 语义保持
- src/shared/i18n.ts.tpl：删除，改 src/lib/messages.ts.tpl（中文文案表 + formatMessage）
- README.md.tpl：技术栈同步
- template.json 文件清单同步；对应 template-engine.test.ts 断言同步

### 2. `Chips-Scaffold/chips-scaffold-boxlayout/templates/boxlayout-standard/`
- package.json.tpl：同上依赖更新
- src/editor/panel.tsx.tpl、src/editor/frame-region-editor.tsx.tpl：ChipsForm→做法 A、antd 控件、ConfigProvider 包裹；参照 grid-BLP 最终形态
- src/view/page.tsx.tpl：EmbeddedDocumentFrame 改从 @chips/ui import；ChipsButton→Button
- src/shared/frame-region.tsx.tpl（若存在）：EmbeddedDocumentFrame 改 @chips/ui
- src/shared/i18n.ts.tpl：删除，改 src/lib/messages.ts.tpl
- README.md.tpl、template.json、template-engine.test.ts 同步

### 3. `Chips-Scaffold/chips-scaffold-module/`
- 检查是否有前端样板引用组件库；若有同步，若模块无 UI 则跳过（modules 是纯逻辑模块）

## 红线
- 模板占位符语法（{{variable}} 等）保持，不得破坏模板引擎
- 禁止删除文件（移动归档）；禁止 any；禁止 TODO/占位
- 只改 Chips-Scaffold 范围内文件；不碰 chips-scaffold-theme（已归档）

## 验证
1. 各脚手架目录 npm test（template-engine.test.ts 同步后全绿）
2. 残留扫描：rg "@chips/component-library" Chips-Scaffold/*/templates/ 零命中（归档除外）
3. node /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/scripts/verify-ecosystem-workspace.mjs → 通过

## 汇报（最终消息必须包含）
- 改动/归档文件清单
- 验证输出摘要
- 遗留疑问（若有）
