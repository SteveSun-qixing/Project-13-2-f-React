# GenOffice 深度调查报告（面向薯片生态浏览器插件移植）

下文以 `$R` 代指项目根目录： `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/OpenSourceProjectHandlingFolder/GenOffice/genoffice-main`

------

## 一、Monorepo 总览

### 1.1 工作区结构

- 根 `$R/package.json`：`workspaces: ["apps/*", "packages/*"]`，Node >= 22.12、npm >= 10，Apache-2.0。
- 所有 `@genoffice/*` 包均为 `"type": "module"`、**无构建产物**：`exports` 直接指向 `./src/index.ts` 源码，由使用方（electron-vite / vite）打包。这对移植非常友好——包边界即源码目录，直接拷贝源码即可。
- 应用一律三层结构：`src/main`（Electron 主进程，全部 Node/Electron API）、`src/preload`（contextBridge）、`src/renderer`（纯浏览器 React 代码，**实测 renderer 目录中除 `apps/docs/src/renderer/ai/protocol.ts` 外零 Node 导入、零 Buffer**）。

### 1.2 各包职责与依赖图

| 包                                           | 职责                                                         | 依赖                                                         |
| :------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| `packages/docx-engine`（26 文件 / 19.8k 行） | docx 解析（Block 树 + docxIndex 字节锚点）、OOXML 片段生成、段落级 patch 保存。入口 `src/index.ts`，子路径 `./math`、`./metafile` | pptx-engine（仅 `/custgeom` 子路径）、fast-xml-parser、jszip、utif2；内嵌 vendor `src/vendor/emf-converter`（EMF→SVG，纯 JS） |
| `packages/pptx-engine`（39 / 20.2k）         | pptx 解析（元素树 + 字节锚点）、OOXML 生成、元素级 patch 保存。入口 `src/index.ts`，浏览器安全子路径 `./custgeom`、`./table-grid`、`./identity`、`./background-promote` | fast-xml-parser、jszip                                       |
| `packages/pptx-render`（12 / 9.1k）          | pptx 高保真渲染层：EMU→px 坐标、RenderTree 数据结构、opentype.js 精确排版。纯数据，不含 canvas | pptx-engine（**type-only + 3 个安全子路径**，见 3.1）、opentype.js、bidi-js |
| `packages/file-parse`（9 / 0.6k）            | 附件转文本（PDF/Office/纯文本），**仅服务于 AI 附件**        | docx-engine、pdfjs-dist、cfb、word-extractor、ppt-to-text（Node 系） |
| `packages/font-metrics`（5 / 0.8k）          | 系统字体定位 + sfnt 垂直度量读取，**全 Node-only**           | 无                                                           |
| `packages/ui`（14 / 1.6k + 467 行 CSS）      | 共享渲染层 UI（见第四节）                                    | i18n、pptx-render                                            |
| `packages/project-store`（4 / 1k）           | 本地项目存储 + AI 聊天历史（JSONL），Node fs                 | 无                                                           |
| `packages/i18n`（1 / 0.2k）                  | 19 语言类型化 i18n 核心，零依赖                              | 无                                                           |
| `packages/agent-core`（5 / 1.1k）            | ReAct agent 循环 + IPC transport，零依赖、浏览器安全         | 无                                                           |
| `packages/ai-provider`（14 / 1.9k）          | 多 provider LLM 流式（Claude/Gemini/DeepSeek/OpenAI…），fetch 实现 | agent-core                                                   |
| `packages/ai-search`（4 / 1.4k）             | Genspark 网页/图片搜索、图片生成、媒体分析；**Node-only**    | `@genspark/cli` + node:fs/child_process/module               |
| `packages/electron-utils`（12 / 1.3k）       | Electron 主进程共享工具（菜单、对话框记忆、打印、拖拽打开）  | parse5                                                       |
| `packages/pdf2docx`（51 / 18.9k）            | 本地 PDF→DOCX/PPTX/XLSX 转换（PDFium wasm 字符级抽取 + 纯几何版面分析） | docx-engine、pptx-engine、font-metrics、@embedpdf/pdfium、bidi-js；`src/ocr-vision.ts` 调系统 OCR（child_process，Node-only） |

### 1.3 应用 → 包依赖

