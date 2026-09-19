# 工单102：Theme Runtime 系统层同层 token 引用解析缺口

## 背景

在任务026.04 提交前运行 Host 全量集成测试时，模块契约相关用例已通过，但主题相关用例被默认主题 token 解析错误阻断。

## 问题

默认主题中 `chips.sys.icon.color-accent` 引用 `{chips.sys.color.primary}`，`chips.sys.icon.color-danger` 引用 `{chips.sys.color.danger}`。原 Theme Runtime 在解析 `sys` 层时只允许查找 `ref` 层，无法解析同层语义 token 引用，导致 `THEME_TOKEN_MISSING`。

## 修复

- 将 Theme Runtime token 引用解析升级为按层递归解析；
- 每层允许引用本层 token；
- 跨层依赖保持 `ref -> sys -> motion/layout -> comp` 的单向顺序；
- 引用缺失时抛出 `THEME_TOKEN_MISSING`；
- 循环引用时抛出 `THEME_TOKEN_CYCLE`；
- 补充 sys 同层引用解析与循环引用阻断单元测试；
- 同步共享主题包开发指南、主题接口错误码和 Host 内部实现说明。

## 验证

- `cd Chips-Host && npx vitest run tests/unit/theme-runtime.test.ts`：通过，7 项通过。
- `cd Chips-Host && npx vitest run tests/integration/host-services.test.ts tests/contract/route-manifest.contract.test.ts`：通过，36 项通过。
- `cd Chips-Host && npm test`：通过，35 个测试文件、214 项测试通过。

## 状态

已解决。
