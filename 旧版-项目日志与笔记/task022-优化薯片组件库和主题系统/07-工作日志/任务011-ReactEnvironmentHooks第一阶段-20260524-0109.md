# 任务011：React Environment Hooks 第一阶段

时间：2026-05-24 01:09:22 CST (+0800)

## 本阶段目标

按任务011先交付 React 应用默认消费入口的基础层：

- `ChipsEnvironmentProvider`
- `useChipsEnvironment`
- `useChipsClient`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsSurface`
- `useChipsPermission`
- `useChipsCommand`
- `useChipsDiagnostics`

本阶段只处理组件库 hooks、聚合导出、mock 测试辅助和公共使用文档，不迁移应用脚手架，不处理主题包任务。

## 主要改动

1. `@chips/hooks`
   - 新增 `ChipsEnvironmentProvider` 与 `useChips*` hooks。
   - Provider 通过注入的 SDK client 或同形 mock client 读取 theme、i18n、surface、command 与 control-plane diagnostics。
   - hooks 不直接依赖 Host 内部包，也不直接引入 `chips-sdk`，保持 React 层与 SDK core 解耦。

2. `@chips/testing`
   - 新增 `createMockChipsClient()`。
   - 新增 `createMockChipsEnvironment()`。
   - 支持 theme/i18n/surface/command/controlPlane 相关 mock 行为与事件。

3. 聚合入口与类型
   - `@chips/component-library` 聚合入口自然导出新增 hooks。
   - 类型烟测补充 `ChipsEnvironmentProvider`、`ChipsClientLike`、`ChipsEnvironmentValue` 与 `useChips*` hooks。

4. 公共文档
   - `Bridge三层设计` 补充 L7 React hooks 正式入口。
   - `组件库对外使用总览` 增加 React Environment Hooks 使用边界。
   - `SDK使用指南` 明确 SDK client 注入组件库 Provider 的推荐用法。

## 验证

已完成阶段性验证：

- `cd Chips-ComponentLibrary && npm test`：通过，173 个测试。
- `cd Chips-ComponentLibrary && npm run test:types`：通过。
- `cd Chips-ComponentLibrary && npm run verify`：通过。
- `cd Chips-SDK && npm test`：通过。

## 结论

任务011的 React Environment 基础入口已具备。下一阶段应迁移应用脚手架默认模板，使用官方 Provider/hooks 替代本地 `useChipsBridge` 与手写 theme/i18n/surface 接线。
