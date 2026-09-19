# Chips-PhotoViewer 实施记录（task031 润物计划）

> 任务：task031-润物计划-生态细节优化
> 实施日期：2026-08-08
> 依据文档：《Chips-PhotoViewer-细节设计与优化建议.md》（P0/P1/P2 分级）
> 验证日期：2026-08-09（核对基准，与建议文档标注一致）

## 0. 总体结论

| 级别 | 结论 |
|---|---|
| P0 关键缺陷 | **4/4 全部修复** |
| P1 交互 | **8/8 全部落地**（键盘含"除 Space"项，Space 按用户决策不做） |
| P1 视觉 | **6/6 全部落地**（4.5 文件大小字段待 Host 能力；4.3 实现形态与建议略有差异） |
| P1 性能 | **3/3 落地** + 6.4 大图降采样不做（浏览器原生已够） |
| P2 | 部分落地：多选打开 ✓、缩略图条 ◐（组件已建未接线）、幻灯片 ✗（用户决策不做） |
| 无障碍/架构 | 见第 4、5 节 |
| 验证 | `npm test` 26/26 全绿（6 文件）、`tsc --noEmit` 无错误、`npm run lint` 通过 |

---

## 1. P0 修复（渲染循环 / 平移边界 / 动画 / 小图不放大）

### 1.1 渲染循环修复（建议 2.1）—— ✓

- **根因**：Stage effect 依赖每次渲染新建的 `camera`，effect 内 `setZoomActions` 触发 Provider 重渲染形成闭环。
- **方案**：改 ref 通道，不经过 React state。
  - `src/app/AppRuntimeProvider.tsx`：`cameraActionsRef` 保存当前动作集，`registerZoomActions` 只写 ref；`zoomActions` 为稳定代理 handle（useMemo 空依赖）；`setZoomActions` 与 `registerZoomActions` 同指向注册函数。
  - `src/components/PhotoViewerStage.tsx`：`cameraRef` 保持最新 camera，effect 依赖收敛为 `[registerZoomActions, setZoomActions]`，mount 注册 / unmount 注销。
- **证据**：最小复现测试保留在 `归档/tests-zoom-actions-loop-验证/zoom-actions-loop.test.tsx`（复现 "Maximum update depth exceeded"，作为修复前后对照证据，未入正式套件）。
- **说明**：正式套件以 `renderToStaticMarkup` 渲染断言为主（不执行 effect），未单独新增"effect 只执行一次"回归断言；建议后续补充真实 DOM 渲染的循环回归测试（见遗留事项）。

### 1.2 平移边界约束（建议 2.2）—— ✓

- `src/utils/image-viewer.ts`：新增纯函数 `clampPan(pan, viewport, content)`——内容 ≤ 视口的轴归零，否则限制在 `[viewport - content, 0]`。
- `src/hooks/usePhotoViewerCamera.ts`：拖拽按下时先 clamp 起点、拖拽中经 rAF 提交原始偏移、松手时 `setPanOffset(clampPan(...))` 回正；滚轮平移同样 clamp。
- 配套单测 4 例（"clamps pan offsets to viewport bounds"）。

### 1.3 变换动画与合成层（建议 2.3 / 6.1）—— ✓

- 图片帧改为固定宽高 + 单次 `transform: translate(-50%,-50%) translate(pan) scale(scale) rotate(deg)`，CSS `will-change: transform`（只触发合成层）。
- 非手势期挂 `transition: transform 0.2s cubic-bezier(0.25,0.1,0.25,1)`；手势期 `transition: none`（`isGesturing` 由指针拖拽/捏合/滚轮 150ms 稳定期驱动）。
- 切图淡入 `pv-image-in`（0.15s，opacity 0→1 + scale 1.02→1）。

### 1.4 小图不放大（建议 2.4）—— ✓

- `getFitScale` 返回 `Math.min(clampScale(scale), 1)`，小图按实际大小显示；同时新增 `rotation` 参数（90/270 交换长宽）。
- 配套单测 3 例（"never enlarges images smaller than the viewport to fit"）+ 旋转 fit 4 例。

---

## 2. P1 交互落地

