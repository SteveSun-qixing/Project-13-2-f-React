# 任务012-SDK测试Mock与Host模拟器前置勘察报告

## 来源

- 子代理：Hubble
- 类型：只读勘察
- 状态：已完成
- 约束：未修改文件、未创建/切换分支、未提交，未触碰既有 node_modules 脏文件。

## 总体结论

任务012第一阶段最合理落点应在 `Chips-SDK` 新增公开测试辅助入口，例如 `chips-sdk/testing`。SDK 只提供 Host Bridge、route、event、permission 的测试模拟器和 fixture，不搬入 Host 运行时主实现。`Chips-ComponentLibrary/packages/testing` 应保留组件断言与 Provider 适配能力，但其 mock client 应迁移或包装 SDK 测试辅助，避免继续维护一套独立的伪 SDK client。

## 当前证据

- `Chips-SDK/package.json` 当前只导出根入口，缺少 `./testing`。
- `Chips-SDK/src/core/client.ts` 已支持自定义 transport、preload bridge、超时、重试、权限错误不重试。
- `Chips-SDK/src/core/bridge-adapter.ts` 已有 plugin bridge/custom transport adapter 和本地事件转发，但不是测试工具。
- `Chips-SDK/src/contracts/route-manifest.json` 已保留 Host 路由描述快照，可作为模拟器 seed。
- `Chips-SDK/tests/client.test.ts` 覆盖 SDK timeout/retry/permission denied/theme event/launch context，但 mock 分散在测试内部。
- `Chips-SDK/tests/card.test.ts` 和 `Chips-SDK/tests/resource.test.ts` 都有私有 `createStubClient`，不可复用。
- `Chips-ComponentLibrary/packages/testing/src/index.js` 的 `createMockChipsClient` 是手写 client-like 对象，支持 theme/i18n/platform/command/controlPlane 的基础 mock。
- `Chips-ComponentLibrary/packages/hooks/tests/index.test.mjs` hooks 测试已经依赖该 mock。
- 组件库 testing mock 当前不模拟 `window.chips`、`invokeScoped/emitScoped`、route manifest 权限、timeout/retry、Host 标准错误 envelope，也不复用 SDK 真实 `createClient` 路径。

## Host 正式行为依据

- `Chips-Host/packages/kernel/src/router.ts` 是 route 权限、idempotent retry、timeout、标准错误 envelope 的核心依据。
- `Chips-Host/src/preload/create-bridge.ts` 是 `invokeScoped/emitScoped`、`window.chips.platform.getLaunchContext()` 和 surface context 暴露形态依据。
- `Chips-Host/src/main/services/register-host-services.ts` 的 theme、surface、command 服务注册是事件与权限语义依据。
- Host 单元测试中的 kernel router、runtime client、preload context bridge 和 host services routing 可作为模拟器语义验收参照。

## 能力缺口

- SDK 没有统一测试辅助入口，应用模板、SDK 单测、组件库 hooks 测试各自造 mock。
- 没有可安装到 `window.chips` 的 Mock Bridge。
- 没有 route manifest 驱动的权限拒绝、标准错误、延迟、timeout、retry 场景模拟。
- 没有统一 fixture：launch context、surface context、theme changed payload、permission denied error、retryable error。
- 应用脚手架测试仍偏浅，未覆盖实际 Host 模拟链路。
- 组件库 testing mock 与 SDK client / Host contract 漂移风险较高。

## 推荐实现分层

- `Chips-SDK/src/testing/host-simulator.ts`：声明式 Host 模拟器，读取/复用 SDK route manifest 快照，提供 handler 注册、调用记录、权限检查、标准错误、延迟/失败注入、theme/surface 默认状态。
- `Chips-SDK/src/testing/mock-bridge.ts`：`createMockChipsBridge`、`installMockChipsBridge`，模拟 `window.chips.invoke/on/once/off/emit/invokeScoped/emitScoped/platform.getLaunchContext`。
- `Chips-SDK/src/testing/mock-client.ts`：通过真实 `createClient({ transport })` 生成 mock client，不手写 SDK API 克隆。
- `Chips-SDK/src/testing/fixtures.ts`：集中提供 launch/surface/theme/permission/timeout/retry fixture。
- `Chips-SDK/src/testing/index.ts` 与 `package.json` 的 `exports["./testing"]`：作为正式测试辅助入口。
- `Chips-ComponentLibrary/packages/testing`：保留组件断言、a11y/contract helper、`createMockChipsEnvironment` Provider 适配；mock client 迁移为包装 `chips-sdk/testing`，或至少对齐 SDK fixture 和错误形态。
- `Chips-Scaffold/chips-scaffold-app`：生成模板测试改用 `chips-sdk/testing`，覆盖 theme changed、surface context、permission denied 和 command invoke 异常路径。

## 风险点

- SDK 不能 import/copy Host `KernelRouter`、`PluginRuntime`、service registry 等运行时主实现，只能按公开 contract 做测试模拟。
- 组件库是 ESM JS 包，SDK 当前包形态是 CommonJS/TS 源导出；若组件库直接依赖 `chips-sdk/testing`，要验证 Node/Vitest 解析路径。
- route manifest 只能覆盖通用 route 权限；`surface.open target=plugin`、command 权限等额外 guard 需要在模拟器提供可配置 guard，而不是复刻完整 Host 注册中心。
- 文档当前仍提到 `@chips/testing` 作为插件单测 mock 来源，和任务012目标不完全一致，需要同步修正。

## 建议验证命令

- `cd Chips-SDK && npm test`
- `cd Chips-ComponentLibrary && npm test`
- `cd Chips-Host && npm test -- tests/unit/kernel-router.test.ts tests/unit/preload-context-bridge.test.ts tests/unit/runtime-client.test.ts tests/unit/host-services-pal-routing.test.ts`
- 新增实现后再单独跑生成模板验证：`cd Chips-SDK && node ./tests/run-cli-create-workspace-tests.cjs`
