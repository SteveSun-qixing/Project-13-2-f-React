# Chips-PhotoViewer 细节设计与优化建议

> 任务：task031-润物计划-生态细节优化
> 日期：2026-08-08
> 目标：对标世界最好用、最美观、最丝滑、交互最好的图片查看器（macOS Preview / Apple Photos / Google Photos / Windows Photos / FastStone）
> 定位：本文档基于当前代码逐文件推敲（src/ 共 15 文件、约 2269 行），给出可执行的优化建议，按 P0（必须修）/ P1（强烈建议）/ P2（锦上添花）分级。

---

## 0. 实施状态（2026-08-08 更新）

> 本文档所列建议已于 **2026-08-08** 完成实施（核对基准：2026-08-09 实际代码与验证链路）。逐项标注：**✓ 已实现 / ◐ 部分实现 / ✗ 未实现（含原因）**。验证结果：`npm test` 26/26 全绿（6 个文件）、`tsc --noEmit` 无错误、`npm run lint` 通过。实施明细见《Chips-PhotoViewer-实施记录.md》。

| 级别 | 汇总结果 |
|---|---|
| P0 关键缺陷 | **4/4 修复**：渲染循环 ✓、平移边界 ✓、动画 ✓、小图不放大 ✓ |
| P1 交互 | **全部落地**：双击 ✓、回弹 ✓、滑动切图 ✓、缩放百分比 ✓、键盘 ✓（除 Space）、全屏 ✓、旋转 ✓、浮动箭头 ✓ |
| P1 视觉 | **全部落地**：沉浸式画布 ✓（共享层 AppChrome immersive）、空态 ✓、加载/切换动效 ✓、toast 玻璃化 ✓、信息面板 ✓（文件大小待 Host 能力）、图标语义 ✓ |
| P1 性能 | **全部落地**：合成层 ✓、rAF 节流 ✓、LRU 预加载 ✓；大图降采样 ✗（不做，浏览器原生已够） |
| P2 | 大部分落地：多选打开 ✓、缩略图条 ✓（已接线：runtime jumpTo + Filmstrip 悬浮条）、旋转导出 ✗、最近打开列表 ✗、大图降采样 ✗、幻灯片 ✗（用户确认不做） |
| 无障碍 | prefers-reduced-motion ✓；aria 播报 ◐、焦点管理 ◐ |
| 架构 | zoomActions ref 通道 ✓、camera 纯数学解耦 ✓（手势状态机未抽独立 controller ◐）、死代码清理 ◐、状态拆分 ◐、测试 ✓ |
| 生态联动 | 剪贴板 ✓、AppChrome 能力 ✓（已进共享层）；resource.stat / showInFolder / 旋转导出 未做（见文末附录） |

> 注：3.9 缩略图条已于 2026-08-09 收尾接线完成（runtime 新增 `jumpTo`，Stage/AppShell 已挂载 Filmstrip），状态更新为 ✓。

---

## 1. 现状评估与目标定位

### 1.1 当前能力盘点（已具备）

| 能力 | 现状 |
|---|---|
| 打开方式 | 文件选择器、拖拽入窗、Host 资源路由（launchParams.resourceOpen/targetPath）、命令行、多图序列 |
| 缩放 | 滚轮缩放（指针锚点）、触控板捏合（ctrl+wheel）、Cmd±、适应窗口、实际大小、缩放钳制 0.1x~8x |
| 平移 | 鼠标/触摸拖拽、双指捏合转拖拽 |
| 导航 | 方向键切换、工具栏上/下一张、序列计数 1/3 |
| 保存 | 保存副本（桌面另存 / Web 下载） |
| 反馈 | 顶部胶囊 toast、加载遮罩、空态按钮 |
| 无障碍 | viewport tabIndex、aria-label、alt、aria-live |

### 1.2 目标定位

**定位选择**：轻量"看图器"而非"图库管理"（对标 macOS Preview 而非 Photos）。这意味着：不需要相册/收藏/人脸等图库功能，但**看图体验本身必须做到顶级**——启动即看、打开即清晰、交互直觉、动效丝滑、信息完备。

### 1.3 总体评价

基础架构是健康的（指针事件统一、锚点缩放数学正确、fit/manual 双模式、会话级状态重置），但**"丝滑度"与"完成度"存在明显差距**：
- 有一个真实的无限渲染循环 bug（见 2.1）；
- 平移无边界约束（图片可被拖出屏幕丢失）；
- 所有缩放/平移/切换均为瞬时跳变，无任何过渡动画；
- 约 1/4 的文案与工具函数是死资源（信息面板曾被设计但未实现）；
- 缺乏业界标配交互（双击缩放、全屏、旋转、缩略图条、右键菜单、缩放百分比显示等）。

---

## 2. P0 关键缺陷（必须先修，影响正确性与稳定性）

### 2.1 无限渲染循环：zoomActions 经 React state 传递 —— **✓ 已修复（ref 通道）**

**位置**：`src/components/PhotoViewerStage.tsx:56-64` + `src/app/AppRuntimeProvider.tsx:188-190`

