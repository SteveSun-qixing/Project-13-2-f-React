# 书籍阅读器（chips.official.book-reader）

> 角色：`app`；插件 ID：`chips.official.book-reader`；版本：`0.1.0`；包名：`@chips/plugin-book-reader`

EPUB / PDF / TXT / Markdown / FB2 / RTF 书籍阅读（《09-官方插件与应用目录》§4.2）：目录、搜索、书签、进度、阅读偏好、分页与滚动双模式；`application/pdf` MIME 槽位 `primary` 处理器（manifest fileAssociations，14-契约 §9.1 在册声明）。

## 目录结构

```text
book-reader/
├── manifest.yaml                  # 唯一权威清单：fileAssociations（application/pdf primary）+ 18 条 cli.commands
├── package.json                   # 工作区包 @chips/plugin-book-reader（workspace 依赖 @chips/plugin-book）
├── render.js                      # 渲染入口构建产物（React/@chips/ui 外部化为平台 vendor）
├── dist/                          # 主进程入口构建产物 dist/index.js
├── assets/
│   ├── icons/app.svg              # 启动器图标
│   └── readium/ReadiumCSS/        # ReadiumCSS 资产随迁（css 变体 + 字体 + 许可 + 上游 README，见「来源登记」）
├── src/
│   ├── index.ts                   # IAppPlugin：launch（resourceOpen 上下文日志与标题收敛）+ openFile
│   ├── commands/                  # 命令元数据（appCommands.ts）与 UI 命令运行时接线（useAppCommands.ts）
│   ├── core/                      # 纯逻辑基座：书源模型与偏好归一、阅读调色板、binary/dom/a11y
│   ├── domain/
│   │   ├── epub/                  # EPUB 领域：container→OPF→发布模型→章节 HTML 变换（archive.ts 为共享解析适配层）
│   │   └── book/virtual-book.ts   # txt/md/rtf/fb2/pdf 虚拟书装载
│   ├── engine/                    # 分页/滚动/布局/位置/动画/搜索引擎 + ReadiumCSS 管理器 + 文档控制器
│   ├── interaction/               # 键盘/滚轮/触摸/点击交互状态机（命令派发口径）
│   ├── reading/                   # 打开臂（book-opener.ts）与偏好/书签/位置持久化客户端（config 域 + 内存降级）
│   ├── readium/css-assets.ts      # ReadiumCSS 文本编译期内联（?raw）与字体运行时 URL 解析
│   ├── styles/                    # 翻页动画帧内样式（reader-animation.css，?raw 内联）
│   └── ui/                        # React 壳层（AppView / BookReaderScene / ReaderPanels + hooks）
├── tests/                         # vitest：迁移 20 + 重写/新写 12（真实 EPUB/ZIP 字节夹具，判例对齐 plugins/basecards/book）
└── vite.main.config.ts 等         # 构建红线守卫与双入口配置
```

## 复用与来源登记

- **ZIP/EPUB 解析单一来源**：`EpubArchive`（`src/domain/epub/archive.ts`）是 `@chips/plugin-book` 已交付公开导出（`parseZipEntries` / `extractZipEntry`，自旧族 book-BCP 逐字迁移并测毕）之上的阅读侧适配层；本包不持有第二份 ZIP 解析实现（W5 迁移复用红线）。构建期经 workspace 依赖解析内联（vite alias + tsconfig.base paths 锚定，工单003-B 机制）。
- **ReadiumCSS 资产随迁**（`assets/readium/ReadiumCSS/`，共 22 文件）：来自 ReadiumCSS（readium.org，**BSD-3-Clause**）——default/rtl/cjk-horizontal/cjk-vertical 四 profile 的 before/default/after 样式 + EBPAJ 字体补丁、AccessibleDfA（`fonts/LICENSE-AccessibleDfa`）与 iA Writer Duospace（`fonts/LICENSE-IaWriterDuospace.md`）两款字体及上游 README；自旧仓 `Chips-BookReader/src/domain/readium/assets/ReadiumCSS/` 原样随迁，许可文件随目录保留。样式文本经 `?raw` 编译期内联进 render.js；字体为二进制资产随包发布，运行时按渲染入口模块 URL（宿主侧 `chips-resource://<插件作用域>/render.js`）解析绝对资源地址。
- **其余迁移资产**：EPUB 领域 8 文件、虚拟书、引擎 9、交互 7、偏好调色板与书源模型、`reader-animation.css` 均自旧仓逐字迁移（严格模式适配：`exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`）；壳层（AppView/BookReaderScene/ReaderPanels + hooks 8）与文案为重写（@chips/ui + antd 白名单组件、令牌取值、简体中文直写，无 i18n 中间层）。

