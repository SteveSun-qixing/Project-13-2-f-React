# W5 迁移：万能查看器（chips.official.universal-file-viewer）壳层重写臂开发日志

> 日期：2026-10-01
> 任务：派单行表 #1 壳重写臂——AppView 壳层重写：引擎消费面（格式探测路由→引擎视图挂载）、工具栏/格式信息面板/兜底卡、`resource:open` 请求臂经 @chips/sdk 正式面（宿主处理器未注册时行内简体中文提示，工单060~064 族引用）、命令族按《13-命令系统契约》注册（manifest cli.commands 逐字对应）；测试先测后码（假桥舞台集成+命令锁测，参照 photo-viewer/book-reader 判例）。
> 包：`chips-ecosystem/plugins/apps/universal-file-viewer/`（分支「第五次重构」，全程零 git 写操作；命令一律 `npx -y pnpm@9 <cmd>`；未新增任何依赖故无需安装锁）
> 母型：photo-viewer（AppView/舞台/假桥集成测试形制、usePhotoSession 会话形制）、book-reader（命令族注册与 manifest 锁测形制、setExecutor 执行器注入形制）、旧仓 Chips-UniversalFileViewer 壳层文件（重写裁决件，只读）。

---

## 一、交付清单（壳层文件面）

| 文件 | 判定 | 说明 |
|---|---|---|
| `src/commands/appCommands.ts` | 重写 | 12 条命令族：open-card / refresh-view / previous-file / next-file / zoom-in / zoom-out / zoom-reset / rotate-left / rotate-right / toggle-info / fullscreen / print；可序列化元数据、`(commandId, handlerId)` 配对处理器集合（执行器注入形制） |
| `src/commands/useAppCommands.ts` | 重写 | `command:register`/`command:unregister` + `@chips/ui` 命令运行时 `attach`；`setExecutor` 注入查看场景执行器（book-reader 判例）；Bridge 未就绪收敛 `phase:'error'`，界面不抛错 |
| `src/domain/viewer-target.ts` | 新建 | 《14》§5 消费规则重写面：单资源主投递 + `chips.book-card` image-sequence 载荷建队（§5.3 主版本兼容判定），`uri` 唯一读取入口、relativePath 只作展示 |
| `src/domain/source-loader.ts` | 新建 | 旧 source-loader 重写面：`chips.resource(uri)` 句柄读取（`RESOURCE_TOO_LARGE` 按《15-契约》§五降级 `stream()` 合并）；远程 http(s) 直通引擎；字节构造带 MIME 的 File |
| `src/ui/useViewerSession.ts` | 新建 | 会话状态机：`resource:opened` 订阅消费（过滤 `pluginId`）、装载前 `isPreviewableTarget` 预判、读取/就绪/错误三态、打开臂（dialog:open→resource:open）诚实降级、反馈条自动消退（错误保留须显式处置） |
| `src/ui/EngineStage.tsx` | 新建 | 引擎挂载桥接（旧 EngineViewer 重写面）：`createViewer` 生命周期按 items 重建、`toolbar.render` 通道把 `PreviewToolbarRenderContext` 暴露给壳层 antd 工具栏（引擎内建工具栏仅留隐藏挂载点） |
| `src/ui/ViewerToolbar.tsx` | 新建 | 壳层 antd 工具栏：文件操作/队列导航/缩放旋转（`canCommand` 门控）/页码跳转/搜索/格式信息/打印/全屏；**零 FORBIDDEN 面**（旧仓 ViewerToolbar 的 `InputNumber` 为工单054 禁面，页码跳转改 `Input` + pressEnter） |
| `src/ui/InfoPanel.tsx` | 新建 | 格式信息面板（Drawer）：文件名/格式/MIME/大小/来源/队列位置，全为只读事实呈现 |
| `src/ui/ViewerEmptyState.tsx` | 新建 | 空态：未打开文件的引导页，不伪造查看内容 |
| `src/ui/UnsupportedCard.tsx` | 新建 | 壳层兜底信息卡（《03-查看器设计》§8.4）：格式识别结果 + 「设置→文件打开方式」指引 + 重新尝试打开，不静默失败 |
| `src/ui/engine-stage.css` + `engineStyles.ts` | 新建 | 引擎样式 token 化重建（见 §二）；`?raw` 编译期内联 + 幂等 `<style>` 注入，产物自包含无独立根级 CSS |
| `src/ui/UniversalViewerScene.tsx` / `AppView.tsx` | 重写 | ChipsProvider + CommandProvider + antd App 单次挂载；命令执行器 switch 路由到会话/引擎通道；布局：命令状态条 → 工具栏 → 反馈条 → 舞台（引擎/空态/兜底卡/读取遮罩）→ 信息面板 |
| `manifest.yaml` | 增补 | `cli.commands` 10→12 条（+previous-file/next-file/zoom-in/zoom-out/zoom-reset/rotate-left/rotate-right/toggle-info/fullscreen/print），commandId/title 与运行时注册逐字对应（锁测验证）；`fileAssociations` fallback 层未动（G-1/G-4 维持候裁登记） |
| `src/index.ts`（主进程） | 未动 | launch 窗口标题臂保持引擎臂交付形态 |
| `src/engine/` 43 文件 | **零触达** | 壳层只消费 `src/engine/index.ts` 公开导出（createViewer/isPreviewSupported/18 插件工厂/类型/messages）；grep 复核零改动 |
| 旧仓 `Chips-UniversalFileViewer/` | 零触达 | 只读冻结复核 |

