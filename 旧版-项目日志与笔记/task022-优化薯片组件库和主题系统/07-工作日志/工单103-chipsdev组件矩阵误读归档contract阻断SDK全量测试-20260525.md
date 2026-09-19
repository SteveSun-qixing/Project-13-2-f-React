# 工单103：chipsdev 组件矩阵误读归档 contract 阻断 SDK 全量测试

## 背景

在任务026.04 提交前运行 `Chips-SDK npm test` 时，测试已通过 SDK Vitest、CLI smoke、Host 管理命令、脚手架 E2E、module invoke 和 package compatibility，但最后的 tooling 命令测试失败。

## 问题

`chipsdev component gallery --json` 把 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/归档/` 下的历史归档 contract 纳入正式组件矩阵，导致 `form-field`、`form-group` 等归档组件的 12 个 required token 被误判缺失，`summary.status` 变为 `failed`。

## 修复

- `Chips-SDK/src/tooling/developer-tools.cjs` 的组件 contract 扫描跳过 `归档` 与 `archive` 目录；
- 保留默认跳过目录集合，继续避开 `node_modules/dist/build` 等非正式扫描目录；
- `Chips-SDK/tests/run-cli-tooling-tests.cjs` 补充断言，确保 component gallery 不再包含归档 contract。

## 验证

- `cd Chips-SDK && node tests/run-cli-tooling-tests.cjs`：通过。
- 直接生成 `createComponentGalleryReport`：`status=passed`、`componentCount=70`、`missingRequiredTokenCount=0`、归档 contract 数为 0。
- `cd Chips-SDK && npm test`：通过，SDK Vitest 75 项通过，全部 CLI 集成测试通过。

## 状态

已解决。
