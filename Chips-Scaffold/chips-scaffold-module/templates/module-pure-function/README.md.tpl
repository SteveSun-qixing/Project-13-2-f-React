# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的纯函数模块插件工程。

## 简介

本模板适合文本、配置、元数据等同步输入输出处理。模块不访问文件系统，不创建窗口，不调用 Electron 能力，也不直接依赖其他模块源码。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd {{ PROJECT_NAME }}
npm run verify
npm run package
```

## 默认能力

- capability：`{{ MODULE_CAPABILITY }}`
- method：`run`
- mode：`sync`

输入输出 schema 位于 `contracts/`，方法实现位于 `src/index.ts`。调用方必须通过 `module.invoke` 使用能力，不能跨目录 import 本模块源码。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method run \
  --input '{"value":"demo"}' \
  --timeout-ms 60000
```

CLI 会先构建当前工程，再在开发工作区安装并启用 `.cpk`，最后通过 Host 模块服务调用能力。sync 方法超时会返回 `MODULE_TIMEOUT`，输入或输出不符合 schema 会返回 `MODULE_SCHEMA_INVALID`。若后续添加 job 方法，取消运行中 job 后应进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} run " Hello " --case-mode upper
```

该命令由 Host 动态发现，参数会映射为 `module.invoke.input`，真实执行仍走 Host 模块服务。

## 正式边界

- 模块不创建应用窗口，不生成 UI，不接入主题或多语言运行时；
- 模块不能被应用或其他插件跨目录 import；
- `module.provides` 必须与 `contracts/` 和 `src/index.ts` 中的方法保持一致；
- 若后续需要调用其他模块，必须先写入 `module.consumes`，再通过 `ctx.module.invoke(...)` 调用。
