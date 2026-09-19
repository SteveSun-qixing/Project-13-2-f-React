# 任务021：暗色主题包 Token 与 Contract 升级预研报告

> 预研日期：2026-05-24
> 子代理边界：只做勘察与报告；未修改 `ThemePack/Chips-theme-default-dark`、`ThemePack/Chips-default`、`Chips-ComponentLibrary`、`Chips-Host` 等正式代码；未提交 git。
> 当前 worktree：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048`

## 0. 结论摘要

`ThemePack/Chips-theme-default-dark` 当前已经具备任务021的主要工程基础：`manifest.yaml` 以独立 `themeId: chips-official.default-dark-theme` 声明暗色主题，`entry.tokens` 与 `entry.themeCss` 指向 `dist/tokens.json` / `dist/theme.css`，源码中有五层 token、70 个组件 token 文件、本地 70 组件 contract、Material Symbols 三套 variable font、构建脚本、校验脚本和 Vitest 用例。

本轮只读校验结果：

- `npm run validate:theme` 通过，输出 `Theme contract validation passed: 70 components, 630 required tokens.`
- `Chips-ComponentLibrary/scripts/validate-official-theme-contracts.mjs` 通过，确认默认主题与暗色主题的官方 ThemePack contract 均匹配组件库 70 个正式 component contract。
- 暗色主题 `contracts/theme-interface.contract.json` 与组件库正式 contract 在 `component/scope/parts/states/requiredTokens/optionalTokens` 上等值。
- 暗色主题 `contracts/theme-min-functional-set.json` 与 interface contract 的 70 个组件集合一致。
- 暗色主题 `dist/tokens.json` 中 630 个 required token 均存在。

任务021仍有几个明确差距：

- `dist/theme.css` 只覆盖 66 个 contract scope，缺少 `toolbar`、`menu-bar`、`context-menu`、`shortcut` 四个命令消费组件的正式 CSS 选择器。
- 53 个 required token 没有在 `dist/theme.css` 中直接出现，其中缺失集中在上述四个 scope，也包括部分禁用态、状态文本、滚动条和布局表面 token。
- `tokens/sys.json` 已有暗色基础层，但任务021要求覆盖窗口背景、surface、菜单、工具栏、表单、弹层、焦点环、危险/警告/成功状态；当前 `sys` 只有 `error`，没有正式 `success/warning/danger/info` 语义色。
- `tokens/comp/toolbar.json`、`menu-bar.json`、`context-menu.json`、`shortcut.json` 当前值偏保守，主要复用 `surface/on-surface/primary`，需要按暗色视觉重新校准 hover、active、disabled、shortcut key、menu content、focus 等状态。
- 文档存在历史口径：暗色主题内部技术文档仍有“当前覆盖组件库 46 个正式组件”的旧描述，且索引路径仍指向旧工作区 `/Project-13-2-f/`。

本轮未运行 `npm run build`、`npm test`、`npm run quality:gate`，因为它们会改写 `dist`、执行 build.spec 或生成报告产物；预研阶段按要求不触碰正式实现产物。

## 1. 已读文档清单

### 1.1 AGENTS 与目录规则

- `AGENTS.md`
- `ThemePack/AGENTS.md`
- `ThemePack/Chips-theme-default-dark/AGENTS.md`
- `ThemePack/Chips-default/AGENTS.md`
- `Chips-ComponentLibrary/AGENTS.md`
- `Chips-Host/AGENTS.md`
- `生态共用技术文档/AGENTS.md`
- `项目日志与笔记/AGENTS.md`
- `生态设计原稿/AGENTS.md`

关键约束确认：

- 主题包只负责 token、CSS、契约和构建产物，不写 Host / SDK 运行时逻辑。
- 暗色主题必须是独立主题包，不在默认主题包内做 light/dark 分支。
- 组件库负责 L10 无头组件结构、状态机和 a11y，不硬编码视觉。
- 公共主题规范、组件契约、token 对接标准属于 `生态共用技术文档/`；过程性预研报告属于 `项目日志与笔记/`。

### 1.2 任务与阶段方案

- `项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务021-暗色主题包Token与Contract升级.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务020-默认主题包Token与Contract升级.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务14-主题系统与组件Contract治理.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/08-草稿笔记/任务020-默认主题包Token与Contract升级-预研报告-20260524.md`

任务021目标确认：

- 暗色主题与默认主题同等级覆盖组件库公开 contract。
- 重新设计暗色 `sys` 颜色层。
- 校准暗色下可读性、对比度、禁用态、悬停态、按下态、选中态和错误态。
- 图标字体、motion CSS、component CSS 与默认主题保持结构一致。
- 增加暗色主题矩阵测试。

### 1.3 生态共用技术文档

- `生态共用技术文档/主题系统/01-主题包开发指南.md`
- `生态共用技术文档/主题系统/02-主题接口规范.md`
- `生态共用技术文档/主题系统/03-图标与字体系统设计规范.md`
- `生态共用技术文档/组件库/02-组件契约标准.md`
- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- `生态共用技术文档/组件库/05-可访问性与质量基线.md`
- `生态共用技术文档/组件库/09-SwiftUI对标基础控件能力矩阵.md`

关键公共口径确认：

- 统一 token 层级为 `ref/sys/comp/motion/layout`。
- 官方主题包必须与 `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json` 的正式 contract 等值。
- 主题诊断必须共享 `ThemeContractView`、`ThemeDiagnostic`、`ThemeDiagnosticSummary` schema。
- 图标运行时主链路为 Material Symbols variable font + `ChipsIcon` + `IconDescriptor`，主题包必须提供 `chips.sys.icon.*` token 与三套字体产物。

### 1.4 生态设计原稿

通过 `rg "theme|主题|token|Token|SwiftUI|组件|Contract|contract" 生态设计原稿` 定位并阅读相关内容：

- `生态设计原稿/06-前端多样化和主题系统.md`
- `生态设计原稿/07-插件系统架构.md`
- `生态设计原稿/05-公共基础层设计.md`
- `生态设计原稿/薯片生态-架构设计手册.md` 中第 10、11、19、20、21 节相关内容

设计意图确认：

- Host 主责 L1-L9，组件库主责 L10，Theme Runtime 位于 L11。
- 主题包作为 `type: theme` 插件交付视觉资源。
- 一个主题包只承载一种外观，暗色主题必须通过独立 `themeId` 切换。
- 主题链路必须覆盖应用窗口、卡片 iframe、箱子布局和原生窗口背景。

## 2. 当前实现概览

### 2.1 暗色主题包结构

已勘察 `ThemePack/Chips-theme-default-dark`：

- `manifest.yaml`
- `package.json`
- `chips.config.mjs`
- `tokens/ref.json`
- `tokens/sys.json`
- `tokens/motion.json`
- `tokens/layout.json`
- `tokens/comp/*.json`
- `styles/base.css`
- `styles/motions.css`
- `styles/components/*.css`
- `contracts/theme-interface.contract.json`
- `contracts/theme-min-functional-set.json`
- `src/build-tokens.ts`
- `src/build-css.ts`
- `src/validate-theme.ts`
- `tests/*.spec.ts`
- `icons/variablefont/*.woff2`
- `dist/tokens.json`
- `dist/theme.css`
- `dist/icons/variablefont/*.woff2`
- `技术文档/`
- `需求文档/`
- `开发计划/`
- `归档/`

`manifest.yaml` 关键字段：

- `id: "theme.theme.chips-official-default-dark-theme"`
- `type: "theme"`
- `entry.tokens: "dist/tokens.json"`
- `entry.themeCss: "dist/theme.css"`
- `themeId: "chips-official.default-dark-theme"`
- `displayName: "薯片官方 · 暗夜主题"`
- `isDefault: false`
- `ui.layout.contract: ./contracts/theme-interface.contract.json`
- `ui.layout.minFunctionalSet: ./contracts/theme-min-functional-set.json`

这符合独立暗色主题包边界，没有在默认主题中混合模式。

### 2.2 构建与校验脚本

`src/build-tokens.ts`：

- 读取 `tokens/ref.json/sys.json/motion.json/layout.json`。
- 读取 `tokens/comp/*.json`，按文件名排序深度合并。
- 输出 `{ ref, sys, comp, motion, layout }` 到 `dist/tokens.json`。

`src/build-css.ts`：

- 校验并复制三套 Material Symbols variable font 到 `dist/icons/variablefont/`。
- 生成三段 `@font-face`。
- 拼接 `styles/base.css`、`styles/components/*.css`、`styles/motions.css`。
- 输出 `dist/theme.css`。

注意：`build-css.ts` 当前读取 `styles/components` 后没有显式 `.sort()`，与内部文档“按文件名排序”的描述不一致。任务020预研已指出默认主题同类问题，暗色主题同样存在。

`src/validate-theme.ts`：

- 读取 `dist/tokens.json`。
- 读取本主题包 `contracts/theme-interface.contract.json`。
- 动态 import `../../Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`。
- 调用 `buildThemeContractView(...)`。
- 若存在 blocking 诊断则输出 JSON 并以非零码结束。

当前校验已复用组件库 validator 的诊断 schema，但 contract 输入仍是本地复制文件，不是由组件库 contract 目录生成。

### 2.3 Contract 与 token 统计

本轮脚本统计：

| 项目 | 结果 |
|---|---:|
| 组件库正式 component contract | 70 |
| 暗色主题 interface contract 组件 | 70 |
| 默认主题 interface contract 组件 | 70 |
| 暗色主题 required token 条目 | 630 |
| 暗色主题 unique required token | 630 |
| 暗色主题 `tokens/comp/*.json` | 70 |
| 组件库 token 包 `tokens/comp/*.json` | 70 |
| 默认主题 `tokens/comp/*.json` | 70 |
| 暗色主题 `theme-min-functional-set` requiredComponents | 70 |

比对结果：

- 暗色主题 contract 没有缺少组件库组件。
- 暗色主题 contract 没有额外声明组件库未公开组件。
- 暗色主题与默认主题的 component 名称集合一致。
- 暗色主题 contract 字段等值差异数为 0。
- 暗色主题 min functional set 与 interface contract 组件集合一致。
- 暗色主题 comp token 文件与组件库 token 包、默认主题数量一致。

`dist/tokens.json` leaf 统计：

| 层级 | leaf 数 |
|---|---:|
| `ref` | 23 |
| `sys` | 24 |
| `motion` | 3 |
| `layout` | 26 |
| `comp` | 632 |
| total | 708 |

说明：暗色主题 `comp` 比 contract required token 多 2 个 leaf，主要来自实现层扩展值；required token 均存在，不构成 contract 阻断。

### 2.4 CSS 覆盖统计

`ThemePack/Chips-theme-default-dark/dist/theme.css` 统计：

- 文件大小：113582 bytes。
- `@font-face`：3 个。
- `data-scope` 覆盖：66 个。
- contract scope：70 个。
- CSS 中缺失 contract scope：
  - `context-menu`
  - `menu-bar`
  - `shortcut`
  - `toolbar`
- CSS 中无额外 scope。

630 个 required token 中，53 个没有在 `dist/theme.css` 中直接出现。按组件聚合：

| 组件 | 未直接引用 required token 数 |
|---|---:|
| `toolbar` | 9 |
| `context-menu` | 7 |
| `menu-bar` | 7 |
| `badge` | 5 |
| `shortcut` | 4 |
| `date-picker` | 3 |
| `time-picker` | 3 |
| 其他 15 个组件 | 1/组件 |

这不一定全部等同于运行时缺失，因为部分 token 可能由继承、统一选择器或运行时变量间接消费；但四个命令消费组件完全没有 `data-scope` 样式是明确缺口。

### 2.5 暗色 `sys/ref` 当前设计

`tokens/ref.json` 当前暗色色板：

- 深灰蓝：`gray-950 #0b0f16`、`gray-900 #11161f`、`gray-800 #171d28`、`gray-700 #202734` 等。
- 主色蓝：`blue-400 #6fb3ff`、`blue-500 #4e99ff`、`blue-600 #367fe0`、`blue-700 #2968ba`。
- 错误红：`red-400 #ff7f8d`、`red-500 #e35d6a`。

`tokens/sys.json` 当前语义色：

- `canvas`
- `surface`
- `surface-raised`
- `surface-elevated`
- `surface-accent`
- `on-surface`
- `on-surface-muted`
- `on-surface-soft`
- `primary`
- `primary-hover`
- `primary-active`
- `primary-contrast`
- `focus-ring`
- `border-subtle`
- `border-strong`
- `shadow`
- `error`
- `icon.*`
- `radius.container`

与任务021目标相比，`sys` 层还缺少成功、警告、危险/错误背景、信息态等更完整状态色。当前很多 `comp` token 已经存在 `success/warning/error/info` 命名，但 `sys` 层没有正式语义色承接，容易让暗色状态视觉分散在组件层。

### 2.6 抽样对比度

按当前 `dist/tokens.json` 解析引用后抽样计算：

| 组合 | 对比度 |
|---|---:|
| `on-surface` / `canvas` | 17.90 |
| `on-surface` / `surface` | 16.90 |
| `on-surface-muted` / `surface` | 9.80 |
| `on-surface-soft` / `surface` | 6.33 |
| `error` / `surface` | 5.21 |
| `input.value` / `input.root.surface.idle` | 15.75 |
| `input.placeholder` / `input.root.surface.idle` | 5.90 |
| `primary-contrast` / `primary` | 3.72 |
| `primary-contrast` / `primary-hover` | 2.67 |
| `primary-contrast` / `primary-active` | 5.18 |
| `button.label.color.idle` / `button.root.surface.idle` | 3.72 |

结论：普通文本、说明文本、输入文字和错误文本对比度较好；主按钮默认和 hover 的白字蓝底低于 4.5:1，需要任务021正式校准。若按钮文字字号或加粗达到 WCAG large text 标准可能可接受，但生态组件默认不应依赖“刚好是大字”成立。

### 2.7 Host 主题切换链路阅读确认

只读确认了 `Chips-Host` 链路：

- `PluginRuntime.parseThemeManifestMeta(...)` 读取 `themeId`、`displayName`、`entry.tokens`、`entry.themeCss`、`ui.layout.contract`。
- `loadThemeRecordFromPlugin(...)` 读取 tokens、CSS、contract，并通过 `rewriteThemeCssAssetUrls(...)` 将相对资源 URL 改写为 file URL。
- `resolveThemeContext(...)` 根据当前主题或指定 chain 合并 token 层，生成 `resolvedTheme.variables` 和聚合 CSS。
- `theme.apply` 会调用 `validateThemeContractWithTokens(...)`，缺失 required token 时阻断。
- `theme.getAllCss` 返回当前主题 CSS 与 `themeId`。
- `theme.resolve` 返回变量表、诊断和摘要。
- `theme.contract.get` 返回 `ThemeContractView`。
- `src/preload/plugin-window.ts` 同时调用 `theme.getCurrent`、`theme.getAllCss`、`theme.resolve`，向文档根节点注入 `data-chips-theme-id`、`data-chips-theme-version`、`style` 与 CSS variables。

因此，主题包 `dist/theme.css` 不需要自行输出完整 708 个 token 变量；变量由 Host 注入。但主题 CSS 仍必须覆盖组件库公开的 `data-scope/data-part/data-state`，否则对应组件只有变量值、没有视觉规则。

## 3. 与任务021目标的差距

### P0：任务021正式实施必须处理

1. 命令消费组件 CSS 缺口。
   - 证据：暗色主题 contract scopes 70，`dist/theme.css` scopes 66。
   - 缺失 scope：`toolbar`、`menu-bar`、`context-menu`、`shortcut`。
   - 影响：这些组件在暗色主题下没有正式视觉实现，不满足“与默认主题拥有同等级 component CSS 覆盖”和“应用窗口、菜单、工具栏视觉同步刷新”的验收目标。

2. 主按钮与主色 hover 对比度不足。
   - 证据：`primary-contrast #f5f7fb` / `primary #367fe0` 对比度约 3.72；`primary-contrast` / `primary-hover #4e99ff` 约 2.67。
   - 影响：暗色主题关键操作按钮在小字号或普通字重下可能低于 4.5:1 可读性基线。

3. `sys` 状态色不完整。
   - 证据：`tokens/sys.json` 只有 `error`，没有 `success/warning/danger/info`、状态背景、状态边框、状态前景等语义。
   - 影响：任务021要求覆盖危险/警告/成功状态；当前组件层虽有若干 tone token，但缺少统一暗色语义承载。

4. `build-css.ts` 拼接顺序与文档不一致。
   - 证据：真实代码遍历 `fs.readdir(componentsDir)` 后直接拼接，未排序；内部文档写按文件名排序。
   - 影响：CSS 级联输出存在环境相关顺序风险；默认主题任务020同类成果可复用。

5. contract 来源仍是 ThemePack 本地复制文件。
   - 证据：`src/validate-theme.ts` 读取 `contracts/theme-interface.contract.json`；`manifest.yaml` 指向这份本地文件。
   - 当前状态：本轮确认本地 contract 与组件库正式 contract 等值。
   - 影响：任务14/24要求 contract 治理闭环，后续最好由组件库正式 contract 生成或由统一脚本强制等值，避免本地复制漂移。

### P1：建议同阶段处理

1. CSS required token 覆盖没有全量门禁。
   - 证据：53 个 required token 未在 CSS 中直接出现，且 `tests/build.spec.ts` 只枚举部分 scope。
   - 建议：新增“contract scope 全部出现在 `dist/theme.css`”的测试；对 required token 的 CSS 引用建立规则或豁免说明。

2. 暗色主题矩阵测试尚未落地。
   - 证据：`preview/` 只有 README；本地测试未覆盖应用窗口、卡片 iframe、箱子布局、设置面板、预览面板、性能诊断面板的暗色矩阵。
   - 建议：任务021至少补齐可自动运行的静态/快照测试入口；需要真实浏览器截图时可在后续主题矩阵任务统一实施。

3. 内部文档过期。
   - 证据：`技术文档/04- 测试策略与质量门禁设计.md` 仍写“当前覆盖组件库 46 个正式组件”；真实已是 70 个。
   - 证据：`技术文档/00-文档索引.md` 与需求文档索引中引用旧工作区路径 `/Project-13-2-f/`，当前 worktree 是 `/Project-13-2-f-worktree-20260523-161048/`。
   - 建议：任务021实施完成后同步更新暗色主题包内部文档；公共规则变化才同步生态共用技术文档。

4. `.cpk-stage` 与 `dist` 可能不是当前源码的可信事实源。
   - 证据：`.cpk-stage/tokens/comp` 中仍有 `form-field.json`、`form-group.json`，而源目录已归档为 `form.json`；`.cpk-stage` 看起来可能是历史打包暂存。
   - 建议：任务021正式打包前重新构建/打包，确保 `.cpk-stage` 或发布产物不带旧 component 口径。

5. ThemePack 直接 import 组件库源码路径。
   - 证据：`src/validate-theme.ts` 动态 import `../../Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`。
   - 当前可运行，但与包边界不够干净。
   - 建议：跟随任务020成果，优先消费 `@chips/theme-contracts` 稳定 package 入口或组件库导出的生成/校验 API。

### P2：可在任务021收尾处理

1. `tests/contract.spec.ts` 硬编码 70。
   - 建议：从组件库正式 contract 目录推导 expected count，避免新增/归档组件时多处改数。

2. `tests/tokens.spec.ts` 是手工枚举抽样。
   - 建议：保留抽样用例，同时增加根据 contract required tokens 自动断言 dist token 覆盖的测试。

3. `styles/base.css` 使用 `letter-spacing: 0.01em`。
   - 这不属于任务021核心，但前端设计要求避免负字距，未禁止正字距；如后续视觉审查认为暗色正文显得松散，可回到字体规范统一处理。

## 4. 建议改动清单（按文件路径分组）

以下是任务021正式实施建议，预研阶段未修改这些文件。

### `ThemePack/Chips-theme-default-dark/tokens/ref.json`

- 增补或校准暗色状态色所需基础色板：
  - 成功：建议引入 green/emerald 暗色可读阶梯。
  - 警告：建议引入 amber/yellow 暗色可读阶梯。
  - 危险/错误：保留 red，但补充更适合背景、边框、文本的层级。
  - 信息：可复用 blue 或新增 cyan/sky 阶梯。
- 重新校准主色蓝：
  - 降低 `primary` / `primary-hover` 背景亮度，或改深色主按钮文字为深色前景，确保主按钮对比度达标。
  - 重点检查 `blue-500` hover 下与 `primary-contrast` 的对比度。

### `ThemePack/Chips-theme-default-dark/tokens/sys.json`

- 补齐暗色语义色：
  - `chips.sys.color.success`
  - `chips.sys.color.success-surface`
  - `chips.sys.color.success-border`
  - `chips.sys.color.warning`
  - `chips.sys.color.warning-surface`
  - `chips.sys.color.warning-border`
  - `chips.sys.color.danger` 或继续统一为 `error`，但需要有 `error-surface/error-border/error-contrast`
  - `chips.sys.color.info`
  - `chips.sys.color.info-surface`
  - `chips.sys.color.info-border`
- 明确 surface 分层对应用窗口、菜单、工具栏、表单、弹层的映射：
  - `canvas`
  - `surface`
  - `surface-raised`
  - `surface-elevated`
  - `surface-accent`
  - `border-subtle`
  - `border-strong`
  - `focus-ring`
- 保持图标 token：
  - `chips.sys.icon.color`
  - `chips.sys.icon.size`
  - `chips.sys.icon.fill`
  - `chips.sys.icon.wght`
  - `chips.sys.icon.grad`
  - `chips.sys.icon.opsz`

### `ThemePack/Chips-theme-default-dark/tokens/comp/toolbar.json`

- 按暗色工具栏场景校准：
  - `root.surface` 建议使用 `surface-raised` 或专门 toolbar surface。
  - `item.surface.hover` 使用可见但克制的 `surface-elevated` 或 `surface-accent`。
  - `item.surface.active` 不宜直接使用高饱和主蓝整块底，建议低饱和选中面。
  - `item.surface.disabled` 与 `item.text/icon.color.disabled` 需要明确。
  - `focus.outline` 使用 `focus-ring`，不要回退 `primary`。

### `ThemePack/Chips-theme-default-dark/tokens/comp/menu-bar.json`

- 按菜单栏场景校准：
  - `root.surface`、`menu.surface.idle/hover`、`item.surface.hover` 与弹层菜单层级区分。
  - `shortcut.color` 使用 muted/soft，不要与主文字同强度。
  - `focus.outline` 使用 `focus-ring`。

### `ThemePack/Chips-theme-default-dark/tokens/comp/context-menu.json`

- 按右键菜单/上下文菜单场景校准：
  - `trigger.surface.idle` 保持透明或当前 surface。
  - `content.surface` 使用 elevated surface。
  - `item.surface.hover` 使用 surface-accent。
  - `shortcut.color` 使用 muted/soft。
  - `focus.outline` 使用 `focus-ring`。

### `ThemePack/Chips-theme-default-dark/tokens/comp/shortcut.json`

- 按快捷键 keycap 视觉校准：
  - `root.surface` 可透明。
  - `key.surface` 使用 raised/elevated surface，配合边框或阴影。
  - `key.text.color` 使用 muted/on-surface，确保小号 key 文字可读。
  - `separator.color` 使用 soft/muted。

### `ThemePack/Chips-theme-default-dark/tokens/comp/button.json`

- 重点校准主按钮可读性：
  - `button.root.surface.idle/hover/active`
  - `button.label.color.idle`
  - `button.focus.outline`
- 目标：默认和 hover 状态文字对比度不低于 4.5:1，除非组件明确为大文本并在公共标准中允许较低阈值。

### `ThemePack/Chips-theme-default-dark/styles/components/layout-containers.css`

- 增加 `toolbar`、`menu-bar`、`shortcut` 的正式 `data-scope/data-part` 样式，或新建命令组件 CSS 文件并保证构建纳入。
- 现有 `data-grid toolbar` 样式不能替代独立 `toolbar` scope。
- 样式只依赖公开 part：
  - `toolbar`: `root/group/item/icon/label/shortcut/status`
  - `menu-bar`: `root/menu/content/group/item/shortcut/status`
  - `shortcut`: `root/key/separator`

### `ThemePack/Chips-theme-default-dark/styles/components/overlays.css`

- 增加 `context-menu` 的正式样式，或与 `menu-bar`/`menu` 共用可维护的选择器组。
- 必须覆盖：
  - `root`
  - `trigger`
  - `content`
  - `group`
  - `item`
  - `shortcut`
  - `status`
  - focus 状态

### `ThemePack/Chips-theme-default-dark/src/build-css.ts`

- 对 `styles/components` 的文件名显式 `.sort()` 后拼接，保证输出确定性。
- 保持图标字体复制与 `@font-face` 逻辑，继续输出到 `dist/icons/variablefont/`。

### `ThemePack/Chips-theme-default-dark/src/validate-theme.ts`

- 跟随任务020成果：
  - 从组件库正式 contract 目录或 `@chips/theme-contracts` public API 加载 contract 基线。
  - 校验本地 `contracts/theme-interface.contract.json` 是否与组件库正式 contract 等值。
  - 校验 `theme-min-functional-set.json` 是否与 interface contract 同步。
- 继续使用统一 `ThemeContractView` 诊断 schema，不维护私有 token 白名单。

### `ThemePack/Chips-theme-default-dark/tests/contract.spec.ts`

- 移除硬编码 `70`，改为读取组件库正式 contract 数量。
- 保留字段等值测试。
- 增加 min functional set 同步测试。

### `ThemePack/Chips-theme-default-dark/tests/build.spec.ts`

- 增加所有 contract scope 必须出现在 `dist/theme.css` 的测试，至少覆盖 `toolbar/menu-bar/context-menu/shortcut`。
- 增加 CSS 拼接稳定性或关键输出顺序测试。
- 注意当前 `build.spec.ts` 会执行 `npm run build`，任务021实施时可以保留；预研阶段未运行。

### `ThemePack/Chips-theme-default-dark/tests/dark-theme.spec.ts`

- 增加暗色对比度测试：
  - `button.label.color.idle` / `button.root.surface.idle`
  - `button.label.color.idle` / `button.root.surface.hover`
  - `on-surface` / `surface`
  - `on-surface-muted` / `surface`
  - `placeholder` / input surface
  - success/warning/error/info 状态文本与对应 surface
- 增加 `color-scheme: dark` 与 `data-chips-theme-id` 相关静态断言可继续保留。

### `ThemePack/Chips-theme-default-dark/tests/tokens.spec.ts`

- 保留关键 token 抽样。
- 增加从 contract required token 自动断言 `dist/tokens.json` 覆盖的测试。
- 增加 `sys` 状态色存在性测试。

### `ThemePack/Chips-theme-default-dark/技术文档/*`

- 更新 70 组件真实基线。
- 修正旧工作区绝对路径引用，尽量改为相对路径或当前仓库内路径。
- 记录暗色主题如何消费组件库 contract、token、Theme Runtime，而不重复定义公共协议。
- 补充命令消费组件样式、状态色、对比度校验和矩阵测试策略。

### `ThemePack/Chips-theme-default-dark/需求文档/*`

- 将视觉规范从“核心组件与卡片显示容器”扩展到任务021要求的：
  - 应用窗口
  - 卡片 iframe
  - 箱子布局
  - 设置面板
  - 预览面板
  - 性能诊断面板
  - 菜单/工具栏/表单/弹层/焦点/状态色

### `生态共用技术文档/主题系统/*`

只有在任务021正式实施中新增跨主题、跨生态的公共 token 口径时才更新。

候选公共沉淀：

- 暗色/浅色主题共同需要的 `sys` 状态色命名。
- 主题包 CSS scope 覆盖测试要求。
- `theme.getAllCss` 与 `theme.resolve` 组合消费模型的更明确说明。

### `生态共用技术文档/组件库/03-Token与主题对接标准.md`

只有当组件库公共 token 命名或 required token 规则变化时更新。若只是暗色主题值调整，不应写入公共文档。

## 5. 验证命令建议

任务021正式实施后建议按顺序运行：

```bash
cd ThemePack/Chips-theme-default-dark
npm run build
npm run validate:theme
npm test
```

然后运行组件库 contract 与质量门禁：

```bash
cd ../../Chips-ComponentLibrary
npm run validate:contracts
npm run test:contracts
npm run quality:gate
```

如任务021同步修改了公共文档或 Host 主题链路，建议追加：

```bash
cd ../Chips-Host
npm run build
npm test
npm run test:contract
```

可选的只读/低副作用检查：

```bash
cd Chips-ComponentLibrary
node scripts/validate-official-theme-contracts.mjs
```

说明：

- `ThemePack/Chips-theme-default-dark/npm test` 当前包含 `tests/build.spec.ts`，会执行 `npm run build` 并改写 `dist`。
- `Chips-ComponentLibrary/npm run quality:gate` 可能生成 `reports/quality-gate/*.json`。
- 预研阶段本轮仅运行了 `npm run validate:theme` 和 `node scripts/validate-official-theme-contracts.mjs`。

## 6. 风险 / 需新增工单候选

### 6.1 暂不建议立即新增工单的事项

1. 暗色主题 CSS 缺 `toolbar/menu-bar/context-menu/shortcut`。
   - 性质：任务021范围内的直接实现缺口。
   - 建议：由任务021正式修复，不单独开生态缺陷工单。

2. 暗色 `sys` 状态色不完整。
   - 性质：任务021明确要求重新设计暗色 `sys` 颜色层。
   - 建议：若只调整暗色主题值，在任务021内完成；若要冻结跨主题公共命名，再同步公共文档。

3. 内部文档 46 组件旧口径。
   - 性质：暗色主题包内部文档漂移。
   - 建议：任务021收尾时更新内部文档。

### 6.2 可考虑新增或补充工单的事项

1. 主题包 contract 生成链路仍依赖本地复制文件。
   - 证据：默认主题与暗色主题均读取 `contracts/theme-interface.contract.json` 作为输入。
   - 影响：虽然当前等值，但后续新增组件时可能漂移。
   - 建议：若任务020未提供统一生成脚本/API，需要登记“官方 ThemePack contract 由组件库正式 contract 生成”工单。

2. Host 与组件库各自维护 contract guard / validator。
   - 证据：`Chips-Host/src/main/theme-runtime/contract-guard.ts` 与 `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js` 都实现 contract view、coverage、missing token 诊断。
   - 影响：当前 schema 基本一致，但 future fields 如 a11y/motion constraints 扩展时容易漂移。
   - 建议：若任务008/任务020未收口，可登记 Host 与 `@chips/theme-contracts` golden schema 对照或共享 validator 的工单。

3. 公共 `@chips/tokens` 构建产物异常需要复核。
   - 本轮读取 `Chips-ComponentLibrary/packages/tokens/dist/json/tokens.json` 时发现按当前脚本取 `ref/sys/motion/layout/comp` 五层得到 0 个 key，可能是产物结构与 ThemePack 五层结构不同，或 dist 已陈旧。
   - 因任务021主要消费 ThemePack 源 token 与组件 contract，本轮未展开。
   - 建议：如果任务020/组件库 token 任务未处理，需要登记或补充“组件库 tokens dist 与 ThemePack 五层结构口径复核”工单。

4. `.cpk-stage` 暂存目录含旧 `form-field/form-group` 口径。
   - 如果 `.cpk-stage` 仍被正式打包流程消费，则是发布风险。
   - 如果它只是历史暂存，可在任务021正式打包时重新生成或归档。
   - 建议：先由任务021核对 `chipsdev package` 当前真实打包输入，再决定是否登记工单。

## 7. 可直接复用任务020成果的点

任务020默认主题包升级成果可以直接复用到任务021，但需要避免复制浅色视觉值。

可复用：

- Contract 等值校验思路：
  - 读取组件库正式 contract 目录。
  - 比对 `component/scope/parts/states/requiredTokens/optionalTokens`。
  - 同步校验 `theme-min-functional-set.json`。

- `validate:theme` 统一 validator 链路：
  - 继续使用 `buildThemeContractView`。
  - 继续输出 `ThemeDiagnosticSummary`。
  - 继续用 `THEME_REQUIRED_TOKEN_MISSING` 阻断 required token 缺失。

- CSS scope 覆盖门禁：
  - 任务020预研中指出默认主题同样缺 `toolbar/menu-bar/context-menu/shortcut`。
  - 暗色主题可以复用同一测试工具，保证 70 个 contract scope 全部进入 `theme.css`。

- `build-css.ts` 文件排序修复：
  - 默认主题和暗色主题脚本结构一致，可复用同一实现。

- 图标字体链路：
  - 三套 Material Symbols variable font。
  - `dist/icons/variablefont/*.woff2`。
  - `@font-face` 注入。
  - `chips.sys.icon.*` 与 `chips.comp.icon.*` token。

- Motion 与 layout token：
  - 暗色主题当前 motion/layout 与默认主题无差异，可以沿用任务020对结构、测试和文档的处理。

- 文档更新框架：
  - 默认主题内部文档的 70 组件口径、CSS scope 覆盖、contract 唯一来源说明，可迁移到暗色主题文档。

不能直接复制：

- 浅色主题 `ref/sys/comp` 的具体颜色值。
- 主按钮、hover、selected、disabled、surface、menu、toolbar、popover、dialog 的视觉值。
- 对比度结论。暗色主题必须独立验证。

## 8. 本轮命令与结果

已运行：

```bash
cd ThemePack/Chips-theme-default-dark
npm run validate:theme
```

结果：

```text
Theme contract validation passed: 70 components, 630 required tokens.
```

已运行：

```bash
cd Chips-ComponentLibrary
node scripts/validate-official-theme-contracts.mjs
```

结果：

```text
[theme-contracts] official ThemePack contracts match 70 component contracts
```

未运行：

- `ThemePack/Chips-theme-default-dark/npm run build`
- `ThemePack/Chips-theme-default-dark/npm test`
- `Chips-ComponentLibrary/npm run quality:gate`
- `Chips-Host/npm run build`
- `Chips-Host/npm test`

原因：预研阶段要求不修改正式代码、不触碰任务020默认主题实现；上述部分命令会改写构建产物或生成报告文件，留给任务021正式实施阶段执行。

## 9. 工作区状态备注

预研开始和结束前均未执行 git 提交、分支切换、合并等操作。

本轮 `git status --short` 观察到已有非本任务变更：

- `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/*` 若干修改。
- `Chips-ComponentLibrary/reports/quality-gate/quality-gate-2026-05-24T054315664Z.json` 未跟踪。

这些文件不属于本预研任务范围，本轮未处理。
