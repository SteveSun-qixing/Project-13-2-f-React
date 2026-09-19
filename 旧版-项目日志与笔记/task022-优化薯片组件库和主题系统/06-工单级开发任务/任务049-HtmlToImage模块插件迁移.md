# 任务049：HtmlToImage 模块插件迁移

## 1. 任务目标

将 `Chips-ModulePlugin/Chips-HtmltoImage-Plugin` 迁移到新框架模块能力基线，使目录态 HTML 到图片的转换成为正式原子能力。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`

## 3. 涉及项目

- `Chips-ModulePlugin/Chips-HtmltoImage-Plugin`
- `Chips-Host`
- `Chips-SDK`
- `Chips-ModulePlugin/Chips-CardtoHTML-Plugin`
- `Chips-ModulePlugin/Chips-FileConversion-Plugin`

## 4. 开发内容

1. 重新核对 `manifest.yaml` 中 `converter.html.to-image` capability、schema、权限和测试。
2. 升级输入/输出 schema，明确 HTML 目录、入口、视口、缩放、输出格式、透明背景、等待策略和错误码。
3. 通过 Host 正式导出/渲染能力生成图片，不在模块中私自创建不可治理浏览器链路。
4. 支持主题 CSS、字体、图片资源、相对路径和加载失败诊断。
5. 实现 job 进度、取消、超时、临时目录清理和输出冲突处理。
6. 对齐 FileConversion consumes 调用和 SDK module invoke 类型。
7. 增加单页、多页、长图、资源缺失、字体缺失、主题切换、取消和错误测试。

## 5. 验收标准

- `converter.html.to-image` 可被 Host 模块运行时发现和调用。
- 输出图片可复现、可诊断、可被 FileConversion 编排。
- 不绕开 Host 安全和资源加载策略。
- 通过插件 build/test/lint/validate。

## 6. 验证命令

```bash
cd Chips-ModulePlugin/Chips-HtmltoImage-Plugin
npm run lint
npm test
npm run build
npm run validate
```

## 7. 注意事项

- 如 Host 缺少正式导出能力，先登记工单，不在模块中临时内置第二套运行时。
- 本任务开发前必须重新核对 HTML 导出链路和当前插件代码。

## 8. 完成记录

- 2026-05-26：完成 HtmlToImage 原子导出模块迁移收口。
- 工作日志：`07-工作日志/任务049-HtmlToImage模块插件迁移-20260526.md`
- 复核证据：`manifest.yaml` 已声明 `type: module`、`converter.html.to-image/convert` job 能力与输入/输出 schema；当前 `package.json` 提供 `lint/test/build/validate` 正式脚本。
- 验证：`npm run lint`、`npm test`、`npm run build`、`npm run validate` 已通过；任务050收口时已追加 Host `html to image` 集成测试复核。
- 提交记录：`7850343e 完成任务049与任务050导出模块迁移收口`。
