# 会话记录：kind-lagoon

- 会话 ID：ses_01dcd2c34ffeojgB382LYLVugu
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:26:49

---

## 2026-08-09 00:26:49

对 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-MusicPlayer 做运行时重构（task031，方案见 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/音乐播放器细节推敲与优化建议.md 5.3）。不做 Git 提交。**你的文件域：src/app/AppRuntimeProvider.tsx、新文件 src/engine/playlist-engine.ts。禁止改 src/components/、src/hooks/、src/utils/、src/commands/、global.css（他人文件域）。**

## 背景
AppRuntimeProvider.tsx（902 行）包含队列管理逻辑（queue/queueIndex/打开/切歌），需要抽为独立可单测模块（队列 UI 面板不做，属体验功能范围外）。

## 任务

### 1. 新建 src/engine/playlist-engine.ts（纯逻辑，可单测）
队列状态机，不含 React：
- 状态：`items: T[]`、`currentIndex: number`；
- 动作：`setQueue(items, startIndex?)`（替换队列）、`append(items)`（追加）、`removeAt(index)`、`move(from, to)`（排序）、`clear()`、`goNext()` / `goPrevious()`（带边界）、`canGoPrevious()/canGoNext()`、`current()`；
- 行为与当前 AppRuntimeProvider 完全一致：越界保护、-1 表示无播放、边界语义（goNext 在末尾不动作、goPrevious 在开头不动作）；
- 泛型 `<T>` 以便复用。

### 2. AppRuntimeProvider 瘦身
- 用 playlist-engine 替换内联 queue/queueIndex 状态管理；
- **对外 `useMusicPlayerRuntime()` 接口完全不变**（track/queue/queueIndex/canGoPrevious/canGoNext/.../openFiles/saveAudio/dropFiles/goPreviousTrack/goNextTrack/t/setPlayerActions 等字段与签名），AppShell 与 Stage 不受影响；
- 文件打开/启动参数入队逻辑保持（替换队列语义不变——体验功能不做）；
- 若在瘦身中发现死代码（如未使用的 import/函数），清理（移动归档需谨慎，纯删除未使用 import 即可）。

## 红线
- 禁止改 src/components/、src/hooks/、src/utils/、src/commands/、global.css、Chips-Ui
- useMusicPlayerRuntime 对外接口不变
- 禁止删文件（移动归档）；禁止 any；禁止 TODO
- 行为等价：队列/切歌/打开/拖拽行为不变

## 验证（在 Chips-MusicPlayer 目录）
1. npx tsc --noEmit → 你的文件域 0 错误（他人文件域报错忽略并标注）
2. npm test → 你的文件域相关通过（他人域阻塞则说明）

## 汇报（最终消息必须包含）
- 改动/新建文件清单
- playlist-engine API 说明
- 验证输出摘要
- 遗留疑问（若有）
