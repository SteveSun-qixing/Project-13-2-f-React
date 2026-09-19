# Module Pure

> 通过 `chips-scaffold-module` 生成的纯函数模块插件工程。

## 简介

本模板适合文本、配置、元数据等同步输入输出处理。模块不访问文件系统，不创建窗口，不调用 Electron 能力，也不直接依赖其他模块源码。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-pure
npm run verify
```

## 默认能力

- capability：`module.module.pure`
- method：`run`
- mode：`sync`

输入输出 schema 位于 `contracts/`，方法实现位于 `src/index.ts`。调用方必须通过 `module.invoke` 使用能力，不能跨目录 import 本模块源码。
