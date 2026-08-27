# 会话记录：happy-river

- 会话 ID：ses_00fbd7f3fffeedAV6nIHy6PxEU
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-11 17:58:38

---

## 2026-08-11 17:58:38

这是一个只读调查任务，不要修改任何代码。目标仓库：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-EditingEngine

背景：我要盘点编辑引擎"自己实现"了哪些能力（而不是通过 Host/Bridge/SDK 调用），以便规划将这些能力上移到 Host 成为生态公共能力。我已经读过了 src/services/、src/core/card-service.ts、src/core/event-emitter.ts、src/services/box-document-service.ts、src/basecard-runtime/registry.ts、src/basecard-runtime/frame-host.tsx、src/runtime/chips-client.ts。

请你调查以下文件并总结它们各自实现了什么能力（重点：是否依赖 window.chips.* / chips-sdk 调用 Host，还是纯本地自实现；自实现的逻辑规模）：

1. src/core/command-manager.ts（undo/redo 历史实现细节）
2. src/core/window-manager.ts（窗口管理是否纯本地）
3. src/core/drag-drop-manager.ts
4. src/core/card-initializer.ts
5. src/core/event-emitter.ts
6. src/editor-runtime/EditorHost.tsx、src/editor-runtime/session-store.ts、src/editor-runtime/contracts.ts、src/editor-runtime/archive-import.ts、src/editor-runtime/context.tsx（编辑器资源会话、ZIP 目录导入是否本地实现）
7. src/basecard-runtime/contracts.ts、theme-css.ts、registrations/richtext.ts、registrations/image.ts、registrations/webpage.ts、CompositeCardAssembler.tsx（基础卡片装配、主题 css 注入、富文本/图片/网页渲染是否本地）
8. src/utils/card-cover.ts（默认封面生成逻辑、比例规范化）
9. src/utils/id.ts、error.ts
10. src/hooks/use-file-drop.ts、use-layout-switch.ts、useBoxDocumentSession.ts、useBoxLayoutDefinition.ts、useChipsBridge.ts
11. src/layouts/InfiniteCanvas/*（use-canvas.ts、interaction-routing.ts、canvas-drop-target.ts、DesktopLayer.tsx、WindowLayer.tsx、ZoomControl.tsx、CanvasContext.tsx）——无限画布平移/缩放/滚轮/触摸代理的实现方式
12. src/layouts/Workbench/*
13. src/components/DragDrop/*（usePointerSortableList.ts、SortableList.tsx、NestableCard.tsx、FileDropZone.tsx、DragGhost.tsx、DropHighlight.tsx、InsertIndicator.tsx）——拖拽排序是否本地自实现
14. src/components/FileManager/*、Dock/*、CardBoxLibrary/*、HistoryPanel/*、EditPanel/*、CardSettings/panels/CoverPanel.tsx、CoverCropDialog.tsx、CoverMaker/*（封面裁剪是否自实现画布操作）
15. src/components/CardWindow/*、BoxWindow/*、BaseWindow/*、WindowMenu/*
16. src/commands/*、src/lib/messages.ts
17. src/types/*、src/context/*
18. tests/ 目录结构概要（测试组织方式）

对每项请给出：一句话能力描述 + 是否本地自实现 + 是否调用 SDK/Host + 大致代码量（行数）。最后给出一个汇总清单：编辑引擎本地自实现的所有能力点（按领域分组：文件/卡片文档/箱子文档/封面/渲染装配/交互/窗口/拖拽/命令/历史/设置/多语言/主题/资源转换等）。请输出结构化 markdown 报告。
