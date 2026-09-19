# Chips Dev 开发者命令行手册（chipsdev-r）

> **状态注记（task030 卸担计划，2026-08）**：主题系统与自研组件库已废弃（插件侧改用 antd + `@chips/ui`）。本手册中 `chipsdev-r theme*`、`chipsdev-r create theme`、`component gallery`、`quality gate` 等主题/组件库相关命令为 **Host 工具链保留能力**（Host 服务面未清理），仍可执行；插件开发不再创建主题插件工程，不再消费组件库报告。前端插件现行口径见 `生态共用技术文档/前端基础/`。

## 概述

`chipsdev-r` 是薯片生态正式的开发者命令行工具，随 `chips-sdk` 一起交付。它负责工程创建、构建、测试、打包、运行，以及开发工作区内的 Host 管理能力。

旧文档中的 `chips dev` 写法已经废弃，当前正式入口只有独立命令 `chipsdev-r`。

## 安装配置

在生态一方仓库中，`chipsdev-r` 的正式安装方式是通过生态根工作区安装：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f
npm install
```

安装完成后：

- 生态根 `package.json` 提供根级 `chips-sdk` 工具依赖；
- 各子工程通过 `volta.extends` 指向生态根；
- 在任意一方工程目录执行 `chipsdev-r`，都会命中当前工作区中的正式实现。

## 工作区模型

`chipsdev-r` 始终操作开发工作区，不操作用户工作区。

- 用户工作区：`chips` 默认使用 `~/.chips-host`
- 开发工作区：`chipsdev-r` 默认向上查找 `.chips-host-dev`，找不到时在当前项目根创建

开发工作区与用户工作区完全隔离，以下状态均不互通：

- 插件安装记录
- 插件启用状态
- 当前主题
- Host 配置
- 运行日志与诊断结果
- Electron 运行态数据（开发态位于 `.chips-host-dev/electron-user-data`）

因此，开发者在 `chips` 中切换的主题，不会自动影响 `chipsdev-r run` 的结果；反之亦然。

## 命令总览

### 1. 开发工作区 Host 管理命令

以下命令由 `chipsdev-r` 直接转发到 Host CLI，但工作区固定为开发工作区：

- `chipsdev-r`
- `chipsdev-r --interactive`
- `chipsdev-r start`
- `chipsdev-r stop`
- `chipsdev-r status`
- `chipsdev-r config list|set|reset`
- `chipsdev-r logs`
- `chipsdev-r plugin list|install|uninstall|enable|disable|query`
- `chipsdev-r theme list|current|apply|resolve|contract|validate`
- `chipsdev-r update check|install`
- `chipsdev-r doctor`
- `chipsdev-r open <path>`
- `chipsdev-r completion <bash|zsh|fish>`

这些命令与 `chips` 使用同一套 Host 管理能力，但不会落到用户工作区。

`chipsdev-r` 不带参数时会进入开发工作区的插件 CLI TUI；`chipsdev-r --interactive` 可显式进入同一界面。该 TUI 由 Host CLI 实现，`chipsdev-r` 只负责解析开发工作区并转发，因此命令发现、补全、参数控件、操作日志和执行仍复用 `cli.command.list`、传统 CLI 执行器、`module.invoke / module.job.*`、`surface.open / plugin.launch`、`log.export` 等 Host 正式链路。

`chipsdev-r completion <shell>` 同样委托 Host CLI 生成补全脚本，但生成的脚本注册目标是 `chipsdev-r`，并在每次补全时调用 `chipsdev-r __complete ...`。`__complete` 是 `chipsdev-r` 私有补全入口，会先解析开发工作区，再转发到 Host CLI 的 `__complete`，因此 `chipsdev-r plugin install/enable/disable` 后下一次 Tab 补全即可看到最新 app/module 插件命令，不会落到用户 `chips` 工作区。

开发工作区已安装并启用的插件 CLI 命令也可以直接通过 `chipsdev-r <commandPath> [args] [options]` 调用。`chipsdev-r` 对未知顶层命令不会在 SDK 层提前失败，而是将完整 argv 转发到开发工作区 Host CLI，由 Host 的最长前缀匹配、冲突消解、参数解析和正式路由决定是否执行或返回结构化错误。

非交互终端中，`chipsdev-r` 空命令不会阻塞脚本，会输出 TUI 需要交互式终端的提示并返回成功；显式 `chipsdev-r --interactive` 在非交互终端中返回失败，用于 CI 或脚本识别误用。

### 2. 工程命令

- `chipsdev-r init`：初始化当前工程的 `chips.config.mjs`
- `chipsdev-r create <app|card|layout|module|theme> <targetDir>`：创建新工程。模块工程与主题工程支持追加专用模板参数。
- `chipsdev-r server`：启动 Vite 开发服务器
- `chipsdev-r debug`：以调试预设启动开发服务器
- `chipsdev-r module invoke`：在真实 Electron Host 中调用模块 capability/method
- `chipsdev-r preview`：生成项目预览链路报告
- `chipsdev-r component gallery`：生成组件矩阵与主题契约覆盖报告
- `chipsdev-r theme inspect`：读取主题包 manifest/contracts/tokens/dist 并输出检查报告
- `chipsdev-r quality gate`：汇总项目、SDK、组件库与主题质量门禁报告
- `chipsdev-r assimilate scan/report`：扫描外部 Web 项目并生成同化报告
- `chipsdev-r diagnostics`：输出生态开发工具诊断报告
- `chipsdev-r build`：执行正式构建
- `chipsdev-r test`：执行 Vitest 单元测试
- `chipsdev-r lint`：执行 ESLint 检查
- `chipsdev-r e2e`：执行工程提供的端到端测试
- `chipsdev-r package`：按 `manifest.yaml` 与构建产物生成 `.cpk`
- `chipsdev-r validate`：执行工程级契约校验
- `chipsdev-r login`：写入开发者凭据
- `chipsdev-r publish`：执行发布前校验与元数据整理
- `chipsdev-r version`：输出当前版本
- `chipsdev-r help`：查看帮助

补充约束：

- `chipsdev-r build` 会优先执行工程 `package.json` 中的正式 `build` 脚本；
- 若工程未声明 `build` 脚本，或该脚本本身会再次回调 `chipsdev-r build`，则回退到 SDK 内置构建链路；
- `chipsdev-r package` 除 `dist/` 构建产物外，还会一并打包 manifest 显式引用的正式静态资源；
- `chipsdev-r validate` 与 `chipsdev-r package` 会拒绝类型专属官方字段越界声明，尤其是 app/module 插件不得声明 `plugin / theme / themeId / displayName / isDefault / parentTheme / layout` 等不属于自身类型或属于 Host 治理的字段；
- `chipsdev-r validate` 与 `chipsdev-r package` 会校验 `manifest.cli.commands` 中输出路径、覆盖策略和批量输入元数据：`path.overwrite` 只允许用于 `type: path` 且 `path.role: output` 的参数，`batch.format: lines` 只允许 `textFile`，`batch.format: json-array` 只允许 `jsonFile`；
- 当前正式收集范围至少包括：
  - `preview`
  - `ui.layout.contract`
  - `ui.layout.minFunctionalSet`
  - `ui.launcher.icon`
  - `screenshots[].path`
- `chipsdev-r validate` 对上述资源执行存在性检查，并要求与 `package` 的打包范围保持一致。

## `chipsdev-r run` 的正式行为

`chipsdev-r run` 当前只支持应用插件（`manifest.type === "app"`）。执行时会完成以下正式链路：

1. 读取当前工程 `chips.config.mjs`；
2. 通过 Vite 构建应用产物，并将 app 构建基准路径固定为相对路径；
3. 对 `react`、`react-dom` 及 JSX runtime 做工程根级去重与别名收敛；
4. 使用工程根 `manifest.yaml` 作为唯一安装清单；
5. 解析开发工作区 `.chips-host-dev`；
6. 若开发工作区尚无已启用主题插件，则自动引导默认主题包进入该工作区并设为当前主题；
7. 拉起真实 Electron Host 主进程，并将 Electron `userData` 绑定到 `.chips-host-dev/electron-user-data`；
8. 先按开发工作区 `plugins.json` 重新同步其中已配置的插件副本，确保 Host 运行时不会继续消费旧安装残留；
9. 在开发工作区中安装并启用当前应用插件；
10. 通过 Host `window` 服务打开应用窗口。

补充语义：

- 第 8 步会按 `plugins.json` 中的 `manifestPath` 重新安装已配置插件，并保留各插件在开发工作区中的启用状态；
- 若 `plugins.json` 中存在相对路径，`chipsdev-r run` 会按工程/工作区上下文解析为真实清单路径；
- 若 `plugins.json` 中记录的是已丢失的 `dist/*.cpk` 开发产物，而对应工程根仍存在正式 `manifest.yaml`，`chipsdev-r run` 会回退到工程清单继续同步；
- 若某条历史插件记录的来源已经不存在，或来源工程尚未完成正式构建导致入口资产缺失，`chipsdev-r run` 会输出告警并跳过该条同步，不中断当前目标应用启动；
- 当前目标应用自身会在同步阶段被跳过，随后再单独重装并启用，避免重复处理。

## `chipsdev-r module invoke` 的正式行为

`chipsdev-r module invoke` 是模块插件在开发工作区中的正式 Electron 联调入口，适用于：

- 直接调试模块 capability/method；
- 验证依赖 Electron `BrowserWindow` 的模块能力；
- 验证同步返回和异步 job 返回。

正式用法：

```bash
chipsdev-r module invoke \
  --capability <capability> \
  --method <method> \
  [--input '<json>'] \
  [--input-file /绝对路径/input.json] \
  [--manifest /绝对路径/manifest.yaml] \
  [--timeout-ms 60000]
```

上述参数均支持空格形式与 `--参数=值` 形式。未知参数会直接报错，不会被静默忽略。

执行时会完成以下正式链路：

1. 解析开发工作区 `.chips-host-dev`；
2. 若开发工作区尚无已启用主题插件，则自动引导默认主题包进入该工作区并设为当前主题；
3. 若当前目录或 `--manifest` 指向模块插件工程，则先执行正式构建；
4. 拉起真实 Electron Host 主进程，并将 Electron `userData` 绑定到 `.chips-host-dev/electron-user-data`；
5. 在开发工作区中安装并启用目标模块插件；
6. 通过 Host `module.invoke` 发起 capability/method 调用；
7. 若模块返回 `mode = "job"`，则持续轮询到 `completed/failed/cancelled` 终态；
8. 以 JSON 输出最终结果。

补充边界：

- 第 3 步中的“正式构建”与 `chipsdev-r build` 保持同一语义：优先执行工程自己的正式 `build` 脚本，再按需要回退到 SDK 内置构建链路；
- `--timeout-ms` 会同时作为 CLI 等待窗口与 Host `module.invoke.timeoutMs` 传入；sync 方法超时返回 `MODULE_TIMEOUT`，job 方法超时后 job 进入 `failed` 终态；
- 模块调用完成后，联调用 Electron Host 会在输出结果后主动退出，不继续常驻；
- `chipsdev-r start/stop/status/config/logs/plugin/theme/open` 仍然是开发工作区 Host 管理命令，底层委托给 Host CLI；`start/stop/status` 管理开发工作区状态标记，不承担真实 Electron `BrowserWindow` 宿主联调职责；
- 这些命令不承担真实 Electron `BrowserWindow` 宿主联调职责；
- 因此，依赖 `platform.renderHtmlToImage`、`platform.renderHtmlToPdf` 之类 Electron 渲染导出能力的模块，必须使用 `chipsdev-r module invoke` 验证。

## `chipsdev-r create module` 的模板参数

模块插件脚手架支持按模块形态选择模板：

```bash
chipsdev-r create module <targetDir> \
  --template module-file-conversion \
  --plugin-id chips.module.file.convert \
  --capability converter.file.convert
```

正式参数：

- `--template <id>` 或 `--template=<id>`：选择 `chips-scaffold-module` 中的模块模板；默认是 `module-standard`。
- `--plugin-id <id>` 或 `--plugin-id=<id>`：覆盖默认插件 ID。
- `--capability <capability>` 或 `--capability=<capability>`：覆盖默认 `module.provides[].capability`。
- `--consumes <capability>` 或 `--consumes <capability>@<versionRange>`：写入一条 `manifest.module.consumes`；可重复传入。

示例：

```bash
chipsdev-r create module Chips-ModulePlugin/html-render \
  --template module-html-rendering \
  --capability converter.html.render

chipsdev-r create module Chips-ModulePlugin/file-orchestrator \
  --template module-orchestration \
  --capability converter.file.convert \
  --consumes converter.card.to-html@^1.0.0 \
  --consumes converter.html.to-pdf@^1.0.0
```

这些参数只影响生成工程的 manifest、schema、源码和测试基线，不会自动安装或启用下游 provider；真实调用仍通过 Host `module.listProviders / module.resolve / module.invoke / module.job.*` 完成。模块插件通过 `ctx.module.invoke(...)` 调用其他模块 capability 时，Host 会校验调用方 `manifest.module.consumes` 中是否声明了该依赖。

生成工程 README 必须同步上述正式口径：`npm run verify` 覆盖 lint/typecheck/test/build/validate/package，`chipsdev-r module invoke` 是真实 Host 联调入口，`--timeout-ms` 会进入 Host 方法级超时治理，`.cpk` 包必须可被 Host 安装启用后通过模块服务调用。

## `chipsdev-r create theme` 的模板参数

主题包脚手架使用 `Chips-Scaffold/chips-scaffold-theme` 的 `theme-standard` 模板创建完整主题插件工程。该模板以官方默认主题包 vNext 结构为工程基线，生成项目默认包含五层 token、组件 contract、图标字体、主题 CSS、测试与打包脚本。

```bash
chipsdev-r create theme <targetDir> \
  --theme-id theme.my-product \
  --plugin-id chips.theme.my.product \
  --display-name "My Product Theme"
```

正式参数：

- `--template <id>` 或 `--template=<id>`：选择主题模板；默认是 `theme-standard`。
- `--plugin-id <id>` 或 `--plugin-id=<id>`：覆盖默认插件 ID；未提供时按目标目录推导为 `chips.theme.<slug>`。
- `--theme-id <id>` 或 `--theme-id=<id>`：覆盖默认主题技术 ID；未提供时按目标目录推导为 `theme.<slug>`。
- `--display-name <name>` 或 `--display-name=<name>`：覆盖显示名称；未提供时按目标目录转换为标题式名称。
- `--publisher <name>` 或 `--publisher=<name>`：覆盖发行商标识；未提供时按当前系统用户名推导。
- `--version <semver>` 或 `--version=<semver>`：覆盖插件版本；默认 `1.0.0`。
- `--parent-theme-id <themeId>` 或 `--parent-theme-id=<themeId>`：声明父主题 ID；未提供时为空字符串。
- `--description <text>` 或 `--description=<text>`：覆盖主题描述。

生成工程的关键产物：

- `manifest.yaml`：声明 `type: "theme"`、`themeId`、`displayName`、`entry.tokens`、`entry.themeCss`、`ui.layout.contract` 与 `ui.layout.minFunctionalSet`；
- `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`、`tokens/comp/*.json`：五层 token 源文件；
- `src/build-tokens.ts`、`src/build-contracts.ts`、`src/build-css.ts`、`src/validate-theme.ts`：主题构建与契约校验脚本；
- `contracts/theme-interface.contract.json`、`contracts/theme-min-functional-set.json`：由 `@chips/theme-contracts` 生成并校验的主题契约产物；
- `icons/variablefont/*.woff2`：运行时 UI 图标字体源文件，构建后复制到 `dist/icons/variablefont/`。

生成后推荐执行：

```bash
cd <targetDir>
npm run verify
```

`verify` 串联 `build`、`validate:theme`、`test`、`chipsdev-r validate` 与 `chipsdev-r package`。主题包 `.cpk` 进入 Host 开发工作区后，仍需显式 `chipsdev-r plugin enable <pluginId>` 才会出现在 `chipsdev-r theme list` 中。

## 开发者报告命令

以下命令面向开发期治理，默认输出人读摘要；追加 `--json` 会输出完整机器可读 JSON；追加 `--out <file>` 会把完整 JSON 报告写入指定文件。报告统一包含 `kind / schemaVersion / generatedAt / summary / checks` 等字段，供脚本、生态设置面板和 CI 读取。

### `chipsdev-r preview`

```bash
chipsdev-r preview [--mode mock|host] [--target app|component|card|box|layout|theme] [--json] [--out report.json]
```

正式语义：

1. 读取当前工程 `chips.config.mjs` 与 `manifest.yaml`；
2. 校验 `runtime.targets`、应用 `ui.surface` 和 manifest entry 资产状态；
3. 输出 Host mock 与真实开发工作区预览链路说明；
4. mock 预览能力以 `chips-sdk/testing` 为正式测试入口，不复制 Host 运行时主实现；
5. 真实应用窗口联调仍以 `chipsdev-r run` 为准。

### `chipsdev-r component gallery`

```bash
chipsdev-r component gallery [--json] [--out report.json]
```

正式语义：

1. 读取 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json`；
2. 读取组件库 token 构建产物 `packages/tokens/dist/json/tokens.json`；
3. 输出每个组件的 `parts / states / requiredTokens / optionalTokens / coverage`；
4. 同步附带组件库最新 `reports/quality-gate/quality-gate-latest.json` 与 `reports/perf/perf-stage9-latest.json` 摘要；
5. 不运行重型质量门禁脚本，只汇总当前已生成报告。

### `chipsdev-r theme inspect`

```bash
chipsdev-r theme inspect [--theme <themeId|path>] [--json] [--out report.json]
```

正式语义：

1. 默认检查生态 `ThemePack/*` 下的主题包；
2. `--theme` 可指定 `themeId`、插件 ID、主题目录或 `manifest.yaml` 路径；
3. 读取 `manifest.yaml`、`entry.tokens`、`entry.themeCss`、`ui.layout.contract`、`ui.layout.minFunctionalSet`；
4. 按主题包正式 token 层级语义合成合同 token tree 后检查 required token 覆盖；
5. 本命令只读诊断主题包，不修改 ThemePack，不替代后续主题包升级工单。

### `chipsdev-r quality gate`

```bash
chipsdev-r quality gate [--json] [--out report.json]
```

正式语义：

1. 检查当前工程 `package.json / chips.config.mjs / manifest.yaml` 状态；
2. 检查 SDK `src/contracts/route-manifest.json` 是否存在；
3. 汇总组件库最新 quality/perf 报告；
4. 汇总 `chipsdev-r theme inspect` 的主题检查摘要；
5. 本命令是统一读取型门禁摘要，不替代各仓库正式验证命令，例如 `npm test`、`npm run verify`、`npm run quality:gate`。

### `chipsdev-r assimilate scan/report`

```bash
chipsdev-r assimilate scan /path/to/web-project [--json] [--out report.json]
chipsdev-r assimilate report /path/to/web-project [--json] [--out report.json]
```

正式语义：

1. 识别 React、Vite、静态 HTML、Electron 等 Web 项目特征；
2. 扫描直接 Node/Electron API、浏览器存储、网络请求、文件输入/下载、`window.open`、剪贴板和快捷键处理；
3. 扫描硬编码颜色/字体/圆角/阴影和硬编码用户可见文案；
4. 根据 native control 痕迹输出 Chips 组件替换建议；
5. 生成初版 app manifest 建议，包括 `runtime.targets`、`ui.surface` 和可推断权限；
6. `report` 在 `scan` 基础上附加迁移步骤；命令不会自动改写外部项目源码。

### `chipsdev-r diagnostics`

```bash
chipsdev-r diagnostics [--json] [--out report.json]
```

正式语义：

1. 汇总 SDK route manifest 的 route 数量、namespace 分布与权限集合；
2. 汇总组件矩阵、主题检查和质量门禁摘要；
3. 用于快速判断生态开发工具链是否处于可消费状态。

## 插件与主题调试

主题包、卡片插件、布局插件、模块插件的联调均应通过开发工作区完成，不应手工修改 `.chips-host-dev` 文件。

其中：

- 主题插件、卡片插件、布局插件，以及模块插件的安装/启停状态验证，可使用 `chipsdev-r plugin/theme/...`；
- 应用插件窗口联调，使用 `chipsdev-r run`；
- 模块插件 capability/method 联调，尤其是依赖 Electron 宿主的模块能力，使用 `chipsdev-r module invoke`。

### 布局插件联调

布局插件没有独立的 `chipsdev-r run` 窗口入口。  
正式联调链路是：

1. 使用 `chipsdev-r create layout <targetDir>` 创建工程；
2. 在布局工程内优先执行 `npm run verify`，或分步执行 `chipsdev-r lint/test/build/validate/package`；
3. 使用 `chipsdev-r plugin install /绝对路径/布局插件.cpk` 安装到开发工作区；
4. 使用 `chipsdev-r plugin enable <layoutPluginId>` 启用插件；
5. 由箱子查看器、编辑器或其他消费箱子布局的正式应用打开 `.box` 文件，让 Host 按 `layout.layoutType` 加载已安装布局插件。

重要约束：

- 布局插件必须以“已安装插件副本”身份参与 Host 加载，不能直接从源码目录热挂载；
- 查看器和编辑器会按 `layout.layoutType -> installPath + entry` 的正式链路加载布局插件；
- 若重新构建并重新打包了同 ID 的布局插件，必须再次执行 `chipsdev-r plugin install`，以替换开发工作区中的旧副本。

典型命令如下：

```bash
chipsdev-r plugin install /绝对路径/插件或主题包.cpk
chipsdev-r plugin enable theme.theme.chips-official-default-dark-theme
chipsdev-r theme list
chipsdev-r theme apply chips-official.default-dark-theme
chipsdev-r theme current
chipsdev-r theme validate
```

模块插件典型命令如下：

```bash
chipsdev-r module invoke \
  --capability converter.html.to-image \
  --method convert \
  --input-file /绝对路径/request.json
```

布局插件典型命令如下：

```bash
chipsdev-r create layout my-grid-layout
cd my-grid-layout
npm run verify
chipsdev-r plugin install /绝对路径/my-grid-layout/dist/my-grid-layout.cpk
chipsdev-r plugin enable chips.layout.my-grid-layout
```

语义说明：

- `chipsdev-r plugin install` 仅完成安装；
- 若开发工作区中已存在相同 `pluginId`，再次执行 `chipsdev-r plugin install` 会正式替换旧安装副本，而不是追加重复记录；
- `chipsdev-r plugin install` 写入 `plugins.json` 时会更新已有记录，并把传入路径规范化为绝对路径；
- 主题插件必须显式 `enable` 后，才会进入 `chipsdev-r theme list` 的可用主题集合；
- `chipsdev-r theme apply` 只允许切换到当前开发工作区内已启用的主题；
- `chipsdev-r theme validate` 会逐个调用 `theme.apply + theme.resolve` 做正式门禁验证。
- `chipsdev-r module invoke` 会在真实 Electron Host 中完成模块调用；若当前目录是模块工程，会先构建并重新安装该模块。

## 创建工程

`chipsdev-r create` 在生态根工作区内创建工程时会自动完成以下操作：

1. 保留模板内的正式 semver 依赖；
2. 在需要时自动把新工程注册到根工作区；
3. 自动写入指向生态根 `package.json` 的 `volta.extends`。

补充约束：

- 生成工程默认只输出 README 与运行时、测试、契约等必要目录；
- `需求文档/`、`技术文档/`（或“技术手册”）与 `开发计划/` 不属于 `chipsdev-r create` 的默认产物。

当前正式支持的类型：

- `app`
- `card`
- `layout`
- `module`
- `theme`

`chipsdev-r create app <targetDir>` 会创建标准应用插件工程。生成工程默认包含 `manifest.yaml`、`chips.config.mjs`、App/Scene/surface/commands 入口、`i18n`、预览冒烟与质量报告脚本，并预置以下脚本：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run preview:smoke
npm run quality:gate
npm run verify
```

其中 `verify` 串联 `lint/typecheck/test/build/validate/preview:smoke/quality:gate`。应用模板当前不声明 `package` npm 脚本；需要生成应用 `.cpk` 时使用 `chipsdev-r package` 或后续在应用工程中显式添加等价脚本。生成工程的 `manifest.yaml` 默认包含一条 `cli.commands` 应用入口，命令路径根段由项目名派生并避开 Host 固定命令根，执行时通过 Host `surface.open` 打开当前应用。应用真实窗口联调以 `chipsdev-r run` 为主，运行时必须通过 Host surface、Bridge、SDK、主题系统和多语言系统接线。

`chipsdev-r create card <targetDir>` 会创建标准基础卡片插件工程。生成工程默认包含 `manifest.yaml`、`chips.config.mjs`、`src/render`、`src/editor`、`src/schema`、`src/shared`、`i18n`、`templates`、`tests` 与必要静态资源，并预置以下脚本：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

其中 `verify` 串联 `lint/typecheck/test/build/validate/package`，可作为生成工程的默认本地质量门禁。

`chipsdev-r create layout <targetDir>` 会创建标准箱子布局插件工程。生成工程默认包含 `manifest.yaml`、`chips.config.mjs`、`src/view`、`src/editor`、`src/schema`、`src/shared`、`contracts`、`i18n`、`tests` 与 README，并预置同样的质量脚本：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

其中 `verify` 串联 `lint/typecheck/test/build/validate/package`。生成工程的 `package` 脚本会输出 `.cpk`，布局插件没有独立的 `chipsdev-r run` 窗口入口；正式联调必须安装并启用该 `.cpk`，再由箱子查看器、编辑器或其他正式 `.box` 消费应用通过 Host 加载。重新构建并重新打包同一 `pluginId` 后，需要再次执行 `chipsdev-r plugin install`，让开发工作区替换旧安装副本。

`chipsdev-r create module <targetDir>` 会创建标准功能模块插件工程。默认模板为 `module-standard`，也可以通过 `--template` 选择文件转换、HTML 渲染、图像处理、编排等专用模板。生成工程默认包含 `manifest.yaml`、`chips.config.mjs`、`contracts/*.schema.json`、`src/index.ts`、`tests` 与 README，并预置以下脚本：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

其中 `verify` 串联 `lint/typecheck/test/build/validate/package`。生成工程的 `manifest.yaml` 默认包含按模板能力 schema 映射的 `cli.commands`，命令路径根段由项目名派生并避开 Host 固定命令根；安装启用后可通过 `chips <commandPath>` 或开发工作区中的 `chipsdev-r <commandPath>` 调用，并进入 Host / chipsdev-r 的动态 shell completion 候选，但真实执行仍回到 Host `module.invoke / module.job.*`。模块插件没有窗口入口，真实联调必须通过 `chipsdev-r module invoke` 或安装启用后由应用/SDK 的模块服务调用；模块之间依赖只通过 `manifest.module.consumes` 与 Host 注入的 `ctx.module.invoke(...)` 建立，不允许跨目录直接 import。

`chipsdev-r create theme <targetDir>` 会创建标准主题包插件工程。生成工程默认包含 `manifest.yaml`、`chips.config.mjs`、`tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`、`tokens/comp/*.json`、`styles`、`contracts`、`icons/variablefont`、`preview`、`src`、`tests` 与 README，并预置以下脚本：

```bash
npm run build
npm run validate:theme
npm test
npm run validate
npm run package
npm run verify
```

其中 `verify` 串联 `build/validate:theme/test/validate/package`。主题插件没有独立窗口入口；正式联调必须安装并启用生成的 `.cpk`，再通过 `chipsdev-r theme apply <themeId>`、`chipsdev-r theme resolve`、`chipsdev-r theme contract` 与 `chipsdev-r theme validate` 验证运行时效果。

## 构建、打包与校验

正式发布链路如下：

```bash
chipsdev-r build
chipsdev-r test
chipsdev-r lint
chipsdev-r validate
chipsdev-r package
```

主题包或插件包生成 `.cpk` 后，推荐继续执行开发工作区联调：

```bash
chipsdev-r plugin install /绝对路径/产物.cpk
chipsdev-r plugin enable <pluginId>
chipsdev-r theme validate   # 主题包
```

模块插件若需要验证正式能力调用，推荐执行：

```bash
chipsdev-r module invoke --capability <capability> --method <method> --input '<json>'
```

## 常见问题

### 为什么 `chipsdev-r run` 没有使用我在 `chips` 里切换的主题？

因为两个命令操作的是不同工作区。`chips` 使用用户工作区，`chipsdev-r` 使用开发工作区。

### 为什么 `chipsdev-r theme list` 看不到刚安装的主题？

因为主题插件安装后必须先启用。只有已启用主题插件才会进入主题运行时。

### 为什么模块插件不能只靠 `chipsdev-r start` 验证 Electron 能力？

因为 `chipsdev-r start` 属于开发工作区 Host 管理命令，底层仍走 Host CLI，不负责模块 capability 的真实 Electron 宿主调用。依赖 `BrowserWindow` 的模块能力要使用 `chipsdev-r module invoke`。

### 为什么应用启动后不应该写死默认主题？

因为应用初始主题必须从 Host 当前主题读取。主题变更事件只负责增量同步，不能替代初始主题装载。

### 为什么我已经重新构建插件，但 `chipsdev-r run` 里仍然像是在加载旧代码？

因为 Host 真正运行的是开发工作区 `.chips-host-dev/plugins/` 里的已安装副本，而不是你的源码目录。当前正式行为是：`chipsdev-r plugin install` 会替换开发工作区中的同 ID 插件副本，`chipsdev-r run` 也会在启动目标应用前先同步 `plugins.json` 中登记的插件，避免继续消费旧安装残留。

## 质量要求

- 不允许手工改写工作区文件替代正式命令；
- 不允许在开发命令中绕开 Host 主题、插件、窗口和日志链路；
- 不允许在文档或脚手架中继续使用 `chips dev` 历史写法；
- 所有示例命令必须能在当前生态工作区中直接执行。
