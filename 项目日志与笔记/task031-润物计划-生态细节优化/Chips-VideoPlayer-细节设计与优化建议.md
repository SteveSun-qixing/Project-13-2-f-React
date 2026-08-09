# task031 润物计划 · Chips-VideoPlayer 细节设计与优化建议

> 任务编号：task031-润物计划-生态细节优化
> 创建日期：2026-08-08
> 范围：Chips-VideoPlayer 全部前端（对标 Apple TV app / QuickTime / IINA / YouTube / VLC 的世界级体验）
> 目标：世界最好用、最美观、最丝滑、交互最好的视频播放器
> 状态：建议稿（待评审后实施）

---

## 1. 现状评估

### 1.1 已具备的良好基础（保留并强化）

| 能力 | 现状 | 评价 |
|---|---|---|
| 全屏 / 画中画 | 支持，含状态同步 | 好 |
| 字幕 / 音轨切换 | 支持（原生 textTracks/audioTracks） | 好，但入口太深 |
| 倍速 | 支持 0.75/1/1.25/1.5/2 | 好，但入口太深 |
| 文件拖拽打开 | 支持，含拖拽高亮覆盖层 | 好 |
| 键盘快捷键 | 空格/K/方向键/F/M | 好，但与命令系统重复（有 bug 风险） |
| 控制栏自动隐藏 | 播放中 2.2s 自动隐藏 | 好，但缺"手动切换" |
| 错误分级 | MediaError 四级映射中文 | 好 |
| 远程/本地徽标 | More 面板可查 | 一般，播放中不可见 |
| 毛玻璃 dock / 侧栏 | backdrop-filter 白色玻璃 | 视觉一致，但全屏下不协调 |

### 1.2 对标基准（世界级播放器的共同特征）

1. **OSD 反馈系统**：任何快捷键操作（音量/倍速/seek/静音）都有居中大号视觉反馈，1 秒内淡出（IINA、PotPlayer、YouTube）；
2. **点击语义**：单击 = 播放/暂停；双击 = 全屏；单击视频中部 = 切换控制栏显隐（QuickTime、YouTube）；
3. **seek 交互**：拖拽进度条时"拖动中只预览、松开才 seek"，并显示大号时间气泡；
4. **缓冲动画**：加载/缓冲时有 spinner 或进度动画，而非纯文字；
5. **播放结束态**：显示"重播"按钮覆盖层（YouTube、QuickTime）；
6. **控制栏深浅色自适应**：窗口内浅色、全屏深色半透明（YouTube、IINA 全屏模式）；
7. **快捷键帮助**：按 `?` 弹出快捷键列表（YouTube、IINA）；
8. **状态记忆**：记住音量、倍速（IINA、系统播放器）；
9. **字幕可调**：字号、背景、位置（IINA、VLC）；
10. **拖动中预览帧**：进度条悬停显示缩略图（YouTube 远程流；本地可做帧预览）。

当前 VideoPlayer 与对标差距最大的三个点：**无 OSD、seek 拖动即提交、无 ended 重播态**。

---

## 2. P0 关键缺陷（必须先修，影响正确性/性能）

### 2.1 双击触发两次单击（播放状态错乱）

- **现状**：`<video onClick={togglePlayback} onDoubleClick={toggleFullscreen}>`。浏览器中双击会先触发两次 `click`，即双击全屏前会"播放→暂停"两次，状态错乱；
- **目标**：双击只全屏、不触发单击语义；
- **方案**：`lastPointerTimeRef` 记录最近一次单击时间，`onClick` 中若距上次 <300ms 则忽略（或在 `onDoubleClick` 中标记 `suppressClickRef`）；也可将点击处理改为 `onPointerUp` + 位移/时长判断（拖拽不触发）。

### 2.2 快捷键双重注册（可能双倍触发）

- **现状**：`CommandItem.shortcut`（Space/ArrowLeft/ArrowRight/M 等，由 AppChrome 的 `useCommandShortcuts` 全局分发）与 Stage 内 `controller.handleKeyDown` 的 switch 同时响应同一按键——空格/方向键会被两处处理，`togglePlayback` 并发执行两次、`seekBy` 可能执行两次（后退 10 秒而非 5 秒）；
- **目标**：一个快捷键只有一个执行者；
- **方案**：二选一——(a) 播放类快捷键全部收归命令系统（CommandItem 表达），Stage 的 `handleKeyDown` 只处理命令系统不覆盖的键（如 ↑↓ 音量、Shift+→ 快速 seek）；或 (b) Stage 快捷键优先，命令定义移除重复的 shortcut 字段。推荐 (a)，并加单测断言：按一次 Space 只调一次 togglePlayback。

