# RFC-SDK 主入口 CLI 面收口（`cliCommand` / `cliTask` 命名空间与 §2.2 冻结导出面补齐）

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：已实施（本 RFC 是本轮 `packages/sdk` 公共契约面改动的先行依据与影响面登记）
> 关联：任务 #43（SDK 主入口导出面 P0 漂移收口）、`项目日志与笔记/task043-生态梳理/契约-代码漂移审计-2026-09-20.md` 面 1 第 1/2/4 条与面 5 第 3 条、`RFC-G9边界表放行sdk转发边`、`工单013`、`工单016`

---

## 一、动机

`@chips/sdk` 是插件访问平台的唯一类型化链路，但主入口与客户端面存在三条 P0 级「文档已冻结、实现缺位」的断链：

1. **§3.5 整节未实现**：`ChipsBridge` 缺 `cliCommand` / `cliTask` 两个只读扩展命名空间。文档
   给出的应用插件侧示例（`chips.cliTask.active(commandId)` → `progress` → `complete`）在真实
   SDK 上不可运行，属于「能力已交付、类型已交付、类型化封装缺位」的中间断链。
2. **§5.6 权威示例不可编译**：`import type { CliCommandApi, CliTaskApi } from '@chips/sdk'`
   直接失败——主入口既不导出 `CliCommand*` 系列类型，也不导出 `CliTaskApi`。
3. **manifest 类型与运行时导入规则互斥**：《02-SDK-API规范》§2.2 把 15 个 manifest 类型列为
   **主入口**类型导出，同时 §2.1 规则规定「插件运行时代码只允许导入主入口；`scaffold` 不得出现
   在插件运行时依赖图中」。当前 15 个类型只在 `@chips/sdk/scaffold` 可达，插件按契约无法合法
   获得 manifest 类型——两条规则在实现面上互斥。
4. **面 5 P0**：`cli:task-*` 五项能力的契约类型与 `ICapabilityContracts` 映射早已就位
   （`packages/sdk/src/types/capabilities/cli-task.ts`、`contracts.ts:183-187`），但承诺的
   SDK 类型化封装缺位（随第 1 条一并交付）。

本 RFC 先给出权威依据逐字引用、方案与冻结面判定，再按方案实施。

## 二、权威依据（逐字引用）

### 2.1 《02-SDK-API规范》§3.2 客户端形状

`薯片生态文档库/05-接口与契约/02.03-02-SDK-API规范-三、客户端封装.md:54-63`：

```typescript
class ChipsBridge implements IChipsBridge {
  constructor(target?: IChipsBridge);
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription;
  resource(uri: string): IResourceHandle;
  /** CLI 命令发现扩展命名空间；见 3.5 节。 */
  readonly cliCommand: CliCommandApi;
  /** CLI 任务生命周期扩展命名空间；见 3.5 节。 */
  readonly cliTask: CliTaskApi;
}
```

### 2.2 《02-SDK-API规范》§3.5 CLI 扩展

同文件 `:227`（定位与权威归属）：

