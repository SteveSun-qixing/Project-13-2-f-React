# Module Image

> 通过 `chips-scaffold-module` 生成的图像处理模块插件工程。

## 简介

本模板适合本地图像读取、轻量分析、元数据提取或后续图像算法接入。默认实现只使用 Host 文件能力读取二进制数据，不引入新的第三方图像处理依赖。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-image
npm run verify
```

## 默认能力

- capability：`module.module.image`
- method：`process`
- mode：`sync`

若后续需要接入更复杂的解码或采样算法，应先确认技术选型和公共契约，再把依赖写入正式工程。
