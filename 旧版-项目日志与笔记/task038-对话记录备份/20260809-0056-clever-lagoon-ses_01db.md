# 会话记录：clever-lagoon

- 会话 ID：ses_01db1a5c1ffeCl26LvgnU7R68R
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:56:53

---

## 2026-08-09 00:56:53

扩展 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-PhotoViewer 的应用运行时（task031 润物计划）。不做 Git 提交。

## 你的文件域（只改这一个文件）
- `src/app/AppRuntimeProvider.tsx`

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-PhotoViewer-细节设计与优化建议.md（2.1、3.5、3.7、5、6.3、8 章）
- 当前 AppRuntimeProvider.tsx（656 行）与 commands/usePhotoViewerCommands.ts（了解命令如何调用 runtime）

## 任务内容

### 1. 修复 zoomActions 无限渲染循环（P0，最高优先）
- 现状：`zoomActions` 经 React state 传递 + Stage 每次渲染传新对象 → 无限循环（已实证，见建议文档 2.1 与归档复现测试）。
- 改为 **ref 通道**：`zoomActionsRef = useRef<PhotoViewerZoomActions | null>(null)`；暴露 `registerZoomActions(actions)`（写 ref，不触发渲染）。
- 保持兼容：`PhotoViewerRuntimeValue` 中移除 `zoomActions`/`setZoomActions` state 字段，替换为 `registerZoomActions(actions: PhotoViewerZoomActions | null): void`；同时暴露只读的 `zoomActions`（来自 ref，供命令读取：`zoomIn: () => runtime.zoomActions?.zoomIn()`——用 useRef 读取无需订阅）。
- 注意：commands 子代理用 `runtime.zoomActions?.zoomOut()` 调用，保持该字段存在（值 = ref.current，每次渲染读取即可）。

### 2. 新增 runtime 动作（供新命令与 UI 调用）
```ts
fullscreen(): void;                  // document.documentElement.requestFullscreen() / exitFullscreen 切换；失败静默
rotateClockwise(): void;             // 委托给相机（通过 zoomActionsRef 扩展的相机动作通道或 context）
rotateCounterclockwise(): void;
showInfo(): void;                    // 打开信息面板（state: infoOpen）
hideInfo(): void;
copyImage(): Promise<void>;          // navigator.clipboard.write：图片转 PNG blob 后写入；成功/失败 feedback
firstImage(): void;                  // 跳到第一张
lastImage(): void;                   // 跳到最后一张
```
- 旋转动作：相机（usePhotoViewerCamera 的 rotateClockwise）在 Stage 内部，runtime 无法直接调用。方案：把 `PhotoViewerZoomActions` 扩展为 `PhotoViewerCameraActions`（增加 rotateClockwise/rotateCounterclockwise），Stage 注册时一并提供；runtime 的 rotateClockwise 委托 `cameraActionsRef.current?.rotateClockwise()`。
- `PhotoViewerZoomActions` 类型改名为 `PhotoViewerCameraActions` 并新增两个 rotate 方法（保留别名 `PhotoViewerZoomActions` 导出避免破坏 commands 引用）。
- copyImage：用 `fetch(resourceUri) → blob → new File([blob], name, {type})` 写入 `navigator.clipboard.write([new ClipboardItem({[file.type]: file})])`；不支持时反馈"复制图片失败"。

### 3. 键盘体系完善（在现有 ArrowLeft/Right effect 中扩展）
- Cmd+← → firstImage、Cmd+→ → lastImage、Cmd+0/1/± 已有（命令层）、Cmd+L → 放大 200%（委托 cameraActions.zoomIn 两连？——直接调用 cameraActions 的 zoomIn 两次或新增 zoomTo(2)），简化：Cmd+L 委托 zoomIn 锚点缩放即可（可两次触发）。
- F → fullscreen、R → rotateClockwise、Cmd+Shift+R → rotateCounterclockwise、Cmd+I → showInfo、Cmd+C → copyImage、Esc → 按层级：全屏退出 → 信息面板关闭 → （其余交给 Stage 的相机还原，不动）。
- 注意：不要与命令系统的 useCommandShortcuts 重复触发——若命令层已处理快捷键（共享层 CommandProvider 的 shortcut），键盘 effect 需跳过已有 shortcut 的键（用事件 defaultPrevented 判断，或键盘 effect 只处理命令层未覆盖的：Cmd+←/→、Esc 层级、Cmd+L）。
- 现有 ArrowLeft/Right 保留（命令层也有 ArrowLeft/Right shortcut——检查共享层 useCommandShortcuts 会拦截；保留现有 effect 作为兜底，event.defaultPrevented 时跳过）。

### 4. 相邻图片预加载
- 序列模式（imageTarget.images.length > 1）：当前 index 变化时，对 index±1 的图片执行 `client.resource.resolve(sourceId)` 并预取（`new Image().src = uri`，`decoding="async"`）。
- resolve 结果做内存 LRU 缓存（Map，上限 8 条，按 sourceId）：主加载流程（现有 resolve effect）先查缓存，命中则直接使用（setImageSource 立即），未命中再 resolve 并写缓存。
- 注意现有 resolve effect 的结构（cancelled 标志）——在它之上改造，保持取消语义。

### 5. 多选打开（P2）
- `openFile` 的 `allowMultiple` 改为 true；选中多个文件时构建 `LaunchImageTarget { images: [...], initialIndex: 0 }` 打开序列。
- 保持单选行为兼容（1 个文件也走同一路径）。

### 6. 状态拆分（可选但建议）
- 若重构风险可控：把图片会话状态（imageTarget/index/source/dimensions/loading）相关逻辑抽到独立 hook 或保持现状但为 5 个新方法补 useCallback。以"不破坏现有 23 测试"为底线，优先保证功能正确，拆分不强求。

### 7. 新文案反馈
- copyImage 成功 → feedback({tone:"success", message: t("photo-viewer.status.copied")})；失败 → error + t("photo-viewer.status.copyFailed")。

## 红线
- 只改 AppRuntimeProvider.tsx；禁止 any；禁止 TODO/占位；禁止删除文件
- 保持既有公开字段兼容（commands 子代理用 `runtime.zoomActions?.zoomIn()` 与 `runtime.openFile` 等，不能删）

## 验证（必须实际执行）
1. npx tsc --noEmit → 0 错误
2. npm test → 全绿（既有 26 用例；若因 Stage 尚未接线导致 app 相关测试失败，确认是"未接线"原因并汇报，不要改测试文件）

## 汇报（最终消息必须包含）
- 实际改动清单
- 验证输出摘要
- 接口变化说明（新增字段/方法、重命名）
- 遗留疑问（若有）