- **docs** → docx-engine、font-metrics（deps）、electron-utils、pptx-render（deps 里声明但 renderer 实际只移植了它的度量接口，见 `$R/apps/docs/src/renderer/line-metrics.ts`）；devDeps 含 tiptap 3.28、marked（markdown 粘贴）、officecrypto-tool（主进程解密）、pdf-lib。
- **sheets** → Univer 全家桶 `@univerjs/*@0.25.1`（只用了 Apache-2.0 的 preset-sheets-* 免费 preset）、file-parse、docx-engine（仅 `/math` 子路径给公式对话框）、ui、i18n、electron-utils、zod、rxjs；**Rust sidecar**（`apps/sheets/native/xlsx-engine`，calamine 0.36 读 + ironcalc 0.7 重算）。
- **slides** → pptx-engine、pptx-render、file-parse、konva/react-konva 9/19、harfbuzzjs（主进程 shaping）、opentype.js、utif2、acorn。
- **pdf** → pdfjs-dist 6.2（legacy build）、pdf-lib、@embedpdf/pdfium（wasm）、harfbuzzjs、font-metrics。
- **markdown** → tiptap 3.29 全套 + katex + docx-engine（导出 docx）。**与其他应用只共享 packages 层（ui/i18n/docx-engine/electron-utils），renderer 代码与其他应用零共享**（docs 有自己独立的 editor/ 目录），整体删除无连带。
- **shell** → 直接以源码相对路径导入各 app 的 `src/main` 模块（`$R/apps/shell/src/main/tab-manager.ts` 顶部 `import ... from '../../../docs/src/main/docs-main'`），用 WebContentsView 把每个 renderer 挂成标签页。

------

## 二、四个应用的前端架构

### 2.1 docs（Word）

- **入口**：`$R/apps/docs/src/renderer/main.tsx` → `App.tsx`（**4546 行单文件**）。
- **编辑器核心**：**TipTap 3.28 / ProseMirror**。分页 word 处理器：`src/renderer/editor/`（36 个模块）：`convert.ts`（PM doc ↔ docx-engine Block 树双向转换）、`pagination-gaps.ts`/`page-gap-nav.ts`（分页视觉）、`numbering.ts`、`comments.ts`、`revisions.ts`、`table-*.ts`、`equation.ts`、`ink.ts` 等。打开文件后 renderer 端直接 `parseDocx(bytes)`（docx-engine 在浏览器包内运行），保存时 `pmDocToSavePlan` → `saveDocx` 生成字节流（段落级 patch，字节保真）。
- **UI 组件**：`src/renderer/components/`——`Ribbon.tsx` + `ribbon-{design,insert,layout,references}-tab.tsx`（Word 式 Ribbon，自研）、`NavPane`、`CommentsPanel`、`FindPanel`、各对话框（`MarginDialog`、`PrintDialog`、`PasswordDialog` 等）。**无 antd，全部自研 React + 普通 CSS 类**（`styles.css` 10.5k 行），图标自绘（`icons.tsx`）。
- **文件 IO**：全部走 preload 桥 `window.desktop`（`$R/apps/docs/src/preload/index.ts`，`shared/ipc.ts` 定义 353 行契约）：`openDocx` 主进程 readFileSync 返回 ArrayBuffer → renderer 解析；保存 `saveDocx(path, ArrayBuffer)` 主进程原子写；密码加密 docx 由主进程 officecrypto-tool 处理；PDF 导出/打印在主进程 pdf-lib。**renderer 自身不含任何 fs**。
- **AI 耦合点（需删）**：`src/renderer/ai/`（AiPanel、commands、continuation、docs-skill、files-skill、edit-queue、EditQueueCard、protocol、tools、transport）、`components/AiAskPopover.tsx`、`editor/ai-queue-anchors.ts`、`shared/ipc.ts` 中的 AI 类型段、主进程 `docs-main.ts`（4274 行）中的 AI 流式代理/搜索/设置段、菜单项 `menuAiSidebar`/`menuAiProofread`、projectApi 聊天持久化。

### 2.2 sheets（Excel）

- **入口**：`src/renderer/main.tsx` → `App.tsx`（**4795 行**）+ `ExcelShell.tsx`（3407 行，Ribbon 壳）。