### 2.3 进度条拖动即提交 seek（高频 seek 卡顿）

- **现状**：`Slider onChange` 直接 `controller.seekTo()`，每次像素移动都写 `video.currentTime`；拖动 3 秒进度条可能触发 100+ 次 seek，弱设备上卡顿、部分文件格式 seek 慢会阻塞 UI；
- **目标**：拖动中只更新本地 UI 预览，`onChangeComplete` 才执行一次 seek（YouTube/IINA 标准行为）；
- **方案**：Stage 引入 `isScrubbingRef` + 本地 `dragTime` state：`onChange` 更新预览值并 `video.pause()`（可选项：拖动中暂停播放更丝滑），`onChangeComplete` 统一 `seekTo` 并恢复播放；拖动中 tooltip 显示大号 `MM:SS / MM:SS` 时间。

### 2.4 高频 state 更新导致整树重渲染

- **现状**：`handleTimeUpdate`（每秒 4~60 次）每次触发 `setCurrentTime + setDuration + setBufferedUntil` 三个 setState，633 行的 `VideoPlayerStage` 连同全部按钮/Slider 一起重渲染；
- **目标**：进度更新只影响进度条组件，按钮不重渲染；
- **方案**：
  - 拆分组件：`Timeline` 独立组件（memo），通过 props 接收低频 `duration`、高频 `currentTime`（仍会重渲染 Timeline 自身，但范围小）；
  - 或用 **rAF 节流 + ref**：`handleTimeUpdate` 只写 `progressRef`，由 rAF 循环（每帧一次，~16ms）合并更新 state，把 60 次/秒降到 60 帧渲染；播放器对进度精度要求不高，可降到 4~10 次/秒更新 state + CSS 动画补间；
  - `VideoPlayerStage` 所有 props 用 useCallback 稳定（controller 对象建议 useMemo 稳定引用，否则每次渲染新对象导致下游全量失效）。

### 2.5 播放结束无重播能力

- **现状**：`handleEnded` 仅置 `isPlaying=false`，画面停在最后一帧，控制栏显示"播放"图标，用户需重新点播放（从 0 开始）或手动拖回；
- **目标**：结束态显示居中"重播"按钮覆盖层（可点击重新从头播放），并自动显示控制栏；
- **方案**：Stage 增加 `isEnded` 状态（由 controller 暴露），渲染 `video-player-ended` 覆盖层（重播图标 + 文案 + 按钮），点击调用 `seekTo(0) + play()`。

---

## 3. P1 核心体验升级（拉开与普通播放器的差距）

### 3.1 OSD 反馈系统（最大差距项）

- **现状**：键盘调节音量（↑↓）、倍速、静音、seek 均无任何视觉反馈；
- **目标**：所有非点击型操作弹出居中 OSD，约 1.2s 自动淡出（IINA 标准）；
- **方案**：Stage 内建轻量 OSD：
  - `osd: { icon?, title?, subtitle?, key } | null` state；
  - 操作触发时 `setOsd(...)` + 重置 1.2s 定时器；
  - 渲染居中大号毛玻璃卡片：音量显示 `🔊 85%`（附横向音量条）；静音 `🔇 静音`；倍速 `1.5x`（2 秒显示）；seek `-5s 00:12:34`；
  - 动画：fade+scale 淡入、自动淡出；不与 feedback/错误卡片冲突；
  - 注意：OSD 卡片要 `pointer-events: none`。

### 3.2 控制栏深浅色自适应（全屏视觉统一）

