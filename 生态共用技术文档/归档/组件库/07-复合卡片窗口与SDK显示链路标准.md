# 复合卡片窗口与 SDK 显示链路标准

## 1. 组件定义

`CompositeCardWindow` 是生态对外公开的通用复合卡片显示组件，最终向应用层交付一个由 Host 托管的复合 iframe 窗口。

适用范围：

- 查看器等查看态应用；
- 需要 Host 托管复合卡片显示的应用插件；
- 第三方集成场景；
- 需要消费正式 `chips.composite:*` 事件协议的场景。

不适用范围：

- 官方编辑引擎的编辑态复合卡片窗口。

编辑引擎的正式编辑态链路遵循 `生态共用技术文档/组件库/08-编辑引擎基础卡片装配与编辑运行时标准.md`。

## 2. 链路原则

- 通用应用层统一通过 SDK 调用卡片显示接口；
- Host 是通用复合卡片渲染、主题解析和窗口编排的唯一执行方；
- 主题必须贯穿应用壳层、复合卡片 iframe、基础卡片 iframe 和原生窗口；
- 除官方编辑引擎编辑态链路外，不允许应用层自行实现第二套复合 iframe 拼接、主题注入或兼容分支。

## 3. 标准链路

1. 应用获得卡片文件路径；
2. 应用调用 `client.card.compositeWindow.render({ cardFile, mode, interactionPolicy? })`；
3. Host 解析复合卡片结构；
4. Host 依据 `capabilities.cardTypes` 分发到基础卡片插件；
5. Host 先为每个基础卡片生成独立的单卡运行时文档，并在该文档内挂载插件 `renderBasecardView`；
6. Host 复合层只负责拼接这些单卡 iframe 区域，不再在复合链路中把基础卡片预渲染成静态 HTML；
7. Host 拼接复合卡片文档，并把复合文档与各基础卡片节点文档持久化到一次独立的 render session；
8. Host 返回 `{ view: { documentUrl, sessionId, ... } }`，其中 `documentUrl` 指向 render session 中的复合文档入口；
9. `CompositeCardWindow` 必须直接把 `documentUrl` 写入 `iframe.src` 挂载最终 iframe，禁止再把 Host HTML 二次包装为 `blob:` 或 `srcdoc`；
10. 当 iframe 被显式销毁、页面 `pagehide` 或 DOM 节点移除时，SDK 必须通过 `card.releaseRenderSession(sessionId)` 回收 render session；
11. 当主题运行时缓存键变化时，`CompositeCardWindow` 重新触发整条渲染链。

`documentUrl` 正式约束补充：

- `documentUrl` 是 Host 托管的正式文档入口 URL，不要求固定为 `file://`；
- 在 Electron Host 中，复合文档、基础卡片节点文档以及卡片根目录资源，当前正式通过 Host 注册的受控渲染协议 URL 交付，避免沙箱 iframe 继续直接访问本地 `file://` 子文档时被 Chromium 拦截；
- SDK 与应用层只能把 `documentUrl` 视为“可直接挂载的独立文档 URL”，不得依赖其协议前缀、目录结构或磁盘落点。
- 消费 `documentUrl`、`coverUrl` 或 Host 托管编辑器文档的应用壳层页面，其 CSP 必须显式允许正式受控渲染协议（当前为 `chips-render:`）出现在至少 `frame-src` 中；若壳层还会直接消费该协议下的图片、字体或其他子资源，也必须同步放行对应指令。

## 4. 主题同步链路

正式主题同步顺序如下：

1. Host `theme.getCurrent/getAllCss/resolve` 产出当前主题快照；
2. preload 将主题 CSS、变量和 `data-chips-theme-id`、`data-chips-theme-version` 注入应用文档；
3. 应用 `ChipsThemeProvider` 以 Host 当前主题初始化；
4. 组件库主题运行时生成缓存键；
5. `CompositeCardWindow` 监听缓存键变化后重新渲染复合卡片 iframe；
6. Host 卡片渲染服务把主题包 CSS 与解析后的变量一并注入复合文档和基础卡片文档；
7. 主题包自身的 `color-scheme` 必须保留，不得被渲染服务覆盖。

## 5. 基础卡片插件职责

每个基础卡片插件包应完整提供：

- `renderBasecardView`
- `renderBasecardEditor`
- 信息与配置文件
- 内容模板
- 参数表与填写说明

通用能力可以通过公共模块复用，但基础卡片业务代码必须在插件包内闭环。

其中：

- Host 通用显示链路会把插件导出包装到正式 iframe 文档中；
- 官方编辑引擎会按 `08` 号文档定义，静态注册并消费同一组导出；
- 普通应用和第三方集成不得自行扫描插件目录并直接 import 插件源码。

## 6. 组件契约

