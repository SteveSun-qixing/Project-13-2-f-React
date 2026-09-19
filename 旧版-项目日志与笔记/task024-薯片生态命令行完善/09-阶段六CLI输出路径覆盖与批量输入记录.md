# 阶段六：CLI 输出路径覆盖与批量输入记录

## 背景

阶段一到阶段五已经完成 `manifest.cli.commands` 声明、Host 动态命令索引、传统 CLI 执行器、TUI 命令构建器、模块 job 进度与取消。本阶段继续收口任务目标中“文件路径解析、输出目录规则、覆盖策略、批量输入格式、错误码标准”的缺口。

同时复核用户补充要求：`chipsdev validate/package` 在打包前必须拒绝 app/module 插件声明 `plugin / theme / themeId` 等官方专属或 Host 治理字段。当前 SDK 打包校验和 Host `plugin.install` 均已覆盖该门禁。

## 本阶段实现

- Host manifest 解析新增 `path.role`、`path.overwrite` 与 `batch` 元数据。
- SDK 类型新增 `CliCommandPathRole`、`CliCommandOverwritePolicy`、`CliCommandBatchRule` 等公共类型。
- `chipsdev validate/package` 同步校验：
  - `path.overwrite` 只能用于 `type: path` 且 `path.role: output`；
  - `batch.format: lines` 只能用于 `textFile`；
  - `batch.format: json-array` 只能用于 `jsonFile`；
  - `batch.itemPath` 只能与 `batch.itemType: path` 同时使用。
- Host CLI 执行器在调用插件目标前处理输出路径冲突：
  - `fail`：返回 `CLI_OUTPUT_EXISTS`；
  - `overwrite`：允许继续；
  - `rename`：改写 payload 到同目录未占用路径；
  - `skip`：不调用插件目标，返回结构化 skipped 结果。
- Host CLI 执行器支持全局 `--overwrite`，用于覆盖声明为输出路径参数的默认冲突策略；若插件命令自身声明 `overwrite` 选项，该选项仍会进入目标 payload。
- 批量输入支持：
  - `textFile + batch.format: lines`；
  - `jsonFile + batch.format: json-array`；
  - `batch.itemType: path` 逐项解析为绝对路径并按 `batch.itemPath` 校验。

## 影响文件

- `Chips-Host/src/runtime/plugin-runtime.ts`
- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/tests/unit/plugin-runtime.test.ts`
- `Chips-Host/tests/e2e/cli.test.ts`
- `Chips-SDK/src/api/cli-command.ts`
- `Chips-SDK/src/index.ts`
- `Chips-SDK/cli/index.js`
- `Chips-SDK/tests/run-cli-package-compatibility-tests.cjs`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
- `生态共用技术文档/协议与契约/06-模块能力契约.md`

## 验证计划

- `cd Chips-Host && npx vitest run tests/unit/plugin-runtime.test.ts tests/e2e/cli.test.ts`
- `cd Chips-Host && npm run build`
- `cd Chips-SDK && node ./tests/run-cli-package-compatibility-tests.cjs`
- `cd Chips-SDK && node --check cli/index.js`
- `git diff --check` 针对本阶段相关文件

## 后续

- 继续补齐 shell completion、CLI / TUI 操作日志和 human 输出模板。
- 对批量任务的逐项结果聚合格式继续沉淀到插件能力 schema 示例中。
