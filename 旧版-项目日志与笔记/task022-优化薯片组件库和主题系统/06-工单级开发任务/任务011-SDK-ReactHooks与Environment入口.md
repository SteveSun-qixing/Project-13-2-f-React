# 任务011：SDK React Hooks 与 Environment 入口

## 1. 任务目标

建立应用开发默认使用的 React hooks 和 Environment Provider，让应用少写 Host 接线代码。

## 2. 对应阶段任务

- `05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`
- `05-开发任务方案/任务10-State-Environment-Binding模型.md`

## 3. 涉及项目

- `Chips-ComponentLibrary/packages/hooks`
- `Chips-ComponentLibrary/packages/component-library`
- `Chips-SDK`

## 4. 开发内容

1. `ChipsEnvironmentProvider`。
2. `useChipsClient`。
3. `useChipsTheme`。
4. `useChipsI18n`。
5. `useChipsSurface`。
6. `useChipsPermission`。
7. `useChipsCommand`。
8. `useChipsDiagnostics`。

## 5. 验收标准

- 应用模板可使用 hooks 替代直接 Bridge 调用。
- hooks 可在 mock 环境测试。
- hooks 不承载 Host runtime 实现。

## 6. 验证命令

```bash
cd Chips-ComponentLibrary
npm run verify
cd ../Chips-SDK
npm test
```

