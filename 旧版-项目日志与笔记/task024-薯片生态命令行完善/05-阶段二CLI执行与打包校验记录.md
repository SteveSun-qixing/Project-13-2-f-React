# 阶段二 CLI 执行与打包校验记录

## 1. 本阶段目标

本阶段在阶段一命令索引基础上继续落地传统 CLI 执行器，并补上用户提出的打包门禁：`chipsdev package` 必须检查 app/module 插件不得定义 `plugin / theme / module / layout` 等不属于自身类型或属于 Host 治理的官方字段。

交付边界：

- `chips <commandPath>` 能执行已启用 app/module 插件声明的 `cli.commands`。
- 支持 `--plugin <pluginId>` 消解同路径插件命令冲突。
- 参数解析、路径校验、payload 映射、模块 job 等待和应用 surface 打开走 Host 正式路由。
- Host 安装与 `chipsdev validate/package` 均拒绝插件 CLI 命令占用 Host 固定命令根。
- `chipsdev package` 在写 `.cpk` 前复用 manifest 形态校验，阻止 app/module 越界声明官方字段。

## 2. 代码改动

### 2.1 Host CLI 执行器

改动文件：

- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/tests/e2e/cli.test.ts`

新增能力：

- 通过 `cli.command.list` 读取当前工作区已启用命令。
- 按最长 `commandPath` 前缀匹配用户输入。
- 支持 `--plugin <pluginId>` 和 `--plugin=<pluginId>` 限定命令 owner。
- 支持 long/short option、boolean、`--no-*`、位置参数和 `--` 后参数。
- 支持参数类型 `string / stringList / number / integer / boolean / enum / path / json / jsonFile / text / textFile`。
- 按 `mapsTo` 写入目标 payload。
- `path` 参数按当前工作目录解析，并支持 `exists / kind / create / extensions` 校验。
- module target 调用 `module.invoke`，job 默认等待到终态。
- app target 调用 `surface.open` 或 `plugin.launch`，并按需 `command.invoke` / `surface.focus`。
- 错误映射到结构化输出与退出码。

### 2.2 Host Manifest 保留命令校验

改动文件：

- `Chips-Host/src/runtime/plugin-runtime.ts`
- `Chips-Host/tests/unit/plugin-runtime.test.ts`

新增规则：

- 插件 `cli.commands[].commandPath` 第一段不得为 Host 固定命令根：
  `help / host / start / stop / status / config / logs / theme / plugin / update / doctor / open`。
- 阶段七新增 `completion` 为 Host 固定命令根；该阶段日志保留阶段二当时的实现范围，最新正式列表以生态共用技术文档为准。
- 运行时安装阶段拒绝占用固定命令根的插件命令，避免命令进入动态索引后与内建命令产生歧义。

### 2.3 SDK 打包与校验门禁

改动文件：

- `Chips-SDK/cli/index.js`
- `Chips-SDK/tests/run-cli-package-compatibility-tests.cjs`

新增规则：

- `chipsdev package` 在检查 `dist/` 与写 `.cpk` 前调用 `validateManifestShape`。
- `chipsdev validate` 与 `chipsdev package` 共享类型专属字段校验。
- `module` 只允许 `type: module` 插件声明。
- `layout` 只允许 `type: layout` 插件声明。
- `theme / themeId / displayName / isDefault / parentTheme` 只允许 `type: theme` 插件声明。
- `ui.surface / ui.launcher / ui.window` 只允许 `type: app` 插件声明。
- `manifest.plugin` 是 Host 插件治理保留字段，app/module 插件不得声明。
- `ui.layout` 不是按插件类型一刀切禁止的字段；应用页面布局和主题契约资产索引仍可使用。
- 若 manifest 校验失败，`chipsdev package` 不生成新的 `.cpk`。

## 3. 公共文档同步

已更新：

- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
- `生态共用技术文档/协议与契约/01-插件契约规范.md`
- `生态共用技术文档/文件格式规范/03-CPK打包格式规范.md`

文档同步重点：

- 插件 CLI 命令执行入口和 `--plugin` 消歧方式。
- Host 固定命令根保留规则。
- app/module 插件打包时不得定义其他类型官方字段或 Host 治理保留字段。
- `chipsdev package` 必须在写包前执行 manifest 形态门禁。

## 4. 验证记录

已通过：

```text
cd Chips-Host && npm run build
cd Chips-Host && npx vitest run tests/unit/plugin-runtime.test.ts tests/e2e/cli.test.ts --testNamePattern "cli.commands|Host fixed|module plugin CLI|app plugin surfaces"
cd Chips-SDK && node ./tests/run-cli-package-compatibility-tests.cjs
```

覆盖点：

- app/module 插件 CLI 声明继续能被安装解析。
- 插件命令占用 `plugin` 固定命令根会被 Host 安装拒绝。
- `chips demo echo hello --count 2` 可执行模块插件命令并完成 payload 映射。
- 缺失路径参数返回 `CLI_PATH_NOT_FOUND` 和路径类退出码。
- 两个启用插件声明同一 `commandPath` 时返回 `CLI_COMMAND_CONFLICT`。
- `chips --plugin <pluginId> <commandPath>` 可消解同路径冲突。
- app 插件 CLI 命令可打开 Host surface 并携带 CLI payload。
- `chipsdev validate/package` 拒绝 app 插件声明 `module / themeId / plugin` 等越界或保留字段。
- `chipsdev package` 拒绝占用 Host 固定命令根的插件命令，并且失败时不生成 `.cpk`。

## 5. 后续阶段

建议后续继续推进：

1. 更新应用插件和模块插件脚手架模板，提供 `cli.commands` 示例、i18n key 和测试基线。
2. 继续完善输出目录规则、覆盖策略、批量输入格式和 human 输出模板。
3. 接入 Ctrl+C 取消 module job 的正式 CLI 行为。
4. 开发键盘优先 TUI 命令构建器，复用现有命令索引和参数解析模型。
