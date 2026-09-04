# Chips-Slide（演示文稿编辑器）

> 插件 ID：`com.chips.slide` · 薯片生态 `type: app` 应用插件

Chips-Slide 用于在薯片生态内直接打开、编辑与保存 PowerPoint（.pptx）演示文稿。工程基于 **GenOffice（Apache-2.0）** 的 Slides 应用二次开发：原版跑在 Electron 主进程的解析/编辑引擎被完整移植进浏览器渲染进程（本地会话模型），界面按薯片生态前端基础规范（React 18 + antd 6 + `@chips/ui`）全新实现。

## 功能一览

- **新建与打开**：新建空白演示文稿（Mod+N）会立即写入薯片工作区；也可通过系统对话框（Mod+O）、起始页整页拖放或宿主启动目标打开文档
- **编辑**：文本就地编辑（run 级富文本/IME/纵向文本）、字号/加粗/斜体/下划线、对齐、填充与描边（ColorPicker）、拖动/缩放/旋转/翻转、层级、删除、图片非破坏裁剪、撤销/重做（快照历史）
- **幻灯片**：新建/复制/删除当前页，缩略图列表与当前页高亮
- **保存**：Mod+S 原路径保存（未修改页逐字节透传的补丁式保存）、Mod+Shift+S 另存为、导出当前页 PNG；web 宿主降级下载通道
- **命令**：`com.chips.slide.*` 命令族经命令面板（Mod+P）与快捷键可达，分组「文件/编辑/视图/幻灯片」

能力边界（如实说明，无占位实现）：不支持图表数据编辑、母版编辑视图与 AI 能力；详见《需求文档/01-需求说明.md》。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-Slide
npm run dev        # 开发服务器（chipsdev-r server）
```

应用插件依赖通过生态根工作区解析；工程根 `manifest.yaml` 是唯一正式清单源，Host 通过 `entry: dist/index.html` 加载构建产物。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint` / `npm run typecheck`：源码规范检查 / TypeScript 类型检查。
- `npm test`：运行单元测试与 e2e（vitest，范围限定 `tests/`）。
- `npm run build`：构建产物到 `dist/`。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run preview:smoke` / `npm run quality:gate`：mock 预览 smoke / 生态质量门禁（报告写入 `reports/`）。
- `npm run verify`：串联执行以上全部本地验证（生态交付口径）。

## 架构要点

```
React 组件层（antd + @chips/ui，AppShell/场景/工具栏/Konva 舞台）
      │ useDeck() 状态中枢
本地会话层  SlidesDocumentSession（open / applyOp + 快照历史 / rebuild / save）
      │
引擎层     vendor/pptx-engine（解析与补丁保存）+ vendor/pptx-render（RenderTree）
      │
渲染适配层 konva-adapter → react-konva（Canvas）+ DOM 覆盖层（文本编辑/裁剪/墨迹）
```

- 原版引擎经 IPC 调用主进程；移植后全部进渲染进程，op 类型契约与执行语义保持不变。
- vendor 引擎已完成 Node → 浏览器 API 修补（WebCrypto/TextEncoder/fflate 等 4 处），排查与替换清单见《技术文档/02-移植与许可说明.md》。
- 系统能力（办公文档会话、文件对话框/读写、启动上下文、命令）只经 `chips-sdk` 与 `window.chips.*` 正式链路；本地 PPTX 使用 `client.office` 打开、读取、写回与持久化。

## 目录结构

```text
Chips-Slide/
├─ manifest.yaml            # 插件清单（capabilities/permissions/cli 入口）
├─ index.html               # 入口（zh-CN，CSP 含 data:/blob:）
├─ config/                  # app-config / logging
├─ src/
│  ├─ app/                  # AppRoot（Provider 顺序）/ AppRuntimeProvider / AppShell / 场景注册表
│  ├─ components/           # 起始页 / 编辑舞台 / 工具栏 / 画布 + CSS
│  ├─ commands/             # 命令定义与注册
│  ├─ state/                # deck-store（会话 + 界面状态中枢）
│  ├─ slides/               # 本地会话 / 快照历史 / op 执行器 / 渲染与覆盖层
│  ├─ lib/messages.ts       # 简体中文文案表
│  ├─ runtime/              # chips-client / launch-context
│  ├─ testing/              # 测试 Provider 包裹与 mock 环境
│  └─ utils/                # 启动资源解析（文件打开链路）
├─ tests/                   # 单元 + e2e（vitest）与 pptx 夹具
├─ vendor/                  # GenOffice 引擎（Apache-2.0，浏览器化补丁）+ 许可文件
└─ 归档/                    # 脚手架示例归档
```

## 文档

- 《需求文档/01-需求说明.md》：功能清单、验收口径、明确不支持项及原因
- 《技术文档/01-技术方案.md》：会话模型架构、目录结构、op 流转链路、RenderTree 渲染链路
- 《技术文档/02-移植与许可说明.md》：Node→浏览器替换清单、排除清单、许可合规
- 生态规范：《生态共用技术文档/》

## 技术口径

- React 18 + antd 6.5.4（唯一组件库）+ `@ant-design/icons` + `@chips/ui`（appleTheme/AppChrome/ChipsProvider/CommandProvider）；禁止第二套组件库与 i18n 框架。
- 界面文案简体中文直写，集中在 `src/lib/messages.ts`（`formatMessage(key, params)`）。
- 视觉统一走 CSS 变量（生态苹果色）与 `@chips/ui`/antd token；TSX 无内联样式对象；画布覆盖层的动态几何经 `overlay-style.ts` 命令式写入。
- 基于 GenOffice（Apache-2.0）二次开发，vendor 目录保留其许可证与 NOTICE。

## 命令行入口

```bash
chips chips-slide open "启动参数"
```

由 Host 经 `manifest.cli.commands` 动态发现，执行时通过 `surface.open` 打开应用并把位置参数写入 launch context。
