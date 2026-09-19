# Module File

> 通过 `chips-scaffold-module` 生成的文件转换模块插件工程。

## 简介

本模板适合“输入文件 -> 输出文件或目录”的无界面转换能力。默认实现会通过 Host 文件能力校验输入、治理输出覆盖、写入转换报告，并通过 job 进度向调用方反馈执行阶段。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd module-file
npm run verify
```

## 默认能力

- capability：`module.module.file`
- method：`convert`
- mode：`job`

模块访问文件系统时必须通过 `ctx.host.invoke("file.*", payload)`。调用方必须通过 Host 模块服务使用该能力，不能跨目录 import 本模块源码。
