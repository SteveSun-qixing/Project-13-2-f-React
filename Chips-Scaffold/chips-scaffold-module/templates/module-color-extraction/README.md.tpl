# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的图像颜色提取模块插件工程。

## 简介

本模板适合从本地图像中提取背景色与强调色。默认实现使用稳定的字节采样算法作为工程骨架，不引入新的图像解码依赖；若业务需要更准确的像素级算法，应在正式契约和技术选型确认后扩展。

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
- method：`pick`
- mode：`sync`

正式颜色能力的公共契约应沉淀到生态共用技术文档，调用方仍通过 `module.invoke` 接入。

默认输出包含 `backgroundColor`、`accentColor`、`palette` 与 `metadata`。模板内 `metadata.algorithm` 为 `byte-sampling-template-v1`，用于明确它只是无额外依赖的脚手架骨架；正式官方 `image.color.pick` 实现使用 `oklab-kmeans-v1`，以生态公共契约为准。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method pick \
  --input-file /绝对路径/input.json \
  --timeout-ms 60000
```

CLI 会构建当前工程、安装并启用 `.cpk`，再通过 Host `module.invoke` 调用颜色提取能力。sync 方法超时返回 `MODULE_TIMEOUT`，输入或输出不符合 schema 会返回 `MODULE_SCHEMA_INVALID`。若后续添加 job 方法，取消运行中 job 后应进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} colors /绝对路径/image.png --sample-size 96
```

该命令由 Host 动态发现，图像路径会先经过 CLI 层解析和基础校验，再映射为 `imagePath` 传给 `module.invoke`。

## 正式边界

- 模块通过 Host 文件能力读取资源，不直接读写应用私有资源；
- 模块不创建应用窗口，不生成 UI，不接入主题或多语言运行时；
- 颜色算法和输出字段一旦对外公开，需要同步更新 `contracts/`、README、测试和生态共用技术文档；
- 如需复用下游图像分析模块，必须先声明 `module.consumes`，再通过 `ctx.module.invoke(...)` 调用。
