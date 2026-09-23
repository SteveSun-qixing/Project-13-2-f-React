# @chips/ui（共享前端层）

> 版本：v1.0.1
> 日期：2026-09-23
> 状态：正式版
> 适用范围：`packages/ui` 的包定位、依赖边界、公开导出面（逐项与 `src/index.ts` 导出链一致）、分层职责、与 fork antd（`@chips/antd`）的关系、禁止事项与自检指引、常用命令；Design Tokens 数值以《09-统一视觉规范》为权威，导出与用法契约以《08-@chips-ui共享层使用指南》为权威，命令行为以《13-命令系统契约》为权威

---

## 一、定位与边界

`@chips/ui` 是薯片生态唯一共享前端层（前端唯一导入面，R4 / ADR-008）：双外观 Design Tokens、窗口运行环境（`ChipsProvider`）、命令运行时与 hooks（对齐《13-命令系统契约》§5.6）、16 个共享组件与工具、全局基础样式，并整集转发 fork antd 的组件白名单、图标集、`theme` 与 `App`。

- 依赖方向固定：`@chips/ui → @chips/antd → antd → React`；运行时依赖唯一 `@chips/antd`（workspace），`react` / `react-dom` 为 peer。本包不依赖 `@chips/sdk` / `@chips/bridge`（G9 架构边界门禁的 `packages/ui` 条目 `allowedInternal` 仅 `@chips/antd`，见 `tools/gates/gates.config.json`）。
- 包出口只有两个：`.`（`dist/index.js` / `dist/index.d.ts`）与 `./global.css`（`dist/global.css`）；`sideEffects` 只声明 `./dist/global.css`。
- 业务代码（平台壳、官方插件、示例插件）一律从 `@chips/ui` 导入组件、Hooks、令牌与图标；`@chips/antd` 仅本包可导入，由 ESLint `no-restricted-imports` 与 `packages/antd/scripts/check-boundary.mjs` 两道防线拦截。
- 主题系统与多语言系统已废弃（ADR-006）：本包无主题切换入口、无 i18n 运行时，浅色 / 深色由系统外观（`prefers-color-scheme`）驱动，界面文案简体中文直写。

## 二、目录与分层职责

```text
src/
├── index.ts        # 唯一公开入口（本文第三节逐项对齐此导出链）
├── base/           # `export * from '@chips/antd'` 转发面（组件白名单、图标、theme、App、CSS 变量契约）
├── tokens/         # Design Tokens 数值实现：appleTheme / appleThemeDark / resolveAppleTheme（apple-theme.ts）
│                   #   与毛玻璃手法基线（glass.ts，包内实现，不经包入口暴露）
├── theme/          # ChipsProvider 窗口运行环境、useChips 上下文、系统外观解析
├── command/        # 命令运行时：contract.ts 契约投影、runtime.ts、context.tsx（Provider 与视图 hook）、
│                   #   accelerator.ts 文法、params.ts 参数采集、platform-port.ts 端口解析、diagnostics.ts 诊断
├── components/     # 12 个组件目录、16 个共享组件（每目录 index.tsx + types.ts + index.test.tsx）
├── utils/          # toChipsUiFailure 失败归一
└── styles/         # global.css（全生态唯一全局基础样式，构建时拷入 dist/）
```

## 三、公开导出面（与 `src/index.ts` 逐项一致）

### 3.1 共享组件（16 个符号 + 2 个默认常量，Props 类型随组件导出）

| 组件目录                | 导出符号                                                                                      | 用途（详见《08》§2.1）                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `AppChrome`             | `AppChrome` + `AppChromeProps`                                                                | 应用窗口外壳：内容区 + 命令面板 + 底部区域                     |
| `BoxEmptyState`         | `BoxEmptyState` + `BoxEmptyStateProps`                                                        | 布局插件空箱子占位                                             |
| `CommandPalette`        | `CommandPalette`、`DEFAULT_COMMAND_GROUP`、`DEFAULT_PALETTE_SHORTCUT` + `CommandPaletteProps` | 命令面板：搜索、分组、参数采集与调用                           |
| `EmbeddedDocumentFrame` | `EmbeddedDocumentFrame` + `EmbeddedDocumentFrameProps`                                        | 受控文档帧：图片 / HTML 模式区域，固定比例与 `autoHeight` 测量 |
| `PanelHeader`           | `PanelHeader` + `PanelHeaderProps`                                                            | 面板标题、说明与操作区                                         |
| `SettingsGroup`         | `SettingsGroup` + `SettingsGroupProps`                                                        | 设置分组                                                       |
| `SettingsLayout`        | `SettingsLayout` + `SettingsLayoutProps`                                                      | 设置页骨架                                                     |
| `SettingsRow`           | `SettingsRow` + `SettingsRowProps`                                                            | 设置行：标签、说明与控件                                       |
| `Skeleton`              | `LayoutSkeleton`、`SkeletonBlock`、`SkeletonLine`、`SkeletonDot`、`EmptyHint` + 各 `*Props`   | 布局骨架容器、骨架原子与小字提示                               |
| `StartHome`             | `StartHome` + `StartHomeProps`                                                                | 无打开目标时的统一起始页                                       |
| `StateBoundary`         | `StateBoundary` + `StateBoundaryProps`                                                        | 加载 / 错误 / 空态边界（渲染顺序固定：加载→错误→空态→内容）    |
| `Toolbar`               | `Toolbar` + `ToolbarProps`                                                                    | 按 `toolbarId` 渲染命令视图按钮组                              |

