# 阶段三 脚手架 CLI 声明与安装门禁记录

## 1. 本阶段目标

本阶段在 Host 命令索引、传统 CLI 执行器和 `chipsdev validate/package` 打包门禁基础上，补齐应用插件与模块插件脚手架：

- 新建应用插件默认生成合规 `manifest.cli.commands` 应用入口。
- 新建模块插件各模板默认生成与能力 schema 对齐的 `manifest.cli.commands`。
- 脚手架命令路径自动避开 Host 固定命令根。
- Host `plugin.install` 同步拒绝类型专属官方字段越界声明，避免绕过 `chipsdev package` 直接安装不合规 manifest。
- SDK 打包兼容测试同时覆盖 app 和 module 插件声明 `plugin / themeId` 等越界字段的失败路径。

## 2. 代码改动

### 2.1 应用插件脚手架

改动文件：

- `Chips-Scaffold/chips-scaffold-app/src/core/template-engine.ts`
- `Chips-Scaffold/chips-scaffold-app/src/core/types.ts`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/manifest.yaml.tpl`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/i18n/zh-CN.json.tpl`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/i18n/en-US.json.tpl`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/README.md.tpl`
- `Chips-Scaffold/chips-scaffold-app/tests/template-engine.test.ts`
- `Chips-Scaffold/chips-scaffold-app/scripts/check-templates.mjs`
- `Chips-Scaffold/chips-scaffold-app/scripts/run-generated-e2e.mjs`

新增行为：

- 模板上下文新增 `CLI_COMMAND_ROOT`，由项目名优先派生为 CLI 安全根段。
- 若派生根段命中 Host 固定命令根，应用模板追加 `-app`。
- 默认生成 `{{ CLI_COMMAND_ROOT }} open` 命令。
- 该命令目标为当前 app 插件，执行时通过 `surface.open` 打开应用并聚焦。
- 可选位置参数 `subject` 映射到 launch context 的 `cli.payload.subject`。
- i18n 资源新增 `app.cli.open.*` 文案 key。
- 模板测试和检查脚本覆盖 `cli.commands`、i18n key、旧 `manifest.commands` 禁用、`plugin/theme/module/layout` 等越界字段不生成。

### 2.2 模块插件脚手架

改动文件：

- `Chips-Scaffold/chips-scaffold-module/src/core/template-engine.ts`
- `Chips-Scaffold/chips-scaffold-module/src/core/types.ts`
- `Chips-Scaffold/chips-scaffold-module/templates/*/manifest.yaml.tpl`
- `Chips-Scaffold/chips-scaffold-module/templates/*/README.md.tpl`
- `Chips-Scaffold/chips-scaffold-module/README.md`
- `Chips-Scaffold/chips-scaffold-module/tests/core/template-engine.test.ts`
- `Chips-Scaffold/chips-scaffold-module/scripts/check-templates.cjs`
- `Chips-Scaffold/chips-scaffold-module/scripts/run-generated-e2e.cjs`

新增行为：

- 模板上下文新增 `CLI_COMMAND_ROOT`。
- 若派生命令根命中 Host 固定命令根，模块模板追加 `-module`。
- `module-standard` 默认生成 `run` 和 `run-async` 两条命令。
- `module-pure-function` 默认生成 `run`。
- `module-file-conversion` 默认生成 `convert`。
- `module-html-rendering` 默认生成 `render`。
- `module-image-processing` 默认生成 `process`。
- `module-color-extraction` 默认生成 `colors`。
- `module-orchestration` 默认生成 `execute`。
- 各命令按模板 input schema 声明 `arguments/options/mapsTo`，覆盖 path、json、enum、boolean、integer、text 等参数类型和 TUI 控件提示。
- job 模板命令默认声明 `job.wait: true` 与 `cancelOnInterrupt: true`。

### 2.3 Host 安装门禁

改动文件：

- `Chips-Host/src/runtime/plugin-runtime.ts`
- `Chips-Host/tests/unit/plugin-runtime.test.ts`

新增规则：

- Host `plugin.install` 解析 manifest 时拒绝类型专属官方字段越界声明。
- `module / layout / theme / themeId / displayName / isDefault / parentTheme` 只能由对应 owner 类型声明。
- `manifest.plugin` 是 Host 插件治理保留字段，app/module 插件不得声明。
- 测试覆盖 app 插件声明 `module`、app 插件声明 `theme`、module 插件声明 `theme/themeId`、module 插件声明 `plugin` 的失败路径。

### 2.4 SDK 打包门禁测试补强

改动文件：

- `Chips-SDK/tests/run-cli-package-compatibility-tests.cjs`

新增覆盖：

- `chipsdev validate` 和 `chipsdev package` 拒绝 module 插件声明 `themeId`。
- `chipsdev validate` 和 `chipsdev package` 拒绝 app/module 插件声明主题包专属对象字段 `theme`。
- `chipsdev validate` 和 `chipsdev package` 拒绝 module 插件声明 Host 治理保留字段 `plugin`。
- 失败时不得产生新的 `.cpk`。

## 3. 公共文档同步

已更新：

- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/05-模块插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`
- `生态共用技术文档/协议与契约/01-插件契约规范.md`
- `生态共用技术文档/文件格式规范/03-CPK打包格式规范.md`

文档同步重点：

- app/module 脚手架默认生成 `cli.commands`。
- 脚手架命令根由项目名派生，并避开 Host 固定命令根。
- app 默认命令通过 `surface.open` 打开应用。
- module 默认命令按模板 schema 映射到 `module.invoke.input`。
- `chipsdev validate/package` 与 Host `plugin.install` 均执行类型专属字段边界校验。

## 4. 已通过验证

```text
cd Chips-Scaffold/chips-scaffold-app && npm run build
cd Chips-Scaffold/chips-scaffold-app && npm test
cd Chips-Scaffold/chips-scaffold-app && npm run test:templates
cd Chips-Scaffold/chips-scaffold-module && npm run build
cd Chips-Scaffold/chips-scaffold-module && npx vitest run tests/core/template-engine.test.ts
cd Chips-Scaffold/chips-scaffold-module && npm run test:templates
cd Chips-Host && npm run build
cd Chips-Host && npx vitest run tests/unit/plugin-runtime.test.ts --testNamePattern "type-exclusive|reserved|Host fixed|cli.commands"
cd Chips-SDK && node ./tests/run-cli-package-compatibility-tests.cjs
```

补充验证：

```text
cd Chips-Host && npx vitest run tests/unit/plugin-runtime.test.ts --testNamePattern "type-exclusive|reserved plugin governance"
cd Chips-SDK && node ./tests/run-cli-package-compatibility-tests.cjs
```

## 5. 后续阶段

后续建议继续推进：

1. 运行脚手架 e2e 全链路，确认生成工程 `verify/package/Host install` 对新增 `cli.commands` 仍稳定。
2. 开发键盘优先 TUI 命令构建器，复用 `cli.command.list/resolve`、参数 schema、TUI 控件提示与现有 CLI 执行边界。
3. 继续完善 Ctrl+C 取消 module job、批量输入格式、human 输出模板和输出目录/覆盖策略细节。
