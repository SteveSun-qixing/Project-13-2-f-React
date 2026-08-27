# 会话记录：misty-cactus

- 会话 ID：ses_01da695c0ffeF6Sqa13sM1Y6H4
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 01:08:58

---

## 2026-08-09 01:08:58

整合 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BookReader 批次 1 的 8 个子代理成果到中枢（ReaderShell 等）。不做 Git 提交。

## 背景
批次 1 已完成以下独立模块（均通过各自 tsc）：
- S1 进度恢复：src/hooks/useReadingPosition.ts（{savedPosition, track, flush, restore, clear}）、src/components/ReadingRestoreBanner.tsx、AppRuntimeProvider 已暴露 readingPosition/restoreHint/restartFromBeginning 并渲染横幅
- S2 翻页动画：engine（page-glow 事件、animateSlide、章节淡入、边界回弹、点击涟漪）已内置
- S3 chrome：ReaderChrome dock 文字标签/metaCard 折叠/全屏按钮（新 prop autoHideRemaining 预留）；ControlButton variant="dock"；FeedbackToast 图标
- S4 排版：book-reader.ts 新增 lineHeight/letterSpacing/textAlign/writingMode/fontFamily 扩展 + readium-css-manager 注入；PreferencesPanel 新增"排版"分组
- S5 主题：reader-palette.ts（system 支持/过渡/亮度换算 resolveBrightnessOverlayOpacity/clampBrightness/READER_THEME_TRANSITION_*）；useReaderSystemTheme；reader-shell.css 已追加 .book-reader-brightness 遮罩样式
- S6 进度条：ProgressBar 新增 props（bookmarks/sectionMarks/sectionWeights/onBookmarkClick/onPreviousSection/onNextSection/canPreviousSection/canNextSection），**onSeek 语义变为全书比例 0–1**
- S7 搜索：SearchPanel 新增 currentSectionIndex prop、useDebouncedValue hook（src/hooks/useDebouncedValue.ts）、匹配高亮、上一条/下一条
- S8 目录书签：NavigationTree 折叠/自动定位/搜索（expandAll prop）/sectionProgress；ContentsPanel sectionProgress 透传；BookmarkPanel excerpt 快捷卡

## 你的文件域（严格只改这些）
- src/components/ReaderShell.tsx（**中枢接线**，所有整合都在这里）
- src/utils/book-reader.ts：ReaderPreferences 增加 `brightness`（0.6–1.0 默认 1，clampBrightness 复用 S5 导出）；normalizeBackgroundTone 默认值改为 "system"
- src/components/PreferencesPanel.tsx：背景色调 Segmented 增加"跟随系统"选项（值 "system"，首位）；新增"亮度"滑块（0.6–1.0 step 0.05，实时预览，显示 %）
- src/commands/book-reader-commands.tsx 与 src/commands/useBookReaderCommands.ts：快捷键补充（N/P 上一章下一章、F 全屏、T 循环主题；保持现有命令模型）
- src/styles/reader-animation.css 尾部：章节切换横幅动画（居中毛玻璃胶囊 1.4s 淡入淡出）
- src/lib/messages.ts：**不要改**（新文案直写中文）

## 接线内容（全部在 ReaderShell 内完成）
1. **进度恢复**：使用 useAppRuntime() 的 readingPosition；savedPosition 出现时 mirror 现有 pendingBookmark 模式（ReaderShell.tsx:449-461 附近）实现恢复跳转（paginated 用 spreadIndex 否则 scrollFraction）；位置捕获：progress/currentAnchor 变化时 readingPosition.track(...)
2. **智能自动隐藏 chrome**：isChromeVisible 基础上加 idle 计时器（3.5s 无 pointermove/keydown 自动隐藏，翻页不重置）；ReaderChrome 传 autoHideRemaining（或简化为组件内 timer 由 ReaderShell state 驱动）；隐藏状态仍走 data-state 动画
3. **亮度遮罩**：ReaderShell 挂载 .book-reader-brightness 层，opacity = resolveBrightnessOverlayOpacity(preferences.brightness)；PreferencesPanel 亮度变化实时生效
4. **跟随系统**：PreferencesPanel 的"跟随系统"经 onUpdatePreferences 设置 backgroundTone="system"；AppRuntimeProvider 现有 resolveReaderThemePalette 调用点若为 2 参，接入 useReaderSystemTheme 的 isDark 作为第三参（或确认 S5 的缺省回退已覆盖——检查后决定，尽量小改）
5. **主题切换过渡**：resolvedTone 变化时给帧内 html/body 临时应用 READER_THEME_TRANSITION_CSS_TEXT（300ms 后移除）——若实现复杂可在 useReaderEngine 内做（该文件不在你文件域时，改用 ReaderShell effect 通过 controller 暴露的帧 document 操作；查看可用接口后选择最小实现）
6. **进度条接线**：ProgressBar 传 bookmarks（由 useBookmarks 映射为 {sectionIndex, scrollFraction, readingMode}）、sectionMarks（章节起始 fraction 数组，用现有 sectionWeights 换算累计）、sectionWeights、onBookmarkClick（跳书签，复用 handleOpenBookmark）、onPreviousSection/onNextSection（现有 onStepSection 封装）、canPreviousSection/canNextSection（现有 commandRuntimeState 值）；**onSeek 封装 seekToBookFraction**：fraction→按 weights 定位章节+章节内分数→同章用 controller 跳转（seekToFraction 封装）或跨章 onSelectSection
7. **搜索接线**：SearchPanel 传 currentSectionIndex；搜索 effect 改用 useDebouncedValue(searchQuery, 300)（把 ReaderShell 现有 searchQuery 的 effect 依赖改为 debounced 值）
8. **目录接线**：ContentsPanel 传 sectionProgress（章节起始百分比数组）
9. **书签摘录**：handleToggleBookmark 创建时从帧内（controller 或 frameDocument）取当前位置前后 ~40 字文本作为 excerpt（取不到则省略）；BookmarkPanel 自动消费
10. **章节切换横幅**：监听 currentSectionIndex 变化（非 pendingBoundary 触发的用户翻页之外）显示"章节名"横幅 1.4s（实现为 ReaderShell 内 state + 渲染，样式用 reader-animation.css 尾部新增类）
11. **快捷键**：N/P 章、F 全屏（document.requestFullscreen）、T 循环背景色调（theme→warm→mist→night→system）；在 commands 中注册（保持 CommandItem 模型）

## 红线
- 现有行为（点击翻页/手势/键盘/面板）不得回归；禁 any/TODO/占位/删文件；不 import @chips/component-library；新文案直写中文
- 不跑 npm install；npx tsc --noEmit 全仓必须 0 错误（这是本批硬性出口，批次 1 并行期遗留的瞬时错误应已消除，若有他人文件域报错需查因解决——允许在本文件域内修复其调用点）

## 验证
npx tsc --noEmit → 0 错误。不跑 npm test（B2 统一跑）。

## 汇报
接线清单（每项如何接入）、改动文件、tsc 结论、遗留疑问。
