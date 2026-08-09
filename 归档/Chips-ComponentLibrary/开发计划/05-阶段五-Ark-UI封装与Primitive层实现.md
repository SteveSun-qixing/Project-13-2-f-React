# 阶段五：Ark-UI封装与Primitive层实现

## 阶段目标

在Ark UI原语基础上构建稳定Primitive层，统一ref透传、事件签名、契约挂点和无障碍语义。

## 开发范围

- `packages/primitives`
- `packages/a11y`
- 基础结构组件与交互原语

## 开发任务

### 1. Ark UI适配封装

- 实现原语映射层（props/event/ref）。
- 屏蔽Ark内部细节，暴露薯片标准接口。
- 统一错误处理与受控/非受控行为。

### 2. Primitive组件集

- 布局原语：`Box/Inline/Stack/Grid`。
- 文本原语：`Text/Label/HelperText`。
- 结构挂点统一输出`data-scope/data-part`。

### 3. A11y基建

- 焦点管理工具。
- 键盘交互辅助工具。
- ARIA属性校验工具与测试helper。

### 4. 开发约束落地

- Primitive层禁止视觉硬编码。
- Primitive层禁止业务语义耦合。

## 阶段产物

- 可复用Primitive组件集。
- A11y基础工具。
- Primitive层测试用例。

## 退出条件

- Primitive层可独立支撑上层语义组件开发。
- 所有Primitive满足契约字段输出。

## 执行进展（2026-03-04）

已完成：

- Ark 适配层已落地：
  - `mapArkPrimitiveProps`
  - `createPrimitiveComponent`
  - `createControlledValueAdapter`
- Primitive 组件已落地：
  - `Box/Inline/Stack/Grid`
  - `Text/Label/HelperText`
- A11y 基建已落地：
  - 键盘意图与导航键工具
  - ARIA 校验与断言工具
  - 焦点收集与焦点移动工具
- Primitive 与 A11y 测试已补齐并通过，`npm run verify` 全量通过。

状态判定：

- 阶段五功能开发、测试、文档已闭环完成。
