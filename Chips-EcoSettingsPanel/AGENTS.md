# Chips-EcoSettingsPanel AGENTS

## 角色

- 本项目是生态设置面板应用插件；负责应用插件、卡片/布局/模块插件的运行时治理，以及开发者工具链入口（task030 卸担计划后，主题/多语言治理已随废弃体系移除）。

## 开发规则

- 运行时治理能力只能通过 Host Bridge / `chips-sdk` 正式接口访问，不得直连 Host 内部模块。
- 插件治理的公共接口口径以 `生态共用技术文档/协议与接口标准/07-运行时设置治理接口标准.md` 为准。
- 界面文案简体中文直写（`src/lib/messages.ts` 中文文案表 + `formatMessage`）；视觉统一走 `@chips/ui` 的 `appleTheme` 与全局样式，对标 macOS System Settings 设计（见 `项目日志与笔记/task031-生态设置面板对标macOS重构/01-设计方案.md`）。
- 开发态与用户态工作区边界必须尊重 Host 正式治理，不要在前端自行混用或拼接两套状态。
- 如果治理接口、组件或 SDK 能力存在缺口，先登记工单，再在规则中标明已知边界。

## 验证

- 优先运行 `npm run verify`（lint + typecheck + test + build + validate）。
