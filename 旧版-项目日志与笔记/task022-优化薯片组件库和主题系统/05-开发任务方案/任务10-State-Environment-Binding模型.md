# 任务10：State / Environment / Binding 模型

## 1. 任务目标

建立薯片前端框架的状态与环境模型，让应用开发者可以用统一方式处理：

- 本地 UI state。
- Host runtime environment。
- theme/i18n/permission/surface context。
- form binding。
- persisted storage。
- focus state。
- async resource state。

目标是降低上层应用代码量，把常用状态接线沉淀到底层。

## 2. 当前基础

已核对：

- `Chips-SDK/src/core/client.ts`
- `Chips-SDK/src/api/config.ts`
- `Chips-SDK/src/api/theme.ts`
- `Chips-SDK/src/api/i18n.ts`
- `Chips-SDK/src/api/surface.ts`
- `Chips-ComponentLibrary/packages/hooks/src/index.js`
- `Chips-ComponentLibrary/packages/components/src/index.js`

当前已有 SDK client、主题 provider、部分 hooks，但缺少统一 State/Environment/Binding 体系。

## 3. 涉及项目

- `Chips-SDK`
- `Chips-ComponentLibrary/packages/hooks`
- `Chips-ComponentLibrary/packages/components`
- `Chips-Scaffold/chips-scaffold-app`
- `Chips-EcoSettingsPanel`

## 4. 开发内容

1. 定义 Environment 模型。
   - `ChipsEnvironmentProvider`
   - `useChipsEnvironment`
   - 环境字段：client、locale、theme、surface、pluginSession、permissions、platform、workspace、diagnostics。

2. 定义 State helper。
   - `useChipsState`
   - `useChipsAsyncState`
   - `useChipsResourceState`
   - `useChipsPersistedState`
   - `useChipsFormState`
   - `useChipsSelectionState`
   - `useChipsDisclosureState`

3. 定义 Binding 模型。
   - `createBinding`
   - `useBinding`
   - `useFieldBinding`
   - 表单控件统一支持 `value/onValueChange`、`checked/onCheckedChange`、`open/onOpenChange` 等受控/非受控模式。

4. 定义 Environment 与 L8 bindings 的关系。
   - UINode `bindings` 只是声明路径。
   - React hooks 负责实际状态实现。
   - L9 校验 binding path 是否合理。

5. 表单和配置接线。
   - `client.config` 与表单绑定。
   - 设置页、插件配置页、主题配置页复用同一套 binding。

6. 测试辅助。
   - mock environment。
   - state transition 断言。
   - async loading/error/success 场景。
   - permission denied 场景。

## 5. 建议文件范围

- `Chips-ComponentLibrary/packages/hooks/src/index.js`
- `Chips-ComponentLibrary/packages/hooks/src/index.d.ts`
- `Chips-ComponentLibrary/packages/hooks/tests/*`
- `Chips-ComponentLibrary/packages/testing/src/index.js`
- `Chips-SDK/src/api/config.ts`
- `Chips-SDK/tests/*`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/*`

## 6. 验收标准

- 应用模板有统一 environment provider。
- 常用状态无需每个应用重复手写。
- 表单控件受控/非受控行为一致。
- L8 binding 与 React 状态实现边界清晰。
- 生态设置面板可复用状态和 binding helper。

## 7. 验证命令

```bash
cd Chips-ComponentLibrary && npm run verify
cd Chips-SDK && npm test
cd Chips-Scaffold/chips-scaffold-app && npm run test:e2e
cd Chips-EcoSettingsPanel && npm run verify
```

## 8. 依赖任务

- 依赖：[任务05-SDK-RuntimeClient与React消费入口.md](./任务05-SDK-RuntimeClient与React消费入口.md)
- 依赖：[任务08-SwiftUI对标控件清单与基础控件补齐.md](./任务08-SwiftUI对标控件清单与基础控件补齐.md)

## 9. 风险与注意事项

- 不要引入新的全局状态库，除非先经过技术决策。
- 不要把业务状态写进组件库。
- 不要让 Environment Provider 变成 Host runtime 的复制实现。

