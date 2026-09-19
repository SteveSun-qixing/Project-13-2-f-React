# 02-Host 与 SDK 现有能力基线

本文档冻结 2026-08-11 的 Host 服务域、动作路由、SDK API 封装面，以及生态内其他软件对这些能力的消费证据，作为「哪些能力已经公共化、哪些还没有」的判断基线。

## 1. Host 公开服务命名空间（来自 register-host-services.ts 路由注册表）

| 服务域 | 正式动作 | 备注 |
|---|---|---|
| `file` | read / write / stat / list / watch / mkdir / delete / move / copy | 系统原语，完备 |
| `resource` | resolve / open / readMetadata / readBinary / convertTiffToPng / extractVideoFrame | 已含 TIFF/视频帧转换 |
| `config` | get / set / batchSet / reset | 支持 user/workspace/system 三 scope |
| `theme` | list / apply / getCurrent / getAllCss / resolve / contract.get | task030 后全生态不再消费（废弃状态） |
| `i18n` | getCurrent / setCurrent / translate / listLocales | task030 后不再消费 |
| `command` | register / unregister / get / list / setState / invoke | 无 undo/redo 历史能力 |
| `surface` | open / focus / resize / setState / getState / close / list | 跨平台容器 |
| `transfer` | openPath / openExternal / revealInShell / share | |
| `association` | getCapabilities / openPath / openUrl | 文件关联 |
| `window` | open / focus / resize / setState / getState / close | |
| `plugin` | install / enable / disable / uninstall / query / list / get / launch / getShortcut / removeShortcut 等 | |
| `module` | listProviders / resolve / invoke / job.get / job.cancel | 无界面共享模块通道 |
| `platform` | getInfo / getCapabilities / getScreenInfo / listScreens / power* / renderHtmlToPdf / renderHtmlToImage / dialog* / clipboard* / shell* / notificationShow / tray* / shortcut* / ipc* | |
| `log` | write / query / export | |
| `credential` | get / set / delete / rotate | |
| `card` | pack / unpack / readMetadata / readInfo / parse / render / renderCover / renderEditor / releaseRenderSession / resolveDocumentPath / resolveResourceUrl / validate / open | **无「解包目录读写/编辑会话/持久化」动作** |
| `box` | pack / unpack / inspect / validate / readMetadata / renderCover / listLayoutDescriptors / readLayoutDescriptor / normalizeLayoutConfig / validateLayoutConfig / getLayoutInitialQuery / openView / renderLayoutFrame / renderLayoutEditor / releaseRenderSession / listEntries / readEntryDetail / renderEntryCover / openEntry / resolveEntryResource / readBoxAsset / prefetchEntries / closeView | **无「编辑会话/自动保存/条目增删改」动作** |
| `zip` | compress / extract / list | |
| `serializer` | encode / decode / validate | |
| `control-plane` | health / check / metrics / diagnose | |
| `cli.command` | list / get / resolve | |
| `cli.task` | 任务状态上报 | |

> 事件面（部分）：`theme.changed`、`plugin.init/ready/launched`、`command.registered/unregistered/changed/invoked`、`surface.opened`、`window.opened`、`module.runtime.started/stopped`、`module.job.*`、`module.provider.changed`。

## 2. SDK 封装面（chips-sdk `src/api/`）

| API | 方法要点 |
|---|---|
| `file` | read / write / stat / list / watch / mkdir / delete / move / copy（含二进制归一） |
| `resource` | resolve / open / readMetadata / readBinary / convertTiffToPng / extractVideoFrame |
| `card` | pack / unpack / readMetadata / readInfo / parse / validate / resolveDocumentPath / resolveResourceUrl / open / render / releaseRenderSession / coverFrame.render / compositeWindow.render + on* 事件 / editorPanel.render + on* 事件（含资源桥） |
| `box` | pack / unpack / inspect / validate / readMetadata / renderCover / listLayoutDescriptors / readLayoutDescriptor / normalizeLayoutConfig / validateLayoutConfig / getLayoutInitialQuery / openView / listEntries / readEntryDetail / renderEntryCover / renderEntryDocument / releaseEntryDocument / openEntry / resolveEntryResource / readBoxAsset / prefetchEntries / closeView / releaseRenderSession / documentWindow.render + on* / layoutEditorPanel.render + on* / editorPanel（资源桥） |
| `document` | detectType（.card/.box 后缀判断）/ window.render（统一卡片+箱子查看 iframe）+ onReady/onResize/onError/onResourceOpen/onNodeError |
| `window` | open / focus / resize / setState / getState / close |
| `config` | get / set / batchSet / reset |
| `theme` / `i18n` | 保留封装（废弃状态） |
| `command` | register / unregister / list / get / setState / invoke / onInvoked 等 |
| `surface` / `transfer` / `association` / `platform` / `plugin` / `module` / `zip` / `serializer` / `credential` / `log` / `control-plane` / `cliCommand` / `cliTask` / `icon` / `imageColor` / `communityCardTransfer` | 对应服务域封装 |