- **编辑器核心**：**Univer 0.25.1**。`create-univer.ts`（57 行）是自写的 preset 组装器（避开 @univerjs/presets 元包以免拉入商业 @univerjs-pro）。Univer 相关胶水：`univer-state.ts`、`univer-sync.ts`、`univer-locales.ts`、`create-univer.ts`。外围大量自研：`domain/`（内存工作簿、pivot 引擎、图表视觉等 13 文件）、renderer 层约 100 个功能文件（数据验证下拉、切片器、目标求解、公式审计、冻结/打印预览等）。

- xlsx 读写链路（移植最大风险点）

  ：

  - 打开：renderer 只通过 `window.desktopApi`（`$R/apps/sheets/src/preload/index.ts`，578 行）拿 sidecar 解析好的 workbook JSON（zod schema 定义在 `src/shared/desktop-api.ts`，2000+ 行）。主进程 `sheets-main.ts`（3752 行）spawn Rust sidecar（`src/main/xlsx-sidecar-client.ts`，child_process + stdin/stdout JSON 行协议；Rust 源在 `$R/apps/sheets/native/xlsx-engine/src/`，calamine+ironcalc+quick-xml）。
  - 保存：renderer 编辑日志（`edit-journal.ts`）→ `save-actions.ts` 汇总 → IPC → 主进程 `gateway/`（23 个文件，fast-xml-parser + jszip 纯 JS）做 patch 写回 + `xlsx-package-io.ts`（saveWorkbookViaSidecar）。

- **UI 组件**：无 components 目录，对话框/面板平铺在 renderer 根（约 25 个 `*Dialog.tsx`/`*Panel.tsx`），图标用 `@fluentui/react-icons`（唯一外部组件图标库），样式 `styles.css` 5.4k 行。

- **AI 耦合点**：`src/renderer/ai/`（19 个文件：AiChatPanel、workbook-skill、selection-ask、prompts/ 等）、`src/ai/`（deterministic-planner、privacy-policy）、主进程 AI 代理段、`renderer/App.tsx` 中的 AI 引用、desktop-api 的 ai:* 类型。

### 2.3 slides（PowerPoint）

- **入口**：`src/renderer/main.tsx` → `App.tsx`。
- **渲染**：**Konva + react-konva**。数据链：pptx-engine 解析（主进程 `openPptx`，含继承解析）→ pptx-render 生成 RenderSlide（纯数据 RenderTree）→ `konva-adapter.ts`（1469 行，机械映射无布局逻辑）→ `SlideCanvas.tsx`（1958 行）绘制与交互。文字精确排版靠 opentype.js（renderer）+ harfbuzzjs shaping（主进程 `shaped-metrics.ts`）。
- **UI**：`src/renderer/components/`——`Ribbon.tsx`、`RibbonHomeTab.tsx`、`RibbonInsertTab.tsx`、`FormatPane`、`SlideShowView`、`PresenterView`、`AnimationPane` 等 30+ 文件，自研 + styles.css 8.9k 行。
- **文件 IO**：`window.slidesApi` / `window.desktop`（preload 422 行）；打开/保存全在主进程 `slides-main.ts`（4676 行）+ `main/ops/`（元素 patch 执行器）。
- **AI 耦合点**：`src/renderer/ai/`（12 文件）、**`src/main/ai-ipc.ts`**（独立文件，删起来干净：AI 设置持久化、流式代理、图片生成、媒体分析）、`components/AiAskPopover.tsx`。

### 2.4 pdf

- **入口**：`src/renderer/main.tsx` → `App.tsx`。
- **渲染**：**pdfjs-dist 6.2 legacy build + worker**（`App.tsx` 第 5-7 行 `getDocument` + `pdf.worker.min.mjs?url`）；`PdfPage.tsx`（canvas + TextLayer）、`PdfThumb.tsx`、`OutlinePanel`。pdfjs 的 cmaps/standard_fonts/wasm 由 `vite-plugin-static-copy` 拷进 renderer 输出（`$R/apps/pdf/electron.vite.config.ts`）——**浏览器化时保留该拷贝即可**。
- **编辑特性**：批注/墨迹/图章/签名（renderer 层），真文本编辑与图片编辑走主进程 PDFium wasm（`main/text-edit.ts`、`image-edit.ts`、`font-subset.ts`、`@embedpdf/pdfium`）+ OCR（系统 OCR helper，`main/ocr.ts`，调 `pdf2docx/src/ocr-vision.ts` spawn 的平台二进制）。
- **文件 IO**：`window.pdfApi`（preload 107 行），`pdfApi.readFile` 返回字节给 pdfjs；保存走 IPC 到主进程 pdf-lib / pdfium。
- **AI 耦合点**：`src/renderer/ai/`（5 文件）、`renderer/AiAskPopover.tsx`、主进程 `pdf-main.ts` 的 AI 设置段。

