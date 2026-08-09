# {{ DISPLAY_NAME }}

> 通过 `chips-scaffold-module` 生成的 HTML 渲染导出模块插件工程。

## 简介

本模板适合消费目录态 HTML，并通过 Host 正式平台能力输出 PDF 或图片。模块不直接导入 Electron，不创建宿主窗口，也不复制 Host 渲染容器实现。

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

`options.target` 决定调用 `platform.renderHtmlToPdf` 或 `platform.renderHtmlToImage`。真实联调应使用 `chipsdev-r module invoke` 走 Host 模块服务。

## Host 联调

```bash
chipsdev-r module invoke \
  --capability {{ MODULE_CAPABILITY }} \
  --method convert \
  --input-file /绝对路径/input.json \
  --timeout-ms 60000
```

该模板依赖真实 Electron Host 的平台渲染能力，因此不要用普通开发服务器替代联调。CLI 会构建当前工程、安装并启用 `.cpk`，再通过 Host `module.invoke` 调用 job 并轮询终态。

## 插件 CLI 命令

`manifest.yaml` 默认声明一条插件命令：

```bash
chips {{ CLI_COMMAND_ROOT }} render /绝对路径/html-dir /绝对路径/output.pdf --target pdf
```

该命令由 Host 动态发现，参数会映射为 `htmlDir / outputFile / options.target`，真实执行仍走 Host `module.invoke / module.job.*`。

## 正式边界

- 模块只能通过 `ctx.host.invoke("platform.renderHtmlToPdf", payload)` 或 `ctx.host.invoke("platform.renderHtmlToImage", payload)` 使用 Host 渲染导出能力；
- 模块不直接导入 Electron，不创建应用窗口，不复制 Host 渲染容器实现；
- job 超时进入 `failed`，错误码为 `MODULE_TIMEOUT`；取消进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`；
- 若后续编排其他转换模块，必须先声明 `module.consumes`，再通过 `ctx.module.invoke(...)` 调用。