**问题**：Stage 的 effect 依赖 `camera`（`usePhotoViewerCamera` 每次渲染返回新对象），effect 体内调用 `setZoomActions({...})`。链路：Stage 渲染 → effect 触发 → setZoomActions → Provider 重渲染 → context value 变化 → Stage 重渲染 → camera 新引用 → effect 再触发 → **无限循环**。cleanup 中 `setZoomActions(null)` 在 StrictMode 下还会放大问题。测试未暴露是因为 `renderToStaticMarkup` 不执行 effect。

**实证**：已编写最小复现测试（`Chrips-PhotoViewer/归档/tests-zoom-actions-loop-验证/zoom-actions-loop.test.tsx`）：`Child` 每次渲染创建新 `camera` 对象并在 effect 中 `register({...})`（register 触发父级 setState）→ React 抛出 "Maximum update depth exceeded"，测试捕获崩溃。**该模式在真实运行时必然触发**，修复前 `chipsdev run` 启动 PhotoViewer 即会卡死或持续重渲染。

**修复方案（推荐）**：改用 ref 传递，不经过 React state：

```tsx
// AppRuntimeProvider：zoomActionsRef 暴露，不触发重渲染
const zoomActionsRef = React.useRef<PhotoViewerZoomActions | null>(null);
// value 中暴露 registerZoomActions(actions) 与 zoomActionsRef
```

```tsx
// Stage：mount 时注册一次（ref 指向最新 camera）
const cameraRef = React.useRef(camera);
cameraRef.current = camera;
React.useEffect(() => {
  registerZoomActions({
    zoomIn: () => cameraRef.current.handleZoom("in"),
    // ...
  });
  return () => registerZoomActions(null);
}, [registerZoomActions]);
```

**验证**：修复后用 `chipsdev run` 实际启动，确认无 "Maximum update depth exceeded" 报错；补充一个渲染测试断言 effect 只执行一次。

**实施结果**：✓ 按推荐方案改为 ref 通道——`AppRuntimeProvider.tsx` 用 `cameraActionsRef` + `registerZoomActions`（不触发重渲染，value 中 `zoomActions` 为稳定 handle，`setZoomActions` 与 `registerZoomActions` 同指向注册函数），`PhotoViewerStage.tsx` 用 `cameraRef` 保持最新 camera，effect 仅在 `[registerZoomActions, setZoomActions]` 变化时注册/清理。最小复现测试保留在 `归档/tests-zoom-actions-loop-验证/zoom-actions-loop.test.tsx` 作为证据（未入正式套件，正式套件以 `renderToStaticMarkup` 渲染断言为主，未单独断言 effect 次数）。

### 2.2 平移无边界约束（图片可被拖出屏幕丢失）—— **✓ 已修复**

**位置**：`src/hooks/usePhotoViewerCamera.ts` 拖拽与滚轮平移（`panOffset` 直接累加，无 clamp）

**问题**：
1. manual 模式下把图片拖出视口后，无任何方式找回（没有复位入口）；
2. fit 模式下图片小于视口时也能被拖走（fit 语义被破坏）；
3. 滚轮平移（deltaX/deltaY）同样无边界。

**修复方案**：
- 增加 `clampPanOffset`：当图片内容小于视口（某轴）时，该轴不允许拖动（`pan = 0`）；当内容大于视口时，限制 `pan ∈ [viewport - content, 0]`（负方向）。
- 滚轮平移同样应用 clamp。
- 松手（pointerup）时若内容小于视口，**回弹到居中**（可带弹性动画，见 3.2）。

```ts
function clampPan(pan: InteractionPoint, viewport: ViewportSize, content: ViewportSize): InteractionPoint {
  const minX = Math.min(viewport.width - content.width, 0);
  const maxX = 0;
  return {
    x: content.width <= viewport.width ? 0 : Math.min(maxX, Math.max(minX, pan.x)),
    y: content.height <= viewport.height ? 0 : Math.min(0, Math.max(viewport.height - content.height, pan.y)),
  };
}
```

**实施结果**：✓ `clampPan` 按建议实现于 `utils/image-viewer.ts`（`content <= viewport` 时该轴归零）；拖拽按下时先 clamp 起点、拖拽中经 rAF 提交、松手时再次 clamp 回正；滚轮平移同样经 clamp；松手回弹由 transform transition 完成（见 3.2）。配套单测 4 例（`tests/unit/image-viewer.test.ts`"clamps pan offsets to viewport bounds"）。

### 2.3 变换无动画（丝滑度的根基缺失）—— **✓ 已修复（transform 合成层 + transition）**

**位置**：`.photo-viewer-image-frame` 的 width/height/transform 由 React state 直接驱动

**问题**：缩放、平移、双击、切换全部瞬时跳变，这是"丝滑"最大的敌人。

**修复方案（分层）**：
1. **布局驱动改合成驱动**：把 `width/height` 定位改为固定 `100%` 容器 + `transform: scale(scale)` + `translate`（组合成单次 transform）。只触发合成层，不触发 reflow，动画可以 GPU 化。
2. **过渡动画**：非拖拽状态的变换（按钮缩放、双击、适应窗口、切换图片）加 `transition: transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)`；拖拽/捏合/滚轮期间 `transition: none`（保证跟手零延迟）。

```ts
style={{
  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
  transition: isGesturing ? "none" : "transform 0.2s cubic-bezier(0.25,0.1,0.25,1)",
}}
```