## 二、引擎样式 token 化重建（R4 裁决）

旧引擎 `style.css`（5997 行）不迁移，壳臂按分层裁决重建为 `src/ui/engine-stage.css`（5690 行）：

1. **铬层 → Design Tokens**：`.ofv-root` 头部变量块整体映射到 `--chips-*`（ChipsThemeRoot 以 antd cssVar 模式下发、随主题算法翻转）：bg/surface/text/border/fill 族、accent（colorPrimary 族：`--ofv-accent`/`-strong`/`-soft`/link）、danger（colorError 族）、warning（colorWarning 族）；选中态/focus 环/状态胶囊/链接/空态灰/错误提示全量走 tokens（含 pdf 文本层选区、sheet 页签激活、代码动作按压态等散点色）。
2. **文档保真层保留**（注释声明于文件头）：Office/MSDOC/PPT/XPS 纸张与正文用色（#111827 页文字、#333399 标题蓝、#a6e600 高亮标、#303241 标题条等）、语法高亮配色、思维导图/地图/图表内容色——还原源文档自身用色属内容保真，不随主题翻转（与旧引擎一致）。
3. **舞台恒暗层保留**：媒体/PDF/文本代码/CAD 坐标纸深色舞台为查看器设计常量。
4. **随引擎臂废弃面剔除**：`.ofv-theme-dark` 全部规则（task030 主题系统废弃，暗色由 antd cssVar 翻转承担）、`.ofv-dwg-*`（GPL 链解码已剔除的死样式）、`.ofv-react-toolbar`/`.ofv-vue-toolbar`（上游框架变体死样式）——共剔除 42 条规则，脚本化移植（一次性过程工具，未入仓）后逐项计数校验。
5. **壳层覆写**：`.ofv-toolbar { display:none !important }`（工具栏由壳层 antd 组件承担）。

## 三、构建形态：重依赖分包（工单069 登记）

壳层接入引擎后，沿用 W5 现行 `inlineDynamicImports: true` 单文件形态实测 render.js 达 **19.25 MB**，违反《03-插件包格式》§五「单文件 16 MiB」CPK 硬上限。裁定与处置：

- `vite.render.config.ts` 去除 `inlineDynamicImports`，引擎重依赖经其内部动态 `import()` **自然分包落 `dist/`**（CPK 布局明确允许 dist/ 携带代码文件；`chunkFileNames: 'dist/[name].js'`、`assetFileNames: 'dist/assets/[name][extname]'`）；
- 实测产物：render.js 门面 214 B（同步再导出，不破坏入口契约）+ `dist/` 150 个分包（壳层+引擎核心 4.15 MB；three 1.30 MB、heic2any 1.37 MB、pptx-renderer 2.63 MB、mermaid 族、xlsx 0.78 MB、hls 0.75 MB 等按格式懒加载），**单文件最大 4.15 MB，全部 < 16 MiB**，首屏不载重依赖（RA-08 风险③红线保持）；
- 连带发现 pdf worker `?url` 在分包构建下内联为 data URL（Chromium data-URL Worker 支持面不稳，pdf.js 自退 fake worker 功能不中断）——连同「插件模块相对导入 base URL 语义未定」一并登记**工单069**（与工单066 应用窗口装载波同窗收口），包内零绕过、不自造 loader。

