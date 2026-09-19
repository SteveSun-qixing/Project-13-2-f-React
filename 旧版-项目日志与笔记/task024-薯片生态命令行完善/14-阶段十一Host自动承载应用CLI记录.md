# 阶段十一：Host 自动承载应用 CLI 记录

## 背景

人工验证 `chips iconmaker generate ...` 时，即使先运行 `chips start`，应用命令仍返回 `CLI_COMMAND_NOT_READY`。原因是 `chips start` 只写入工作区运行状态，传统 Node CLI 进程可以启动 HostApplication 与命令索引，但不能加载应用插件页面；应用侧通过 SDK 注册的 `commandId` 不会进入 Host command registry。

用户期望是直接使用 `chips` 即可完成命令，不需要先执行 `chips start`。

## 本阶段实现

- Host CLI 新增应用 CLI 的 Electron 自动承载链路：
  - 非 Electron CLI 执行应用目标且声明 `target.commandId` 时，自动启动短生命周期 Electron runner；
  - runner 使用真实 Electron Host 加载应用插件后台 surface；
  - 应用页面通过正式 SDK/Bridge 注册 command 后，CLI 继续走 `command.invoke` 与 `cli.task` 等待链路；
  - runner 在任务终态后关闭，不要求用户提前启动 Host。
- `SurfacePresentation` 新增 `visible?: boolean` 初始可见性语义；应用 CLI 执行类命令默认创建 `visible: false` 的后台 surface，不主动显示或聚焦窗口。
- 普通打开类应用目标不使用短生命周期 runner，避免只想打开应用窗口时 runner 退出导致窗口被关闭。
- IconMaker CLI 写入输出目录前通过 `client.file.mkdir(outputDir, { recursive: true })` 保证已有目录不会触发 `EEXIST`。
- SDK `client.file.mkdir` 正式支持 `recursive` options，并保持 Host route 透传给 PAL。

## 影响文件

- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/src/main/electron/cli-app-command-protocol.ts`
- `Chips-Host/src/main/electron/cli-app-command-runner.ts`
- `Chips-Host/packages/pal/src/types.ts`
- `Chips-Host/packages/pal/src/node-adapter.ts`
- `Chips-Host/packages/bridge-api/src/bridge-transport.ts`
- `Chips-Host/src/main/electron/electron-loader.ts`
- `Chips-Host/src/main/services/register-host-services.ts`
- `Chips-Host/tests/unit/cli-app-task.test.ts`
- `Chips-Host/tests/unit/pal-window-electron.test.ts`
- `Chips-Host/tests/integration/host-services.test.ts`
- `Chips-SDK/src/api/surface.ts`
- `Chips-SDK/src/api/file.ts`
- `Chips-SDK/tests/client.test.ts`
- `Chip-iconMaker/src/icon-workbench/cli-runner.ts`
- `Chip-iconMaker/tests/unit/cli-runner.test.ts`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/架构设计/02-平台抽象层设计.md`

## 验证

- `cd Chips-Host && npm run build`
- `cd Chips-Host && npm test -- --run tests/unit/cli-app-task.test.ts`
- `cd Chips-Host && npm test -- --run tests/unit/cli-app-task.test.ts tests/unit/pal-window-electron.test.ts`
- `cd Chips-Host && npx vitest run tests/e2e/cli.test.ts --testNamePattern "opens app plugin surfaces"`
- `cd Chips-Host && npm test`
- `cd Chips-SDK && npx vitest run tests/client.test.ts`
- `cd Chips-SDK && npm test`
- `cd Chip-iconMaker && npm run typecheck`
- `cd Chip-iconMaker && npm run build`
- `cd Chip-iconMaker && npm run validate`
- `cd Chip-iconMaker && npm test -- --run tests/unit/cli-runner.test.ts tests/e2e/basic-flow.test.ts`
- `cd Chip-iconMaker && npm run verify`
- `CHIPS_CLI_JOB_PROGRESS=1 chips iconmaker generate /Users/sevenstars/Downloads/1111/1111.jpeg --output /tmp/chips-iconmaker-real-test-existing --json`
- `CHIPS_CLI_JOB_PROGRESS=1 chips iconmaker generate /Users/sevenstars/Downloads/1111/1111.jpeg --output /tmp/chips-iconmaker-hidden-test-20260529-1354 --json`

真实命令验证结果：命令返回 `ok: true`，`cli.task` 状态为 `completed`，并在已存在的输出目录生成 `1111.png / 1111.ico / 1111.icns`。

后台 surface 验证结果：命令返回的 `surface.state` 为 `hidden`，`surface.focused` 为 `false`，`surface.context.presentation.visible` 为 `false`；同次执行在 `/tmp/chips-iconmaker-hidden-test-20260529-1354` 生成 `1111.png / 1111.ico / 1111.icns`。

## 说明

本阶段没有让 CLI 直接 import 应用插件源码，也没有把应用命令迁移成模块插件。应用 CLI 仍然通过 Host `surface.open / plugin.launch / command.invoke` 与 SDK `client.cliTask.*` 正式链路完成。
