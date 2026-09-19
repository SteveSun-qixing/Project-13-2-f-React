# 阶段四 TUI 交互式命令构建器记录

## 1. 本阶段目标

本阶段在 Host 动态命令索引、传统 CLI 执行器和 app/module 脚手架默认 `cli.commands` 基础上，落地键盘优先 TUI 命令构建器。

交付边界：

- `chips` 空命令在交互式终端中进入 TUI。
- `chips --interactive` 可显式进入 TUI。
- `chipsdev` 空命令在交互式终端中进入开发工作区 TUI。
- `chipsdev --interactive` 可显式进入开发工作区 TUI。
- 非 TTY 环境稳定返回提示，避免 CI 或脚本被阻塞。
- TUI 从 `cli.command.list` 读取当前已启用 app/module 插件命令。
- TUI 命令执行复用传统 CLI 执行器，不新增第二套插件调用路径。
- TUI 状态机可单元测试，终端渲染层保持无第三方依赖。

## 2. 代码改动

### 2.1 TUI 状态机与渲染器

改动文件：

- `Chips-Host/src/main/cli/interactive.ts`
- `Chips-Host/tests/unit/cli-interactive.test.ts`

新增能力：

- 从 `cli.command.list` 命令视图创建交互模型。
- 按命令层级动态展示下一段命令片段。
- 支持同一路径多个插件 owner 的选择视图。
- 支持命令构造区 token 化、带空格 token 引号处理和最终命令展示。
- 支持 `↑ / ↓ / Enter / Tab / Esc / Backspace / Ctrl+L / Ctrl+C`。
- 支持必填参数缺失状态提示。
- 支持 `select / multiSelect / toggle / stepper / slider / pathInput / pasteBox / textarea` 控件的基础键盘输入模型。
- 支持在命令完整时产生执行 effect，将最终 tokens 交给调用方。
- 渲染输出包含命令构造区、状态区、候选列表和键盘 footer。

### 2.2 Host CLI 入口接入

改动文件：

- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/tests/e2e/cli.test.ts`
- `Chips-SDK/cli/index.js`
- `Chips-SDK/tests/run-cli-host-managed-tests.cjs`

新增行为：

- `runCli([])` 在 TTY 环境启动 TUI。
- `runCli(['--interactive'])` 显式启动 TUI。
- 非 TTY 空命令输出 “TUI requires an interactive terminal” 提示并返回 `0`，用于脚本和 CI 安全。
- 非 TTY 显式 `--interactive` 输出同类提示并返回 `1`。
- TUI 执行命令时调用既有 `tryRunPluginCliCommand`，因此继续复用：
  - Host 动态命令索引；
  - 最长前缀匹配；
  - `--plugin` 消歧；
  - 参数解析与 `mapsTo`；
  - 路径、JSON、文本文件等校验；
  - module `module.invoke` / `module.job.get`；
  - app `surface.open` / `plugin.launch` / `command.invoke`。

### 2.3 chipsdev 开发工作区入口

改动文件：

- `Chips-SDK/cli/index.js`
- `Chips-SDK/tests/run-cli-host-managed-tests.cjs`

新增行为：

- `chipsdev` 不带参数时委托 Host CLI 空命令入口，但 `CHIPS_HOME` 固定为开发工作区。
- `chipsdev --interactive` 显式委托 Host CLI `--interactive`。
- `chipsdev` 不重新实现 TUI 状态机，只负责开发工作区解析与 Host CLI 转发，符合 SDK 不承载 Host 运行时主实现的边界。
- 非 TTY 下 `chipsdev` 空命令返回 `0`，显式 `--interactive` 返回 `1`，两者都输出 Host TUI 的交互终端提示。

## 3. 公共文档同步

已更新：

- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`

文档同步重点：

- `chips` 与 `chips --interactive` 的 TUI 入口。
- 非 TTY 环境的退回行为。
- TUI 的三段布局：命令构造区、状态区、候选/控件区。
- 键盘操作说明。
- TUI 控件与 `cli.commands` 参数 `ui.control` 的对应关系。
- TUI 执行仍复用传统 CLI 执行器和 Host 正式路由。
- `chipsdev` 空命令与 `chipsdev --interactive` 使用同一 Host TUI，但工作区固定为开发工作区。

## 4. 已通过验证

```text
cd Chips-Host && npx vitest run tests/unit/cli-interactive.test.ts tests/e2e/cli.test.ts --testNamePattern "interactive|non-tty"
cd Chips-Host && npm run build
cd Chips-SDK && node ./tests/run-cli-host-managed-tests.cjs
cd Chips-SDK && node ./tests/run-cli-smoke-tests.cjs
```

覆盖点：

- 交互式模型能解析带引号的命令行。
- 初始命令树能逐级补全命令片段。
- 缺少必填参数时展示参数控件。
- 路径参数录入后能继续提示必填枚举选项。
- 枚举选择后能产生可执行 effect 和最终命令 token。
- 可选布尔参数能通过 toggle 控件追加。
- 渲染输出包含键盘操作 footer。
- 非 TTY 下 `chips` 和 `chips --interactive` 均不会阻塞。
- 非 TTY 下 `chipsdev` 和 `chipsdev --interactive` 均不会阻塞，并使用开发工作区 Host CLI 转发。

## 5. 后续阶段

后续建议继续推进：

1. 细化 human 输出模板、生成文件列表、输出目录规则和覆盖策略。
2. 增加批量输入文件格式、shell completion 和 CLI / TUI 操作日志。
