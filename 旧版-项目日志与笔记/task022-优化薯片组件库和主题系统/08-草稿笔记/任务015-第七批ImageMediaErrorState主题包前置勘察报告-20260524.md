# 任务015第七批 Image / Media / ErrorState 主题包前置勘察报告

> 日期：2026-05-24
> 角色：任务015第七批 `Image / Media / ErrorState` 主题包前置勘察子代理
> 范围：只读勘察默认主题和暗色主题实现模式；本报告仅写入当前草稿文件，不修改组件库、主题包、正式公共文档、任务文档、测试或 package 文件。

## 读取文件

已按要求先读取规则与边界文件：

- `AGENTS.md`
- `ThemePack/AGENTS.md`
- `ThemePack/Chips-default/AGENTS.md`
- `ThemePack/Chips-theme-default-dark/AGENTS.md`
- `生态共用技术文档/AGENTS.md`
- `项目日志与笔记/AGENTS.md`

已按需读取设计、任务与公共规范：

- `生态设计原稿/06-前端多样化和主题系统.md`
- `生态设计原稿/08-开发规范和标准.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务015-组件库基础控件补齐.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务08-SwiftUI对标控件清单与基础控件补齐.md`
- `生态共用技术文档/组件库/02-组件契约标准.md`
- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- `生态共用技术文档/组件库/09-SwiftUI对标基础控件能力矩阵.md`
- `生态共用技术文档/主题系统/01-主题包开发指南.md`
- `生态共用技术文档/开发与运维/04-打包与安装路径手册.md`

已读取默认主题与暗色主题的构建、契约、token、CSS 与测试文件：

- `ThemePack/Chips-default/package.json`
- `ThemePack/Chips-default/manifest.yaml`
- `ThemePack/Chips-default/chips.config.mjs`
- `ThemePack/Chips-default/src/build-tokens.ts`
- `ThemePack/Chips-default/src/build-css.ts`
- `ThemePack/Chips-default/src/validate-theme.ts`
- `ThemePack/Chips-default/tokens/ref.json`
- `ThemePack/Chips-default/tokens/sys.json`
- `ThemePack/Chips-default/tokens/layout.json`
- `ThemePack/Chips-default/tokens/motion.json`
- `ThemePack/Chips-default/tokens/comp/*.json`
- `ThemePack/Chips-default/styles/base.css`
- `ThemePack/Chips-default/styles/components/*.css`
- `ThemePack/Chips-default/contracts/theme-interface.contract.json`
- `ThemePack/Chips-default/contracts/theme-min-functional-set.json`
- `ThemePack/Chips-default/tests/build.spec.ts`
- `ThemePack/Chips-default/tests/contract.spec.ts`
- `ThemePack/Chips-default/tests/tokens.spec.ts`
- `ThemePack/Chips-theme-default-dark/package.json`
- `ThemePack/Chips-theme-default-dark/manifest.yaml`
- `ThemePack/Chips-theme-default-dark/chips.config.mjs`
- `ThemePack/Chips-theme-default-dark/src/build-tokens.ts`
- `ThemePack/Chips-theme-default-dark/src/build-css.ts`
- `ThemePack/Chips-theme-default-dark/src/validate-theme.ts`
- `ThemePack/Chips-theme-default-dark/tokens/ref.json`
- `ThemePack/Chips-theme-default-dark/tokens/sys.json`
- `ThemePack/Chips-theme-default-dark/tokens/layout.json`
- `ThemePack/Chips-theme-default-dark/tokens/motion.json`
- `ThemePack/Chips-theme-default-dark/tokens/comp/*.json`
- `ThemePack/Chips-theme-default-dark/styles/base.css`
- `ThemePack/Chips-theme-default-dark/styles/components/*.css`
- `ThemePack/Chips-theme-default-dark/contracts/theme-interface.contract.json`
- `ThemePack/Chips-theme-default-dark/contracts/theme-min-functional-set.json`
- `ThemePack/Chips-theme-default-dark/tests/build.spec.ts`
- `ThemePack/Chips-theme-default-dark/tests/contract.spec.ts`
- `ThemePack/Chips-theme-default-dark/tests/tokens.spec.ts`
- `ThemePack/Chips-theme-default-dark/tests/dark-theme.spec.ts`

