# 任务048-FileConversion模块插件迁移-20260526

## 1. 完成内容

- 复核任务048与任务23相关生态设计、模块能力契约、文件转换能力契约、模块插件开发指南和 SDK module invoke 语义。
- 保持 FileConversion 作为普通模块插件，不新增 Host 服务域，不直接 import CardToHTML / HtmlToPDF / HtmlToImage 源码。
- 补强转换编排的最终交付物事务发布模型：
  - 所有最终输出先写入同级临时根目录 `final/`；
  - 成功完成全部步骤后再通过 Host `file.move` 发布到 `output.path`；
  - 覆盖旧输出时先移动旧输出到 `backup/`；
  - 发布失败时尝试恢复旧输出；
  - 失败、取消或下游缺失时只清理临时根目录，不提前破坏旧输出。
- 补强错误语义：
  - `MODULE_PROVIDER_NOT_FOUND` 归一为 `CONVERTER_PIPELINE_PROVIDER_MISSING`；
  - `MODULE_CAPABILITY_NOT_DECLARED`、`PERMISSION_DENIED`、`SERVICE_PERMISSION_DENIED` 归一为 `CONVERTER_PIPELINE_PERMISSION_DENIED`；
  - 最终输出提交失败归一为 `CONVERTER_OUTPUT_COMMIT_FAILED`。
  - 2026-05-26 16:02 追加加固：覆盖旧输出时，如果提交阶段“备份旧输出”的 `file.move` 失败，也统一归入 `CONVERTER_OUTPUT_COMMIT_FAILED`，并在 details 中标记 `phase: "backup"`，避免 Host 原始错误绕过文件转换能力契约。
- 补充单元测试覆盖：
  - provider 缺失；
  - 权限不足；
  - 下游失败时保留旧输出；
  - 覆盖旧输出时备份并在提交阶段替换；
  - 覆盖旧输出时备份失败会保留旧输出并返回 `CONVERTER_OUTPUT_COMMIT_FAILED`；
  - staged artifact 仍对调用方返回最终 `output.path`。
- 同步更新 FileConversion 项目 README、需求规格说明和技术方案。
- 主代理复核时补充同步公共文件转换能力契约：
  - 明确编排模块最终交付物事务式发布口径；
  - 明确 `CONVERTER_PIPELINE_PROVIDER_MISSING`、`CONVERTER_PIPELINE_PERMISSION_DENIED` 与 `CONVERTER_OUTPUT_COMMIT_FAILED` 三类对外错误语义。

## 2. 修改范围

- `Chips-ModulePlugin/Chips-FileConversion-Plugin/src/types.ts`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/src/planner.ts`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/src/executor.ts`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/tests/unit/module-definition.test.ts`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/README.md`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/需求文档/01-文件转换编排模块需求规格说明.md`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin/技术文档/01-文件转换编排模块技术方案.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/08-草稿笔记/任务048-FileConversion模块插件迁移-启动复核报告-20260526.md`
- `生态共用技术文档/协议与契约/07-文件转换能力契约.md`

## 3. 已执行验证

- `npm test`：通过，11 个测试通过。
- `npx tsc --noEmit`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，产物 `dist/index.mjs`。
- `npm run validate`：最终通过。

补充说明：曾并行执行 `npm run build` 与 `npm run validate`，第一次 `validate` 在 build 产物生成前启动，报 `dist` 不存在；随后在 build 完成后单独重跑 `npm run validate` 通过。

2026-05-26 15:03 已再次按顺序执行正式验证：`npm run lint`、`npm test`、`npm run build`、`npm run validate` 全部通过，确认不存在 build/validate 并发竞态。

主代理追加复核：

- `npx tsc --noEmit`：通过。
- `npm test -- --run`：通过，11 个单元测试全绿。
- `npm run lint`：通过。
- `npm run build`：通过，生成 `dist/index.mjs`。
- `npm run validate`：通过。

2026-05-26 16:02 事务提交语义补强后复核：

- `npx tsc --noEmit`：通过。
- `npm test -- --run`：通过，12 个单元测试全绿。
- `npm run lint`：通过。
- `npm run build`：通过，生成 `dist/index.mjs`。
- `npm run validate`：通过。

## 4. Git 声明

本轮由子代理完成初稿，主代理复核并补齐公共契约后提交。
