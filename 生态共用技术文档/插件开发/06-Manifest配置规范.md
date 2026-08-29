# Manifest配置规范

## 文档定位

本文档定义插件 `manifest.yaml` 的正式公共契约。

当前重点更新：

- `runtime.targets`
- `ui.surface`
- `capabilityFallbacks`
- `cli.commands`

这些字段已经被 Host 运行时、`chipsdev-r validate`、Scaffold 模板和官方插件清单共同采用。

## 1. 基础要求

- 文件名必须为 `manifest.yaml`
- 文件必须位于插件包根目录
- 工程根 `manifest.yaml` 是唯一正式清单源

`chipsdev-r` 当前正式行为：

- `chipsdev-r build` 只生成构建产物
- `chipsdev-r run` 使用工程根 `manifest.yaml`
- `chipsdev-r package` 将工程根 `manifest.yaml` 写入包根，并把构建产物放到包内 `dist/`

## 2. 基础字段

必填基础字段：

- `id`
- `name`
- `version`
- `type`
- `entry`
- `permissions`
- `runtime.targets`

`permissions` 规则：

- 必须是数组；
- 无权限插件也必须显式写入 `permissions: []`；
- 权限名采用点分命名空间，例如 `file.read`、`zip.manage`；
- `theme.read / i18n.read` 已由 task030 废弃：插件侧不再读取主题与多语言，新插件不再声明（`command.*`、`resource.read`、`file.*`、`platform.read` 等保留）；仅 Host 内部保留链路（如主题插件类型）仍可出现在 Host 契约上下文中，见 8.4。

`type` 取值：

- `app`
- `card`
- `layout`
- `module`
- `theme`

> `theme` 类型为 Host 内部保留契约（主题系统已废弃，见 8.4），插件开发不再面向主题插件。

`entry` 规则：

- `app/card/layout/module` 通常为字符串，如 `dist/index.html`、`dist/index.mjs` 或 `dist/index.js`
- `theme` 必须为对象，并显式声明 `tokens` 与 `themeCss`

## 3. 运行目标矩阵：`runtime.targets`

所有正式插件都应声明运行目标矩阵：

```yaml
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: false
```

规则：

1. `runtime.targets` 必须是对象。
2. `desktop / web / mobile / headless` 四个目标必须全部出现。
3. 每个目标当前只接受：

```yaml
supported: <boolean>
```

4. Host 在运行 `type: app` 插件时，会根据当前 `hostKind` 检查目标是否支持。

当前实现状态说明：

- Desktop / Headless 宿主已落地
- Web / Mobile 目标位已冻结，但对应 Shell 仍处于预留状态

## 4. 应用插件界面语义：`ui.surface`

只有 `type: app` 插件允许声明 `ui.surface`。

```yaml
ui:
  surface:
    defaultKind: window
    preferredKinds:
      desktop: window
      web: route
      mobile: fullscreen
      headless: window
```

规则：

1. `ui.surface` 只能出现在 `app` 插件中。
2. `defaultKind` 必须属于：
   - `window`
   - `tab`
   - `route`
   - `modal`
   - `sheet`
   - `fullscreen`
3. `preferredKinds` 必须覆盖合法目标平台标识。
   - `desktop`
   - `web`
   - `mobile`
   - `headless`
4. Host 在 `surface.open(target=plugin)` 时，会优先按：
   - 调用方显式请求的 `kind`
   - `ui.surface.preferredKinds[currentHostKind]`
   - `ui.surface.defaultKind`
   - Host 默认值
   进行解析。

`type: app` 插件必须同时声明完整 `runtime.targets` 与完整 `ui.surface`。Host、SDK CLI 和脚手架校验都应把缺少 `runtime.targets`、缺少 `ui.surface.defaultKind`、缺少任一目标平台 `preferredKinds` 视为无效 Manifest。

## 5. 应用插件原生壳层：`ui.window` 与 `ui.launcher`

`ui.window.chrome` 仍然保留，用于桌面原生窗口外观基线。

`ui.launcher` 用于系统快捷方式 / 启动台入口元数据。

```yaml
ui:
  window:
    chrome:
      titleBarStyle: hidden
      titleBarOverlay:
        color: "#ffffff00"
        symbolColor: "#667085"
        height: 44
  launcher:
    displayName: 图片查看器
    icon: assets/icons/app-icon.png
```

规则：

- `ui.launcher` 只允许 `app` 插件声明
- `ui.surface` 只允许 `app` 插件声明
- `ui.window.chrome` 允许 `app` 插件声明

### 5.1 权限补充

`permissions` 字段继续用于声明插件会调用的正式宿主能力。

补充约束：

