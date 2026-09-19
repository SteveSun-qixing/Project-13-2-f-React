# 任务020：默认主题包 Token 与 Contract 升级预研报告

> 预研日期：2026-05-24
> 子代理边界：只做勘察与报告；未修改 `ThemePack/Chips-default`、`Chips-ComponentLibrary`、`Chips-Host` 等主线代码。
> 当前 worktree：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048`
> 当前分支：`task022-优化薯片组件库和主题系统`

## 0. 结论摘要

`ThemePack/Chips-default` 当前已经具备任务020的主要基础：`manifest.yaml` 指向 `dist/tokens.json` 与 `dist/theme.css`，源码中有五层 token、70 个组件 token 文件、本地 70 组件 contract、Material Symbols 三套 variable font，`npm run validate:theme` 可以通过并报告 `70 components, 630 required tokens`。

但从任务020验收标准看，仍有两个核心缺口：

- 默认主题包 contract 仍以 `ThemePack/Chips-default/contracts/theme-interface.contract.json` 这份本地复制文件作为运行时/校验输入；它与组件库正式 contract 目前等值，但还不是“组件库公开 contract/token 清单为唯一来源”的生成链路。
- CSS 视觉覆盖不完整：70 个 contract scope 中，`toolbar`、`menu-bar`、`context-menu`、`shortcut` 已在组件库真实组件中输出 `data-scope`，也有 token/contract，但 `ThemePack/Chips-default/dist/theme.css` 没有这些 scope 的样式选择器。

本轮仅运行只读校验与代码查看。未运行会重写产物或质量报告的命令，例如 `npm run build`、`npm test`、`npm run quality:gate`。

## 1. 当前默认主题包结构和脚本真实现状

### 1.1 已阅读约束与任务文档

已按要求阅读：

- `AGENTS.md`
- `ThemePack/AGENTS.md`
- `ThemePack/Chips-default/AGENTS.md`
- `生态共用技术文档/AGENTS.md`
- `项目日志与笔记/AGENTS.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务020-默认主题包Token与Contract升级.md`
- `生态设计原稿/06-前端多样化和主题系统.md`
- `生态设计原稿/19-SDK与协议.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务14-主题系统与组件Contract治理.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`
- `生态共用技术文档/组件库/02-组件契约标准.md`
- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- `生态共用技术文档/组件库/11-焦点键盘与A11y交互模型.md`

任务020的重点不是新增一套主题协议，而是把默认浅色主题升级为组件库扩容后的可验证基线，并让主题包 contract 校验读取组件库正式契约清单。

### 1.2 manifest 现状

`ThemePack/Chips-default/manifest.yaml` 的关键字段：

- `type: "theme"`
- `entry.tokens: "dist/tokens.json"`
- `entry.themeCss: "dist/theme.css"`
- `themeId: "chips-official.default-theme"`
- `isDefault: true`
- `ui.layout.contract: ./contracts/theme-interface.contract.json`
- `ui.layout.minFunctionalSet: ./contracts/theme-min-functional-set.json`

这与 Host 侧解析逻辑对得上：`Chips-Host/src/runtime/plugin-runtime.ts` 要求主题 manifest 提供 `entry.tokens` 与 `entry.themeCss`，并读取 `ui.layout.contract` 作为主题 contract 路径。

### 1.3 package scripts 现状

`ThemePack/Chips-default/package.json`：

- `build:tokens`: `tsx src/build-tokens.ts`
- `build:css`: `tsx src/build-css.ts`
- `build`: `npm run build:tokens && npm run build:css`
- `validate:theme`: `tsx src/validate-theme.ts`
- `test`: `vitest run`

未引入运行时第三方依赖；devDependencies 只有 `@types/node`、`tsx`、`typescript`、`vitest`。

### 1.4 tokens、contracts、styles、dist 现状

源码结构：

- `tokens/ref.json`
- `tokens/sys.json`
- `tokens/motion.json`
- `tokens/layout.json`
- `tokens/comp/*.json`：当前 70 个组件 token 文件
- `contracts/theme-interface.contract.json`：当前 70 个组件条目
- `contracts/theme-min-functional-set.json`：当前 70 个 required component
- `styles/base.css`
- `styles/motions.css`
- `styles/components/*.css`：当前 7 个组件 CSS 文件
- `icons/variablefont/*.woff2`：三套 Material Symbols variable font

构建产物：

- `dist/tokens.json`
- `dist/theme.css`
- `dist/icons/variablefont/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2`
- `dist/icons/variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2`
- `dist/icons/variablefont/MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2`

对 `dist/tokens.json` 的统计结果：

- `ref`: 26 keys
- `sys`: 11 keys
- `motion`: 3 keys
- `layout`: 26 keys
- `comp`: 630 keys
- total: 696 keys

`dist/theme.css` 的统计结果：

- 文件大小：112965 bytes
- `@font-face`: 3 个
- `:root` block: 1 个
- CSS 自定义属性声明：15 个，主要是 `--chips-base-*` 派生变量
- `data-scope` 覆盖：66 个 scope

注意：`dist/theme.css` 当前不是完整 token 变量表。真正的 696 个 token 变量由 Host 的 `theme.resolve` 结果注入到 DOM 根节点、卡片 iframe 或箱子布局文档中。

### 1.5 build-tokens 现状

`ThemePack/Chips-default/src/build-tokens.ts`：

- 读取 `tokens/ref.json`、`sys.json`、`motion.json`、`layout.json`
- 读取 `tokens/comp/` 下所有 `*.json`
- 按文件名排序合并组件层
- 输出 `{ ref, sys, comp, motion, layout }` 到 `dist/tokens.json`

当前脚本只负责合并与写出，不负责：

- 与组件库 token source 比对
- 校验 token 引用是否存在
- 校验 contract required token 是否被 CSS 使用

### 1.6 build-css 现状

`ThemePack/Chips-default/src/build-css.ts`：

- 内置三套图标字体文件名
- 校验源字体存在
- 复制字体到 `dist/icons/variablefont/`
- 生成三段 `@font-face`
- 拼接 `styles/base.css`、`styles/components/*.css`、`styles/motions.css`
- 输出 `dist/theme.css`

风险点：`styles/components` 当前使用 `fs.readdir()` 返回顺序直接拼接，没有 `.sort()`。主题包内部文档 `技术文档/03- CSS与组件对接规范.md` 写的是按文件名排序，但真实代码没有保证排序。任务020实施时建议补齐排序，保证构建确定性。

### 1.7 validate-theme 现状

`ThemePack/Chips-default/src/validate-theme.ts`：

- 读取 `dist/tokens.json`
- 读取 `contracts/theme-interface.contract.json`
- 通过正则读取 `manifest.yaml` 中 `themeId` 与 `version`
- 动态 import `../../Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`
- 调用 `buildThemeContractView(...)`
- 若 `summary.blocking > 0`，输出 JSON 诊断并设置 `process.exitCode=1`

它已经复用组件库 validator 的诊断 schema，但 contract 输入仍是默认主题包本地文件，而不是直接由组件库正式 contract 目录生成或加载。

### 1.8 测试现状

`ThemePack/Chips-default/tests/contract.spec.ts`：

- 调用 `validateTheme()`
- 硬编码断言 70 个组件、70 个 coverage component、required 覆盖率 1
- 读取 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components`，逐组件比对 `component/scope/parts/states/requiredTokens/optionalTokens`
- 验证缺失 required token 时的 `THEME_REQUIRED_TOKEN_MISSING` 诊断 schema

`ThemePack/Chips-default/tests/tokens.spec.ts`：

- 读取 `dist/tokens.json`
- 验证五层结构
- 手工枚举一批关键组件 token 存在性

`ThemePack/Chips-default/tests/build.spec.ts`：

- 测试中执行 `npm run build`
- 检查 `dist/theme.css` 包含 Material Symbols、部分 `data-scope` 和 token 引用
- 检查三套字体进入 `dist/icons/variablefont/`

`ThemePack/Chips-default/tests/layout-primitives.spec.ts`：

- 检查布局原语 scope 与 layout token 引用
- 检查部分硬编码布局值未出现在布局 CSS 中

测试基础较好，但目前没有自动化断言“每个 contract scope 都必须在 CSS 中出现”。因此 `toolbar/menu-bar/context-menu/shortcut` 的 CSS 缺口未被测试捕获。

## 2. 与任务020验收标准的差距清单

### P0：会直接影响任务020验收

1. 默认主题包 contract 仍是本地复制源，不是组件库正式 contract 清单的生成产物。
   - 证据：`ThemePack/Chips-default/src/validate-theme.ts` 读取 `contracts/theme-interface.contract.json`；`manifest.yaml` 也把 Host 运行时 contract 指向这份本地文件。
   - 当前状态：`node scripts/validate-official-theme-contracts.mjs` 证明本地文件与组件库正式 contract 目前等值。
   - 缺口：任务020明确要求“组件 contract 校验升级为读取组件库正式契约清单，不再维护局部最小 token 列表”。本地文件仍可能漂移，应该改成由 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json` 生成或在构建时校验生成文件。

2. CSS 没有覆盖全部公开 component scope。
   - 证据：对 `ThemePack/Chips-default/contracts/theme-interface.contract.json` 与 `dist/theme.css` 的 `data-scope` 比对结果为：contract scopes 70，CSS scopes 66。
   - 缺失 CSS scope：`context-menu`、`menu-bar`、`shortcut`、`toolbar`。
   - 组件库真实输出这些 scope：`Chips-ComponentLibrary/packages/components/src/index.js` 中 `ChipsToolbar`、`ChipsMenuBar`、`ChipsContextMenu`、`ChipsShortcut` 均输出对应 `data-scope/data-part`。
   - 影响：contract/token 覆盖校验通过，但默认主题下这些命令消费组件没有正式视觉实现，不能满足“所有组件在默认主题下无硬编码视觉依赖、无缺失 CSS 变量、无浅色专属临时样式”。

3. 组件库 token 包不是完整公共 token 唯一来源。
   - 证据：`Chips-ComponentLibrary/packages/tokens/tokens/sys.json` 只有 `chips.sys.color.*` 与 `chips.sys.radius.container`；`ThemePack/Chips-default/tokens/sys.json` 额外提供 `chips.sys.icon.color/size/fill/wght/grad/opsz`。
   - 公共文档 `生态共用技术文档/主题系统/03-图标与字体系统设计规范.md` 已把 `chips.sys.icon.*` 列为正式图标 token。
   - 影响：默认主题包可通过校验，但“新增 token 必须先进入组件库 token 与公共文档”的路径未完全收口。任务020应先把这些 public sys token 同步到 `Chips-ComponentLibrary/packages/tokens`，再让主题包消费。

### P1：高风险，建议任务020同阶段处理

1. CSS token 使用覆盖没有门禁。
   - 证据：630 个 requiredTokens 中有 53 个 token key 没有在 `dist/theme.css` 文本中出现，其中包含全部 `toolbar/menu-bar/context-menu/shortcut` required token。
   - 说明：不是每个 required token 都必须逐字出现在 CSS 中，部分 token 可被运行时变量或继承间接消费；但目前没有“有意不引用”的白名单或 contract-to-CSS 覆盖规则。
   - 建议：新增 CSS 覆盖测试：至少每个 component scope 必须出现；每个 required token 要么被 CSS 使用，要么在 contract 中降为 optional，要么在公共规范中声明运行时消费路径。

2. `build-css.ts` 拼接顺序不稳定。
   - 证据：真实代码对 `fs.readdir(componentsDir)` 的结果直接遍历，没有排序；内部文档声称按文件名排序。
   - 影响：CSS 级联依赖顺序可能因文件系统顺序产生不可重复输出。

3. ThemePack 直接 import 组件库源码路径，而不是稳定包入口。
   - 证据：`src/validate-theme.ts` 动态 import `../../Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`。
   - 建议：让 `@chips/theme-contracts` 暴露稳定 public API，例如 `loadComponentContracts`、`buildThemeInterfaceContract`、`buildThemeContractView`；ThemePack 通过 workspace/package 入口消费，不直接耦合源码路径。

4. Host 主题 contract guard 与组件库 validator 存在重复实现。
   - 证据：`Chips-Host/src/main/theme-runtime/contract-guard.ts` 自己实现 required/optional token normalize、coverage、diagnostics、contract view；组件库 `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js` 也实现同类逻辑。
   - 当前风险：两者当前 schema 基本一致，但后续 a11y/motion constraints 或诊断字段扩展时容易漂移。
   - 建议：Host 至少增加与 `@chips/theme-contracts` 的 golden schema 对照测试；如果运行时依赖边界允许，再共享 validator 包。

5. `theme.getAllCss` 只返回主题 CSS，不包含完整 token 变量声明。
   - 证据：`Chips-Host/src/main/services/register-host-services.ts` 的 `theme.getAllCss` 返回 `context.css`；变量来自 `theme.resolve`。preload 会同时调用 `theme.getAllCss` 与 `theme.resolve` 并注入变量。
   - 当前 Host 内部链路可用；风险在第三方或插件若只调用 `theme.getAllCss`，会拿到大量 `var(--chips-...)` 引用但没有变量定义。
   - 建议：公共接口文档明确 `theme.getAllCss + theme.resolve` 的组合消费模型，或由 Host 提供包含变量声明的完整 CSS variant。

6. 主题矩阵快照尚未落地。
   - 证据：`ThemePack/Chips-default/preview/README.md` 写明当前模板未内置图片文件；目录下只有 README。
   - 任务020要求补充浅色主题在应用插件、基础卡片、箱子布局、模块配置面板中的表现快照。

### P2：清理与文档同步

1. 主题包内部技术文档存在过期信息。
   - `ThemePack/Chips-default/技术文档/04- 测试策略与质量门禁设计.md` 仍写 contract 覆盖 46 个正式组件，真实已经是 70 个。
   - `ThemePack/Chips-default/技术文档/03- CSS与组件对接规范.md` 写 `build-css.ts` 按文件名排序，真实代码未排序。

2. 生态公共主题文档存在历史模板口径。
   - `生态共用技术文档/主题系统/01-主题包开发指南.md` 仍有 `tokens/global.css`、`semantic.css`、`components/`、`animations/`、Style Dictionary 示例等历史/推荐口径；真实默认主题包采用 `tokens/ref.json/sys.json/motion.json/layout.json/comp/*.json` 与自有 TS 构建脚本。
   - 该文档同时引用 Zag.js / Ark UI / Style Dictionary，但当前默认主题包未使用这些依赖。任务020更新文档时应避免把未实际采用的工具写成强制实现。

3. `tests/contract.spec.ts` 仍硬编码 70。
   - 当前可读性尚可，但更稳妥的方式是从组件库正式 contract 目录导出 expected count，避免每次新增/归档组件都要同步改硬编码。

4. `theme-min-functional-set.json` 与 interface contract 当前等值，但缺少本地脚本门禁。
   - 本轮手动比对结果：interface components 70，min requiredComponents 70，missing/extra 均为 0。
   - 建议任务020把该比对纳入 `validate:theme` 或 Vitest。

## 3. 组件库公开 contract/token 清单如何成为主题包校验唯一来源

### 3.1 现有源码位置

组件 contract 的当前正式来源：

- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json`
- `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`
- `Chips-ComponentLibrary/scripts/validate-theme-contracts.mjs`
- `Chips-ComponentLibrary/scripts/validate-official-theme-contracts.mjs`

组件 token 的当前来源：

- `Chips-ComponentLibrary/packages/tokens/tokens/ref.json`
- `Chips-ComponentLibrary/packages/tokens/tokens/sys.json`
- `Chips-ComponentLibrary/packages/tokens/tokens/motion.json`
- `Chips-ComponentLibrary/packages/tokens/tokens/layout.json`
- `Chips-ComponentLibrary/packages/tokens/tokens/comp/*.json`
- `Chips-ComponentLibrary/packages/tokens/src/token-utils.js`
- `Chips-ComponentLibrary/scripts/build-tokens.mjs`
- `Chips-ComponentLibrary/scripts/validate-tokens.mjs`

组件实现侧还有一份事实清单：

- `Chips-ComponentLibrary/packages/components/src/index.js`
  - `COMPONENT_TOKEN_MAP` 附近包含 component -> token 列表
  - component metadata 附近包含 `component/scope/parts/states`
  - 命令消费组件实际输出 `toolbar/menu-bar/context-menu/shortcut` 的 `data-scope/data-part`

### 3.2 建议的唯一来源模型

建议把来源职责分成两层：

- Contract 唯一来源：`@chips/theme-contracts/contracts/components/*.contract.json`
  - 定义 `component/scope/parts/states/requiredTokens/optionalTokens/a11yConstraints/motionConstraints`
  - 生成 `ThemeContractView`
  - 生成官方主题包的 `theme-interface.contract.json`
  - 生成官方主题包的 `theme-min-functional-set.json`

- Token key/value 基线来源：`@chips/tokens/tokens/*`
  - 定义 public token key namespace 和默认语义值
  - `ThemePack/Chips-default` 可以覆盖具体视觉值，但不能新增未进入 public token 包的跨生态 token
  - `scripts/validate-tokens.mjs` 不应继续维护硬编码 requiredPrefixes，应从 contract 目录和 public layer 基线导出 required token prefixes/key 集合

### 3.3 建议改造点

1. 在 `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js` 增加稳定 API：
   - `loadComponentContracts(contractDir?)`
   - `buildThemeInterfaceContract(components, options)`
   - `buildThemeMinFunctionalSet(components)`
   - `compareThemeInterfaceContract(themeContract, componentContracts)`

2. 在 `ThemePack/Chips-default` 增加 contract 生成/校验脚本：
   - 从组件库 contract 目录生成 `contracts/theme-interface.contract.json`
   - 同步生成 `contracts/theme-min-functional-set.json`
   - `validate:theme` 先读取组件库正式 contract，再校验本地 manifest 指向的 contract 是否为生成结果
   - 保留本地 contract 文件作为打包给 Host 的运行时产物，但不再人工维护

3. 在 `Chips-ComponentLibrary/scripts/validate-official-theme-contracts.mjs` 保留官方主题等值门禁，并扩展到：
   - minFunctionalSet 等值
   - optionalTokens 等值
   - a11yConstraints/motionConstraints 等值

4. 在 `Chips-ComponentLibrary/packages/tokens` 中同步 `chips.sys.icon.*`。
   - 当前 public docs 已要求 `chips.sys.icon.color/size/fill/wght/grad/opsz`
   - 默认主题包已有这些 token，但组件库 token source 没有
   - 任务020应先收口到 public token 包，再由主题包消费

5. Host 运行时保留读取主题包内 `contracts/theme-interface.contract.json` 的机制。
   - 原因：Host 安装的是主题包，不能在用户运行时依赖开发工作区的组件库源码目录。
   - 但这份 contract 文件必须由组件库正式 contract 生成，并在主题包发布前通过等值门禁。

## 4. Host 主题服务读取与注入链路现状证据与风险

### 4.1 读取链路证据

`Chips-Host/src/runtime/plugin-runtime.ts`：

- `parseThemeManifestMeta(...)` 要求 theme plugin 提供 `themeId/displayName`
- 读取 `entry.tokens` 与 `entry.themeCss`
- 读取 `ui.layout.contract`

`Chips-Host/src/main/services/register-host-services.ts`：

- `normalizeThemeAssetPath(...)` 规范化路径
- `readJsonRecord(...)` 读取 `dist/tokens.json`
- `readThemeContract(...)` 读取 manifest 指向的 contract
- `loadThemeRecordFromPlugin(...)` 读取 tokens、CSS、contract，并调用 `rewriteThemeCssAssetUrls(css, resolvedThemeCssPath)`
- `loadInstalledThemes(...)` 只加载 enabled 的 theme plugin

`Chips-Host/src/main/theme-runtime/css-assets.ts`：

- 会把 `dist/theme.css` 中相对 `url("./icons/variablefont/*.woff2")` 重写为以 CSS 文件目录为基准的绝对 `file://` URL
- 单元测试 `Chips-Host/tests/unit/theme-css-assets.test.ts` 覆盖相对 URL、absolute/data URL、query/hash suffix

### 4.2 解析与 contract 链路证据

`Chips-Host/src/main/services/register-host-services.ts`：

- `resolveThemeChain(...)` 使用输入 chain；空 chain 默认 `state.currentThemeId`；最大深度 6
- `resolveThemeContext(...)` 调用 `mergeThemeLayers(...)` 与 `resolveThemeFromLayers(...)`
- CSS 通过 `records.map(theme.css).join(...)` 拼接
- `theme.apply` 在切换前调用 `validateThemeContractWithTokens(...)`
- `theme.resolve` 返回 `{ resolved, tokens, diagnostics, summary }`
- `theme.contract.get` 返回 `ThemeContractView`
- `theme.changed` 事件包含 `diagnosticsSummary`

`Chips-Host/src/main/theme-runtime/resolve-algorithm.ts`：

- 合并五层 token：`ref/sys/comp/motion/layout`
- 解析引用顺序：`sys -> motion/layout -> comp`
- component token 可引用 `ref/sys/motion/layout`
- 输出 flat `variables` 与 `componentTokens`

本轮用 Node 检查 `ThemePack/Chips-default/dist/tokens.json`：

- token 引用缺失数：0
- comp 层引用 comp 层数量：0
- sys/motion/layout 未发现违反当前解析方向的引用

### 4.3 注入链路证据

应用插件窗口：

- `Chips-Host/src/preload/plugin-window.ts`
- `syncThemeToDocument()` 同时调用：
  - `theme.getCurrent`
  - `theme.getAllCss`
  - `theme.resolve`
- 创建/复用 `#chips-plugin-theme-style`
- 写入 `styleEl.textContent = cssResult.css`
- 设置：
  - `data-chips-theme-id`
  - `data-chips-theme-version`
- 把 `resolved.tokens` 转为 CSS variables 写入 `document.documentElement.style`
- 监听 `theme.changed` 后刷新

基础卡片/复合卡片：

- `Chips-Host/src/main/services/register-host-services.ts` 的 `card.render` 与 `card.renderEditor` 把 `themeContext.renderTheme` 与 `themeContext.css` 传给 card service。
- `Chips-Host/packages/card-service/src/card-service.ts` 的 `createThemeVariablesCss(...)` 将 theme snapshot token 转为 `:root { --chips-... }`，并与 `themeCssText` 拼接。
- CSP 允许 `font-src data: file: http: https:`，因此被重写为 `file://` 的 Material Symbols 字体可加载。

箱子布局/布局编辑器：

- `Chips-Host/src/main/services/register-host-services.ts` 的 `box.renderLayoutFrame` 与 `box.renderLayoutEditor` 传入 `themeContext.renderTheme` 与 `themeContext.css`。
- `Chips-Host/packages/box-service/src/box-service.ts` 的 `createBoxLayoutThemeCss(...)` 与 `createBoxLayoutEditorThemeCss(...)` 将 token 转为 `:root` CSS 变量，并拼接 `extraCssText`。
- CSP 的 `font-src` 包含 `file:`。

### 4.4 Host 风险

1. Host 当前能读取并注入 `dist/tokens.json`、`dist/theme.css`、图标字体 URL、基础 CSS、组件 CSS；这条链路已有单元/集成测试支撑。

2. `theme.getAllCss` 本身不包含完整 token 变量声明。Host 内部 preload/card/box 都同时使用 `theme.resolve` 或 theme snapshot 注入变量，因此内部路径可用；但外部调用方如果只消费 `theme.getAllCss`，会得到不自包含的 CSS。

3. Host 主题 contract guard 与组件库 validator 重复实现，建议任务020增加 schema 对照或共享实现，避免后续诊断字段漂移。

4. Host 在 `theme.apply` 时阻断缺失 required token；`theme.resolve` 与 `theme.contract.get` 会报告诊断但不阻断。这个符合“诊断可见”方向，但若启动时 current theme 已无效，Host 仍可能先暴露 CSS/resolve 结果，需要任务020验证默认主题安装态的启动路径。

## 5. 任务020建议实施步骤

建议拆成可提交的小阶段：

1. 组件库 contract 生成 API 与门禁
   - 在 `@chips/theme-contracts` 增加 contract loader/generator/compare API。
   - 扩展 `validate-official-theme-contracts.mjs`，覆盖 interface contract、minFunctionalSet、a11yConstraints、motionConstraints。
   - 不修改主题视觉，只建立唯一来源工具。

2. 组件库 tokens 公共基线收口
   - 将 `chips.sys.icon.color/size/fill/wght/grad/opsz` 同步到 `Chips-ComponentLibrary/packages/tokens/tokens/sys.json`。
   - 将 `scripts/validate-tokens.mjs` 的硬编码前缀清单改为从 public contract/token source 推导。
   - 重新生成 tokens dist，并确保 `validate:tokens`、`build:tokens`、`validate:contracts` 通过。

3. 默认主题包 contract 生成化
   - 新增或改造 `ThemePack/Chips-default` 的 contract build step。
   - 从组件库正式 contract 生成 `contracts/theme-interface.contract.json` 与 `contracts/theme-min-functional-set.json`。
   - `validate:theme` 读取组件库正式 contract 作为 expected source，校验 manifest 指向的本地 contract 是生成结果。
   - 移除测试中的固定 70 count，改为从 expected contract 推导。

4. 默认主题包 CSS 全 scope 覆盖
   - 为 `toolbar`、`menu-bar`、`context-menu`、`shortcut` 增加正式 CSS 样式。
   - 新增 CSS 覆盖测试：每个 contract scope 必须至少有一个 `data-scope` 选择器。
   - 对 53 个未在 CSS 中出现的 required token 做分类：必须视觉消费的补 CSS；确认为运行时消费的写明路径；非 required 的降为 optional 并同步组件库 contract。

5. 构建稳定性与资源链路
   - `build-css.ts` 对 component CSS 文件名排序。
   - 校验 `dist/theme.css` 中三套 `@font-face` 与 `dist/icons/variablefont/*.woff2` 一致。
   - 结合 Host `rewriteThemeCssAssetUrls` 增加主题包侧或 Host 侧真实默认主题 CSS 资源测试。

6. Host contract 与注入联调
   - 用真实 `ThemePack/Chips-default` 产物跑 Host `theme.apply/theme.resolve/theme.contract.get/theme.getAllCss`。
   - 增加 `theme.contract.get` 对默认主题完整 `summary.status=complete`、componentCount、requiredCoverage 的断言。
   - 明确 `theme.getAllCss` 是否应包含变量；若仍保持 CSS 与 token 分离，更新公共接口文档。

7. 主题矩阵快照
   - 建立浅色主题矩阵预览，覆盖：
     - 应用插件窗口
     - 基础卡片 iframe
     - 箱子布局 iframe
     - 模块配置面板/设置治理页
   - 产物位置建议先放主题包 `preview/` 或项目任务草稿，最终规则写入公共主题文档。

8. 文档同步与最终验证
   - 更新生态公共文档与默认主题包内部技术文档。
   - 按任务020要求运行：
     - `cd ThemePack/Chips-default && npm run build && npm run validate:theme && npm test`
     - `cd Chips-ComponentLibrary && npm run validate:contracts && npm run quality:gate`
   - 若 Host 侧有变更，再补跑 Host 相关 build/test/contract。

## 6. 需要新增或同步的生态公共文档位置

### 6.1 生态公共文档

建议同步：

- `生态共用技术文档/组件库/02-组件契约标准.md`
  - 增加“组件库 contract 是主题包 contract 唯一来源”的生成规则。
  - 明确官方主题包本地 `theme-interface.contract.json` 是发布产物，不是人工源。

- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
  - 明确 `chips.sys.icon.*` 应进入 `@chips/tokens` public token source。
  - 增加 contract required token 与主题 CSS/runtime 消费关系的门禁规则。
  - 增加命令消费组件 `toolbar/menu-bar/context-menu/shortcut` 的主题覆盖要求。

- `生态共用技术文档/主题系统/01-主题包开发指南.md`
  - 更新实际主题包结构为 `tokens/ref.json/sys.json/motion.json/layout.json/comp/*.json`、`styles/*`、`dist/*`。
  - 移除或降级旧 `global.css/semantic.css/Style Dictionary` 示例的强制意味，避免与当前代码不一致。
  - 增加 contract 生成与打包要求。

- `生态共用技术文档/主题系统/02-主题接口规范.md`
  - 明确 `theme.getAllCss` 与 `theme.resolve` 的组合消费模型，或定义包含变量的 CSS 返回口径。
  - 明确 `theme.contract.get` 的 expected source 是主题包内生成 contract，生成源是组件库正式 contract。

- `生态共用技术文档/主题系统/03-图标与字体系统设计规范.md`
  - 继续保留 Material Symbols variable font 产物要求。
  - 将 `chips.sys.icon.*` 的 public token source 指向 `Chips-ComponentLibrary/packages/tokens`，避免只在主题包中存在。

如生成/校验流程内容过长，可新增：

- `生态共用技术文档/主题系统/04-主题Contract生成与校验标准.md`

### 6.2 默认主题包内部文档

建议同步：

- `ThemePack/Chips-default/技术文档/02-Token映射与构建流水线设计.md`
  - 增加 contract/minFunctionalSet 生成步骤。
  - 明确 token source 与 theme override 的边界。

- `ThemePack/Chips-default/技术文档/03- CSS与组件对接规范.md`
  - 加入 `toolbar/menu-bar/context-menu/shortcut`。
  - 修正 `build-css.ts` 排序说明或补代码后保持一致。

- `ThemePack/Chips-default/技术文档/04- 测试策略与质量门禁设计.md`
  - 修正“46 个正式组件”为当前真实组件数量或动态来源。
  - 增加 CSS scope 覆盖、minFunctionalSet 等值、组件库 source-of-truth 校验。

## 7. 本轮查看命令/测试命令及结果

### 7.1 工作区与约束查看

- `pwd && rg --files -g 'AGENTS.md' -g '!Chips-Scaffold/chips-scaffold-basecard/node_modules/**'`
  - 结果：确认当前目录为 `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048`，并列出工作区内 AGENTS 文件。
- `sed -n '1,220p' AGENTS.md`
  - 结果：读取根规则。
- `sed -n '1,220p' ThemePack/AGENTS.md`
  - 结果：读取主题包通用规则。
- `sed -n '1,220p' ThemePack/Chips-default/AGENTS.md`
  - 结果：读取默认主题包规则。
- `sed -n '1,220p' 生态共用技术文档/AGENTS.md`
  - 结果：读取公共文档规则。
- `sed -n '1,220p' 项目日志与笔记/AGENTS.md`
  - 结果：读取项目日志与笔记规则。
- `git branch --show-current && git status --short`
  - 结果：当前分支 `task022-优化薯片组件库和主题系统`；仅看到用户已说明的无关脏文件与旧质量报告。

### 7.2 指定设计/任务/公共规范查看

- `sed -n '1,220p' 项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务020-默认主题包Token与Contract升级.md`
  - 结果：读取任务020目标、范围、验收标准与验证命令。
- `sed -n '1,260p' 生态设计原稿/06-前端多样化和主题系统.md`
  - 结果：确认主题运行时链路、六级作用域、主题接口、图标系统方向。
- `sed -n '1,260p' 生态设计原稿/19-SDK与协议.md`
  - 结果：确认 Host 是运行时主载体，SDK 不承载 Host 运行时主实现。
- `sed -n '1,260p' 项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务14-主题系统与组件Contract治理.md`
  - 结果：确认 contract schema、Host Theme Runtime、设置面板治理方向。
- `sed -n '1,280p' 项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`
  - 结果：确认主题包全量升级、图标系统、CSS 输出、视觉矩阵要求。
- `sed -n '1,300p' 生态共用技术文档/组件库/02-组件契约标准.md`
  - 结果：确认 ThemeContractComponentView 字段、已落地组件 scope、iframe 附加契约。
- `sed -n '1,340p' 生态共用技术文档/组件库/03-Token与主题对接标准.md`
  - 结果：确认五层 token、required/optional diagnostics、官方 ThemePack contract 等值门禁要求。
- `sed -n '1,300p' 生态共用技术文档/组件库/11-焦点键盘与A11y交互模型.md`
  - 结果：确认键盘/focus/a11y 交互模型。
- `curl -L --silent --show-error --max-time 20 https://developer.apple.com/documentation/swiftui/colorscheme`
- `curl -L --silent --show-error --max-time 20 https://developer.apple.com/documentation/swiftui/buttonstyle`
- `curl -L --silent --show-error --max-time 20 https://developer.apple.com/documentation/swiftui/view/controlsize\(_:\)`
- `curl -L --silent --show-error --max-time 20 https://developer.apple.com/documentation/swiftui/view/tint\(_:\)`
  - 结果：确认 Apple 官方 SwiftUI 当前仍有 `ColorScheme`、`ButtonStyle`、`controlSize(_:)`、`tint(_:)` 等主题/控件样式能力文档。这里只作为任务020前置对标参考，不作为薯片生态 contract 来源。

### 7.3 默认主题包查看

- `rg --files ThemePack/Chips-default`
  - 结果：列出默认主题包源码、tokens、contracts、styles、tests、dist。
- `find ThemePack/Chips-default -maxdepth 3 -type d`
  - 结果：确认存在 `dist`、`.cpk-stage`、`contracts`、`tokens/comp`、`styles/components`、`icons/variablefont`、文档目录。
- `nl -ba ThemePack/Chips-default/package.json | sed -n '1,220p'`
  - 结果：确认 build/validate/test 脚本。
- `nl -ba ThemePack/Chips-default/manifest.yaml | sed -n '1,220p'`
  - 结果：确认 `entry.tokens`、`entry.themeCss`、contract/minFunctionalSet 指向。
- `find ThemePack/Chips-default/dist -maxdepth 3 -type f | sort`
  - 结果：确认 `dist/tokens.json`、`dist/theme.css`、三套 icon font。
- `nl -ba ThemePack/Chips-default/src/build-tokens.ts | sed -n '1,260p'`
  - 结果：确认 token 构建逻辑。
- `nl -ba ThemePack/Chips-default/src/build-css.ts | sed -n '1,320p'`
  - 结果：确认 CSS 构建与 icon font 复制逻辑；发现 component CSS 未排序。
- `nl -ba ThemePack/Chips-default/src/validate-theme.ts | sed -n '1,340p'`
  - 结果：确认读取本地 contract，并 import 组件库 validator。
- `nl -ba ThemePack/Chips-default/contracts/theme-interface.contract.json | sed -n '1,260p'`
  - 结果：抽查本地 theme interface contract。
- `nl -ba ThemePack/Chips-default/contracts/theme-min-functional-set.json | sed -n '1,220p'`
  - 结果：抽查 min functional set。
- Node 统计 theme interface contract
  - 结果：70 个组件，630 required token。
- Node 统计 `tokens/comp`
  - 结果：70 个组件 token 文件。
- `nl -ba ThemePack/Chips-default/tests/*.spec.ts ...`
  - 结果：读取 contract、tokens、build、layout-primitives 测试。
- Node 统计 `dist/tokens.json`
  - 结果：ref 26、sys 11、motion 3、layout 26、comp 630、total 696；`chips.sys.icon.*` 6 个存在。
- Node 统计 `dist/theme.css`
  - 结果：112965 bytes，3 个 `@font-face`，66 个 CSS `data-scope`。
- Node 比对 contract scope 与 CSS scope
  - 结果：缺失 CSS scope 为 `context-menu/menu-bar/shortcut/toolbar`。
- Node 比对 requiredTokens 与 CSS 文本
  - 结果：630 个 requiredTokens 中 53 个没有在 CSS 文本中出现。
- Node 检查 token 引用
  - 结果：referenceMissing 0；未发现 comp 引用 comp 的方向性问题。
- `nl -ba 'ThemePack/Chips-default/技术文档/03- CSS与组件对接规范.md' ...`
- `nl -ba 'ThemePack/Chips-default/技术文档/04- 测试策略与质量门禁设计.md' ...`
  - 结果：确认内部文档存在 46 组件数和 CSS 排序说明漂移。
  - 备注：第一次未给含空格文件名加引号，`nl` 输出 usage；随后用引号重跑成功。

### 7.4 组件库查看

- `rg --files Chips-ComponentLibrary/packages/tokens Chips-ComponentLibrary/packages/theme-contracts Chips-ComponentLibrary/packages/components`
  - 结果：列出 tokens、theme-contracts、components 相关文件。
- `nl -ba Chips-ComponentLibrary/package.json | sed -n '1,220p'`
  - 结果：确认 `validate:contracts`、`test:contracts`、`quality:gate` 等脚本。
- `nl -ba Chips-ComponentLibrary/packages/theme-contracts/package.json | sed -n '1,220p'`
  - 结果：确认 `@chips/theme-contracts` 入口与 exports。
- `nl -ba Chips-ComponentLibrary/packages/tokens/package.json | sed -n '1,220p'`
  - 结果：确认 `@chips/tokens` 包入口。
- `nl -ba Chips-ComponentLibrary/packages/theme-contracts/src/validator.js | sed -n '1,360p'`
  - 结果：确认 contract validator、diagnostic、coverage 实现。
- `nl -ba Chips-ComponentLibrary/scripts/validate-theme-contracts.mjs | sed -n '1,360p'`
  - 结果：确认组件库 contract 目录校验入口。
- `nl -ba Chips-ComponentLibrary/scripts/validate-official-theme-contracts.mjs | sed -n '1,360p'`
  - 结果：确认官方 ThemePack contract 与组件库 contract 等值校验。
- `nl -ba Chips-ComponentLibrary/scripts/build-tokens.mjs ...`
- `nl -ba Chips-ComponentLibrary/scripts/validate-tokens.mjs ...`
- `nl -ba Chips-ComponentLibrary/packages/tokens/src/token-utils.js ...`
  - 结果：确认 tokens build/validate 工具；发现 `validate-tokens.mjs` 仍有硬编码 prefix 清单。
- Node 比对 ThemePack tokens 与组件库 tokens
  - 结果：comp key 总数 630/630；`ref.json` ThemePack 比组件库多 17 个 key；`sys.json` ThemePack 比组件库多 6 个 `chips.sys.icon.*` key；layout/motion key 数一致。
- `rg -n "toolbar|menu-bar|context-menu|shortcut" Chips-ComponentLibrary/...`
  - 结果：确认命令消费组件在组件库 contract、tokens、components 实现中均已存在。

### 7.5 Host 查看

- `rg -n "theme\\.contract|getAllCss|themeCss|tokens\\.json|theme\\.css|icons/variablefont|MaterialSymbols|data-chips-theme|ThemeRuntime|theme\\.resolve|theme\\.apply|entry\\.tokens|entry\\.themeCss" Chips-Host -g '!node_modules/**' -g '!dist/**'`
  - 结果：定位 Host 主题运行时、preload、card/box service、测试文件。
- `nl -ba Chips-Host/src/runtime/plugin-runtime.ts | sed -n '1060,1140p'`
  - 结果：确认 manifest 解析 `entry.tokens/themeCss` 与 contract path。
- `nl -ba Chips-Host/src/main/services/register-host-services.ts | sed -n '820,930p'`
  - 结果：确认读取 tokens/CSS/contract 并重写 CSS asset URL。
- `nl -ba Chips-Host/src/main/services/register-host-services.ts | sed -n '2735,2845p'`
  - 结果：确认 theme chain、resolve context、contract view、changed payload。
- `nl -ba Chips-Host/src/main/services/register-host-services.ts | sed -n '3680,3845p'`
  - 结果：确认 theme service actions。
- `nl -ba Chips-Host/src/main/theme-runtime/css-assets.ts | sed -n '1,220p'`
  - 结果：确认 CSS URL rewrite。
- `nl -ba Chips-Host/src/main/theme-runtime/contract-guard.ts | sed -n '1,340p'`
  - 结果：确认 Host 自有 contract guard 与 diagnostics 实现。
- `nl -ba Chips-Host/src/main/theme-runtime/resolve-algorithm.ts | sed -n '1,320p'`
  - 结果：确认五层 token merge/reference resolve。
- `nl -ba Chips-Host/src/preload/plugin-window.ts | sed -n '130,260p'`
  - 结果：确认 app document CSS 与变量注入。
- `nl -ba Chips-Host/packages/card-service/src/card-service.ts | sed -n '700,790p'`
  - 结果：确认 card service 注入 token variables 与 themeCssText。
- `nl -ba Chips-Host/packages/box-service/src/box-service.ts | sed -n '540,575p'`
  - 结果：确认 box service 注入 token variables 与 extra CSS。
- `nl -ba Chips-Host/tests/unit/theme-runtime.test.ts ...`
- `nl -ba Chips-Host/tests/unit/theme-css-assets.test.ts ...`
- `nl -ba Chips-Host/tests/integration/host-services.test.ts ...`
  - 结果：确认 Host 已有主题解析、CSS asset rewrite、theme service integration 测试。

### 7.6 本轮实际运行的验证命令

- `cd ThemePack/Chips-default && npm run validate:theme`
  - 结果：通过。
  - 输出：`Theme contract validation passed: 70 components, 630 required tokens.`

- `cd Chips-ComponentLibrary && npm run validate:contracts`
  - 结果：通过。
  - 输出：`[theme-contracts] validated 70 contracts`

- `cd Chips-ComponentLibrary && node scripts/validate-official-theme-contracts.mjs`
  - 结果：通过。
  - 输出：`[theme-contracts] official ThemePack contracts match 70 component contracts`

### 7.7 未运行的任务020建议命令与原因

未运行：

- `cd ThemePack/Chips-default && npm run build`
- `cd ThemePack/Chips-default && npm test`
- `cd Chips-ComponentLibrary && npm run quality:gate`

原因：

- 本轮是任务020预研，不实施；`npm run build` 与主题包 `npm test` 内的 build spec 会重写 `dist/tokens.json`、`dist/theme.css`、`dist/icons/variablefont/*`，不符合“只做勘察与报告”的边界。
- `Chips-ComponentLibrary` 当前已有用户提示的无关旧质量报告 `Chips-ComponentLibrary/reports/quality-gate/quality-gate-2026-05-24T054315664Z.json`；`npm run quality:gate` 通常会生成/更新报告文件，预研阶段不触碰。

## 8. 最后工作区状态

写报告前状态：

- 已知无关脏文件：
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/README.md`
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/net.d.ts`
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/package.json`
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/stream.d.ts`
  - `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/stream/web.d.ts`
  - `Chips-ComponentLibrary/reports/quality-gate/quality-gate-2026-05-24T054315664Z.json`

本报告为本轮唯一预期新增文件：

- `项目日志与笔记/task022-优化薯片组件库和主题系统/08-草稿笔记/任务020-默认主题包Token与Contract升级-预研报告-20260524.md`