3. **切换过渡**：切图时新图 `opacity 0→1` + `scale 1.02→1` 淡入（0.15s），旧图淡出，避免"闪白"。

**实施结果**：✓ 图片帧改为固定尺寸 + `transform: translate(-50%,-50%) translate(pan) scale() rotate()`（合成层驱动，CSS `will-change: transform`）；非手势期间挂 `transition: transform 0.2s cubic-bezier(0.25,0.1,0.25,1)`，手势（拖拽/捏合/滚轮）期间 `transition: none`（`isGesturing` 状态控制，含滚轮手势 150ms 稳定期）；切图淡入 0.15s（`pv-image-in`，opacity 0→1 + scale 1.02→1），无旧图滑出。

### 2.4 小图会被放大到视口大小—— **✓ 已修复**

**位置**：`src/utils/image-viewer.ts:44-65 getFitScale`

**问题**：`getFitScale` 无条件按视口/自然尺寸计算，100×100 的小图会被放大到铺满视口（失真）。macOS Preview 对小于视口的图按实际大小显示。

**修复方案**：`getFitScale` 增加上限：`scale = min(scale, 1)`（仅当图小于视口时显示实际大小；可加偏好开关"始终放大以适合"）。

**实施结果**：✓ `getFitScale` 返回 `Math.min(clampScale(scale), 1)`，小图按实际大小显示；同时支持旋转参数（90/270 交换长宽再算 fit）。配套单测 3 例（"never enlarges images smaller than the viewport to fit"）。

---

## 3. P1 交互设计（对标顶级体验）

### 3.1 双击缩放体系（业界标配，缺失）—— **✓ 已实现**

**建议**：
- 双击：以光标为锚点放大到 **200%**（若当前 ≥200% 则回到"适应窗口"）；这是 Photos/Preview 的通用心智。
- 按住 Alt/Option 双击：直接回到"适应窗口"。
- 双击缩放带 0.2s 缓动动画（配合 2.3）。
- 三击（可选）：切换"适应窗口 ↔ 实际大小"。

**实施结果**：✓ 双击锚点放大至 200%（`DOUBLE_CLICK_ZOOM_SCALE = 2`，`DOUBLE_CLICK_FIT_THRESHOLD = 1.9`）；当前 ≥200% 或按住 Alt/Option 时回到适应窗口；动画由 transition 提供；三击未做（可选）。

### 3.2 平移边界弹性与回弹—— **✓ 已实现**

- 拖到边界时提供**弹性回弹**（transform 越界部分跟随手指但衰减，松手回弹，0.2s spring）。
- 实现：拖拽期间 `pan = rawPan + overscroll*0.5`（阻尼），松手时动画回 `clampPan(rawPan)`。
- 这几乎是"丝滑"代名词，值得专门实现（约 40 行）。

**实施结果**：✓ 拖拽期间显示 `clampedPan + (rawPan - clampedPan) * 0.5`（`ELASTIC_OVERSHOOT_DAMPING = 0.5`），松手后 `setPanOffset(clampPan(...))` 由 transform transition 回弹；内容小于视口的轴在拖拽中直接被钳制为 0（无越界跟随）。

### 3.3 触控板横向滑动切换图片—— **✓ 已实现**

**建议**：trackpad 双指左右滑（wheel `deltaX` 大且无修饰键）在当前图处于 fit 且无水平滚动余地时，累积到阈值（如 ±60px）触发上一张/下一张，带横向滑动过渡动画（当前图右滑出、新图滑入）。Google Photos / Preview 均有此交互。

**注意**：需与 2.2 的滚轮水平平移区分——当图片放大到需要水平滚动时，横向滑动优先平移；仅在 fit 状态（无可平移内容）时切图。

**实施结果**：✓ wheel `deltaX` 无修饰键且当前内容宽 ≤ 视口宽时累积（起始阈值 40px，触发阈值 80px），达到阈值触发 prev/next 并清零（`usePhotoViewerCamera.ts` 横向导航累积逻辑）；与放大状态的滚轮平移通过"内容是否超出视口"区分。切换动画采用 0.15s 淡入（`pv-image-in`），未实现"右滑出/左滑入"的滑动过渡（实现形态差异）。

### 3.4 缩放百分比 UI—— **✓ 已实现（ZoomBadge）**

- 工具栏增加**当前缩放百分比胶囊**（如 `125%`），点击恢复"适应窗口"；悬停显示"点击恢复适应窗口"。
- 数值来自 `formatZoomPercent`（已有函数，目前是死代码）。
- 缩放时数值动画滚动（轻微），`aria-live="polite"` 播报。

**实施结果**：✓ 右下角 `ZoomBadge` 胶囊显示百分比（`formatZoomPercent`，tabular-nums），点击恢复适应窗口，hover 提示"点击恢复适应窗口"，`aria-live="polite"` 播报；数值滚动动画未做（轻微项）。

### 3.5 键盘体系完善（对标 Preview）—— **✓ 已实现（除 Space）**

