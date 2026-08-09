# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的文件转换模块插件工程。

## 简介

本模板适合“输入文件 -> 输出文件或目录”的无界面转换能力。默认实现会通过 Host 文件能力校验输入、治理输出覆盖、写入转换报告，并通过 job 进度向调用方反馈执行阶段。

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
- method：`convert`
- mode：`job`

模块访问文件系统时必须通过 `ctx.host.invoke("file.*", payload)`。调用方必须通过 Host 模块服务使用该能力，不能跨目录 import 本模块源码。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method convert \
  --input-file /绝对路径/input.json \
  --timeout-ms 60000
```

CLI 会先构建当前工程，再在开发工作区安装并启用 `.cpk`，最后通过 Host `module.invoke` 启动 job。返回 job 后，CLI 会轮询到 `completed`、`failed` 或 `cancelled` 终态；`module.job.cancel` 会让运行中任务进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} convert /绝对路径/input.txt /绝对路径/output.json --overwrite
```

该命令由 Host 动态发现，路径参数会先经过 CLI 层解析和基础校验，再映射为 `sourceFile` 与 `output.path` 传给 `module.invoke`。

## 正式边界

- 模块不创建应用窗口，不直接读写应用私有资源；
- 输入、输出和覆盖策略必须由 schema 与 Host 文件动作共同治理；
- `timeoutMs` 超时后 job 进入 `failed`，错误码为 `MODULE_TIMEOUT`；
- 如果转换流程需要调用其他模块，必须先声明 `module.consumes`，再通过 `ctx.module.invoke(...)` 调用。
