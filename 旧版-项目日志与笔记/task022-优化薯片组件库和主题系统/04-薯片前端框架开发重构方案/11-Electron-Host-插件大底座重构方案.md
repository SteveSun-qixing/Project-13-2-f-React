# 重构方案：Electron / Host / 插件大底座

## 1. 重新调查依据

本章节重新核对了 Host、Bridge、插件、Manifest、SDK 和 L8/L9 当前文档后编写，重点确认以下口径：

- Host 主责 L1-L9。
- 插件运行时由 Host 统一托管。
- `surface` 是跨平台界面容器主语义。
- `window` 是 Desktop 兼容别名。
- Bridge 三层 L5-L7 由 Host 内置实现。
- SDK 只提供开发封装与调用入口。
- Host 已注册 19 个服务域。
- L8/L9 已有 Host 内部实现基础。

## 2. 重构目标

把薯片前端框架建立在 Host 大底座之上：

- 常用系统模块沉淀在 Host 服务域。
- 前端框架提供声明式消费入口。
- 插件通过 Bridge / Runtime Client / SDK 调用能力。
- Desktop 通过 Electron BrowserWindow 落地 surface，但公共 API 不绑定 BrowserWindow。
- L8/L9 Host 内置能力与组件库、主题系统、脚手架、预览工具打通。
- 上层应用尽量只写业务组合和特有逻辑，常用能力、常用交互、常用页面结构、常用数据接线都向底层沉淀。
- 当前优先补强 Host、SDK、Scaffold、ComponentLibrary、ThemePack 和插件体系的边界。预览、Web 同化、声明式应用结构等能力先作为现有项目中的模块、命令或应用插件能力落地；只有当能力规模需要独立发布和独立维护时，才重新评估是否拆为新项目。

## 3. 大底座分工

| 层级/模块 | 职责 |
|---|---|
| Electron / PAL | 平台能力落地，创建真实窗口、系统对话框、托盘、快捷键、文件关联 |
| Host Kernel | 路由、权限、事件、生命周期、超时、审计 |
| Host Services | file/resource/config/theme/i18n/surface/plugin/module/card/box 等通用模块 |
| Plugin Runtime | 插件安装、启停、会话、握手、权限、配额 |
| Bridge Transport | `window.chips.*` 公共接口形状 |
| Runtime Client | 请求封装、错误归一、返回解包、重试 |
| UI Hooks | React 开发者消费 Host 能力的入口 |
| Declarative UI / Unified Rendering | 声明树、验证、主题解析、布局计算、提交 |
| Component Library | 无头组件结构、状态机、a11y、contract |
| Theme Runtime | token、作用域链、CSS 注入、主题切换 |

## 4. 前端框架必须遵守的调用路径

正式调用路径：

```text
App/Page
  -> UI Hooks / SDK API
  -> Runtime Client
  -> window.chips.* / Bridge Transport
  -> Kernel Router
  -> Host Service
  -> PAL / Electron / Service Implementation
```

禁止：

- 组件直接 import Host 内部服务。
- 插件直接使用 Electron/Node 原生能力。
- 应用页面自己实现 bridge client。
- 服务之间直接 import 调用。
- 把 `window.*` 作为未来跨平台主语义继续扩展。

## 5. `surface` 优先的 App/Scene/Window 设计

App Framework 应以 `surface` 为中心，而不是以 BrowserWindow 为中心：

- `ChipsWindowGroup` 在 Desktop 下落为 `surface(kind=window)`。
- `ChipsRouteScene` 未来可落为 Web route。
- `ChipsSheetScene` 未来可落为 Mobile sheet。
- `ChipsDocumentScene` 使用 `surface.open(target=document)` 或 Host document/card/box 服务。
- `ChipsSettingsScene` 是一种 app scene，不等于固定 Electron 窗口实现。

## 6. Host 常用模块前端封装

需要为 Host 服务域提供统一 hooks/API：

- `useChipsSurface`
- `useChipsTransfer`
- `useChipsAssociation`
- `useChipsFile`
- `useChipsResource`
- `useChipsConfig`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsPlugin`
- `useChipsModule`
- `useChipsCard`
- `useChipsBox`
- `useChipsLog`
- `useChipsCredential`
- `useChipsControlPlane`

这些 hooks 只调用 Runtime Client，不承载 Host 主实现。

这些 hooks 的目标不是简单封装一层请求，而是减少上层应用代码量。常见工作流应继续形成更高层能力：

- `useOpenResource`
- `useDocumentScene`
- `useThemeReady`
- `useLocaleText`
- `usePluginInstallState`
- `useBoxEntries`
- `useCardRenderSession`
- `useImportQueue`
- `useExportTask`
- `useAppSettings`

这些高层能力可以由 SDK、UI Hooks 或 App Framework 提供，但真实运行时仍属于 Host。

## 7. 与组件库的关系

组件库中的系统型组件必须接受能力注入，而不是自己访问 Host：

- `ChipsResourcePicker` 通过 resource hook 注入数据。
- `ChipsDocumentScene` 通过 App Framework 和 Host document/card/box 链路。
- `ChipsPluginCard` 通过 plugin hook 获取状态。
- `ChipsThemePreview` 通过 theme runtime 和 Host theme 服务。
- `ChipsToolbarItem` 通过 command registry。

组件库继续保持 L10 无头定位。

## 8. 与主题系统的关系

Host preload 已承担插件窗口主题同步：

- 调用 `theme.getCurrent/getAllCss/resolve`。
- 注入主题 CSS。
- 写入 `data-chips-theme-id` 与 `data-chips-theme-version`。
- 注入解析后的 token 变量。
- 订阅 `theme.changed`。

前端框架应基于该注入状态初始化，而不是写死默认主题。

## 9. 与预览工具的关系

预览工具必须支持两种模式：

1. Host mock：快速预览组件、主题、页面。
2. 真实 chipsdev 工作区：启动真实 Electron Host、真实 Bridge、真实服务域和真实插件会话。

这样才能验证大底座链路，而不是只验证静态 React 组件。

## 10. 关键任务

1. 将 App Framework 以 `surface` 为中心重写文档口径。
2. 建立 Host service hooks 封装清单。
3. 将 L8/L9 内部能力产品化为应用脚手架默认入口。
4. 将组件库系统组件改为能力注入模式。
5. 将 preview 分为 Host mock 与真实 Host 两种模式。
6. 更新质量门禁，加入 Host integration smoke。
7. 梳理哪些能力应该沉淀到 Host 服务域，哪些只属于组件库。
8. 补强 SDK，使常用 Host 服务有类型安全、高层语义的调用入口。
9. 补强 Scaffold，使新应用默认获得 App/Scene/View/Theme/i18n/Preview/Test 基线。
10. 评估各能力域在 Host、SDK、Scaffold、ComponentLibrary、ThemePack 和应用插件中的落点；暂不默认新增独立前端框架、同化工具、预览工作台等项目。

## 11. 验收标准

- 新应用不直接依赖 Electron/Node。
- 新应用默认通过 `surface` 打开界面容器。
- 常用 Host 服务都有正式 hook/API。
- 组件库不直接承载 Host 服务实现。
- 预览工具能在真实 Host 下验证插件会话、Bridge、主题和 surface。
- 文档中不再把 `window` 当成长期跨平台主语义。
