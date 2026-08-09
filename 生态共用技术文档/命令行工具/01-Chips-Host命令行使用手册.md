# Chips Host 命令行使用手册

## 概述

Chips Host命令行工具是管理本地薯片生态实例的核心工具。通过命令行，用户可以完成应用的启动、停止、配置、状态查询等操作。命令行工具适合高级用户和自动化脚本使用。当前正式入口统一为 `chips`，不再使用 `chips host` 二级命令。

## 命令格式

命令行使用统一的命令格式。格式为chips [命令] [选项] [参数]。命令是具体操作，选项以双横线开头，参数是命令需要的输入值。

帮助信息可以使用chips help查看。帮助文档包含所有命令的说明和使用示例。特定命令的帮助可以使用chips help [命令]查看。

## 启动命令

`chips` 会在执行命令时自动确保当前工作区存在，并按命令类型启动所需的 Host 承载环境。用户执行插件 CLI 命令、进入 TUI、补全或查询状态前，不需要先手动运行 `chips start`。

`chips start` 是显式状态管理入口，用于把当前工作区标记为运行中并供 `chips status`、诊断和脚本检查使用。插件命令的真实执行不依赖这个状态文件；模块目标会由 CLI 启动 Host 运行时调用 `module.invoke`，应用目标在需要应用页面注册 `commandId` 时会自动拉起 Electron Host 承载应用 surface，再通过 `command.invoke` 投递命令。

当前 `chips start` 不接收额外参数。执行成功后会写入当前工作区 `host-state.json`，内容包含 `running / pid / startedAt`，便于 `chips status` 读取。

## 停止命令

停止命令清除当前工作区运行状态。使用命令 `chips stop` 会移除 `host-state.json` 并输出 `{ running: false }`。插件 CLI 命令的自动承载链路不要求先运行 `chips stop` 或 `chips start`。

## 状态命令

状态命令查看当前工作区状态。使用命令 `chips status` 可以查看当前工作区路径、工作区类型，以及 `chips start` 写入的 `running / pid / startedAt` 状态标记。该命令不读取系统进程表，也不承诺返回端口、资源使用或连接数。

`chips status` 默认输出 JSON 结构，便于程序解析和自动化脚本使用。

## 配置命令

配置命令管理应用配置。使用命令chips config可以查看和修改配置。

查看配置命令chips config list可以列出所有配置项。配置项包括应用设置、服务配置、插件配置等。配置项以键值对形式显示。

修改配置命令chips config set可以修改配置项。修改格式为chips config set [键] [值]。修改后需要重启应用生效。

重置配置命令chips config reset可以重置为默认配置。重置会删除所有自定义配置。执行前需要确认。

## 日志命令

日志命令查看应用的日志输出。使用命令chips logs可以查看日志。日志包含运行信息、错误信息、调试信息等。

实时日志选项-f或--follow可以实时查看日志输出。实时日志会在新的日志产生时自动显示。按Ctrl+C退出实时模式。

日志级别选项-l或--level可以过滤日志级别。可以选择debug、info、warn、error等级别。只显示指定级别及以上的日志。

日志行数选项-n或--lines可以限制显示的行数。默认显示最后100行。指定行数可以快速查看最近的日志。

## 文件入口命令

文件入口命令用于通过主机打开文件关联目标。使用命令chips open [文件路径]。该命令用于模拟系统文件关联触发后的主机入口行为。

当输入是card或box文件时，主机会执行对应解析并触发窗口打开链路。若存在声明了`file-handler:<扩展名>`能力且已启用的应用插件，主机会统一调用 `plugin.launch` 打开该应用插件，并在启动上下文中写入：

- `trigger: 'file-association'`
- `targetPath`
- `fileOpenMode`

其他文件路径会调用系统shell打开。

在Electron运行时，窗口由真实BrowserWindow承载；在非Electron环境（如CLI测试）下使用内存窗口模型维持一致接口行为。

## 应用快捷方式启动补充

应用插件的系统快捷方式由 Host 正式接口创建，不通过 CLI 命令直接写入。当前链路行为如下：

1. 治理类应用调用 `plugin.createShortcut(pluginId, { replace? })`；
2. Host 生成平台对应的系统入口：
   - Windows：桌面 `.lnk`
   - macOS：`~/Applications/Chips Apps/*.app`，显示于启动台