| 建议项 | 结果 | 实现要点（文件位置） |
|---|---|---|
| 3.1 双击缩放 | ✓ | 锚点放大 200%（阈值 1.9），Alt/Option 或 ≥200% 回 fit；`usePhotoViewerCamera.handleDoubleClick` |
| 3.2 边界回弹 | ✓ | 拖拽期间越界阻尼 0.5 跟随，松手 clamp 后由 transform transition 回弹 |
| 3.3 滑动切图 | ✓ | wheel deltaX 累积（40px 起积累 / 80px 触发），fit 且无水平滚动余地时切图，带方向判定；切换动画为淡入形态 |
| 3.4 缩放百分比 | ✓ | `ZoomBadge` 胶囊（formatZoomPercent、tabular-nums、点击回 fit、aria-live） |
| 3.5 键盘体系 | ✓（除 Space） | ←/→、Cmd+←/→（首末张）、Cmd+0/1/±、Cmd+L（200%）、F、R / Cmd+Shift+R、Cmd+I、Cmd+C、Esc（全屏/信息面板逐级退出）；Space、1~5 档位不做 |
| 3.6 全屏 | ✓ | `requestFullscreen`/`exitFullscreen` + F/工具栏命令；沉浸式隐藏由 AppChrome immersive 承接 |
| 3.7 旋转 | ✓ | 顺/逆时针 90°×4 档；切图重置；fit 按旋转后长宽比；翻转与旋转导出不做 |
| 3.8 浮动箭头 | ✓ | `NavigationArrows`（毛玻璃圆钮、边界禁用淡出、悬停浮现） |
| 3.9 缩略图条 | ◐ | `Filmstrip.tsx` + `Filmstrip.css` 已创建（高亮/居中滚动/reduced-motion/aria-current），**未接入 Stage/AppShell**（src 中无引用），见遗留事项 |
| 3.10 幻灯片 | ✗ | 用户确认不做 |

---

## 3. P1 视觉、性能与功能

### 3.1 视觉（第 4 章）

| 建议项 | 结果 | 实现要点 |
|---|---|---|
| 4.1 沉浸式画布 | ✓ | 深色画布 `#1d1d1f`（查看时）；工具栏自动隐藏/顶部热区浮现/Esc 切换显隐作为 **`@chips/ui` AppChrome `immersive` 能力**进入共享层，PhotoViewer 以 `immersive={hasImage}` 接入 |
| 4.2 空态重设计 | ✓ | `EmptyState`：渐变图标、标题/描述/格式提示/⌘O 提示、主按钮；拖拽高亮边框 + 背景混合 |
| 4.3 加载/切换动效 | ✓ | 玻璃胶囊加载提示（非骨架 shimmer）+ 0.15s 淡入缩放 + 拖拽悬停动效 |
| 4.4 toast 玻璃化 | ✓ | 毛玻璃（blur 20px + saturate 180%）、语义色点、0.2s 上浮入/淡出、错误重试按钮、role/aria-live |
| 4.5 信息面板 | ✓ | `InfoPanel`：文件名/路径/分辨率，毛玻璃右滑入，Cmd+I/Esc 开关；文件大小/修改时间待 Host stat 能力；状态栏细条未做（由 ZoomBadge + 工具栏序列计数覆盖） |
| 4.6 图标语义 | ✓ | fit→`ExpandOutlined`、全屏→`FullscreenOutlined`；`iconFor` 包装删除 |

### 3.2 性能（第 6 章）

| 建议项 | 结果 | 实现要点 |
|---|---|---|
| 6.1 合成层 | ✓ | 同 1.3 |
| 6.2 手势管线 | ✓ | rAF 合并提交（`requestPanUpdate`/`flushPendingPanUpdate`）；未做命令式 style 直写，高频期仍有 Stage 重渲染（React.memo 兜底） |
| 6.3 相邻预加载 | ✓ | `ResourceUriCache`（LRU 容量 8）+ `new Image()` 预取 ±1 相邻图；切图走缓存秒开 |
| 6.4 大图降采样 | ✗ | 浏览器原生降采样已够，不做 |
| 6.5 其他 | ✓ | wheel 监听 ref 化（依赖 `[sessionKey, onNavigateRequest]`）；`React.memo(Stage)`；`decoding="async"` |

### 3.3 功能矩阵（第 5 章）主要项

- 右键菜单 ✓：`ViewerContextMenu`（打开/保存/复制/上下一张/首末张/缩放/旋转/信息，毛玻璃弹出，Esc/失焦关闭）。
- 复制到剪贴板 ✓：`navigator.clipboard.write` + `ClipboardItem`（原格式），Cmd+C + 右键入口，成败均有反馈。
- 多选打开 ✓：`platform.openFile` `allowMultiple` 多选 → 序列打开。
- 最近打开列表 ✗（无持久化能力）、深色/浅色偏好 ✗（单一深色画布）、旋转导出 ✗、翻转 ✗。

---

## 4. 无障碍（第 7 章）

| 项 | 结果 |
|---|---|
| prefers-reduced-motion | ✓ 全局 media query 关闭动画与 transform transition |
| aria 播报 | ◐ ZoomBadge aria-live + viewport aria-label 实时更新 + toast role/aria-live；无独立缩放播报区域 |
| 焦点管理 | ◐ viewport tabIndex + focus-visible + Esc 逐级退出；未显式 focus 保持 |
| 其他（aria-grabbed、平移模式、对比度审计） | ✗ / ◐ 未做 |

