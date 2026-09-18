# Chips-Office（薯片办公）

> 插件 ID：`com.chips.office`
> 类型：应用插件（type: app）

薯片生态的办公四件套应用插件，提供 **Word 文档（.docx）、电子表格（.xlsx/.xlsm/.xls/.csv）、演示文稿（.pptx）、PDF 文档** 的查看与编辑能力。工程基于 GenOffice（Apache-2.0）完整移植：渲染层与引擎层原样搬运，仅做薯片生态的架构适配（文件会话走 `file.*` 万能文件链路、xlsx 引擎走 Host `office.engine.*` 服务、AI 与 Markdown 能力按需求移除）。

## 快速开始

```bash
# 在生态根工作区
npm install
cd Chips-Office
npm run build          # 构建产物到 dist/
chipsdev-r run         # 在 Chips-Host 真实宿主中运行本插件
```

开发期独立预览：`npm run dev`（仅 UI 开发；文件链路需要 Host 运行时）。

## 常用脚本

- `npm run dev`：Vite 开发服务器（UI 开发用）。
- `npm run build`：正式构建（自定义 vite.config.ts：@genoffice alias、pdfjs 静态资源、分包）。
- `npm test` / `npm run lint` / `npm run typecheck`：测试与质量。
- `npm run validate` / `npm run preview:smoke` / `npm run quality:gate`：插件门禁。
- `npm run verify`：以上全部串行。

## 工程结构

| 目录 | 内容 |
| --- | --- |
| `src/apps/{word,sheet,slide,pdf}/` | GenOffice 四应用 renderer/共享层/领域层/网关原样移植（AI 已剥离） |
| `vendor/` | GenOffice 引擎与共享包（docx-engine / pptx-engine / pptx-render / ui / i18n / pdf2docx / font-metrics 类型层） |
| `src/bridge/` | 薯片适配层：与 GenOffice preload 桥同签名的 `window.desktop` / `window.desktopApi` / `window.slidesApi` / `window.pdfApi` 实现，底层走 chips-sdk |
| `src/scenes/` | 薯片场景：起始页 + 四件套场景 |
| `src/app/`、`src/commands/`、`src/runtime/` | 薯片壳层（场景路由、命令系统、SDK 客户端） |
| `tests/` | 单元测试与契约基线 |

## 许可证

移植源码遵循上游 GenOffice 的 Apache-2.0 许可证，`vendor/LICENSE`、`vendor/NOTICE`、`vendor/LICENSE-UNICODE.txt` 为上游随附声明；上游仓库地址与第三方组件清单见 `vendor/NOTICE`。
