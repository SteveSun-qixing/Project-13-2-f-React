# 任务010：SDK Domain API 契约漂移最终报告

生成时间：2026-05-24 00:56:24 CST (+0800)

## 1. 检查范围

- `Chips-Host/packages/kernel/src/kernel.ts`
- `Chips-Host/packages/kernel/src/router.ts`
- `Chips-Host/src/main/core/host-core.ts`
- `Chips-Host/tests/contract/route-manifest.contract.test.ts`
- `Chips-SDK/src/contracts/route-manifest.json`
- `Chips-SDK/src/tooling/route-manifest.ts`
- `Chips-SDK/tests/tooling/contract-drift.test.ts`

## 2. 当前结论

任务010收口后，Host 与 SDK 的 route manifest 已从“动作名一致”提升为“descriptor 元数据一致”：

- Host 仍在工作区输出 `route-manifest.json` 动作名数组，保留运行时诊断和既有动作级契约检查用途。
- Host 新增输出 `route-descriptor-manifest.json`，包含每个 route 的 `action/schemaIn/schemaOut/permission/timeoutMs/idempotent/retries`。
- SDK `src/contracts/route-manifest.json` 已同步为 descriptor manifest 快照，共 159 个 route。
- Host contract 测试会比较 SDK 快照与 Host `getRouteDescriptorManifest()` 的完整对象。
- SDK drift 测试会检查 descriptor action、schema、permission、timeout、idempotent、retries 元数据完整性。

## 3. SDK 公共 API 覆盖

SDK drift 测试已形成双向门禁：

1. SDK wrapper 中出现的 `client.invoke(...)` action 必须存在于 SDK route manifest。
2. SDK route manifest 中的公开 action 必须被 SDK wrapper 覆盖。
3. 内部运行时 action 必须显式列入排除清单，禁止被误暴露为普通 SDK Domain API。

当前唯一显式内部排除：

- `plugin.init`
- `plugin.handshake.complete`

原因：这两个动作属于 Host 插件运行时初始化与握手完成链路，由 Host/Bridge/runtime 负责调度，不作为开发者普通 Domain API 暴露。

## 4. 验证结果

- `cd Chips-Host && npm run build`：通过。
- `cd Chips-SDK && npx vitest run tests/tooling/contract-drift.test.ts tests/route-manifest.test.ts`：通过，8 个测试。
- `cd Chips-Host && npm run test:contract`：通过，5 个测试。
- `cd Chips-SDK && npm test`：通过，70 个 Vitest 测试与全部 CLI/脚手架集成测试。
- `cd Chips-Host && npm test`：通过，35 个测试文件，210 个测试。

## 5. 后续注意

- 新增 Host route 时，必须同步 SDK descriptor manifest 快照、SDK wrapper 或内部排除说明、公共文档和契约测试。
- 如后续希望把 descriptor manifest 自动生成到 SDK 快照，应单独补工具脚本；当前任务010先完成正式结构与门禁，不引入新的构建工具链。