**SDK 缺口的直接证据**：SDK 没有任何「打开解包态卡片目录进行编辑、保存、资源增删」的 API——只有打包态 `card.pack/unpack` 和渲染态 `render*`。编辑会话、草稿、自动保存、资源生命周期等语义完全不在公共契约中。

## 3. 其他软件对 Host 能力的消费证据（「全生态共用」的现实基础）

### Chips-CardViewer（查看器）
- `client.document.detectType`、`client.document.window.render`（统一文档查看 iframe）
- `client.box.renderCover`、`client.box.readMetadata`
- `client.card.readInfo`
- `client.platform.openFile / saveFile / showMessage / getLaunchContext`

### Chips-MusicPlayer（音乐播放器）
- `client.platform.getInfo / getPathForFile / openFile / saveFile / getLaunchContext`
- `client.file.read / write / stat / list / mkdir / delete / copy`
- `client.resource.resolve / readBinary / convertTiffToPng`

### Chips-RichTextEditor（富文本编辑器）
- `client.card.editorPanel.render`（Host 编辑器 iframe）、`client.card.pack / unpack`
- `client.file.*` 全套、`client.platform.openFile / saveFile / showConfirm / shellOpenPath`

### Chips-CommunityClient（社区客户端）
- `client.card.open`（卡片打开路由）

### 结论
各软件已经在消费 Host 的**文件/资源/平台/渲染**能力，但**没有任何一个软件能消费编辑类文档能力**（卡片/箱子编辑会话、持久化、导入），因为 Host 根本没有提供。这正是本次能力上移的收益空间：一旦 Host 补齐文档编辑服务，查看器（展示编辑入口）、社区客户端（在线编辑）、第三方工具（批量编辑卡片元数据）都可以直接复用。

## 4. Host 内部已具备的实现素材（上移时可复用的已有代码）

| Host 内已有 | 位置 | 与编辑引擎自实现的差距 |
|---|---|---|
| CardService（parse/render/renderEditor/打包校验/渲染文档生成） | `Chips-Host/packages/card-service/src/card-service.ts`（2717 行） | 只处理打包态 `.card` 文件与渲染文档，**没有解包态目录的读写编辑持久化** |
| CardPacker（打包） | `Chips-Host/packages/card-packer/src/card-packer.ts`（342 行） | 只打包，不解析内容语义 |
| CardInfoService（信息） | `Chips-Host/packages/card-info-service/` | 只读信息 |
| BoxService（解包/检查/渲染/布局） | `Chips-Host/packages/box-service/src/box-service.ts`（2916 行） | 无编辑会话、无自动保存、无条目增删改 |
| ZipStore（ZIP 读写） | `Chips-Host/packages/zip-service/` | 原语，编辑引擎已通过 client.zip 复用 |
| resource 转换（TIFF/视频帧） | `Chips-Host/packages/resource-image-service`、`resource-open-service` | 已公共化 |
| 错误体系/ID/主题 CSS 工具 | `Chips-Host/src/shared/*` | 与编辑引擎 utils 重复 |

## 5. 基线小结

1. **已公共化**：文件、资源、转换、配置、插件、模块、平台、窗口、命令注册、卡片/箱子打包渲染查看——编辑引擎消费良好；
2. **未公共化（缺口）**：卡片/箱子文档的**编辑会话、草稿、自动保存、资源生命周期、元数据/结构序列化**、**ZIP 目录导入**、**封面生成与裁剪**、**undo/redo 文档历史**；
3. **废弃**：主题系统、多语言系统（task030 决策，不再作为上移候选）；
4. Host 内部已存在 CardService/BoxService 等实现素材，上移方向是「在已有包内补齐编辑会话能力」而非另起炉灶。
