# 任务016：组件库复杂组件 Compound 迁移

## 1. 任务目标

把复杂组件迁移为 Compound API，减少 boolean props 膨胀。

## 2. 对应阶段任务

- `05-开发任务方案/任务09-复杂组件Compound-API与样式契约.md`

## 3. 涉及项目

- `Chips-ComponentLibrary/packages/components`
- `Chips-Host/src/renderer/declarative-ui`

## 4. 开发内容

1. Dialog compound。
2. Popover compound。
3. Tabs compound。
4. Menu compound。
5. Select compound。
6. Form compound。
7. DataGrid compound。
8. Tree compound。
9. CommandPalette compound。
10. NavigationSplitView compound。

## 4.1 子工单拆分

任务016涉及 10 个复杂组件与 Host L8 slot 校验，按能力边界拆成以下子工单。父任务编号保持不变，子工单按顺序推进；每个子工单必须做到运行时 API、类型、contract、测试、文档与日志闭环，不留下半套 Compound API。

1. [任务016.01-DialogPopoverTabsCompound迁移.md](./任务016.01-DialogPopoverTabsCompound迁移.md)
2. [任务016.02-MenuSelectCompound迁移.md](./任务016.02-MenuSelectCompound迁移.md)
3. [任务016.03-FormCompound迁移.md](./任务016.03-FormCompound迁移.md)
4. [任务016.04-DataGridCompound迁移.md](./任务016.04-DataGridCompound迁移.md)
5. [任务016.05-TreeCompound迁移.md](./任务016.05-TreeCompound迁移.md)
6. [任务016.06-CommandPaletteCompound迁移.md](./任务016.06-CommandPaletteCompound迁移.md)
7. [任务016.07-NavigationSplitViewCompound迁移.md](./任务016.07-NavigationSplitViewCompound迁移.md)
8. [任务016.08-全量契约一致性与质量门禁收口.md](./任务016.08-全量契约一致性与质量门禁收口.md)

## 5. 验收标准

- slot 规则明确。
- L8 可校验 slot。
- contract 覆盖 Root/Trigger/Content/Item 等 parts。

## 6. 验证命令

```bash
cd Chips-ComponentLibrary && npm run verify && npm run quality:gate
cd ../Chips-Host && npm test
```
