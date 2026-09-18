# SDK与协议设计

## SDK的定位

薯片SDK让第三方开发者可以将薯片能力集成到自己的软件中。开发者可以在博客系统中支持显示卡片文件，在知识库软件中导入薯片卡片，在课程平台中用卡片制作课件。

同时，薯片SDK也是薯片生态内部使用的开发者工具包，主要面向薯片主机内部的应用插件和生态维护者，用于以类型安全的方式访问 Host 暴露的能力。

SDK 提供程序化的接口访问薯片生态的核心功能。开发者使用 SDK 可以在自己的应用中嵌入或调用薯片内容，实现内容的创建、编辑、查看等操作。SDK 屏蔽了底层的技术细节，提供简洁易用的编程接口。

当前 SDK 以 JavaScript/TypeScript 版本为主，优先服务于薯片生态内部的前端应用、插件开发，以及需要集成卡片显示能力的第三方应用场景。

## 架构归属声明（2026-03-06）

- Host 是运行时主载体：L1-L9（含 Runtime Client、声明式 UI、统一渲染）由 Host 内置实现。
- 组件库负责 L10 无头组件（状态机、结构、a11y）。
- SDK 仅是开发者工具包，负责类型化封装、脚手架与调用辅助，不承载运行时主实现。
- 用户设备只安装 Host 即可运行；SDK 仅在开发或第三方集成时按需使用。

## SDK能力封装

SDK封装了生态的核心能力，提供给开发者使用。

文件操作能力让开发者可以读取和写入卡片文件。开发者可以打开现有的卡片，修改内容，保存更新。开发者可以创建新的空白卡片，添加内容后保存。

内容渲染接入能力让开发者可以在自己的应用中显示卡片内容。SDK提供的是 Host 渲染能力的调用封装和集成接口，渲染主实现仍在 Host 内置运行时。

插件管理能力让开发者可以管理插件的安装和配置。开发者可以查询已安装的插件列表，获取插件信息，执行启用禁用等操作。

模块能力调用让开发者可以按 capability + method 访问 Host 托管的无界面能力模块。SDK 负责封装 provider 查询、能力解析、方法调用和异步任务管理。

主题能力已随 task030 收缩：主题系统废弃后，SDK 不再向插件暴露主题获取与应用接口；Host 的 theme 服务路由保留为内部能力（无主题包时返回空列表），渲染链路在缺省主题下以空主题上下文降级。插件侧视觉统一由 antd + `@chips/ui` 提供。

正式边界补充：

- `CompositeCardWindow` 与 `editorPanel` 仍然是 SDK 对外公开的通用 Host 托管链路；
- `EmbeddedDocumentFrame` 是统一受控文档 iframe 基组件，`CardCoverFrame` 只是其卡片封面专用包装；
- 箱子本体正式封面通过 `client.box.renderCover(boxFile)` 获取 `coverUrl`，由应用层交给 `EmbeddedDocumentFrame` 承载；
- 官方编辑引擎的编辑态预览与编辑链路不再把这两条接口作为主路径；
- 官方编辑引擎改为在应用内使用本地基础卡片运行时，但仍复用同一套基础卡片插件导出与 `cardType` 匹配规则。

## 协议标准

薯片协议是生态内部和外部通信的统一标准。

通信协议定义了请求和响应的格式。请求消息包含协议版本、消息ID、时间戳、服务名称、负载数据等信息。响应消息包含对应的请求ID、处理状态、返回数据、错误信息等。

路由机制规定消息的传递方式。所有请求都经过内核路由器转发。路由器根据服务名称查找对应的处理模块，将请求分发过去。处理完成后，结果沿原路返回给发起者。

事件机制支持异步通知。模块可以发布事件，其他模块可以订阅事件。事件用于状态变化通知、用户操作反馈以及异步任务进度通知等场景。

模块能力相关的正式协议分为两类：

- provider 发现与解析链路：
  - `module.listProviders`
  - `module.resolve`
