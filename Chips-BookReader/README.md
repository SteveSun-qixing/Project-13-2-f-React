# 书籍阅读器

薯片生态正式应用插件，用于打开本地电子书、PDF、文本类阅读资源，接收 Host `resource.open` 资源路由唤起的电子书基础卡片上下文，并在具备可访问链接时直接读取远程阅读资源。

## 当前范围

- 正式渲染 EPUB / EPUB3 / PDF / TXT / Markdown / FB2 / RTF。
- 识别 MOBI / AZW / AZW3 / DJVU / DOC / DOCX 启动目标，并在缺少正式跨平台解码器时给出明确错误。
- 支持 `file-handler:.epub/.epub3/.pdf/.txt/.md/.markdown/.fb2/.rtf/.mobi/.azw/.azw3/.djvu/.djv/.doc/.docx`。
- 支持 manifest 中已声明的电子书、PDF、纯文本、Markdown、FB2、RTF 和重型文档 `resource-handler:view:<mime>` 能力。
- 支持空启动、文件选择、拖拽打开、`launchParams.targetPath`、`launchParams.resourceOpen`、`chips.book-card` payload 和远程 URL 入口。
- 支持目录导航、章节切换、搜索、书签、阅读进度、阅读偏好和配置持久化。
- 支持阅读进度持久化与恢复：重开书自动恢复到上次位置（含"已恢复到 X% · 上次阅读于…"横幅与"从头开始"）。
- 支持两种正式阅读模式：
  - 左右翻页
  - 上下滚动
- 支持多输入设备阅读操作：
  - 键盘翻页 / 滚动快捷键
  - 鼠标点击左右区域翻页
  - 滚轮 / 触摸板翻页或越章滚动
  - 触摸屏滑动翻页或跨章节滚动
- 支持阅读背景颜色调整（含"跟随系统"、亮度遮罩与主题切换过渡）
- 支持排版扩展：字号、行高、字距、对齐方式、4 档字体（衬线/无衬线/圆体/系统）、版心宽度、竖排（CJK）
- 翻页反馈与动画：翻页方向光晕、点击涟漪、章节淡入、边界回弹、滑入式翻页（遵循 `prefers-reduced-motion` 降级）
- 进度条增强：书签标记点、章节刻度、整书拖拽、上一章/下一章按钮
- 搜索增强：输入防抖、匹配词高亮、结果计数、上一条/下一条跳转
- 目录增强：折叠层级、当前章节自动定位、目录搜索、章节进度标注
- 书签增强：创建时自动抓取正文摘录、当前页书签快捷卡
- 智能 chrome：阅读中自动隐藏、dock 图标+文字标签、metaCard 折叠、全屏切换
- 快捷键：翻页/章节（N/P）、全屏（F）、循环背景色调（T）、字号（[ ]）、版心（- =）等
- 章节切换横幅与图标化反馈提示
- 阅读界面采用沉浸式极简交互：
  - 空态仅保留居中导入提示
  - 阅读态默认隐藏操作按钮
  - 点击阅读区中部后再显示目录、导入与阅读偏好控制
- 已完成最小真实样本回归，覆盖 EPUB/EPUB3、PDF、TXT、Markdown、FB2、RTF、重型格式错误态、Host 启动参数归一和搜索基础链路。

当前不纳入：

- 书架
- 设置中心
- OPDS / 下载管理
- LCP / DRM
- 上游 Thorium 的 Electron 应用壳、Redux 同步与完整桌面应用能力

## 快速开始

```bash
cd Chips-BookReader
npm run dev
```

常用命令：

- `npm run run`
- `npm run build`
- `npm test`
- `npm run lint`
- `npm run validate`
- `npm run package`

## 目录说明

- `src/domain/epub/`: EPUB 解包、OPF/nav 解析、Publication/Link 适配、HTML 章节变换器
- `src/domain/book/`: PDF、TXT、Markdown、FB2、RTF 等虚拟阅读书籍加载层
- `src/domain/readium/`: Thorium / Readium 来源资源归档与 ReadiumCSS 资源
- `src/app/`: AppRuntime、Scene、Environment 与 Host launch context 接入
- `src/commands/`: 菜单、工具栏、快捷键和命令面板共享的 command metadata 与处理器
- `src/engine/`: 分页、滚动、布局、位置、动画、搜索和文档控制器
- `src/interaction/`: 键盘、点击、滚轮、触摸输入意图层
- `src/components/`: 阅读器界面、面板、章节 iframe 承载和沉浸式控制层
- `src/runtime/`: SDK client 与 launch context 适配
- `src/utils/`: 启动资源、源目标、二进制和阅读偏好工具
- `src/lib/`: 文案字典与消息解析（`book-reader.*` 键）
- `技术文档/`: 开源吸收评估、架构映射、实现说明
- `需求文档/`: 当前项目范围与正式需求边界