## 命令（《13-命令系统契约》）

manifest `cli.commands` 与 `src/commands/appCommands.ts` 逐字对应（tests/commands.test.ts 断言）：
`book-reader:open-card`（Ctrl/Cmd+O）、`book-reader:refresh-view`（F5）、翻页族（`previous-page` / `next-page`）、章节族（`previous-section`[P] / `next-section`[N] / `go-section-start` / `go-section-end`）、面板族（`toggle-contents` / `toggle-bookmarks` / `toggle-preferences` / `toggle-search`[Ctrl/Cmd+F] / `close-panel`[Esc]）、排版族（`increase-font` / `decrease-font` / `widen-content` / `narrow-content`）、书签（`toggle-bookmark`）。全部为 ui 目标：注册经 `chips.request('command:register')`，派发经 `command:invoked` 由 `@chips/ui` 命令运行时本地处理器执行。

## 打开臂（《14-资源打开与默认处理器契约》）

- **被打开臂**：UI 订阅标准事件 `resource:opened`（§5.5），按上下文 `uri` 经 `chips.resource(uri)` 句柄读取字节（`read()` 单次上限 8 MiB）；主进程 `launch` 记录 `args.resourceOpen` 投递事实、`openFile` 聚焦窗口，不重复读字节。
- **发起臂**：应用内打开一律经 `chips.request('resource:open', { intent: 'view', resource: { uri } })` 正式面请求书籍槽位路由。
- **诚实失败**：宿主能力缺位（`resource:open` 处理器、config 域、事件通道）时一律行内简体中文提示（`role="alert"` / `role="status"`），不伪造成功。

## 已登记缺位（宿主面，非本包缺口）

1. `resource:open` 书籍槽位路由无处理器（工单064）：发起臂与被打开臂的端到端候宿主收口。
2. 主逻辑 `launch` 上下文 → 窗口 UI 的投递通道需先登记标准事件（07-应用插件接口 §7.1；工单066「应用窗口运行时与启动上下文投递缺位」）：新实例 UI 暂以空态 + 打开面板承接。
3. `>8MiB` 资源的 `readRange()`/`stream()` 承载链路（15-契约 §五未落）：超限书籍如实提示，暂不打开。
4. 配置域宿主处理器缺位（工单066「配置域宿主处理器缺位」）：偏好/书签/阅读位置经 `config:get|set|reset`（自身命名空间 `plugins.chips.official.book-reader`，07 §7.3）尝试持久化，首次失败整体降级会话内存态，界面以「偏好暂存于内存」如实呈现。

## 常用命令

```bash
npx -y pnpm@9 --filter @chips/plugin-book-reader install   # 工作区链接（根目录执行 npx -y pnpm@9 install）
npx -y pnpm@9 --filter @chips/plugin-book-reader run test        # vitest（25 文件 / 132 用例）
npx -y pnpm@9 --filter @chips/plugin-book-reader run typecheck   # tsc --noEmit
npx -y pnpm@9 --filter @chips/plugin-book-reader run lint        # eslint src tests
npx -y pnpm@9 --filter @chips/plugin-book-reader run build       # dist/index.js + render.js
npx -y pnpm@9 --filter @chips/plugin-book-reader run package     # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`；ReadiumCSS 文本已内联，字体走包内 `assets/`）。`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 规范入口

《应用插件开发指南》《应用插件接口》《资源打开与默认处理器契约》《命令系统契约》《查看器设计》《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