补充读取了相邻能力与校验器：

- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/avatar.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/empty-state.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/error-boundary.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/loading-boundary.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/progress.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础展示控件第一批收口-20260524-0437.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第二批收口-20260524-0517.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第三批输入控件收口-20260524-0605.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第四批选择控件收口-20260524-0650.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第五批A数值输入控件收口-20260524-0725.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第五批B滑块控件收口-20260524-0803.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务015-基础控件第六批日期时间控件收口-20260524-0915.md`

## 现状结论

### 1. 两个主题包当前模式同构

`Chips-default` 与 `Chips-theme-default-dark` 的主题工程结构、构建脚本、校验脚本和测试基线基本同构。

`tokens/comp/*.json` 采用“一组件一文件”模式。当前两个主题包各有 67 个组件 token 文件，文件名与 component scope 对齐，例如 `avatar.json`、`date-picker.json`、`time-picker.json`、`error-boundary.json`。`src/build-tokens.ts` 会读取 `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`，再按文件名排序读取 `tokens/comp/*.json` 并深合并为 `dist/tokens.json` 的五层结构 `{ ref, sys, comp, motion, layout }`。因此第七批应新增 `tokens/comp/image.json`、`tokens/comp/media.json`、`tokens/comp/error-state.json`，不需要修改构建脚本。

`styles/components/*.css` 采用“组件类别分桶”模式。当前两个主题包均有：

- `button.css`：`button / icon-button / toggle-button`
- `display.css`：`text / label / badge / tag / avatar`
- `feedback.css`：`notification / toast / empty-state / skeleton / spinner / progress / error-boundary / loading-boundary / card-cover-frame / composite-card-window`
- `form-controls.css`：`checkbox / radio / switch / select / segmented-control / stepper / slider`
- `input.css`：`input / text-field / text-area / search-field / secure-field / combo-box / number-input`
- `layout-containers.css`：布局、数据与窗口容器类 scope
- `overlays.css`：`dialog / popover / tooltip / command-palette / date-time / date-picker / time-picker`

`src/build-css.ts` 会先注入 Material Symbols `@font-face`，再读取 `styles/base.css`，然后自动读取 `styles/components` 目录下所有 `.css` 文件拼接，最后拼接 `styles/motions.css`，输出 `dist/theme.css`。构建入口不是显式 import 列表，新增或修改 `styles/components/*.css` 后会被自动发现。需要注意脚本没有排序 `componentsDir` 的读取结果；现有工程依赖目录自然顺序，但新增第七批不需要新增构建入口。

`contracts/theme-interface.contract.json` 是主题包当前声明的完整组件 contract view。两个主题包当前都是 67 个 component，条目包含 `component / scope / parts / states / requiredTokens`。新增三组件后，应同步变为 70 个 component。主题本地 `src/validate-theme.ts` 会读取 `dist/tokens.json` 与该 contract，再调用组件库 `packages/theme-contracts/src/validator.js` 的 `buildThemeContractView`，以 required token 缺失为阻断诊断。

`contracts/theme-min-functional-set.json` 当前以 `requiredComponents` 列出 67 个组件，与 `theme-interface.contract.json` 的 component 列表保持一致。新增三组件后也应同步加入 `image / media / error-state`，数量变为 70。

`tests/build.spec.ts` 当前会执行 `npm run build`，再检查 `dist/theme.css` 中包含关键 `data-scope`、若干新增 token 变量和图标字体产物。第七批应补 `data-scope="image"`、`data-scope="media"`、`data-scope="error-state"`，并至少断言一个代表性 CSS 变量，例如 `--chips-comp-image-fallback-surface`、`--chips-comp-media-control-surface-idle`、`--chips-comp-error-state-status-color-error`。

`tests/contract.spec.ts` 当前硬编码：

- `result.contract.components` 长度为 67
- `result.view.summary.coverage.componentCount` 为 67
- `requiredCoverage` 为 1
- 所有 component coverage status 为 `complete`

新增三组件后两个主题包均应将数量调为 70，并继续保留缺失 required token 诊断 schema 的断言。

`tests/tokens.spec.ts` 当前读取 `dist/tokens.json`，检查五层 token 结构存在，并逐项检查任务015前六批新增 token。第七批应补三条或更多断言：

- `parsed.comp.chips?.comp?.image?.fallback?.surface`
- `parsed.comp.chips?.comp?.media?.control?.surface?.idle`
- `parsed.comp.chips?.comp?.["error-state"]?.details?.color`

暗色主题额外有 `tests/dark-theme.spec.ts`，只检查暗色身份、`color-scheme: dark`、暗色 canvas/sys token，不需要因第七批必然修改，但如果第七批引入暗色专用 sys 引用，可按实际情况补充断言。

### 2. 当前第七批 scope 尚未落地

在两个主题包源文件中检索 `image / media / error-state`，只有相邻能力命中：

- `avatar` 已有 `image` part，但不是独立 `image` scope。
- `error-boundary` 和 `empty-state` 是相邻反馈能力，但没有 `error-state` 独立 scope。
- `@media (prefers-reduced-motion: reduce)` 是 CSS 语法命中，不是 `media` scope。

当前两个主题包的 `tokens/comp`、`contracts/theme-interface.contract.json`、`theme-min-functional-set.json`、`styles/components/*.css` 和 tests 均未包含独立 `image / media / error-state`。

### 3. default 与 dark 的取值差异模式

默认主题 `sys` 层较精简：

- `chips.sys.color.surface`
- `chips.sys.color.on-surface`
- `chips.sys.color.primary`
- `chips.sys.color.error`
- `chips.sys.radius.container`
- `chips.sys.icon.*`

暗色主题 `sys` 层更丰富：

- `chips.sys.color.canvas`
- `chips.sys.color.surface`
- `chips.sys.color.surface-raised`
- `chips.sys.color.surface-elevated`
- `chips.sys.color.surface-accent`
- `chips.sys.color.on-surface`
- `chips.sys.color.on-surface-muted`
- `chips.sys.color.on-surface-soft`
- `chips.sys.color.primary / primary-hover / primary-active / primary-contrast`
- `chips.sys.color.focus-ring`
- `chips.sys.color.border-subtle / border-strong`
- `chips.sys.color.shadow`
- `chips.sys.color.error`

两套主题共用 `layout` 与 `motion` 基线：

- `chips.layout.density.compact / comfortable / spacious`
- `chips.layout.gap.xs / sm / md / lg / xl`
- `chips.layout.divider.thickness`
- `chips.layout.focus.outline-width / outline-offset`
- `chips.motion.duration.fast / normal`
- `chips.motion.easing.standard`

因此第七批 token 值应继续引用现有 `sys/layout/motion`，不要硬编码业务色。默认主题可使用较少 sys token，暗色主题优先使用暗色新增的 `surface-raised / surface-elevated / surface-accent / on-surface-muted / focus-ring / border-subtle`。

## 建议 token 与 CSS 放置

### 1. CSS 放置建议

建议不新建 CSS 文件，直接使用现有分桶：

- `image` 放入 `styles/components/display.css`。理由：公共矩阵将 `Image` 归为“文本与图像”，现有 `display.css` 已承载 `text / label / badge / tag / avatar`，其中 `avatar` 已有图片显示与 fallback 样式。
- `media` 放入 `styles/components/display.css`。理由：`Media` 是通用图像/音视频显示边界，和 `Image / Avatar` 同属展示型内容；其 controls 只是媒体组件内部 part，不建议放进 `form-controls.css`，避免和表单选择/数值控件混淆。
- `error-state` 放入 `styles/components/feedback.css`。理由：`ErrorState` 是静态错误展示，和 `empty-state / skeleton / spinner / progress / error-boundary / loading-boundary` 同属反馈类；同时可借鉴 `empty-state` 的结构和 `error-boundary` 的错误色、action、focus 模式，但必须保持独立 scope。

`src/build-css.ts` 会自动读取 `styles/components/*.css`，所以无需修改构建入口。若主线坚持把 `image/media` 单独放入新增 `media.css`，构建也能自动发现；但从现有分桶一致性看，不建议新增文件。

### 2. 建议 contract parts/states

建议第七批在组件库 contract 源和两个主题包 contract view 中保持以下公开结构。

`image`：

- parts：`root / media / fallback / caption / status`
- states：`idle / hover / focus / active / disabled / loading / error`
- 说明：`media` 承载实际 `img` 或图像内容，`fallback` 承载加载失败或无图状态，`caption` 承载说明文本，`status` 承载错误或加载状态。

`media`：

- parts：`root / content / controls / control / caption / status`
- states：`idle / hover / focus / active / disabled / loading / error`
- 说明：`content` 承载音视频或通用媒体内容，`controls` 是控件组，`control` 是单个控制按钮/槽位，主题只管视觉，不绑定播放业务能力。

`error-state`：

- parts：`root / icon / title / description / details / action / status`
- states：`idle / hover / focus / active / disabled / loading / error`
- 说明：静态错误展示，不等同 `error-boundary`；`details` 用于可选技术细节或错误码展示，`action` 用于重试/返回等命令入口视觉。

### 3. 建议 required token key 结构

`image` 推荐 required token：

- `chips.comp.image.root.radius`
- `chips.comp.image.root.surface`
- `chips.comp.image.root.border`
- `chips.comp.image.media.surface`
- `chips.comp.image.media.fit`
- `chips.comp.image.fallback.surface`
- `chips.comp.image.fallback.color`
- `chips.comp.image.caption.color`
- `chips.comp.image.status.color.loading`
- `chips.comp.image.status.color.error`
- `chips.comp.image.focus.outline`

`media` 推荐 required token：

- `chips.comp.media.root.radius`
- `chips.comp.media.root.surface`
- `chips.comp.media.root.border`
- `chips.comp.media.content.surface`
- `chips.comp.media.controls.surface`
- `chips.comp.media.control.surface.idle`
- `chips.comp.media.control.surface.hover`
- `chips.comp.media.control.surface.active`
- `chips.comp.media.control.color.idle`
- `chips.comp.media.control.color.disabled`
- `chips.comp.media.caption.color`
- `chips.comp.media.status.color.loading`
- `chips.comp.media.status.color.error`
- `chips.comp.media.focus.outline`

`error-state` 推荐 required token：

- `chips.comp.error-state.root.surface`
- `chips.comp.error-state.root.border.error`
- `chips.comp.error-state.icon.color`
- `chips.comp.error-state.title.color`
- `chips.comp.error-state.description.color`
- `chips.comp.error-state.details.color`
- `chips.comp.error-state.action.surface.idle`
- `chips.comp.error-state.action.surface.hover`
- `chips.comp.error-state.action.surface.active`
- `chips.comp.error-state.action.color`
- `chips.comp.error-state.status.color.error`
- `chips.comp.error-state.focus.outline`

以上 key 结构覆盖了用户指定的分组：

- image：`root / media / fallback / caption / status / focus`
- media：`root / content / controls / control / caption / status / focus`
- error-state：`root / icon / title / description / details / action / status / focus`

### 4. default 主题 token 值建议

默认主题建议保持精简 sys/layout/motion 引用：

`image`：

- `root.radius` -> `{chips.sys.radius.container}`
- `root.surface` -> `{chips.sys.color.surface}`
- `root.border` -> `{chips.sys.color.primary}` 或如主线新增更细 border token，则回到公共 sys；不要直接写业务边框色。
- `media.surface` -> `{chips.sys.color.surface}`
- `media.fit` -> `cover` 或由组件运行时通过属性决定；若进入 token，保持非业务语义值。
- `fallback.surface` -> `{chips.sys.color.surface}`
- `fallback.color` -> `{chips.sys.color.on-surface}`
- `caption.color` -> `{chips.sys.color.on-surface}`
- `status.color.loading` -> `{chips.sys.color.primary}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.primary}`

`media`：

- `root.radius` -> `{chips.sys.radius.container}`
- `root.surface` -> `{chips.sys.color.surface}`
- `root.border` -> `{chips.sys.color.primary}`
- `content.surface` -> `{chips.sys.color.surface}`
- `controls.surface` -> `{chips.sys.color.surface}`
- `control.surface.idle` -> `{chips.sys.color.surface}`
- `control.surface.hover` -> `{chips.sys.color.primary}`
- `control.surface.active` -> `{chips.sys.color.primary}`
- `control.color.idle` -> `{chips.sys.color.on-surface}`
- `control.color.disabled` -> `{chips.sys.color.on-surface}`
- `caption.color` -> `{chips.sys.color.on-surface}`
- `status.color.loading` -> `{chips.sys.color.primary}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.primary}`

`error-state`：

- `root.surface` -> `{chips.sys.color.surface}`
- `root.border.error` -> `{chips.sys.color.error}`
- `icon.color` -> `{chips.sys.color.error}`
- `title.color` -> `{chips.sys.color.on-surface}`
- `description.color` -> `{chips.sys.color.on-surface}`
- `details.color` -> `{chips.sys.color.on-surface}`
- `action.surface.idle` -> `{chips.sys.color.surface}`
- `action.surface.hover` -> `{chips.sys.color.primary}`
- `action.surface.active` -> `{chips.sys.color.primary}`
- `action.color` -> `{chips.sys.color.on-surface}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.primary}`

CSS 中尺寸、间距、焦点线宽、过渡应继续引用：

- `var(--chips-layout-gap-xs/sm/md)`
- `var(--chips-layout-density-compact/comfortable)`
- `var(--chips-base-layout-focus-outline-width)`
- `var(--chips-base-layout-focus-outline-offset)`
- `var(--chips-motion-duration-fast)`
- `var(--chips-motion-easing-standard)`

### 5. dark 主题 token 值建议

暗色主题建议利用其更丰富的 sys token，避免简单复制默认主题：

`image`：

- `root.radius` -> `{chips.sys.radius.container}`
- `root.surface` -> `{chips.sys.color.surface-raised}`
- `root.border` -> `{chips.sys.color.border-subtle}`
- `media.surface` -> `{chips.sys.color.surface}`
- `fallback.surface` -> `{chips.sys.color.surface}`
- `fallback.color` -> `{chips.sys.color.on-surface-muted}`
- `caption.color` -> `{chips.sys.color.on-surface-muted}`
- `status.color.loading` -> `{chips.sys.color.primary}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.focus-ring}`

`media`：

- `root.radius` -> `{chips.sys.radius.container}`
- `root.surface` -> `{chips.sys.color.surface-raised}`
- `root.border` -> `{chips.sys.color.border-subtle}`
- `content.surface` -> `{chips.sys.color.surface}`
- `controls.surface` -> `{chips.sys.color.surface-elevated}`
- `control.surface.idle` -> `{chips.sys.color.surface}`
- `control.surface.hover` -> `{chips.sys.color.surface-accent}`
- `control.surface.active` -> `{chips.sys.color.primary-active}`
- `control.color.idle` -> `{chips.sys.color.on-surface}`
- `control.color.disabled` -> `{chips.sys.color.on-surface-soft}`
- `caption.color` -> `{chips.sys.color.on-surface-muted}`
- `status.color.loading` -> `{chips.sys.color.primary}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.focus-ring}`

`error-state`：

- `root.surface` -> `{chips.sys.color.surface-raised}`
- `root.border.error` -> `{chips.sys.color.error}`
- `icon.color` -> `{chips.sys.color.error}`
- `title.color` -> `{chips.sys.color.on-surface}`
- `description.color` -> `{chips.sys.color.on-surface-muted}`
- `details.color` -> `{chips.sys.color.on-surface-soft}`
- `action.surface.idle` -> `{chips.sys.color.surface}`
- `action.surface.hover` -> `{chips.sys.color.surface-accent}`
- `action.surface.active` -> `{chips.sys.color.primary-active}`
- `action.color` -> `{chips.sys.color.on-surface}`
- `status.color.error` -> `{chips.sys.color.error}`
- `focus.outline` -> `{chips.sys.color.focus-ring}`

同样建议在 CSS 中使用 `layout` 和 `motion` token 表达结构与动效，不在 CSS 写私有业务尺寸。现有主题 CSS 里仍有少量 `font-size: 13px`、`outline: 1px` 等历史写法；第七批可以优先沿用 `--chips-base-layout-focus-outline-width`、`--chips-layout-gap-*`，不要继续扩大硬编码。

## 测试与构建更新清单

### 1. default 主题需要手动改的源文件

建议主线实现阶段手动修改：

- `ThemePack/Chips-default/tokens/comp/image.json`
- `ThemePack/Chips-default/tokens/comp/media.json`
- `ThemePack/Chips-default/tokens/comp/error-state.json`
- `ThemePack/Chips-default/styles/components/display.css`
- `ThemePack/Chips-default/styles/components/feedback.css`
- `ThemePack/Chips-default/contracts/theme-interface.contract.json`
- `ThemePack/Chips-default/contracts/theme-min-functional-set.json`
- `ThemePack/Chips-default/tests/build.spec.ts`
- `ThemePack/Chips-default/tests/contract.spec.ts`
- `ThemePack/Chips-default/tests/tokens.spec.ts`

### 2. dark 主题需要手动改的源文件

建议主线实现阶段手动修改：

- `ThemePack/Chips-theme-default-dark/tokens/comp/image.json`
- `ThemePack/Chips-theme-default-dark/tokens/comp/media.json`
- `ThemePack/Chips-theme-default-dark/tokens/comp/error-state.json`
- `ThemePack/Chips-theme-default-dark/styles/components/display.css`
- `ThemePack/Chips-theme-default-dark/styles/components/feedback.css`
- `ThemePack/Chips-theme-default-dark/contracts/theme-interface.contract.json`
- `ThemePack/Chips-theme-default-dark/contracts/theme-min-functional-set.json`
- `ThemePack/Chips-theme-default-dark/tests/build.spec.ts`
- `ThemePack/Chips-theme-default-dark/tests/contract.spec.ts`
- `ThemePack/Chips-theme-default-dark/tests/tokens.spec.ts`

`ThemePack/Chips-theme-default-dark/tests/dark-theme.spec.ts` 可不改，除非主线决定增加第七批暗色专属断言。

### 3. tests 数量与断言更新

当前两个主题包：

- `contracts/theme-interface.contract.json`：67 components
- `contracts/theme-min-functional-set.json`：67 requiredComponents
- `tests/contract.spec.ts`：断言 67 components

新增 `image / media / error-state` 后应调为：

- `contracts/theme-interface.contract.json`：70 components
- `contracts/theme-min-functional-set.json`：70 requiredComponents
- `tests/contract.spec.ts`：`toHaveLength(70)`，`coverage.componentCount` 为 70

建议新增断言：

`tests/build.spec.ts`：

- `themeCss` 包含 `data-scope="image"`
- `themeCss` 包含 `data-scope="media"`
- `themeCss` 包含 `data-scope="error-state"`
- `themeCss` 包含 `--chips-comp-image-fallback-surface`
- `themeCss` 包含 `--chips-comp-media-control-surface-idle`
- `themeCss` 包含 `--chips-comp-error-state-status-color-error`

`tests/tokens.spec.ts`：

- `parsed.comp.chips?.comp?.image?.root?.surface` 存在
- `parsed.comp.chips?.comp?.image?.fallback?.color` 存在
- `parsed.comp.chips?.comp?.media?.content?.surface` 存在
- `parsed.comp.chips?.comp?.media?.control?.color?.idle` 存在
- `parsed.comp.chips?.comp?.["error-state"]?.root?.border?.error` 存在
- `parsed.comp.chips?.comp?.["error-state"]?.details?.color` 存在
- `parsed.comp.chips?.comp?.["error-state"]?.focus?.outline` 存在

`tests/contract.spec.ts`：

- 数量 70
- 可选增加 `image/media/error-state` 三个 component 均存在且 coverage `complete`
- 缺失 required token 的 diagnostic schema 测试可以继续沿用 `button`，不必改 token key。

### 4. 构建产物与不要手动改的文件

`npm run build` 会自动生成：

- `ThemePack/Chips-default/dist/tokens.json`
- `ThemePack/Chips-default/dist/theme.css`
- `ThemePack/Chips-default/dist/icons/variablefont/*.woff2`
- `ThemePack/Chips-theme-default-dark/dist/tokens.json`
- `ThemePack/Chips-theme-default-dark/dist/theme.css`
- `ThemePack/Chips-theme-default-dark/dist/icons/variablefont/*.woff2`

正式 `manifest.yaml` 的 `entry.tokens` 和 `entry.themeCss` 指向 `dist/tokens.json` 与 `dist/theme.css`。Host Theme Runtime 只消费 `dist/` 中的正式产物，不直接读取源目录 `tokens/` 或 `styles/`。

`.cpk-stage` 当前存在，并且包含 token、contract、根级 `theme.css` 等打包快照；但本轮勘察确认主题包 `npm run build` 不会自动更新 `.cpk-stage`。前六批工作日志显示主线曾同步 `.cpk-stage` 与根级 `theme.css` 快照，但公共打包文档当前推荐的正式链路是 `npm run build` 后用 `chipsdev package` 收集 `manifest.entry`、`ui.layout.contract`、`ui.layout.minFunctionalSet` 等正式资源生成 `.cpk`。

因此第七批主线建议：

- 必须手动改源 token、源 CSS、源 contract、源 min functional set、测试。
- 必须运行 `npm run build` 生成 `dist/tokens.json` 与 `dist/theme.css`。
- 不要手写 `dist/tokens.json` 或 `dist/theme.css`。
- 不要把根级 `theme.css` 当作构建入口；当前 `build-css.ts` 不读取它。
- 不要手写 `.cpk` 包。
- `.cpk-stage` 是否同步应由主线根据当前仓库发布口径统一决定；若仍要求保留快照一致性，应在构建后按正式产物同步，不能把 `.cpk-stage` 当源头修改。

### 5. 建议验证命令

第七批主题侧完成后建议至少运行：

```bash
cd ThemePack/Chips-default
npm run build
npm run validate:theme
npm test

cd ../Chips-theme-default-dark
npm run build
npm run validate:theme
npm test
```

若主线同时改组件库，应继续运行：

```bash
cd Chips-ComponentLibrary
npm run verify
npm run quality:gate
```

## 风险与工单判断

### 1. 风险

`ErrorState` 与 `ErrorBoundary` 容易混淆。主题侧必须新增独立 `error-state` token/CSS/contract，不应复用 `error-boundary` 作为正式入口。`ErrorBoundary` 是捕获渲染错误的边界组件，`ErrorState` 是可直接渲染的静态错误展示组件。

`Image` 与 `Avatar` 的 `image` part 也容易混淆。`avatar` 里的 `image` 只是头像内部 part，不等同独立 `image` scope；第七批应新增独立 `image` scope。

`Media` 的 controls 只能表达视觉结构，不能在主题包里绑定音视频播放、资源读取或 Host 模块能力。主题包不应加入运行时行为补丁。

`build-css.ts` 当前读取 `styles/components` 时没有排序。新增 CSS 不需要改构建脚本；但如果未来不同 CSS 文件之间出现同选择器覆盖关系，目录读取顺序可能成为隐性风险。本批建议不新增 CSS 文件，降低顺序不确定性。

当前 `.cpk-stage` 与根级 `theme.css` 是快照性质，不是正式构建源。前六批有同步这些快照的记录，但公共文档强调正式产物是 `dist/tokens.json` 与 `dist/theme.css`，打包由 `chipsdev package` 完成。第七批主线若继续同步 `.cpk-stage`，应明确这是发布快照同步，不要手动从 `.cpk-stage` 反向改源文件。

### 2. 工单判断

本次只读勘察未发现阻断第七批主题包实现的新增架构缺口。

理由：

- `tokens/comp/*.json` 已有自动合并机制，新组件新增文件即可进入 `dist/tokens.json`。
- `styles/components/*.css` 已有自动拼接机制，不需要构建入口改造。
- `contracts/theme-interface.contract.json` 与 `theme-min-functional-set.json` 已有明确同步模式。
- `src/validate-theme.ts` 已接入组件库统一 `ThemeContractView` validator。
- `tests/build.spec.ts`、`tests/contract.spec.ts`、`tests/tokens.spec.ts` 已覆盖 build、contract、token 三个关键面，新增三组件只需扩展断言和数量。

结论：无需登记新工单，可以直接进入第七批实现；实现时按现有前六批模式同步组件库、组件 contract、组件 token、默认主题、暗色主题、公共文档和测试。
