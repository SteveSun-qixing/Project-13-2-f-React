# Chips-PDF 静态代码审查报告（精简存档）

> 审查时间：2026-09-03
> 审查范围：Chips-PDF 源码（`src/`）、manifest、配置、技术文档
> 审查方式：只读静态分析（grep / 文件读取），不执行测试
> 原版对照：GenOffice PDF（Office 套件原型）

## 1. AI 残留扫描

**扫描关键词**：`aiAssistant | sidebar | suggestion | completion | llm | openai | claude | gpt | aria-label="AI | smartSummarize`

**扫描结论**：✅ **无 AI 残留**。所有 AI 相关文件已彻底剥离：
- ❌ 无 `AiPanel.tsx`
- ❌ 无 `AiAskPopover.tsx`
- ❌ 无 `ai/pdf-skill.ts`
- ❌ 无 `ai/tools.ts`
- ❌ 无 `ocr-layer.tsx`

匹配项仅为 PDF 侧栏组件功能的 `sidebar` 字符串。

## 2. 工具栏迁移差异（原版 vs 当前）

| 功能大类 | 原版状态 | 当前状态 | 状态 |
|---|---|---|---|
| 缩放（放大/缩小/重置） | ✅ | ✅ | 已迁移 |
| 适应宽度/适应页面 | ✅ | ✅ | 已迁移 |
| 翻页/跳页 | ✅ | ✅ | 已迁移 |
| 缩略图侧栏 | ✅ | ✅ | 已迁移 |
| 书签/目录侧栏 | ✅ | ✅ | 已迁移 |
| 搜索侧栏 | ✅ | ✅ | 已迁移 |
| 高亮文本标记 | ✅ | ✅ | 已迁移 |
| 绘图批注 | ✅ | ✅ | 已迁移 |
| 便签批注 | ✅ | ✅ | 已迁移 |
| 印章/水印 | ✅ | ✅ | 已迁移 |
| 页面旋转 | ✅ | 🟡 仅单页右键 | 部分迁移 |
| 删除页 | ✅ | ✅ | 已迁移 |
| 文本选择/复制 | ✅ | ✅ | 已迁移 |
| 表单字段填写 | ✅ | ✅ | 已迁移 |
| **签名（/Sig 控件）** | ✅ | ❌ | **缺失 P1** |
| **打印入口** | ✅ | ❌ | **缺失 P0** |
| **全屏模式** | ✅ | ❌ | **缺失 P0** |
| 暗色模式 | ⚠️ 受限于 Electron | ❌（架构一致） | 合理 |
| OCR 扫描层 | ✅ | ❌ 不适用 | 无需迁移 |
| AI 侧栏 | ✅ | ❌ 已剥离 | 已剥离 |
| 剪裁/裁切图片 | ✅ | ❌ | **缺失 P2** |
| 图片旋转/替换 | ✅ | ❌ | **缺失 P2** |
| 属性对话框 | ✅ | ❌ | **缺失 P2** |
| 边栏宽度可拖拽调节 | ✅ | ❌ 固定 132px | **缺失 P1** |
| 页面范围输入（如 "1-3,5"） | ✅ | ❌ | **缺失 P2** |
| Ctrl+0 适应宽度 | ✅ | ❌ | **缺失 P2** |

## 3. 起始页 / 命令系统 / 状态机

### 起始页（StartScene）
- ✅ 消费 `@chips/ui` 的 `StartHome`
- ✅ 简体中文文案（`formatMessage()` 集中管理）
- ✅ 拖放文件 + 打开对话框按钮
- ❌ 无最近文件分组（GenOffice 原版有）
- ❌ 无"新建 PDF"（合理）