> `ChipsBridge` 在 Bridge 方法面之外附带两个只读扩展命名空间，用于插件 CLI 命令发现与任务生命周期；方法形状、字段与错误码以 [CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §5.6、§5.8 为唯一权威，SDK 只做类型化封装，不定义第二套语义

同文件 `:237-247`（运行位置、传输与错误码）：

> | 运行位置 | 可用方法 | 传输 |
> |---|---|---|
> | 插件运行时（`chips` / `createClient()`） | `cliTask.active` / `get` / `progress` / `complete` / `fail` | Bridge 能力 `cli:task-*`（空权限、owner 归属校验，能力登记见 [04-能力契约规范](../../薯片生态文档库/05-接口与契约/04-能力契约规范.md) §7.17；语义见 [CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §5.6） |
> | `@chips/cli` 与平台组件（注入传输的客户端） | `cliCommand.list` / `get` / `resolve`；`cliTask.create` / `bindInvocation` / `get` / `cancel` | 平台服务路由 `cli.command.*` / `cli.task.*`（[CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §5.8） |
>
> - 扩展命名空间不新增传输通道：调用仍经客户端目标 Bridge 转发，目标解析规则与 3.2 节一致。
> - `cliCommand` 只读：读取当前工作区命令索引，不修改插件状态；查询参数非法返回 `CLI_COMMAND_QUERY_INVALID`，多匹配返回 `CLI_COMMAND_CONFLICT`。
> - `cliTask` 任务按 owner 归属校验，跨插件读写一律拒绝；终态不可逆，越界上报返回 `CLI_TASK_INVALID`。
> - 失败统一归一为 `ChipsError`，`code` 取 CLI 域错误码（[CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §2.5、§2.6）。

同文件 `:249-256`（主入口随这两个命名空间导出的类型，「仅类型，`import type` 消费」）：

> | 类型 | 用途 |
> |---|---|
> | `CliCommandTargetType`、`CliCommandQueryOptions` | 发现查询的目标类型与查询参数 |
> | `CliCommandApi`、`CliCommandListResult`、`CliCommandView`、`CliCommandIndex`、`CliCommandConflict`、`CliCommandResolveResult` | 命令发现接口与结果 |
> | `CliTaskApi`、`CliTaskStatus`、`CliTaskRecord` | 任务接口、任务状态与任务记录 |

### 2.3 《02-SDK-API规范》§2.2 主入口导出清单（冻结面）

`薯片生态文档库/05-接口与契约/02.02-02-SDK-API规范-二、导出入口.md`：

- `:56` manifest 行（列为**主入口**类型导出，15 项）：

  > | manifest | `IPluginManifest`、`PluginRole`、`PluginTarget`、`PluginSurface`、`IPluginRuntime`、`IPluginEngines`、`IPluginDependency`、`IPluginCapabilities`、`IPluginCardType`、`IPluginLayoutType`、`IPluginExportFormat`、`IPluginFileAssociation`、`IPluginUi`、`IPluginHealthCheck`、`IPluginDeepLink` | SDK 定义；字段语义见 [插件清单规范](../../薯片生态文档库/03-插件开发/02-插件清单规范.md) |

- `:58` CLI 扩展行（11 项，即 §3.5 表格的同一集合）：

  > | CLI 扩展 | `CliCommandApi`、`CliCommandQueryOptions`、`CliCommandListResult`、`CliCommandView`、`CliCommandIndex`、`CliCommandConflict`、`CliCommandResolveResult`、`CliCommandTargetType`、`CliTaskApi`、`CliTaskStatus`、`CliTaskRecord` | SDK 定义；方法与语义以 [CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §5.6、§5.8 为权威，客户端命名空间见 3.5 节 |

- `:60` 明确这两个命名空间不是值导出：

  > `cliCommand` / `cliTask` 不是模块级值导出，而是 `ChipsBridge` 实例上的只读扩展命名空间（3.5 节）；主入口导出对应的类型供 `import type` 消费。

- `:25` §2.1 规则：

  > 插件运行时代码只允许导入主入口；`testing` 与 `scaffold` 不得出现在插件运行时依赖图中。

### 2.4 《02-SDK-API规范》§11 约束

`薯片生态文档库/05-接口与契约/02.11-02-SDK-API规范-十一、约束与不变量.md`：

- `:14` 约束 3：

  > **方法面冻结**：`ChipsBridge` 只实现 `IChipsBridge` 的 `request` / `subscribe` / `resource` 三个方法；除 CLI 扩展命名空间 `cliCommand` / `cliTask`（3.5 节）外不得增加成员；增删必须走 RFC。

- `:23` 约束 12：

  > **CLI 扩展只封装不定义**：`cliCommand` / `cliTask` 的方法、字段、错误码以 [CLI 完整参考](../../薯片生态文档库/06-开发与运维/07-CLI完整参考.md) §5.6、§5.8 为唯一权威，SDK 不新增传输通道、不维护第二份命令索引或任务模型。

- `:13` 约束 2（不承载运行时）、`:16` 约束 5（无镜像类型）、`:21` 约束 10（文档与代码同 PR）。

### 2.5 《07-CLI完整参考》§5.6 / §5.8（方法面唯一权威）

- `薯片生态文档库/06-开发与运维/07.10-07-CLI完整参考-五、插件 CLI 命令扩展-5.6 SDK 接口.md:12`：

  > `client.cliCommand` 与 `client.cliTask` 随 `@chips/sdk` 主入口导出（客户端创建见 [02-SDK-API规范](../../薯片生态文档库/05-接口与契约/02-SDK-API规范.md) §3.2）

- 同文件 `:24-47`（发现接口，原文代码块 `CliCommandListResult` 缺右花括号、且未给出
  `CliCommandView` / `CliCommandConflict` / `CliCommandIndex` 定义——见第八节文档补全）、
  `:49`（`CliCommandView` 字段清单逐字：「`entryId`（CLI 入口标识）、`commandPath`、`commandId?`
  （`app` 目标的运行时命令 ID）、`owner`、`enabled`、`declaration` 与 `conflicts`」）、
  `:53-59`（`cli:task-*` 五项能力输入输出表）、`:79-88`（`CliTaskApi` 八方法面）、
  `:91-97`（调用方约定：`create` / `bindInvocation` 属 CLI 调度链路服务路由；`active` 无任务返回
  `undefined`；`fail` 的 `error` 归一为 `{ code, message, details?, retryable? }`）。
- `薯片生态文档库/06-开发与运维/07.12-07-CLI完整参考-五、插件 CLI 命令扩展-5.8 发现与任务服务路由.md:14-29`
  （服务路由集合 `cli.command.list/get/resolve`、`cli.task.create/bindInvocation/get/progress/complete/fail/cancel`；
  「本表是 CLI 扩展的唯一服务路由集合；不得新增第二套命令索引或任务存储」）。
- `薯片生态文档库/05-接口与契约/04.30-04-能力契约规范-七、内置能力契约（逐项）-7.16 命令与 CLI.md:99-164`
  （§7.17 `cli:task-*` 五项能力的权限（空数组）、输入输出要点与契约接口定义，与
  `packages/sdk/src/types/capabilities/cli-task.ts` 逐项一致）。

## 三、现状复核（对审计结论逐条重验，2026-09-20 本会话实跑）

| 审计条目 | 复核结果 | 证据 |
|---|---|---|
| 面 1 第 1 条（缺 `cliCommand` / `cliTask`） | **成立** | `packages/sdk/src/client/chips-bridge.ts:56-119` 类体只有 `#injected` / `#target` / `request` / `subscribe` / `resource`；全 `packages/sdk/src` grep `cliCommand\|cliTask\|CliCommandApi\|CliTaskApi` 仅命中注释与 `cli:task-*` 能力 ID，无命名空间实现 |
| 面 1 第 2 条（主入口不导出 CLI 扩展类型） | **成立，行号更新** | `packages/sdk/src/index.ts:142-156` 只导出 `CliTaskRecord` / `CliTaskStatus` 与五对 `ICliTask*Input/Output`；`CliCommand*` 九项与 `CliTaskApi` 全缺 |
| 面 1 第 3 条（CLI 侧私有镜像类型面） | **成立，本单不修** | `packages/cli/src/client/types.ts:131-230`（`ICliCommandView` / `ICliTaskApi` / `ICliCommandQuery` 等）自成一套；审计判定「需 RFC、须裁定归属包与转发方向」，且该文件顶部仍写 `pluginId` 而《CLI 完整参考》§5.6:49 用 `owner`——归属裁定与镜像收口是 CLI 侧工单面，本单只动 `packages/sdk/**` 与文档库，**`packages/cli/**` 零改动** |
| 面 1 第 4 条（manifest 15 项主入口缺位） | **成立** | `packages/sdk/src/index.ts` 全文无 manifest 导出段（`:9-10` 头注自述缺口）；唯一落位 `packages/sdk/src/scaffold/index.ts:23-43`（19 项类型转发，其中 manifest 域 15 项） |
| 面 5 第 3 条（`cli:task-*` 类型化封装缺位） | **成立** | 类型侧 `src/types/capabilities/cli-task.ts`、`contracts.ts:183-187`、`src/generated/capability-ids.ts:63-67/128-132` 均就位；封装侧缺位，随本单第 1 条交付 |
| 基线 | **全绿** | `pnpm --filter @chips/sdk build/test/lint/typecheck` 均 0；根 `npm run test:contract` 0；`npm run gates:all` 0（本会话实跑，见 `/tmp/base43-*.log`） |

补充复核（未被审计点名、但影响方案的实现事实）：

- `packages/sdk/src/generated/error-codes.ts` 内**无任何 `CLI_*` 码**：CLI 域错误码的权威登记在
  《07-CLI完整参考》§2.6，由 CLI 进程自身产生，不属 `tools/contract-gen` 的生成事实源。
- `src/index.test.ts:95-100` 与 `src/client/chips-bridge.test.ts:293-306` 已把「原型面只有三个
  方法」「实例无自有成员」写成断言，是实现现状的快照，不属文档口径（§3.2 明确要求实例携带
  `cliCommand` / `cliTask`）。
- `tests/contract/snapshots/sdk-exports.json` 的 `typeExports` 由文档 §2.2 表格解析生成，
  **不含实现侧**；只要不改 §2.2，G8/契约测试面零扰动。

## 四、§2.2 冻结面判定结论（本 RFC 的核心裁决）

**结论：本单是「实现补齐」，不是「冻结面扩张」，§2.2 清单零改动。**

判定依据（逐条）：

1. 本单新增到主入口的类型名共 26 个 = CLI 扩展 11 个（§2.2 `:58` 逐字列出的
   `CliCommandApi`、`CliCommandQueryOptions`、`CliCommandListResult`、`CliCommandView`、
   `CliCommandIndex`、`CliCommandConflict`、`CliCommandResolveResult`、`CliCommandTargetType`、
   `CliTaskApi`、`CliTaskStatus`、`CliTaskRecord`）+ manifest 15 个（§2.2 `:56` 逐字列出）。
   两个集合与文档行的名称、拼写、数量**一一对应**，实现只是把文档已冻结的导出面落到 `index.ts`。
2. 值导出面零变化：§2.2 `:30-39` 的六项值导出（`chips` / `createClient` / `ChipsBridge` /
   `ChipsError` / `isChipsError` / `toChipsError`）不动；§2.2 `:60` 明确「`cliCommand` / `cliTask`
   不是模块级值导出」，故 `src/index.test.ts` 的值导出面快照断言保持成立。
3. `ChipsBridge` 成员面按 §3.2 补齐到「三方法 + 两个只读扩展命名空间」，正是约束 3
   （`:14`）显式豁免的唯一增补方向；未引入任何文档之外的第三个成员。
4. 实现内部为 `CliCommandView.declaration` 需要声明形状类型（§5.1 命令级字段表 + §5.2 参数模型
   表的结构映射），这些**不进入主入口导出面**，只作为 `CliCommandView` 的结构组成部分存在于
   `src/types/cli/command.ts`。理由：§2.2 未列出它们，导出即构成冻结面扩张，须另走 RFC；
   调用方仍可通过 `CliCommandView['declaration']` 取得该形状。本单不为此新增任何 §2.2 行。
5. 因此 §2.2 拆分件、`sdk-exports.json` 快照、G8 契约一致性链**零改动**，`tools/contract-gen`
   与 `packages/sdk/src/generated/**` 也零改动（不新增能力 ID、权限、事件、错误码事实）。

## 五、方案

### 5.1 类型落位（新增 `src/types/cli/`）

- `src/types/cli/command.ts`：`CliCommandTargetType`、`CliCommandQueryOptions`、`CliCommandIndex`、
  `CliCommandConflict`、`CliCommandView`、`CliCommandListResult`、`CliCommandResolveResult`、
  `CliCommandApi`；以及不进入主入口的声明形状 `CliCommandDeclaration`、
  `CliCommandTargetDeclaration`、`CliCommandSurfaceDeclaration`、`CliCommandOutputDeclaration`、
  `CliCommandJobDeclaration`、`CliCommandConflictDeclaration`、`CliCommandParameterDeclaration`、
  `CliCommandParameterType`、`CliParameterPathRules`、`CliParameterBatchRules`、
  `CliParameterValidationRules`、`CliParameterUiHints`。权威全部指向 §5.1/§5.2/§5.5/§5.6/§5.8，
  每个成员带文档章节引用注释。
- `src/types/cli/task.ts`：`CliTaskApi`（八方法面，逐字对齐 §5.6:79-88），任务记录与状态
  **复用** `../capabilities/cli-task.js` 的 `CliTaskRecord` / `CliTaskStatus`，不重复定义
  （约束 5、约束 12）。`create` / `bindInvocation` 的入参按 §5.6 以行内对象类型表达，不新增命名类型。

### 5.2 `cliCommand` → 传输映射

三个方法一律经目标 Bridge 的 `request(id, input)` 转发（不新增通道，§3.5:244）：

| 方法 | `request` 第一参 | 第二参 |
|---|---|---|
| `list(options?)` | `cli.command.list` | `options ?? {}` |
| `get(options)` | `cli.command.get` | `options` |
| `resolve(options)` | `cli.command.resolve` | `options` |

路由名取 §5.8 表格逐字（`cli.command.*`，点分段），常量集中定义在
`src/client/cli-command-api.ts`，注释登记权威行；SDK 侧不做查询参数校验（校验与
`CLI_COMMAND_QUERY_INVALID` / `CLI_COMMAND_CONFLICT` 判定属平台，SDK 只透传，见 6.2 否决项 B）。

### 5.3 `cliTask` → 传输映射（关键裁决）

`cliTask` 八个方法覆盖两侧调用方，§3.5:241-242 的两行表格按方法归属区分传输：

| 方法 | 传输 | 依据 |
|---|---|---|
| `active` / `get` / `progress` / `complete` / `fail` | Bridge 能力 ID，取 `src/generated/capability-ids.ts` 的 `Capability.CLI_TASK_ACTIVE` / `CLI_TASK_GET` / `CLI_TASK_PROGRESS` / `CLI_TASK_COMPLETE` / `CLI_TASK_FAIL` 常量（不写字面量） | §3.5:241 插件运行时行 + §5.6:53-59 能力表 + §7.17；输入输出直接复用已登记的 `ICliTask*Input` / `ICliTask*Output` |
| `create` / `bindInvocation` / `cancel` | 服务路由名 `cli.task.create` / `cli.task.bindInvocation` / `cli.task.cancel` | §3.5:242 与 §5.8:19-20/25（这三项**无能力登记**，只有注入平台传输的调用方可用） |
| `get` | **取能力 ID `cli:task-get`** | `get` 同时出现在 §3.5 两行（`:241` 与 `:242`），必须裁决。取能力面的理由：(a) §5.6:54-55 已把 `cli:task-get`（输入 `taskId`）登记为唯一有契约类型的读取面，SDK 类型化封装必须落在有登记的一侧；(b) `cli.task.get` 是 §5.8 平台内部路由，插件不可达，SDK 造第二条读取通道违反约束 12「不新增传输通道」；(c) 注入型平台传输同样能按能力 ID 派发（能力 ID 是内核路由的合法键，见 §5.8:12「CLI 与 SDK 消费」的同一 `request` 面），取能力面不损失任何调用方能力 |

任务记录的 `{ task }` / `{ task? }` 信封解包在 SDK 内完成（`active` 无任务返回 `undefined`，
其余返回 `record`），与 §5.6:83-87 的返回类型（`Promise<CliTaskRecord>`）逐字一致；解包是纯形状
适配，不判定业务语义。

### 5.4 实现与错误口径

- `src/client/cli-command-api.ts` / `src/client/cli-task-api.ts`：各自导出
  `createCliCommandApi(resolveTarget)` / `createCliTaskApi(resolveTarget)`，`resolveTarget: () => IChipsBridge`
  由 `ChipsBridge` 注入 `() => this.#target()`。因此：
  - **目标解析规则与 §3.2 完全一致**（含「构造后注入即用」），命名空间不持有目标引用；
  - 目标不可用时同步抛 / 异步拒绝 `SDK_BRIDGE_UNAVAILABLE`（复用 `errors.ts` 的
    `bridgeUnavailableError()` 与 `toChipsError()`），与 `subscribe` / `resource` 的同步抛出、
    `request` 的异步拒绝口径一致；
  - 平台返回的错误对象**原样透传**，不改写 `code` / `message` / `details` / `retryable`（§6.4、约束 6）。
- **不新增错误码**：本单只使用已登记的 `SDK_BRIDGE_UNAVAILABLE`；CLI 域码由平台产生、SDK 透传，
  `src/generated/error-codes.ts`、`src/errors.ts`、《03-核心接口规范》错误码分件零改动
  （无需登记新码，故不触碰文档库错误码面）。
- 超时 / 重试 / 队列 / 会话：全部归平台 Bridge，SDK 不引入任何计时器或重试循环（约束 2）。
- `ChipsBridge`：新增两个 `readonly` 实例字段（§3.2 形状），原型方法面保持三个不变。

### 5.5 主入口（`src/index.ts`）

- 新增「CLI 扩展」导出段：11 个类型名（其中 `CliTaskStatus` / `CliTaskRecord` 沿用
  `./types/capabilities/cli-task.js` 既有定义，不搬家以免制造第二处定义）。
- 新增「manifest」导出段：15 个类型名，来源 `./scaffold/index.js` 的既有转发（`export type`，
  编译期完全擦除，`dist/index.js` 无运行时代码、无 `@chips/scaffold` 运行时引用），
  满足 §2.1 `:25` 的运行时依赖图规则；定义仍单点落在 `@chips/scaffold`，主入口不复制形状（约束 5）。
- 头注的「§2.2 清单中的 manifest 与 CLI 扩展类型尚未随本入口落地，缺口登记见包内说明与波次报告」
  一句按事实删除，改为记录收口口径。

### 5.6 `scaffold` 转发本体

`src/scaffold/index.ts` **零改动**（禁改面；manifest 类型主入口可达指的就是主入口再导出）。

## 六、备选与裁决

| # | 备选 | 裁决 | 理由 |
|---|---|---|---|
| B1 | manifest 类型搬到 `packages/sdk/src/types/manifest.ts`，由 scaffold 反向转发 SDK | **否决（本单）** | 会改 `src/scaffold/index.ts`（刚收口、禁改面），并牵动 `@chips/scaffold` 公开面与 G9 边界表；本单只需主入口可达。长期归属（§2.2 写「SDK 定义」而定义目前在 `@chips/scaffold`）已在第九节登记为遗留面 |
| B2 | SDK 侧复制一份 manifest 类型定义 | **否决** | 直接违反约束 5「无镜像类型」，制造第三份事实源（`@chips/scaffold` / `@chips/sdk/scaffold` / 主入口） |
| B3 | 主入口 `export * from './scaffold/index.js'` | **否决** | 会把 `IScaffoldOptions` / `IScaffoldPlan` / `IScaffoldTemplate` / `IScaffoldFile` 等 §8.3 开发期类型推进插件运行时主入口，超出 §2.2 清单；且 `export *` 携带运行时值导出 `createScaffoldPlan` / `listScaffoldTemplates`，破坏 §2.2 值导出六项冻结面与 `src/index.test.ts` 快照 |
| B4 | 把 `cliCommand` / `cliTask` 做成 `ChipsBridge` 原型 getter | **否决** | §3.2 形状是实例上的只读数据成员；getter 会扩大原型面（`request`/`subscribe`/`resource` 三方法冻结面）并让「实例不携带注入目标」的可观测性变复杂 |
| B5 | 在 SDK 内做 §5.1/§5.2 的查询参数与任务状态校验（照搬 CLI 侧 `assertQuery` / `expectTask`） | **否决** | 违反约束 12「只封装不定义语义」，与 CLI 侧构成两份判定；错误码由平台返回，SDK 透传即可 |
| B6 | 为 `cliTask` 三侧方法与 `cliCommand` 引入新的 SDK 错误码（如 `SDK_CLI_*`） | **否决** | §6.3 的 SDK 自有码集合恰为三个（审计面 1 已核验一致项），新增即破冻结；且平台已有 `CLI_COMMAND_QUERY_INVALID` / `CLI_TASK_INVALID` 覆盖 |
| B7 | `cliTask.get` 走服务路由 `cli.task.get` | **否决** | 见 5.3 行内裁决：能力面有登记契约、路由面无契约登记，取能力面才谈得上「类型化封装」 |
| B8 | 顺带收口 `packages/cli` 的私有镜像类型面 | **否决** | 审计判为「需 RFC 且须裁定归属包与转发方向」，已另立工单；`packages/cli/**` 是本单禁改面 |

## 七、测试面

- `src/client/cli-command-api.test.ts`：注入 `vi.fn()` 目标，逐方法断言 `request` 的
  `(id, input)` 形状（`cli.command.list` 省略参数时传 `{}`、`get` / `resolve` 原样透传查询对象）、
  返回值透传；`window.chips` 缺失时三方法的异步拒绝码为 `SDK_BRIDGE_UNAVAILABLE`。
- `src/client/cli-task-api.test.ts`：断言五个能力方法命中的是 `src/generated` 常量所指能力 ID
  （`cli:task-active` 等，输入形状 `{ commandId }` / `{ taskId }` / `{ taskId, progress }` /
  `{ taskId, output }` / `{ taskId, error }`）与 `task` 信封解包（`active` 无任务 → `undefined`）；
  断言 `create` / `bindInvocation` / `cancel` 走 `cli.task.*` 路由名；断言平台错误同实例透传；
  断言无目标时异步拒绝 `SDK_BRIDGE_UNAVAILABLE`。
- `src/client/chips-bridge.test.ts`：方法面冻结用例改为「原型仍只有三个方法 + 实例自有成员恰为
  `cliCommand`、`cliTask`」，并断言两个命名空间在同一实例上引用稳定（`readonly`）、注入目标
  不可从实例读取。
- `tests/public-entries.test.ts`：新增 §3.5 两段完整示例的端到端用例（应用插件侧
  `cliTask.active → progress → complete`，发现侧 `cliCommand.list → resolve`），以及
  §2.2 CLI 扩展 11 项 + manifest 15 项的 `import type` 消费点（编译期即门禁：不可达则
  包级 `typecheck` 失败）。
- `src/index.test.ts`：补「CLI 扩展与 manifest 类型是纯类型再导出，主入口运行时说明符集合不变」
  断言（守 §2.1 `:25` 运行时依赖图规则）。
- `src/generated` 与文档的对齐仍由既有 G8 链（`tools/contract-gen` + `check-contracts.mjs` +
  `tests/contract`）守护；本单不触碰生成链。

## 八、文档面改动

1. **《07-CLI完整参考》§5.6（`07.10`）补全**：原代码块 `CliCommandListResult` 缺右花括号，
   且 `CliCommandView` / `CliCommandConflict` / `CliCommandIndex` / `declaration` 只有散文描述、
   无 TS 定义。按 §5.1 命令级字段表、§5.2 参数模型表、§5.5 冲突语义补全为可编译的完整代码块，
   并在「调用方约定」补 §3.5 两行表格与 `get` 的传输裁决一句。属于**文档残缺补全**，
   不改变任何已发布语义、不新增成员。
2. **《02-SDK-API规范》§3.5（`02.03`）**：补「传输映射」小节，登记 SDK 侧方法 → 能力 ID /
   服务路由名的映射与 `get` 的裁决；同步修正 §3.5 中 `CliCommandView` 相关引用。
3. 《02-SDK-API规范》§2.2 **不改**（见第四节判定）；错误码分件 **不改**（本单不新增码）。
4. `packages/sdk/开发日志.md`：登记本轮条目，结论口径写明「文档正确、实现缺位 → 实现补齐」。

## 九、验收与遗留

验收命令与真实退出码见本目录 `验收证据.md` 与 `packages/sdk/开发日志.md`。

遗留（不构成本单红点，需另轮收口）：

1. `packages/cli/src/client/types.ts` 私有镜像类型面与 SDK 契约的双份事实源（审计面 1 第 3 条，
   需裁定归属包与转发方向；`owner` vs `pluginId` 字段名分歧在收口时一并裁决）。
2. §2.2 `:56` 把 manifest 类型标注为「SDK 定义」，实际定义在 `@chips/scaffold`（`tools/scaffold`）。
   本单以「主入口 `export type` 再导出」打通可达性，未搬定义；若要让定义与文档归属完全一致，
   需一次 `sdk ↔ scaffold` 方向反转改动 + G9 边界表复核，建议单独派单。
3. §2.2 `:56` 行注（`packages/sdk/src/scaffold/index.ts:23-43` 之外）：`@chips/scaffold` 的
   `IPluginManifest` 尚无 `cli.commands` 字段类型，插件清单侧 `cli.commands` 声明目前无官方
   manifest 类型（本单的 `CliCommandDeclaration` 是发现面视图，不是清单声明面）。
4. §5.6/§5.8 的服务路由提供方（`cli.command.*` / `cli.task.*`）在平台侧仍未交付
   （`packages/cli/开发日志.md` 已登记），SDK 封装的端到端联通待内核路由落地后由 e2e 覆盖。
5. `cliCommand` / `cliTask` 的运行时可用面依赖注入型目标：默认 `window.chips` 只能应答
   `cli:task-*` 能力，`cli.command.*` 与 `cli.task.create/bindInvocation/cancel` 需平台注入
   服务路由目标——该差异已在 §3.5 表格与 `:241-242` 行文中固化，SDK 不做能力探测。
