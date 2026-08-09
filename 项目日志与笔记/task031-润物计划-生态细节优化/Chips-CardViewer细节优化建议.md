# task031 润物计划 · Chips-CardViewer 细节优化建议

> 任务编号：task031-润物计划-生态细节优化
> 创建日期：2026-08-08
> 审查对象：`Chips-CardViewer` 全部前端（约 4000 行：AppRuntimeProvider/AppShell/EmptyScene/DropZone/CardWindow/HostedDocumentWindow/ViewerCoverSurface/ViewerChrome/commands）
> 对标基准：macOS Quick Look、Apple 设计规范、Linear、VS Code、Figma、Safari 阅读器
> 实施状态：**1.2/1.3/3.1/4.2/5.1/5.2/5.4/8.1~8.5 已实施完成（2026-08-08）**，见文末《实施记录》

---

## 1. 现状评估

### 1.1 架构结论（保持，不建议大改）

- **职责定位清晰**：卡片查看器是 Host 卡片显示链路的消费方（套壳），不重写渲染内核——这条边界正确，继续坚守；
- **工程质量优秀**：类型严谨、日志链路完整、iframe 生命周期清理正确（cancelled 标记 + cleanupTasks）、消息来源校验、sandbox、CSP 均到位；
- **文档流高度同步机制**（rAF + ResizeObserver + 160ms stable 发布 + ε 差值过滤）是可靠的基建，保留。

### 1.2 核心短板（一句话总结）

功能完整但"打磨"不足：**交互层级扁平、缺少过渡动效、加载/错误/空态表达单一、浮动控制分散、键盘与拖拽覆盖不全、无 reduced-motion**。方向：从"能用"打磨到"好用、好看、好手感"。

---

## 2. 设计原则（全部建议以此为准绳）

1. **即刻反馈**：任何操作 150~250ms 内有视觉响应（hover/按压/过渡）；
2. **渐进分层**：加载 → 内容淡入，封面 → 内容切换有过渡，不做"瞬变"；
3. **动效克制**：Apple 式短促、轻盈（ease-out、120~280ms），不抢内容；
4. **一物一职**：浮动按钮职责单一、位置稳定，不随状态跳动；
5. **兜底完善**：键盘可达、reduced-motion、窄屏、错误可重试、拖拽可取消；
6. **少即是多**：默认界面只保留核心信息，高级能力进菜单/快捷键。

---

## 3. 分模块建议（按优先级）

### 3.1 空态首页（DropZone）—— P0 快赢

现状：纯白面板 + 虚线框 + `.card / .box` 文本徽标 + 一个按钮；拖拽只改背景色。

| # | 建议 | 理由（对标） |
|---|---|---|
| 1.1 | **进入动画**：面板首次挂载时 400ms 淡入 + 轻微上浮（translateY 8px→0，ease-out）；使用 `@starting-style` 或挂载 class 触发 | Apple 应用空态均有入场动效，避免"突然出现" |
| 1.2 | **拖拽反馈升级**：拖入时面板 1.03 倍缩放 + 边框发光（box-shadow 蓝光）过渡 200ms；图标徽标轻微放大；拖出时反向回弹 | macOS 拖拽目标有"呼吸感"，当前只有颜色瞬变 |
| 1.3 | **拖入类型预检**：dragover 时读取 `items`，若含非 `.card/.box` 文件，面板显示"不支持该文件"红色态（视觉拒绝）；仅当可接受才显示蓝色接受态 | 世界级文件区都做类型预检（邮件附件、iCloud） |
| 1.4 | **徽标图形化**：把 `.card / .box` 文本徽标换成精致 SVG 文件图标（卡片折角 + 品牌蓝渐变），保留文本小字 | 图形优于文字，第一眼建立"这是什么"的认知 |
| 1.5 | **按钮增强**：主按钮旁加次要提示"⌘O"（kbd 样式胶囊）；按钮加载态（打开文件对话框期间 loading） | 快捷键可见化是 Apple 惯例 |
| 1.6 | **背景纹理**：纯白可加极淡径向渐变/网格（1px rgba 0.5% 线），视觉高级但不干扰 | Apple 登录页/空态常用极淡纹理 |
| 1.7 | **错误展示位置**：错误提示当前在面板底部红色条，改为错误时面板轻微抖动（120ms）或边框变红 + 文案，比静态红条更有反馈 | 抖动要克制，reduced-motion 下禁用 |