- **现状**：dock 恒为白色毛玻璃 + 深色图标；全屏黑场视频上白色 dock 突兀，破坏沉浸感；
- **目标**：全屏时控制栏切换为深色半透明玻璃（`rgba(20,20,24,0.55)` + 白图标 + 白滑块），退出全屏恢复浅色；侧面板同步切换（面板内部用 antd theme token 派生，背景/文字随模式变化）；
- **方案**：Stage 根据 `controller.isFullscreen` 给根节点加 `video-player-stage--fullscreen` 类，CSS 变量两套：
  ```css
  .video-player-stage--fullscreen { --dock-bg: rgba(18,18,20,0.6); --dock-fg: #fff; ... }
  ```
  dock/侧栏/音量 popover 全部改引用语义变量；antd 组件（Slider/Button）通过 ConfigProvider 的 `theme.darkAlgorithm` 包裹全屏态，或用 CSS 变量覆写。**推荐**：全屏态用 antd `ConfigProvider theme={darkTheme}` 包裹 dock 子树（干净、少 CSS 覆写）。

### 3.3 单击切换控制栏显隐（QuickTime 语义）

- **现状**：只有播放中自动隐藏，无法手动切换；
- **目标**：单击视频中部 = 播放/暂停（现状已实现）；**单击画面（视频区域、非控制栏）在"已播放"状态下切换控制栏显隐**——但两者冲突。行业标准拆分：**单击 = 播放/暂停 + 同时亮起控制栏**；**中键或特定区域（如视频上 80% 区域）单击切换显隐**；
- **简化方案（推荐）**：单击保持播放/暂停；**双击保留全屏**；新增"鼠标移到屏幕底部 10% 或移动鼠标 = 亮起控制栏"（现状 pointermove 已亮起）；**控制栏可见时单击视频 = 隐藏控制栏**（在 dock 可见状态下，单击视频仅切显隐、不切播放；dock 隐藏时单击 = 播放/暂停）。这是 QuickTime 实际行为，最不易误触。

### 3.4 缓冲/加载动画

- **现状**：加载、缓冲都是纯文字"正在加载…"；
- **目标**：加载 = 居中小菊花（antd Spin 或自定义双环）+ 文案；缓冲 = 小菊花（不遮全屏，视频画面保留）；
- **方案**：`overlayMessage` 分支中区分 `isResolving`（打开资源中：大 spinner + 文案）与 `isBuffering`（播放中缓冲：仅小 spinner，位置居中偏下，不盖住画面主体）。

### 3.5 空态设计升级

- **现状**：一个相机图标 + "将视频拖到这里，或点击选择文件"；
- **目标**：有层次、有温度的空态（Apple TV app 风格）：
  - 居中构图：大图标（毛玻璃圆底）、主标题、副文案、一个主按钮（"选择视频…"）+ 弱化提示（支持的格式列表 + 快捷键提示 `⌘O`）；
  - 拖拽悬停时：覆盖层虚线框 + 图标放大 + "松开以打开"文案（现状已有，微调动效）；
- **方案**：重绘 `video-player-empty` 区块（CSS 为主），加"最近打开"列表为可选加分项（见 P2）。

### 3.6 倍速/字幕/音轨的 dock 直达入口

- **现状**：倍速、字幕、音轨都要开 More 面板（两次点击）；
- **目标**：dock 常驻三个快捷入口（QuickTime/YouTube 标准）：
  - **倍速按钮**：显示当前值 `1x`，点击弹出浮层（0.5/0.75/1/1.25/1.5/2，含"自定义"），选中高亮；
  - **字幕按钮（CC）**：点击弹出浮层（关闭 + 轨道列表，带语言标签），当前有字幕时按钮高亮；
  - **音轨按钮**：同上（无多音轨时隐藏）；
- **方案**：复用 More 面板的轨道列表渲染逻辑为独立浮层组件（`TrackMenu`），More 面板与 dock 浮层共享同一数据源；More 面板保留（信息/更多设置）。

### 3.7 音量交互完善

- **现状**：音量按钮 hover 弹纵向滑块（CSS hover 实现）；无点击行为；无滚轮；
- **目标**：
  - 点击音量按钮 = 静音/恢复（现状 M 键行为迁移到按钮）；
  - hover 滑块保留（加 150ms 延迟避免闪烁）；
  - **鼠标滚轮在视频区域 = 音量**（向上 +5%、向下 -5%，配 OSD）；
  - 音量调节时 OSD 显示音量条；
  - 静音时图标/按钮状态明确（已有）；
  - **记住音量**（见 P2 记忆偏好）；
- **方案**：Stage 根 onWheel（防抖）→ `controller.setVolumeLevel`；popover 从纯 CSS hover 改为受控（open state + 进出延迟），支持键盘（Tab 聚焦音量按钮后方向键调节）。

