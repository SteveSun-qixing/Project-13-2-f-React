# 会话记录：clever-cactus

- 会话 ID：ses_022f17e4bffeFRfzqe9laDGLMJ
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-08 00:29:03

---

## 2026-08-08 00:29:03

继续完成 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BookReader 的 antd 迁移（此前一次执行被中断，部分工作已完成）。不做 Git 提交。

## 先检查现状（重要）
该仓库上一次迁移已做到：
- package.json 已更新（antd 6.5.4/@ant-design/icons 6.3.2/dayjs 1.11.21/@chips/ui 0.1.0 已加）
- 归档目录已有：src-i18n、src-app-providers、src-environment-client、src-theme-runtime、i18n、旧全局样式
- src/ 下仍有 app/ commands/ components/ 等目录
先运行 `rg -l "@chips/component-library|@chips/a11y" src tests`、`npx tsc --noEmit`、`npm test` 评估哪些已完成、哪些还缺，然后完成剩余部分。

## 目标
将 Chips-BookReader 完全迁移到 antd + @chips/ui，功能等价还原。

## 必须先读（通读后再动手）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/04-组件映射对照表.md（重点第 11 节 v2、第 8 节）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/05-非UI系统适配方案.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/06-多语言系统移除规范.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/07-主题系统移除规范.md
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task030-卸担计划/08-应用插件重构标准.md

## 参考样板（已完成试点）
/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-PhotoViewer
重点：src/app/AppRoot.tsx、src/app/AppShell.tsx、src/app/AppRuntimeProvider.tsx、src/commands/photo-viewer-commands.tsx、src/commands/usePhotoViewerCommands.ts、src/lib/messages.ts。

## 共享层 @chips/ui（已建好，/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-Ui）
导出：appleTheme、ChipsProvider/useChips、CommandProvider/useCommandRegistry/useCommandShortcuts、CommandItem{id,title,shortcut?,icon?,group?,menuId?,toolbarId?,enabled?,visible?,keywords?,run}、AppChrome{appName,menus,toolbarItems,toolbarExtra,paletteShortcut,children,footer,contentStyle}、MenuBar、Toolbar、CommandPalette、StateBoundary、PanelHeader、EmbeddedDocumentFrame。全局样式 @chips/ui/global.css。

## 需处理的剩余部分（用 rg 全量排查）
- src/i18n/useBookReaderText.ts（若未归档则删除/归档，调用点改中文直写）
- src/commands/book-reader-commands.ts、src/commands/useBookReaderCommands.ts（命令本地化：.tsx、CommandItem、useCommandRegistry 注册）
- src/components/ControlButton.tsx、ReaderShell.tsx 等（UI 换 antd：ChipsToolbar/ChipsMenuBar/ChipsCommandPalette/ChipsCommandProvider 用 AppChrome/MenuBar/Toolbar；ChipsIcon→@ant-design/icons）
- src/app/AppRoot.tsx（确认样板：ConfigProvider(zhCN, appleTheme) + App + ChipsProvider + CommandProvider + AppRuntimeProvider + AppShell）
- src/app/AppShell.tsx（AppChrome + 菜单/工具栏）
- src/lib/messages.ts 中文表（若未建则建）
- manifest.yaml（permissions 移除 theme.read、i18n.read）
- 测试（tests/unit/reader-shell.test.tsx、reader-a11y.test.tsx 等同步更新）
- 阅读器偏好（字号/背景/主题色）是业务功能：实现从 --chips-sys-* 改为应用内偏好状态/固定色值

## 红线
- 阅读器渲染、翻页、目录/书签/搜索逻辑不变；业务逻辑、事件副作用、loading/error/empty/disabled 分支、快捷键不变
- window.chips.* / chips-sdk 调用链不变（runtime/chips-client.ts、launch-context.ts 保留）
- 禁止 import @chips/component-library（含类型）；禁止复制共享层代码；禁止 shim；禁止 any；禁止 TODO/占位/简化
- 禁止删除文件（移动 归档/）；CSP 保持现状

## 验证（全部通过才算完成，在仓库目录执行）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿
3. npm run build → 成功
4. npm run validate → ok
5. 残留扫描（src tests 零命中，归档除外）：
   rg "@chips/component-library|@chips/a11y|chips-sys|data-chips-theme|ChipsThemeProvider|useChipsTheme|theme-runtime|useChipsI18n|localeBundles|createChipsI18nText|TODO|FIXME" src tests

## 汇报（最终消息必须包含）
- 本次续作完成的改动清单
- 各验证命令输出摘要
- 遗留疑问（若有，明确写出）
<!-- OMO_INTERNAL_INITIATOR -->