### 3.2 Design Tokens 与窗口运行环境

- `tokens` 面：`appleTheme`（浅色基线）、`appleThemeDark`（深色基线）、`resolveAppleTheme(appearance)`、类型 `ChipsAppearance = 'light' | 'dark'`。数值唯一事实源是《09-统一视觉规范》§二、§三（实现在 `src/tokens/apple-theme.ts`）；业务代码只读，不得导入 `appleTheme` 自建主题根或覆盖其中 token。
- `theme` 面：`ChipsProvider` / `ChipsProviderProps`（窗口级 UI 根环境，挂载契约见《08》§3.1）、`useChips()` / `ChipsContext` / `ChipsContextValue` / `ChipsSurface`、`DARK_APPEARANCE_QUERY` / `readSystemAppearance` / `useSystemAppearance`。
- 令牌消费方式只有 `theme.useToken()`（`theme` 经转发面可达）；毛玻璃手法集中在 `src/tokens/glass.ts`，为包内实现，不经包入口暴露。

### 3.3 命令运行时面（`src/command/index.ts`）

- 值导出：`CommandProvider`（可选 `port?: ICommandBridgePort` 供平台壳注入与测试替身，缺省从 `window.chips` 解析）、`useCommandRuntime()`、`formatAccelerator`、`resolveCommandBridgePort`。
- 类型导出（与《13》§2、§3.2、§5.6 逐字段对齐的 `src/command/contract.ts` 投影）：`CommandLocalHandler`、`CommandScopeKind`、`CommandSource`、`CommandTarget`、`ICommandBridgePort`、`ICommandCondition`、`ICommandContext`、`ICommandDefinition`、`ICommandDiagnostic`、`ICommandGetInput`、`ICommandGetOutput`、`ICommandInvokedPayload`、`ICommandInvokeInput`、`ICommandInvokeOutput`、`ICommandListInput`、`ICommandListOutput`、`ICommandLocalRegistration`、`ICommandMenuPlacement`、`ICommandOwner`、`ICommandRuntime`、`ICommandScope`、`ICommandState`、`ICommandSubscription`、`ICommandToolbarPlacement`、`ICommandView`、`ICommandWhen`。
- `ICommandRuntime` / `ICommandLocalRegistration` / `CommandLocalHandler` 按《13》§5.6 由本包导出；`ICommandDefinition` 等插件侧权威导出落位 `@chips/sdk`（本包为结构等价投影，双源收口口径见 `开发日志.md`「遗留复核」第 3 条）。`ICommandSubscription` 为本包对《01-Bridge-API规范》§2.3 `ISubscription` 的等价改名（避免同名双源）。
- 内部实现面（不经包入口暴露，包内组件直接引用）：`useCommandViews`、`createCommandRuntime`、`COMMAND_VIEW_REFRESH_EVENTS`、accelerator 解析 / 归一 / 匹配（`isValidAccelerator` / `normalizeAccelerator` / `matchesAccelerator` / `isEditableContext`）与参数采集函数（`describeCommandParams` 等）。

### 3.4 工具与转发面

- `utils` 面：`toChipsUiFailure(error, fallbackMessage)` 与类型 `ChipsUiFailure { code, message }`（与 `ChipsError` 结构兼容；本包不依赖 `@chips/sdk`，按结构接收）。
- `base` 转发面（`export * from '@chips/antd'`）：fork 组件白名单（当前 42 项，含 `App`；可用集合以 `packages/antd/src/components/index.ts` 为唯一实现事实源，《08》§2.6 只保证常用组件契约稳定，静态成员随组件转发）与 Props 类型、配套图标整集、`theme`（只用 `theme.useToken()`）、`App`（只用 `App.useApp()`）、`GlobalToken` / `ThemeConfig` / `MappingAlgorithm` 类型与 fork 类型工具 `GetProp` / `GetProps` / `GetRef`（`packages/antd/src/components/index.ts:107`），以及 CSS 变量契约 `CHIPS_CSS_VAR_PREFIX` / `CHIPS_CSS_VAR_KEY` / `toChipsCssVarName`——后者是渲染帧令牌注入与平台壳样式挂接的唯一可达路径。
- `global.css`：`import '@chips/ui/global.css'` 只允许平台壳窗口渲染层执行一次（《08》§六 06）；插件与业务组件不得导入任何全局样式或样式文件。

## 四、最小用法

```tsx
import React from 'react';
import { AppChrome, ChipsProvider, Toolbar } from '@chips/ui';

const APP_ID = 'chips.example.doc-viewer';

export const AppRoot: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <AppChrome footer={<span>就绪</span>}>
      <Toolbar toolbarId="doc-viewer:main" />
    </AppChrome>
  </ChipsProvider>
);
```