---

## 5. 架构与代码质量（第 8 章）

| 项 | 结果 | 说明 |
|---|---|---|
| camera 解耦 | ◐ | 纯变换数学在 `utils/image-viewer.ts`（clampPan 等，有单测）；手势状态机未抽 `createCameraController`（仍在 hook 内，约 623 行） |
| zoomActions ref 通道 | ✓ | 桥接收敛在 AppRuntimeProvider，Stage 只向 ref 暴露动作 |
| 死代码清理 | ◐ | `iconFor` 删、`formatZoomPercent` 已用；`formatFileSize` 未接入 UI；`src/lib/messages.ts` 94 key 中约 54 个未被引用（命令描述/aria 文案、fileSize/status 类，部分待 stat 能力与共享 i18n 接线——关联工单134 待处理） |
| 状态拆分 | ◐ | AppRuntimeProvider 约 950 行，未抽 `useImageSession`/`useViewerActions` |
| 测试 | ✓ | 23 → **26 用例全绿**（image-viewer 10、launch-resource 8、commands 3、stage 3、app 1、e2e 1） |

---

## 6. 验证结果（2026-08-09 复核）

| 项 | 结果 |
|---|---|
| `npm test` | 6 个文件 26/26 通过（2s） |
| `npx tsc --noEmit` | 0 错误 |
| `npm run lint` | 通过 |
| 人工走查 | `chipsdev run` 按 P0→P1 主路径走查（用户 2026-08-08 确认） |

---

## 7. 文件清单

### 新增（本任务实施新增）

- `src/components/EmptyState.tsx` / `EmptyState.css`
- `src/components/Filmstrip.tsx` / `Filmstrip.css`（未接线，见遗留事项）
- `src/components/InfoPanel.tsx` / `InfoPanel.css`
- `src/components/NavigationArrows.tsx` / `NavigationArrows.css`
- `src/components/ViewerContextMenu.tsx` / `ViewerContextMenu.css`
- `src/components/ZoomBadge.tsx` / `ZoomBadge.css`
- `src/commands/photo-viewer-commands.tsx`
- `src/lib/messages.ts`（文案字典，替换旧 i18n 接线；关联工单134 公共文档漂移待收口）

### 修改（核心）

- `src/app/AppRuntimeProvider.tsx`：ref 通道、键盘全局处理、全屏/旋转/信息/复制/首末张、LRU 资源缓存与 ±1 预加载、多选打开、Web 保存分支
- `src/app/AppShell.tsx`：命令组装、immersive 接入、右键菜单项、信息面板字段
- `src/components/PhotoViewerStage.tsx`：cameraRef 注册、合成层样式、ZoomBadge/箭头/上下文菜单/空态接入、淡入动画、memo
- `src/hooks/usePhotoViewerCamera.ts`：clampPan、回弹阻尼、双击、旋转、滑动切图、rAF 合并、wheel ref 化
- `src/utils/image-viewer.ts`：`clampPan`、`Rotation`、`getFitScale` 小图上限与旋转
- `src/global.css`：深色画布、毛玻璃浮层、动效、prefers-reduced-motion
- `tests/unit/image-viewer.test.ts`、`tests/unit/commands.test.ts`、`tests/unit/stage.test.tsx`（同步更新）

### 归档

- `归档/tests-zoom-actions-loop-验证/zoom-actions-loop.test.tsx`（渲染循环复现证据）
- `归档/src-i18n/`、`归档/src-app-providers/`、`归档/src-environment-client/`、`归档/src-theme-runtime/`、`归档/i18n/`（旧 i18n/Provider 体系，已移出 src）

---

## 8. 遗留事项

1. **缩略图条接线**：`Filmstrip` 组件与样式已就绪但未接入 Stage/AppShell（src 无引用），需后续任务完成序列模式缩略图渲染与显隐开关。
2. **文件大小/修改时间**：信息面板字段缺失，`client.resource` 无 `stat` 类接口；建议按建议文档附录 1 登记工单后再落地。
3. **在文件夹中显示**：右键菜单/命令缺失，无 `platform.showInFolder` 能力；建议登记工单。
4. **渲染循环回归测试**：正式套件无"effect 只执行一次"断言（复现测试在归档）；建议在真实 DOM 渲染测试补充。
5. **相机状态机抽取**：`createCameraController` 未抽，双击/回弹无独立单测；Provider 未拆分（950 行）。
6. **文案残留**：`messages.ts` 约 54 个 key 未被引用；其中命令 title/description/aria 类文案与共享 i18n 接线（工单134）收口后统一清理。
7. **可选未做**：Space、1~5 缩放档位、翻转、旋转导出、大图降采样、最近打开、深/浅画布偏好、滑动式切图动画、骨架 shimmer、aria-grabbed/平移模式。
