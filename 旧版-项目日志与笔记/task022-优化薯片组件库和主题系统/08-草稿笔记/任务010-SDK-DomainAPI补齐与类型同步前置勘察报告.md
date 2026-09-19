# SDK Domain API 补齐与类型同步前置勘察报告

生成时间：2026-05-23 23:22:21 CST (+0800)

勘察范围：只读核对 `Chips-SDK/src/api/*`、`Chips-SDK/src/core/client.ts`、`Chips-SDK/src/types/client.ts`、`Chips-SDK/src/index.ts`、`Chips-SDK/src/contracts/route-manifest.json`、SDK 测试、`Chips-Host/src/main/services/register-host-services.ts`、`Chips-Host/src/main/services/register-schemas.ts`、Host contract 测试，以及生态设计原稿和生态共用技术文档中与 Host 服务域、Bridge、主题、多语言、模块、文件转换、卡片、箱子、资源打开、命令系统相关的正式口径。

只读边界：本报告只写入当前草稿文件；未修改 SDK、Host、测试、公共文档、源码或 Git 分支状态。发现的架构风险仅记录在本报告中，未登记工单。

## 1. 当前 SDK Domain API 清单、入口、导出和测试覆盖

### 1.1 入口与导出

- `Chips-SDK/src/core/client.ts`：`createClient()` 组装 `document/file/card/theme/config/i18n/command/plugin/module/window/surface/transfer/association/platform/box/resource/zip` 17 个运行时 domain；`icon.ts` 仅提供类型。
- `Chips-SDK/src/types/client.ts`：`Client extends CoreClient` 声明上述 domain 属性，是 SDK public client 的类型入口。
- `Chips-SDK/src/index.ts`：导出所有 domain API 和主要 DTO 类型；`StandardError` 也从这里公开。
- `Chips-SDK/src/contracts/route-manifest.json`：SDK public route manifest，当前包含 159 个 action。
- `Chips-SDK/src/tooling/route-manifest.ts`：声明 `RouteDescriptorMeta` 可带 `schemaIn/schemaOut/idempotent/timeoutMs`，但当前 manifest 每条只有 `{ action }`。

### 1.2 Domain API 清单

