# Chips-Sheet 表格编辑器

> 插件 ID：`com.chips.sheet`

薯片生态的表格编辑器应用插件：打开、编辑与保存 Excel（`.xlsx` / `.xlsm`）与 CSV（`.csv`）表格文件。编辑体验由开源表格引擎 Univer 承载（工具栏、公式栏、右键菜单、底部统计等引擎原生 UI 随 preset 启用），文件读写由 exceljs 实现，应用外壳（起始页、顶栏、命令、对话框）遵循生态 React + antd + `@chips/ui` 规范。

## 功能总览

- 打开本地 `.xlsx` / `.xlsm` / `.csv` 表格文件（命令菜单、快捷键 Mod+O、起始页拖放三种入口）
- 打开启动参数投递的表格文件（`resourceOpen` / `targetPath` 解析链路，见 `src/utils/launch-resource.ts`）
- 全量编辑：单元格值与公式、数字格式、字体/填充/边框/对齐样式子集、合并单元格、行高列宽、冻结窗格、多 sheet、隐藏 sheet
- 保存回原文件（Mod+S）、另存为（Mod+Shift+S）
- 新建空白工作簿（Mod+N），创建后立即写入薯片工作区 `documents/`，可直接编辑并保存
- 导出活动工作表为 CSV（UTF-8 带 BOM，数值按数字格式渲染）

详细的功能边界（保真度支持/不支持范围）见《需求文档/01-需求说明.md》。

## 技术方案概要

- **文件 IO**：Host `client.office` 负责工作区内办公文档会话、读取、写回和持久化；exceljs（MIT）承担 `.xlsx` / `.xlsm` 字节解析与重建；CSV 解码/解析/导出在 `src/sheet/csv-import.ts` 与 `src/sheet/workbook-io.ts`。
- **表格引擎**：Univer 0.25 开源 preset（Apache-2.0），`src/sheet/` 内完成引导、中文语言包、样式桥接与补丁。
- **数据链路**：打开 = exceljs 解析 → 内部 `WorkbookModel` → 一次性全量快照灌入 Univer；保存 = 从 Univer 权威快照采集 → `WorkbookModel` → exceljs 写出字节。原版 GenOffice 通过 sidecar 进程做视口懒加载，浏览器插件无法携带进程，移植后改为全量加载，详见《技术文档/01-技术方案.md》。

## 许可与出处

| 依赖 | 许可 |
| --- | --- |
| Univer（@univerjs/* 开源包） | Apache-2.0 |
| exceljs | MIT |
| @fluentui/react-icons（Univer UI 依赖） | MIT |
| 参考实现 GenOffice（apps/sheets 集成层） | Apache-2.0 |

本插件对 Univer 与 exceljs 的使用均为库依赖；对 GenOffice 集成实现（create-univer 组合逻辑、若干渲染补丁、csv-import、共享公式偏移）做了本地化移植并保留其 Apache-2.0 出处在源码头部注释中标注。详见《技术文档/02-移植与许可说明.md》。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-Sheet
npm run dev
```

应用插件依赖通过生态根工作区解析；工程根 `manifest.yaml` 是唯一正式清单源，Host 通过 `entry: dist/index.html` 加载构建产物。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint`：执行源码规范检查。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm test`：运行单元测试与 e2e 静态约束测试。
- `npm run build`：构建应用插件产物。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run preview:smoke`：生成 Host mock 预览链路报告并校验，报告写入 `reports/preview/app-preview-smoke.json`。
- `npm run quality:gate`：生成生态质量门禁摘要报告，报告写入 `reports/quality/quality-gate.json`。
- `npm run verify`：串联执行完整本地验证。

`reports/` 是本地验证产物目录，默认不纳入版本管理。

## 命令系统

| 命令 ID | 功能 | 快捷键 |
| --- | --- | --- |
| `com.chips.sheet.file.open` | 打开表格文件 | Mod+O |
| `com.chips.sheet.file.save` | 保存 | Mod+S |
| `com.chips.sheet.file.save-as` | 另存为 | Mod+Shift+S |
| `com.chips.sheet.file.new` | 新建空白工作簿 | Mod+N |
| `com.chips.sheet.file.export-csv` | 导出活动工作表为 CSV | — |

命令同时注册到 Host 命令系统（`client.command.register`）与本地命令注册表（`@chips/ui` CommandProvider），快捷键由 `AppChrome` 统一处理。

## 命令行入口

```bash
chips chips-sheet open "启动参数"
```

该命令由 Host 动态发现，执行时通过 `surface.open` 打开应用，并把位置参数写入 launch context。
