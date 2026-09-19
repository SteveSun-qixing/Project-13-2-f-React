# 任务050：HtmlToPDF 模块插件迁移

## 1. 任务目标

将 `Chips-ModulePlugin/Chips-HtmltoPDF-Plugin` 迁移到新框架模块能力基线，使目录态 HTML 到 PDF 的转换成为正式原子能力，并具备打包态 e2e 验证。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`

## 3. 涉及项目

- `Chips-ModulePlugin/Chips-HtmltoPDF-Plugin`
- `Chips-Host`
- `Chips-SDK`
- `Chips-ModulePlugin/Chips-CardtoHTML-Plugin`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin`

## 4. 开发内容

1. 重新核对 `manifest.yaml` 中 `converter.html.to-pdf` capability、schema、权限、`e2e` 脚本和测试。
2. 升级输入/输出 schema，明确 HTML 目录、入口、页面尺寸、边距、页眉页脚、背景、等待策略和错误码。
3. 通过 Host 正式导出/打印能力生成 PDF，不在模块中私建不可治理浏览器链路。
4. 支持主题 CSS、字体、分页、资源路径、链接保留和加载失败诊断。
5. 实现 job 进度、取消、超时、临时目录清理和输出冲突处理。
6. 对齐 FileConversion consumes 调用和 SDK module invoke 类型。
7. 增加单页、多页、长文、资源缺失、主题切换、取消、打包插件 e2e 和错误测试。

## 5. 验收标准

- `converter.html.to-pdf` 可被 Host 模块运行时发现和调用。
- 输出 PDF 结构稳定、可复现、可诊断。
- 打包后的插件也能通过 e2e 验证。
- 通过插件 build/test/lint/validate/e2e。

## 6. 验证命令

```bash
cd Chips-ModulePlugin/Chips-HtmltoPDF-Plugin
npm run lint
npm test
npm run build
npm run validate
npm run e2e
```

## 7. 注意事项

- 如 Host 缺少正式 PDF 导出能力，先登记工单，不做临时内置方案。
- 本任务开发前必须重新核对 HTML/PDF 导出能力契约和当前插件代码。

## 8. 完成记录

- 2026-05-26：完成 HtmlToPDF 原子导出模块迁移、Host/PAL 正式 PDF 导出能力与打包态 e2e 收口。
- 工作日志：`07-工作日志/任务050-HtmlToPDF模块插件迁移-20260526.md`
- 复核证据：`manifest.yaml` 已声明 `type: module`、`converter.html.to-pdf/convert` job 能力与输入/输出 schema；当前 `package.json` 提供 `lint/test/build/validate/e2e` 正式脚本。
- 验证：`npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build`、`npm run validate`、`npm run e2e` 已通过；`Chips-Host` build、相关 html export 集成测试与 `test:contract` 已通过；`Chips-SDK` platform html export 聚焦测试已通过。
- 提交记录：`7850343e 完成任务049与任务050导出模块迁移收口`。