| Domain | SDK 文件 | 当前 public API / 方法 | 当前 SDK 封装 action | 导出与测试覆盖 |
|---|---|---|---|---|
| association | `Chips-SDK/src/api/association.ts` | `getCapabilities/openPath/openUrl` | `association.getCapabilities/openPath/openUrl` | 类型已从 `src/index.ts` 导出；`tests/client.test.ts` 有基础覆盖。 |
| box | `Chips-SDK/src/api/box.ts` | `pack/unpack/inspect/validate/readMetadata/renderCover/listLayoutDescriptors/readLayoutDescriptor/normalizeLayoutConfig/validateLayoutConfig/getLayoutInitialQuery/openView/listEntries/readEntryDetail/renderEntryCover/openEntry/resolveEntryResource/readBoxAsset/prefetchEntries/closeView/releaseRenderSession/documentWindow/editorPanel` | 覆盖当前 manifest 中全部 `box.*` action | 类型已导出；`tests/client.test.ts` 覆盖运行时响应 unwrap 和参数校验，但 box 文档窗口、布局描述符、编辑面板、资源桥等覆盖不完整；Host 侧 `box-service.test.ts` 覆盖更多服务行为。 |
| card | `Chips-SDK/src/api/card.ts` | `pack/unpack/readMetadata/readInfo/parse/validate/open/render/releaseRenderSession/coverFrame/compositeWindow/editorPanel` | 覆盖 `card.pack/unpack/readMetadata/readInfo/parse/validate/open/render/renderCover/renderEditor/releaseRenderSession`，并在编辑资源桥中调用 `resource.convertTiffToPng`；缺 `card.resolveDocumentPath` wrapper | 类型已导出；`tests/card.test.ts` 覆盖 pack/readMetadata/readInfo/open/unpack/render/compositeWindow/coverFrame/editorPanel/resource bridge/frame event；`parse/validate` 的 payload/unwrap 漂移未被现有测试捕获。 |
| command | `Chips-SDK/src/api/command.ts` | `register/unregister/get/list/invoke/setState/onRegistered/onUnregistered/onChanged/onInvoked` | `command.register/unregister/get/list/invoke/setState` + `command.registered/unregistered/changed/invoked` | 类型已导出；`tests/client.test.ts` 覆盖注册、订阅、校验、事件；`CommandView/CommandInvokeResult` 与 Host 返回仍有类型漂移。 |
| config | `Chips-SDK/src/api/config.ts` | `get/set/batchSet/reset` | `config.get/set/batchSet/reset` | `ConfigApi` 已导出；缺独立测试，`tests/client.test.ts` 主要覆盖其他 domain；`get/batchSet/reset` 与 Host response/payload 有明显漂移。 |
| document | `Chips-SDK/src/api/document.ts` | `detectType`、`window.render/onReady/onError` | 不直接调用 `document.*` route；按扩展名组合 `card`/`box` API | 类型已导出；没有独立 Host route 或 manifest entry；测试主要由 card/box frame 测试间接覆盖。任务010需要确认 document 是组合 API 还是正式服务域。 |
| file | `Chips-SDK/src/api/file.ts` | `read/write/stat/list/mkdir/delete/move/copy` | `file.read/write/stat/list/mkdir/delete/move/copy`；缺 `file.watch` | 类型已导出；`tests/client.test.ts` 覆盖 `read` binary/text unwrap、list/delete payload，但 `stat/list` response unwrap 漂移未覆盖，`watch` 无 SDK wrapper。 |
| i18n | `Chips-SDK/src/api/i18n.ts` | `getCurrent/setCurrent/translate/listLocales` | `i18n.getCurrent/setCurrent/translate/listLocales` | `I18nApi` 已导出；`tests/client.test.ts` 覆盖基础 unwrap；缺 `language.changed` 事件 helper，`setCurrent` 返回 ack 与 `Promise<void>` 未统一处理。 |
| icon | `Chips-SDK/src/api/icon.ts` | `IconDescriptor/IconStyle` 类型 | 无 runtime action | 类型已导出；被 command 类型消费；无需 Host route。 |
| module | `Chips-SDK/src/api/module.ts` | `listProviders/resolve/invoke/job.get/job.cancel` | `module.listProviders/resolve/invoke/job.get/job.cancel` | 类型已导出；`tests/client.test.ts` 覆盖 provider unwrap、invoke 参数校验；缺 `module.job.progress/completed/failed`、`module.provider.changed` 等事件 helper。 |
| platform | `Chips-SDK/src/api/platform.ts` | `getInfo/getCapabilities/getScreenInfo/listScreens/powerGetState/powerSetPreventSleep/openExternal/renderHtmlToPdf/renderHtmlToImage/openFile/saveFile/showMessage/showConfirm/getPathForFile/getLaunchContext` | 已封装平台信息、屏幕、电源、外部打开、HTML 导出、dialog；缺 clipboard/shell/notification/tray/shortcut/ipc 系列 manifest action | 类型部分已导出；`tests/client.test.ts` 覆盖 HTML 导出、dialog、preload path/launch context；缺系统能力系列 wrapper 与测试。 |
| plugin | `Chips-SDK/src/api/plugin.ts` | `getSelf/list/get/getCardPlugin/getLayoutPlugin/install/enable/disable/uninstall/launch/getShortcut/createShortcut/removeShortcut/query` | 覆盖除 `plugin.init`、`plugin.handshake.complete` 外的插件 action | 类型已导出；`tests/client.test.ts` 覆盖 metadata unwrap，但 install/enable/disable/uninstall/launch/shortcut/query 覆盖偏薄；缺插件生命周期事件 helper。 |
| resource | `Chips-SDK/src/api/resource.ts` | `resolve/open/readMetadata/readBinary/convertTiffToPng` | `resource.resolve/open/readMetadata/readBinary/convertTiffToPng` | 类型已导出；`tests/resource.test.ts` 覆盖 `open`、`readBinary` unwrap/校验、TIFF 转 PNG；`readMetadata` response unwrap 漂移未覆盖。 |
| surface | `Chips-SDK/src/api/surface.ts` | `open/focus/resize/setState/getState/close/list` | `surface.open/focus/resize/setState/getState/close/list` | 类型已导出；`tests/client.test.ts` 覆盖部分 unwrap；缺 surface lifecycle 事件 helper。 |
| theme | `Chips-SDK/src/api/theme.ts` | `list/apply/getCurrent/getAllCss/resolve/contract.get/onChanged` | `theme.list/apply/getCurrent/getAllCss/resolve/contract.get` + `theme.changed` | 类型已导出；`tests/client.test.ts` 覆盖 theme snapshot、diagnostics、changed event；`apply` 返回 ack 与 `Promise<void>` 不一致。 |
| transfer | `Chips-SDK/src/api/transfer.ts` | `openPath/openExternal/revealInShell/share` | `transfer.openPath/openExternal/revealInShell/share` | 类型已导出；`tests/client.test.ts` 仅有间接/轻量覆盖，需要补充 ack/shared 行为测试。 |
| window | `Chips-SDK/src/api/window.ts` | `open/focus/resize/setState/getState/close` | `window.open/focus/resize/setState/getState/close` | 类型已导出；`tests/client.test.ts` 覆盖部分 window payload；公共文档已将其定位为桌面兼容别名。 |
| zip | `Chips-SDK/src/api/zip.ts` | `compress/extract/list` | `zip.compress/extract/list` | 类型已导出；`tests/client.test.ts` 覆盖 wrapper 调用；Host 侧 `zip-store.test.ts` 覆盖更多压缩格式行为。 |