### 命令系统
- ✅ 命令前缀 `com.chips.pdf.*`
- ✅ 已注册命令：file.open/save/save-as / view.zoom-in/out/reset / view.next-page/prev-page / view.find/sidebar / tool.select/draw/note
- ✅ 快捷键覆盖：Mod+O/S/Shift+S/F/B/=/-/0/ArrowLeft/Right/1/2/3
- ❌ PageUp/PageDown/Home/End 未绑定命令
- ❌ Ctrl+0 适应宽度缺失
- ❌ Ctrl+1 实际大小缺失
- ✅ `client.command.register()` 提交 Host
- ✅ `useCommandRegistry().register()` 驱动本地命令面板
- ✅ `usePdfCommands` 返回清理函数（取消订阅 + 反注册）

### AppRuntimeProvider 状态机
- ✅ 关闭会话清理订阅
- ✅ 中文错误兜底（`resolveErrorMessage` + `formatMessage`）
- ✅ 远程 URL 与本地文件走同一状态机（`openTarget` 统一处理）
- ✅ 并发打开互斥（`loadTokenRef`）
- ✅ office 会话泄漏防护（`openTarget` 内关闭旧会话 + unmount 关闭）

## 4. 资源接受链路

`resolveLaunchPdfTarget`（`src/utils/launch-resource.ts`）解析优先级：

```
resourceOpen.filePath > targetPath > resourceOpen.resourceId
```

支持来源：
- `launchParams.resourceOpen.payload.resource.filePath`（标准资源链路，5 层嵌套）
- `launchParams.targetPath`（CLI 直接传参）
- `resourceOpen.resourceId`（薯片资源 ID）
- HTTP URL 回退（`fetch`）
- 拖放文件回退（`client.platform.getPathForFile`）

**与其他查看器差异**：
- ✅ 远程 URL 走 `client.resource.readBinary` + `fetch` 回退
- ✅ 拖放文件走 `client.platform.getPathForFile`
- ✅ 本地文件走 `client.office.open` 会话
- ✅ 保存写回走 `client.file.write` + `office.persist`

**差距**：
- 资源接受没有"最近文件列表"（不算 bug）
- `resourceOpen` 5 层嵌套 payload 解析深度比查看器更深，需确保 Host 端格式一致

## 5. 渲染引擎 / 批注 / 表单 / 加密能力

### 渲染引擎
- ✅ pdf.js 标准 build（非 legacy）
- ✅ Worker 通过 Vite `?url` 解析
- ✅ CJK 字体（`cmaps/` + `standard_fonts/`）
- ✅ 构建资源复制（`scripts/copy-pdfjs-assets.mjs`）
- ✅ HiDPI 封顶 2x
- ✅ 懒加载 IntersectionObserver + `useVisibleSet`

### 批注写入文件
- ✅ 高亮/下划线/删除线（`/AP /N` 外观流 + Multiply 混合）
- ✅ 墨迹 InkList + 外观流
- ✅ 矩形/椭圆/直线/箭头（Square/Circle/Line + BS + 外观流）
- ✅ 便签 Text Annot + `/IRT + RT=R` 回复链
- ✅ 便签内容改写
- ✅ 印章/水印（`embedPng` + `drawImage`）
- ✅ 删除页（`removePage` 降序执行）

### 表单字段支持
| 控件类型 | 渲染 | 填写 | 保存 |
|---|---|---|---|
| TextField | ✅ | ✅ | ✅ |
| CheckBox | ✅ | ✅ | ✅ |
| RadioGroup | ✅ | ✅ | ✅ |
| Dropdown（Choice） | ✅ | ✅ | ✅ |
| /Sig（签名） | ❌ | ❌ | ❌ |
| XFA | ❌（`hasXfaMarker` 显式跳过） | ❌ | ❌ |

### 加密支持
- ✅ `PasswordException` 捕获
- ✅ `submitPassword` 传入 pdf.js 重试
- ✅ 加密文档禁止保存（`persist` 中 `encrypted` 检查）
- ✅ 加密 PDF 不支持编辑保存（符合 PDF 规范）

## 6. P0 / P1 / P2 清单

### P0（核心体验缺陷）