3. 快捷方式启动时，Host Electron `app-entry` 解析以下关键参数：
   - `--workspace=<workspacePath>`
   - `--chips-launch-plugin=<pluginId>`
4. Host 将该请求统一转发到 `plugin.launch`，并在启动上下文中写入 `trigger: 'app-shortcut'`。

当前 Host 在全部窗口关闭后仍保持后台静默待机，因此用户可在 Host 没有可见窗口时继续通过快捷方式直接拉起应用。

## 插件管理命令

插件管理命令安装、卸载、查看插件。使用命令chips plugin进行插件管理。

安装插件命令chips plugin install可以安装插件。参数支持插件目录、`.cpk` 文件路径、manifest 文件路径。安装过程会验证清单并复制到主机插件目录。

当输入为 `.cpk` 文件时，当前 Host 要求插件包满足以下契约：

- 插件包必须是 ZIP Store 模式，也就是“ZIP 存储但不压缩”；
- 包根目录必须存在 `manifest.yaml`、`manifest.yml`、`manifest.json` 或 `*.plugin.json`；
- 插件运行产物应位于包内 `dist/` 目录；
- 包内不应再嵌套历史 `.cpk` 文件、重复 manifest 或无关发布元数据。

推荐的标准工作流是先在插件工程目录执行 `chipsdev-r build && chipsdev-r package`，再执行 `chips plugin install <cpk路径>`。若包格式不符合要求，命令会返回如 `PLUGIN_PACKAGE_INVALID` 的结构化错误。

在生态根工作区中，`chips` 命令应由根 `package.json` 显式声明的本地 `chips-host` 工具依赖提供；若开发机使用 Volta，还需要各子工程通过 `volta.extends` 继承根配置，避免 `chips` 回退到旧的全局工具版本。

卸载插件命令chips plugin uninstall可以卸载插件。参数是插件ID。卸载会删除插件文件和配置。

列出插件命令chips plugin list可以列出已安装插件。列表显示插件ID、名称、版本、状态等信息。

启用插件命令chips plugin enable可以启用已安装插件。禁用插件命令chips plugin disable可以停用插件。查询命令chips plugin query可按插件类型或 capability 查看运行时记录。

## 插件 CLI 命令发现

Host 支持从已安装应用插件和模块插件的 `manifest.yaml` 读取 `cli.commands` 声明，并在运行时派生当前工作区的命令索引。

当前已落地的正式发现路由：

- `cli.command.list`：返回完整索引和按条件过滤后的命令列表。
- `cli.command.get`：按 `commandId` 或 `commandPath` 获取唯一命令；如果多个已启用插件声明同一路径，会返回 `CLI_COMMAND_CONFLICT`。
- `cli.command.resolve`：按 `commandId`、`commandPath` 和可选 `pluginId` 解析命令，并返回冲突组。

索引命令记录包含：

- `commandId`
- `commandPath`
- `commandPathKey`
- `owner.pluginId / owner.pluginType / owner.pluginName / owner.pluginVersion`
- `enabled`
- `declaration`
- `conflicts`

插件安装、启用、禁用或卸载后，Host 会重新派生索引版本。禁用插件的命令在默认查询中不会作为可执行命令返回，但可通过 `includeDisabled: true` 进入治理视图。

插件 CLI 命令执行入口：

```bash
chips <commandPath> [arguments] [options]
chips --plugin <pluginId> <commandPath> [arguments] [options]
```

执行规则：

