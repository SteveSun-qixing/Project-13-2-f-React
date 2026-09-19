# Chips Host 对外接口基线

> 文档状态：vNext 已落地基线  
> 更新时间：2026-04-18

## 1. 适用范围

本文档冻结以下对外边界：

- 页面侧 `window.chips.*`
- `chips-sdk` 对 Host 的正式封装面
- `chips-host` 包对生态其他工程公开的宿主装配入口
- Host 公开动作命名空间与关键事件语义

## 2. 对外入口分层

| 层级 | 对外入口 | 消费方 |
|---|---|---|
| L5 | `window.chips.*` | 应用插件、卡片宿主、主题宿主 |
| L6-L7 | `chips-sdk` / Runtime Client | 插件业务层、UI 层 |
| Host Package | `chips-host/main`、`chips-host/host-core`、`chips-host/desktop-host-shell`、`chips-host/headless-host-shell` | 社区服务器、宿主集成、工具链 |
| CLI | `chips` | 用户与自动化脚本 |

## 3. Host Package 导出基线

当前 `chips-host` 对外公开以下装配入口：

- `chips-host/main`
- `chips-host/host-core`
- `chips-host/desktop-host-shell`
- `chips-host/headless-host-shell`
- `chips-host/host-application`
- `chips-host/card-service`

语义说明：

- `HostCore`：不绑定平台壳层的 Host 核心装配
- `DesktopHostShell`：桌面正式宿主
- `HeadlessHostShell`：社区服务器 / CI / 后台任务宿主
- `HostApplication`：当前等价于 `DesktopHostShell` 的兼容别名

## 4. Bridge 子域基线

当前公共 Bridge 子域如下：

- `window`
- `dialog`
- `plugin`
- `clipboard`
- `shell`
- `surface`
- `command`
- `transfer`
- `association`
- `platform`
- `notification`
- `tray`
- `shortcut`
- `ipc`

关键变化：

- `surface / transfer / association` 已成为正式新子域；
- `platform.getCapabilities()` 返回结构化能力快照；
- `window` 和 `shell` 继续保留，但属于 legacy 兼容层。

## 5. 公开服务命名空间

当前 Host 已公开的命名空间为：

- `file`
- `resource`
- `config`
- `theme`
- `i18n`
- `command`
- `surface`
- `transfer`
- `association`
- `window`
- `plugin`
- `module`
- `platform`
- `log`
- `credential`
- `card`
- `box`
- `office`
- `zip`
- `serializer`
- `control-plane`

## 6. 当前关键动作基线

### 6.1 `surface.*`

正式动作：

- `surface.open`
- `surface.focus`
- `surface.resize`
- `surface.setState`
- `surface.getState`
- `surface.close`
- `surface.list`

关键语义：

- `surface.open(target=plugin)` 会创建正式插件会话并调用 PAL `surface.open()`
- 该场景当前除 `window.control` 外，还要求 `plugin.manage`
- `surface.opened` 是新的统一容器事件

### 6.2 `plugin.launch`

`plugin.launch` 只用于 `type: app` 插件，并复用正式插件会话与 surface 启动链路。

当前返回：

```ts
{
  window: { id: string; chrome?: WindowChromeOptions };
  session: { sessionId: string; sessionNonce: string; permissions: string[] };
}
```

说明：

- 该返回结构保留了桌面兼容字段 `window`
- 新的跨平台主语义仍然推荐使用 `surface.open(target=plugin)`

### 6.3 `transfer.*`

正式动作：

- `transfer.openPath`
- `transfer.openExternal`
- `transfer.revealInShell`
- `transfer.share`

### 6.4 `command.*`

正式动作：

- `command.register`
- `command.unregister`
- `command.get`
- `command.list`
- `command.setState`
- `command.invoke`

关键语义：