## 文档入口

- `技术文档/01-开源吸收评估与架构映射.md`
- `技术文档/02-书籍阅读器实现说明.md`
- `技术文档/03-Thorium-Readium来源与许可证说明.md`
- `需求文档/01-书籍阅读器需求文档.md`

## 当前实现说明

- 应用壳层已遵循薯片生态 app 插件架构、AppRuntime/Scene/Environment、主题、多语言与 Host 启动契约。
- Host 资源路由入口优先消费 `launchParams.resourceOpen`，并支持电子书基础卡片透传的 `chips.book-card` payload；`targetPath` 只作为本地文件关联回退。
- EPUB 内部能力改为使用内部 `Publication/Link` 适配层、HTML 章节变换器和 `ReadiumDocumentController`
- PDF/TXT/Markdown/FB2/RTF 会被转为内部虚拟章节，继续复用同一套目录、搜索、书签、进度和阅读偏好链路。
- MOBI/AZW/AZW3/DJVU/DOC/DOCX 仅作为正式处理器目标识别；正式解码能力缺口复用既有工单，不在阅读器里加入临时解析器。
- 章节渲染只负责输出内容文档，分页/滚动、字号、背景色、版心宽度和 fragment 定位全部由 iframe 内阅读运行时动态接管
- `paginated` 模式使用移植后的 Thorium / Readium 列分页测量链路，滚轮 / 触摸板轻滚即可直接左右翻页
- 分页运行时已修正 iframe 跨 realm 滚动根节点识别，`PageDown`、滚轮和触摸板不会再误判为“直接下一章”
- `scroll` 模式使用同一套运行时切换为纵向阅读流，并在章节顶部 / 底部边界继续滚动时自动越章
- 滚轮阈值已经按翻页模式 / 滚动模式分别调低，单次鼠标刻度在分页模式下可直接翻页；章节末尾后的下一次翻动会直接进入下一章，不再要求额外确认
- 分页模式不再沿用 Readium 默认 `20em` 阈值决定单双页，而是按窗口宽度、版心偏好和章节类型显式计算 1 页 / 2 页 spread
- 滚动模式不再被 ReadiumCSS 默认 `40rem` 行长常量反向覆盖，正文版心会严格跟随当前窗口宽度和用户设置的版心偏好
- 窗口缩放时不再沿用旧像素偏移强行对齐，而是按上一页位锚点恢复分页位置，减少缩放后跳页、缺页和正文截断
- 渲染器会识别封面页、整页插图页、章节内独立插图和 Vellum 大标题结构，并分别注入响应式版式规则，避免图片溢出、过小留白或分页空白异常
- 整页插图、封面页与独立插图不再被正文版心宽度锁死，小图会按当前视口放大到可用阅读宽度内，减少大面积空白
- 章节常见包装节点在滚动模式下会统一回到同一响应式版心，避免正文看起来仍像被某个固定常量挤成窄列
- 阅读交互已收口到统一的页内导航逻辑，覆盖键盘、鼠标、滚轮 / 触摸板与触摸滑动
- task031 起翻页具备完整视觉反馈：方向光晕、点击涟漪、章节首屏淡入、全书边界回弹与滑入式翻页动画（`prefers-reduced-motion` 下全部降级）
- 前端界面改为"阅读面 + 临时浮层 + 抽屉面板"结构，不再常驻工具栏和侧栏
- 阅读进度按书源持久化（`book-reader.reading-position.<hex(sourceId)>`），重开书自动恢复并提供"从头开始"入口
- 当前已把 Thorium / Readium 的阅读内核子模块移植到插件内部，但没有迁入其 Electron / Redux 桌面应用链路

## 验证

任务031闭环阶段使用以下正式脚本验证：

```bash
cd Chips-BookReader
npm run lint
npm test
npm run build
npm run validate
```

关键回归入口：

- `tests/e2e/basic-flow.test.ts`：最小真实样本覆盖 EPUB/EPUB3、PDF、TXT、Markdown、FB2、RTF、重型格式错误态、Host 启动参数归一和搜索基础链路。
- `tests/unit/launch-resource.test.ts`：`resourceOpen`、`targetPath`、远程 URL 和 `chips.book-card` payload 归一。
- `tests/unit/commands.test.ts` / `tests/unit/use-book-reader-commands.test.tsx`：命令注册、状态和 Host invoke 链路。
- `tests/unit/reader-a11y.test.tsx`：面板 FocusScope、目录/搜索/书签 roving tabindex 和焦点恢复。
