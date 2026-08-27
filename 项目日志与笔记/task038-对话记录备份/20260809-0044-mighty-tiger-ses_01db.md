# 会话记录：mighty-tiger

- 会话 ID：ses_01dbd0d3effe472EE5KIDP2tCk
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:44:26

---

## 2026-08-09 00:44:26

增强共享层 @chips/ui 的 AppChrome（task031 润物计划，供 PhotoViewer 沉浸式查看使用，不破坏现有应用）。不做 Git 提交。

## 你的文件域
/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-Ui/src/components/AppChrome.tsx（必要时 MenuBar.tsx/Toolbar.tsx 只读参考，不动）

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-PhotoViewer-细节设计与优化建议.md（4.1 沉浸式）
- 当前 Chips-Ui/src/components/AppChrome.tsx 代码

## 任务内容
为 AppChrome 增加**可选**的"沉浸式/自动隐藏"能力，默认关闭（不影响 MusicPlayer 等现有应用）：

### 新增 props（全部可选，默认不影响现有行为）
```ts
interface AppChromeProps {
  // ...现有
  immersive?: boolean;            // 开启沉浸模式：菜单栏+工具栏自动隐藏
  immersiveContentClass?: string; // 沉浸时内容区额外 class（供调用方深色画布等）
}
```

### 行为设计
1. `immersive` 为 true 时：
   - 菜单栏与工具栏容器默认向上移出（transform: translateY(-100%)，0.25s ease），内容区占满；
   - 鼠标移动到窗口顶部 16px 区域、或任意鼠标移动（mousemove）时浮现（浮现后 2.5s 无移动自动隐藏）；
   - `Esc` 键可切换显隐（沉浸态下按 Esc 隐藏/显示工具栏）；
   - 隐藏时工具栏不参与布局（absolute 定位或 translate，用 CSS transition 实现，不要条件渲染导致跳动）。
2. `immersive` 为 false 时：行为与现状完全一致（零改动影响）。
3. 沉浸模式下菜单栏/工具栏建议加毛玻璃底（已有）并在顶部悬浮时带细描边。

### 实现要点
- 用 CSS transform 过渡而非 display 切换（丝滑）；
- 监听 window mousemove / keydown(Escape) 时需在 unmount 清理；
- 隐藏状态用 useRef + useState 组合，避免频繁重渲染（mousemove 高频事件不要 setState 每帧——用 rAF 节流或仅在"状态需要翻转"时 setState）；
- 导出类型：`AppChromeImmersive` 相关 props 并入 AppChromeProps。

### 测试
- Chips-Ui/tests/ 下为沉浸能力补测试：immersive 默认关闭时渲染结构不变；开启后菜单栏有 translateY(-100%) 初始态；Esc 可切换。

## 红线
- 不破坏现有应用（PhotoViewer/MusicPlayer 等传 immersive=false 时输出与现在一致）
- 禁止 any；禁止 TODO/占位；禁止删除文件
- 不碰 Chips-Ui 其他文件（如确需改 MenuBar/Toolbar 结构，改为在 AppChrome 内用容器包裹实现，不动它们）

## 验证
1. Chips-Ui: npx tsc --noEmit → 0 错误
2. Chips-Ui: npm test → 全绿（含新增测试）
3. 确认现有应用无回归（本仓库测试即可代表）

## 汇报（最终消息必须包含）
- 改动清单与 API 说明
- 验证输出摘要
- 遗留疑问（若有）
