# 任务006：Host surface 与 Scene 上下文

## 本次完成内容

- 在 PAL / Bridge / SDK 中补齐 `SurfaceContext`、`SurfaceDocumentContext`、`SurfaceCommandContext` 公共类型。
- Host `surface.open(target=plugin)` 现在会生成正式 `sceneId`，并把 `sceneId / surfaceId / pluginId / sessionId / kind / presentation / launchParams` 串入 surface state 与 preload launch context。
- Desktop PAL 仍只把 `surface` 映射为窗口，但插件侧只接触 `surfaceContext`，不暴露 Electron `BrowserWindow`。
- `platform.getLaunchContext()` 已扩展为可读取 `sceneId / surfaceId / kind / presentation / surfaceContext`。
- 补齐 `scene.created / scene.active / scene.inactive / scene.closed / surface.focused / surface.resized / surface.stateChanged / surface.closed` 生命周期事件。
- 显式关闭插件 surface 时同步停止对应插件 session，避免 scene/surface/session 关系泄漏。
- Host runtime 强校验 `type: app` 插件必须声明完整 `runtime.targets` 与 `ui.surface.defaultKind / preferredKinds`。
- 同步公共文档，明确 `SurfaceContext` 是生态公开契约，公共信息归入 `生态共用技术文档/`。

## 涉及范围

- `Chips-Host`
  - PAL surface/window 类型和 Desktop PAL 注入链路
  - Bridge 类型
  - preload launch context
  - Host `surface` / `window` / plugin launch 链路
  - app manifest 校验
  - 相关单元、集成、e2e fixture
- `Chips-SDK`
  - `surface` 类型
  - `platform.getLaunchContext()` 归一化
  - SDK 导出与客户端测试
- `生态共用技术文档`
  - PAL surface context
  - 插件启动链路
  - Bridge launch context
  - Host service 生命周期事件
  - Manifest app surface 强校验口径

## 验证记录

- `cd Chips-Host && npm run build`：通过。
- `cd Chips-Host && npx vitest run tests/unit/host-services-pal-routing.test.ts tests/unit/preload-context-bridge.test.ts tests/unit/pal-window-electron.test.ts tests/unit/plugin-runtime.test.ts tests/integration/host-services.test.ts`：通过。
- `cd Chips-Host && npm test`：通过，35 个测试文件，202 个测试。
- `cd Chips-Host && npm run test:contract`：通过，3 个测试。
- `cd Chips-SDK && npx vitest run tests/client.test.ts`：通过，22 个测试。
- `cd Chips-SDK && npm test`：通过。

## 备注

- 日志仅写入当前 worktree：`项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志`。
- 任务007的只读前置勘察已由子代理生成到 `08-草稿笔记`，本次任务006提交不纳入该草稿。
