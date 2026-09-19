# Module Html

> 通过 `chips-scaffold-module` 生成的 HTML 渲染导出模块插件工程。

## 简介

本模板适合消费目录态 HTML，并通过 Host 正式平台能力输出 PDF 或图片。模块不直接导入 Electron，不创建宿主窗口，也不复制 Host 渲染容器实现。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-html
npm run verify
```

## 默认能力

- capability：`module.module.html`
- method：`convert`
- mode：`job`

`options.target` 决定调用 `platform.renderHtmlToPdf` 或 `platform.renderHtmlToImage`。真实联调应使用 `chipsdev module invoke` 走 Host 模块服务。