- `data-scope="composite-card-window"`
- `data-part="root|iframe|overlay|status"`
- `data-state="idle|resolving|rendering|ready|degraded|error|disabled"`

## 7. 节点解析与装配规则

- `structure.yaml` 中的 `structure[].type` 与内容文件中的 `card_type` 是复合卡片层节点类型标识；
- Host 分发时使用插件 `capabilities.cardTypes` 进行匹配；
- 当前正式匹配规则：
  - 先尝试直接匹配原始 `type/card_type`
  - 若节点类型满足 `*Card` 命名，再生成 `base.<去掉 Card 后的小写紧凑名>` 作为补充候选

例如：

- `RichTextCard` -> `base.richtext`
- `ImageCard` -> `base.image`
- `VideoCard` -> `base.video`

## 8. 运行时要求

- 外层只向应用层交付一个复合 iframe；
- 顶层复合 iframe 文档必须作为独立文档上下文加载，禁止应用层通过 `srcdoc` 直接内联 Host HTML，避免宿主应用 CSP 继承后阻断正式渲染脚本；
- 顶层复合 iframe 当前正式 sandbox 策略为 `allow-scripts allow-forms`，不得加入 `allow-same-origin`，避免沙箱逃逸告警与父子文档同源耦合；
- 每个基础卡片节点在复合文档内部保持独立 iframe，以便失败隔离和尺寸回传；
- 复合文档内部的基础卡片 iframe 也必须通过独立文档 URL 挂载，不得继续把单卡文档写入 `srcdoc`，否则单卡脚本仍会继承上层 CSP 而被阻断；
- 复合文档内部基础卡片 iframe 当前正式 sandbox 策略为 `allow-scripts allow-popups`，同样不得加入 `allow-same-origin`；
- 基础卡片的真实渲染职责属于单卡运行时文档；复合文档只消费这些单卡文档并做区域装配，不得在复合链路里把节点提前拍扁成静态 HTML 片段；
- 复合文档正式只承担基础卡片节点编排职责，不额外输出卡片标题、基础卡片计数、节点外框或其他壳层装饰；
- 对引用卡片内部资源的基础卡片，Host 必须向单卡文档提供可解析卡片根目录相对路径的资源基准地址；
- 单卡文档运行时必须允许资源基准地址是相对 URL，并按当前单卡文档 URL 归一为绝对资源 URL；`openResource(...)` 收到基础卡片传入的相对资源标识时，也必须用同一资源基准归一后再发出 `chips.basecard:resource-open`，确保社区 Web 离线缓存仍能启动图片查看器、音乐播放器等资源处理应用；
- 若输入是打包态 `.card` 文件，Host 为复合渲染解析出的卡片根目录必须在复合 iframe 生命周期内保持稳定可访问，不能在 `card.render(...)` 返回前提前清理；
- 节点加载完成后向复合窗口回传高度；
- 节点高度回传必须覆盖容器宽度变化引发的重排，确保图片等按宽度缩放的基础卡片在显示区域收窄或放宽时同步更新高度；
- 复合文档在初始装载、节点高度变化和整体布局变化后，必须向外层发送 `chips.composite:resize`，回传整张复合卡片当前总高度；
- 当复合卡片窗口被应用插件作为文档型 surface 嵌入网页宿主时，应用侧最外层文档承载组件必须再把 `chips.composite:resize` 转换为正式 `plugin.surface.resize` 文档高度事件；转换时不得直接透传内部复合高度，必须测量应用壳层真实文档流，并加入主题 token 驱动的底部阅读安全区；
- 全部节点就绪后发送 `chips.composite:ready`；
- 当 `interactionPolicy = 'delegate'` 时，基础卡片 iframe 与复合壳层内部发生的滚轮、触摸滚动、捏合缩放等正式交互意图，必须通过 `chips.composite:interaction` 回传到应用壳层；
- 复合卡片处于 `mode: 'preview'` 时，基础卡片节点被点击后必须发送 `chips.composite:node-select`；
- 单节点失败时发送 `chips.composite:node-error`，同时在对应位置输出降级内容；
- 整体严重错误时发送 `chips.composite:fatal-error`。
- 由于正式复合文档和基础卡片文档都运行在 sandbox iframe 文档上下文中，消息 `origin` 可能为 `null`；应用层必须通过 SDK 事件接口消费这些事件，不得假设 iframe 与应用壳层同源。

`interactionPolicy` 约束：

- `native`：保持复合卡片内部原生滚动/触摸行为，不向应用壳层代理交互意图；
- `delegate`：由 Host 复合文档统一归一化基础卡片 iframe 与复合壳层的交互意图，再通过正式协议发送给应用壳层；
- 查看器、普通局部滚动容器等默认应使用 `native`；
- 需要把复合卡片内部滚动解释为外层桌面平移/缩放的通用应用场景，才使用 `delegate`。

### 8.1 文档型宿主滚动与高度收口