### 3.8 键盘体验补全

- **现状**：Space/K 播放暂停、←→ seek5s、↑↓ 音量、F 全屏、M 静音；无 ? 帮助、无 J/L 慢速快进、无 Home/End；
- **目标**（对齐 YouTube/IINA 主流映射）：
  - `?` = 快捷键帮助弹窗（列出全部快捷键，毛玻璃卡片，Esc 关闭）；
  - `J/L` = 慢速回放 10s / 快进 10s（带 OSD）；
  - `Shift+←/→` = seek 30s（可选）；
  - `Home/End` = 到开头/末尾（可选）；
  - `0~9` = 跳转 10%~90%（可选）；
  - `[` `]` = 上一帧/下一帧（IINA 特色，可选 P2）；
  - 所有 seek 都带 OSD 时间反馈；
  - **空格在按钮聚焦时**不触发播放（防误触：event.target 为 button 时跳过，现状 handleKeyDown 已对 input 跳过但未对 button 处理）。

### 3.9 拖动预览与缓冲可视化

- **现状**：进度条无缓冲进度显示；`bufferedUntil` 已计算但未使用；
- **目标**：进度条用 antd Slider rail 自定义或双层进度：底层灰色 = 已缓冲（bufferedUntil/duration），上层主题色 = 播放位置；拖动中 tooltip 大号显示 `当前位置 / 总时长`；
- **方案**：Slider `railStyle`/`trackStyle` 或自定义 rail 分段渲染（antd Slider 支持 `railStyle` 单一色，多段缓冲需要自定义组件——**推荐自定义轻量 Timeline 组件**（div + 三个色层 + 拖拽手势），顺便解决 P0-2.3/2.4 的高频更新问题；时间轴组件约 150 行）。

### 3.10 顶部信息条（播放中可见的标题/格式）

- **现状**：播放中无任何地方显示文件名/格式/清晰度；需开 More 面板；
- **目标**：控制栏亮起时，dock 上方或视频顶部淡入一条信息（`文件名 · MP4 · 1920×1080 · 本地`），随控制栏一起隐藏；
- **方案**：`video-player-titlebar`（左上角，毛玻璃胶囊），低优先级（P1 末位）。

---

## 4. P2 精细化与进阶（世界级锦上添花）

### 4.1 状态记忆（偏好持久化）

- 记住：音量、静音、倍速、字幕语言偏好、字幕开关；
- 存储：`localStorage`（无 Host 时）或 Host 偏好服务（`client.preferences`，若 SDK 提供）；demo 阶段 localStorage 即可，key 前缀 `chips.video-player.`；
- 打开新视频时应用记忆值（播放提示的 muted/autoplay 仍优先）。

### 4.2 循环模式 UI

- `playbackHints.loop` 只读生效；加 dock 循环按钮（或倍速浮层内）：关 / 循环本视频；循环时按钮高亮。

### 4.3 右键菜单

- 视频右键弹出自定义菜单（QuickTime/IINA）：播放/暂停、倍速子菜单、字幕子菜单、全屏、画中画、另存副本、打开文件…；
- 实现：antd `Dropdown trigger="contextMenu"`；注意 Electron 右键默认菜单禁用（`contextmenu` preventDefault）。

### 4.4 字幕样式与可调性

- 用 `::cue` 自定义字幕样式：白字 + 阴影、字号随窗口缩放、半透明黑底（可开关）；
- More 面板新增字幕设置（字号三档、背景开/关）——持久化到偏好。

### 4.5 缩略图/首帧

- 打开视频后立即用 `video.currentTime=0.1 + capture` 生成首帧 poster（canvas.toDataURL），消除"打开即黑屏"；海报在加载中显示；
- 进度条 hover 帧预览（本地文件）：seek 到 hover 位置、暂停、截帧显示气泡（高级，量力而行）。

### 4.6 帧步进

- `[` `]` 上一帧/下一帧：暂停状态下 currentTime ± (1/帧率)，帧率从 `video.getVideoPlaybackQuality()` 或 `1/16s` 估算；配 OSD 显示 `第 n 帧`。

### 4.7 播放列表与会话延续

- 拖入多个文件 = 临时播放列表（自动连播）；结束后显示"下一集"入口；
- 记录每个文件最后播放位置（localStorage），再次打开询问/自动续播（提示条"继续上次播放？"）。