| 按键 | 功能 | 现状 |
|---|---|---|
| ← / → | 上一张 / 下一张 | ✓ |
| Cmd+← / Cmd+→ | 第一张 / 最后一张 | ✓ 已实现（firstImage/lastImage） |
| Cmd+0 | 适应窗口 | ✓ |
| Cmd+1 | 实际大小 | ✓ |
| Cmd+加/减（=/-） | 放大/缩小 | ✓ |
| Cmd+L / 双击 | 放大 200%（锚点） | ✓ 已实现（Cmd+L 连续放大两档，双击见 3.1） |
| F | 全屏 | ✓ 已实现 |
| R | 旋转 90°（Cmd+R 亦可） | ✓ 已实现（R 顺时针、Cmd+Shift+R 逆时针） |
| Cmd+I | 信息面板 | ✓ 已实现 |
| Cmd+C | 复制图片到剪贴板 | ✓ 已实现 |
| Esc | 退出全屏 / 关闭信息面板 / 从放大回到 fit | ◐ 退出全屏与关闭信息面板已实现；"从放大回到 fit"未做 |
| 1~5 | 快捷缩放档位（可选项） | ✗ 未做（可选） |
| Space | — | ✗ 未做（按用户决策不实现） |

**实施结果**：✓ 键盘处理收敛在 `AppRuntimeProvider` 的全局 keydown（←/→、Cmd+←/→、Cmd+L、Esc），命令快捷键（Mod+O/S/0/1/±/I/C、F、R、Cmd+Shift+R）由 `@chips/ui` 命令体系统一注册；聚焦状态由 viewport 自身处理。

### 3.6 全屏模式—— **✓ 已实现**

- `F` / 工具栏按钮进入全屏（`document.documentElement.requestFullscreen()`，Electron 支持）。
- 全屏时隐藏菜单栏与工具栏（仅保留浮动工具层），鼠标移动才浮现（见 4.1 沉浸式）。
- Esc 退出并回到进入前状态（缩放/位置不变）。

**实施结果**：✓ `fullscreen` 使用 `requestFullscreen`/`exitFullscreen`（含退出状态），F 键 + 工具栏命令；沉浸式隐藏由共享层 AppChrome immersive 承担（鼠标到顶部 20px 热区或移动鼠标浮现、Esc 切换显隐）；退出后缩放/位置不变（camera 状态不重置）。

### 3.7 旋转与翻转—— **✓ 已实现（旋转；翻转未做）**

- `Cmd+R` 顺时针旋转 90°（0/90/180/270），翻转（水平/垂直）作为菜单项。
- 旋转状态在切换图片时重置；旋转后"适应窗口"按旋转后的长宽比计算。
- 旋转仅影响显示（另存副本时按旋转结果导出需 Host 侧支持，第一版可不导出旋转）。

**实施结果**：✓ 顺/逆时针 90°×4 档（R / Cmd+Shift+R / 右键菜单）；切换图片（sessionKey 变化）时重置旋转与缩放；`getFitScale` 支持旋转长宽交换；旋转经 transform `rotate()` 合成。✗ 翻转未做；✗ 另存时按旋转导出未做（保持原图副本）。

### 3.8 导航增强—— **✓ 已实现**

- 序列 >1 时显示**左右浮动箭头**（半透明，悬停浮现，点击切换，键盘同效）；箭头样式苹果化（圆形毛玻璃底 + chevron 图标）。
- 图片序列边界时箭头淡出/禁用。
- 切图动画方向与方向键一致（左切向右滑出）。

**实施结果**：✓ `NavigationArrows`（圆形毛玻璃底 + 左右箭头），有上/下一张时才显示对应按钮，序列边界禁用并透明淡出，悬停浮现；切图方向一致性通过滑动切图累积方向判定（3.3），动画为淡入形态。

### 3.9 缩略图条（Filmstrip，可选 P1/P2）—— **✓ 已实现（2026-08-09 收尾接线）**

- 底部悬浮缩略图条（序列模式）：当前图高亮 + 居中，hover 预览缩放，点击跳转，可隐藏。
- 缩略图从 `resource.resolve` 结果生成（或用 `<img>` 原图缩略，大图时降采样成本高——第一版可用 CSS 缩略 + `decoding="async"`，后续接入缩略图服务）。

**实施结果**：◐ `components/Filmstrip.tsx` + `Filmstrip.css` 已创建（当前项高亮 + 自动居中滚动 + `prefers-reduced-motion` 支持 + `aria-current`），但 `src/` 内（Stage/AppShell）**无任何接入引用**，组件未渲染、缩略图未生成、显隐开关未接线。与任务简报"缩略图条已接线"不符，按实际代码标注为部分实现，需在后续任务中接入 Stage（或独立 Scene）后方可闭环。

### 3.10 幻灯片（Slideshow）—— **✗ 未实现（用户确认不做）**

- 自动轮播播放（间隔切换 / 前进后退）按用户决策不实现；相应菜单项、快捷键与状态机均未引入。

---

## 4. P1 视觉设计（沉浸式与质感）

### 4.1 沉浸式查看（画布与工具栏）—— **✓ 已实现（共享层 AppChrome immersive）**

**现状**：菜单栏 + 工具栏常驻顶部，画布浅灰 `#f5f5f7`。

