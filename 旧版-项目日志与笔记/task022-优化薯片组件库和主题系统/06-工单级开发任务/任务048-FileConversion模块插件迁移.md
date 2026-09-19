# 任务048：FileConversion 模块插件迁移

## 1. 任务目标

将 `Chips-ModulePlugin/Chips-FileConversion-Plugin` 迁移到新框架模块能力基线，使它成为统一文件转换编排模块，负责调用 CardToHTML、HtmlToPDF、HtmlToImage 等原子模块。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`

## 3. 涉及项目

- `Chips-ModulePlugin/Chips-FileConversion-Plugin`
- `Chips-ModulePlugin/Chips-CardtoHTML-Plugin`
- `Chips-ModulePlugin/Chips-HtmltoPDF-Plugin`
- `Chips-ModulePlugin/Chips-HtmltoImage-Plugin`
- `Chips-Host`
- `Chips-SDK`

## 4. 开发内容

1. 重新核对 `manifest.yaml` 中 `converter.file.convert` provides 与 consumes 能力。
2. 升级输入/输出 schema，明确源文件类型、目标格式、转换管线、主题、语言、输出路径和错误码。
3. 通过 `ctx.module.invoke` 调用下游模块，不直接 import 下游插件源码。
4. 实现 job 编排：进度聚合、取消传播、失败回滚、临时目录清理和日志归档。
5. 支持 `.card -> html/pdf/image` 等当前正式链路，后续格式只通过能力注册扩展。
6. 对齐 SDK 类型封装和 CLI 调用测试。
7. 增加成功转换、下游缺失、下游失败、取消、权限不足和输出冲突测试。

## 5. 验收标准

- FileConversion 是编排模块，不复制 CardToHTML/HtmlToPDF/HtmlToImage 的内部实现。
- consumes 能力缺失时返回明确错误，不降级到临时代码。
- 转换任务可取消、可诊断、可清理。
- 通过插件 build/test/lint/validate。

## 6. 验证命令

```bash
cd Chips-ModulePlugin/Chips-FileConversion-Plugin
npm run lint
npm test
npm run build
npm run validate
```

## 7. 注意事项

- 不为当前格式写死不可扩展分支；以能力发现和管线描述为核心。
- 本任务开发前必须重新核对模块运行时内部调用协议和当前插件代码。

## 8. 完成记录

- 2026-05-26：完成 FileConversion 编排模块迁移与事务发布语义收口。
- 工作日志：`07-工作日志/任务048-FileConversion模块插件迁移-20260526.md`
- 复核证据：`manifest.yaml` 已声明 `type: module`、`converter.file.convert/convert` job 能力、输入/输出 schema，并通过 `module.consumes` 声明 CardToHTML、HtmlToPDF、HtmlToImage 依赖能力；当前 `package.json` 提供 `lint/test/build/validate` 正式脚本。
- 验证：`npx tsc --noEmit`、`npm test -- --run`、`npm run lint`、`npm run build`、`npm run validate` 已通过。
- 提交记录：`2cdbeeb0 完善任务048文件转换编排事务发布语义`。