复合卡片在社区网页、插件路由页等文档型宿主中显示时，滚动所有权应收口到最外层宿主页面：

1. `/cards/:cardId`、插件路由页或其他文档型宿主保持普通 document flow；
2. `CompositeCardWindow` 或承载它的应用壳层不得再制造一个中间全高滚动小窗；
3. 内部复合 iframe 只负责根据 `chips.composite:resize` 反映复合内容高度；
4. 本地文件查看链路通过 SDK `client.document.window.onResize(...)` 消费卡片 `chips.composite:resize` 或箱子 `chips.box-layout:resize`，再由查看器文档 Surface 撑开 iframe；
5. 应用壳层最外层文档承载组件负责测量真实文档高度，并通过 `plugin.surface.resize` 发布给宿主；
6. 网页基础卡片等“内容本身需要内部浏览”的节点，可以在节点自己的受控区域内滚动，但这不改变卡片查看页的主滚动所有权。

`plugin.surface.resize` 的公共载荷与调度规则以 `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md` 为准。复合卡片窗口标准只规定它和 `chips.composite:resize` 的衔接关系。

### 8.2 查看器壳层与社区宿主关系

卡片查看器是卡片与箱子的统一查看壳层。社区网页、插件路由页等外部宿主不得再实现卡片/箱子专属查看 UI，只负责解析公开路由、创建查看器插件会话和承载插件 surface。

正式关系：

1. 本地 `.card` / `.box` 通过 `launchParams.cardSource.kind = "local-file"` 进入查看器；
2. 社区 `/cards/:cardId` / `/boxes/:boxId` 保持公开语义路由，但只创建 `com.chips.card-viewer` 会话并传入 `community-card` / `community-box` 来源；
3. 查看器负责标题、日期、返回按钮、加载态、错误态和未来动作槽的状态治理；
4. Web 文档型宿主中，查看器通过 `plugin.chrome.update` 发布悬浮 chrome 状态，宿主在 iframe 外渲染固定定位按钮和信息药丸；
5. 真实卡片内容仍由 Host 复合卡片窗口渲染，真实箱子内容仍应由 Host 箱子布局文档链路渲染或由社区发布态正式文档来源承载。
6. 查看器的封面切换属于查看器壳层动作：本地来源通过 SDK / Host 封面 surface 链路读取封面，社区来源通过 `cardSource` 的封面字段消费社区受控封面产物，不进入复合卡片内容渲染链路。

## 9. 质量要求

- 复合卡片窗口、基础卡片内容和应用壳层必须共享同一主题来源；
- 主题切换后，卡片内容区与应用壳层的刷新结果必须一致；
- 原生窗口背景不得与内容窗口主题脱节；
- 不再保留旧版适配器兼容路径作为正式方案。

## 10. Host 托管编辑器面板链路

`client.card.editorPanel.render(...)` 是与 `CompositeCardWindow` 配套的 Host 托管编辑器 iframe 链路，适用于：

- 第三方宿主集成；
- 需要 Host 统一托管编辑器 iframe 的应用；
- 调试、嵌套检查或需要严格沿 `chips.card-editor:*` 协议通信的场景。

标准流程：

1. 应用调用 `client.card.editorPanel.render({ cardType, initialConfig, baseCardId, resources? })`；
2. Host 通过 `card.renderEditor` 路由到对应基础卡片插件；
3. Host 装载插件 `renderBasecardEditor` 并生成正式编辑器文档；
4. 编辑器文档通过正式 `chips.card-editor:resource-*` 协议向外请求资源解析、导入、删除和释放；
5. SDK 把该文档封装为 iframe，并在应用提供 `resources` 时挂接本地资源桥；
6. 应用通过 `chips.card-editor:*` 或 SDK 事件订阅接收状态与配置变化。

约束：

- 编辑器链路与显示链路必须共享同一插件能力匹配规则；
- `resourcePath` 一律使用相对于卡片根目录的路径；
- `resources` 属于 SDK 本地桥配置，不进入 Host `card.renderEditor` 正式输入契约；
- 普通应用与第三方集成不得绕过 SDK/Host 直接 import 基础卡片插件源码；
- 查看器等 Host 托管场景必须消费正式 iframe 事件协议，而不是私接 iframe 内部 DOM；
- 官方编辑引擎不再把 `editorPanel` 作为其正式主编辑链路。

## 11. 与编辑引擎链路的关系

- `CompositeCardWindow + editorPanel` 仍是生态公开的通用 Host 托管链路；
- 官方编辑引擎的编辑态链路改为“单卡 iframe 拼装 + 本地 EditorHost”，详见 `08` 号文档；
- 两条链路共享同一套 `cardType` 匹配规则、主题 token 来源和基础卡片插件导出；
- 编辑引擎的本地运行时是被正式定义的特例，不意味着其他应用可以自由复制第二套实现。