### 3.2 加载态 —— P0 快赢

现状：白色浮层一行字"正在加载文档…"。

| # | 建议 | 理由 |
|---|---|---|
| 2.1 | **顶部细进度条**：iframe 加载期间在内容区顶部显示 2px 苹果蓝无限进度条（CSS 动画扫过），比浮层轻 | Safari/YouTube 标准做法，不遮挡内容 |
| 2.2 | **加载浮层升级**：保留浮层时，改为 小 spinner + 文档标题 + "正在加载文档…"；spinner 用 antd Spin 定制（苹果色） | 告诉用户"在等什么" |
| 2.3 | **加载→内容过渡**：加载完成后内容 250ms 淡入（透明度 + 微上移 4px） | 消除"突然出现" |
| 2.4 | **骨架屏（可选）**：封面加载显示封面比例骨架（aspect-ratio + 浅灰 shimmer）；文档加载可省（iframe 本身即骨架） | 封面场景收益大 |

### 3.3 错误态 —— P1 重要

现状：红色 overlay 一行字，无重试。

| # | 建议 | 理由 |
|---|---|---|
| 3.1 | **结构化错误**：error 从 `string` 升级为 `{ code, title, message, retryable }`；runtime 中 `setError` 统一结构 | 区分"容器错误/渲染错误/资源错误/类型不支持"，分别设计 |
| 3.2 | **错误视觉**：图标（antd Result 风格：`ExclamationCircleFilled` 苹果红）+ 标题 + 描述 + **重试按钮**（retryable 时）；`card-viewer-shell__state-panel` 卡片保留 | 可重试的错误给出口，是"好用"底线 |
| 3.3 | **文案去技术化**：`"操作失败，请检查 Host 日志与桥接链路"` → `"打开文件失败，请重试"`；技术细节进日志/诊断，不进界面 | 用户语言优先 |
| 3.4 | **错误入场动效**：错误面板 200ms 淡入，不做抖动（错误态克制） | |

### 3.4 封面查看（ViewerCoverSurface）—— P1 重要

现状：封面 iframe 全宽展示 + 透明点击层关闭；封面/内容切换无过渡。

| # | 建议 | 理由（对标 macOS Quick Look） |
|---|---|---|
| 4.1 | **封面呈现形态**：封面作为"预览层"呈现——内容区居中（max-width 560px + 圆角 12px + 分层阴影），背景轻微毛玻璃/遮罩（rgba 白 0.6 + blur 8px），点击封面外部关闭 | Quick Look 的"悬浮预览"心智，而非"整页替换" |
| 4.2 | **切换过渡**：封面↔内容切换使用 240ms crossfade + 内容轻微 scale(0.985→1)；可用 CSS 类切换（两态 class + transition），不引入动画库 | 现有 `showCover/showContent` 状态切换点直接加过渡 |
| 4.3 | **Esc 关闭**：封面态下 Esc 返回内容（见 6.3 键盘） | |
| 4.4 | **封面加载态**：封面 iframe 加载中显示按 ratio 的骨架（2.4）；加载失败显示"封面不可用"占位 + 关闭按钮 | |
| 4.5 | **封面 hit-target 语义**：透明按钮改为封面下方显式关闭按钮（或保留透明层 + 左上返回箭头），避免"点了没反应"困惑 | 目前整张封面点击关闭，用户不一定知道 |

### 3.5 浮动控制（返回/封面切换/下载）—— P1 重要

现状：左上圆形返回 + 居中标题胶囊 + 右上圆形操作（floating-action 与 ViewerChrome 两套并存）；返回用 `‹` 字符。

