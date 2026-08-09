# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的模块编排插件工程。

## 简介

本模板适合把多个下游模块能力组合成一条正式流程。编排模块本身仍是普通 `type: module` 插件，不新增路由类型，不直接 import 下游模块源码。

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
- method：`execute`
- mode：`job`

下游能力通过 `module.consumes` 声明，并通过 `ctx.module.invoke(...)`、`ctx.module.job.get(...)`、`ctx.module.job.cancel(...)` 调用和治理。创建工程时可使用 `chipsdev-r create module <dir> --template module-orchestration --consumes <capability>@<versionRange>` 写入初始依赖。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method execute \
  --input-file /绝对路径/input.json \
  --timeout-ms 60000
```

CLI 会先构建当前工程，再在开发工作区安装并启用 `.cpk`，最后通过 Host `module.invoke` 启动编排 job。返回 job 后，CLI 会轮询到 `completed`、`failed` 或 `cancelled` 终态。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} execute '[{"capability":"module.example.step","method":"run","input":{"value":"demo"}}]'
```

该命令由 Host 动态发现，JSON 位置参数会映射为 `steps`，真实执行仍走 Host `module.invoke / module.job.*`，不会直接导入下游模块源码。

## 依赖治理

- `--consumes` 只写入 `manifest.module.consumes`，不会自动安装或启用下游 provider；
- 运行期调用外部 capability 前，Host 会检查当前模块是否已声明对应 `module.consumes`；
- 未声明依赖返回 `MODULE_CONSUME_UNDECLARED`；
- 声明了 capability 但版本范围无匹配 provider 返回 `MODULE_PROVIDER_NOT_FOUND`；
- 调用自身提供的 capability 不需要额外声明。

## 正式边界

- 编排模块仍是普通 `type: module` 插件，不新增路由类型；
- 模块不直接 import 下游模块源码，不绕开 Host 连接其他 provider；
- job 超时进入 `failed`，错误码为 `MODULE_TIMEOUT`；取消进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`；
- 下游 job 必须通过 `ctx.module.job.get(...)` 与 `ctx.module.job.cancel(...)` 治理。
