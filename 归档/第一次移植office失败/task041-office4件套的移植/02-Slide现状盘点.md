# Chips-Slide 静态代码审查报告（精简存档）

> 审查时间：2026-09-03
> 审查范围：Chips-Slide 源码（`src/`）、manifest、配置、技术文档
> 审查方式：只读静态分析（grep / 文件读取），不执行测试
> 原版对照：GenOffice Slides（Office 套件原型）

## 1. AI 残留扫描

**扫描关键词**：`aiAssistant|sidebar|suggestion|completion|llm|openai|claude|gpt|aria-label.*AI|smartWrite`

**扫描结论**：✅ **无 AI 残留**。

匹配项均为误报：
- `src/components/editor.css` 中 `.slide-stage__sidebar`（CSS 类名）
- `src/components/SlideStage.tsx` 中 `aria-label={...thumbnails...}`（无障碍标签）
- `src/slides/render/SlideThumb.tsx` 中 `// sidebar thumbnails default to 116`（代码注释）

所有 AI 相关代码已彻底剥离。

## 2. 工具栏迁移差异（原版 vs 当前）

| 功能大类 | 原版状态 | 当前状态 | 状态 |
|---|---|---|---|
| 字号/加粗/斜体/下划线 | 完整 | ✅ | 已迁移 |
| 文本颜色/填充色/描边 | 完整 | ✅ | 已迁移 |
| 无填充/无描边 | 完整 | ✅ | 已迁移 |
| 水平/垂直翻转 | 完整 | ✅ | 已迁移 |
| 图层顺序（顶层/底层） | 完整 | ✅ | 已迁移 |
| 删除元素 | 完整 | ✅ | 已迁移 |
| 撤销/重做 | 完整 | ✅ | 已迁移 |
| 缩放 | 完整 | ✅ | 已迁移 |
| 新建/复制/删除/移动幻灯片 | 完整 | ✅ | 已迁移 |
| **插入图片** | 完整 | ❌ 引擎支持但**无 UI 入口** | **缺失 P0** |
| **插入文本框** | 完整 | ❌ 无 UI 入口 | **缺失 P0** |
| **插入表格** | 完整 | 🟡 op 存在无 UI | **缺失 P1** |
| **插入形状** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **插入图表** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **插入 SmartArt** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **插入媒体（视频/音频）** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **插入页眉/页脚/日期/页码** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **插入链接/Zoom 跳转** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **插入 WordArt/公式** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **剪切/复制/粘贴** | 完整 | ❌ 无 UI 入口 | **缺失 P0** |
| **格式刷** | 完整 | ❌ 无 UI 入口 | **缺失** |
| **字体族选择** | 完整 | 🟡 仅字号下拉 | **简化 P0** |
| **段落对齐** | 4 种 | 🟡 仅 3 种（缺"两端对齐"） | **简化 P1** |
| **项目符号/编号/行距** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **文本特效（上标/下标/删除线）** | 完整 | 🟡 仅部分 | **简化** |
| **对象对齐菜单（6 方向+分布）** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **组合/解组** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **版式选择** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **重置版式** | 完整 | ❌ 无 UI 入口 | **缺失** |
| **背景设置** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **节/分段** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **放映（从头/从当前）** | 完整 | ❌ 无组件（需求文档声明不支持） | **明确不提供** |
| **查找替换** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **母版视图** | 完整 | ❌ 明确不支持（harfbuzzjs 主进程未移植） | **明确不提供** |
| **动画窗格** | 完整 | ❌ 明确不支持（`setAnimations` op 存在但无 UI） | **明确不提供** |
| **切换效果** | 完整 | ❌ 无 UI 入口 | **缺失 P1** |
| **备注页** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **批注** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **格式面板** | 完整 | ❌ 无 UI 入口 | **缺失** |
| **打印** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |
| **屏幕录制** | 完整 | ❌ 无 UI 入口 | **缺失 P2** |

## 3. 起始页 / 命令系统 / 状态机

### 起始页（StartHomeStage）
- ✅ 简洁直观
- ✅ 简体中文文案
- ✅ 新建/打开分组
- ✅ 拖放反馈 + 快捷键提示
- ✅ 格式限制提示（仅 `.pptx`）
- ℹ️ 无最近文件列表（Host 侧负责文件历史，可接受）

### 命令系统
- ✅ 命令前缀 `com.chips.slide.*`
- ✅ 宿主侧注册 + 本地命令注册
- ✅ 快捷键绑定（Mod+O/N/S）
- ❌ **F5 放映**未注册（放映视图未实现，预期内）
- ✅ 命令面板 Mod+P 由 AppChrome 自动提供

### AppRuntimeProvider 状态机
- ⚠️ `deck-store.tsx` 的 `officeSessionIdRef` 在 unmount 时正确清理
- ✅ `errorText()` / `formatMessage` 中文统一
- ✅ `pushDiagnostic`/`clearDiagnostics`/`diagnostics` 已实现
- ✅ `setActiveSceneId` + `launchContext` 联动

## 4. 资源接受链路

`src/utils/launch-resource.ts` — `resolveLaunchFileTarget`：

