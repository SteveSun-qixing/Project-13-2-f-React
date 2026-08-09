# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的图像处理模块插件工程。

## 简介

本模板适合本地图像读取、轻量分析、元数据提取或后续图像算法接入。默认实现只使用 Host 文件能力读取二进制数据，不引入新的第三方图像处理依赖。

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
- method：`process`
- mode：`sync`

若后续需要接入更复杂的解码或采样算法，应先确认技术选型和公共契约，再把依赖写入正式工程。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method process \
  --input-file /绝对路径/input.json \
  --timeout-ms 60000
```

CLI 会先构建当前工程，再在开发工作区安装并启用 `.cpk`，最后通过 Host `module.invoke` 调用 capability/method。sync 方法超时返回 `MODULE_TIMEOUT`，schema 不匹配返回 `MODULE_SCHEMA_INVALID`。若后续添加 job 方法，取消运行中 job 后应进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} process /绝对路径/image.png --sample-size 64
```

该命令由 Host 动态发现，图像路径会先经过 CLI 层解析和基础校验，再映射为 `imagePath` 传给 `module.invoke`。

## 正式边界

- 模块通过 `ctx.host.invoke("file.read", payload)` 读取 Host 授权资源，不直接读写应用私有资源；
- 模块不创建应用窗口，不生成 UI，不接入主题或多语言运行时；
- 不在模板内私自引入图像处理依赖；新增依赖必须有正式技术选型和公共契约依据；
- 若需要组合其他模块能力，必须先声明 `module.consumes`，再通过 `ctx.module.invoke(...)` 调用。