| # | 建议 | 理由 |
|---|---|---|
| 5.1 | **统一为一条浮动胶囊组**：返回 + 标题 + 操作放在同一水平 flex 线（`inset: 16px 自动`，居中或左对齐），组件间 8px 间距；彻底废弃 `viewer-chrome__back span ‹` 字符，统一 antd 图标（ArrowLeftOutlined 等） | 当前三元素分散三处，视觉凌乱 |
| 5.2 | **毛玻璃分层**：胶囊组统一 `.glass`（rgba 白 0.72 + blur 20px + 1px 内高光边框），按钮 hover 浅灰底 + 图标轻微放大（scale 1.08，180ms）；按压 scale 0.96 | Apple 工具栏手感 |
| 5.3 | **显示/隐藏过渡**：浮动组随状态出现/消失用 200ms 淡入 + 下移 4px；文档滚动后不隐藏（当前设计保持常显即可） | |
| 5.4 | **标题胶囊增强**：窄屏时标题省略号（已有）；**填充 metaLines**：把 createdAt/文件大小等元信息显示为副行（当前 metaLines 恒为空是死代码路径） | 标题 + 元信息 = 阅读上下文 |
| 5.5 | **合并两套体系**：`AppShell` 的 floating-action（返回/封面/下载）与 `ViewerChrome.Layer` 合并为共享层/仓库内单一 `ViewerFloatingChrome` 组件，externalChrome 时仅发事件不渲染（保留现有 plugin.chrome.update 契约），内嵌时渲染 | 消除双实现 |

### 3.6 查看态拖拽与导航 —— P1 重要

现状：仅空态可拖入；查看文档时拖入无反应；无 Esc 处理。

| # | 建议 | 理由 |
|---|---|---|
| 6.1 | **查看态全局拖拽**：文档查看中拖入 `.card/.box` 文件 → 覆盖显示"松开以打开新文档"浮层（类似 Safari 拖标签），松手替换当前文档；拖出窗口取消。这是**最高价值体验改进**之一 | 用户边看边换文件是最常见路径 |
| 6.2 | **拖拽浮层**：全窗口 240ms 淡入的接受态遮罩（蓝光边框 + 图标 + 文案），与空态 dropzone 视觉语言一致 | |
| 6.3 | **键盘**：Esc = 封面→内容 / 内容→返回首页；⌘O 已有；⌘D 下载（有下载能力时）；↑↓/滚轮交给宿主。Esc 行为写入 tooltip 或状态提示 | Quick Look 心智 |
| 6.4 | **封面双击**：封面态双击封面 = 打开内容（与点击外部关闭互补） | |

### 3.7 文档流阅读（document mode）—— P2 长期

| # | 建议 | 理由 |
|---|---|---|
| 7.1 | **阅读进度条**：文档滚动超过一屏后，顶部 2px 细线显示阅读进度（scroll 事件 + rAF 节流，仅 document 模式），读完变主色 | 长文档阅读器标配（Safari 阅读器、微信读书） |
| 7.2 | **回到顶部**：滚动超过 2 屏出现右下角小圆钮（与浮动组视觉一致），点击平滑滚动（`behavior: smooth`，reduced-motion 下 instant） | |
| 7.3 | **阅读宽度选项**：文档内容 max-width 1024px 固定，可提供"宽/适中/窄"三档（菜单命令），记住偏好（localStorage 或用户偏好接口） | 长文阅读舒适度 |
| 7.4 | **加载期间保持内容不跳动**：iframe 高度同步已有 ε 过滤；确认 `--card-viewer-document-frame-height` 初始 960px 在短文档下会造成白底大块——可优化为骨架底色 + 内容区 max-height 内淡入 | 减少"白跳" |

### 3.8 视觉与动效统一 —— P1 重要

| # | 建议 | 理由 |
|---|---|---|
| 8.1 | **运动曲线统一**：全仓过渡统一为 `cubic-bezier(0.25, 0.1, 0.25, 1)`（iOS 曲线），时长 180~240ms；CSS 变量化（`--chips-motion-*`） | 手感一致 |
| 8.2 | **prefers-reduced-motion**：全局 CSS 中 `@media (prefers-reduced-motion: reduce)` 关闭所有过渡/动画/回弹；JS 侧动效（拖拽浮层等）用 `matchMedia` 判断 | 可访问性底线，当前缺失 |
| 8.3 | **hover 层级**：浮动按钮 hover 时背景 `rgba(0,0,0,0.06)` + 图标 scale 1.08；active 时 scale 0.96；过渡 180ms | Apple 按钮手感 |
| 8.4 | **focus-visible**：保留现有 3px 蓝环并统一 offset（3px） | 已达标，保持 |
| 8.5 | **封面/内容切换**：见 4.2；**返回首页**：内容 200ms 淡出 + 下移 8px 再卸载（若实现成本低），否则至少空态面板入场动画（1.1）承接 | 让"回家"有延续感 |

