# Module Orchestrator

> 通过 `chips-scaffold-module` 生成的模块编排插件工程。

## 简介

本模板适合把多个下游模块能力组合成一条正式流程。编排模块本身仍是普通 `type: module` 插件，不新增路由类型，不直接 import 下游模块源码。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-orchestrator
npm run verify
```

## 默认能力

- capability：`module.module.orchestrator`
- method：`execute`
- mode：`job`

下游能力通过 `module.consumes` 声明，并通过 `ctx.module.invoke(...)`、`ctx.module.job.get(...)`、`ctx.module.job.cancel(...)` 调用和治理。创建工程时可使用 `chipsdev create module <dir> --template module-orchestration --consumes <capability>@<versionRange>` 写入初始依赖。
