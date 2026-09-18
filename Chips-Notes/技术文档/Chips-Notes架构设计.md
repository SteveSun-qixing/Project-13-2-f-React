# Chips-Notes 架构设计

> 创建时间：2026-09-04
> 版本：v1.0
> 状态：实现完成 ✅

## 概述

Chips-Notes 是薯片生态的笔记应用，基于 React + TypeScript + Chips SDK 构建，使用 FlexLayout 实现三栏布局，使用 antd + @chips/ui 共享层作为统一的 UI 体系。

## 技术栈

| 类别 | 选型 | 用途 |
|------|------|------|
| 框架 | React 18 | UI 框架 |
| 语言 | TypeScript | 类型安全的开发语言 |
| UI 组件 | antd + @chips/ui | 统一的 UI 组件库 |
| 布局 | FlexLayout | 三栏可调整布局 |
| 状态管理 | React Context API | 全局状态管理 |
| SDK | chips-sdk | 与 Host 通信 |
| 测试 | Vitest | 单元测试 |

## 架构层次

```
┌────────────────────────────────────────┐
│              UI Layer                  │
│   (Panels + Layout + Components)       │
├────────────────────────────────────────┤
│            Context Layer               │
│   (NotebookContext + NoteContext)      │
├────────────────────────────────────────┤
│            Service Layer               │
│  (NotebookService + NoteService)       │
├────────────────────────────────────────┤
│              SDK Layer                 │
│        (chips-sdk clients)             │
├────────────────────────────────────────┤
│          Host/File System              │
│      (.box + .card files)              │
└────────────────────────────────────────┘
```

### UI Layer

包括所有的视图组件：
- **NotesLayout**：三栏 FlexLayout 容器
- **DirectoryTreePanel**：左侧笔记本/笔记树
- **NoteEditorPanel**：中间笔记编辑区
- **CardLibraryPanel**：右侧卡片库
- **BaseCardItem**：单个基础卡片显示组件
- **BaseCardRenderer/Editor**：基础卡片渲染和编辑

### Context Layer

管理全局状态：
- **NotebookContext**：管理目录树、工作区根路径、笔记本/笔记操作
- **NoteContext**：管理当前打开的笔记、编辑状态、基础卡片 CRUD

### Service Layer

封装业务逻辑，调用 SDK：
- **NotebookService**：笔记本（箱子）的创建、删除、重命名、扫描
- **NoteService**：笔记（卡片）的创建、打开、保存、删除、基础卡片管理

### SDK Layer

通过 chips-sdk 与 Host 通信：
- `client.workspace.scan()` - 扫描工作区
- `client.box.session.*` - 箱子会话管理
- `client.card.session.*` - 卡片会话管理
- `client.card.readMetadata/readStructure()` - 读取卡片信息
- `client.file.*` - 文件操作

## 数据流

### 创建笔记流程

```
用户点击"新建笔记"
  ↓
DirectoryTreePanel.handleCreateNote(parent)
  ↓
useNotebook.createNote(name, notebookPath?)
  ↓
NotebookContext 创建任务分发
  ↓
noteService.createNote(name, notebookPath?)
  ↓
client.card.session.init(parent, name, initialContent)
  ↓
文件系统写入 .card 骨架文件
  ↓
refreshTree() 刷新目录树
  ↓
显示新创建的笔记
```

### 打开笔记流程

```
用户点击目录树中的笔记节点
  ↓
DirectoryTreePanel.handleSelect(key, info)
  ↓
useNote.openNote(cardPath)
  ↓
NoteContext 调用 noteService.openNote
  ↓
client.card.readMetadata → 读取元数据
client.card.readStructure → 读取结构
client.file.readText → 加载每个 basecard 配置
  ↓
构建 Note 对象
  ↓
NoteEditorPanel 渲染所有基础卡片
```

### 编辑基础卡片流程