### 3.9 性能细节 —— P2 长期

| # | 建议 | 理由 |
|---|---|---|
| 9.1 | 封面 `<img>`/iframe 资源加 `decoding="async"`、`referrerpolicy="no-referrer"`（按资源策略）；封面 URL 可加 `preload` 提示（`<link rel="preload">` 在进入封面态前预热） | 减少封面等待 |
| 9.2 | `HostedDocumentWindow` 高度测量链：确认 rAF 内测量（当前已做），避免在 scroll/resize 主线程外触发布局抖动；稳定发布 160ms 合理 | 性能已良好，仅做确认 |
| 9.3 | `AppRuntimeProvider` 的 `loadCover` effect 依赖整个 `openedTarget` 对象，每次更新会重建 effect（有 metadataLoaded 守卫，无重复请求）——可改为依赖 `openedTarget.filePath` + `metadataLoaded` 明确字段，减少无谓 effect 重建 | 微小但干净的优化 |
| 9.4 | 文档内容区 `will-change: transform` 仅用于有过渡动画的层，避免滥用 | |

### 3.10 架构与代码整洁 —— P2 长期

| # | 建议 | 理由 |
|---|---|---|
| 10.1 | **命令扩展**：当前仅"打开文件"一条命令。建议补充：查看封面/查看内容、下载卡片、返回首页（条件 enabled），菜单栏在文档态也有可用命令；命令标题复用现有文案 | 让 AppChrome 菜单在文档态不空白 |
| 10.2 | **错误结构**：见 3.1；`resolveErrorMessage` 收敛为工具函数（两处重复实现：AppRuntimeProvider/CardWindow/HostedDocumentWindow 各有） | 去重 |
| 10.3 | **viewerMode 提取 hook**：`useViewerMode()`（cover/content + 切换 + Esc 绑定），从 AppRuntimeProvider 拆出 | 职责更纯 |
| 10.4 | **ViewerStage 拆分**：`ViewerStage` 已是指挥组件，保持；但 `card-viewer-shell__state`（错误/不支持）三处重复的 section+panel 结构提取为 `ViewerStatePanel` 组件 | 去重 |
| 10.5 | **metaLines 死代码**：要么填充数据（5.4），要么删除字段，不留空数组路径 | 无死代码 |
| 10.6 | **dropzone 的 window.chips 类型**：`ChipBridgeWindow`/`resolveNativeFilePath` 可直接用 chips-sdk 类型，移除手写类型断言（若 SDK 提供 `platform.getPathForFile` 类型） | 类型整洁 |

---

## 4. 优先级与实施建议

### P0（快赢，1~2 天，改动小收益大）
- 3.1 空态：入场动画、拖拽反馈升级、类型预检、徽标图形化
- 3.2 加载：顶部细进度条 + 加载浮层升级 + 内容淡入
- 8.2 reduced-motion（全局，成本极低）

### P1（核心体验，3~5 天）
- 3.3 错误结构化 + 重试
- 3.4 封面预览化 + 切换过渡
- 3.5 浮动控制统一为一条胶囊组
- 3.6 查看态全局拖拽 + Esc 键盘
- 8.1/8.3 动效统一

### P2（长期打磨，按版本排期）
- 3.7 阅读进度条/回到顶部/阅读宽度
- 3.8 返回首页过渡
- 3.9 性能细节
- 3.10 架构整洁（命令扩展、去重、hook 提取）

### 实施方式建议

1. **先立规范再改代码**：把 8.1/8.2 的动效 token 与 reduced-motion 补进 `@chips/ui` 全局样式（`global.css`），全生态受益；
2. **组件级先行**：`ViewerFloatingChrome`、`ViewerStatePanel`、`useViewerMode` 若跨应用复用（CardViewer/MusicPlayer 等查看类应用都有浮动控制），可放共享层 `@chips/ui`，否则仓库内私有；
3. **逐项验收**：每项改动配视觉走查（动效录制对比 before/after）+ 现有测试保持全绿（`chipsdev test`）；
4. **不破坏契约**：封面/内容切换、plugin.chrome.update、plugin.surface.resize 等 Host 契约字段一律不动，只改视觉与交互层。

