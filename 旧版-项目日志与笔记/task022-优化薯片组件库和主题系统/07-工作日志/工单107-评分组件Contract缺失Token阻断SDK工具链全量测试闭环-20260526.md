# 工单107：评分组件 Contract 缺失 Token 阻断 SDK 工具链全量测试闭环

## 日期

2026-05-26

## 本次处理目标

确认评分组件 contract 与 token 缺口已经完成修复，并从组件库正式质量门禁与 SDK `chipsdev component gallery --json` 工具链入口验证工单107闭环。

## 已确认结果

- 评分组件 required token 已补齐到组件库 token 源与默认主题包 token。
- 组件库 rating contract 已纳入正式 component contract，`chipsdev component gallery` 不再报告评分组件缺失 token。
- 组件库单测新增覆盖已纳入正式 `npm run verify`。

## 验证记录

- `cd Chips-ComponentLibrary && npm run verify`
  - `validate:tokens`：通过，802 个 token key。
  - `build:tokens`：通过，802 个 token key。
  - `validate:contracts`：通过，71 个 contract。
  - `test:types`：通过。
  - `test`：通过，253 条单测全绿。
- `CHIPS_ECOSYSTEM_ROOT=<worktree> node Chips-SDK/cli/index.js component gallery --json`
  - `summary.status = "passed"`。
  - `summary.componentCount = 71`。
  - `summary.missingRequiredTokenCount = 0`。
  - `rating.status = "passed"`。
  - `rating.missingRequiredTokens = []`。
- `CHIPS_ECOSYSTEM_ROOT=<worktree> node Chips-SDK/cli/index.js quality gate --json`
  - `summary.status = "warning"`。
  - `summary.failedCheckCount = 0`。
  - `summary.warningCheckCount = 2`。
  - Warning 来源为根工作区 `chips.config.mjs` 与 `manifest.yaml` 项目配置检查，不是评分组件 contract/token 缺口。
- `cd Chips-SDK && npm test`
  - Vitest：7 个测试文件、78 条测试通过。
  - CLI smoke、host-managed、create app/card/layout/module/theme、module invoke、package compatibility、tooling command tests 全部通过。
  - 原始失败点 `run-cli-tooling-tests.cjs` 已恢复通过。

## 状态

工单107已从组件库质量门禁、SDK component gallery、SDK quality gate 可解释输出和 SDK 全量测试角度闭环。
