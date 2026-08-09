# System-UX Stage8 组件规范

## 1. 范围

本规范覆盖阶段八新增组件：

- `ChipsErrorBoundary`
- `ChipsLoadingBoundary`
- `ChipsNotification`
- `ChipsToast`
- `ChipsEmptyState`
- `ChipsSkeleton`

统一状态优先级：

`disabled > loading > error > active > focus > hover > idle`

统一契约字段：

- `data-scope`
- `data-part`
- `data-state`
- `aria-*`

## 2. 组件规范

### 2.1 ChipsErrorBoundary

- `data-scope="error-boundary"`
- `data-part="root|title|description|action|status"`
- 核心能力：
  - 渲染错误捕获与错误收敛
  - 重试回调与边界重建
  - 统一错误输出（`toStandardError`）
  - 观测记录输出（`traceId/component/action/errorCode`）

### 2.2 ChipsLoadingBoundary

- `data-scope="loading-boundary"`
- `data-part="root|content|fallback|status"`
- 核心能力：
  - 延迟显示加载占位（避免闪烁）
  - 骨架屏默认回退（内置 `ChipsSkeleton`）
  - 支持 `configSource` 覆盖 `delayMs/skeletonLines`

### 2.3 ChipsNotification

- `data-scope="notification"`
- `data-part="root|list|item|title|message|action|close|status"`
- 核心能力：
  - 受控/非受控消息队列
  - 自动超时移除与手动关闭
  - `maxVisible/defaultDurationMs` 配置化
  - 关闭与动作事件回调

### 2.4 ChipsToast

- `data-scope="toast"`
- `data-part="root|list|item|message|action|close|status"`
- 核心能力：
  - 轻量提醒栈（`maxStack`）
  - 自动消失与手动关闭
  - 多位置投放（`placement`）
  - 与 Notification 共享统一观测字段模型

### 2.5 ChipsEmptyState

- `data-scope="empty-state"`
- `data-part="root|icon|title|description|action|status"`
- 核心能力：
  - 空态展示（图标、标题、描述）
  - 可选主行动作入口
  - i18n key + fallback 模式

### 2.6 ChipsSkeleton

- `data-scope="skeleton"`
- `data-part="root|item|status"`
- 核心能力：
  - 多行占位条渲染
  - `shape/animated/lines` 参数控制
  - 用于 LoadingBoundary 默认回退

## 3. i18n 与配置对接

- i18n 文案解析统一通过 `resolveI18nText`
  - 支持 `i18n` 函数或 `i18n.translate` 适配器
  - 缺失 key 触发 `SYSTEM_UX_I18N_KEY_FALLBACK`
- 配置解析统一通过 `resolveConfigValue`
  - 支持函数式、`get(key)`、对象路径三种配置源
  - 配置缺失触发 `SYSTEM_UX_CONFIG_FALLBACK`

## 4. 观测字段标准

统一通过 `createObservationRecord` 输出：

- `traceId`
- `component`
- `action`
- `errorCode`
- `durationMs`

## 5. Token 与契约映射

新增 token 前缀：

- `chips.comp.error-boundary.*`
- `chips.comp.loading-boundary.*`
- `chips.comp.notification.*`
- `chips.comp.toast.*`
- `chips.comp.empty-state.*`
- `chips.comp.skeleton.*`

新增契约文件：

- `packages/theme-contracts/contracts/components/error-boundary.contract.json`
- `packages/theme-contracts/contracts/components/loading-boundary.contract.json`
- `packages/theme-contracts/contracts/components/notification.contract.json`
- `packages/theme-contracts/contracts/components/toast.contract.json`
- `packages/theme-contracts/contracts/components/empty-state.contract.json`
- `packages/theme-contracts/contracts/components/skeleton.contract.json`

## 6. 验证结果（2026-03-05）

- token 校验通过：`219 keys`
- 主题契约校验通过：`32 contracts`
- 阶段八收官测试通过：`128 tests`（截至 2026-03-05 阶段九扩展后为 `151 tests`）
- 门禁命令：`npm run verify` 全量通过