---

## 5. 验收标准（润物计划的"世界级"定义）

1. 打开应用 1 秒内可感知"这是精心打磨的产品"（入场动效、排版、字体渲染）；
2. 从拖入文件到看到内容，全程有连续反馈，无"白屏/瞬变/卡顿"；
3. 封面↔内容、返回首页、拖入新文件，所有导航都有过渡且 ≤280ms；
4. 键盘（Esc/⌘O/⌘D）与鼠标路径完全等价；
5. `prefers-reduced-motion` 下所有动效静默且功能无损；
6. 错误永远有"下一步"（重试/返回/关闭）；
7. 与 macOS Quick Look 并列对比时，不输细节质感。

---

## 6. 实施记录（2026-08-08，5 子代理并行完成）

| 建议项 | 实施内容 | 状态 |
|---|---|---|
| 1.2 拖拽反馈升级 | DropZone 面板 scale 1.02 + 蓝光扩散阴影 + 徽标 scale 1.08，200ms iOS 曲线，拖出回弹 | ✅ |
| 1.3 类型预检 | DragState 升级 `idle/accept/reject`；dragover 遍历 items 校验 `.card/.box` 扩展名；reject 红晕/红边框/红徽标视觉拒绝；drop 仍放行（行为等价） | ✅ |
| 3.1/3.2/3.3 错误结构化 | CardWindow/HostedDocumentWindow 错误 overlay 升级为 图标+标题+重试按钮（retryKey 触发重渲染/重载 iframe）；空态错误加"重新选择文件"（`isRetryableError` 判定）；`hostActionFailed` 文案去技术化 | ✅ |
| 4.2 封面↔内容切换过渡 | 引入 **framer-motion 11.18.2**；AnimatePresence mode="wait"（退出 160ms easeIn → 进入 240ms easeOut + 上浮 8px）；ViewerCoverSurface 入场 300ms | ✅ |
| 5.1 浮动胶囊组统一 | floating-action 移除，统一为 ViewerChrome 一条毛玻璃胶囊组（CSS Grid 三段式：返回/标题胶囊/操作组），externalChrome 契约不变 | ✅ |
| 5.2 毛玻璃与 hover | 容器 rgba 0.72 + blur 20px + 高光 + 双层阴影 + 圆角 16px；按钮 hover 图标 scale 1.08 / active 0.96，180ms；`‹` 字符与手写 CSS 图形全部换 antd 图标 | ✅ |
| 5.4 metaLines 填充 | chromeState.metaLines 填充 createdAt（"创建于 {date}"）+ 文件名副行，消除死代码路径 | ✅ |
| 8.1 动效变量 | global.css `:root` 定义 `--chips-motion-{duration-fast/base/slow,ease,ease-in,ease-out}` | ✅ |
| 8.2 reduced-motion | global.css 全局 `prefers-reduced-motion: reduce` 覆盖（动画/过渡 0.01ms、迭代 1、scroll auto）+ framer-motion `MotionConfig reducedMotion="user"` | ✅ |
| 8.3 hover 层级 | 胶囊组按钮 hover/active 缩放（见 5.2），DropZone 面板/徽标过渡统一 | ✅ |
| 8.4 focus-visible | global.css 通用兜底（button/[tabindex] 3px 蓝环 + offset 3px） | ✅ |
| 8.5 返回首页过渡 | CardViewerShell 根节点 motion.div 挂载入场（240ms easeOut + 上浮 6px）；封面↔内容切换见 4.2 | ✅ |

**测试适配**：`tests/setup.ts`（ResizeObserver/matchMedia 垫片）+ `vi.mock("framer-motion")`（官方测试模式，真实运行不受影响）；app.test.tsx 4 个失败用例已同步（动画时序 + 胶囊组类名）。工单136 已闭环。

**验证**：typecheck 0 错误 / 35 测试全绿 / build 成功 / lint 通过。