### 2.5 各应用依赖清单

见 1.3；四应用共同的 devDeps 基线：react/react-dom 19.2.4、@vitejs/plugin-react、typescript 5.9.3、vite 7.3、electron-vite 5、electron 43、vitest 4。

------

## 三、引擎包浏览器兼容性

### 3.1 逐包 Node API 清单（实测 grep）

| 包                              | Node 导入文件                                                | 结论                                                         |
| :------------------------------ | :----------------------------------------------------------- | :----------------------------------------------------------- |
| docx-engine                     | **无**（zip-load.ts 用 JSZip+Uint8Array）                    | ✅ 整包浏览器安全                                             |
| pptx-render                     | **无**                                                       | ✅ 整包浏览器安全                                             |
| i18n / agent-core / ai-provider | 无                                                           | ✅（后两者本来要删）                                          |
| pptx-engine                     | 仅 3 处：`src/zip.ts`（node:crypto createHash——sha256 存档哈希）、`src/sections.ts`（node:crypto randomUUID）、`src/media-insert.ts`（node:zlib deflateSync）。**入口 index.ts re-export 了 zip.ts 的 PackageArchive，浏览器直接 import index 会炸**。而 `build-slide.ts` 已注明“renderer 打包本包，因此用子路径导入避免 engine index（node:crypto）进入浏览器构建” | ⚠️ 用子路径入口即可浏览器安全；或极小 polyfill（WebCrypto digest / `crypto.randomUUID` / `CompressionStream('deflate-raw')`）后用整包 |
| file-parse                      | `parse.ts`、`pdf.ts`（node:path）；`doc.ts`、`ppt.ts` 用 Buffer；word-extractor/ppt-to-text 是 Node 包 | ❌ 但仅用于 AI 附件抽文本，随 AI 一起删                       |
| font-metrics                    | 全部 5 文件：node:fs/os/path（读系统字体文件、目录扫描）     | ❌ 全 Node-only；浏览器端需换方案                             |
| project-store                   | `store.ts`：node:fs + node:crypto                            | ❌ Node-only；聊天/项目持久化，属 AI 边缘                     |
| pdf2docx                        | 仅 `src/ocr-vision.ts`（node:child_process spawn 系统 OCR）  | ⚠️ 其余 50 文件是纯计算（pdfium wasm 浏览器可跑）             |
| ai-search                       | `gsk.ts`、`genoffice-auth.ts`：node:fs/os/path/child_process/module | ❌ Node-only，删除                                            |
| electron-utils                  | 4 文件含 node 导入（default-save-dir、dialog-memory、print-html-pdf、safe-remote-url）；其余为 Electron API | Electron-only                                                |

### 3.2 Univer 使用位置

仅 sheets renderer：`$R/apps/sheets/src/renderer/create-univer.ts`、`univer-state.ts`、`univer-sync.ts`、`univer-locales.ts`、`ExcelShell.tsx`、`App.tsx`。Univer 本身是浏览器库，可原样移植。

### 3.3 Rust sidecar 依赖面

- 打开 xlsx：sidecar（calamine 读 + ironcalc 初始重算）→ workbook JSON → IPC → renderer。**浏览器端此路不通**。
- 替代思路：gateway/ 里已有纯 JS 的 fast-xml-parser + jszip 代码（保存链路在主进程 JS 中跑，不依赖 sidecar 的部分包括 `xlsx-sheets.ts`、`xlsx-styles.ts` 等 patch 写回），理论上可把“打开”也 JS 化（或 wasm 化 calamine/ironcalc），但这是**整个移植中工作量最大的单点**。CSV 导入导出已是纯 JS（`gateway/csv-import.ts`、`renderer/csv-export.ts`）。

------

## 四、packages/ui