```
用户点击基础卡片的"编辑"按钮
  ↓
BaseCardItem.onEdit
  ↓
NoteContext.setEditingBasecard(cardId)
  ↓
BaseCardItem 渲染 BaseCardEditor 而非 BaseCardRenderer
  ↓
用户修改配置
  ↓
onChange 调用 NoteContext.updateContent
  ↓
触发防抖自动保存（3 秒后）
  ↓
或用户点击保存按钮
  ↓
noteService.saveNote 或 updateBasecardConfig
  ↓
client.file.writeText 写入文件
  ↓
更新 UI 状态
```

## 关键设计决策

### 1. 使用 Context API 而非 Redux

- **原因**：项目规模适中，Context API 足够使用
- **优势**：减少依赖，代码简洁
- **性能**：React 18 的 useCallback 包装确保状态稳定

### 2. 基础卡片元数据与 React 组件分离

- **types.ts**：纯数据（BaseCardTypeDefinition）
- **registry.tsx**：包含 React 图标
- **原因**：服务层（note-service.ts）需要导入数据，但不应该导入 JSX

### 3. 富文本卡片内联编辑

- **行为**：富文本卡片的编辑面板直接在中间区域显示
- **其他卡片**：需要切换右侧到编辑面板
- **实现**：通过 `editingBasecardId` 状态控制

### 4. 自动保存防抖

- **延迟**：3 秒
- **触发**：内容修改时
- **指示器**：状态栏显示"正在自动保存..."或"已自动保存"

### 5. 拖拽排序

- **HTML5 拖拽 API**：原生支持
- **响应式**：拖拽过程中目标位置高亮
- **保存**：drop 时调用 `reorderBasecards`

## 关键文件清单

### 服务层

| 文件 | 职责 |
|------|------|
| `src/services/notebook-service.ts` | 笔记本管理（CRUD + 扫描） |
| `src/services/note-service.ts` | 笔记管理（CRUD + 基础卡片管理） |

### 状态层

| 文件 | 职责 |
|------|------|
| `src/context/NotebookContext.tsx` | 笔记本全局状态 |
| `src/context/NoteContext.tsx` | 笔记全局状态 |

### UI 层

| 文件 | 职责 |
|------|------|
| `src/layouts/NotesLayout.tsx` | FlexLayout 三栏布局 |
| `src/panels/DirectoryTreePanel.tsx` | 左侧目录树 |
| `src/panels/NoteEditorPanel.tsx` | 中间编辑区 |
| `src/panels/CardLibraryPanel.tsx` | 右侧卡片库 |
| `src/basecards/registry.tsx` | 卡片注册表（React 版本） |
| `src/basecards/types.ts` | 卡片类型数据 |
| `src/basecards/renderers.tsx` | 卡片查看渲染 |
| `src/basecards/editors.tsx` | 卡片编辑面板 |
| `src/basecards/BaseCardItem.tsx` | 单个基础卡片显示组件 |

## 扩展点

### 新增基础卡片类型

1. 在 `src/basecards/types.ts` 中添加类型定义
2. 在 `src/basecards/registry.tsx` 的 `getIconForType` 中添加图标
3. 在 `src/basecards/renderers.tsx` 中添加渲染器
4. 在 `src/basecards/editors.tsx` 中添加编辑器
5. 在 `BaseCardRenderer` 和 `BaseCardEditor` 的 switch 中添加分支

### 集成新的资源处理

基础卡片编辑器统一使用 BaseCardEditor 组件，可以通过修改编辑器实现自定义的资源上传、删除等操作。

## 验证状态

- ✅ ESLint 通过
- ✅ TypeScript 编译通过
- ✅ 构建成功
- ✅ 开发服务器运行
- ✅ 35 个单元测试通过
  - 9 个 NotebookService 测试
  - 15 个 NoteService 测试
  - 11 个 BaseCardRegistry 测试

## 后续优化方向

1. **虚拟滚动**：大量基础卡片时性能优化
2. **全文搜索**：支持跨笔记内容搜索
3. **撤销/重做**：操作历史栈
4. **快捷键扩展**：更多键盘操作
5. **主题定制**：通过 @chips/ui 实现
