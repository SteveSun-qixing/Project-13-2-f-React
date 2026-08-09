# 阶段八：System-UX 与跨层集成闭环

## 阶段目标

完善系统级用户体验组件，并完成组件库与Theme Runtime、i18n、config、插件宿主环境的集成闭环。

## 组件范围

- ErrorBoundary
- LoadingBoundary
- Notification
- Toast
- EmptyState
- Skeleton

## 开发任务

### 1. System UX组件实现

- 错误边界组件支持错误收敛、重试入口、日志上报hook。
- 加载边界支持骨架屏与延迟策略。
- 通知组件支持层级队列和可访问播报。

### 2. 跨层集成

- 与主题系统联动：状态视觉与token一致。
- 与i18n联动：文案不硬编码，可动态切换语言。
- 与config联动：组件行为阈值可配置化。

### 3. 错误与观测

- 统一错误对象输出。
- 关键组件埋点字段标准化（traceId/component/action/errorCode）。

### 4. 失败回退

- 主题失败回退默认主题。
- 配置读取失败回退默认配置。
- i18n缺失key回退默认文案模板。

## 阶段产物

- System UX组件代码与文档。
- 集成示例与回归用例。
- 观测字段说明。

## 退出条件

- System UX组件可用于全生态基础场景。
- 跨层联动行为一致且可观测。

## 执行进展（2026-03-05）

已完成（System-UX 全量组件）：

- `ErrorBoundary/LoadingBoundary/Notification/Toast/EmptyState/Skeleton` 已落地：
  - 统一状态优先级裁决
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与可访问播报
  - i18n/config 适配入口与缺失回退
  - 观测字段输出工具（`traceId/component/action/errorCode/durationMs`）
- 工具函数已落地：
  - `toStandardError`
  - `resolveI18nText`
  - `resolveConfigValue`
  - `createObservationRecord`
- 组件 token 与主题契约已落地：
  - `chips.comp.error-boundary.*`
  - `chips.comp.loading-boundary.*`
  - `chips.comp.notification.*`
  - `chips.comp.toast.*`
  - `chips.comp.empty-state.*`
  - `chips.comp.skeleton.*`
- 文档已补齐：
  - `技术文档/24-System-UX-Stage8组件规范.md`
  - `技术文档/25-阶段八跨层集成与回退策略.md`
  - `技术文档/26-阶段八集成示例与回归记录.md`
- 校验结果：
  - `npm run verify` 全量通过（`219 token keys / 32 contracts / 128 tests`，阶段八收官口径；截至 2026-03-05 阶段九扩展后为 `151 tests`）

阶段结论：

- 阶段八在组件库侧已完成闭环，可进入阶段九质量体系扩展。