### 4.8 统计信息（调试面板）

- More 面板"诊断"页：分辨率、帧率（估算）、缓冲状态、解码器信息、`video.getVideoPlaybackQuality()`（dropped frames）；参考 iconMaker 的 RuntimeDiagnosticsView 模式。

### 4.9 无障碍完善

- dock/侧栏为独立 region（aria-label 已有）；快捷键帮助弹窗对读屏可读；
- 视频元素 `aria-label` 动态更新为"播放中：文件名"；
- 所有 OSD 文本用 `aria-live="polite"`；
- 焦点管理：More 面板打开时焦点移入首 Tab；关闭时焦点还给触发按钮。

### 4.10 动效打磨

- 视频淡入：加载完成时 `opacity 0→1` 300ms 过渡；
- 控制栏显示/隐藏加"向上滑入"（现状只有透明度+位移，可加 8px→0 弹性）；
- 结束态重播按钮 hover 微缩放；
- 空态图标入场动画（悬浮/呼吸，克制）。

---

## 5. 架构重构建议（支撑以上优化的地基）

### 5.1 拆分 Controller（当前 672 行单 hook）

| 模块 | 职责 | 说明 |
|---|---|---|
| `usePlaybackEngine` | video 元素绑定、play/pause/seek/rate/volume/loop | 纯媒体控制，无 UI |
| `useProgress` | timeupdate → ref + rAF 节流 → 低频 state | 解决 P0-2.4 |
| `useTracks` | 字幕/音轨读取与选择、事件订阅 | 现 syncTrackState 部分 |
| `useFullscreen` | 全屏/PiP 状态与切换 | 现 toggleFullscreen/PiP |
| `usePlayerKeyboard` | 键位映射 → 命令/动作 | 与命令系统合并（P0-2.2） |
| `useChromeVisibility` | 控制栏显隐状态机（播放中自动隐藏/手动/悬停/面板打开） | 现 isChromeVisible 逻辑，抽成纯状态机便于测试 |

对外仍暴露一个组合 `useVideoPlayerController`（保持 Stage/AppRuntime 接口不变），内部拆分。

### 5.2 时间轴自研组件（Timeline）

- 自研 `Timeline`（约 150~200 行）：缓冲层 + 进度层 + 拖拽手势（pointer events）+ hover 预览 + 键盘可操作（role="slider"）；
- 替代 antd Slider 的时间轴场景：解决缓冲可视化（3.9）、拖动预览（2.3）、高频更新（2.4）三合一；
- 音量滑块可继续用 antd Slider（低频）。

### 5.3 状态收敛

- 播放核心状态建议 `useReducer`（PLAY/PAUSE/SEEK/BUFFER/ERROR/ENDED/RATE/VOLUME/MUTE），动作单一来源，配合 5.1 拆分；
- `controller` 对象整体 `useMemo` 稳定引用（依赖正确性），否则下游 memo 全部失效。

### 5.4 组件分层

```
VideoPlayerStage（编排：状态机 + 布局）
├── VideoViewport（video + 点击语义 + 拖拽 + overlay）
├── Timeline（独立高频组件）
├── PlayerDock（控制栏：按钮组 + 音量 + 倍速/字幕/音轨浮层）
├── SidePanel（More 面板）
├── TrackMenu（dock 浮层，与 SidePanel 共享数据）
├── Osd（OSD 反馈）
├── EndedOverlay / EmptyState / LoadingOverlay
└── KeyHelpDialog（? 帮助）
```

### 5.5 测试策略

- 单测（vitest + jsdom + testing-library）：
  - 双击不触发单击语义（2.1）；
  - 单键单动作（2.2）；
  - 拖动只预览、松开才 seek（2.3）；
  - OSD 触发与自动消失（3.1）；
  - ended 态重播流（2.5）；
  - 快捷键映射表完整性（3.8）；
- mock `HTMLMediaElement`（play/pause/currentTime/volume/textTracks）——现有测试基建已具备。

---

## 6. 视觉与动效规范（融入苹果风格）