- 方法调用与任务治理链路：
  - `module.invoke`
  - `module.job.get`
  - `module.job.cancel`

其中：

- 调用方必须按 capability + method 调用模块能力；
- Host 统一负责 provider 发现、默认 provider 选择、权限校验、schema 校验和结果归一；
- 若目标方法为异步任务，Host 返回 `jobId` 并通过事件流持续发布任务进度。
- 模块运行时内部访问 Host 正式服务动作时，不通过 SDK 或 Bridge，改为使用 Host 注入的 `ctx.host.invoke(action, payload?)`；
- 模块运行时内部调用其他模块能力时，继续使用 `ctx.module.invoke(...)` / `ctx.module.job.*`。

文档显示相关的正式协议分为四条正式链路：

- `card.render` / `client.card.compositeWindow.render(...)`：复合卡片显示链路
- `card.renderCover` / `client.card.coverFrame.render(...)`：封面显示链路
- `box.renderCover` / `client.box.renderCover(...)`：箱子本体封面显示链路
- `card.renderEditor` / `client.card.editorPanel.render(...)`：基础卡片编辑器链路

其中封面显示链路的正式约束是：

- Host 读取 `.card/cover.html` 并返回受控 `coverUrl`
- Host 读取 `.box/cover.html` 并通过 `box.renderCover` 返回受控 `coverUrl`
- SDK 使用 `coverUrl` 创建 iframe,不允许把正式卡片 / 箱子封面 HTML 直接当作字符串注入
- 封面内容只由 `cover.html` 决定,不自动接入主题和多语言系统
- `.card/cover.html` 与 `.box/cover.html` 中的相对路径分别按 `.card/` 与 `.box/` 目录解析
- `EmbeddedDocumentFrame` 可以承载受控 `src` 或受控 `srcDoc`，但正式卡片 / 箱子封面链路只能消费 Host 返回的 `coverUrl`

其中编辑器链路的正式资源约束是：

- 编辑器内部资源操作通过 `chips.card-editor:resource-request/resource-response/resource-release` 协议完成
- `resourcePath` 一律使用相对于卡片根目录的路径
- 当前正式动作只有 `resolve | import | delete`
- `import` 返回的 `path` 也是卡片根目录相对路径,例如 `cover.png`
- SDK `editorPanel.render({ resources })` 可以在本地桥接这组资源协议,但 `resources` 本身不进入 Host 正式 `card.renderEditor` 路由输入

## 集成使用场景

SDK 支持多种集成使用场景：

- 生态内部应用场景：
  - 在查看器等应用插件内部，通过统一显示接口调用 Host 渲染链路并展示卡片内容或箱子封面；
  - 在生态内部工具中，通过文件与资源能力操作 `.card` / `.box` 文件；
  - 在配置等生态内部模块中，通过统一接口访问 Host 服务域能力（theme/i18n 服务域为 Host 内部保留，插件侧不再消费）。
- 官方编辑引擎场景：
  - 编辑态复合卡片预览与编辑链路在应用内完成，不再把 `compositeWindow/editorPanel` 作为正式主链路；
  - 但编辑引擎仍通过 SDK/Bridge 访问文件、插件安装等通用能力。
- 第三方应用场景（以卡片显示为主）：
  - 在博客系统中，通过 SDK 调用卡片渲染能力，将卡片内容以 iframe 或其他形式嵌入页面；
  - 在知识库软件中，通过 SDK 导入或展示薯片卡片文件；
  - 在课程平台中，用卡片制作课件，并通过 SDK 提供的显示接口渲染卡片；
  - 在需要展示箱子入口或箱子封面的宿主中，通过 `client.box.renderCover(...)` 与 `EmbeddedDocumentFrame` 承载箱子正式封面。

第三方应用如何与 Host 建立具体通信通道（本地守护进程、Bridge、服务端接口等），可以根据实际部署场景选择；SDK 在设计上保持卡片显示与渲染链路的开放性，提供统一的调用与类型封装。
