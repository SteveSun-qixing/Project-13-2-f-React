# 会话记录：curious-nebula

- 会话 ID：ses_01dc69a27ffe3eXNvjIknAMBRl
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:34:00

---

## 2026-08-09 00:34:00

重构 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-VideoPlayer 的播放控制器层（task031 润物计划第 1/3 期）。不做 Git 提交。

## 背景
当前 `src/hooks/useVideoPlayerController.ts`（672 行）是单一巨型 hook，管理播放/进度/轨道/全屏/PiP/快捷键全部状态，且存在：高频 state 更新（timeupdate 每秒多次 × 3 setState）、播放结束无 ended 状态。需要拆分架构并修复正确性。

## 必读
- /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-VideoPlayer-细节设计与优化建议.md（第 2.4、2.5、5.1、5.3 节）
- 现有代码：src/hooks/useVideoPlayerController.ts、src/utils/video-player.ts

## 你的文件域（只改这些）
- src/hooks/useVideoPlayerController.ts（重构为组合层，保持对外接口兼容）
- src/hooks/ 下新建拆分模块（建议）：usePlaybackEngine.ts（play/pause/seek/rate/volume/loop 纯媒体控制）、useProgress.ts（timeupdate → ref + rAF 节流 → 低频 state）、useTracks.ts（字幕/音轨读取选择与事件订阅）、useFullscreen.ts（全屏/PiP）、usePlayerKeyboard.ts（键盘映射）、useChromeVisibility.ts（控制栏显隐状态机）——拆分方案可自行调整，但要合理
- src/utils/video-player.ts（如需要补充 ended/帧率相关纯函数）

## 硬性约束
1. **对外接口兼容**：`useVideoPlayerController` 返回的 `VideoPlayerController` 形状**只能增字段、不能删改现有字段**（Stage/AppRuntime 依赖：surfaceRef/videoRef/isReady/isPlaying/isBuffering/isMuted/volume/playbackRate/duration/currentTime/bufferedUntil/isFullscreen/isPictureInPicture/canUsePictureInPicture/videoSize/errorKey/subtitleTracks/audioTracks + 全部方法）。改完必须 npx tsc --noEmit 通过（除既有 BCP 工单132 报错外 0 错误）。
2. **新增能力**（供后续 Stage 集成使用）：
   - `isEnded: boolean`：handleEnded 时置 true，seekTo/play 后置 false；
   - `seekPreviewTo(nextTime: number)`：只更新本地进度预览（写 ref + 节流 state），**不写 video.currentTime**；
   - `commitSeek(nextTime: number)`：写 video.currentTime + 同步状态（原 seekTo 语义，改名保留旧 seekTo 作为别名）；
   - `toggleChrome(): void` 与 `chromeVisible: boolean`：手动切换控制栏显隐（与自动隐藏状态机协同）；
   - `setVolumeLevel`/`setPlaybackRate`/`seekBy` 等动作保持（供 OSD 触发）；
   - 键盘映射支持扩展键：`?`/`J`/`L`/`Home`/`End`/`0`-`9`（跳转 10%~90%）/`Shift+ArrowLeft`/`Shift+ArrowRight`（30s）——在 usePlayerKeyboard 中实现，`handleKeyDown` 行为变更；
3. **高频渲染修复**：useProgress 用 rAF 节流（每秒最多 ~16 次 state 更新或更低），timeupdate 不直接 setState 高频字段；`duration` 低频可即时。
4. 播放状态建议 useReducer（PLAY/PAUSE/SEEK/BUFFER/ERROR/ENDED/RATE/VOLUME/MUTE 动作）或等效收敛。
5. **测试**：为拆分模块补单测（tests/unit/ 下新建 controller-*.test.ts）：mock HTMLMediaElement（play/pause/currentTime/volume/buffered/textTracks）；覆盖：播放/暂停流转、seek 钳制、ended 置位与复位、音量钳制、进度节流（可选）。现有测试不得破坏。

## 红线
- 不碰 src/components/VideoPlayerStage.tsx、src/commands/、src/app/（其他任务处理）
- 不碰 global.css；禁止 any；禁止 TODO；禁止删除文件（移动归档）
- 禁止 import @chips/component-library

## 验证（在仓库目录执行）
1. npx tsc --noEmit → 0 错误（既有 richtext-BCP 报错除外）
2. npm test → 全绿（含你新增的单测）
3. 汇报中说明拆分结构图与对外接口变更清单

## 汇报（最终消息必须包含）
- 新建/修改文件清单
- 接口变更说明（新增字段/方法）
- 测试输出摘要
- 遗留疑问（若有）