### 1.3 测试覆盖现状

- `Chips-SDK/tests/client.test.ts` 是当前 SDK domain wrapper 的主要覆盖面，混合覆盖 transport、错误包装、file/i18n/theme/command/plugin/box/module/card/platform/zip 等行为。
- `Chips-SDK/tests/card.test.ts` 聚焦 card pack/info/open/render/editor/composite/frame resource bridge。
- `Chips-SDK/tests/resource.test.ts` 聚焦 `resource.open/readBinary/convertTiffToPng`。
- `Chips-SDK/tests/route-manifest.test.ts` 只测试 tooling 的 toy manifest。
- `Chips-SDK/tests/tooling/contract-drift.test.ts` 只验证 SDK 源码里写死的 `client.invoke("...")` action 存在于 SDK manifest；不验证 Host manifest，不验证 manifest action 都有 SDK domain wrapper，也不验证 schema/permission/timeout/idempotent 元数据。
- `Chips-SDK/package.json` 的 `npm test` 当前只串行执行 CLI `run-*.cjs` 脚本，未直接执行上述 Vitest domain/contract 测试；任务010若依赖 `npm test` 作为验收，需要先确认测试入口是否应扩展。

## 2. Host route manifest、SDK route manifest、公共服务文档漂移点

### 2.1 已对齐的部分

- `Chips-SDK/src/contracts/route-manifest.json` 当前 159 个 route key。
- `Chips-Host/src/main/services/register-schemas.ts` 当前显式注册 159 个 action schema。
- 机器对比结果：Host schema action set 与 SDK route manifest key set 完全一致，`host-not-sdk = 0`，`sdk-not-host = 0`。
- `Chips-Host/tests/contract/route-manifest.contract.test.ts` 已验证 Host `app.kernel.getRouteManifest()` 与 SDK manifest key 集合一致。

### 2.2 仍存在的漂移