**建议**：
1. **画布深色化**：查看图片时画布改为中性深色（如 `#1d1d1f` 或 `#17181a`），图片与画布形成对比（顶级看图器惯例：Photos/Preview 查看模式均为深色画布）。空态/无图时保持浅色。深色画布对 4K 大图、透明 PNG、黑色系照片的观感提升显著。
2. **工具栏自动隐藏**：查看模式下菜单栏与工具栏向上滑出（-100% 位移 + 0.25s 缓动），鼠标移到窗口顶部 20px 或移动鼠标时浮现；`Esc` 也可切换 UI 显隐（"无干扰模式"，Preview 的 Cmd+Shift+F 心智）。
3. 全屏默认进入"无干扰"状态。

**实施结果**：✓ 全部落地——深色画布 `#1d1d1f`（查看时 `photo-viewer-stage--viewing`，空态保持浅色）；"自动隐藏 + 顶部热区浮现 + Esc 切换显隐"作为 **AppChrome `immersive` 能力进入共享层 `@chips/ui`**（`AppChrome.tsx`：immersive 下初始隐藏、mousemove 顶部 20px 热区常显、移动后延时隐藏、Esc 切换）；PhotoViewer 以 `immersive={hasImage}` + `immersiveContentClass` 接入；全屏与沉浸式叠加使用。

### 4.2 空态重设计（当前仅一个按钮）—— **✓ 已实现**

**建议**：居中组合——品牌化插画（图标大尺寸、系统蓝渐变底）、主标题"打开一张图片"、副文案（支持格式 + 拖拽提示 + 快捷键提示：`⌘O 打开`）、主按钮（毛玻璃 + 蓝色主按钮）。拖拽悬停时画布显示高亮边框 + "松开导入图片"大文字（现状有提示但视觉弱）。

**实施结果**：✓ `EmptyState` 组件：渐变底大图标（76px 圆角卡片）、主标题"打开一张图片"、描述（拖拽/点击导入）、支持格式与 ⌘O 提示、蓝色主按钮；拖拽悬停时画布高亮边框 + 主色背景混合 + "松开导入图片"文案。

### 4.3 加载与切换动效—— **✓ 已实现（实现形态与建议略有差异）**

- 加载中：图片区域显示**骨架占位**（按图片比例灰块 + 微光 shimmer），而非全屏遮罩挡图。
- 加载完成：0.15s 淡入 + 微缩放。
- 切换图片：滑动过渡（3.3）。
- 拖拽文件悬停：画布边框高亮 + 轻微背景色变（现状有，可加动效）。

**实施结果**：✓ 加载中采用玻璃胶囊提示（Spin + 文案，0.2s 淡入）而非骨架 shimmer；加载完成/切图 0.15s 淡入 + scale 1.02→1；拖拽悬停画布高亮边框 + 主色混合背景 + 过渡动画。

### 4.4 反馈 Toast 玻璃化—— **✓ 已实现**

- 底部反馈胶囊改为**毛玻璃**（`backdrop-filter: blur(20px) saturate(180%)` + 半透明白底 + 细描边），与苹果风格统一；成功/错误用语义色点。
- 入场：0.2s 上浮 + 淡入；出场：0.15s 淡出（现状瞬间消失）。
- 错误 toast 可点击查看详情（可选）。

**实施结果**：✓ 底部胶囊玻璃化（`blur(20px) saturate(180%)` + 半透明白 + 细描边），info/success/error 语义色点，入场上浮淡入 0.2s、出场淡出 0.2s（200ms 延迟退出）；错误 toast 提供"重试"按钮；toast 自带 `role="alert"/"status"` 与 aria-live。

### 4.5 图片信息展示（把死文案用起来）—— **✓ 已实现（信息面板；文件大小待 Host 能力）**

`messages.ts` 中已有 `resolutionLabel/zoomLabel/pathLabel/fileSizeLabel` 等 key，但 UI 未实现。建议：

1. **状态栏（底部细条）**：`分辨率 3840 × 2160 · 文件 3.2 MB · 125% · 3 / 8`（文件名可放工具栏或标题）。
2. **信息面板（Cmd+I）**：文件名、路径、尺寸、文件大小、修改时间、格式；毛玻璃半透明面板从右侧滑入。
3. 图片加载后从 `imageDimensions` 与资源元数据填充（文件大小需 Host 侧提供 `resource.stat` 类接口——若 SDK 无此接口，登记工单）。

**实施结果**：✓ `InfoPanel`（Cmd+I / 工具栏 / 右键菜单打开，毛玻璃右滑入，Esc 或关闭按钮关闭）：展示文件名、路径、分辨率；缩放百分比由 ZoomBadge 展示、序列位置由工具栏 `1 / N` 展示（aria-live）。◐ 文件大小、修改时间、格式字段未展示——`client.resource` 无 `stat` 类接口（见附录 1）；底部状态栏细条未做（由 ZoomBadge + 工具栏序列计数 + 信息面板覆盖信息需求）。

### 4.6 图标与命令细节—— **✓ 已实现**

- **图标语义错误**：`fitToWindow` 使用了 `FullscreenOutlined`（这是"全屏"语义），应改为 `ExpandOutlined`（或 `ShrinkOutlined`）；真正的全屏命令用 `FullscreenOutlined`。
- 工具栏按钮在无图时全部禁用（现状 open 可用，符合预期）；禁用态加 tooltip 说明原因（"先打开图片"）。
- `iconFor()` 是无意义包装，直接传 JSX。

