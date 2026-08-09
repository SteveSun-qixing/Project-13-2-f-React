# HTML转PDF模块需求规格说明

## 1. 模块定位

`Chips-HtmltoPDF-Plugin` 是 `html -> pdf` 原子转换模块，只消费目录态 HTML 中间产物。

## 2. 功能目标

- 加载目录态 HTML 页面
- 应用纸张、方向、边距和背景参数
- 输出 PDF 文件
- 返回页数、PDF 字节数、上游 manifest 摘要、Host 导出诊断和警告信息

## 3. 功能需求

- `FR-01` 支持 HTML 根目录与入口文件输入
- `FR-02` 支持页尺寸、横纵向、背景、CSS page size、页眉页脚、边距和等待策略参数
- `FR-03` 输出单个 PDF 文件
- `FR-04` 将模块输入正式映射为 Host `platform.renderHtmlToPdf` 请求
- `FR-05` 失败时返回结构化错误
- `FR-06` 上报正式 job 进度阶段：`prepare`、`render-pdf`、`cleanup`、`completed`
- `FR-07` 在 Host 成功返回后再次确认 PDF 文件已实际写出
- `FR-08` 必须读取 `conversion-manifest.json`，确认目录态 HTML 来自正式 `card-to-html` 中间产物，并保留主题、语言、语义哈希和渲染诊断摘要
- `FR-09` 发布最终 PDF 时必须使用临时输出与事务式提交；默认拒绝覆盖，`overwrite=true` 时提交失败需尽力恢复旧输出

## 4. 非功能需求

- `NFR-01` 不解析卡片文件
- `NFR-02` 不依赖基础卡片插件仓库
- `NFR-03` 与上游 HTML 中间产物目录结构稳定对齐
- `NFR-04` 不直接导入 Electron，不自建页面运行时
- `NFR-05` 输入路径必须防止目录穿越
- `NFR-06` 不把 Host 渲染导出能力复制到模块内；资源加载、iframe、复合卡片稳定等待和 PDF 打印由 Host 正式能力承载

## 5. 验收口径

- 能稳定消费上游目录态 HTML
- 能生成目标 PDF 文件
- 不直接导入 Electron，且通过 Host 正式导出动作完成输出
- 参数变化能够影响 Host 打印请求并可测试
- 上游 manifest、Host 导出诊断、输出冲突、覆盖提交、取消和清理路径均有测试覆盖
- 错误路径具备单元测试覆盖，且 `test/build/validate` 全部通过
- 打包产物能够通过 `chipsdev-r plugin install + plugin enable` 安装到开发工作区，并经 `module.invoke` 成功调用
