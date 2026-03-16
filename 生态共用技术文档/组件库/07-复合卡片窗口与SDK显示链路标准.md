# 复合卡片窗口与 SDK 显示链路标准

## 1. 组件定义

`CompositeCardWindow` 是生态对外公开的通用复合卡片显示组件，向应用层交付一个由 Host 托管的复合 iframe 窗口。

适用范围：

- 查看器等查看态应用；
- 需要 Host 托管复合卡片显示的应用插件；
- 第三方集成场景；
- 需要消费正式 `chips.composite:*` 事件协议的场景。

不适用范围：

- 官方编辑引擎的编辑态复合卡片装配。

官方编辑引擎的编辑态链路遵循 `08-编辑引擎基础卡片装配与编辑运行时标准.md`。

## 2. 正式原则

- 通用应用层统一通过 SDK 调用卡片显示接口。
- Host 是复合卡片渲染、主题解析、插件分发与 iframe 拼接的唯一执行方。
- 普通应用不得自行复制第二套复合卡片拼接运行时。
- 官方编辑引擎虽然自行装配复合卡片窗口，但其单卡运行时仍由 Host `basecard.*` 会话接口提供。

## 3. 标准链路

1. 应用获得卡片文件路径。
2. 应用调用 `client.card.compositeWindow.render({ cardFile, mode, interactionPolicy? })`。
3. Host 解析复合卡片结构与内容配置。
4. Host 依据插件 `capabilities.cardTypes` 分发到基础卡片插件。
5. Host 为每个基础卡片生成独立 iframe。
6. Host 拼接复合卡片文档并返回复合 iframe。
7. `CompositeCardWindow` 挂载最终 iframe。
8. 当主题缓存键变化时，应用重新触发该渲染链。

## 4. 主题同步链路

正式主题同步顺序如下：

1. Host `theme.getCurrent/getAllCss/resolve` 产出当前主题快照。
2. preload 将主题 CSS、变量和 `data-chips-theme-*` 注入应用文档。
3. 应用 `ChipsThemeProvider` 以 Host 当前主题初始化。
4. 组件层或应用层以当前主题快照驱动视图。
5. `CompositeCardWindow` 在主题变化后重新调用 Host 渲染。
6. Host 卡片渲染服务把主题 CSS 与解析后的变量一并注入复合文档和基础卡片文档。

## 5. 基础卡片插件职责

每个基础卡片插件包应完整提供：

- `renderBasecardView`
- `renderBasecardEditor`
- `getBasecardDescriptor`
- `createInitialBasecardConfig`
- `normalizeBasecardConfig`
- `validateBasecardConfig`
- `collectReferencedResources`

其中：

- Host 通用显示链路会把插件导出包装到正式 iframe 文档中。
- Host 托管编辑器链路会装载 `renderBasecardEditor`。
- 官方编辑引擎会通过 Host `basecard.*` 会话接口消费同一组导出。
- 普通应用和第三方集成不得自行扫描插件目录并直接 import 插件源码。

## 6. 组件契约

- `data-scope="composite-card-window"`
- `data-part="root|iframe|overlay|status"`
- `data-state="idle|resolving|rendering|ready|degraded|error|disabled"`

## 7. 节点解析与装配规则

- `structure.yaml` 中的 `structure[].type` 与内容文件中的 `card_type` 是复合卡片层节点类型标识。
- Host 分发时仅使用插件 `capabilities.cardTypes` 与插件描述符 `cardType` 做正式精确匹配。
- `structure[].type`、内容文件 `card_type`、插件描述符 `cardType` 与 `capabilities.cardTypes` 必须保持同一正式类型值。

例如：

- `base.richtext`
- `base.image`
- `base.video`

## 8. 运行时要求

- 外层只向应用层交付一个复合 iframe。
- 每个基础卡片节点在复合文档内部保持独立 iframe，以便失败隔离和尺寸回传。
- 节点加载完成后向复合窗口回传高度。
- 复合文档在初始装载、节点高度变化和整体布局变化后，必须向外层发送 `chips.composite:resize`。
- 全部节点就绪后发送 `chips.composite:ready`。
- 当 `interactionPolicy = 'delegate'` 时，复合文档必须把内部交互意图统一回传为 `chips.composite:interaction`。
- `mode: 'preview'` 时，节点被点击后必须发送 `chips.composite:node-select`。
- 单节点失败时发送 `chips.composite:node-error` 并在对应位置输出降级内容。
- 整体严重错误时发送 `chips.composite:fatal-error`。

## 9. 资源规则

- 复合卡片与基础卡片配置中的内部资源路径统一以卡片根目录为基准记录。
- Host 生成的基础卡片文档必须保证这些路径按卡片根目录解析。
- 应用层不得自行把内部资源路径改写成系统绝对路径。
- 封面资源与基础卡片资源都保存在卡片根目录；`cover.html` 只是封面入口文件。

## 10. Host 托管编辑器面板链路

`client.card.editorPanel.render(...)` 是与 `CompositeCardWindow` 配套的 Host 托管编辑器 iframe 链路，适用于：

- 第三方宿主集成；
- 需要 Host 统一托管编辑器 iframe 的应用；
- 调试、嵌套检查或需要沿正式 `chips.card-editor:*` 协议通信的场景。

标准流程：

1. 应用调用 `client.card.editorPanel.render({ cardType, initialConfig, baseCardId, cardRootDir? })`。
2. Host 通过 `card.renderEditor` 路由到对应基础卡片插件。
3. Host 装载插件 `renderBasecardEditor` 并生成正式编辑器文档。
4. SDK 把该文档封装为 iframe。
5. 应用通过 `chips.card-editor:*` 或 SDK 事件订阅接收状态与配置变化。

约束：

- 编辑器链路与显示链路必须共享同一插件契约和正式类型匹配规则。
- 普通应用与第三方集成不得绕过 SDK/Host 直接 import 基础卡片插件源码。
- `cardRootDir` 用于让编辑器内的资源导入与资源解析遵循卡片根目录规则。

## 11. 与编辑引擎链路的关系

- `CompositeCardWindow + editorPanel + coverFrame` 仍是生态公开的通用 Host 托管链路。
- 官方编辑引擎编辑态改为“应用内装配复合卡片 + Host 托管单卡会话”。
- 两条链路共享同一套插件导出、主题 token、资源路径规则和正式协议。
- 编辑引擎的正式特例不意味着其他应用可以自由复制第二套本地运行时。