| 元素 | 窗口内（浅色） | 全屏（深色） |
|---|---|---|
| dock 背景 | `rgba(255,255,255,0.72)` + blur(20px) | `rgba(18,18,20,0.6)` + blur(20px) |
| 图标/文字 | `#1d1d1f` | `#ffffff` |
| 进度条 | 主题蓝 `#0a84ff`，缓冲层 `rgba(0,0,0,0.12)` | 白 `rgba(255,255,255,0.85)`，缓冲层 `rgba(255,255,255,0.25)` |
| 音量浮层/侧栏/OSD | 白玻璃 + 深字 | 深玻璃 + 白字 |
| 过渡 | 150ms ease-out | 同左 |
| OSD | 居中胶囊，fade+scale，1.2s | 同左 |

统一用 CSS 语义变量（`--dock-bg/--dock-fg/--panel-bg/...`）承载两套值，`--fullscreen` 类切换，禁止散落硬编码。

---

## 7. 实施路线图（建议分期）

| 期 | 内容 | 预估 |
|---|---|---|
| 第 1 期（正确性） | P0 全部：双击语义、快捷键去重、拖动预览、高频渲染、ended 重播 | 2~3 天 |
| 第 2 期（体验） | OSD、深浅色自适应、单击切显隐、缓冲动画、空态、dock 直达入口、音量滚轮 | 3~4 天 |
| 第 3 期（架构） | Controller 拆分、Timeline 自研、reducer 收敛、测试补齐 | 2~3 天 |
| 第 4 期（进阶） | 记忆偏好、循环 UI、右键菜单、字幕样式、帧步进、首帧海报、统计面板、动效打磨 | 3~4 天 |

每期结束跑全量门禁（typecheck/test/build/validate）与人工走查（含全屏/弱网/异常文件三场景）。

---

## 8. 附：本仓库当前可立即修复的小问题清单

1. `PLAYBACK_RATES` 缺少 0.5x（列表扩展为 [0.5, 0.75, 1, 1.25, 1.5, 2]）；
2. `.ogg` 混在视频扩展列表中（实为音频容器，建议移除或标注）；
3. `preload="metadata"` 建议播放前动态升级为 `auto`（首播更顺滑）；
4. 全屏时 AppChrome 菜单栏不参与（现状合理），但退出全屏后应自动亮起控制栏（现在可能仍隐藏）；
5. `volume` popover 的 hover 无延迟，鼠标快速划过会闪（加 120ms 进出延迟）；
6. More 面板打开时无入场动画（加 150ms fade+translate）；
7. `aria-describedby` 引用 feedback id 时 feedback 不存在会留悬空引用（条件渲染已处理，确认即可）；
8. dock 在"无视频"时应整体隐藏或禁用（现仅按钮 disabled，dock 仍显示空进度条——建议无视频时 dock 只留"打开"按钮，其他隐藏，空态更干净）。

---

## 10. 一句话总结

**当前 VideoPlayer 已经具备正确的基础能力；要成为"世界最好用"，优先做三件事：OSD 反馈系统、拖动预览式 seek（含缓冲可视化时间轴）、播放结束重播态；再配合全屏深浅色自适应与快捷键帮助，即可对齐 QuickTime/YouTube/IINA 的体验基准。**

---

## 11. 实施进度（2026-08-08 首轮落地）