1. Route key 对齐，但 descriptor 元数据未同步。
   - Host `register-host-services.ts` 的 `descriptor()` 已有 `schemaIn/schemaOut/permission/timeoutMs/idempotent/retries/handler`。
   - SDK `route-manifest.json` 每条只有 `{ action }`，没有 `schemaIn/schemaOut/permission/timeoutMs/idempotent/retries`。
   - `Chips-SDK/src/tooling/route-manifest.ts` 类型允许部分 descriptor 元数据，但当前生成物未使用；无法在 SDK 侧做权限、幂等、超时、schema drift 检查。

2. SDK domain wrapper 未覆盖全部 manifest action。
   当前 `src/api/*` 实际封装 123 个 manifest action；未封装 37 个：
   - `card.resolveDocumentPath`
   - `file.watch`
   - `platform.clipboardRead/clipboardWrite`
   - `platform.shellOpenPath/shellOpenExternal/shellShowItemInFolder`
   - `platform.notificationShow`
   - `platform.traySet/trayClear/trayGetState`
   - `platform.shortcutRegister/shortcutUnregister/shortcutIsRegistered/shortcutList/shortcutClear`
   - `platform.ipcCreateChannel/ipcSend/ipcReceive/ipcCloseChannel/ipcListChannels`
   - `log.write/log.query/log.export`
   - `credential.get/credential.set/credential.delete/credential.rotate`
   - `serializer.encode/serializer.decode/serializer.validate`
   - `control-plane.health/control-plane.check/control-plane.metrics/control-plane.diagnose`
   - `plugin.init/plugin.handshake.complete`

3. 公共文档中的服务域数量口径不一致。
   - `生态共用技术文档/架构设计/14-Host服务域设计.md` 标注当前实现为 20 个服务域，并列出 `command/surface/transfer/association/log/credential/serializer/control-plane` 等。
   - `生态共用技术文档/协议与契约/02-服务协议标准.md` 仍带 vNext 修订稿/历史口径，部分章节偏 16 域，且 Bridge 子域与 UI Hooks 描述较旧。
   - `生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md` 已列出较新的 `resource.convertTiffToPng/platform.renderHtmlToPdf/platform.renderHtmlToImage/box.*` 等，但公开服务命名空间段落与 20 域口径仍需统一核对。

4. 主题文档存在残留动作名。
   - `生态共用技术文档/主题系统/02-主题接口规范.md` 的固定接口表与 SDK/Host manifest 对齐为 `theme.list/apply/getCurrent/getAllCss/resolve/contract.get`。
   - 同文部分正则/类型提取处仍出现 `theme.preview/theme.reset` 残留，需要任务010判定为历史文字还是待实现动作；当前 Host manifest 与 SDK 均没有这两个 action。

5. Bridge API 与 SDK platform wrapper 覆盖边界未收口。
   - Bridge/Host baseline 将 dialog/clipboard/shell/notification/tray/shortcut/ipc 作为 platform legacy alias 或直接子域能力。
   - SDK `platform.ts` 只封装 dialog、openExternal、电源、屏幕、离屏导出、preload helper；clipboard/shell/notification/tray/shortcut/ipc 的 public SDK 形态缺失。

6. Host TS handler 输入类型与 schema/SDK 文档存在局部不一致。
   - `resource.open` schema 允许 `resource.payload`，共享资源打开契约与 SDK 类型也支持 payload；Host `register-host-services.ts` 中 `resource.open` descriptor 的 TS 输入片段未列 `payload`，虽然 schema 校验允许。
   - `config.batchSet` schema 只校验有 `entries`，Host handler 按 `Record<string, unknown>` 迭代，SDK 却发送 `Array<{ key; value }>`。

## 3. 已有 Domain API 的类型松散、unwrap 和事件命名问题

### 3.1 Payload / response unwrap 不一致

