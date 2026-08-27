# 会话记录：kind-canyon

- 会话 ID：ses_01db17735ffeYMDBiA0XfBWsgD
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:57:05

---

## 2026-08-09 00:57:05

为 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-PhotoViewer 创建新的展示组件（task031 润物计划）。不做 Git 提交。

## 你的文件域（只新建这些文件，禁止修改现有文件）
- `src/components/InfoPanel.tsx`（+ 可内联样式或独立 css `InfoPanel.css`）
- `src/components/Filmstrip.tsx`
- `src/components/NavigationArrows.tsx`
- `src/components/ViewerContextMenu.tsx`
- `src/components/EmptyState.tsx`
- `src/components/ZoomBadge.tsx`
- 组件样式：可内联 style 或独立 .css（建议独立 css 文件，类名 `pv-*` 前缀避免冲突）

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-PhotoViewer-细节设计与优化建议.md（3.4/3.8/3.9/4.2/4.4/4.5/5 章）
- 共享层 @chips/ui 的苹果风格：appleTheme（antd ConfigProvider token），毛玻璃/圆角/阴影样式参考 Chips-Ui/src/theme/global.css
- 现有 messages.ts 的 key 风格（中文直写，通过 props 传文案字符串，组件内不引 i18n）

## 组件规格（props 自包含，不依赖 PhotoViewer runtime 类型，由 Stage 接线）

### 1. EmptyState（空态重设计）
```ts
interface EmptyStateProps {
  onOpen: () => void;
  dragActive: boolean;
  extensionsLabel: string;   // "支持 .png .jpg ..."
  title?: string;            // 默认"打开一张图片"
  hint?: string;             // 副文案
  shortcutText?: string;     // "按 ⌘O 打开"
}
```
设计：居中组合——大图标（PictureOutlined，64px，系统蓝渐变圆底）、主标题（20px 加粗）、副文案（次要色）、主按钮（antd Button type="primary" size="large"）"打开图片"、快捷键提示胶囊。拖拽悬停时外层加高亮（dragActive prop 驱动边框/背景变化，配合 Stage 的 class）。

### 2. ZoomBadge（缩放百分比胶囊）
```ts
interface ZoomBadgeProps {
  percent: number;          // 0.25 = 25%
  onClick: () => void;      // 点击恢复适应窗口
}
```
设计：胶囊（毛玻璃底、圆角 999px、次要色文字），悬停 tooltip"点击恢复适应窗口"（antd Tooltip）。数值 1% 粒度（`Math.round(percent*100)`）。

### 3. NavigationArrows（浮动导航箭头）
```ts
interface NavigationArrowsProps {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}
```
设计：左右两侧居中浮动圆形毛玻璃按钮（40px，白色半透明 + blur，hover 加深），LeftOutlined/RightOutlined，禁用态透明度 0.25；入场淡入（0.2s）；位于画布内（position: absolute），不遮挡图片主体。

### 4. Filmstrip（缩略图条，P2）
```ts
interface FilmstripItem { sourceId: string; fileName: string; }
interface FilmstripProps {
  items: FilmstripItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  visible: boolean;
}
```
设计：底部居中悬浮条（毛玻璃、圆角 12px、高 72px、横向滚动），缩略图 56×56 圆角 8px（img src 用 `resourceUri`？不——组件收 `thumbSrc?: string`，由接线层传 resolve 后的 uri；未就绪显示灰色占位块），当前项高亮描边（#0a84ff 2px）+ 居中滚动；不可见时 opacity 0 + pointer-events none（过渡 0.2s）。

### 5. InfoPanel（图片信息面板，Cmd+I）
```ts
interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  path?: string;
  resolution: string;      // "3840 × 2160"
  fileSize?: string;       // "3.2 MB"
  zoomPercent: string;     // "125%"
  format?: string;         // "PNG"
}
```
设计：右侧滑入面板（宽 320px，毛玻璃白底 + 细描边 + 阴影，0.25s ease 位移），antd Descriptions 或自绘信息行（label 次要色 / value 主色）；顶部标题"图片信息"+ 关闭按钮；Esc/遮罩点击关闭由接线层处理（组件内不处理全局键盘）。

### 6. ViewerContextMenu（右键菜单）
```ts
export interface ViewerMenuAction { key: string; label: string; icon?: ReactNode; disabled?: boolean; onSelect: () => void; }
interface ViewerContextMenuProps {
  children: ReactNode;         // 包裹的查看区域
  actions: ViewerMenuAction[]; // 菜单项（分组由 key 前缀或数组顺序）
  onOpenChange?: (open: boolean) => void;
}
```
设计：antd Dropdown `trigger={["contextMenu"]}` 包裹 children，menu items 由 actions 映射（带图标、禁用态）；点击项后执行 onSelect。菜单样式苹果化（圆角 8px、细描边、阴影）。

## 红线
- 只新建文件（不修改现有文件）；禁止 any；禁止 TODO/占位；禁止删除文件
- 视觉遵循苹果风格（@chips/ui token：主色 #0a84ff、文本 #1d1d1f/#6e6e73、圆角 8-12px、毛玻璃）
- 文案通过 props 传入（组件内不 import messages.ts）
- 每个组件必须能独立通过 typecheck（React 组件类型完备）

## 验证
1. npx tsc --noEmit → 你的新文件无错误（若因未接线出现 unused 报错，确保导出类型完整）
2. npm test → 既有用例不受影响（新文件未被引用，应全绿）

## 汇报（最终消息必须包含）
- 新建文件清单与组件 API
- 设计要点（视觉/交互）
- 验证输出摘要
- 遗留疑问（若有）