- **体系**：自研，无任何组件库依赖（无 antd/mui/radix）。React 19 peer 依赖 + 4 个普通 CSS 文件（design tokens）。
- 文件（`$R/packages/ui/src/`）：`tokens.css`（浅/深/系统三套 CSS 变量，主题机制 `data-theme` + `--accent` 按应用覆盖）、`screentip.ts/css`（Office 式 ScreenTip）、`color-picker.tsx`、`dropdown.tsx`、`popover-dismiss.ts`、`icons.tsx`（仅 IconSend/IconStop）、`Markdown.tsx`（AI 面板用的 markdown 渲染）、`shape-gallery.tsx` + `wordart-presets.ts` + `symbol-fonts.ts` + `font-list.ts`（依赖 pptx-render 的 preset-geometry 画形状预览，浏览器安全）。
- **AI 组件**：`AiComposer.tsx`、`AiTypingIndicator.tsx`（删除）。
- 样式约定（`$R/CLAUDE.md` 强制）：chrome 颜色必须走 token（CI 有 `tools/check-theme-colors.mjs` 守卫），文档内容颜色硬编码不随主题。

------

## 五、AI 系统边界（删除清单）

1. **整包删除**：`packages/agent-core`、`packages/ai-provider`、`packages/ai-search`、`packages/file-parse`（唯一用途是 AI 附件抽文本，调用点：`apps/sheets/src/main/sheets-main.ts`、`apps/docs/src/main/docs-main.ts`、`apps/slides/src/main/attachments-ipc.ts`）。
2. **应用内 AI 目录整删**：`apps/{docs,sheets,slides,pdf,markdown}/src/renderer/ai/`、`apps/sheets/src/ai/`、`apps/slides/src/main/ai-ipc.ts`、`apps/docs/src/renderer/components/AiAskPopover.tsx`、`apps/docs/src/renderer/editor/ai-queue-anchors.ts`、`apps/markdown/src/renderer/editor/{aiHighlight,aiQueueAnchors}.ts`。
3. **文件内段落删**：各主进程 `docs-main.ts` / `sheets-main.ts` / `pdf-main.ts` / `markdown-main.ts` 的 AI 流式代理、ai-search 调用、ai-settings 持久化；各 `shared/ipc.ts`、`preload/index.ts` 的 `ai:*` 通道与 `AiSettings` 等类型；菜单/文案里的 AI 项。
4. **shell 里的 AI**：`cloud-projects.ts`、`star-prompt.ts`、`analytics.ts`、renderer 的 `SettingsModal.tsx`（AI provider 配置）、`provider-logos.tsx`、`StarPromptCard.tsx`。
5. **边缘决策**：`packages/project-store` 主要存 AI 聊天历史 + 项目时间线——若薯片生态不需要“项目/聊天”概念可整删（各 app 的 `projectApi` preload 桥一并删）。

------

## 六、构建方式