| 文件 | API | 当前 SDK 行为 | Host / schema 行为 | 风险 |
|---|---|---|---|---|
| `Chips-SDK/src/api/card.ts` | `card.parse(cardFile)` | 返回 `client.invoke("card.parse", { cardFile })`，类型为 `Promise<CardDocument>` | Host 返回 `{ ast }` | 调用方拿到 wrapper object 而非 `CardDocument`，类型承诺不真实。 |
| `Chips-SDK/src/api/card.ts` | `card.validate(card)` | 发送 `{ card }`，类型接收 `CardDocument` | Host schema/服务要求 `{ cardFile }`，返回 `{ valid, errors: string[] }` | 当前 wrapper 可能无法通过 Host schema；SDK 类型 `errors?: {path,message,code}[]` 与 Host `string[]` 不一致。 |
| `Chips-SDK/src/api/file.ts` | `file.stat(path)` | 返回 raw `client.invoke("file.stat", { path })`，类型为 `FileStat` | Host 返回 `{ meta }` | 调用方实际得到 `{ meta }`。 |
| `Chips-SDK/src/api/file.ts` | `file.list(dir)` | 返回 raw `client.invoke("file.list", { dir, options })`，类型为 `FileEntry[]` | Host 返回 `{ entries }` | 调用方实际得到 `{ entries }`；现有测试只看 payload。 |
| `Chips-SDK/src/api/config.ts` | `config.get(key)` | 返回 raw invoke，类型为 `T | undefined` | Host 返回 `{ value }` | 调用方实际得到 `{ value }`。 |
| `Chips-SDK/src/api/config.ts` | `config.set/reset/batchSet` | 返回 raw ack，类型为 `Promise<void>` | Host 返回 `{ ack: true }` | void API 泄漏 ack object。 |
| `Chips-SDK/src/api/config.ts` | `config.batchSet(entries)` | SDK 发送数组 `[{ key, value }]` | Host handler 期望 `entries` 是 record 并 `Object.entries(input.entries)` | payload 语义不兼容，且没有 scope 参数。 |
| `Chips-SDK/src/api/theme.ts` | `theme.apply(themeId)` | 返回 raw invoke，类型为 `Promise<void>` | Host 返回 `{ success: true, themeId }` | void API 泄漏 object；是否应返回 applied themeId 需收口。 |
| `Chips-SDK/src/api/i18n.ts` | `i18n.setCurrent(locale)` | 返回 raw invoke，类型为 `Promise<void>` | Host 返回 `{ ack: true }` | void API 泄漏 ack object。 |
| `Chips-SDK/src/api/resource.ts` | `resource.readMetadata(resourceId)` | 返回 raw invoke，类型为 `ResourceMeta` | Host 返回 `{ metadata }` | 调用方实际得到 `{ metadata }`。 |
| `Chips-SDK/src/api/resource.ts` | `resource.resolve(resourceId)` | 返回 raw invoke | Host 返回 `{ uri }` | SDK 类型 `ResourceUri` 与 Host wrapper object 对齐，但命名需确认是否希望 unwrap 成 URI string。 |
| `Chips-SDK/src/api/plugin.ts` | `plugin.install(manifestPath)` | 返回 `{ pluginId }`，方法类型也返回 `{ pluginId }` | Host 返回 `{ pluginId }` | 一致；但其他管理动作返回 ack 时 SDK 已 await 丢弃，风格与 `config/theme/i18n` 不一致。 |
| `Chips-SDK/src/api/platform.ts` | `platform.openExternal(url)` | `await` 后丢弃 | Host 返回 `{ ack }` | 行为合理，但和 `transfer.openExternal` 需保持同一 void 策略。 |

### 3.2 类型松散或与 Host 返回不完全一致

