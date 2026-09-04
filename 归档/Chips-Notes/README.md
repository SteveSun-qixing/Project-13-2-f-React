# 薯片笔记

基于薯片生态的本地笔记应用。底层的笔记内容全部使用**薯片箱子和薯片卡片**进行存储，数据结构符合 `chip_standards_version: 1.0.0` 规范。

## 产品定位

- **应用类型**：`type: app`，作为 Host 中独立的应用插件运行（插件 ID：`chips.notes`）。
- **目标场景**：用户日常记录、整理和查阅笔记，与传统 Markdown 笔记软件有相近的体验；左侧目录树 + 顶部工具栏 + 右侧编辑区。
- **底层数据**：每篇笔记是一个 `.card` 文件（`base.richtext` 富文本复合卡片），以内嵌卡片形式保存在笔记本对应的 `.box` 箱子文件（ZIP Store 包）内部。
- **技术栈**：React 18 + antd 6 + `@chips/ui` + `chips-sdk` + TypeScript + Vite。

## 功能特性

- 左侧目录树：笔记本（箱子）和笔记（内嵌卡片）的两级展示，支持展开/收起、右键菜单（新建/重命名/删除）、可拖拽分割条（200~400px，宽度持久化）。
- 顶部工具栏：分组 Markdown 格式动作（粗体/斜体/删除线、标题、列表、任务列表、引用、分割线、行内代码、链接、图片）。
- 右侧编辑区：Markdown 编辑 / 预览 / 分屏三种模式，内容最大宽度 720px 居中；点击标题可重命名；链接按钮弹出文本/地址输入对话框。
- 编辑器快捷键：Mod+B / Mod+I / Mod+E / Mod+K / Mod+1~3 / Mod+S。
- 自动保存：内容变更 500ms 防抖自动保存（含 inline/file 双模式切换、箱子条目摘要同步）；切换笔记前强制落盘。
- 命令面板：6 条命令注册到 `@chips/ui` CommandProvider，快捷键与菜单统一触发。
- 工作区管理：默认工作目录为 Host 工作区根路径下的 `ChipsNotes/`，可通过系统目录选择对话框更换。
- 简体中文直写，所有 UI 文案集中在 `src/lib/messages.ts`。

## 数据结构

### 笔记本（`.box` 文件）

每个笔记本是一个符合《Chips 箱子文件规范》的 ZIP Store 包，笔记以内嵌卡片保存在包内：

```
我的笔记本.box (ZIP Store)
├── .box/
│   ├── metadata.yaml          # box_id / name / created_at / modified_at / active_layout_type
│   ├── structure.yaml         # entries[]：entry_id / url / enabled / snapshot{title,summary,...}
│   ├── content.yaml           # 布局配置（首选文档库布局，未安装时回退已注册布局）
│   └── cover.html
├── 笔记A.card                 # 内嵌卡片（包内相对路径引用）
└── 笔记B.card
```

### 笔记（`.card` 文件）

每篇笔记是一个符合《Chips 卡片文件规范》的 `base.richtext` 富文本复合卡片：

```
笔记A.card (ZIP Store)
├── .card/
│   ├── metadata.yaml          # card_id / name / created_at / modified_at / cover_ratio / tags
│   ├── structure.yaml         # structure[]（单个 base.richtext 基础卡）+ manifest
│   └── cover.html             # 基于标题自动生成的默认封面
├── content/
│   └── <baseCardId>.yaml      # base.richtext 配置（markdown_capabilities 7 项全写）
└── richtext/
    └── <baseCardId>.md        # 长文资源（纯文本 > 200 字时 content_source=file）
```

存储模式遵循 base.richtext 规范：纯文本字符数（Unicode 码点）≤ 200 写 `content_text`（inline）；超过则写 `richtext/<baseCardId>.md` 资源并在 manifest 登记（file）。两种模式互斥。

### 数据链路

全部通过 `chips-sdk` 正式接口：箱子增删改查走 `client.box.session.*`（创建/打开会话/内嵌卡片/条目更新/持久化），卡片读写走 `client.card.pack/unpack/validate`，文件操作走 `client.file.*`，配置走 `client.config`。详见 `设计方案.md` 第 4 节数据链路表。

## 项目结构

