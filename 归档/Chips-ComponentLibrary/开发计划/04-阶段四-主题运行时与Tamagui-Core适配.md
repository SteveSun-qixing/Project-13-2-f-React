# 阶段四：主题运行时与 Tamagui-Core 适配

## 阶段目标

打通主题token消费链路，完成作用域解析、回退机制、Tamagui Core适配与主题切换最小化更新。

## 开发范围

- `packages/adapters/tamagui-core`
- 主题解析工具与Provider
- 主题事件联动

## 开发任务

### 1. 解析器实现

- 实现权重链解析器（高权重优先，缺失逐层向上）。
- 实现逐key解析，不做整包覆盖。
- 实现默认主题回退与错误码返回。

### 2. Tamagui Core适配

- 将Style Dictionary产物映射为Tamagui可消费token对象。
- 输出`TokenResolver`接口与实现。
- 建立`useToken/useComponentTokens` hooks。

### 3. 主题Provider与事件

- 实现`ChipsThemeProvider`。
- 订阅`theme.changed`并进行变量级刷新。
- 保证主题切换不重建组件结构。

### 4. 性能与稳定性

- 主题缓存键：`themeId + version`。
- 大范围变更采用分片注入。
- 记录解析日志与故障诊断信息。

## 阶段产物

- 主题解析引擎与适配层代码。
- 主题切换演示与回退测试。
- 主题链路契约测试。

## 退出条件

- 主题解析结果与文档口径一致。
- token缺失、主题失败场景可回退且可观测。

## 执行进展（2026-03-04）

已完成：

- `createScopedTokenResolver` 作用域解析器已落地，解析顺序与主题规范一致。
- `resolveScopedTokenValue` 与 `createThemeCacheKey` 已落地。
- hooks 已补齐 `ChipsThemeProvider/useToken/useComponentTokens/useThemeRuntime`。
- `theme.changed` 订阅工具与变量注入工具（`subscribeThemeChanged/applyThemeVariables`）已落地。
- 分片变量注入能力 `applyThemeVariablesInBatches` 已落地。
- 解析与注入诊断能力已落地（fallback/missing/chunk 诊断事件）。
- 主题切换回退测试与主题链路契约测试已补齐。
- 相关单元测试已补齐并通过，`npm run verify` 全量通过。

状态判定：

- 阶段四功能开发与测试已完成。
- 跨阶段统一工具链收口仍跟随工单 `工单004-ECOSYS-TOOLCHAIN-TS-LINT-SD-PRESET`（阶段二/三阻断项）。
