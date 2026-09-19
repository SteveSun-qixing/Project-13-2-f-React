# 会话记录：cosmic-cactus

- 会话 ID：ses_022eb8cd3ffeUGoa6SFf5dyf39
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-08 00:35:32

---

## 2026-08-08 00:35:32

处理 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-EditingEngine 的**基建与运行时部分**（antd 迁移）。不做 Git 提交。注意：另有 2 个子代理同时处理该仓库的 components 文件（你**不要**碰 src/components/、src/layouts/ 下的组件文件，它们由别人负责）；你负责的文件域见下。

## 必须先读（通读后再动手）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/04-组件映射对照表.md（重点第 11 节 v2）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/05-非UI系统适配方案.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/06-多语言系统移除规范.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/07-主题系统移除规范.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/08-应用插件重构标准.md

## 参考样板
/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-PhotoViewer（AppRoot/AppRuntimeProvider/messages.ts 模式）。

## 共享层 @chips/ui（已建好，/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-Ui）
导出：appleTheme、ChipsProvider/useChips、CommandProvider/useCommandRegistry/useCommandShortcuts、CommandItem{id,title,shortcut?,icon?,group?,menuId?,toolbarId?,enabled?,visible?,keywords?,run}、AppChrome{appName,menus,toolbarItems,toolbarExtra,paletteShortcut,children,footer,contentStyle}、MenuBar、Toolbar、CommandPalette、StateBoundary、PanelHeader、EmbeddedDocumentFrame。全局样式 @chips/ui/global.css。

## 你的文件域（只改这些，禁止碰 src/components/ 与 src/layouts/ 下的组件）
1. package.json：deps 加 antd 6.5.4、@ant-design/icons 6.3.2、dayjs 1.11.21、@chips/ui 0.1.0；移除 @chips/component-library；npm install
2. manifest.yaml：permissions 移除 theme.read、i18n.read
3. src/app/：AppRoot.tsx 样板化（ConfigProvider(zhCN, appleTheme) + App + ChipsProvider + CommandProvider + AppRuntimeProvider + AppShell）；AppShell 用 AppChrome + 菜单/工具栏（若 AppShell 引用 components，保持引用路径不变）；AppProviders.tsx 归档（移入该仓库 归档/，禁止 rm）
4. src/runtime/：AppRuntimeProvider.tsx 移除组件库/i18n/theme（useChips 或本地简化，业务逻辑保留）；environment-client.ts 移除组件库类型（无引用则归档）；theme-runtime.ts 归档；chips-client.ts、launch-context.ts 原样保留
5. src/commands/：EditingEngineCommandProvider.tsx、editing-engine-commands.ts 命令本地化（.tsx、CommandItem、useCommandRegistry 注册；逐条迁移 id/标题/快捷键/分组/执行逻辑）
6. src/icons/RuntimeIcon.tsx：ChipsIcon→@ant-design/icons（保持导出的图标名称/接口不变，供 components 使用）
7. src/lib/messages.ts：中文文案表（key→中文 + formatMessage 插值），覆盖 src/i18n/ 全部文案
8. src/i18n/：归档
9. src/basecard-runtime/theme-css.ts 及 src 下各 .css 中的 --chips-sys-* 变量：改为固定苹果风格色值（背景 #f5f5f7、表面 #ffffff、文本 #1d1d1f、主色 #0a84ff、边框 rgba(0,0,0,0.08) 等；CSS 文件只改变量值部分，不动布局）
10. 注意：不要运行 npm test/build 全量（components 部分尚在改造中会报错）；只运行 npx tsc --noEmit 确认你的文件域类型正确（若 components 报错属正常，等待其他子代理；你只保证你的文件无错）

## 红线
- 核心逻辑（core/、services/、editor-runtime/ 非 UI 部分）不动；window.chips.* / chips-sdk 调用链不变
- 禁止 import @chips/component-library（含类型）；禁止 shim；禁止 any；禁止 TODO/占位/简化
- 禁止删除文件（移动 归档/）

## 汇报（最终消息必须包含）
- 改动/归档文件清单
- npx tsc --noEmit 中你文件域的结论
- 遗留疑问（若有）
