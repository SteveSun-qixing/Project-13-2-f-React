# 会话记录：calm-falcon

- 会话 ID：ses_01db655c7ffeu6MYytVP43pJTX
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:51:46

---

## 2026-08-09 00:51:46

在 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BookReader 优化阅读 chrome（task031 建议 2.5）。不做 Git 提交。

## 你的文件域（严格只改这些，禁止碰其他文件）
- src/components/ReaderChrome.tsx：dock 按钮加文字标签（图标+9px 小字竖排）；metaCard 精简为"章节标题 + 进度%"（书名/作者折叠为点击展开的浮层）；新增全屏按钮（尝试 requestFullscreen，失败则隐藏）；"自动隐藏倒计时"逻辑不做（ReaderShell 接线批次 2），本文件只做展示层改造与新增 props（autoHideRemaining 可选 prop 预留）
- src/components/ControlButton.tsx：支持 label 文字显示模式（variant="dock" 时图标+文字竖排）
- src/components/FeedbackToast.tsx：成功/信息反馈样式统一（icon+语义浅底），仍底部胶囊（错误保持）
- src/styles/reader-chrome.css：dock 文字标签、metaCard 折叠浮层、全屏按钮、反馈样式
- src/lib/messages.ts：**不要改**（新文案直写中文）

## 实现要求
1. dock 按钮（6 个）显示文字标签：打开书库/目录/搜索/书签/书签列表/偏好；
2. metaCard：顶部仅章节标题（17px 中字重）+ 右侧进度百分比；书名/作者信息折叠为"点按标题展开"浮层（毛玻璃卡片，Escape 关闭）；
3. 全屏按钮调用 document.documentElement.requestFullscreen()，进入后图标切换（FullscreenExitOutlined）；无能力时自动隐藏；
4. 反馈 toast 加图标：成功 CheckCircleFilled 绿底浅色、信息 InfoCircleOutlined 蓝底浅色、错误 CloseCircleFilled 红底浅色；
5. 保持现有 data-state 动画与可访问性（aria-label 必填）；
6. 文案直写中文；禁 any/TODO/占位/删文件；不 import @chips/component-library；antd 图标用 @ant-design/icons。

## 验证
npx tsc --noEmit 只看你文件域无错。不跑 npm install / npm test。

## 汇报
改动文件清单、新 props 说明（供批次 2 接线）、tsc 结论。