- 任何直接调用 `zip.compress / zip.extract / zip.list` 的插件，都必须声明 `zip.manage`；
- 若应用插件承载网页基础卡片、电子书图片包这类 `importArchiveBundle(...)` 通用目录导入能力，并在内部复用 ZIP 子域完成校验与解压，也必须声明 `zip.manage`；
- 仅声明 `file.read / file.write` 并不能替代 `zip.manage`。

## 6. 能力缺失时的正式策略：`capabilityFallbacks`

应用插件可以声明当宿主缺失某项能力时的正式行为：

```yaml
capabilityFallbacks:
  save-file:
    whenUnsupported: download
  share:
    whenUnsupported: reject
```

当前允许的 `whenUnsupported`：

- `reject`
- `download`
- `share`
- `openExternal`

约束：

1. `capabilityFallbacks` 提供时必须是对象
2. key 必须是非空 capability 名称
3. 每个 fallback 都必须声明 `whenUnsupported`

### 6.1 资源处理器能力声明（`capabilities` 中的 handler 能力串）

应用插件要在资源打开路由（`resource.open` / 文件关联）中成为处理器，需在 `capabilities` 中声明：

```yaml
capabilities:
  - resource-handler:view:image/*        # 资源 MIME 处理（专用层级）
  - file-handler:.png                    # 扩展名关联（专用层级）
  - resource-handler:view:image/*@fallback   # 兜底层级：通用文件查看器使用
  - file-handler:.pdf@fallback
```

1. 正式格式为 `resource-handler:<intent>:<mime>[@tier]` 与 `file-handler:<ext>[@tier]`；
2. 省略 `@tier` 表示 `primary`（专用处理器）；`@fallback` 表示通用兜底处理器，Host 保证专用处理器优先于兜底处理器，其余匹配顺序以《资源打开契约》第 3 节为准；
3. 除 `@fallback` 外的 `@` 后缀均视为非法能力串；
4. 用户默认处理器偏好由 Host `fileOpen.defaults` 配置承载，处理器槽位视图通过 `plugin.listHandlers` 查询（见《资源打开契约》第 4.5 节）。

## 7. 命令行扩展声明：`cli.commands`

`type: app` 与 `type: module` 插件可以通过 `cli.commands` 声明可被 Host 动态发现的命令行入口。Host 在 `plugin.install` 时解析并校验这些声明，并通过 `cli.command.list / cli.command.get / cli.command.resolve` 暴露只读命令索引。

```yaml
cli:
  commands:
    - commandPath: icon generate
      target:
        type: module
        capability: converter.icon.generate
        method: generate
      titleKey: icon.cli.generate.title
      descriptionKey: icon.cli.generate.description
      permissions:
        - file.read
      arguments:
        - name: input
          position: 0
          type: path
          required: true
          mapsTo: inputPath
      options:
        - name: formats
          short: f
          type: stringList
          default: [png, ico]
          mapsTo: formats
          ui:
            control: multiSelect
            choices: [png, ico, icns]
```

顶层规则：

1. `cli` 必须是对象，`cli.commands` 必须是数组。
2. 只有 `app` 与 `module` 插件允许声明 `cli.commands`；`card / layout / theme` 不允许声明。
3. `commandPath` 必填，可写为空格分隔字符串或字符串数组，段名只能使用字母、数字和连字符。
4. `titleKey` 必填，`descriptionKey` 可选，均为 Host CLI 契约字段（Host 内部解析，插件侧不再维护语言包）。
5. `commandId` 可选；省略时 Host 归一为 `<pluginId>.cli.<commandPath以点连接>`。
6. `permissions` 可选，但其中每一项都必须已出现在插件顶层 `permissions` 中。
7. 同一插件内 `commandId`、参数 `name` 和短选项 `short` 不得重复。
8. `commandPath` 第一段不得占用 Host 固定命令根：`help / host / start / stop / status / config / logs / theme / plugin / update / doctor / open / completion`。

官方 app/module 脚手架会为生成工程默认写入 `cli.commands` 示例。脚手架命令路径第一段由项目名派生为只含字母、数字和连字符的安全根段；若派生结果命中 Host 固定命令根，应用模板追加 `-app`，模块模板追加 `-module`，保证生成工程默认可通过 Host 与 `chipsdev-r validate/package` 校验。

模块目标：

```yaml
target:
  type: module
  capability: converter.icon.generate
  method: generate
  timeoutMs: 60000
```

- 声明插件必须是 `type: module`。
- `capability` 与 `method` 必填。
- `pluginId` 可选；若写入，必须等于声明该命令的插件 ID。
- 实际执行仍必须走 Host `module.invoke` 与 `module.job.*` 正式链路。

应用目标：

```yaml
target:
  type: app
  pluginId: chips.app.editor
  commandId: chips.app.editor.open
  surface:
    open: true
    focus: true
    reuse: preferred
```