- Host 固定命令根保留给内建命令，插件命令不得以 `help / host / start / stop / status / config / logs / theme / plugin / update / doctor / open / completion` 开头。
- CLI 使用最长前缀匹配已启用插件的 `commandPath`，剩余 token 按该命令的 `arguments / options` 解析。
- `--plugin <pluginId>` 用于同一路径存在多个插件命令时手动限定 owner；未限定且存在冲突时返回 `CLI_COMMAND_CONFLICT`。
- 执行插件 CLI 命令时，`chips` 会自动启动本次命令所需的 Host 承载环境；用户不需要先执行 `chips start`。
- 模块目标走 `module.invoke`；若返回 job 且命令未声明 `job.wait: false`，CLI 会轮询 `module.job.get` 至 `completed / failed / cancelled`。
- 应用目标根据声明调用 `surface.open` 或 `plugin.launch`；声明 `target.commandId` 的执行类命令会通过 `surface.open` 创建 `presentation.visible: false` 的后台 surface，等待应用通过正式 SDK/Bridge 注册目标 command 后再调用 `command.invoke`，不会主动聚焦或显示窗口。若应用命令声明等待任务，CLI 会先创建 `cli.task`，把 `taskId` 写入 launch params 与 command context，并等待应用通过 SDK `client.cliTask.progress/complete/fail/cancel` 上报终态。
- 当应用目标声明 `target.commandId` 且当前 CLI 进程不在 Electron 中运行时，CLI 会自动启动短生命周期 Electron Host runner。runner 负责后台加载应用插件页面、等待应用通过正式 SDK/Bridge 注册目标 command，再执行 `command.invoke` 并等待 `cli.task` 终态；因此应用插件命令不会因为用户未提前启动 Host 而返回 `CLI_COMMAND_NOT_READY`，也不需要向用户展示应用窗口。
- 不声明 `target.commandId`、只负责打开或聚焦应用的 CLI 入口不会使用短生命周期 runner，避免打开的应用 surface 随 runner 退出而关闭。
- 等待期间，最终 stdout 仍只输出结构化结果；TTY 下 CLI 会把去重后的 `job.progress` 或 `task.progress` 以原地刷新的进度行写入 stderr，若进度包含 `percent` 则显示百分比进度条，若包含 `stage` 则显示阶段名，避免污染脚本解析 stdout。
- 非交互环境默认不显示进度；需要人工观察或调试时可设置 `CHIPS_CLI_JOB_PROGRESS=1`，CLI 会把每次变化的进度按行写入 stderr。
- 若命令声明 `job.cancelOnInterrupt: true`，等待模块 job 时按 `Ctrl+C` 会调用 `module.job.cancel({ jobId })`，等待应用 cli task 时会调用 `cli.task.cancel({ taskId })`，随后继续等待 Host 返回 `cancelled` 终态并按对应结构化错误码退出。
- `path / jsonFile / textFile` 等参数会在 CLI 层按当前工作目录解析；`path.exists / path.kind / path.extensions / path.create` 由 CLI 先行校验。
- `path.role: output` 表示该路径是输出目标。输出路径已存在时，默认按 `fail` 返回 `CLI_OUTPUT_EXISTS`；声明 `path.overwrite: overwrite` 时允许继续；声明 `rename` 时会把 payload 中路径改写到同目录未占用的新名称；声明 `skip` 时不调用插件目标并返回 `{ ok: true, skipped: true }`。
- 用户可传入 `--overwrite` 覆盖输出路径声明中的默认冲突策略；若插件命令自己声明了 `overwrite` 选项，该选项仍按普通参数进入 payload。
- `textFile` 可声明 `batch.format: lines`，CLI 会按行读取、过滤空行并映射为数组；`jsonFile` 可声明 `batch.format: json-array`，CLI 会要求文件顶层为数组。
- 批量项若声明 `batch.itemType: path`，每一项都会先按当前工作目录解析为绝对路径，并可用 `batch.itemPath.kind / exists / create / extensions` 逐项校验；批量格式或逐项校验失败返回 `CLI_BATCH_INVALID`。
- 命令执行成功时默认输出结构化 JSON；若命令声明 `output.mode: human` 且用户未传入 `--json`，CLI 会输出人读摘要。`--json` 始终强制机器可读 JSON。错误输出包含 `error / code / details / retryable`。

官方 app/module 脚手架生成的 `manifest.yaml` 已默认包含插件 CLI 命令示例。应用模板默认生成 `<项目命令根> open`，通过 `surface.open` 打开当前应用；模块模板默认按能力 schema 生成 `<项目命令根> run / run-async / convert / render / process / colors / execute` 等入口。项目命令根由项目名派生并避开 Host 固定命令根，安装启用后可立即被 `cli.command.list`、shell completion 与 `chips <commandPath>` 发现。

## Shell 补全

Host CLI 可以输出当前 shell 的补全脚本：

```bash
chips completion bash
chips completion zsh
chips completion fish
```

补全脚本会在每次补全时调用 `chips __complete ...`，该私有入口读取当前工作区 Host 动态命令索引，并合并 Host 固定命令树。因此，插件安装、启用、禁用或卸载后，下一次 Tab 补全会自动反映最新命令，不需要重新安装补全脚本或重启 Host。补全只提供候选，真实执行仍使用传统 CLI 执行器并重新经过最长前缀匹配、冲突消解、参数解析、路径校验和 Host 正式路由。