| 项 | 状态 | 说明 |
|---|---|---|
| P0-2.1 双击防抖 | ✅ | `suppressClickRef` 300ms 抑制双击后的单击 |
| P0-2.2 快捷键去重 | ✅ | 纯键快捷键（Space/←→/M/F/P）移出命令系统，统一由 `usePlayerKeyboard` 处理；命令系统仅保留 Mod+O/Mod+S |
| P0-2.3 拖动预览式 seek | ✅ | 自研 `Timeline` 组件：拖动中 `onPreview`（本地预览），松开 `onCommit`（一次 seek） |
| P0-2.4 高频渲染 | ✅ | `usePlaybackEngine` 进度用 250ms 节流刷新（progressRef + 定时 flush） |
| P0-2.5 播放结束重播态 | ✅ | `EndedOverlay`（重播按钮 + 关闭） |
| P1-3.1 OSD 反馈 | ✅ | `Osd` 组件：音量/静音/倍速/seek/拖动提交均触发，1.2s 自动消失 |
| P1-3.2 深浅色自适应 | ✅ | `global.css` 语义变量两套（--dock-*/--panel-*/--osd-* 等），`.video-player-stage--fullscreen` 切换 |
| P1-3.4 缓冲/加载动画 | 部分 | 文案保留，后续接入 Spin |
| P1-3.5 空态升级 | ✅ | `EmptyState` 组件（毛玻璃圆底图标 + 按钮 + 提示） |
| P1-3.6 dock 直达入口 | ✅ | 倍速（`TrackMenu` + 速率徽标按钮）、字幕（CC 按钮 + 浮层）、音轨 |
| P1-3.7 音量交互 | ✅ | 点击静音、滚轮调音量（带 OSD）、音量滑块 onAfterChange 提示 |
| P1-3.8 键盘补全 | ✅ | `?` 帮助（KeyHelpDialog）、J/L ±10s、Shift+←→ ±30s、Home/End、0-9 跳转、[ ] 帧步进 |
| P1-3.9 缓冲可视化 | ✅ | Timeline 双层（缓冲层 + 进度层） |
| P1-3.10 顶部信息条 | ⏳ | 未做（后续期） |
| P2-4.1 记忆偏好 | ⏳ | 未做（后续期） |
| P2-4.2 循环 UI | ⏳ | 未做（后续期） |
| P2-4.3 右键菜单 | ⏳ | 未做（后续期） |
| 第 3 期架构 | ✅ | Controller 拆分为 usePlaybackEngine/useTracks/useFullscreen/useChromeVisibility/usePlayerKeyboard 五模块 + 组合层；接口兼容（新增 isEnded/chromeVisible/seekPreviewTo/commitSeek/adjustVolume/frameStep/toggleChrome） |
| 测试 | ✅ | 65 用例全绿（新增：Osd 6、Timeline 9、TrackMenu 6、EndedOverlay 6、KeyHelpDialog 7、EmptyState 4、controller-v2 4）；typecheck/build/validate 通过 |

**未落地（P2 进阶项）**：顶部信息条、记忆偏好、循环 UI、右键菜单、字幕样式可调、缩略图/首帧海报、播放列表、统计面板、动效打磨——建议下一轮实施。

## 12. 实施进度（2026-08-08 第二轮落地）

| 项 | 状态 | 说明 |
|---|---|---|
| P1-3.10 顶部信息条 | ✅ | dock 内信息条（标题 · 格式 · 分辨率 · 来源），`--titlebar-*` 变量深浅色 |
| P2-4.1 记忆偏好 | ✅ | `utils/preferences.ts`（localStorage）：音量/静音/倍速/字幕/循环；启动读取、变更写回、损坏容错 |
| P2-4.2 循环 UI | ✅ | dock 循环按钮（RedoOutlined，active 高亮）+ 右键菜单项 + OSD 反馈 + 偏好持久化 |
| P2-4.3 右键菜单 | ✅ | 视频右键：播放/循环/倍速子菜单/字幕子菜单/PiP/全屏/另存/快捷键帮助 |
| P2-4.4 字幕样式 | ⏳ | `::cue` 基础样式未做（记入下轮） |
| P2-4.5 首帧海报 | ⏳ | 未做（依赖截帧，下轮评估） |
| P2-4.7 播放队列 | ✅ | `dropFile(File[])` 多文件拖入入队；ended 自动播下一个 + EndedOverlay"播放下一个"按钮；`queueCount/playNext` |
| P2-4.8 统计面板 | ✅ | More 面板"诊断"Tab：分辨率/时长/倍速/音量/缓冲%/循环 |
| P2-4.9 无障碍 | 部分 | Esc 分层关闭（菜单→帮助→面板）、右键菜单键盘可操作 |
| P2-4.10 动效 | ✅ | 视频淡入（ready 300ms）、OSD/覆盖层入场动画、dock 200ms 上滑 |
| P1-3.4 缓冲动画 | ✅ | Loading 大 spinner、Buffering 小 spinner（画面保留） |
| 小问题 1 倍速扩展 | ✅ | PLAYBACK_RATES 增加 0.5x（[0.5, 0.75, 1, 1.25, 1.5, 2]） |
| 小问题 2 .ogg 移除 | ✅ | SUPPORTED_VIDEO_EXTENSIONS 移除 .ogg（音频容器误入） |
| 测试 | ✅ | 72 用例全绿（新增 preferences 5、controller loop/持久化 2）；tsc/build/validate/lint 通过 |
| 文档 | ✅ | 技术文档 03 重写（新架构）、06 新建（交互规范）、04 标注废弃、00 索引更新 |
