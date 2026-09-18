# 薯片笔记 - Chips Notes

> 插件 ID：`chips-official.notes`  
> 插件类型：应用插件（`type: app`）  
> 工程角色：薯片生态笔记应用  
> 版本：0.1.0

## 1. 工程定位

薯片笔记是一款现代化的笔记应用，底层完全基于薯片生态的卡片和箱子文件系统，但在用户体验上模仿传统 Markdown 笔记软件的交互方式。

### 核心特性

- 📝 **流式编辑体验** - 像使用传统笔记软件一样直接输入和编辑
- 📁 **笔记本组织** - 使用笔记本（箱子）管理笔记分类
- 🎨 **多种内容类型** - 支持富文本、图片、视频、音频、网页等多种卡片
- 🔄 **无缝集成** - 完全兼容薯片生态的卡片和箱子标准
- 🎯 **简洁界面** - 三栏布局，专注于内容创作

### 技术亮点

- 使用 **FlexLayout** 实现可调整的三栏布局
- 复用 **编辑引擎** 的基础卡片装配和渲染能力
- 通过 **chips-sdk** 正式链路操作文件系统
- 遵循薯片生态前端基础规范（**antd + @chips/ui**）

## 2. 快速开始

### 环境要求

```bash
cd <生态工作区>
npm install
cd Chips-Notes
```

### 常用命令

- `npm run dev`：启动 Vite 开发服务器
- `npm run run`：通过 `chipsdev-r run` 在真实 Host 开发链路中运行
- `npm run build`：构建插件产物
- `npm test`：运行测试
- `npm run lint`：执行 ESLint
- `npm run validate`：执行插件契约校验
- `npm run package`：打包插件

## 3. 界面布局

```
┌─────────────────────────────────────────────────────────┐
│                     应用标题栏                           │
├──────────┬──────────────────────────┬───────────────────┤
│          │                          │                   │
│  目录树  │      笔记编辑区          │  卡片库/编辑面板  │
│  (左侧)  │      (中间)              │     (右侧)        │
│          │                          │                   │
│  笔记本1 │  ┌─────────────────┐    │  ┌─────────────┐ │
│  ├─笔记1 │  │ 富文本编辑区    │    │  │ 富文本      │ │
│  ├─笔记2 │  └─────────────────┘    │  │ 图片        │ │
│  笔记本2 │                          │  │ 视频        │ │
│  未分类  │  ┌─────────────────┐    │  │ 音频        │ │
│          │  │ 图片卡片        │    │  │ 网页        │ │
│  [新建]  │  └─────────────────┘    │  │ ...         │ │
│          │                          │  └─────────────┘ │
│          │      [保存笔记]          │                   │
└──────────┴──────────────────────────┴───────────────────┘
```

**三栏布局说明**：
- **左侧（20%）**：目录树面板，显示笔记本和笔记的层级结构
- **中间（50%）**：笔记编辑面板，流式展示和编辑笔记内容
- **右侧（30%）**：卡片库/编辑面板，选择和编辑不同类型的内容块

## 4. 应用框架结构

笔记应用基于应用插件 vNext 基线，并进行了笔记场景的专门优化：

- `src/App.tsx`：轻量入口，只导出 `AppRoot`
- `src/app/`：
  - `AppRoot`：antd ConfigProvider + `@chips/ui` ChipsProvider/CommandProvider + AppRuntimeProvider
  - `AppShell`：AppChrome + NotesLayout（FlexLayout 三栏布局）
- `src/layouts/`：NotesLayout（FlexLayout 配置和组件工厂）
- `src/panels/`：三个核心面板组件
  - `DirectoryTreePanel`：目录树面板
  - `NoteEditorPanel`：笔记编辑面板
  - `CardLibraryPanel`：卡片库/编辑面板
- `src/runtime/`：SDK client 单例、launch/surface context
- `src/services/`：业务逻辑服务（笔记、笔记本、卡片管理）
- `src/context/`：状态管理（笔记、笔记本状态）
- `src/basecard-runtime/`：基础卡片运行时（复用编辑引擎）
- `src/commands/`：本地命令定义（简体中文 + antd 图标）

## 5. 核心概念

### 笔记本（Notebook）

- **本质**：采用文档库布局的 `.box` 箱子文件
- **用途**：组织和分类笔记
- **操作**：可以创建、删除、重命名笔记本

### 笔记（Note）

- **本质**：`.card` 卡片文件，包含多个基础卡片
- **用途**：记录内容，支持多种内容类型
- **操作**：可以创建、编辑、保存、删除笔记

### 基础卡片（Basecard）

- **本质**：独立的内容块（富文本、图片、视频等）
- **用途**：构成笔记的基本单元
- **操作**：可以插入、编辑、删除基础卡片

## 6. 使用方式

### 创建笔记本

1. 在左侧目录树点击右键菜单
2. 选择"新建笔记本"
3. 输入笔记本名称

### 创建笔记

1. 在目录树中选择笔记本或根目录
2. 点击右键菜单中的"新建笔记"
3. 输入笔记名称
4. 笔记自动打开到编辑区