## CLI 交互式 TUI

`chips` 在交互式终端中不带任何参数直接运行时，会进入 CLI 命令构建器：

```bash
chips
chips --interactive
```

入口规则：

- `chips` 空命令在 TTY 环境进入交互式界面；
- `chips --interactive` 可显式进入交互式界面；
- 非 TTY 环境不会阻塞，空命令输出 TUI 需要交互式终端的提示并返回 0，显式 `--interactive` 返回 1；
- TUI 同时展示 Host 系统指令和 `cli.command.list` 返回的当前已启用 app/module 插件命令，不读取插件源码或绕过 Host 运行时。
- 系统指令包括 `help / start / stop / status / config / logs / theme / plugin / update / doctor / open / completion` 等固定命令根；插件命令不得占用这些根。

界面结构：

- TUI 使用纯终端字符界面，不输出彩色前景、彩色背景或闪烁样式；外层以 Unicode 圆角边框承载，整体从上到下固定为顶部命令框、动态交互区、底部提示栏三块；
- TUI 进入交互界面时使用备用终端屏幕并隐藏真实终端光标，退出时恢复；每次按键或输出刷新只更新发生变化的行，避免整屏清空造成闪烁；
- TUI 会按当前终端列宽和行高重新排版。列宽不足时裁剪长文本，行高不足时优先保留顶部命令框、底部提示栏和当前焦点区域的摘要，避免窗口缩放后内容溢出滚屏；
- 顶部命令框始终显示当前已拼接的完整命令，显示形态为 `chips > ...`，当前待输入或待确认片段会实时进入预览，光标以静态 `_` 下划线表示；
- 动态交互区是唯一焦点区域，会根据当前命令构建阶段切换为二级/三级指令列表、参数选择列表、滑动条、粘贴输入框或多选框；
- 底部提示栏只展示键盘操作，不参与焦点。第一行随当前控件变化，第二行固定展示 `Backspace 返回上级 / Ctrl+C 取消命令 / 命令完整后 Enter 执行 / Ctrl+\ 退出`；
- 命令完整时，动态区第一项固定为 `命令已完整`，底部 `Enter 执行` 前会出现 `▶` 标记；按 `Enter` 会立即执行当前命令。若还需要追加可选参数，可用 `↑ / ↓` 移动到附加参数项继续补充。

键盘操作：