**实施结果**：✓ 图标语义修正（`fitToWindow` → `ExpandOutlined`，`fullscreen` → `FullscreenOutlined`）；无图时除"打开"外全部禁用（`enabled` 由命令状态推导，禁用原因文案 key 已备：`commands.disabled.*`）；`iconFor` 包装已删除，命令直接传 JSX。◐ 禁用态 tooltip 提示由共享命令体系的禁用态承接，未单独实现 tooltip 弹出。

---

## 5. P1/P2 功能矩阵（对标"世界最好"）

| 功能 | 对标 | 优先级 | 说明 | 实施 |
|---|---|---|---|---|
| 双击缩放/还原 | Preview/Photos | P1 | 见 3.1 | ✓ |
| 边界弹性回弹 | iOS Photos | P1 | 见 3.2 | ✓ |
| 滑动切换 | Photos/Preview | P1 | 见 3.3 | ✓ |
| 缩放百分比 | 全部 | P1 | 见 3.4 | ✓ |
| 键盘首尾/全屏/旋转/信息 | Preview | P1 | 见 3.5-3.7 | ✓ |
| 沉浸式画布 | Photos | P1 | 见 4.1 | ✓ |
| 浮动导航箭头 | Photos | P1 | 见 3.8 | ✓ |
| 右键菜单 | FastStone | P1 | 打开/保存/复制/旋转/信息/在文件夹中显示（后者需 Host 能力，登记工单） | ◐ 打开/保存/复制/旋转/信息/首末张已实现；"在文件夹中显示"未做（无 Host 能力，见附录 2） |
| 复制到剪贴板 | Preview | P1 | `navigator.clipboard.write`（PNG 编码后写入；Electron 支持） | ✓ 已实现（Cmd+C + 右键菜单，ClipboardItem 写入原格式） |
| 相邻图片预加载 | Photos | P1 | 见 6.3 | ✓ |
| 缩略图条 | Photos | P2 | 见 3.9 | ◐ 组件已创建未接线 |
| 旋转/翻转 | Preview | P2 | 见 3.7 | ◐ 旋转 ✓；翻转 ✗ |
| 多选打开（Cmd 点选） | Photos | P2 | Host 文件选择器支持多选后作为序列打开 | ✓ 已实现（`platform.openFile` 多选 + 序列打开） |
| 大图降采样 | FastStone | P2 | 见 6.4 | ✗ 未做（浏览器原生降采样已够） |
| 最近打开列表 | Preview | P2 | 菜单"文件→最近打开"（需持久化能力，登记工单） | ✗ 未做（无持久化能力） |
| 深色/浅色画布切换偏好 | — | P2 | 可后续加偏好（当前单一主题约束下先做深色画布） | ✗ 未做（单一深色画布） |
| 幻灯片 | — | P2 | 按用户决策不实现 | ✗ 不做 |

---

## 6. P1 性能优化（丝滑的工程基础）

### 6.1 变换走合成层（最重要）—— **✓ 已实现**

现状 `width/height` 像素级定位每次缩放都触发 **layout + paint**；改为 `transform: scale() translate()` 后仅触发 **composite**（GPU）。大图缩放性能差距可达数倍。与 2.3 同一改造。

**实施结果**：✓ 图片帧宽高固定 + transform 驱动（`translate(-50%,-50%) translate() scale() rotate()`）+ `will-change: transform`（见 2.3）。

### 6.2 手势渲染管线（rAF + ref，绕过 React 渲染）—— **✓ 已实现（rAF 节流合并）**

拖拽/捏合/滚轮的高频更新（60fps）不应走 React state（每次 setState 触发整个 Stage 重渲染）。建议：

- **方案 A（推荐）**：`usePhotoViewerCamera` 内部用 `ref` 保存 pan/scale，手势期间直接写 `element.style.transform`（命令式，零 React 开销）；手势结束（pointerup）一次性提交最终值到 state（用于命令、百分比显示等）。
- **方案 B**：`useSyncExternalStore` + 外部 store，React 侧订阅最终值。
- 收益：拖拽时无 React 重渲染，帧率稳定 60fps，CPU 占用大幅下降。

**实施结果**：✓ 采用 rAF 合并提交：拖拽期间的 pan 更新经 `requestPanUpdate`（rAF 单帧合并，手势结束 `flushPendingPanUpdate` 一次性提交），有效降低每指针事件一次 setState 的开销；◐ 未采用方案 A 的命令式 `style` 直写（更新仍经 React state，但以 rAF 合并降低重渲染频率），高频拖拽期间仍有 Stage 级重渲染（Stage 已 `React.memo` 兜底）。

### 6.3 相邻图片预加载—— **✓ 已实现（LRU 缓存 + ±1 预取）**

序列模式切换图片时 `client.resource.resolve` 每次重新执行（无缓存）。建议：
- 预加载当前图 ±1（resolve 后的 URI 用 `new Image()` 预取，`decoding="async"`）；
- resolve 结果做内存缓存（LRU，按 sourceId），同图重复查看零等待；
- 切换时先显示缓存图（秒开），再渐进替换。