- `CommandView` 缺 Host `diagnostic` 字段；Host `toCommandView()` 与共享命令契约将 visible/enabled/原因放在 diagnostic 中。
- `CommandInvokeResult` 缺 Host 返回里的必备 `command: CommandView`；SDK 类型有 `result/state` 等当前 Host 不返回的字段，`invocationId` 在 SDK 为可选但 Host schema 要求存在。
- `ResourceMeta` 当前声明为 `{ id, mimeType?, size? }`，Host `resource.readMetadata` 实际来自 PAL `fs.stat`，更接近文件 stat；类型过窄且未 unwrap。
- `PluginApi.launch` 返回类型里 `window` 仅 `{ id }`；Host surface/window 返回可能包含 `chrome/presentation/session` 等信息，SDK 类型偏窄。
- `PlatformRenderHtmlToPdfResult` / `PlatformRenderHtmlToImageResult` 未体现文件转换契约中的 `warnings?` 扩展空间；如果 Host 后续返回 warnings，SDK 类型会落后。
- `BoxLayoutValidation.errors`、`BoxLayoutDescriptor.defaultConfig/icon` 等仍较宽；可以接受作为插件生态扩展点，但任务010应区分“有意宽类型”和“未同步类型”。
- `DocumentApi` 是组合型 API，无 `document.*` route；任务010应在 SDK 类型或文档中明确它不是 Host 服务域，避免与任务目标中的 document domain 误解。

### 3.3 事件命名与事件 helper 缺口

- 公共契约要求公共事件采用点语义，例如 `theme.changed`、`language.changed`，禁止冒号形式。
- SDK 已包装的公共事件只有：
  - `theme.onChanged` -> `theme.changed`
  - `command.onRegistered/onUnregistered/onChanged/onInvoked` -> `command.*`
- Host 已发出但 SDK 没有 domain helper 的事件包括：
  - `language.changed`
  - `plugin.installed/enabled/disabled/uninstalled/init/ready/launched/shortcut.changed`
  - `surface.opened/focused/resized/stateChanged/closed`、`window.opened`
  - `module.job.progress/completed/failed`、可能的 provider 变化事件口径
  - `box.session.updated/box.session.entryStateChanged/box.session.closed`
- SDK frame 内部消息使用冒号命名：
  - `chips.composite:*`
  - `chips.card-editor:*`
  - `chips.box-layout:*`
- 上述 `chips.*:*` 更像 iframe/private message protocol，不应直接归类为 Host EventBus 公共事件；任务010需要显式在类型或文档中标记为私有 frame message，或迁移命名口径，避免与公共事件“点语义”规则冲突。

## 4. 任务010 需要补齐的 API（按优先级）

### P0：先修正已公开 wrapper 的错误 payload、unwrap 与类型承诺

- `Chips-SDK/src/api/card.ts`
  - 修正 `parse` 对 `{ ast }` 的 unwrap 或类型。
  - 修正 `validate` 为 Host 契约 `{ cardFile }`，并同步 `ValidationResult.errors: string[]` 或推动 Host/文档统一结构化错误。
  - 明确是否补 `resolveDocumentPath(documentUrl)` public API；如果仅内部 frame 使用，也需要标注为内部能力。
- `Chips-SDK/src/api/file.ts`
  - `stat` unwrap `{ meta }`。
  - `list` unwrap `{ entries }`。
  - 补 `watch(path, options?)` 或明确不作为 SDK public wrapper。
- `Chips-SDK/src/api/config.ts`
  - `get` unwrap `{ value }`。
  - `set/reset/batchSet` 丢弃 `{ ack }` 或调整返回类型。
  - `batchSet` payload 与 Host 的 record 口径收口，并补 `scope?: "user" | "workspace" | "system"`。
- `Chips-SDK/src/api/resource.ts`
  - `readMetadata` unwrap `{ metadata }` 并调整 `ResourceMeta`。
  - 核对 `resolve` 是返回 `{ uri }` 还是裸 URI。
- `Chips-SDK/src/api/theme.ts`、`Chips-SDK/src/api/i18n.ts`
  - 对 `apply/setCurrent` 的 ack/success 返回策略统一。
  - 补 `i18n.onChanged` / `language.changed`。
