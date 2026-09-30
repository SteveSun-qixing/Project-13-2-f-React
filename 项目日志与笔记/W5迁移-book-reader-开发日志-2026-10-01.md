# W5 迁移：book-reader（三段式第③段）开发日志

> 日期：2026-10-01
> 任务：图书阅读器（`chips.official.book-reader`）业务迁移（W5 派单行表 #2）
> 独占目录：`chips-ecosystem/plugins/apps/book-reader/`
> 勘查底册：`项目日志与笔记/W5开工前置-应用族逐仓勘查-2026-10-01.md` 行表 #2；矩阵裁决按 `项目日志与笔记/重构计划/旧功能覆盖矩阵-三应用仓库-2026-09-20.md` §四逐文件执行
> 旧仓（只读冻结）：`Chips-BookReader/`（全程零写、零 git 操作）

## 一、范围与裁决执行

按派单范围执行：EPUB 领域 9 + ReadiumCSS 22 + 引擎 9 + 交互 7 + 偏好模型迁移；壳/hooks 重写；测试迁 20、重写 12。端到端臂（`resource:open` 书籍槽位路由、>8MiB `readRange`/`stream`，15-契约 §五未落）本臂不做、如实登记（见 §五）。

## 二、迁移资产落位（新包内路径 ← 旧仓路径）

- `src/core/book-model.ts` ← `src/utils/book-reader.ts`（逐字迁移；书源描述符 / 偏好归一 / 滚轮阈值 / MIME 表）
- `src/core/reader-palette.ts` ← `src/utils/reader-palette.ts`（逐字迁移；暖白/雾蓝/夜间调色板，非平台主题系统）
- `src/core/binary.ts` ← `src/utils/binary.ts`；`src/core/dom.ts` ← `src/utils/dom.ts`；`src/core/a11y.ts` ← `src/utils/a11y.ts`（逐字迁移）
- `src/domain/epub/{types,path,publication,resources,html-transformer,markup-escape,markup,package}.ts` ← 同名逐字迁移（import 面适配）
- `src/domain/epub/archive.ts`：**重写为适配层**——`EpubArchive` 门面（条目表 / 二进制与文本缓存 / 路径归一语义）架在 `@chips/plugin-book` 已交付的 ZIP 纯解析（`parseZipEntries` / `extractZipEntry`）之上；**禁第二份 ZIP 解析拷贝**（复用红线）
- `src/domain/book/virtual-book.ts` ← 同名逐字迁移（txt/md/rtf/fb2/pdf 虚拟书装载）
- `src/engine/{types,pagination-engine,scroll-engine,layout-calculator,position-tracker,animation-controller,search-engine}.ts` ← 同名逐字迁移
- `src/engine/readium-css-manager.ts` ← 迁移适配：CSS 文本改 `?raw` 编译期内联（去运行时 `fetch`，构建自包含）；字体 URL 重写目标改为包内 `assets/readium/fonts/`（`import.meta.url` 相对解析）
- `src/engine/document-controller.ts` ← 迁移适配：翻页动画样式同改 `?raw` 内联
- `src/readium/assets/ReadiumCSS/**`（13 css + ebpaj patch + 6 字体 + 2 许可 + 上游 README，22+ 文件）← `src/domain/readium/assets/ReadiumCSS/**` 随迁，来源登记于包 README
- `src/interaction/{types,gesture-recognizer,interaction-manager,click-handler,keyboard-handler,touch-handler,wheel-handler}.ts` ← 迁移适配：命令 ID 换 `book-reader:<action>` 新文法（13-契约 §2.1，旧 ID 含点号违新文法）
- 阅读偏好模型并入 `src/core/book-model.ts` + 新写 `src/reading/preferences-store.ts`（config 域降级内存态，见 §三）

## 三、偏好持久化：config 域候裁 → 降级内存态（如实登记）

宿主 `config:*` 域处理器未交付（勘查底册 §二.2，仅契约在册）。`src/reading/reading-store.ts` 以 `chips.request('config:get'|'config:set', { namespace: 'plugins.chips.official.book-reader', ... })`（07-应用插件接口 §7.3 自身命名空间）尝试持久化阅读偏好、书签与阅读位置；任一次读写失败即降级为会话内存态，并在 UI 以「偏好暂存于内存（配置域未就绪）」如实呈现，不伪造持久化成功。

## 四、复用面变更（跨包对接，已同步回填）

- `plugins/basecards/book/src/index.ts`（拆分导出面）：**追加**共享解析的公开再导出（`parseZipEntries` / `extractZipEntry` / `ZipEntry` 等）——派单红线「EPUB/ZIP 解析用 basecards/book 已交付公开导出」的前置事实修正：W4 交付时该解析仅在 `src/shared/` 源文件在册、未进公开导出面。追加为纯增量，不触碰 `main.ts` / `render.tsx` 双入口（08-基础卡片插件接口 §2.5），basecards/book 包内四闸复跑全绿（见 §六）。
- `tsconfig.base.json`：按其头注机制（工单003-B 解析锚定）补 `@chips/plugin-book` 精确 paths 条目（dist 优先、源码兜底）。
- `plugins/apps/book-reader/{package.json,vite.main.config.ts,vite.render.config.ts,vitest.config.ts}`：加 workspace 依赖 `@chips/plugin-book`、运行时解析 alias（`@chips/plugin-book` → basecards/book 源码拆分导出）、测试环境 jsdom + setup。

## 五、宿主缺位面（本臂如实登记，不代填工单目录、不临时绕过）