## 四、测试（先测后码）

基线红灯在先（新增用例 12 条先红后绿），最终 `tests/` 7 文件 + 领域 2 文件，包内 **9 文件 83 用例全绿**（引擎臂 59 用例保持 + 壳臂新增 24 用例）：

- `commands.test.ts`（8）：12 命令族 ID/标题锁测、JSON 往返、命名空间/handlerId 文法、唯一性、**manifest cli.commands commandId+title 双逐字对应**、派发配对与归属守卫；
- `viewer-target.test.ts`（7）：单资源投递、展示字段缺失回补、空白 uri 拒绝、图包载荷建队/主资源命中/防御性回退、五类不兼容载荷忽略、无效条目丢弃；
- `source-loader.test.ts`（5）：受管资源字节→File、>8MiB `RESOURCE_TOO_LARGE`→`stream()` 降级合并、远程直通不读字节、读取失败原样抛出、toPreviewItems 映射；
- `stage.test.tsx`（9）：假桥舞台集成（window.chips 注入 IChipsBridge，按已登记能力 ID 回放，不 mock 业务）——空态与打开臂诚实降级（resource:open 未注册时行内「暂时无法打开」，不假成功）、文本投递引擎真实渲染（`.ofv-code-container` + 内容回填 + 格式信息面板回填）、读取失败行内错误+重试恢复、图包载荷队列与工具栏/命令派发双通道切换视图、refresh-view 重新拉取、兜底信息卡与重试、open-card 命令正式面请求、命令通道异常不影响主链路、DWG 命中 CAD 插件壳层不拦截；
- 稳定性：引擎异步渲染链等待从固定轮次改为**条件泵送**（`waitFor` 谓词轮询、单轮短 act），连跑三轮 83/83 全绿；engine-parse 测试按引擎臂 Node 口径补 `@vitest-environment node` 头注（postal-mime 双环境解码路径差异，jsdom 仿真面不构成有效环境）；setup.ts 对 Node 环境零操作。

## 五、验证（亲跑，2026-10-01）

- `test`：**9 文件 83 用例全绿**（连跑 3 轮稳定）；
- `typecheck`：0 错误（`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` 全量生效）；
- `lint`：0 错误 0 警告；
- `build`：`dist/index.js` 0.22 kB + render.js 门面 214 B + `dist/` 150 分包（单文件最大 4.15 MB，0 文件超 16 MiB）；
- FORBIDDEN_ANTD_EXPORTS 词界双验（壳面 src/ui+src/commands+src/domain）：28 名中仅 `message`（16 处，全部为 ViewerFeedback/SessionLoadStatus 反馈文案载荷字段）与 `version`（4 处，全部为《14》§5.3 图包载荷 version 主版本兼容判定字段）两类命中——均为载荷字段误报源，**零 antd 组件触达**；其余 26 名零命中；`antd`/`@chips/antd` 直导零命中（ESLint no-restricted-imports + vite rejectForbiddenImports 双闸在岗）；
- TODO/FIXME 零命中；旧仓与 `src/engine/` 零改动复核（git status 仅壳臂范围文件）；未跑 `gates:all`（按派单约束）。

## 六、边界与后续（候宿主波，不代裁）

1. 端到端「启动即看」候工单066（应用窗口运行时与初始上下文投递）+ 工单060~064（`resource:open` 路由与处理器注册）；
2. render.js 分包/资源装载语义与 pdf worker 资产形态候**工单069**（本臂新登记，随工单066 同波裁定；包内分包形态已就位，裁定后零改动收口）；
3. G-1（Office/PDF 自包含预览 vs `content-office.*` 边界）与 G-4（detect.ts MIME 表生态单一事实源收编）维持候裁登记，本臂未动兜底边界（壳层不复制 MIME 表：打开对话框不设扩展名过滤、引擎内部推断兜底）。