- **包零构建**：所有 @genoffice/* 直接 exports TS 源；消费方 bundle。**移植时无需任何打包配置改造，直接复制源码进你的 vite 工程**。
- 应用构建：electron-vite（main/preload/renderer 三段）+ electron-builder 发布；renderer 独立 dev server（vite.renderer.config.ts，端口 5173-5177）供 shell HMR 嵌入。
- TS：`$R/tsconfig.base.json`（ES2022 target、ESNext module、bundler resolution、strict、noEmit）；各 app 扩展 DOM lib + `jsx: react-jsx`；sheets 自有更严配置（noUncheckedIndexedAccess、exactOptionalPropertyTypes）。**全仓 ESM**。
- React 统一 **19.2.4**；ui 包 peer `react ^19`。测试 vitest + playwright（`$R/e2e/`）。

------

## 七、规模统计（评估移植工作量）

| 模块                                                         | 源码 ts/tsx          | CSS    | 测试文件                          |
| :----------------------------------------------------------- | :------------------- | :----- | :-------------------------------- |
| apps/docs                                                    | 118 文件 / 79,871 行 | 10,557 | 186                               |
| apps/sheets                                                  | 180 / 112,794        | 5,401  | 158（另有 Rust sidecar 9 个 .rs） |
| apps/slides                                                  | 136 / 87,610         | 8,868  | 60                                |
| apps/pdf                                                     | 72 / 32,054          | 4,126  | 43                                |
| apps/shell（弃）                                             | 36 / 15,480          | 3,222  | 20                                |
| apps/markdown（弃）                                          | 41 / 12,033          | 2,769  | 10                                |
| docx-engine                                                  | 26 / 19,822          | —      | —                                 |
| pptx-engine                                                  | 39 / 20,196          | —      | —                                 |
| pptx-render                                                  | 12 / 9,057           | —      | —                                 |
| pdf2docx                                                     | 51 / 18,899          | —      | —                                 |
| ui / i18n / font-metrics / file-parse / project-store / electron-utils | 合计 ~45 / ~6.5k     | 467    | —                                 |
| AI 三包（删）                                                | 23 / ~4.4k           | —      | —                                 |

多语言文案很大（docs 1.3MB、sheets 2MB、slides 1.5MB），移植时可只留 zh/en。

------

## 八、四类清单（移植决策表）

### A. 可直接浏览器运行（原样或近原样）

- `packages/docx-engine`（整包，含 `./math`、`./metafile`、vendor/emf-converter）
- `packages/pptx-render`（整包）
- `packages/pptx-engine` 经子路径入口（custgeom/table-grid/identity/background-promote + parse/generate 等无 Node 文件），或打 3 个小 polyfill 后用整包
- `packages/i18n`、`packages/ui`（删 AiComposer/AiTypingIndicator 后）
- 四个 app 的 `src/renderer/**`——代码本身零 Node 依赖，但所有 `window.desktop/desktopApi/slidesApi/pdfApi` 桥调用需替换为你的宿主 API（集中点：各 `file-actions.ts`、`save-actions.ts`、`use-stable.ts`、preload 对应的类型文件 `shared/ipc.ts` / `desktop-api.ts`）
- pdfjs-dist 渲染栈（含 cmaps/wasm 静态资源拷贝）、Univer 栈、TipTap（docs）、Konva

### B. 需要 Node 适配（改写为浏览器等价物）

- pptx-engine 的 `zip.ts`（sha256→WebCrypto）、`sections.ts`（randomUUID→`crypto.randomUUID`）、`media-insert.ts`（deflateSync→CompressionStream）
- `packages/font-metrics` → 用 FontFace API / canvas measure / 随包内置字体替代（docs 的 `renderer/line-metrics.ts` 已有启发式 fallback 可参考）
- sheets 的 sidecar 打开链路（最大工作量点，见 3.3）+ `sheets-main.ts` 的文件读写 → File System Access API/OPFS
- docs/slides/pdf 主进程的打开/保存/原子写/密码解密（officecrypto-tool）/PDF 导出打印（pdf-lib 可在浏览器跑，需前移到 renderer）
- pdf 主进程真文本编辑链（pdfium wasm 本身浏览器可跑；`font-subset.ts` 字体子集化需移植；OCR 建议直接砍）
- `packages/project-store`（若保留则 OPFS/IndexedDB 化）

### C. Electron-only（直接丢弃）

- `apps/shell` 整个（宿主/标签页/Home/Onboarding/updater/analytics/star-prompt/cloud-projects + 三个 pdf2xxx-local 转换入口）
- `packages/electron-utils`、各 app `src/main`+`src/preload`、`font-store.ts`（slides 内嵌字体安装）、`drop-open`、系统 OCR（`pdf2docx/src/ocr-vision.ts` + `apps/pdf/src/main/ocr.ts`）、officecrypto-tool 解密（或找浏览器替代）

### D. AI 耦合需删除

见第五节完整清单（agent-core、ai-provider、ai-search、file-parse 四个包 + 五个 renderer/ai 目录 + ai-ipc.ts + 各主进程 AI 段 + AiPanel/AiAskPopover/AiComposer 组件 + ai:* IPC + shell AI 页面 + project-store 视情况）。

**工作量粗评**：docs/pdf 引擎层基本零成本、renderer 中小适配；slides 小适配（engine 三处 polyfill）；**sheets 是主战场**（sidecar 打开链路替代 + 4795 行 App.tsx 的桥替换 + ai/ 删除），加上把每个 app 的主进程文件 IO 语义（打开对话框、recent files、原子保存、恢复副本）重新映射到浏览器文件 API。