- `command` 是菜单、工具栏、快捷键、命令面板和上下文菜单共享的运行时动作注册与调度语义；
- command 定义只允许使用 `titleKey / descriptionKey / ariaLabelKey` 等 i18n key，不允许注册原始展示文案；
- `icon` 必须是运行时 `IconDescriptor`，由组件库图标链路消费；
- `command.invoke` 由 Host 完成存在性、scope、服务级权限、命令级权限和 enabled/visible 状态校验后发出 `command.invoked`；
- 业务 handler 函数不得通过 Bridge 传给 Host，插件侧通过 SDK 监听 `command.invoked` 后执行本地业务处理。

标准权限：

- `command.read`
- `command.write`
- `command.invoke`
- `command.manage`

### 6.5 `association.*`

正式动作：

- `association.getCapabilities`
- `association.openPath`
- `association.openUrl`

### 6.6 `resource.*`

当前 `resource` 命名空间除 `resolve/open/readMetadata/readBinary` 外，新增正式动作：

- `resource.convertTiffToPng`

关键语义：

- `resource.resolve/readMetadata/readBinary` 必须同时支持本地文件路径、`file://` 本地资源，以及 Host 托管文档 URL，例如 `chips-render://...`；
- `resource.resolve` 对最终可落到本地文件的资源必须返回正式 `file://` 编码结果；若输入本身就是外部 URL，则保持原 URI；
- `resource.readBinary` 对 SDK 与应用层的正式语义始终是“返回裸字节”；若 Host / Bridge 内部为了传输经过 `Buffer` 包装或序列化，必须由 SDK 在调用侧统一解包，不得把包装对象暴露为公共契约；
- Host 负责校验输入是否为 TIFF，并把结果落盘为 PNG 文件；
- 调用方不直接感知底层平台实现，正式输入输出以共享契约文档为准。

### 6.7 `platform.*`

当前 `platform` 收口到平台原语与离屏导出：

- `platform.getInfo`
- `platform.getCapabilities`
- `platform.getScreenInfo`
- `platform.listScreens`
- `platform.powerGetState`
- `platform.powerSetPreventSleep`
- `platform.renderHtmlToPdf`
- `platform.renderHtmlToImage`

以及一组 Bridge legacy alias 对应动作：

- `platform.dialog*`
- `platform.clipboard*`
- `platform.shell*`
- `platform.notificationShow`
- `platform.tray*`
- `platform.shortcut*`
- `platform.ipc*`

### 6.8 `box.*` 统一文档链路补充

当前 `box` 命名空间已经正式公开以下统一文档链路动作：

- `box.listLayoutDescriptors`
- `box.readLayoutDescriptor`
- `box.normalizeLayoutConfig`
- `box.validateLayoutConfig`
- `box.getLayoutInitialQuery`
- `box.openView`
- `box.renderLayoutFrame`
- `box.renderLayoutEditor`
- `box.releaseRenderSession`
- `box.listEntries`
- `box.readEntryDetail`
- `box.renderEntryCover`
- `box.openEntry`
- `box.resolveEntryResource`
- `box.readBoxAsset`
- `box.prefetchEntries`
- `box.closeView`

关键约束：

- 布局描述符解析、布局配置归一/校验，以及查看态/编辑态文档生成，统一由 Host `box-service` 托管；
- `box.renderLayoutFrame` 与 `box.renderLayoutEditor` 返回的 `documentUrl` 是正式 iframe 入口，不允许上层退化为 `srcdoc` 或自行改写文档；
- `box.openEntry` 正式返回 `document-window | external`，并通过 `documentType` 区分打开的是卡片还是箱子；
- 通过 SDK `client.box.documentWindow.render` 或 `client.document.window.render` 创建的箱子查看文档，在销毁时必须释放 render session，并同步关闭对应 `box.openView` 查看会话。

### 6.9 卡片/箱子编辑会话与工作区（task034 新增）

正式动作：