命令消费（面板 / 工具栏 / `attach` 本地处理器）的完整装配顺序与行为边界见《08-@chips-ui共享层使用指南》§3、§7；本包不在示例之外另立第二套用法。

## 五、与 fork antd（`@chips/antd`）的关系

- `@chips/antd` 是生态对上游 antd 的 fork（版本 `<上游>-chips.N`），唯一合法使用方是本包；业务代码把转发的组件视为 `@chips/ui` 自己的 API，不感知 fork 版本（《08》§五）。
- 主题根安装机制在 fork 侧：`ChipsThemeRoot` 独占 `locale`、`App` 上下文、CSS 变量作用域（`--chips-*`、`.css-var-chips`）与单实例优化；本包 `ChipsProvider` 是其唯一业务可达的装载入口。`ChipsThemeRoot` / `validateChipsThemeConfig` 虽随转发面可达，业务代码不得直接使用（自建主题根属禁止事项）。
- 帧内令牌注入契约：fork 的 `toChipsCssVarName`（`packages/antd/src/theme/css-vars.ts`）定义 `--chips-*` 命名；host 侧落地在 `packages/host/src/renderer/entries/frame.ts`（`applyTokens` 逐令牌写入帧文档根，集成波：金链路刀4b / #100、#112 一线），本包只提供同一套主题配置与命名契约。
- 视觉数值的唯一事实源是 `src/tokens/`（`packages/antd` 不定义数值）；fork 侧升级与补丁流程见 `../antd/README.md` 与 `patches/README.md`。

## 六、禁止事项（摘要）

完整清单见《08-@chips-ui共享层使用指南》§六（01–13），与本包直接相关的底线：

1. 不得绕开唯一导入面导入 `antd`、`@chips/antd`、第二套组件库或独立图标包；
2. 不得自建主题根 / `ConfigProvider` / 主题包 / i18n 运行时，不得复制或覆盖 `src/tokens/` 数值；
3. 不得在组件中出现硬编码颜色、间距、字号、圆角、阴影、动效（一律 `theme.useToken()`）；不得使用 CSS Modules 与独立样式文件（`global.css` 除外且只由平台壳导入）;
4. 不得在插件内复制共享组件实现；
5. 不得导出或使用第二套命令模型、命令注册表 API 或自实现按键匹配——命令一律经平台注册表与 `@chips/sdk` 类型；
6. 界面不得按操作系统名或窗口外形做分支（跨端差异由平台壳吸收）。

## 七、自检与验收指引

- 交付自检：对照《08-@chips-ui共享层使用指南》§八 8.2 自检清单逐条勾选（唯一导入面、`ChipsProvider` 单次挂载、命令配对与撤销、accelerator 文法、无硬编码样式、简体中文直写）。
- 视觉验收：对照《09-统一视觉规范》§四 V1–V12（跨插件一致性、Token 合规、导入合规、状态齐全、焦点与键盘、弹层层级、阴影与玻璃、中文排版、动效、深色适配、语义色、图标与素材）。
- 门禁口径：`lint`（ESLint + prettier，prettier 忽略面走仓库根单一事实源 `.prettierignore`，工单010 收口）；`test:coverage` 以 `@chips/testing` 工厂 `tier: 'shared'` 的包级四维 90% 为本地守卫，权威判定为根 `pnpm gates:coverage`（G6，shared 组聚合 `packages/ui/` + `packages/bridge/`，工单017 口径）。

## 八、常用命令

```bash
# 工作区要求 pnpm ≥ 9（仓库外默认 pnpm 8.x 属在册假红判例，走 volta PATH）
pnpm --filter @chips/ui run typecheck        # tsc -b
pnpm --filter @chips/ui run lint             # eslint . && prettier --check .
pnpm --filter @chips/ui run test             # vitest run --configLoader runner
pnpm --filter @chips/ui run test:coverage    # 共享层 tier 四维 90% 本地守卫
pnpm --filter @chips/ui run build            # tsc -p tsconfig.build.json + 拷贝 global.css 到 dist/
pnpm --filter @chips/ui run clean            # 清理 dist / coverage / tsbuildinfo
```

## 九、相关文档

- [开发计划](./开发计划.md)
- [开发日志](./开发日志.md)
- [08-@chips-ui 共享层使用指南](../../../薯片生态文档库/02-开发规范/08-@chips-ui共享层使用指南.md)
- [09-统一视觉规范](../../../薯片生态文档库/02-开发规范/09-统一视觉规范.md)
- [13-命令系统契约](../../../薯片生态文档库/05-接口与契约/13-命令系统契约.md)
- [01-代码组织规范](../../../薯片生态文档库/02-开发规范/01-代码组织规范.md)
- [ADR-008：React + fork antd 前端技术栈](../../../薯片生态文档库/01-架构设计/ADR/ADR-008-React加fork-antd前端技术栈.md)
- [ADR-006：主题系统与多语言系统废弃](../../../薯片生态文档库/01-架构设计/ADR/ADR-006-主题系统与多语言系统.md)
- [fork antd 包 README](../antd/README.md)

---

**文档结束**