- `Chips-SDK/src/api/command.ts`
  - 对齐 `CommandView.diagnostic`、`CommandInvokeResult.command`、`invocationId` 必填性。
- `Chips-SDK/tests/client.test.ts`、`Chips-SDK/tests/card.test.ts`、`Chips-SDK/tests/resource.test.ts`
  - 为上述 unwrap/payload 补显式断言，避免只检查 invoke payload。

### P1：补齐 manifest 中已经存在且面向开发者有价值的 SDK domain wrapper

- `Chips-SDK/src/api/platform.ts`
  - 补 clipboard：`platform.clipboardRead/clipboardWrite`
  - 补 shell：`platform.shellOpenPath/shellOpenExternal/shellShowItemInFolder`
  - 补 notification：`platform.notificationShow`
  - 补 tray：`platform.traySet/trayClear/trayGetState`
  - 补 shortcut：`platform.shortcutRegister/shortcutUnregister/shortcutIsRegistered/shortcutList/shortcutClear`
  - 补 ipc：`platform.ipcCreateChannel/ipcSend/ipcReceive/ipcCloseChannel/ipcListChannels`
  - 同步 `Chips-SDK/src/index.ts` 类型导出与 `tests/client.test.ts`。
- 新增或扩展 domain 文件：
  - `Chips-SDK/src/api/log.ts`：`log.write/query/export`
  - `Chips-SDK/src/api/credential.ts`：`credential.get/set/delete/rotate`
  - `Chips-SDK/src/api/serializer.ts`：`serializer.encode/decode/validate`
  - `Chips-SDK/src/api/control-plane.ts`：`control-plane.health/check/metrics/diagnose`
  - 同步 `Chips-SDK/src/core/client.ts`、`Chips-SDK/src/types/client.ts`、`Chips-SDK/src/index.ts`、`Chips-SDK/tests/client.test.ts` 或新增专门测试。
- `Chips-SDK/src/api/plugin.ts`
  - 补插件管理动作的返回类型与测试：`install/enable/disable/uninstall/launch/createShortcut/removeShortcut/query`。
  - 补插件事件 helper，至少覆盖 Host 已发出的插件生命周期事件。
- `Chips-SDK/src/api/module.ts`
  - 补 `onJobProgress/onJobCompleted/onJobFailed`，并确认 provider changed 事件正式命名。
- `Chips-SDK/src/api/surface.ts` / `Chips-SDK/src/api/window.ts`
  - 补 lifecycle event helper，或明确只通过 `client.events.on()` 通用入口订阅。
- `Chips-SDK/src/api/box.ts`
  - 补 `box.session.*` event helper 或在文档中声明运行时会话事件只能通过通用 events API。

### P2：补齐契约工具链与公共口径收口

- `Chips-SDK/src/contracts/route-manifest.json`
  - 从 Host 生成或同步完整 descriptor 元数据：`schemaIn/schemaOut/permission/timeoutMs/idempotent/retries`。
- `Chips-SDK/tests/tooling/contract-drift.test.ts`
  - 增加 Host manifest 对比，或读取 Host 生成结果做 route key + descriptor meta drift 检查。
  - 增加 “manifest 中应公开的 action 是否有 SDK wrapper/类型/测试” 的白名单式检查；`plugin.init/handshake.complete` 等内部 action 可列入显式 exclusion。
- `Chips-SDK/package.json`
  - 确认 `npm test` 是否应包含 Vitest domain/API 契约测试；否则任务010验收标准中的 SDK 测试会漏掉关键 domain drift。
- 生态共用技术文档后续收口位置：
  - 20 服务域最终口径应以 `生态共用技术文档/架构设计/14-Host服务域设计.md` 和 Host 对外接口基线为准。
  - `服务协议标准`、`Bridge-API规范`、主题接口规范中的历史残留动作和子域描述需要在任务010后续文档阶段同步，但本次前置勘察不修改公共文档。

