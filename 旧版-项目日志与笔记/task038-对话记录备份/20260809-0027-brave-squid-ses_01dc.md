# 会话记录：brave-squid

- 会话 ID：ses_01dccdce2ffeS7f6v8Vp3jRNQH
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:27:09

---

## 2026-08-09 00:27:09

对 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-MusicPlayer 做视觉与 UI 全面优化（task031，方案见 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/音乐播放器细节推敲与优化建议.md 第 4 章 4.1-4.6）。不做 Git 提交。**你的文件域：src/global.css、src/app/AppShell.tsx、src/lib/messages.ts。禁止改 src/components/、src/hooks/、src/engine/、src/utils/、src/commands/（他人文件域）。**

## 背景与任务（全部纯 CSS/接线层面，JSX 结构由其他子代理拆分时保持类名不变）

### 1. 沉浸式顶栏接线（4.1，方案 A）
共享层 `@chips/ui` 的 AppChrome 正在新增 `tone?: "light" | "dark-glass"` prop（另一子代理实现，默认 light 不影响其他应用）。本任务在 AppShell.tsx 中给 `<AppChrome ... tone="dark-glass">` 传入该 prop，与播放器深色氛围融合。若你执行时共享层还没实现该 prop（tsc 报错），**不要改共享层**——在 AppShell 中先用 CSS 覆盖方式实现等效深色顶栏（给 AppChrome 外层/菜单栏添加类并改 global.css），并在汇报中说明（主代理会协调共享层 prop 落地后切换）。两种方式任选，目标是视觉效果正确。

### 2. 封面区域（4.2，CSS）
- 封面尺寸：`420px` 固定 → `clamp(260px, 34vh, 420px)`（.svgcontainer width/height），1280 断点内联动；
- 圆角 10px → 14px；阴影分层（`0 2px 8px rgba(0,0,0,0.25), 0 14px 44px rgba(0,0,0,0.28)`）；
- 封面 hover：当前 scale+变暗保留，额外加一个底部半透明"点击打开"提示浮层（用 ::after 实现，背景 `rgba(15,15,18,0.35)`、文字 `rgba(255,255,255,0.9)`、12px、圆角 999px、居中于底部 16px 处，仅 hover 时显示）；
- 封面加载淡入：.svgcontainer 增加背景图切换过渡（background-image 无法 transition——用 opacity 技巧或接受现状，若实现成本高可跳过并说明）。

### 3. 歌词区（4.3，CSS）
- 当前行层级：歌词行 p 字号在 40px 基础上，当前行（可通过现有 CSS 变量 --lyric-line-opacity=1 的行）放大 1.12 倍（用 `p { transition: font-size ... }` + `[style*="--lyric-line-opacity: 1"]` 选择器不可靠——**改用：歌词行 p 增加 transform: scale() 由 --lyric-fill-progress 驱动不现实；方案：当前行通过行内变量已有 --lyric-line-opacity，用 CSS 属性选择器 `[style*="--lyric-line-opacity:1"]` 或给行加 data 属性不可行（JSX 他人域）。简化：仅提升当前行对比度（已有 opacity 1 vs 0.22，足够）+ 增加左侧指示竖线：`p::before` 位置左侧 8px 竖线 3px 宽，颜色 var(--control-accent-base)，仅当前行显示（同样用 opacity 变量选择器，若不可行则跳过并说明）**；
- 歌词行间距 72px → 保持（JSX 计算），mask 渐隐 35%/65% → 22%/78%（更自然）；
- 行过渡保持 0.7s 苹果缓动。

### 4. 控件 dock（4.4，CSS）
- 播放主按钮 44px→56px、图标 34px→40px（.controls button/.anticon 字号），hover 保持；
- 辅助按钮（.auxcontrol）：hover 增加圆底 `rgba(255,255,255,0.12)`（用 ::before 背景圆或直接 background）+ 保持位移/发光；
- 激活态（.auxcontrol--active）：增加圆底 `rgba(255,255,255,0.18)` + 边框 `rgba(255,255,255,0.28)`；
- dock 分组：.auxcontrols 按钮分组间距（用现有结构，增加 gap 分层 6px/14px——若无法按组区分则保持 gap 10px 并说明）；
- 音量区：.volumecontrol 去掉"音量"文字标签（display:none），图标+滑块间距收紧；滑块高度加粗（accent 自定义 thumb 样式：WebKit 自定义 12px 圆 thumb + 4px 轨道）；
- tooltip：保持 CSS 实现，disabled 按钮悬停也显示提示（.music-player-tooltip-anchor 增加 :has(button:disabled):hover 或调整选择器——若 :has 兼容性顾虑，用兄弟选择器方案或跳过并说明）。

### 5. 背景与氛围（4.5，CSS）
- 背景动画性能：.background 的 `animation: movement 20s` 改为**静态渐变 + 一层极慢 transform 微动**（去掉 background-size/position 关键帧动画，改 opacity/transform 类轻动画，周期 30s+）；canvas 动画降帧属 JS（他人域），CSS 侧不动；
- 氛围色扩展：进度条填充色 .process 使用 `background: linear-gradient(90deg, var(--control-accent-strong), var(--control-accent-rim))`（氛围驱动）；
- 空态：body.no-files 时背景用柔和渐变（.background 增加 no-files 变体：`background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.5), rgba(240,240,244,0.9))` 静态）——若与氛围变量冲突，做 fallback；
- **prefers-reduced-motion（P0 无障碍）**：`@media (prefers-reduced-motion: reduce)` 下禁用：.background 动画、.svgcontainer 过渡、.controls/.auxcontrol 过渡、.lyrics > .item 过渡、.music-player-tooltip-anchor 过渡、body.no-files 宽度过渡——全部降级为无动画/瞬时。

### 6. 排版（4.6，CSS）
- .time/.name/.metarow 增加 `font-variant-numeric: tabular-nums`（时间数字不跳动）；
- 曲名 17px→19px（.time .name font-size），元信息 13px 保持；长文本 ellipsis 已有保留。

### 7. 文案微调（messages.ts，仅确认无错漏）
- 检查 messages.ts 现有文案与界面一致（不加新文案，除非 CSS 浮层需要文字——封面 hover 浮层文字"打开文件"直接用 CSS content 或 data 属性，不新增 key）。

## 红线
- 禁止改 src/components/、src/hooks/、src/engine/、src/utils/、src/commands/、Chips-Ui（他人文件域）；AppShell.tsx 只允许加 tone prop/CSS 类，不改结构
- CSS 类名结构保持（其他子代理基于类名工作）；禁止删文件（移动归档）；禁止 any；禁止 TODO
- 视觉目标：苹果质感、深色氛围统一、reduced-motion 完整

## 验证（在 Chips-MusicPlayer 目录）
1. npx tsc --noEmit → 你的文件域 0 错误（他人文件域报错忽略并标注）
2. npm test → 若他人域阻塞，说明你的文件域结果

## 汇报（最终消息必须包含）
- 改动文件清单与每条 CSS 改动说明
- 沉浸式顶栏的落地方式（prop 或 CSS 覆盖）
- 验证输出摘要
- 遗留疑问（若有）
