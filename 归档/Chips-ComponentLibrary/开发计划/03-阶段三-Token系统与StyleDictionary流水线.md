# 阶段三：Token系统与StyleDictionary流水线

## 阶段目标

实现token五层模型、Style Dictionary构建流水线、token类型导出、完整性校验与差异报告。

## 开发范围

- `packages/tokens`
- token schema与校验器
- CSS/JSON/TS产物

## 开发任务

### 1. Token源定义

- 建立五层token源：`ref/sys/comp/motion/layout`。
- 统一key命名：`chips.<layer>.<domain>.<key>`。
- 为P0组件准备完整`comp`层token。

### 2. Style Dictionary配置

- 配置输入源聚合与分层构建。
- 输出`variables.css`、`tokens.json`、`token-keys.d.ts`。
- 输出token引用展开后的稳定产物。

### 3. 校验与门禁

- schema校验（类型、格式、缺项）。
- 引用链校验（禁止循环引用）。
- 冗余key与冲突key校验。
- 构建失败直接阻断。

### 4. 差异治理

- 生成token变更diff报告。
- 对破坏性变更给出映射建议。

## 阶段产物

- 可重复执行的token构建流水线。
- token类型定义供组件与主题消费。
- token质量报告。

## 退出条件

- P0组件所需token完整可用。
- 产物稳定可被`adapters/tamagui-core`直接消费。

## 执行进展（2026-03-04）

已完成：

- 五层 token 源已落地：`ref/sys/comp/motion/layout`。
- `comp` 层已覆盖本阶段组件：`card-cover-frame`、`composite-card-window`。
- 构建脚本已输出四类产物：`css/variables.css`、`json/tokens.json`、`ts/token-keys.d.ts`、`report/token-diff.md`。
- 校验脚本已覆盖必需前缀检查、引用链解析、循环引用阻断、主题契约 token 覆盖检查。
- 已新增 `token-utils` 测试，覆盖引用展开、循环引用报错、token key 声明生成。

待继续推进：

- 与生态统一的 Style Dictionary 生产流水线做最终配置对齐（保持现有产物路径与命名稳定）。当前阶段已将 `packages/tokens` 的构建与校验脚本（`build-tokens.mjs/validate-tokens.mjs`）确认为首版“生态级 Style Dictionary 预设”，并通过 `工单004-ECOSYS-TOOLCHAIN-TS-LINT-SD-PRESET` 完成收口；后续如需抽离为独立工具链包，将在不改变现有产物口径的前提下增量演进。