- 声明插件必须是 `type: app`。
- `pluginId` 默认等于声明插件 ID；显式写入时也必须等于声明插件 ID。
- `commandId` 可选；存在时表示后续 CLI 执行器会通过 Host command 系统投递。
- `surface.reuse` 当前允许 `always / never / preferred`。

参数类型当前允许：

- `string`
- `stringList`
- `number`
- `integer`
- `boolean`
- `enum`
- `path`
- `json`
- `jsonFile`
- `text`
- `textFile`

参数字段当前允许 `name / short / position / type / required / default / mapsTo / choices / multiple / validation / path / batch / ui`。其中 `mapsTo` 是写入目标 payload 的点分路径；`ui.control` 允许 `select / multiSelect / toggle / stepper / slider / pathInput / pasteBox / textarea`。

路径规则：

- `path.kind` 允许 `file / directory / any`。
- `path.role` 允许 `input / output`；省略时按输入路径处理。
- `path.exists` 要求目标路径已存在；`path.create` 允许 CLI 在执行前创建输出目录或输出文件父目录。
- `path.extensions` 是允许的扩展名列表，扩展名可以带点或不带点。
- `path.overwrite` 只允许在 `type: path` 且 `path.role: output` 时声明，允许值为 `fail / overwrite / rename / skip`。
- 输出路径已存在时，`fail` 返回 `CLI_OUTPUT_EXISTS`；`overwrite` 允许继续；`rename` 在执行前把 payload 中的路径改写为同目录未占用的 `name-1.ext`、`name-2.ext` 等；`skip` 不调用插件目标，直接返回结构化 skipped 结果。
- 用户传入全局 `--overwrite` 时，CLI 会把声明为输出路径的参数按 `overwrite` 策略处理；若插件命令本身声明了名为 `overwrite` 的布尔选项，该选项仍会进入插件 payload。

批量输入规则：

- `batch` 只允许 `textFile` 与 `jsonFile` 参数声明。
- `batch.format: lines` 只允许搭配 `textFile`，CLI 会读取文本文件、按行拆分、去掉空行并输出数组。
- `batch.format: json-array` 只允许搭配 `jsonFile`，CLI 会要求 JSON 文件顶层为数组。
- `batch.itemType` 允许 `value / path`；`path` 会把每一项按当前 shell 工作目录解析为绝对路径。
- `batch.itemPath` 只允许在 `batch.itemType: path` 时声明，字段与输入路径规则一致，支持 `kind / exists / create / extensions`。

输出规则：

- `output.mode` 可声明为 `json / human`。未声明时，Host CLI 当前默认输出结构化 JSON，便于脚本稳定消费。
- `output.mode: human` 表示未传入 `--json` 时默认输出人读摘要；用户传入 `--json` 时必须返回完整结构化 JSON。
- `output.artifacts` 是结果对象中的点分路径列表，用于让 human 输出提取生成文件、目录或关键产物路径；CLI 不根据插件私有字段名猜测产物语义。

## 8. 其他类型插件的正式要求

### 8.1 `card`

- 应声明 `runtime.targets`
- 正式解析依据仍是 `capabilities.cardTypes`
- 不得声明 `ui.surface`
- 一般推荐：
  - `desktop: true`
  - `headless: true`
  - `web/mobile: false`（直到对应宿主就绪）

标准基础卡片插件示例：

```yaml
id: chips.basecard.example
name: 示例基础卡片插件
version: 0.1.0
type: card
entry: dist/index.mjs
capabilities:
  cardTypes:
    - base.example
permissions: []
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: true
```

`basecardDefinition.pluginId` 应与 `manifest.id` 对齐，`basecardDefinition.cardType` 应与 `manifest.capabilities.cardTypes[0]` 对齐。

### 8.2 `layout`

- 应声明 `runtime.targets`
- 正式解析依据是 `layout.layoutType`
- 必须声明 `layout.displayName`
- 不得声明 `ui.surface`
- 常见权限基线是 `box.read`（`theme.read / i18n.read` 已废弃，不再声明）

标准布局插件示例：

```yaml
id: chips.layout.example
name: 示例布局插件
version: 0.1.0
type: layout
entry: dist/index.mjs
permissions:
  - box.read
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: true
layout:
  layoutType: chips.layout.example
  displayName: 示例布局
```

### 8.3 `module`

- 应声明 `runtime.targets`
- 正式 provider 契约仍以 `module.provides / module.consumes` 为准
- `module.apiVersion` 当前为数字版本；
- `module.runtime` 当前正式值为 `worker`；
- `module.activation` 当前支持 `onDemand` 与 `eager`；
- `module.provides[].methods[]` 必须声明稳定 `name`、`mode`，并按需声明 `inputSchema` 与 `outputSchema`；
- 模块调用其他 capability 时，目标 capability 必须预先声明在 `module.consumes[]` 中。

标准模块插件示例：

