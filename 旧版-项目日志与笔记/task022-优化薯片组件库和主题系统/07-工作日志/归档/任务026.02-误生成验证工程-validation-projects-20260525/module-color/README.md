# Module Color

> 通过 `chips-scaffold-module` 生成的图像颜色提取模块插件工程。

## 简介

本模板适合从本地图像中提取背景色与强调色。默认实现使用稳定的字节采样算法作为工程骨架，不引入新的图像解码依赖；若业务需要更准确的像素级算法，应在正式契约和技术选型确认后扩展。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-color
npm run verify
```

## 默认能力

- capability：`module.module.color`
- method：`pick`
- mode：`sync`

正式颜色能力的公共契约应沉淀到生态共用技术文档，调用方仍通过 `module.invoke` 接入。