- `card.init`：创建解包态卡片骨架（支持指定 `cardId`）
- `card.session.*`：open / get / updateBasicCard / addBasicCard / removeBasicCard / moveBasicCard / updateMetadata / updateCover / persist / undo / redo / history / close
- `box.create` / `box.rename`：箱子新建与重命名
- `box.session.*`：open / get / addEntry / addEmbeddedCard / updateEntry / moveEntry / removeEntry / updateMetadata / updateLayoutConfig / importAsset / deleteAsset / updateCover / persist / undo / redo / history / close
- `resource.importArchive`：ZIP 目录导入（payload 根探测/过滤/系统垃圾清理/暂存回滚）
- `workspace.scan`：工作区文件树扫描（卡片目录/`.card`/`.box`/文件夹识别 + Host 运行时目录排除）
- `workspace.getContext`：获取当前 Host 工作区根路径；插件不得自行推断工作区位置
- `file.detectType`：文件类型结构化识别（documentType/mimeType/category/extension/size）

办公文档由独立 `office.document.*` 会话链路承载，不属于卡片或箱子会话：

- `office.document.create/open/read/write/get/persist/close`
- `create` 默认在工作区 `documents/` 目录落盘完整初始字节；`read` 返回 `Uint8Array`
- 插件通过 `client.office` 使用会话，Host 不解析 DOCX/PPTX/XLSX/PDF 业务语义；详见《办公文档会话协议》

关键语义：

- 卡片/箱子编辑会话与自动保存由 Host 主进程管理，应用只订阅事件；
- 会话历史（undo/redo）为会话公共语义：入栈范围 = 文档变更动作，合并窗口 500ms（同一 mergeKey），历史上限 100 步；
- `box.session.addEmbeddedCard` 接口开放（默认链接引用，第三方可按需内嵌）；
- 会话工作目录由 Host 分配回收（系统临时区）；
- `resource.importArchive` 与 `zip.extract` 语义区分：extract 是原语（解到指定目录），importArchive 是业务语义（根探测/过滤/清理/回滚）；
- `workspace.scan` 识别规则：卡片目录 = 含 `.card/metadata.yaml`；排除清单见 `Chips-Host/packages/workspace-service/src/workspace-service.ts` 的 `HOST_RUNTIME_ROOT_ENTRIES`。
- `workspace.scan` 同时返回所有普通文件，文件节点包含 `extension/mimeType/category/documentType/size`；未知类型使用 `application/octet-stream`。

### 6.10 封面共享模块（task034 新增）

- 模块插件 `chips.module.cover`：capability `cover.html.generate`（createDefaultHtml/createImageHtml/collectReferences）+ `cover.ratio`（normalize/validate）；
- 消费方式：`client.module.invoke`；模块未安装时消费方回退内置实现（鲁棒优先）。

## 7. 事件基线

当前重要对外事件：

- `theme.changed`
- `plugin.init`
- `plugin.ready`
- `plugin.launched`
- `command.registered`
- `command.unregistered`
- `command.changed`
- `command.invoked`
- `surface.opened`
- `window.opened`
- `module.runtime.started`
- `module.runtime.stopped`
- `card.session.opened` / `dirty` / `persisted` / `persist-error` / `closed` / `undo` / `redo`
- `box.session.opened` / `dirty` / `persisted` / `persist-error` / `closed` / `undo` / `redo`
- `box.view.closed`（箱子查看会话关闭）

## 8. 当前宿主基线

当前已正式可用的宿主：

- Desktop Host Shell
- Headless Host Shell

当前已验证的 Headless 集成：

- 社区服务器 Host 集成使用 `HeadlessHostShell`

当前 Web / Mobile 仍属于目标宿主类型预留，相关 `runtime.targets`、`ui.surface.preferredKinds` 和 Bridge 形状已冻结，但当前仓内未交付对应 Shell 实现。

## 9. 质量门禁

1. 公开命名空间新增或变更时，必须同步更新 Bridge、SDK、Manifest 校验与共享文档。
2. 新的跨平台能力优先进入 `surface / transfer / association`，不得继续把异质能力堆入 `platform`。
3. 对外文档不得把 Electron 或 BrowserWindow 细节当作 Host 的公共语义。
