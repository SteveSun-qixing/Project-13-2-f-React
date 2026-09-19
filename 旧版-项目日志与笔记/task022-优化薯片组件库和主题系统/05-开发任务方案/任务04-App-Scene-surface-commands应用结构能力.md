# 任务04：App / Scene / surface / commands 应用结构能力

## 1. 任务目标

把薯片应用插件的入口结构提升到类似 SwiftUI `App` / `Scene` 的清晰度，但底层仍然遵守薯片生态规则：

- Host 是唯一运行时承载。
- `surface` 是跨平台界面容器主语义。
- `window` 只是 Desktop 下的实现映射。
- 应用插件不能直接操作 Electron BrowserWindow。

## 2. 当前基础

已核对：

- `生态共用技术文档/架构设计/03-插件架构设计.md`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `Chips-Host/src/main/services/register-schemas.ts`
- `Chips-Host/tests/unit/host-services-pal-routing.test.ts`
- `Chips-SDK/src/api/surface.ts`
- `Chips-SDK/src/api/window.ts`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/manifest.yaml.tpl`

当前已有 `surface.open/focus/resize/setState/getState/close/list`、`runtime.targets`、`ui.surface`，但缺少开发者层面的 App/Scene/Command 默认模型。

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK`
- `Chips-Scaffold/chips-scaffold-app`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`

## 4. 开发内容

1. 定义应用结构语义。
   - App：应用插件入口。
   - Scene：界面场景。
   - WindowGroup：Desktop 映射为窗口组，公共语义仍是 surface。
   - DocumentScene：文件/文档打开场景。
   - SettingsScene：设置场景。
   - ToolWindowScene：工具窗口或辅助 surface。
   - Commands：菜单、工具栏、快捷键、命令面板共享命令。

2. Host 扩展 surface context。
   - `surfaceId`
   - `sceneId`
   - `pluginId`
   - `sessionId`
   - `kind`
   - `presentation`
   - `launchParams`
   - `documentContext`
   - `commandContext`

3. Host 增强生命周期事件。
   - scene created。
   - scene active/inactive。
   - surface opened/focused/resized/closed。
   - document opened/saved/closed。
   - command registered/unregistered/invoked。

4. SDK 封装。
   - `client.surface.*` 保持正式入口。
   - 增加 App/Scene/Command 的类型 helper。
   - 提供测试辅助：mock launch context、mock surface context、mock command dispatch。

5. 脚手架默认接入。
   - 生成应用必须声明 `runtime.targets` 和 `ui.surface`。
   - 默认入口使用 App/Scene 结构。
   - 默认禁止直接访问 Electron/Node。
   - 示例命令通过 SDK/Host 正式链路注册。

## 5. 建议文件范围

Host：

- `Chips-Host/src/main/services/register-host-services.ts`
- `Chips-Host/src/main/services/register-schemas.ts`
- `Chips-Host/src/main/core/*`
- `Chips-Host/src/main/shells/*`
- `Chips-Host/tests/unit/host-services-pal-routing.test.ts`
- `Chips-Host/tests/integration/host-services.test.ts`

SDK：

- `Chips-SDK/src/api/surface.ts`
- `Chips-SDK/src/api/platform.ts`
- `Chips-SDK/src/types/client.ts`
- `Chips-SDK/tests/*`

Scaffold：

- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/*`
- `Chips-Scaffold/chips-scaffold-app/scripts/run-generated-e2e.mjs`

## 6. 验收标准

- 新应用可以通过标准模板表达 App/Scene/surface 结构。
- Desktop 下仍可打开窗口，但应用代码不直接依赖 BrowserWindow。
- Host 可以追踪 scene/surface/session 关系。
- SDK 可以类型安全地打开、聚焦、关闭 surface。
- 命令可以被菜单、工具栏、快捷键、命令面板复用。

## 7. 验证命令

```bash
cd Chips-Host && npm run build && npm test && npm run test:contract
cd Chips-SDK && npm test
cd Chips-Scaffold/chips-scaffold-app && npm run build && npm test && npm run test:templates && npm run test:e2e
```

## 8. 依赖任务

- 依赖：[任务01-公共契约冻结与任务基线.md](./任务01-公共契约冻结与任务基线.md)

## 9. 风险与注意事项

- 不能把 `window` 重新提升成公共主语义。
- 不能让 SDK 承担 Host runtime 主实现。
- 不能让脚手架生成直接 Electron API 调用。

