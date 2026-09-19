# 任务005：Host L9 布局计算与性能基线

## 1. 任务目标

补齐 L9 对布局语义的计算和性能指标，使统一布局系统可以被质量门禁验证。

## 2. 对应阶段任务

- `05-开发任务方案/任务03-Host-L9统一渲染产品化与诊断.md`
- `05-开发任务方案/任务07-统一布局系统与页面结构原语.md`

## 3. 涉及项目

- `Chips-Host/packages/unified-rendering/src/layout-compute.ts`
- `Chips-Host/scripts/benchmark-unified-rendering.ts`

## 4. 开发内容

1. 支持 Stack/Grid/Form/List/Section/ScrollView/Table/Navigation。
2. 输出布局约束和响应式语义。
3. 记录节点数、布局耗时、提交耗时。
4. 更新 strict 性能阈值。

## 5. 验收标准

- L9 布局计算覆盖新布局原语。
- 性能脚本可检测退化。
- 不在 L9 写视觉样式。

## 6. 验证命令

```bash
cd Chips-Host
npm run build
npm test
npm run test:perf:l9
```

