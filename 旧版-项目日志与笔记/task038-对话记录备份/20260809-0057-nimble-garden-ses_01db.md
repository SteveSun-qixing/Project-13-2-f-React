# 会话记录：nimble-garden

- 会话 ID：ses_01db14316ffeYRtZsHoikkdO7S
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:57:18

---

## 2026-08-09 00:57:18

集成 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-PhotoViewer 的新能力到 Stage/AppShell/样式（task031 润物计划）。不做 Git 提交。

## 你的文件域（只改这些文件）
- `src/components/PhotoViewerStage.tsx`
- `src/app/AppShell.tsx`
- `src/global.css`
- （不碰：AppRuntimeProvider/usePhotoViewerCamera/commands/messages/utils——由并行子代理负责）

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-PhotoViewer-细节设计与优化建议.md（3.4/3.8/4.1/4.2/4.3/4.4/4.6/6 章）
- 并行子代理已完成的能力（按接口约定使用，缺方法时用可选调用 `?.()` 并注明）：
  - camera（usePhotoViewerCamera）新增：`handleDoubleClick`、`rotation`、`rotateClockwise`、`rotateCounterclockwise`、`isGesturing`、`imageTransform`（含 translate+scale+rotate）、`transitionEnabled`、options `onNavigateRequest`
  - runtime（AppRuntimeProvider）新增：`registerZoomActions`（ref 通道，替代 setZoomActions）、`fullscreen()`、`rotateClockwise()`、`rotateCounterclockwise()`、`showInfo()`、`hideInfo()`、`copyImage()`、`firstImage()`、`lastImage()`；`PhotoViewerZoomActions` 扩展 rotate 方法
  - AppChrome（@chips/ui）新增可选 props：`immersive`、`immersiveContentClass`
  - 新组件（src/components/ 下新建）：InfoPanel、Filmstrip、NavigationArrows、ViewerContextMenu、EmptyState、ZoomBadge（props 见各组件文件）
  - messages.ts 新增 key：zoomPercent/clickToResetZoom/info.*/empty.*/loading/loadFailedRetry/copied/copyFailed 等

## 任务内容

### 1. Stage 使用新相机接口（丝滑核心）
- image-frame 样式改用 `camera.imageTransform`（transform 字符串）+ `transition: camera.transitionEnabled ? "transform 0.2s cubic-bezier(0.25,0.1,0.25,1)" : "none"`；**frame 尺寸不再用 imageWidth/imageHeight 设置**（避免与 scale 双重缩放），用自然尺寸（imageDimensions 的宽高，旋转 90/270 时交换），由 transform 负责缩放。
- 挂 `onDoubleClick={camera.handleDoubleClick}`。
- `onNavigateRequest` 接线到 runtime.previousImage/nextImage（注意 deltaX 方向：正 deltaX → next）。
- 图片加 `decoding="async"`。

### 2. 深色画布 + 沉浸式
- 有图（imageSource 存在）时 Stage 根加 class `photo-viewer-stage--viewing`：画布背景改为深色（`#1d1d1f` 或 `#17181a`），空态/无图保持浅色 `#f5f5f7`。
- AppShell 的 AppChrome 传 `immersive={Boolean(runtime.imageSource)}` + `immersiveContentClass="photo-viewer-stage--viewing"`（共享层 AppChrome 已支持；若该 prop 未就绪，可先不传并注明）。
- 深色画布下浮动元素（feedback/箭头/胶囊）用毛玻璃浅色保持可读。

### 3. 缩放百分比胶囊 + 状态栏信息
- AppShell 的 toolbarExtra 扩展：序列计数（现有）+ 缩放百分比胶囊（ZoomBadge，percent 来自 runtime 暴露的当前缩放——camera 的 effectiveScale 目前不经过 runtime；方案：Stage 把缩放值通过 `onZoomChange(scale)` 上报（新 prop，用 ref 通道注册到 runtime：`registerZoomChange`），或在 Stage 内渲染 ZoomBadge 于画布内。**推荐后者**：Stage 内右下角画布内放 ZoomBadge（不占工具栏），点击 → camera.setFitMode()）。
- 缩放值变化时更新；无图时不显示。

### 4. 空态重设计 + 加载骨架 + 错误重试
- 空态：用 EmptyState 组件替换现有 button（onOpen=runtime.openFile、dragActive、extensionsLabel=SUPPORTED_IMAGE_EXTENSION_LABEL、shortcutText="按 ⌘O 打开"）。
- 加载：保留 overlay（Spin+文案），可加淡入动画。
- 加载失败：feedback 已有；增加"重试"——在 Stage 的错误反馈上提供重试按钮（点击重新 resolve，通过新 prop `onRetry`：runtime 暴露 retryLoad()（重新触发 resolve effect 的机制——若 runtime 未提供，用重新设置 imageTarget 的方式或注明跳过）。

### 5. 浮动导航箭头 + 缩略图条
- 序列 >1 时画布内显示 NavigationArrows（hasPrevious=index>0、hasNext=index<len-1）。
- Filmstrip 底部悬浮（P2 可选做；若 runtime 未暴露 images 列表的 sourceId 集合，可从 imageTarget.images 构造并传 thumbSrc=resolve 后 uri——若无法获取 uri 则 thumbSrc 传 undefined 显示占位）。

### 6. 右键菜单
- ViewerContextMenu 包裹整个查看区域；actions 由 AppShell 传入（打开/保存/复制/旋转/信息/适应窗口/实际大小——通过 runtime 方法组合）。

### 7. 信息面板 + toast 玻璃化 + 动画
- Stage/AppShell 接线 InfoPanel：open=runtime.infoOpen（若 runtime 用 showInfo/hideInfo state，通过 useAppRuntime 读取——若 runtime 未暴露 infoOpen state 则注明跳过或 Stage 本地 state 处理）。
- feedback 胶囊样式玻璃化（global.css 更新：毛玻璃 + 入场/出场动画 0.2s）。
- 图片切换过渡：切图时新图 opacity 0→1 + scale 1.02→1（0.15s）——用 key 变化 + CSS animation（@keyframes pv-image-in）。

### 8. AppShell 菜单补充
- 菜单增加"编辑"组（commands 子代理已加 menuId:"edit" 的命令）与"查看"组新命令（已自动包含）。

## 红线
- 只改上述三个文件；禁止 any；禁止 TODO/占位；禁止删除文件
- 若依赖的并行子代理能力尚未就绪，用可选调用规避类型错误并在汇报中列出待接线项

## 验证（必须实际执行）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿（若有失败，修复你的文件域内的实现问题；若失败源于未接线的 runtime 方法，汇报说明）
3. npm run build → 成功

## 汇报（最终消息必须包含）
- 实际改动清单
- 接线完成项/待接线项列表
- 验证输出摘要
- 遗留疑问（若有）