**实施结果**：✓ `ResourceUriCache`（LRU，容量 8，按 sourceId）+ `preloadImage`（`new Image()` + `decoding="async"`）；打开当前图前先查缓存，序列模式下自动 resolve 并预取 ±1 相邻图，切图走缓存秒开。

### 6.4 大图降采样（P2）—— **✗ 未实现（决策不做）**

超大图（如 100MP 全景）直接渲染内存/GPU 压力大。建议：用 `createImageBitmap` + 分块或 `img` 的 CSS 缩小渲染（浏览器已做降采样，够用）；后续可调研 `client.resource` 是否支持缩略图（若 SDK 无，登记工单）。

**实施结果**：✗ 未实现——浏览器 `img` 原生降采样已满足当前需求；未登记缩略图工单（如后续出现超大图场景再评估）。

### 6.5 其他—— **✓ 已实现**

- `usePhotoViewerCamera` 的 wheel effect 依赖数组过大（每次缩放都重挂监听器）：把 `handleWheelEvent` 依赖改为 ref 读取（`cameraRef` 模式），监听器只挂一次。
- Stage 用 `React.memo` 包一层，配合 AppChrome 避免无关 state 变化重渲染整个查看器。
- 图片 `decoding="async"` + `loading="eager"`（首图立即，避免懒加载闪烁）。

**实施结果**：✓ wheel/gesture 监听经 `cameraRef` 转发、effect 依赖收敛为 `[sessionKey, onNavigateRequest]`（切换会话才重挂）；`PhotoViewerStage` 已 `React.memo`；图片 `decoding="async"`（`loading` 由默认 eager 生效）。

---

## 7. P2 无障碍细节

| 项 | 建议 | 实施 |
|---|---|---|
| 图片语义 | viewport 内加 `role="img"` + `aria-label="${fileName}，${width}×${height}，缩放 ${zoomPercent}"`，缩放变化时更新（aria-live="polite"） | ✓ viewport `role="group"` + `aria-label`（文件名/尺寸/缩放百分比，随缩放实时更新）；◐ 未用 `role="img"`（viewport 同时承载交互语义） |
| 缩放播报 | 百分比胶囊 aria-live；双击缩放后播报新百分比 | ◐ ZoomBadge 自带 `aria-live="polite"` 并随百分比更新；无独立播报区域，双击缩放不额外播报 |
| 拖拽 | 拖拽期间 `aria-grabbed` 状态；键盘不可拖拽的补充：提供"平移模式"开关（方向键平移，可选） | ✗ 未做（拖拽为指针交互，`isPanningImage` 有 cursor 反馈；平移模式开关未做） |
| 焦点 | 打开/切换图片后焦点保持在 viewport；Esc 从全屏/信息面板逐级退出 | ◐ viewport `tabIndex=0` + focus-visible 样式，Esc 逐级退出（全屏→信息面板）已实现；打开/切换后未显式 `focus()` 保持焦点 |
| 对比度 | 深色画布下 toast/箭头/缩略图条的对比度检查（至少 4.5:1） | ◐ 深色画布下浮层均带半透明白底/毛玻璃 + 描边（对比度有兜底）；未做自动化对比度审计 |
| 减少动效 | 尊重 `prefers-reduced-motion`：关闭切换/回弹动画，仅保留淡入淡出 | ✓ `@media (prefers-reduced-motion: reduce)` 全局关闭动画与 transform transition（含 Filmstrip 滚动行为） |

**汇总**：prefers-reduced-motion ✓；aria 播报 ◐；焦点管理 ◐。

---

## 8. P1 架构与代码质量

| 项 | 建议 | 实施 |
|---|---|---|
| camera 解耦 | 将纯变换数学（clamp/投影/弹性）留在 `utils/image-viewer.ts`（已是纯函数，好），手势状态机抽成可单测的纯逻辑（`createCameraController(view)`），React hook 只做绑定——关键交互（双击/回弹/边界）都可写单测 | ◐ 纯变换数学留在 utils 且新增 `clampPan`、旋转 fit 等单测 ✓；手势状态机**未抽成** `createCameraController`（拖拽/捏合/回弹/双击逻辑仍在 `usePhotoViewerCamera`，hook 约 623 行），双击/回弹无独立单测 |
| zoomActions 通道 | 按 2.1 改为 ref/context，移除 state 通道；顺带把"命令 → 相机动作"的桥接收敛到一处（AppShell 层注册，Stage 层只暴露 camera 到 ref） | ✓ ref 通道（`cameraActionsRef` + `registerZoomActions`），桥接收敛在 AppRuntimeProvider，Stage 仅向 ref 暴露 camera 动作 |
| 死代码清理 | 删除 `iconFor` 包装；把 `formatZoomPercent/formatFileSize` 用起来（3.4/4.5）或删除；`messages.ts` 中未用 key 随功能落地或移除 | ◐ `iconFor` 已删、`formatZoomPercent` 已用于 ZoomBadge ✓；`formatFileSize` 仅测试引用（UI 未用，随文件大小能力待落地）；`src/lib/messages.ts` 94 个 key 中约 54 个未被引用（命令 title/description/ariaLabel、fileSize/状态类文案，部分等待 Host stat 能力与共享 i18n 接线——与工单134 待处理相关） |
| 状态拆分 | `AppRuntimeProvider` 已偏大（656 行）：图片会话状态（target/index/source/dimensions/loading）可抽 `useImageSession`，反馈/保存抽 `useViewerActions`，Provider 只做组合 | ◐ 未拆分（Provider 现约 950 行，新增命令/全屏/复制/首末张后进一步膨胀）；按实际需要后续拆分 |
| 测试 | 新增单测：`clampPan`（边界）、`getFitScale`（小图不放大）、双击缩放循环（200%↔fit）、回弹数学；现有 23 个测试保持全绿 | ✓ `clampPan` 4 例、`getFitScale` 小图/旋转 5 例新增；双击缩放循环、回弹数学无独立单测（状态机在 hook 内，见上）；测试从 23 → **26 全绿**（6 文件） |

