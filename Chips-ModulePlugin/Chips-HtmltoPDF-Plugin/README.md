# Chips HtmltoPDF Plugin

> `html -> pdf` 原子转换模块仓库。负责把目录态 HTML 中间产物加载到受控 Electron 渲染环境，并输出正式 PDF 文件。

## 当前状态

- 仓库已完成 `converter.html.to-pdf` 正式能力实现。
- `manifest.yaml`、`contracts/`、`src/` 与 `tests/` 已对齐正式文件转换契约。
- 当前实现已通过 `npm test`、`npm run build`、`npm run validate`。

## 仓库定位

- 本仓只消费目录态 HTML 中间产物，不直接接触卡片解析。
- 正式上游输入来自 `Chips-CardtoHTML-Plugin`。
- 正式下游交付物是 PDF 文件；版式、背景、分页和纸张参数在本仓内部收口。
- 目录态 HTML 必须带 `conversion-manifest.json`；模块会读取 manifest 中的入口、语义哈希、主题、语言和 Host 渲染诊断，并继续写入 PDF 输出结果。

## 能力基线

- HTML 加载与 PDF 输出必须通过 Host 正式动作 `platform.renderHtmlToPdf` 实现。
- 模块通过 `ctx.host.invoke(...)` 请求 Host，不直接 `import("electron")`，也不创建 `BrowserWindow`。
- 模块会校验 `htmlDir`、`conversion-manifest.json`、`entryFile` 和导出结果文件存在性，并把 Host 失败统一映射为转换模块错误。
- 模块通过临时输出目录接收 Host 生成的 PDF，成功后再事务式发布到最终 `outputFile`；`overwrite=true` 时会先备份旧输出，提交失败时尽力恢复。
- PDF 参数包括纸张、方向、背景、CSS page size、页眉页脚模板、边距与 Host 等待策略；等待策略由 Host 正式 HTML 导出容器消费。
- 输出结果固定返回 `mimeType: "application/pdf"`，并可携带 `pageCount`、`byteLength`、上游 manifest 摘要、Host 资源/iframe/复合卡片稳定等待诊断和警告。
- 当前正式方法：
  - capability: `converter.html.to-pdf`
  - method: `convert`
  - mode: `job`
- 本仓不复写卡片渲染逻辑，不关心基础卡片结构，只处理 HTML 页面级输出。
- 与上游 HTML 中间产物的目录结构、入口文件和元数据必须按正式契约对齐。

## 文档入口

- `需求文档/01-HTML转PDF模块需求规格说明.md`
- `技术文档/01-HTML转PDF模块技术方案.md`
- `开发计划/00-开发计划索引.md`

## 验证命令

- 单元验证：`npm test`
- 构建校验：`npm run build && npm run validate`
- 打包安装级验证：`npm run e2e`

`npm run e2e` 会在临时开发工作区中执行正式链路：

- `chipsdev-r build`
- `chipsdev-r package`
- `chipsdev-r plugin install`
- `chipsdev-r plugin enable`
- Host `module.invoke`

默认使用 Host Electron 导出能力 mock 做稳定回归；如果要联调真实业务 HTML 输入，可以追加：

```bash
npm run e2e -- \
  --html-dir ../../ProductFinishedProductTestingSpace/卡片转HTML模块测试输出/薯片生态介绍-standalone-html-directory \
  --output-file ../../ProductFinishedProductTestingSpace/HTML转PDF模块测试输出/薯片生态介绍-module-only-e2e.pdf
```
