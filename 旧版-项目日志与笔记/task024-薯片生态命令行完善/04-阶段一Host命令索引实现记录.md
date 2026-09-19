# 阶段一 Host 命令索引实现记录

## 1. 本阶段目标

本阶段先实现插件 CLI 命令动态发现的底层契约，不包含完整命令执行器、TUI、脚手架模板更新。

交付边界：

- Host 能解析 `manifest.yaml` 中 `cli.commands`。
- `type: app` 和 `type: module` 插件可声明命令。
- Host 暴露只读命令索引路由。
- SDK 提供正式封装。
- 公共文档同步已落地口径。

## 2. 代码改动

### 2.1 Host Manifest 解析

改动文件：

- `Chips-Host/src/runtime/plugin-runtime.ts`
- `Chips-Host/src/runtime/index.ts`

新增模型：

- `CliManifestMeta`
- `CliCommandManifestMeta`
- `CliCommandTargetManifestMeta`
- `CliCommandParameterManifestMeta`

校验规则：

- 只有 `app` 和 `module` 插件可声明 `cli.commands`。
- `target.type` 必须与插件类型一致。
- app target 的 `pluginId` 必须等于当前插件 ID。
- module target 的可选 `pluginId` 必须等于当前插件 ID。
- `titleKey` 必填。
- `commandPath` 必须是非空命令段。
- 命令权限必须已在插件顶层 `permissions` 中声明。
- 同一插件内 `commandId`、参数名和短选项不得重复。

### 2.2 Host 发现路由

改动文件：

- `Chips-Host/src/main/services/register-host-services.ts`
- `Chips-Host/src/main/services/register-schemas.ts`

新增路由：

- `cli.command.list`
- `cli.command.get`
- `cli.command.resolve`

路由权限：

- 均使用 `plugin.read`。

索引来源：

- 当前阶段由 Host 运行时插件注册表即时派生。
- 插件安装、启用、禁用、卸载时更新索引版本。

冲突规则：

- 两个或更多已启用命令拥有相同 `commandPathKey` 时形成冲突。
- `cli.command.resolve` 在未指定 `pluginId` 或 `commandId` 时不自动选择冲突项。
- `cli.command.get` 遇到多个匹配项时返回 `CLI_COMMAND_CONFLICT`。

### 2.3 SDK 封装

改动文件：

- `Chips-SDK/src/api/cli-command.ts`
- `Chips-SDK/src/core/client.ts`
- `Chips-SDK/src/types/client.ts`
- `Chips-SDK/src/index.ts`
- `Chips-SDK/src/contracts/route-manifest.json`

新增入口：

```ts
const client = createClient();

await client.cliCommand.list();
await client.cliCommand.get({ commandPath: "icon generate" });
await client.cliCommand.resolve({ commandPath: "icon generate", pluginId: "chips.module.icon" });
```

## 3. 公共文档同步

已更新：

- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/05-模块插件开发.md`

文档只沉淀已实现的发现层与声明层。CLI 执行器、TUI、脚手架模板更新仍属于后续阶段。

## 4. 验证记录

已通过：

```text
cd Chips-Host && npm run build
cd Chips-Host && npx vitest run tests/unit/plugin-runtime.test.ts tests/integration/host-services.test.ts --testNamePattern "cli|CLI command index|PluginRuntime"
cd Chips-Host && npm run test:contract
cd Chips-SDK && npx vitest run tests/client.test.ts tests/tooling/contract-drift.test.ts
```

覆盖点：

- app/plugin manifest 中 `cli.commands` 解析。
- module/plugin manifest 中 `cli.commands` 解析。
- 非 app/module 插件声明 CLI 被拒绝。
- 未声明顶层权限的命令权限被拒绝。
- Host 命令索引随插件启用/禁用变化。
- 同路径命令冲突被 `cli.command.resolve/get` 暴露。
- SDK `client.cliCommand` 请求参数和响应解包正确。
- Host/SDK route manifest 保持一致。

## 5. 后续阶段

下一阶段建议顺序：

1. 开发 CLI 扩展运行器，支持解析 `cli.commands` 并转发 module/app target。
2. 实现路径解析、输出目录、覆盖策略、JSON/human 输出、错误码和退出码。
3. 接入 module job 等待、进度和取消。
4. 更新 `chipsdev` 应用插件脚手架和模块插件脚手架。
5. 开发键盘优先 TUI 命令构建器。
