# 视觉体系与 CSS 语义变量规范

> 适用范围：`Chips-VideoPlayer` 仓库内部实现
> 实现位置：`src/global.css`

## 1. 目标

播放器视觉统一收敛到 CSS 语义变量体系：**浅色（窗口内）与深色（全屏）两套取值**，由 Stage 根节点的 `video-player-stage--fullscreen` 类切换。任何新增浮层（OSD、轨道菜单、标题条、结束态）只消费语义变量，禁止散落硬编码颜色。

## 2. 变量体系（浅 / 深两套）

所有变量定义在 `src/global.css`：

- 浅色取值：`:root`
- 深色取值：`.video-player-stage--fullscreen`

| 变量 | 浅色值 | 深色值 | 消费方 |
| --- | --- | --- | --- |
| `--dock-bg` | `rgba(255,255,255,0.72)` | `rgba(18,18,20,0.6)` | dock |
| `--dock-fg` | `#1d1d1f` | `#ffffff` | dock 图标/文字 |
| `--dock-border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.14)` | dock 边框 |
| `--dock-hover-bg` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.12)` | 预留（dock 容器悬停态） |
| `--dock-active-bg` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.2)` | dock 按压态 |
| `--panel-bg` | `rgba(255,255,255,0.92)` | `rgba(24,24,28,0.9)` | 侧栏 / 音量浮层 / 卡片 / 反馈条 |
| `--panel-fg` | `#1d1d1f` | `#ffffff` | 面板主文字 |
| `--panel-fg-soft` | `#6e6e73` | `rgba(255,255,255,0.72)` | 面板次级文字 |
| `--panel-border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.14)` | 面板边框 |
| `--panel-fill-soft` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.08)` | 信息格底 / 弱填充 |
| `--panel-fill-strong` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.16)` | 预留（强填充） |
| `--panel-accent` | `#0a84ff` | `#0a84ff` | Tabs 指示条等强调色 |
| `--osd-bg` | `rgba(255,255,255,0.85)` | `rgba(24,24,28,0.85)` | OSD 卡片（Osd.css 消费） |
| `--osd-fg` | `#1d1d1f` | `#ffffff` | OSD 文字 |
| `--osd-accent` | `#0a84ff` | `#0a84ff` | OSD 强调色 |
| `--timeline-buffer` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.25)` | Slider rail（缓冲层） |
| `--timeline-progress` | `#0a84ff` | `rgba(255,255,255,0.85)` | Slider track（进度层） |
| `--timeline-thumb` | `#ffffff` | `#ffffff` | Slider handle 圆点 |
| `--icon-button-hover` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.14)` | 图标按钮悬停底 |
| `--icon-button-active` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.22)` | 图标按钮按压/选中底 |
| `--menu-hover-bg` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.1)` | 轨道/浮层菜单项悬停（后续任务） |
| `--menu-selected-bg` | `rgba(10,132,255,0.12)` | `rgba(10,132,255,0.32)` | 菜单项选中底（后续任务） |
| `--menu-selected-fg` | `#0a84ff` | `#4da3ff` | 菜单项选中文字（后续任务） |
| `--titlebar-bg` | `rgba(255,255,255,0.65)` | `rgba(18,18,20,0.6)` | 顶部信息条（后续任务） |
| `--titlebar-fg` | `#1d1d1f` | `#ffffff` | 信息条主文字（后续任务） |
| `--titlebar-fg-soft` | `#6e6e73` | `rgba(255,255,255,0.72)` | 信息条次级文字（后续任务） |
| `--titlebar-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.12)` | 信息条边框（后续任务） |
| `--ended-overlay-bg` | `rgba(0,0,0,0.32)` | `rgba(0,0,0,0.5)` | 结束态覆盖层（后续任务） |

基础色板（不变值，两态共用）：`--video-player-bg/surface/canvas/on-surface/text-soft/text-faint/border/primary/danger/success`、`--video-player-radius-*`、`--video-player-shadow`、`--video-player-transition-*`。

## 3. 与 antd 组件的分工

| 部分 | 负责方 |
| --- | --- |
| 非 antd 元素（dock/侧栏/卡片/反馈/音量浮层） | 本项目 CSS 语义变量（深浅自动切换） |
| 全屏态 antd 组件深色上下文 | 集成层在全屏时给 dock 子树包 `ConfigProvider` dark 主题（见 task031 建议稿 3.2） |
| antd Slider / Button / Tabs 颜色 | 本项目 CSS 变量覆写（`--timeline-*`、`--dock-fg`、`--panel-fg` 等），全屏类下显式补齐 `.ant-btn:not(.ant-btn-primary)` 文字色与 Tabs 颜色 |

约定：`.video-player-dock .ant-slider ...` 系列覆写引用 `--timeline-*`，深浅随类自动切换，不重复书写全屏副本。

## 4. 视觉规范要点

1. 毛玻璃：dock / 侧栏 / 音量浮层 / 卡片 / 反馈条统一 `backdrop-filter: blur(20px)`；
2. dock 自动隐藏：`opacity + translateY(8px)`，200ms ease-out（类名 `video-player-dock--hidden`）；
3. 空态：图标 64px 圆形毛玻璃底（`blur(20px)`），悬停 / 拖拽悬停时微缩放（1.06 / 1.1）；
4. 全屏深色态同时设置 `color-scheme: dark`（滚动条等系统部件随深色）。

## 5. 约束

- `src/global.css` 只允许出现"语义变量"与"现有元素样式"；新组件的专属样式（如 `Osd.css`）由对应组件任务在组件目录内维护；
- 新增任何视觉颜色都必须先登记到上述变量表，禁止直接写十六进制 / rgba 字面量。
