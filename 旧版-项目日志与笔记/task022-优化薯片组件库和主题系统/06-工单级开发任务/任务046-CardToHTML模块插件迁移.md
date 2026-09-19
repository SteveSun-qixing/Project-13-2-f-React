# 任务046：CardToHTML 模块插件迁移

## 1. 任务目标

将 `Chips-ModulePlugin/Chips-CardtoHTML-Plugin` 迁移到新框架模块能力基线，使卡片到 HTML 的转换成为 Host 托管、可验证、可被其他模块复用的原子能力。

## 2. 对应阶段任务

- `05-开发任务方案/任务23-模块插件能力契约与运行时迁移.md`

## 3. 涉及项目

- `Chips-ModulePlugin/Chips-CardtoHTML-Plugin`
- `Chips-Host`
- `Chips-SDK`
- `Chips-CardViewer`
- `Chips-BaseCardPlugin/*`

## 4. 开发内容

1. 重新核对 `manifest.yaml` 中 `converter.card.to-html` capability、schema、权限和测试。
2. 升级输入/输出 schema，明确目录态 HTML、压缩态 HTML、资源复制策略、主题和语言参数。
3. 确保转换通过 Host 正式卡片渲染链路读取 `.card`，不直接复写基础卡片渲染逻辑。
4. 输出 HTML 时保留主题 CSS、资源路径、iframe 安全边界和错误诊断信息。
5. 增加 job 模式进度、取消、错误码、日志和临时文件清理。
6. 对齐 SDK module invoke 类型封装，供 FileConversion 模块消费。
7. 增加多基础卡片、缺失插件、资源缺失、主题切换和压缩输出测试。

## 5. 验收标准

- `converter.card.to-html` 能被 Host 模块运行时发现、调用、取消和诊断。
- 转换不复制 CardRenderer、基础卡片分发或主题注入实现。
- 输出产物可作为 HtmlToImage/HtmlToPDF 的正式输入。
- 通过插件 build/test/lint/validate。

## 6. 验证命令

```bash
cd Chips-ModulePlugin/Chips-CardtoHTML-Plugin
npm run lint
npm test
npm run build
npm run validate
```

## 7. 注意事项

- 本模块是无界面能力，不创建应用窗口。
- 本任务开发前必须重新核对模块能力契约、卡片渲染链路和当前插件代码。

## 8. 完成记录

- 2026-05-26：完成 CardToHTML 原子转换模块迁移收口。
- 工作日志：`07-工作日志/任务046-CardToHTML模块插件迁移-20260526.md`
- 复核证据：`manifest.yaml` 已声明 `type: module`、`converter.card.to-html/convert` job 能力与输入/输出 schema；当前 `package.json` 提供 `lint/test/build/validate` 正式脚本。
- 验证：`npx tsc --noEmit`、`npm test -- --run`、`npm run lint`、`npm run build`、`npm run validate` 已通过。
- 提交记录：`b5058a2f 完成任务046 CardToHTML模块插件迁移收口`。