### 编辑笔记

1. 在目录树中点击笔记
2. 中间区域显示笔记内容
3. **富文本卡片**：直接在中间区域编辑
4. **其他卡片**：点击后右侧显示编辑面板
5. 编辑完成后点击"保存"按钮

### 插入内容

1. 在右侧卡片库中选择内容类型
2. 点击或拖拽到中间编辑区
3. 自动进入编辑模式
4. 编辑完成后保存

## 7. 正式运行边界

- 系统能力访问统一经 `chips-sdk` 与 `window.chips.*`，不直连 Host 内部实现
- 命令面板、快捷键共享同一组 `CommandItem` 命令定义
- 完全使用 `.card` 和 `.box` 文件格式存储数据
- 复用编辑引擎的基础卡片装配和渲染能力

## 8. 目录概览

```text
Chips-Notes/
├─ manifest.yaml           # 插件清单
├─ package.json           # 项目配置
├─ chips.config.mjs       # 构建配置
├─ assets/
│  └─ icons/              # 应用图标资产
├─ src/
│  ├─ App.tsx             # 应用入口
│  ├─ main.tsx            # 挂载点
│  ├─ app/                # AppRoot / AppShell
│  ├─ layouts/            # NotesLayout（FlexLayout）
│  ├─ panels/             # 三个核心面板
│  ├─ services/           # 业务逻辑服务
│  ├─ context/            # 状态管理
│  ├─ basecard-runtime/   # 基础卡片运行时
│  ├─ editor-runtime/     # 编辑器运行时
│  ├─ runtime/            # SDK client / launch
│  ├─ commands/           # 命令定义
│  ├─ hooks/              # 自定义 Hooks
│  ├─ types/              # TypeScript 类型
│  ├─ styles/             # 全局样式
│  └─ lib/                # 工具函数
└─ tests/                 # 测试文件
```

## 9. 图标系统

笔记应用图标链路已经收口为正式实现：

- 运行时 UI 图标入口：`src/icons/descriptors.ts`
- 统一运行时组件：`src/icons/RuntimeIcon.tsx`
- 应用品牌图标组件：`src/icons/AppBrandIcon.tsx`
- 命令图标均使用 `IconDescriptor`

正式规则：

- 运行时 UI 图标统一走 `RuntimeIcon`（`@ant-design/icons` 按 `IconDescriptor.name` 映射）
- 不再保留 emoji、字符图标或 `icon: string`
- `manifest.yaml -> ui.launcher.icon` 只表示系统入口图标文件路径

## 10. 视觉、文案与可访问性

- **主题系统**：统一固定苹果风格（antd `ConfigProvider theme={appleTheme}`）
- **多语言系统**：界面文案统一简体中文，集中文案表为 `src/lib/messages.ts`
- **可访问性**：接入 `@chips/a11y` 公共键盘模型、roving tabindex、ARIA 关系和焦点恢复

## 11. 验证矩阵

正式验证基线：

```bash
cd Chips-Notes
npm run lint      # ESLint 检查
npm test          # 运行测试
npm run build     # 构建验证
npm run validate  # 插件契约校验
```

## 12. 开发文档

详细的开发文档位于项目日志目录：

- **任务说明**：`项目日志与笔记/task042-笔记软件开发/任务说明.md`
  - 完整的需求分析和功能设计
  - 开发计划和验证标准
  
- **架构设计**：`项目日志与笔记/task042-笔记软件开发/架构设计.md`
  - 技术架构和模块设计
  - 数据流和文件系统映射
  
- **开发指南**：`项目日志与笔记/task042-笔记软件开发/开发指南.md`
  - 代码规范和最佳实践
  - 调试技巧和常见问题
  
- **进度报告**：`项目日志与笔记/task042-笔记软件开发/进度报告.md`
  - 当前开发进度
  - 待办事项和技术债务

## 13. 开发规范

本项目遵循薯片生态开发规范：

- ✅ 统一使用 antd 和 `@chips/ui` 组件库
- ✅ 界面文案统一使用简体中文
- ✅ 视觉样式通过 antd 主题定制（token）
- ✅ 通过 chips-sdk 正式链路访问系统能力
- ✅ 禁止硬编码样式和引入第二套组件库
- ✅ 禁止留 TODO 注释
- ✅ 所有修改必须通过 lint 和 build 验证

## 14. 技术栈

- **框架**：React 18 + TypeScript
- **UI 组件**：Ant Design 6 + @chips/ui
- **布局系统**：FlexLayout
- **构建工具**：Vite
- **测试框架**：Vitest
- **运行时**：chips-sdk

## 15. 相关说明

- 若公共图标契约或标准发生变化，应先更新 `生态共用技术文档/`
- 若项目文档与 `manifest.yaml`、真实代码冲突，以真实代码与正式共享文档为准
- 当前工程不是脚手架示例，不允许再按模板工程理解其目录、脚本与运行边界

---

**当前状态**：开发中 🚧  
**最后更新**：2026-09-04
