# 会话记录：witty-orchid

- 会话 ID：ses_01dc014f2ffewlBIe9rKtN5pus
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:41:07

---

## 2026-08-09 00:41:07

为 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-CardViewer 的封面↔内容切换与返回首页添加过渡动画。不做 Git 提交。

## 任务（对应建议文档 4.2、8.5）
参考 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/项目日志与笔记/task031-润物计划-生态细节优化/Chips-CardViewer细节优化建议.md 的 4.2、8.5 节。

### 动画库选型（已定）
引入 **framer-motion@^11**（MIT、React 18 兼容、维护活跃、Electron 兼容）。由你负责在 package.json 添加依赖并 npm install（其他子代理禁止 npm install）。

### 实现要点
1. **封面↔内容切换过渡**（DocumentFileScene.tsx、HostedDocumentScene.tsx）：
   - 用 framer-motion 的 `<AnimatePresence mode="wait">` + `<motion.div>` 包裹封面视图与内容视图，切换 key 用 `runtime.viewerMode`
   - 进入：opacity 0→1 + translateY 8px→0，240ms，easeOut
   - 退出：opacity 1→0，160ms，easeIn
   - mode="wait" 保证退出完成再进入（避免重叠）
2. **ViewerCoverSurface.tsx 入场动画**：封面视图本身加 motion（淡入 + 上浮 12px→0，300ms）；封面内部内容（iframe/标题）不需要单独动画
3. **返回首页过渡**（8.5）：不做在 AppShell（避免与其他子代理冲突）。改为在 CardViewerShell.tsx 根节点用 framer-motion `<motion.div>` 加挂载入场动画（opacity 0→1 + translateY 6px→0，240ms，easeOut）——每次打开文档/返回首页重新挂载时自然有入场；退出动画省略（成本低原则：入场承接即可）
4. **reduced-motion**：framer-motion 的 `<MotionConfig reducedMotion="user">` 包裹（在 AppShell 最外层或 CardViewerShell 内），尊重系统减少动效设置
5. **使用约束**：不改变任何业务逻辑/事件/状态；viewerMode 切换逻辑（showCover/showContent）不动

### 文件域（只改这些，禁止动其他文件）
- package.json（新增 framer-motion ^11.x；npm install）
- src/scenes/DocumentFileScene.tsx
- src/scenes/HostedDocumentScene.tsx
- src/components/ViewerCoverSurface.tsx
- src/components/CardViewerShell.tsx
- 注意：src/components/CardViewerShell.css、src/app/AppShell.tsx、src/components/ViewerChrome.tsx 由其他子代理负责，**不要动**

## 验证
1. npx tsc --noEmit 中你自己的文件无错误（其他文件报错属其他子代理进行中，忽略并说明）
2. npm install 后确认 framer-motion 安装成功（npm ls framer-motion）
3. 汇报：改动清单 + 实现说明（动画参数）

## 红线
- 禁止 import @chips/component-library；禁止 any；禁止 TODO
- 业务逻辑/事件/Host 契约（plugin.surface.resize 等）不变
- 不执行其他子代理文件域的改动
