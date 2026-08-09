# CPK打包格式规范

## 格式概述

CPK是插件包的统一格式，采用ZIP压缩格式，扩展名为cpk。CPK文件本质是ZIP压缩包，包含插件的所有代码、资源和配置文件。

## 压缩设置

压缩采用STORE模式，即零压缩率存储模式。这种方式不进行实际压缩，以获得最快的解压速度，符合薯片生态的性能要求。

## 目录结构

CPK 文件内部以包根 `manifest.yaml` 为唯一正式清单源。`chipsdev-r package` 会把工程根 `manifest.yaml` 写入包根，把构建产物保留在包内 `dist/`，并收集 manifest 显式引用的正式静态资源。五类插件的差异由 manifest 字段、入口和运行时导出契约表达，不通过 `app/`、`card/`、`layout/`、`module/`、`theme/` 这类顶层包裹目录表达。

### 各类插件标准目录结构

```text
<plugin>.cpk
├── manifest.yaml
├── dist/
│   └── ...
└── <manifest 声明的正式资源目录或文件>
```

常见资源包括：

- `assets/`：应用图标、截图、静态资源；
- `preview/`：预览资源；
- `contracts/`：主题契约、模块 schema 或布局契约；
- 其他由 `manifest.yaml` 显式引用且通过 `chipsdev-r validate` 校验存在的资源路径。

包内不应包含：

- `dist/manifest.yaml`、`dist/manifest.yml`、`dist/manifest.json` 等构建副本；
- 旧 `.cpk` 包；
- `publish-meta.json` 等发布辅助文件；
- 与当前插件运行无关的源码、测试报告或任务材料。

### 主题插件结构说明

主题包源码工程可以包含 `tokens/`、`styles/`、`icons/`、`contracts/`、`preview/` 等目录，但正式 `.cpk` 仍以包根 `manifest.yaml`、`dist/tokens.json`、`dist/theme.css` 和 manifest 显式引用的契约/资源为准。

主题包 manifest 的关键字段包括：

- `type: theme`
- 对象形式 `entry.tokens: dist/tokens.json`
- 对象形式 `entry.themeCss: dist/theme.css`
- `themeId`
- `displayName`
- `isDefault`
- `parentTheme`
- `ui.layout.contract`
- `ui.layout.minFunctionalSet`

> 注意：一个主题包仅承载一种外观，不在包内区分白天/夜间、light/dark 或其他模式标签；外观切换通过切换 `themeId` 到另一个主题包完成。

## manifest.yaml规范

清单文件是插件的入口配置，包含以下字段：

必填字段包括：`id` 是唯一标识符，使用反向域名格式如 `com.example.my-plugin`；`name` 是显示名称；`version` 遵循语义化版本规范；`type` 标识插件类型（`app`、`card`、`layout`、`module`、`theme`）；`entry` 指定入口文件路径或主题入口对象；`permissions` 必须是数组；`runtime.targets` 必须完整声明 `desktop/web/mobile/headless`。

可选字段包括：author作者信息，description功能描述，icon图标文件路径，homepage项目主页，license开源许可证，keywords关键词数组，screenshots截图数组。

依赖字段声明插件依赖。dependencies对象列出依赖的模块和版本范围，peerDependencies列出对宿主环境的依赖。

权限字段声明插件需要的系统能力。`permissions` 数组使用点分命名空间，例如 `file.read`、`file.write`、`network.request`、`clipboard.read`、`clipboard.write`、`theme.read`、`zip.manage`。无权限插件也必须写 `permissions: []`。

## 插件类型

应用插件 `type` 字段为 `app`，入口文件通常是 `dist/index.html`。卡片插件 `type` 字段为 `card`，入口文件通常是导出基础卡片渲染/编辑契约的 `dist/index.mjs`。布局插件 `type` 字段为 `layout`，入口文件导出 `layoutDefinition`。模块插件 `type` 字段为 `module`，入口文件导出无界面能力模块定义。主题插件 `type` 字段为 `theme`，入口是对象结构 `entry.tokens / entry.themeCss`，不是单个 CSS 字符串。

## 打包工具

系统提供基于 `chipsdev-r` 与 `chips` 的 CPK 工具链。开发者在插件工程中使用 `chipsdev-r package` 生成 `.cpk` 文件，使用 `chipsdev-r validate` 校验构建产物与清单结构；Host 侧通过 `chips plugin install <cpk路径>` 安装 `.cpk` 并执行运行时校验。

