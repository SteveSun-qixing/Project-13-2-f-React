# Chips Word（文档编辑器）

> 插件 ID：`com.chips.word`

薯片生态的 Word（.docx）文档编辑应用插件：打开 .docx → 分页白纸视图编辑 → 字节级保真保存 .docx。基于 **GenOffice（Apache-2.0）** 的编辑器核心与 docx 引擎二次开发，以纯浏览器方式实现，无任何宿主进程 IPC。

## 功能

- **打开**：文件对话框（Mod+O）、启动目标（resourceOpen 三级优先解析）、整页拖放；本地路径 / http(s) URL / 生态资源三通道读取字节。
- **编辑**：TipTap/ProseMirror 自定义 schema，分页白纸视图（按文档分节几何），工具栏（标题级别/字体/字号/加粗斜体下划线删除线/字体颜色/高亮/对齐/行距/缩进/列表/插入表格），撤销重做，粘贴清洗，修订显示，脚注/尾注/公式/文本框等扩展。
- **保存**：Mod+S 覆盖原路径、Mod+Shift+S 另存为；字节保真补丁只重写被编辑的 OOXML 片段，其余内容保持原字节；保存后重新解析重锚定并尽量保留撤销栈；Web 宿主自动降级为浏览器下载。
- **新建**：起始页或文件菜单可新建空白文档，使用 GenOffice 空白模板并通过 `client.office` 会话立即保存到薯片工作区 `documents/`。
- **打印**：`@media print` 样式 + `window.print()`（可另存为 PDF）。
- **视图**：缩放 30%–300%（状态栏滑杆/按钮/Mod+=、Mod+-、Mod+0），字数（Word 口径）与页数统计。
- **命令系统**：8 条命令（`com.chips.word.file.*` / `view.*`）注册至命令面板（Mod+P），通过快捷键分发，中文分组「文件」「视图」。

## 明确不支持

- 加密（口令保护）.docx（给出友好提示）
- .doc 二进制格式；PDF 导出以打印替代

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-Word
npm run dev
```

应用插件依赖通过生态根工作区解析；工程根 `manifest.yaml` 是唯一正式清单源，Host 通过 `entry: dist/index.html` 加载构建产物。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint`：执行源码规范检查（禁止 TODO/FIXME）。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm test`：运行单元测试与 e2e smoke（vitest）。
- `npm run build`：构建应用插件产物。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run verify`：串联执行完整本地验证。

## 目录结构

```text
Chips-Word/
├─ manifest.yaml            # 唯一正式清单源
├─ index.html               # lang=zh-CN + data-chips-app
├─ config/                  # appConfig
├─ src/
│  ├─ app/                  # Provider 链、运行时、场景
│  ├─ commands/             # 命令定义与注册
│  ├─ components/           # 起始页/工具栏/文档舞台/状态栏
│  ├─ editor/               # GenOffice 编辑器核心移植
│  ├─ lib/                  # 文案表、文档 I/O 管线、二进制解包
│  ├─ runtime/              # chips-sdk Client 与启动上下文
│  ├─ utils/                # 打开目标解析
│  ├─ styles/               # 编辑器视觉（含打印样式）
│  ├─ testing/              # 测试辅助（mock client / Provider 包裹）
│  └─ assets/fonts/         # 内置字体（OFL）
├─ tests/                   # vitest 单元与 e2e（fixtures/simple.docx）
├─ vendor/                  # GenOffice 引擎源码（Apache-2.0，含 LICENSE/NOTICE）
└─ 归档/                    # 脚手架示例归档（不参与构建）
```

## 技术口径

- React 18 + antd 6.5.4（唯一组件库）+ `@ant-design/icons` + `@chips/ui`（appleTheme）共享层；系统组件经 `chips-sdk` 与 `window.chips.*` 正式链路消费。
- 用户可见文案简体中文直写，统一放 `src/lib/messages.ts`（`formatMessage(key, params)`）。
- 视觉走 antd token 与 `@chips/ui`；应用样式在 CSS 文件中以类名与生态色板变量书写，JSX 无内联样式。
- 场景注册表定义 `start`（起始页）与 `document`（文档编辑）两场景，由运行时状态推导切换。

## 许可声明

- 本应用基于 [GenOffice](https://github.com/genspark-ai/genoffice)（Apache-2.0）二次开发；GenOffice 引擎源码位于 `vendor/`，其 `LICENSE` 与 `NOTICE` 原文保留于 `vendor/GENOFFICE-LICENSE`、`vendor/GENOFFICE-NOTICE`。
- 内置字体 Carlito、Caladea、Liberation、Noto（CJK/阿拉伯/泰米尔子集）为 SIL Open Font License 1.1，许可文本见 `src/assets/fonts/LICENSE-OFL.txt` 与 `src/assets/fonts/README.md`。
- 详细移植清单与 Node → 浏览器替换说明见 `技术文档/02-移植与许可说明.md`。