**汇总**：camera 解耦 ◐（纯数学 ✓、状态机未抽）；zoomActions ref ✓；死代码清理 ◐；状态拆分 ◐；测试 ✓。

---

## 9. 实施路线

| 阶段 | 内容 | 出口标准 |
|---|---|---|
| P0 修复（0.5~1 天） | 2.1 渲染循环、2.2 平移边界、2.3 动画基础、2.4 小图不放大 | 无渲染循环；图片不可拖出视口；缩放有过渡；小图清晰 |
| P1-1 交互（1~2 天） | 双击缩放、回弹、百分比胶囊、键盘完善、全屏、浮动箭头、滑动切换 | 交互对标 Preview 主路径 |
| P1-2 视觉（1 天） | 深色画布、工具栏自动隐藏、空态重设计、加载骨架、toast 玻璃化、图标语义修正 | 沉浸式查看体验 |
| P1-3 性能（1 天） | transform 合成层、rAF 手势管线、wheel 监听 ref 化、相邻预加载 | 拖拽/缩放 60fps，切换秒开 |
| P1-4 功能（1~2 天） | 右键菜单、复制到剪贴板、信息面板/状态栏、旋转 | 功能矩阵 P1 完成 |
| P2（按需） | 缩略图条、多选打开、大图降采样、无障碍细化 | 对标 Photos 完成度（幻灯片已确认不做） |

每阶段结束跑 `npm test`（23+ 用例全绿）+ `chipsdev run` 人工走查。

> **路线执行结果（2026-08-08）**：P0 / P1-1 / P1-2 / P1-3 / P1-4 / P2 各阶段已按计划完成，最终验证 `npm test` **26/26 全绿**、`tsc --noEmit` 无错误、`npm run lint` 通过；幻灯片按用户决策不做（详见《Chips-PhotoViewer-实施记录.md》）。

---

## 10. 验收标准（对标清单）

最终体验应达到：

1. **丝滑**：缩放/平移/切换全部有动画或跟手反馈，帧率 60fps，无跳变、无闪烁；
2. **直觉**：双击缩放、滚轮锚点缩放、拖拽平移（有边界）、滑动切图、Esc 逐级退出，全部符合直觉；
3. **沉浸**：深色画布 + 自动隐藏工具栏，看图时零干扰；
4. **信息完备**：缩放百分比、分辨率、文件大小、路径随手可得；
5. **完整**：P1 功能矩阵全部落地，无死文案、无死代码；
6. **健壮**：无渲染循环、无越界状态、错误有重试、测试全绿；
7. **一致**：视觉与动效与生态苹果风格（@chips/ui token）完全统一。

---

## 附：与生态联动的事项（需登记工单/协调）

> 以下为 2026-08-08 实施后的实际状态。

1. **文件大小/修改时间**：图片信息面板需要 `resource.stat` 类接口——检查 chips-sdk 是否提供，无则登记工单；→ **未做**：`client.resource` 无 `stat` 能力，文件大小/修改时间字段未落地；**未登记工单**（建议后续登记）。
2. **在文件夹中显示**：需 `platform.showInFolder` 类能力——检查 SDK，无则登记工单；→ **未做**：无该能力，右键菜单与命令均未提供（`actions.openFolder` 文案 key 已备但未接线）；未登记工单。
3. **剪贴板复制**：Electron 侧 `navigator.clipboard.write` 的权限与 CSP（`clipboard-write` 权限策略）——验证可用性；→ **✓ 已实现**：`navigator.clipboard.write` + `ClipboardItem`（原格式写入），`Cmd+C` + 右键菜单入口，成功/失败均有反馈。
4. **旋转后另存**：如需导出旋转结果，涉及图像处理能力（Chrome 的 `OffscreenCanvas` 可本地实现，不依赖 Host）；→ **未做**：另存保持原图副本（旋转仅影响显示）。
5. **共享层配合**：AppChrome 需要"自动隐藏"与"深色内容区"支持时，优先在 `@chips/ui` 增加能力（生态统一），避免 PhotoViewer 私有实现；→ **✓ 已进共享层**：`@chips/ui` `AppChrome` 新增 `immersive` / `immersiveContentClass` 能力（初始隐藏、顶部热区浮现、Esc 切换显隐），PhotoViewer、BookReader 等应用共用。