`chipsdev-r package` 必须在写包前执行 Manifest 形态门禁；Host `plugin.install` 在安装目录、manifest 文件或 `.cpk` 时也必须执行同类类型边界校验。若发现以下问题，打包立即失败且不得生成新的 `.cpk`：

- 缺少基础字段、`permissions` 不是数组、`runtime.targets` 不完整；
- 应用插件缺少 `ui.surface`，或非应用插件声明 `ui.surface / ui.launcher / ui.window`；
- app/module 插件声明了其他类型的官方字段，例如 `module`、`layout`、`theme`、`themeId`、`displayName`、`isDefault`、`parentTheme`；
- app/module 插件声明 Host 插件治理保留字段 `plugin`；
- `cli.commands` 结构无效，或插件命令路径占用了 Host 固定命令根。

类型专属字段的正式归属以 `生态共用技术文档/插件开发/06-Manifest配置规范.md` 为准；CPK 打包规范只记录打包门禁必须执行这一要求。

## 签名机制

签名属于发布来源治理能力，不是本地开发和本地 `.cpk` 安装的前置条件。当前 Host 运行时把本地开发与本地安装视为 `source = local` 主链路；当 manifest 声明 `source` 且不为 `local` 时，Host 会要求存在 `signature` 字段。完整远端来源、公钥验证、分发审核和公证流程应在发布安全文档中单独冻结，不应写成本地 `chipsdev-r package -> chips plugin install` 的必经步骤。

## 安全限制

CPK包内的代码运行在受限环境中。不能访问文件系统超出插件目录，不能发起任意网络请求，不能加载任意模块。违反安全限制的代码会被阻止执行。

## 热插拔支持

当前 Host 支持通过 `plugin.install / plugin.enable / plugin.disable / plugin.uninstall` 在工作区内安装、替换、启用、禁用和卸载插件。替换同 ID 插件时，Host 会删除旧安装副本并复制新的已安装副本，保留运行时记录中的旧启用状态。

这不等同于已经冻结远端更新、增量发布或无需任何重启的发布流水线。涉及远端获取、签名校验、运行中插件迁移和失败回滚的能力，必须在后续发布链路文档中单独定义。

正式工作流仍建议保持：

```bash
chipsdev-r build
chipsdev-r validate
chipsdev-r package
chips plugin install /绝对路径/产物.cpk
chips plugin enable <pluginId>
```

## 大小限制

单个CPK文件建议不超过100MB。过大的插件包会影响加载速度和磁盘空间。大型资源应考虑外部引用方式。

## 版本兼容性

manifest中的版本字段遵循语义化版本规范。主版本变化通常表示不兼容，需要宿主软件对应版本。次版本变化表示新功能，向后兼容。修订号变化表示问题修复，完全向后兼容。

## 主题契约门禁

主题包必须通过主题契约门禁校验：

### 校验项目

1. **token完整性校验**：检查 tokens/ 目录下是否包含完整的五层token（ref/sys/comp/motion/layout），无缺失无冗余
2. **组件接口点校验**：验证 components/ 中的样式文件是否覆盖了 `data-scope/data-part` 声明的所有接口点
3. **动效参数安全校验**：验证 motions/ 中的动效参数是否符合安全阈值（最大时长、曲线白名单）
4. **颜色对比度校验**：验证主题配色是否符合文本可读性标准（WCAG 2.1 AA级）

### 契约校验工具

当前正式命令边界：

- `chipsdev-r theme inspect [--theme <themeId|path>]`：读取主题包 manifest、entry、contract、min functional set、token 覆盖并输出开发期检查报告；
- `chipsdev-r validate`：校验当前主题工程 manifest 引用资源、构建产物和工程契约；
- `chipsdev-r theme validate` / `chips theme validate`：对当前工作区内已启用主题逐个执行 `theme.apply + theme.resolve` 运行时门禁。

`chips theme validate` 不接收 `<theme-cpk>`、`--tokens` 或 `--components` 参数。未安装启用的主题包应先通过 `chipsdev-r package` 生成 `.cpk`，再用 `chips plugin install` / `chips plugin enable` 进入目标工作区。

### 校验失败处理

校验失败的主题包将被拒绝安装，系统返回详细错误报告，包含：
- 缺失的token/组件/接口点
- 不符合安全阈值的动效参数
- 不符合对比度要求的颜色值