## 5. 推荐验证命令与 009 错误 Envelope 影响面

### 5.1 推荐验证命令

```bash
cd Chips-SDK
npm test
```

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts tests/card.test.ts tests/resource.test.ts tests/route-manifest.test.ts tests/tooling/contract-drift.test.ts
```

```bash
cd Chips-Host
npm run test:contract
```

```bash
cd Chips-Host
npx vitest run tests/contract/route-manifest.contract.test.ts tests/integration/host-services.test.ts tests/unit/kernel-router.test.ts tests/unit/chips-ipc.test.ts tests/unit/bridge-transport.test.ts tests/unit/preload-context-bridge.test.ts
```

若任务010改到 SDK `package.json`、类型入口或 manifest 生成链路，建议再补：

```bash
cd Chips-SDK
npx tsc --noEmit
```

```bash
cd Chips-Host
npm run build
```

### 5.2 可能受任务009 错误 Envelope 改动影响的测试

- `Chips-SDK/tests/client.test.ts`
  - `wraps non-standard errors as StandardError`
  - `throws BRIDGE_UNAVAILABLE when no transport and no window.chips`
  - `unwraps Host IPC encoded standard errors from the plugin bridge`
  - scoped bridge、command invoke、resource/file invalid response 等错误路径断言
- `Chips-SDK/tests/resource.test.ts`
  - invalid `resource.readBinary` / `resource.convertTiffToPng` 响应与参数错误。
- `Chips-SDK/tests/card.test.ts`
  - editor resource bridge、composite frame resource open/error payload；这些路径会把错误穿过 `postMessage` 或 resource bridge。
- `Chips-Host/tests/unit/kernel-router.test.ts`
  - permission、retryable error、replayed requestId、circuit breaker 等 envelope/standard error 相关行为。
- `Chips-Host/tests/unit/chips-ipc.test.ts`
  - `chips:invoke`、event channel、scoped bridge、Electron invoke handler structured error 解码。
- `Chips-Host/tests/unit/bridge-transport.test.ts` 与 `preload-context-bridge.test.ts`
  - Bridge subdomain 与 structured error 透传。
- `Chips-Host/tests/contract/route-manifest.contract.test.ts`
  - 若任务009/010 同步 route descriptor 或 manifest 生成格式，需要一起调整。

## 6. 架构风险记录（仅报告，不登记工单）

1. 当前 route key 层面已对齐，但 SDK manifest 没有 Host descriptor 元数据；这会让权限、schema、timeout、幂等和 retry 策略漂移无法在 SDK 侧自动发现。
2. SDK domain wrapper 的 public 类型有多处“看起来已封装、实际返回 Host wrapper object”的问题，风险高于缺失 API，因为调用方会在运行时拿到与 TypeScript 类型不同的结构。
3. `npm test` 当前不直接执行 Vitest domain/API 测试，任务010如果只跑正式脚本，可能无法发现 wrapper unwrap、payload 和事件 helper 漂移。
4. `document` 目前是组合 API 而非 Host route domain；任务010目标中列出 document，需要先定性，避免为了“补齐”而引入不必要的 Host 服务域或 SDK 假路由。
5. `plugin.init` 与 `plugin.handshake.complete`、`control-plane.*`、`credential.*`、`log.*`、`serializer.*` 是否面向普通插件开发者公开尚需分层决策；建议在任务010里用 explicit public/internal allowlist 管理，而不是简单把 manifest 全量生成为 SDK public wrapper。
6. 公共事件命名规则与 SDK iframe 私有消息命名共存；若不标注私有/公共边界，后续开发者可能误把 `chips.card-editor:*` 一类消息当成 Host EventBus 公共事件。
7. Host schema registry 的 `registerPair` 只检查顶层 key，不足以捕获 `config.batchSet.entries` 这种 record/array 语义漂移；任务010如要做类型同步，最好引入更细粒度的 schema 或 contract fixture。
