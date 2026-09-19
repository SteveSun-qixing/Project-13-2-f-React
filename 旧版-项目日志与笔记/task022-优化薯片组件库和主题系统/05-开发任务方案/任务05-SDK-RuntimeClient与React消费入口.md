# 任务05：SDK Runtime Client 与 React 消费入口

## 1. 任务目标

把 SDK 从“能调用 Host API”提升为“开发者写应用时默认使用的类型化入口”，并让 React 应用能轻松消费主题、多语言、surface、权限、资源、配置、插件、卡片、箱子等 Host 能力。

注意：SDK 不承载 Host 运行时主实现，只做类型封装、调用辅助、CLI、测试辅助。

## 2. 当前基础

已核对：

- `Chips-SDK/src/core/client.ts`
- `Chips-SDK/src/core/bridge-adapter.ts`
- `Chips-SDK/src/types/client.ts`
- `Chips-SDK/src/api/theme.ts`
- `Chips-SDK/src/api/i18n.ts`
- `Chips-SDK/src/api/surface.ts`
- `Chips-SDK/src/api/plugin.ts`
- `Chips-SDK/src/api/card.ts`
- `Chips-SDK/src/api/box.ts`
- `Chips-SDK/tests/*`
- `Chips-ComponentLibrary/packages/hooks/src/index.js`

当前 SDK 已有 domain API，组件库已有 hooks 包，但应用脚手架仍有直接 `window.chips.invoke` 示例，React 消费入口还不够系统。

## 3. 涉及项目

- `Chips-SDK`
- `Chips-ComponentLibrary/packages/hooks`
- `Chips-ComponentLibrary/packages/component-library`
- `Chips-Scaffold/chips-scaffold-app`
- `Chips-EcoSettingsPanel`

## 4. 开发内容

1. Runtime Client 能力补齐。
   - 统一 request id。
   - 统一错误归一。
   - 超时和 retry 诊断。
   - Bridge unavailable 诊断。
   - 权限错误标准化。
   - event subscribe/unsubscribe 一致化。

2. Domain API 完整性核对。
   - theme。
   - i18n。
   - surface/window。
   - platform。
   - file/resource。
   - config。
   - plugin/module。
   - card/box/document。
   - transfer/association/zip。

3. React 消费入口设计。
   - React hooks 优先落在 `Chips-ComponentLibrary/packages/hooks`，由 `@chips/component-library` 聚合导出。
   - SDK 保持纯 TypeScript API 和测试 mock。
   - hooks 内部只能通过 SDK client 或 Bridge 正式链路调用 Host。

4. 建议补齐的 hooks。
   - `useChipsClient`
   - `useChipsTheme`
   - `useChipsI18n`
   - `useChipsSurface`
   - `useChipsPermission`
   - `useChipsConfig`
   - `useChipsResource`
   - `useChipsPlugin`
   - `useChipsCommand`
   - `useChipsDiagnostics`

5. 测试辅助。
   - mock client。
   - mock bridge。
   - mock theme event。
   - mock surface context。
   - mock permission denied。
   - mock Host service timeout。

6. 脚手架替换。
   - 移除模板中的直接 `window.chips.invoke` 示例。
   - 默认使用 SDK client 和官方 hooks。
   - 默认文案走 i18n。
   - 默认主题从 Host current theme 初始化。

## 5. 建议文件范围

- `Chips-SDK/src/core/*`
- `Chips-SDK/src/api/*`
- `Chips-SDK/src/types/*`
- `Chips-SDK/tests/*`
- `Chips-ComponentLibrary/packages/hooks/src/index.js`
- `Chips-ComponentLibrary/packages/hooks/src/index.d.ts`
- `Chips-ComponentLibrary/packages/hooks/tests/*`
- `Chips-ComponentLibrary/packages/testing/*`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/*`

## 6. 验收标准

- 新应用模板不直接调用 `window.chips.invoke`。
- React 应用可以通过官方 hooks 获取 theme、i18n、surface、权限和诊断。
- SDK 的错误、事件、超时、权限诊断一致。
- hooks 可在 Host mock 和真实 Host 两种环境下测试。
- 生态设置面板可以复用同一套 hooks。

## 7. 验证命令

```bash
cd Chips-SDK && npm test
cd Chips-ComponentLibrary && npm run verify
cd Chips-Scaffold/chips-scaffold-app && npm run build && npm test && npm run test:e2e
cd Chips-EcoSettingsPanel && npm run verify
```

## 8. 依赖任务

- 依赖：[任务02-Host-L8声明式UI产品化.md](./任务02-Host-L8声明式UI产品化.md)
- 依赖：[任务03-Host-L9统一渲染产品化与诊断.md](./任务03-Host-L9统一渲染产品化与诊断.md)
- 依赖：[任务04-App-Scene-surface-commands应用结构能力.md](./任务04-App-Scene-surface-commands应用结构能力.md)

## 9. 风险与注意事项

- 不要把 React 运行时强塞进 SDK 核心；React hooks 应与纯 SDK API 分层。
- 不要在应用模板中留下 Bridge 私有调用示例。
- 不要让 hooks 绕开 SDK/Bridge 直接访问 Host 内部。