| 检查项 | 标准预期 | Chips-Slide 实现 | 状态 |
|---|---|---|---|
| 函数命名 | 应为 `resolveLaunchSlideTarget` | 当前为 `resolveLaunchFileTarget` | 🟡 命名略泛 |
| 路径清理 | 薯片协议要求过滤非法字符 | ❌ 未实现 | **缺失** |
| MIME 归一 | `pptm→pptx` | ❌ 未在解析链路归一 | **缺失**（应由 Host 处理） |
| sessionId 管理 | 复用/替换旧 session | ✅ `officeSessionIdRef` | 已实现 |

**新建文档链路**：`createBlankPptx` + `client.office.create({format:'pptx', fileName:'未命名演示文稿.pptx', initialBytes})` ✅

## 5. 母版 / 版式 / 缩略图能力

### 母版（Master）
- ✅ `buildRenderSlide` 解析 `masterPath`/`layoutPath`，渲染装饰性内容
- ❌ 母版编辑不支持（harfbuzzjs 主进程依赖，**明确不支持**）

### 版式（Layout）
- ✅ 渲染正确解析 layout 继承
- ❌ **版式选择 UI 缺失**（`setSlideLayout` op 已注册）
- ❌ 重置版式无独立入口

### 缩略图
- ✅ 前端 Konva 渲染（`SlideThumb` 使用 `react-konva` Stage）
- ✅ `SlideThumb` 与 `SlideCanvasStage` 共用 `NodeBody`/`StaticNode`（优秀复用）
- ❌ 无后端生成通道（当前可接受）
- ✅ 点击切换 + 高亮描边
- ✅ 缩略图侧栏已有上移/下移按钮

## 6. P0 / P1 / P2 清单

### P0（核心编辑缺失）

| 优先级 | 事项 | 当前状态 | 建议 |
|---|---|---|---|
| P0 | **插入图片** | 无 UI 入口 | 工具栏或右键菜单添加 `onInsertImage` |
| P0 | **插入文本框** | 无 UI 入口 | 工具栏添加插入文本框按钮 |
| P0 | **放映视图** | 无组件（需求文档声明不支持） | F5 入口预留，未来实现 |
| P0 | **字体族选择** | 仅字号下拉 | 接入 `useSystemFontFamilies` |
| P0 | **剪切/复制/粘贴** | 无 UI 入口 | 工具栏按钮 + 右键菜单 |

### P1（重要功能缺失）

| 优先级 | 事项 | 当前状态 | 建议 |
|---|---|---|---|
| P1 | **插入表格** | op 存在无 UI | 提供网格选择器 |
| P1 | **插入形状** | op 存在无 UI | 提供形状库面板 |
| P1 | **插入图表** | 引擎有 ChartBody 渲染 | 提供图表类型选择 |
| P1 | **版式选择** | op 存在无 UI | 提供 `LayoutList` 面板 |
| P1 | **背景设置** | op 存在无 UI | 提供 `FormatBackgroundPane` |
| P1 | **对齐/分布** | 仅翻转 | 完整对齐菜单 |
| P1 | **两端对齐** | 缺按钮 | 工具栏添加 |
| P1 | **查找替换** | op 存在无 UI | 提供 `FindReplaceDialog` |
| P1 | **项目符号/编号/行距** | 无 UI | 段落格式面板 |
| P1 | **组合/解组** | op 存在无 UI | 提供按钮 |
| P1 | **切换效果设置** | op 存在无 UI | 提供切换面板 |

### P2（增强功能）

| 优先级 | 事项 |
|---|---|
| P2 | SmartArt 插入 |
| P2 | 页眉/页脚/日期/页码 |
| P2 | 备注编辑 |
| P2 | 批注 |
| P2 | 打印 |
| P2 | 屏幕录制 |
| P2 | 节/分段 |

## 7. 关键文件清单

| 文件 | 用途 |
|---|---|
| `src/components/SlideToolbar.tsx` | 当前工具栏实现 |
| `src/components/SlideStage.tsx` | 缩略图侧栏 + 舞台 |
| `src/components/StartHomeStage.tsx` | 起始页 |
| `src/commands/app-commands.tsx` | 命令定义 |
| `src/commands/useAppCommands.ts` | 命令注册 Hook |
| `src/app/AppRuntimeProvider.tsx` | 状态机 Provider |
| `src/app/AppShell.tsx` | Shell + 场景分发 |
| `src/state/deck-store.tsx` | 文档状态中枢 |
| `src/slides/session.ts` | 本地会话 |
| `src/slides/ops/slide-ops.ts` | 幻灯片 op（含 moveSlide/setLayout/setTransition/setAnimations） |
| `src/slides/ops/registry.ts` | op 注册表 |
| `src/utils/launch-resource.ts` | 资源接受链路 |
| `src/lib/messages.ts` | 中文文案 |
| `manifest.yaml` | 插件清单 |

## 审查结论

Chips-Slide 整体架构规范、AI 剥离干净、薯片 SDK 接入正确。但 **核心编辑能力（插入图片/文本框/剪切复制粘贴）和字体族选择是 P0 体验缺陷**，需优先补齐。版式选择、背景设置、对齐分布、查找替换等 P1 项按重要性分批。放映/母版/动画窗格明确不提供，需在文档中明确说明边界。
