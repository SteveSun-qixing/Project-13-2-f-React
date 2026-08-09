# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的标准模块插件工程。

## 简介

本工程面向 `type: module` 的共享功能模块开发。模块插件是安装到 Host 中的无界面能力模块，不创建窗口，不承载页面渲染，不以 DOM 挂载作为正式边界。

模板默认提供以下基线：

- 冻结后的 `manifest.module` 结构；
- `capability + method` 形式的能力定义；
- 同步方法与异步任务方法基线；
- 输入输出 schema 契约文件；
- 单元测试、构建、校验与打包脚本。

## 项目结构

```text
{{ PROJECT_NAME }}/
├─ .eslintrc.cjs
├─ manifest.yaml
├─ package.json
├─ tsconfig.json
├─ chips.config.mjs
├─ contracts/
│  ├─ run.input.schema.json
│  ├─ run.output.schema.json
│  ├─ runAsync.input.schema.json
│  └─ runAsync.output.schema.json
├─ src/
│  └─ index.ts
└─ tests/
   └─ unit/
      └─ module-definition.test.ts
```

## 快速开始

```bash
cd <生态根工作区>
npm install
cd {{ PROJECT_NAME }}
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

模块插件工程应通过 `chipsdev-r create module` 接入生态工作区，不再单独手工拼装依赖。若工程位于生态根工作区内，`chipsdev-r create` 会自动完成工作区注册与 `volta.extends` 写入。

`npm run verify` 会依次执行 lint、typecheck、test、build、validate 和 package。发布或进入开发工作区联调前至少运行一次 `npm run verify`。

## 打包与 Host 联调

生成工程的正式产物是 `.cpk` 插件包：

```bash
npm run verify
npm run package
```

真实 Host 调用必须通过 `chipsdev-r module invoke` 或应用/SDK 的模块服务接口完成：

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method run \
  --input '{"sourceText":"hello"}' \
  --timeout-ms 60000
```

也可以使用等价的 `--capability={{ MODULE_CAPABILITY }}` 参数形式。CLI 会先执行正式构建，随后在开发工作区安装并启用当前模块，再通过 Host `module.invoke` 调用 capability/method；若返回 job，会轮询到 `completed`、`failed` 或 `cancelled` 终态。

## 插件 CLI 命令

`manifest.yaml` 默认声明以下 `cli.commands`，安装并启用插件后可由 Host 动态发现：

```bash
chips {{ CLI_COMMAND_ROOT }} run "hello" --uppercase --prefix "[demo] "
chips {{ CLI_COMMAND_ROOT }} run-async "hello" --delay-ms 25
```

这些命令只声明参数到 `module.invoke.input` 的映射，实际执行仍由 Host `module.invoke / module.job.*` 完成。

## 默认能力定义

模板默认声明一个 capability：

- `{{ MODULE_CAPABILITY }}`

并提供两个方法：

- `run`：同步执行，直接返回结果；
- `runAsync`：异步任务模式，使用 `ctx.job.reportProgress(...)` 汇报进度，并通过 `ctx.job.signal` / `ctx.job.isCancelled()` 感知 Host 取消。

你应根据实际业务替换 capability、方法名与 schema 文件，但要保持：

- Manifest 中 `module.provides` 与仓库中的 contract 文件一致；
- Manifest 中的 `module.consumes` 只声明模块间依赖，不会自动安装或启用下游 provider；
- 模块访问 Host 正式服务动作时使用 `ctx.host.invoke(...)`；
- 模块之间调用统一使用 Host 注入的 `ctx.module.invoke(...)`，目标 capability 必须预先写入 `module.consumes`；
- 不自行实现第二套模块加载器或通信通道。

## 运行治理

- 未指定 `pluginId` 时，Host 会在同一 capability 下选择 `enabled` 或 `running` 且版本范围匹配的最高语义化版本 provider；
- `timeoutMs` 是 Host 方法级超时，sync 方法超时返回 `MODULE_TIMEOUT`，job 方法超时后 job 进入 `failed`；
- `module.job.cancel` 取消运行中 job 后，job 进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`；
- 输入和输出必须通过 `contracts/*.schema.json` 校验，schema 不匹配会被 Host 归一为 `MODULE_SCHEMA_INVALID`。

## 正式约束

- `manifest.yaml` 必须保持 `type: module` 且 `entry: dist/index.mjs`；
- 模块正式能力契约必须写在 `module.provides` 中，而不是旧 `capabilities` 主入口；
- 调用方统一通过 `module.listProviders / module.resolve / module.invoke / module.job.*` 使用模块能力；
- 模块运行时只负责能力实现，不生成任何 UI 运行时、插槽挂载入口或主题注入逻辑；
- 模块不能创建应用窗口，不能直接读写应用私有资源，不能被应用或其他插件跨目录 import；
- 模块访问 Host 服务动作应使用 `ctx.host.invoke(...)`，不得依赖手写服务封装；
- 如果模块需要调用其他模块，只能使用 Host 注入的 `ctx.module.invoke(...)`；
- 每次功能迭代后应同步更新 README 与测试/契约资料，避免把文档目录当作模板产物。