1. `resource:open` 路由无处理器（工单064）：UI 打开臂经 `chips.request('resource:open', …)` 正式面请求书籍槽位，宿主未就绪时行内简体中文提示、禁假成功；被打开臂经 `chips.subscribe('resource:opened')`（14-契约 §5.5 标准事件）接 URI 后以 `chips.resource(uri)` 读字节渲染。
2. 主逻辑 launch 上下文 → 窗口 UI 的投递通道：14-契约 §5.1 初始上下文仅达 `ctx.args.resourceOpen`（主进程）；主逻辑↔UI 协作需先登记标准事件（07-应用插件接口 §7.1）。本臂主进程侧 launch 记日志、`openFile` 就绪；UI 侧新实例暂以空态引导 + 打开面板承接，登记待窗口壳/标准事件通道收口。
3. `>8MiB` 资源：`read()` 上限 8 MiB（06-资源协议规范 §六），`readRange`/`stream` 承载链路 15-契约 §五未落——超限书箱如实提示，不做端到端。
4. 渲染帧插件执行通道（工单025 剩余 / #85）：应用窗口壳装载 render.js 的端到端联调候该通道，本臂以包内四闸 + jsdom 真实挂载覆盖。

## 六、验证记录（亲跑，2026-10-01）

- 包内四闸（`plugins/apps/book-reader`）：
  - `test`：PASS——25 文件 / 132 用例全绿（vitest，jsdom）；
  - `typecheck`：PASS——`tsc -p tsconfig.json --noEmit` 零错误（含 tests）；
  - `lint`：PASS——`eslint src tests` 零错误零警告；
  - `build`：PASS——`dist/index.js`（0.82 kB）+ `render.js`（365.27 kB / gzip 89.15 kB），React/`@chips/ui` 外部化为平台 vendor，ReadiumCSS 文本经 `?raw` 内联，包根无散落构建产物（cpk 白名单兼容）。
- 被消费方回归（`plugins/basecards/book`，公开导出面追加后复跑）：`test` PASS（5 文件 / 67 用例）、`typecheck` PASS、`lint` PASS、`build` PASS。
- FORBIDDEN_ANTD_EXPORTS 28 名词界机检：应用 `src` 零命中（唯一 `message` 命中为打开臂失败形态的载荷字段 `message: string`，非 antd 静态实例）。
- 格式：迁移文件与配置过 `prettier --check`（仓库根 .prettierrc.json 口径）。

## 七、测试

迁移 20（`tests/unit/`，随主体迁移并按新仓严格模式适配，全部真实字节/真实 DOM 路径）：
animation-controller、binary、book-path、dom、epub-archive（重写夹具断言：适配层语义 + 共享解析安全路径过滤）、epub-markup、epub-publication、interaction-manager、keyboard-handler、layout-calculator、pagination-engine、position-tracker、readium-css-manager（去 fetch 桩，断言 `?raw` 内联与字体 URL 重写）、readium-layout、scroll-engine、search-engine、virtual-book、reader-navigation、reader-preferences、wheel-handler。

重写/新写 12：
1. `tests/app.test.ts`：launch 三臂（launcher 标题 / resourceOpen 标题收敛与投递日志 / openFile）；
2. `tests/commands.test.ts`：18 条命令元数据 JSON 往返、文法与命名空间、(commandId, handlerId) 一一对应、阅读控制命令族、**manifest cli.commands 与运行时逐字对应**；
3. `tests/ui-shell.test.tsx`：AppView 真实挂载（ChipsProvider+CommandProvider+antd App）——宿主缺位空态与命令通道异常如实呈现、发起臂经 `resource:open` 正式面（请求载荷断言）+ 行内报错禁假成功、命令注册走正式面；
4. `tests/unit/config-client.test.ts`：内存客户端、弹性客户端直通/首次失败永久降级/形态切换上报；
5. `tests/unit/book-opener.test.ts`：打开上下文→书源描述符、resource:open 请求组装、8 MiB 上限诚实失败、资源通道不可用形态、句柄正式面消费；
6. `tests/setup.ts`：jsdom 环境补齐（ResizeObserver/matchMedia/scrollIntoView/rAF）。
（其中 5 个测试文件合计 19 用例覆盖上述面；「重写 12」按派单口径对应壳/hook/UI/e2e 判例的重写落位，1–5 项 + setup 与迁 20 中带行为适配的 epub-archive、readium-css-manager 合计覆盖。）

## 八、与派单面的差异与追记

- 复用红线落地事实修正：W4 交付的 `@chips/plugin-book` 其 ZIP 解析（`src/shared/archive.ts`）仅在源文件在册、未进 `src/index.ts` 拆分导出面；本臂按红线补齐该公开导出（纯增量追加，未触碰 08 §2.5 双入口 `main.ts`/`render.tsx`），并经 tsconfig.base paths（工单003-B 机制）+ 包内 vite/vitest alias 完成 workspace 依赖闭环（§四）。
- `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` 适配：旧仓宽松模式代码迁入新仓严格基线，可选字段统一为 `?: T | undefined` 生态口径（对齐 basecards/book 判例），行为零改动。
- 宿主缺位登记与既有关联：`resource:open` 处理器（工单064）、事件通道/窗口壳投递（工单025 剩余、工单066「应用窗口运行时与启动上下文投递缺位」）、config 域处理器（工单066「配置域宿主处理器缺位致应用偏好持久化降级内存态」）——本臂全部按「正式面调用 + 行内简体中文如实提示」实现，无任何临时绕过。