```yaml
id: chips.module.example
name: 示例模块插件
version: 0.1.0
type: module
entry: dist/index.mjs
permissions:
  - file.read
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: true
module:
  apiVersion: 1
  runtime: worker
  activation: onDemand
  provides:
    - capability: example.process
      version: 1.0.0
      methods:
        - name: run
          mode: sync
          inputSchema: contracts/run.input.schema.json
          outputSchema: contracts/run.output.schema.json
  consumes:
    - capability: example.normalize
      versionRange: ^1.0.0
```

### 8.4 `theme`

> 状态注记（task030）：主题系统已废弃，插件开发不再创建主题插件（`chips-scaffold-theme` 已归档）；以下类型与权限为 Host 内部保留契约，仅历史遗留工程与 Host 治理链路仍会解析。

- 应声明 `runtime.targets`
- 主题入口继续使用对象结构 `entry.tokens / entry.themeCss`
- 必须声明 `themeId` 与显示名称字段；
- `isDefault`、`parentTheme` 按主题继承和默认主题需要声明；
- 主题契约资产通过 `ui.layout.contract` 与 `ui.layout.minFunctionalSet` 提供给 `chipsdev-r package` 收集，并由 Host 主题运行时按安装副本读取。

标准主题插件示例：

```yaml
id: theme.theme.example
name: 示例主题
version: 1.0.0
type: theme
entry:
  tokens: dist/tokens.json
  themeCss: dist/theme.css
permissions:
  - theme.read
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: true
themeId: chips.example.theme
displayName: 示例主题
isDefault: false
parentTheme: chips-official.default-theme
ui:
  layout:
    contract: contracts/theme-interface.contract.json
    minFunctionalSet: contracts/theme-min-functional-set.json
```

## 9. CLI 与 Host 校验边界

`chipsdev-r validate` 是工程打包前校验入口，当前至少检查基础字段、`permissions` 数组、完整 `runtime.targets`、应用插件 `ui.surface`、`capabilityFallbacks`、模块 provider 契约、`cli.commands` 基础结构和 manifest 声明资产存在性。

`chipsdev-r package` 在写入 `.cpk` 前必须复用 `chipsdev-r validate` 的 Manifest 形态校验。校验失败时不得生成新的 `.cpk`。

类型专属官方字段必须按 owner 类型声明，`chipsdev-r validate / package` 和 Host `plugin.install` 安装校验均不得接受越界声明：

- `module` 只允许 `type: module` 插件声明。
- `layout` 只允许 `type: layout` 插件声明。
- `theme / themeId / displayName / isDefault / parentTheme` 只允许 `type: theme` 插件声明。
- `ui.surface / ui.launcher / ui.window` 只允许 `type: app` 插件声明。
- `manifest.plugin` 是 Host 插件治理保留字段，`app / module` 插件不得声明。
- `ui.layout` 是页面布局、主题契约资产索引等场景的共享容器，不按插件类型无条件禁止；具体子字段仍需按对应场景校验。

Host `plugin.install` 是运行时安装入口，支持传入目录、单个 manifest 文件或 `.cpk` 文件。`.cpk` 会先解包到受控临时目录，再查找 manifest、校验资源并复制为当前工作区 `plugins/<pluginId>` 下的已安装副本。Host 还会解析主题、布局与模块的类型专属字段。开发者不应把源码目录当作 Host 正式运行入口。

## 10. 应用插件示例

```yaml
id: chips.photo.viewer
name: 图片查看器
version: 1.0.0
type: app
entry: dist/index.html
permissions:
  - file.read
  - file.write
runtime:
  targets:
    desktop:
      supported: true
    web:
      supported: false
    mobile:
      supported: false
    headless:
      supported: false
capabilities:
  - resource-handler:view:image/*
  - file-handler:.png
  - file-handler:.jpg
capabilityFallbacks:
  save-file:
    whenUnsupported: download
ui:
  surface:
    defaultKind: window
    preferredKinds:
      desktop: window
      web: route
      mobile: fullscreen
      headless: window
  window:
    chrome:
      titleBarStyle: hidden
  launcher:
    displayName: 图片查看器
    icon: assets/icons/app-icon.png
```

## 11. 校验门禁

当前 `chipsdev-r validate` 已正式校验：

1. `manifest.runtime.targets` 存在且结构正确
2. `app` 插件必须声明 `manifest.ui.surface`
3. `ui.surface.defaultKind / preferredKinds` 必须合法
4. `capabilityFallbacks` 若提供则必须合法
5. 非 `app` 插件不得声明 `ui.surface`

## 12. 质量要求

1. Manifest 公共字段变化必须同步更新 Host 解析、CLI 校验、Scaffold 模板和共享文档。
2. 不允许继续把桌面假设直接写死到公共契约里。
3. 宿主尚未实现不等于字段可以省略；运行目标矩阵必须显式声明。
