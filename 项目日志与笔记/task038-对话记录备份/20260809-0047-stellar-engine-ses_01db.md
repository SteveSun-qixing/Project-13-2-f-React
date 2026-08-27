# 会话记录：stellar-engine

- 会话 ID：ses_01dba396effeaSKB4rIl3vEpNk
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:47:31

---

## 2026-08-09 00:47:31

在 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-EditingEngine 做 React.memo 性能优化（task031 润物计划 P4-11）。不做 Git 提交。

## 背景
编辑引擎工作台含多窗口（卡片窗口/箱子窗口/工具窗口），任何 context 状态变化（focusWindow/selection）都会重渲大量子树；当前全仓 React.memo 零使用。

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/编辑引擎优化/编辑引擎前端优化检查报告.md（P4-11）
- 注意：行为与视觉刚被其他任务改动（Dock 有空态、色板已统一），以当前文件内容为准；**只做渲染性能优化，不改变任何行为、样式与文案**

## 你的文件域（只改这些 .tsx；**禁止碰 .css、共享层、src/lib/messages.ts**）
- src/components/BaseWindow/BaseWindow.tsx、ToolWindow.tsx（窗口壳 memo）
- src/components/CardWindow/CardWindow.tsx、src/components/BoxWindow/BoxWindow.tsx（窗口容器 memo，props 含函数回调时用 useCallback 稳定）
- src/components/Dock/Dock.tsx（高频 hover/交互组件）
- src/layouts/Workbench/MainArea.tsx、SidePanel.tsx（工作台布局）

## 做法
- 对上述组件加 `React.memo`（默认浅比较）；其 props 中由父级传入的匿名函数改为 `useCallback`（在父级或组件内稳定化），内联对象改为 `useMemo`/常量
- **注意**：这些组件从 context（useUI/useEditor/useCard 等）取值的部分不受 memo 影响（context 变化仍会重渲），memo 只隔离 props 传递；不要在组件内把 context 消费拆到子组件（避免过度工程）
- 优先优化收益最大的：窗口容器（CardWindow/BoxWindow/ToolWindow）与 Dock
- 保持渲染结果完全一致（快照语义不变）

## 红线
- 行为、样式、文案、快捷键零变化；测试必须全绿
- 禁止 any；禁止删除文件；禁止改共享层
- 若某组件 memo 化后测试失败（如依赖每次重渲的 ref/实例），回退该组件并在汇报说明

## 验证（在仓库目录执行）
1. npx tsc --noEmit → 仅剩既有工单132 错误
2. npm test → 全绿（44 文件 169 用例基线）
3. npm run build → 成功

## 汇报（最终消息必须包含）
- memo/useCallback 化文件清单与关键点
- 验证输出摘要
- 遗留疑问（若有）
