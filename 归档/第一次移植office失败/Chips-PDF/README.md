# Chips-PDF（薯片 PDF 编辑器）

> 插件 ID：`com.chips.pdf` · 类型：`type: app`

薯片生态的 PDF 应用插件，提供 PDF 文档的查看、批注与保存能力。本项目基于
[GenOffice](https://github.com/genoffice/genoffice)（Apache-2.0）PDF 应用的浏览器可移植部分二次开发，
渲染引擎为 pdf.js（Apache-2.0），批注持久化使用 pdf-lib（MIT）。

## 功能概览

- **打开文档**：起始页打开对话框、整页拖放、宿主文件关联（`resourceOpen` / `targetPath` / `resourceId` 三级解析）；本地 PDF 经 Host `client.office` 会话读取。
- **连续滚动查看**：单页 / 双页模式、页面虚拟化懒渲染、文本层选择复制、缩略图与书签侧栏。
- **缩放与旋转**：档位缩放、适应宽度 / 适应页面、单页旋转（保存时写入 `/Rotate`）。
- **全文搜索**：pdf.js 文本索引，结果高亮与跳转。
- **文本标记**：划选高亮 / 下划线 / 删除线，以外观流（/AP）写入。
- **绘图批注**：自由手绘、矩形、椭圆、直线、箭头（SVG 实时预览，保存为标准 Ink/Square/Circle/Line 批注）。
- **便签批注**：页面定位钉 + 侧栏线程，支持回复链（/IRT）与已保存便签的就地改写。
- **表单填写**：AcroForm 文本框、复选框、单选、下拉。
- **印章与水印**：水印与页眉页脚（含自动页码），位图超采样预览，保存时嵌入 PNG。
- **保存 / 另存为**：pdf-lib 生成字节后，经 `client.office` 会话写回原路径或另存；web 宿主退化为浏览器下载。
- **命令系统**：文件 / 视图 / 批注三组命令，含快捷键（Mod+O、Mod+S、Mod+Shift+S、Mod+=、Mod+-、Mod+0、Mod+F 等）。
- **密码文档**：加密 PDF 弹出密码对话框，密码错误可重试（只读查看）。

## 技术栈与许可

| 组件 | 版本 | 许可 |
| --- | --- | --- |
| [pdf.js](https://github.com/mozilla/pdf.js)（`pdfjs-dist`） | 6.2.108 | Apache-2.0 |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT |
| GenOffice（移植来源） | — | Apache-2.0 |
| React / antd / `@chips/ui` / `chips-sdk` | 生态统一版本 | 随生态 |

第三方许可原文见 `node_modules` 内对应包的 LICENSE 文件；移植说明详见
`技术文档/02-移植与许可说明.md`。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-PDF
npm run dev
```

应用插件依赖通过生态根工作区解析；工程根 `manifest.yaml` 是唯一正式清单源，Host 通过 `entry: dist/index.html` 加载构建产物。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint`：执行源码规范检查。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm test`：运行单元测试与 e2e smoke。
- `npm run build`：构建应用插件产物（prebuild 自动复制 pdf.js cmaps 与 standard_fonts 到构建输出）。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run preview:smoke`：生成 Host mock 预览链路报告并校验报告，报告写入 `reports/preview/app-preview-smoke.json`。
- `npm run quality:gate`：生成生态质量门禁摘要报告，报告写入 `reports/quality/quality-gate.json`。
- `npm run verify`：串联执行完整本地验证。

`reports/` 是本地验证产物目录，默认不纳入版本管理。

## 目录结构

```text
Chips-PDF/
├─ manifest.yaml              # 正式清单（能力、权限、CLI、surface）
├─ index.html                 # 入口（含 pdf.js worker/blob CSP）
├─ scripts/
│  └─ copy-pdfjs-assets.mjs   # 构建 PDF 运行时静态资源（cmaps/standard_fonts）
├─ public/pdfjs/              # prebuild 生成：pdf.js 运行时静态资源
├─ config/                    # 应用配置与日志
├─ src/
│  ├─ pdf/                    # 渲染/几何/批注/保存核心（与 UI 解耦）
│  ├─ components/             # antd 界面组件（工具栏/侧栏/页面/对话框）
│  ├─ app/                    # Provider 装配与场景壳
│  ├─ commands/               # 命令定义与宿主注册
│  ├─ runtime/                # chips 客户端与文件访问通道
│  ├─ utils/                  # 启动参数解析与二进制归一化
│  └─ lib/messages.ts         # 简体中文文案表
└─ tests/                     # vitest 单元测试与 e2e 静态检查
```

## 范围说明

原 GenOffice PDF 应用中依赖 Electron 主进程（pdfium wasm + 系统字体目录）的能力——
**原位文本改写、图片替换、注释删除、OCR**——不属于浏览器可移植范围，本插件未实现，
详见 `需求文档/01-需求说明.md` 与 `技术文档/02-移植与许可说明.md`。