```
Chips-Notes/
├── manifest.yaml              # 插件清单（id、permissions、ui.launcher、runtime.targets）
├── package.json               # 依赖与脚本
├── chips.config.mjs           # Chips Dev 构建配置
├── tsconfig.json              # TypeScript 项目配置
├── index.html                 # HTML 入口（含 /src/main.tsx 模块入口）
├── public/manifest.json       # Web 端 manifest
├── assets/icons/              # 应用图标资源
├── src/
│   ├── main.tsx               # React 入口
│   ├── app/
│   │   ├── AppRoot.tsx        # antd zh_CN + appleTheme + ChipsProvider + CommandProvider
│   │   ├── App.tsx            # AppChrome 外壳 + 命令面板快捷键
│   │   └── NotesScene.tsx     # 主场景：状态编排、箱子会话管理、自动保存、命令 handlers
│   ├── runtime/
│   │   └── chips-client.ts    # chips-sdk 客户端单例
│   ├── components/
│   │   ├── Sidebar/           # 目录树（右键菜单 + 可拖拽分割条）
│   │   ├── Editor/            # EditorView / EditorToolbar / MarkdownEditor / MarkdownRenderer
│   │   └── EmptyState/        # 空状态
│   ├── services/
│   │   ├── richtext-card.ts   # 富文本卡片文件构建/解析（严格按卡片规范）
│   │   ├── notebook-service.ts# 笔记本管理（client.box.* 链路）
│   │   ├── note-service.ts    # 笔记管理（pack/unpack + 箱子会话）
│   │   ├── session-registry.ts# 箱子编辑会话注册表
│   │   └── workspace-service.ts # 工作区管理（client.config + workspace.getContext）
│   ├── commands/
│   │   ├── notes-commands.tsx # 6 条命令定义（含 enabled 运行时状态）
│   │   └── useNotesCommands.ts# 命令注册 Hook
│   ├── types/                 # note / notebook / workspace 类型
│   ├── lib/
│   │   ├── constants.ts       # 常量（布局类型、内联阈值、防抖延迟等）
│   │   ├── id.ts              # 10 位 Base62 文档 ID 生成
│   │   ├── markdown-text.ts   # Markdown 归一/纯文本统计/摘要
│   │   ├── tree.ts            # 目录树数据构建
│   │   └── messages.ts        # 简体中文文案
│   └── styles/                # 全局与组件样式
├── tests/unit/                # Vitest 单元测试（8 个文件 73 个用例）
└── 设计方案.md                 # 完整架构设计原稿
```

## 开发流程

### 环境准备

```bash
# 在 monorepo 根目录安装依赖
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
npm install
```

### 常用脚本

```bash
npm run dev         # 开发服务器（Host 内运行）
npm run build       # 构建产物
npm test            # 运行单元测试（vitest）
npm run typecheck   # 类型检查
npm run lint        # 代码风格检查
npm run validate    # 清单校验（manifest）
npm run package     # 打包 .cpk 发布包
```

### 安装到 Host

```bash
npm run build && npm run package
chips plugin install dist/chips.notes-0.1.0.cpk
chips plugin enable chips.notes
```

### 项目脚本统一入口

所有 npm 脚本实际调用 `chipsdev-r` 命令行工具，对应处理路径在该工具内部定义。请参考《Chips Dev 开发者命令行手册》。

## 架构红线遵循

- ✅ 所有系统能力访问通过 `chips-sdk` 暴露的 `client.file`、`client.card.*`、`client.box.*`、`client.config`。
- ✅ 卡片与箱子文件严格符合薯片正式规范（ZIP Store、字段契约、内联/文件互斥、能力声明全写）。
- ✅ UI 仅使用 antd 组件，不引入额外组件库；视觉主题走 `@chips/ui` 的 `appleTheme` token。
- ✅ 界面文案统一简体中文直写（`src/lib/messages.ts`）。
- ✅ 不留 TODO、不写临时实现；交互全部使用 antd Modal（无 prompt/confirm）。

## 已知约束与边界

- 第一版不实现 Markdown 代码语法高亮、笔记搜索、标签管理、双链、图片粘贴上传。
- 目录树由薯片笔记自建（解析箱子条目快照），不复用 `documentLibrary-BLP` 前端视图；但创建的箱子首选文档库布局类型，保证其它生态应用打开时的默认展示符合预期。
- 编辑器面板未复用 `richtext-BCP` 的前端组件，采用原生 `textarea` + 工具栏模式；卡片文件格式完全符合薯片 `base.richtext` 卡片文件标准。
- 删除笔记时由应用负责同步删除包内嵌卡片文件（Host `box.session.removeEntry` 仅维护条目引用清单，保留包内文件属于其保守设计）。
