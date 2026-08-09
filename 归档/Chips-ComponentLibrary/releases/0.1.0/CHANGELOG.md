# 0.1.0 变更说明

## 本版本范围

- 完成阶段一到阶段九核心能力闭环。
- 完成阶段十一卡片显示 iframe 高级组件落地（组件侧实现、契约、测试、文档）。
- 新增阶段九质量门禁聚合入口与结构化报告产物。

## 关键新增

- 组件清单扩展至 Base-Interactive、Data-Form、Workbench、System-UX。
- 新增 `CardCoverFrame` 与 `CompositeCardWindow` 组件。
- 新增 `npm run quality:gate` 门禁链路。
- 新增阶段九故障注入与性能基线报告。

## 兼容性影响

- 不包含破坏性 API 变更。
- 适用于首发项目直接接入，不包含历史组件迁移要求。

## 验证基线

- `219 token keys / 32 contracts / 151 tests`。
- `quality-gate` 全步骤通过。
