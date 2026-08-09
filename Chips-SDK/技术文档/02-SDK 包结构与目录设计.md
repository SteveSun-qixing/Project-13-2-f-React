# SDK 包结构与目录设计

> 文档状态：设计基线稿  
> 适用范围：`Chips-SDK` 仓库目录与内部模块划分

---

## 1. 仓库物理目录规划

结合《薯片生态前端 vNext 架构设计手册》关于包边界的建议，`Chips-SDK` 仓库当前目录规划如下：

```text
Chips-SDK/
  package.json
  tsconfig.json
  src/
    core/              # Core Client Layer：客户端工厂与 Bridge 适配
    api/               # Domain API Layer：按能力域拆分的封装
      association.ts
      box.ts
      card.ts
      command.ts
      config.ts
      control-plane.ts
      credential.ts
      document.ts
      file.ts
      i18n.ts
      icon.ts
      log.ts
      module.ts
      platform.ts
      plugin.ts
      resource.ts
      serializer.ts
      surface.ts
      theme.ts
      transfer.ts
      window.ts
      zip.ts
    types/             # 公共类型定义与导出
    testing/           # SDK 测试辅助入口，对外通过 chips-sdk/testing 导出
    tooling/           # 契约校验、开发者报告与调试工具
    contracts/         # route-manifest 与其他契约快照（只读数据）
  tests/
    *.test.ts
    tooling/
    run-cli-*.cjs
  技术文档/
  需求文档/
  开发计划/
```

---

## 2. Core Client Layer 目录

`src/core/` 负责：

- 环境探测（`detectEnvironment()`）。
- Bridge 适配（`createBridgeAdapter()`）。
- 客户端工厂（`createClient()`）。
- 错误归一逻辑与重试策略。

建议文件划分：

- `src/core/environment.ts`：环境探测工具。
- `src/core/bridge-adapter.ts`：Bridge/Transport 适配层。
- `src/core/client.ts`：客户端工厂与核心 `invoke` 实现。
- `src/core/errors.ts`：标准错误类型与归一逻辑。

---

## 3. Domain API Layer 目录

### 3.1 通用约束

- 所有能力域封装仅依赖 `core/client` 导出的调用接口，不直接依赖 `window.chips`。
- 每个能力域一个 `src/api/*.ts` 文件，导出该域的类型与 API。
- 对外公开 API 须通过顶层入口统一导出（例如 `src/index.ts`）。

### 3.2 能力域子目录示例

- `src/api/file.ts`：导出 `read/write/list/stat/watch` 等文件能力封装。
- `src/api/card.ts`：导出 `pack/unpack/readMetadata/parse/render/validate/resolveDocumentPath` 等卡片能力封装。
- `src/api/platform.ts`：导出 dialog、clipboard、shell、notification、tray、shortcut、ipc 等平台能力封装。
- `src/api/control-plane.ts`：导出 health/check/metrics/diagnose 等控制面能力封装。

其他能力域（`box/resource/theme/config/i18n/plugin/module/window/association/credential/log/serializer/zip`）以类似方式组织。

## 4. testing/ 目录

`src/testing/` 是 SDK 正式测试辅助入口，对外通过 `chips-sdk/testing` 导出。

- `src/testing/mock-host.ts`：Host simulator，覆盖调用记录、状态、事件总线、action handler、fault、delay 与权限拒绝。
- `src/testing/index.ts`：导出 `createMockChipsHost`、`createMockChipsClient`、launch/surface/permission fixtures。

测试辅助只能模拟公开 Bridge action、事件和标准错误形态，不得 import Host 主运行时实现，不得复制 KernelRouter、service registry 或 Runtime Client。

---

## 5. types/ 目录

`src/types/` 存放：

- 公共基础类型：
  - `StandardError`
  - `CardDocument`, `CardRenderView`, `BoxInspectionResult`, `BoxOpenViewResult`, `BoxEntrySnapshot`
  - `ThemeMeta`, `ThemeState`, `ResolvedTheme`, `ThemeContractView`, `ThemeDiagnostic`, `ThemeDiagnosticSummary`, `ThemeChangedPayload`
  - `PluginInfo`, `WindowConfig`, `WindowState` 等。
- 环境与客户端配置类型：
  - `SdkEnvironment`
  - `ClientConfig`
  - `BridgeAdapter` 接口等。

类型文件建议：

- `src/types/errors.ts`
- `src/types/card.ts`
- `src/types/box.ts`
- `src/types/theme.ts`
- `src/types/plugin.ts`
- `src/types/client.ts`

顶层入口（`src/index.ts`）统一从 `types/` 再导出公共类型。

---

## 6. tooling/ 目录

`src/tooling/` 主要用于：

- 契约校验与路由清单对齐工具：
  - 解析 `contracts/route-manifest.json`；
  - 检查封装是否存在对未知动作的调用；
  - 检查参数结构是否与契约一致（在测试阶段使用）。
- 调试工具：
  - 调试日志控制与格式统一；
  - 性能采样工具（测量封装层额外开销）。
- 开发者报告：
  - `chipsdev-r preview` 报告；
  - `chipsdev-r component gallery` 组件矩阵；
  - `chipsdev-r theme inspect` 主题检查；
  - `chipsdev-r quality gate` 门禁摘要；
  - `chipsdev-r assimilate scan/report` 外部 Web 项目同化报告；
  - `chipsdev-r diagnostics` 生态工具链诊断。

建议文件：

- `src/tooling/route-manifest.ts`
- `src/tooling/developer-tools.cjs`

---

## 7. contracts/ 目录

`src/contracts/` 用于存放只读契约快照数据，例如：

- `route-manifest.json`：由 Host 导出，包含公开动作清单与 schema 元信息。
- 其他契约快照（如主题接口契约、数据模型契约等）。

使用原则：

- 数据来源由上游仓库提供（脚本同步或手工更新），SDK 仓不得私自编辑契约内容。
- SDK 只能在测试与工具中消费契约数据，不将其视为运行时配置来源。

---

## 8. 顶层入口设计

顶层入口（`src/index.ts`）职责：

- 导出 `createClient` 与客户端配置类型。
- 导出各能力域命名空间（示意）：

  ```ts
  export { createClient } from './core/client';
  export * from './types';

  export type { Client } from './types/client';
  ```

- 建议客户端实例内部再挂载能力域（`client.card`, `client.file` 等），但也可提供静态工具函数作为补充。

---

## 9. 测试目录规划

`tests/` 建议结构：

```text
tests/
  client.test.ts
  card.test.ts
  resource.test.ts
  testing.test.ts
  route-manifest.test.ts
  tooling/
    contract-drift.test.ts
  run-cli-*.cjs
```

测试必须覆盖：

- 正常路径：各能力域 API 在模拟 Host 环境中的基本行为。
- 错误路径：Bridge 不可用、超时、权限拒绝等场景。
- 边界路径：非法参数、空路径、大文件等。
- CLI 集成路径：工程创建、Host 管理委托、模块 invoke、打包兼容、开发者报告命令与同化扫描。

---

## 10. 小结

本文件定义了 `Chips-SDK` 仓库的物理目录与内部模块划分。SDK 只提供类型化封装、测试辅助、脚手架和开发者工具，不承载 Host 运行时主实现。
