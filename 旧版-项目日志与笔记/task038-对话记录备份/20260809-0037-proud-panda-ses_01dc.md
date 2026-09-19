# 会话记录：proud-panda

- 会话 ID：ses_01dc34372ffeE0JOrST6Ahp0UL
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:37:39

---

## 2026-08-09 00:37:39

在 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-EditingEngine 收敛 useTranslation 双写模式（task031 润物计划 P1-3）。不做 Git 提交。

## 背景
多语言系统已废弃（task030），`src/hooks/useTranslation.ts` 已是 `formatMessage` 的中文包装。但 8 个组件仍在使用它，且大量调用是 `t('key') || '中文兜底'` 双写模式（key 查不到时兜底），可读性差、维护两份文案。

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/编辑引擎优化/编辑引擎前端优化检查报告.md（P1-3）
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/生态共用技术文档/前端基础/04-简体中文文案规范.md

## 你的文件域（只改这些 .tsx/.ts；**禁止碰 .css、禁止碰共享层、禁止碰 src/lib/messages.ts**——messages 死 key 收尾统一处理）
`src/layouts/Workbench/Workbench.tsx`、`src/components/Dock/Dock.tsx`、`src/components/HistoryPanel/HistoryPanel.tsx`、`src/components/EditPanel/EditPanel.tsx`、`src/components/BaseWindow/BaseWindow.tsx`、`src/components/BaseWindow/ToolWindow.tsx`、`src/components/BoxWindow/BoxWindow.tsx`

## 做法（两种方案按文件选择，保持行为等价）
**方案 A（推荐，改动最小）**：保留 `useTranslation()` 调用，但把 `t('key') || '中文兜底'` 双写收敛为直接使用 `formatMessage` 或直接中文常量：
- 对每个调用点：确认 `src/lib/messages.ts` 中该 key 存在且文案正确 → 直接替换为 `formatMessage('key')`（若文件仍想保留 t 签名）或直接写中文（若参数插值简单）
- 若 key 在 messages 中**不存在**（纯兜底）→ 直接写中文常量
- 目标：消除 `|| '中文'` 双写；一个文件内要么统一用 formatMessage、要么统一中文直写，不混用
**方案 B**：移除 useTranslation 依赖，全部中文直写（若文件调用点少、无参数插值）

注意：这些文件刚被其他任务动过（Dock 加了空态），以当前文件内容为准；`t('key', { params })` 插值调用用 `formatMessage('key', params)` 等价替换。

## 红线
- 界面文案语义不变（与 messages.ts 中文一致）；事件副作用不变
- 禁止 any；禁止删除文件；禁止改 messages.ts
- 若某个 key 缺失导致 formatMessage 返回 key 本身（`[[key]]` 不存在场景），直接写中文

## 验证（在仓库目录执行）
1. npx tsc --noEmit → 仅剩既有工单132 错误
2. npm test → 全绿（HistoryPanel/Dock/BaseWindow/BoxWindow 相关测试若断言文案，与 messages 中文一致则不受影响）
3. rg -n "t\('[^']*'\) \|\|" src --glob '*.tsx' → 零命中（你文件域内）

## 汇报（最终消息必须包含）
- 改动文件清单（每文件采用方案 A 还是 B）
- 验证输出摘要
- 遗留疑问（若有）
