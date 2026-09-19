# 会话记录：gentle-nebula

- 会话 ID：ses_01dc66c28ffeuFDt68fK4f0zAC
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:34:12

---

## 2026-08-09 00:34:12

为 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-VideoPlayer 新建独立 UI 组件（task031 润物计划）。不做 Git 提交。这些组件是**纯 props 组件**，不 import Stage/Controller 内部，后续由集成任务接入。

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-VideoPlayer-细节设计与优化建议.md（第 3.1/3.4/3.6/3.9、4.2 节）
- 现有视觉：src/global.css（变量体系 --video-player-*、毛玻璃风格、苹果风格）

## 你的文件域（只改这些）
- src/components/ 下**新建**组件文件（不修改 VideoPlayerStage.tsx）
- 每个新组件自带独立 css 文件（如 Osd.css），在组件内 import；**不修改 global.css**
- 新建 tests/unit/ 下对应测试

## 要新建的组件（props 化，不依赖任何内部状态）

### 1. `Osd.tsx`（OSD 反馈系统，最优先）
- props: `{ osd: OsdData | null; onDismiss?: () => void }`，OsdData = `{ key: string; icon?: ReactNode; title: string; subtitle?: string; progress?: number }`
- 渲染：居中大号毛玻璃胶囊卡片（icon + 标题 + 副标题 + 可选横向进度条，如音量条），`pointer-events: none`，aria-live="polite"
- 动画：fade+scale 入场；外部通过 key 变化触发重显（组件内部不管理定时，由集成方控制）
- 类名约定：`.video-player-osd` / `.video-player-osd__card` / `.video-player-osd__icon` / `.video-player-osd__title` / `.video-player-osd__subtitle` / `.video-player-osd__progress`
- 样式写在自己的 Osd.css（毛玻璃 + 深浅色用 CSS 变量 --osd-bg/--osd-fg，默认值先给浅色）

### 2. `Timeline.tsx`（自研时间轴，替代 antd Slider 的时间轴场景）
- props: `{ duration: number; currentTime: number; bufferedUntil: number; disabled?: boolean; onPreview?: (t: number) => void; onCommit?: (t: number) => void; ariaLabel?: string }`
- 行为：缓冲层 + 进度层双层渲染；**pointer 拖拽中只触发 onPreview（本地移动），松开才 onCommit**；支持 hover 时间提示（显示 MM:SS / 总时长）；键盘可操作（role="slider" + 方向键 ±5s 提交）
- 高频 currentTime 更新只影响本组件（父组件配合 memo）
- 类名约定：`.video-player-timeline` / `__buffer` / `__progress` / `__thumb` / `__tooltip`
- 样式写在 Timeline.css；时间格式化复用 src/utils/video-player.ts 的 formatDuration

### 3. `EndedOverlay.tsx`（播放结束重播态）
- props: `{ title?: string; onReplay: () => void; onClose?: () => void }`
- 居中覆盖层：重播图标（RotateRightOutlined）+ "重新播放"主按钮 + 关闭提示；点击空白可关闭
- 类名：`.video-player-ended` / `__card` / `__title` / `__actions`
- 样式写在自己 css

### 4. `KeyHelpDialog.tsx`（快捷键帮助弹窗）
- props: `{ open: boolean; onClose: () => void; groups: Array<{ title: string; items: Array<{ keys: string; label: string }> }> }`
- 毛玻璃对话框（可基于 antd Modal 或自绘），列出快捷键：播放/暂停 Space 或 K、快退/快进 ←→、音量 ↑↓、静音 M、全屏 F、画中画 P、倍速面板 B、帮助 ?、Home/End、0-9 跳转
- 类名：`.video-player-key-help`
- 样式写在自己 css

### 5. `TrackMenu.tsx`（dock 浮层：倍速/字幕/音轨三合一菜单）
- props: `{ title: string; options: Array<{ key: string; label: string; hint?: string; selected: boolean }>; onSelect: (key: string) => void; onClose: () => void }`
- 渲染：弹出浮层（毛玻璃卡片 + 列表项，选中高亮主题色、带 ✓），点击项 onSelect 后自动 onClose；Esc/外部点击关闭
- 类名：`.video-player-track-menu` / `__item` / `--selected`
- 样式写在自己 css

### 6. `EmptyState.tsx`（空态升级，可选）
- 若时间允许：props `{ onOpen: () => void; dragActive?: boolean; hintText?: string }`，居中构图：毛玻璃圆底大图标 + 主按钮 + 格式/快捷键提示
- 类名沿用 `.video-player-empty`（新增 `__icon-wrap` 等）

## 测试（tests/unit/ 下）
- Timeline.test.tsx：拖拽只触发 onPreview、松开触发 onCommit、键盘方向键提交（jsdom + fireEvent/pointer events 模拟）
- Osd.test.tsx：渲染内容与 aria-live
- TrackMenu.test.tsx：选中高亮与 onSelect 回调
- 需要时 tests/setup 补 ResizeObserver 等（参照仓库现有测试基建；若仓库无 setup 文件则新建 tests/setup.ts 并检查 vitest 配置是否引用——若改 vitest.config 需说明，这是允许的）

## 红线
- 不修改 VideoPlayerStage.tsx、useVideoPlayerController.ts、global.css、commands、app/
- 禁止 any；禁止 TODO；禁止删除文件；禁止 import @chips/component-library
- antd 可用（6.5.4）；图标用 @ant-design/icons

## 验证（在仓库目录执行）
1. npx tsc --noEmit → 你的新文件 0 错误（他人文件域报错忽略，注明）
2. npm test → 你新增的测试全绿（全量中他人文件域失败需说明）
3. 汇报每个组件的 props 接口与类名清单（供集成任务与视觉任务对接）

## 汇报（最终消息必须包含）
- 新建文件清单与 props 接口
- 测试输出摘要
- 遗留疑问（若有）
