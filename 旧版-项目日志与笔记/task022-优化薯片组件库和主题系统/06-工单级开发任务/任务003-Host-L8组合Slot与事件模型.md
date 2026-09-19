# 任务003：Host L8 组合 Slot 与事件模型

## 1. 任务目标

完善 L8 复合组件组合规则、slot 校验、事件绑定和副作用边界，为组件库 Compound API 提供运行时校验基础。

## 2. 对应阶段任务

- `05-开发任务方案/任务02-Host-L8声明式UI产品化.md`
- `05-开发任务方案/任务09-复杂组件Compound-API与样式契约.md`

## 3. 涉及项目

- `Chips-Host/src/renderer/declarative-ui/composition.ts`
- `Chips-Host/src/renderer/declarative-ui/events.ts`
- `Chips-Host/tests/unit/declarative-ui.test.ts`

## 4. 开发内容

1. 定义 slot schema。
2. 校验必填 slot、单例 slot、可重复 slot。
3. 校验 slot type。
4. 事件只允许 handler id。
5. runtime-effect 禁止在 render 阶段触发。
6. 输出结构化诊断。

## 5. 验收标准

- Dialog/Tabs/Menu/Form/DataGrid 等复杂组件 slot 可被校验。
- 事件模型不允许内嵌函数。
- 副作用分层清楚。

## 6. 验证命令

```bash
cd Chips-Host
npm run build
npm test
```