| 优先级 | 事项 | 影响 | 建议 |
|---|---|---|---|
| **P0** | **打印入口缺失** | 用户无法打印 PDF | 接入 `window.print()` 或 Host `transfer.print` |
| **P0** | **全屏模式缺失** | 无法沉浸式阅读 | 实现 `requestFullscreen` 或 Host 全屏 API |

### P1（重要功能）

| 优先级 | 事项 | 影响 | 建议 |
|---|---|---|---|
| P1 | **签名（/Sig 控件）缺失** | 表单类 PDF 无法签名 | 移植 GenOffice `SignatureDialog` |
| P1 | **边栏宽度固定 132px** | 大屏用户受限 | localStorage 持久化 + 拖拽调节 |
| P1 | **"全部旋转"按钮缺失** | 仅单页右键旋转 | 添加工具栏或右键菜单 |

### P2（增强功能）

| 优先级 | 事项 |
|---|---|
| P2 | 图片编辑（剪裁/旋转/替换） |
| P2 | 属性对话框 |
| P2 | Ctrl+0/Ctrl+1 精确快捷键 |
| P2 | 页面范围批量操作（如 "1-3,5"） |

## 7. 关键文件清单

| 文件 | 职责 |
|---|---|
| `src/components/PdfToolbar.tsx` | 顶部工具栏 |
| `src/components/StartScene.tsx` | 起始页场景 |
| `src/components/SidebarPanel.tsx` | 左侧缩略图/书签/搜索面板 |
| `src/components/DocumentScene.tsx` | 文档场景装配 |
| `src/components/PdfStage.tsx` | 中央滚动视图 |
| `src/components/PdfPageView.tsx` | 单页渲染（canvas + TextLayer） |
| `src/components/DrawLayer.tsx` | SVG 绘图层 |
| `src/components/FormLayer.tsx` | AcroForm 控件覆盖层 |
| `src/components/MarkupOverlay.tsx` | 文本标记覆盖层 |
| `src/components/LinkLayer.tsx` | PDF 链接热区 |
| `src/components/NoteMargin.tsx` | 便签批注边栏 |
| `src/components/OutlinePanel.tsx` | 书签目录树 |
| `src/components/StampDialog.tsx` | 印章/水印配置对话框 |
| `src/components/PasswordDialog.tsx` | 密码解锁对话框 |
| `src/pdf/pdfjs.ts` | pdf.js 运行时装配 |
| `src/pdf/use-document-viewer.ts` | 文档查看器主 Hook（~960行） |
| `src/pdf/annotations.ts` | 文本标记数据模型 |
| `src/pdf/drawings.ts` | 绘图批注数据模型 |
| `src/pdf/notes.ts` | 便签线程构建 |
| `src/pdf/save-pdf.ts` | pdf-lib 保存链路 |
| `src/pdf/form-catalog.ts` | AcroForm 控件目录 |
| `src/pdf/search.ts` | 全文搜索索引 |
| `src/pdf/key-nav.ts` | 键盘导航行为 |
| `src/pdf/stamps.ts` | 印章/水印生成 |
| `src/pdf/view-config.ts` | 缩放档位/工具类型 |
| `src/pdf/view-state.ts` | 阅读位置持久化 |
| `src/commands/app-commands.tsx` | 命令定义与注册 |
| `src/commands/useAppCommands.ts` | 命令装配 Hook |
| `src/app/PdfRuntimeProvider.tsx` | 文档生命周期 Provider |
| `src/app/AppRuntimeProvider.tsx` | 应用运行时 Provider |
| `src/app/AppShell.tsx` | 应用外壳（场景路由） |
| `src/runtime/file-access.ts` | 文件读取/写入通道 |
| `src/utils/launch-resource.ts` | 启动目标解析 |
| `src/lib/messages.ts` | 简体中文文案 |
| `manifest.yaml` | 插件声明（`com.chips.pdf`） |

## 审查结论

Chips-PDF 整体架构规范、AI 剥离干净、渲染引擎选型合理、批注写入链路完整、薯片 SDK 接入正确。**P0 缺失项为打印和全屏**，建议优先补充；其余为 P1/P2 级优化项。