- `↑ / ↓`：在列表和多选框中移动当前项；
- `← / →`：在滑动条中调节数值，在输入框中移动输入光标；
- `Space`：在多选框中切换当前项选中状态；
- `Enter`：确认当前列表项、输入值、滑块值或多选结果；命令完整且当前项为 `命令已完整` 时执行命令；
- `Backspace`：非输入框模式下删除最后一个命令片段并返回上级；输入框模式下只删除输入框内字符；
- `Ctrl+C`：在构建界面清空当前命令并回到初始指令列表；执行中会请求取消当前命令；
- `Ctrl+\`：退出 TUI。

参数控件由 `cli.commands` 中的参数类型和 `ui.control` 驱动：

- `select`：渲染为互斥参数选择列表；
- `multiSelect`：渲染为多选框，确认后把选中值用逗号传给同一个参数；
- `toggle` 和多个可选布尔参数：渲染为多选框，确认后把选中的 flag 逐个追加到命令 token；
- `stepper / slider`：渲染为滑动条，按 `ui.min / ui.max / ui.step` 或 `validation.min / validation.max` 调节数值；
- `pathInput / pasteBox / textarea`：渲染为粘贴输入框，支持直接键入、标准终端粘贴、光标移动与退格。

执行中与结果展示：

- 命令完整后按 `Enter`，动态交互区切换为执行中面板，显示命令、实时输出、进度条和 `Ctrl+C` 中止提示；
- TUI 会捕获传统 CLI 执行器写入 stdout/stderr 的内容，并在执行中面板滚动展示；若底层模块 job 或应用 cli task 输出进度，stderr 进度行也会进入实时输出；
- 执行中按 `Ctrl+C` 会向当前执行链路发送中止信号。对于声明 `job.cancelOnInterrupt: true` 的模块 job 或应用 cli task，Host 会继续复用正式取消链路；
- 命令结束后，动态交互区切换为结果面板，展示成功/失败/已中止状态、退出码、耗时、最多 10 至 15 行输出和错误摘要；
- 结果面板支持 `↑ / ↓` 滚动输出，`Enter` 返回构建界面，`R` 重新执行上一条命令，`Ctrl+C` 退出 TUI。

执行时 TUI 会把最终命令 token 交回传统 CLI 执行器。系统指令继续走现有 Host CLI 分支；插件指令继续复用同一套最长前缀匹配、`--plugin` owner 消歧、参数解析、路径校验、payload 映射、module job 等待和 app surface 打开链路。TUI 不定义第二套执行语义，也不提供历史命令搜索。

当前已落地传统命令行执行器、Host 动态命令索引、shell completion、job 进度条 stderr 展示、TUI 命令构建器和 CLI/TUI 操作日志。更细粒度的 human 输出模板仍以后续阶段为准，但必须继续复用同一命令索引、参数解析和 Host 路由执行边界。

## CLI / TUI 操作日志

Host CLI 会把内建命令、插件命令、TUI 执行和 shell completion 请求都记录到工作区 `host-logs.jsonl`。日志通过 Host `log.export` 汇出，用户可以使用 `chips logs` 查看。

操作日志使用结构化 `LogEntry`，其中 `namespace` 为 `cli`、`action` 为 `operation.execute`；`metadata.source` 区分 `cli / tui / completion`，并记录脱敏后的命令行、参数 token、工作区类型、退出码、插件命令 ID、命令路径、目标类型、耗时和错误对象。包含 token、secret、password、credential、api key 等敏感键名的参数值必须脱敏。

## 主题管理命令

主题管理命令用于查看和校验当前主机工作区中的可用主题。使用命令chips theme进行主题管理。

- 列出主题：  
  使用命令chips theme list列出当前工作区中所有已启用主题。输出包含主题ID、名称、版本等信息。

- 查看当前主题：  
  使用命令chips theme current查看当前生效的主题。输出包括当前主题ID和显示名称。

- 应用主题：  
  使用命令chips theme apply [主题ID]切换当前主题。目标主题必须已经通过 `chips plugin enable` 进入当前工作区的可用主题集合。命令会调用主题契约门禁，若主题不满足契约要求会返回错误。

- 解析主题：  
  使用命令chips theme resolve [主题ID]查看指定主题解析后的token视图。不指定主题ID时，默认解析当前主题。

- 查看主题契约：  
  使用命令chips theme contract [组件名]查看当前主题下指定组件的契约定义。组件名为空时返回所有组件契约。

- 校验主题：  
  使用命令chips theme validate对所有已启用主题执行批量校验。校验内容包括：
  - 通过theme.apply执行契约门禁；
  - 通过theme.resolve验证token解析是否成功。  
  命令会输出每个主题的校验结果，便于在持续集成或发布前执行质量门禁。

## 更新命令

更新命令保留为 Host 更新链路的正式入口。当前未配置外部更新提供方时，`chips update check` 返回当前版本、`provider: "local"` 和 `updateAvailable: false`；`chips update install` 返回 `installed: false` 并说明当前工作区未配置外部更新提供方。

后续接入正式更新服务器时，仍应复用 `chips update check|install` 两个入口，并同步补充下载、校验、确认和回滚策略。

## 诊断命令

诊断命令帮助排查问题。使用命令chips doctor进行系统诊断。

诊断检查会验证多个系统组件。包括网络连接、磁盘空间、依赖完整性等。诊断结果会显示每个检查项的状态。

详细诊断选项-v可以显示详细的诊断信息。详细信息包括检查的具体内容和结果。详细诊断用于深入排查问题。

修复选项--fix可以自动修复发现的问题。部分问题可以自动修复，如清理缓存、重置配置等。

## 环境变量

命令行使用环境变量配置行为。`CHIPS_HOME` 指定应用数据目录；`CHIPS_WORKSPACE_KIND` 标记工作区类型，`user` 为用户工作区，`dev` 为开发工作区。

环境变量可以在Shell配置文件中设置。设置后命令行会自动使用这些变量。环境变量优先级高于默认配置。

## 脚本集成

命令行可以集成到脚本中使用。脚本可以调用命令并检查返回码。返回码0表示成功，非0表示错误。

管道和重定向可以处理命令输出。输出可以传输给其他命令处理。错误输出可以重定向到日志文件。

计划任务可以定时执行命令。定时任务可以用于备份、清理、自动更新等。计划任务通过系统任务调度器配置。
