# Host 与 SDK 链路核查

## 核查范围

本轮聚焦 Host 正式服务面、文件关联入口、SDK 对外封装，以及卡片与箱子在这一层到底是“同一条链路”还是“统一壳层 + 两条子链路”。

## 已核查模块

### Host

1. `Chips-Host/src/main/core/file-association.ts`
2. `Chips-Host/src/main/services/register-host-services.ts`
3. `Chips-Host/packages/card-service/src/card-service.ts`
4. `Chips-Host/packages/card-info-service/src/card-info-service.ts`
5. `Chips-Host/packages/card-open-service/src/card-open-service.ts`
6. `Chips-Host/packages/box-service/src/box-service.ts`

### SDK

1. `Chips-SDK/src/api/document.ts`
2. `Chips-SDK/src/api/card.ts`
3. `Chips-SDK/src/api/box.ts`

## 1. Host 文件关联入口

### `.card`

Host 文件关联对 `.card` 的处理是直接走 `card.open`：

1. 文件关联层识别扩展名为 `.card`；
2. 调用 Host 路由 `card.open`；
3. `card.open` 进一步使用 `CardOpenService`；
4. `CardOpenService` 优先查找具备 `file-handler:.card` 能力的 app 插件；
5. 当前查看器 `Chips-CardViewer` 正是通过这个能力承接卡片查看。

### `.box`

Host 文件关联对 `.box` 的处理不是直接走 `box.openView`，而是：

1. 先调用 `box.inspect` 验证并读取箱子；
2. 再查找具备 `file-handler:.box` 能力的 app 插件；
3. 当前同一个查看器 `Chips-CardViewer` 也声明了 `file-handler:.box`；
4. 因此卡片和箱子在“桌面打开哪个应用”这一层，已经共享同一个查看器壳层。

### 这一层的判断

1. 卡片和箱子共用“文件关联 -> app 文件处理能力 -> 查看器壳层”这一入口体系；
2. 但 Host 内核提供的后续能力入口并不是单一动作名，而是继续分成 `card.*` 与 `box.*`。

## 2. Host 正式动作面

### `card.*`

当前 Host 注册的卡片正式动作包括：

1. `card.pack`
2. `card.unpack`
3. `card.readMetadata`
4. `card.readInfo`
5. `card.parse`
6. `card.render`
7. `card.renderCover`
8. `card.renderEditor`
9. `card.releaseRenderSession`
10. `card.resolveDocumentPath`
11. `card.validate`
12. `card.open`

### `box.*`

当前 Host 注册的箱子正式动作包括：

1. `box.pack`
2. `box.unpack`
3. `box.inspect`
4. `box.validate`
5. `box.readMetadata`
6. `box.listLayoutDescriptors`
7. `box.readLayoutDescriptor`
8. `box.normalizeLayoutConfig`
9. `box.validateLayoutConfig`
10. `box.getLayoutInitialQuery`
11. `box.renderLayoutFrame`
12. `box.renderLayoutEditor`
13. `box.releaseRenderSession`
14. `box.openView`
15. `box.listEntries`
16. `box.readEntryDetail`
17. `box.renderEntryCover`
18. `box.renderCover`
19. `box.resolveEntryResource`
20. `box.openEntry`
21. `box.readBoxAsset`
22. `box.prefetchEntries`
23. `box.closeView`

### 动作面对比判断

1. 从 Host 服务命名面上看，两者不是一条单名义接口；
2. 当前架构是“同一 Host 路由总线”下的两组正式服务域；
3. 卡片偏重解析、复合渲染、封面和基础卡片编辑器；
4. 箱子偏重查看会话、布局配置、条目分页、条目详情、条目资源和布局编辑器。

## 3. 卡片查看态正式链路

### Host 内部处理

`card.render` 的核心行为是：

1. 解包并验证 `.card`；
2. 读取 `.card/metadata.yaml`、`.card/structure.yaml` 和 `content/*.yaml`；
3. 按结构节点解析基础卡片；
4. 根据 `cardType` 选择可用的基础卡片插件；
5. 对每个节点生成基础卡片 iframe 文档；
6. 再由 Host 拼成复合卡片总文档；
7. 持久化渲染 session；
8. 返回受控 `documentUrl`。

### SDK 对外封装

`client.card.compositeWindow.render(...)` 的核心行为是：

1. 调用 `card.render`；
2. 要求 Host 返回 `view.documentUrl`；
3. 基于 `documentUrl` 创建 iframe；
4. 绑定释放逻辑到 `card.releaseRenderSession`；
5. 额外订阅 `chips.composite:*` 一组事件。

### 判断

卡片查看态是“Host 先拼好复合文档，再交给应用 iframe 承载”的模型。

## 4. 箱子查看态正式链路

### Host 内部处理

`box.openView` 与 `box.renderLayoutFrame` 组合起来形成箱子查看态主链路：

1. `box.inspect` 读取 `.box` 的 `metadata/content/entries/assets`；
2. `box.openView` 解包箱子并创建查看 session；
3. session 内保存 `entries`、`entryMap`、`activeLayoutType`、`availableLayouts` 和资源缓存；
4. `box.readLayoutDescriptor` 根据 `layoutType` 找到布局插件；
5. `box.normalizeLayoutConfig` 规范化布局配置；
6. `box.getLayoutInitialQuery` 让布局插件给出首屏取数条件；
7. `box.renderLayoutFrame` 生成布局插件查看文档；
8. 布局插件在运行过程中再通过箱子 session 动作向 Host 按需请求数据。

### SDK 对外封装

`client.box.documentWindow.render(...)` 并不是单次直调，而是串联：

1. `box.inspect`
2. `box.readLayoutDescriptor`
3. `box.normalizeLayoutConfig`
4. `box.getLayoutInitialQuery`
5. `box.openView`
6. `box.renderLayoutFrame`

随后 SDK 还会：

1. 挂上 iframe；
2. 为 iframe 注入 `chips.box-layout:runtime-request` / `runtime-response` 桥；
3. 在销毁时同时释放渲染 session 和关闭 box view session。

### Runtime 桥暴露的动作

当前布局查看态 iframe 可通过 SDK Runtime Bridge 调用：

1. `listEntries`
2. `readEntryDetail`
3. `renderEntryCover`
4. `resolveEntryResource`
5. `readBoxAsset`
6. `prefetchEntries`
7. `openEntry`

### 判断

箱子查看态是“先建查看会话，再让布局插件按需取数”的模型，和卡片“Host 先组装整份复合文档”的方式不同。

## 5. 统一文档窗口是否真正统一

`client.document.window.render({ filePath })` 确实提供了统一壳层：

1. `.card` 时委托 `client.card.compositeWindow.render(...)`
2. `.box` 时委托 `client.box.documentWindow.render(...)`

因此：

1. 应用壳层可以把两者都当作“文档窗口”处理；
2. 但 SDK 内部不是完全单链路，而是统一入口后分派到两条正式子链路。

## 6. 封面链路核查

### 卡片封面

1. `client.card.coverFrame.render(...)`
2. 调用 Host `card.renderCover`
3. Host 直接返回 `.card/cover.html` 的 `coverUrl`

### 箱子封面

1. Host 存在 `box.renderCover`
2. Host 直接返回 `.box/cover.html` 的 `coverUrl`
3. 箱子条目封面走 `box.renderEntryCover`
4. `box.renderEntryCover` 内部会区分条目是 box 还是 card

### 复用点

`box.renderEntryCover` 对卡片条目会复用 `card.readInfo(...cover...)`，对箱子条目会复用 `box.renderCover(...)`。

这说明：

1. 封面口径已经高度统一；
2. 但条目封面仍是由 `box.*` 入口承载，不是直接外露一个和卡片完全同名的公共接口。

## 7. 编辑器链路核查

### 卡片编辑面板

`client.card.editorPanel.render(...)` 的核心行为：

1. 调用 Host `card.renderEditor`
2. Host 根据 `cardType` 选择基础卡片插件
3. 生成基础卡片编辑器文档
4. SDK 为 iframe 挂接资源桥：
   1. `resolve`
   2. `import`
   3. `importArchiveBundle`
   4. `delete`

### 箱子编辑面板

`client.box.editorPanel.render(...)` 的核心行为：

1. 先调用 `box.normalizeLayoutConfig`
2. 再调用 `box.renderLayoutEditor`
3. Host 根据 `layoutType` 选择布局插件
4. 生成布局编辑器文档
5. SDK 为 iframe 挂接箱子资源桥：
   1. `readBoxAsset`
   2. `importBoxAsset`
   3. `deleteBoxAsset`

### 判断

1. 两者都采用“Host 生成编辑器文档 + SDK 挂 iframe + SDK 提供资源桥”的模式；
2. 但卡片编辑器面向的是基础卡片插件，箱子编辑器面向的是布局插件；
3. 资源桥接口名、上下文和调用目标都不同。

## 8. 箱子内部对卡片能力的复用点

这是本轮核查里最重要的一部分。

### `box.readEntryDetail`

对卡片条目会通过 `readCardInfo` 读取：

1. `status`
2. `metadata`
3. `cover`

### `box.renderEntryCover`

对卡片条目会复用：

1. `card.readInfo(..., ['status', 'cover', 'metadata'])`

### `box.resolveEntryResource`

当请求条目 `cover/preview` 且条目为本地 card 文件时，会复用：

1. `card.readInfo(..., ['status', 'cover'])`

### `box.openEntry`

对本地 card 条目会复用：

1. `openCardFile`
2. Host 路由层进一步落到 `card.open`

### 这一层的判断

1. 箱子对“箱子里的卡片条目”并没有重新发明第二套卡片打开和封面机制；
2. 箱子在条目级别已经明确复用卡片正式能力；
3. 但这不等于箱子本体查看态和卡片本体查看态是同一链路。

## 9. 当前代码层结论

### 已成立的“共链路”

1. 都由 Host 承载正式运行时；
2. 都通过 Bridge / SDK 对外暴露；
3. 都可以由同一个 `client.document.window.render(...)` 在应用壳层收口；
4. 都通过同一个 `Chips-CardViewer` 应用承接 `file-handler`；
5. 箱子对内部卡片条目会复用卡片的打开、信息和封面能力。

### 未成立的“完全同一条链路”

1. Host 动作面不是单一接口，而是 `card.*` 和 `box.*` 两组服务域；
2. 卡片查看态是“Host 先拼完整复合文档”；
3. 箱子查看态是“Host 建 session + 布局插件按需取数”；
4. 卡片编辑器与布局编辑器不是同一插件契约；
5. SDK 的统一只发生在最上层文档窗口壳层，并未下沉成完全同名、完全同参、完全同语义的一套底层动作。

## 10. 本轮额外发现的问题

本轮还发现 `card.validate` 已出现共享标准、SDK 文档、SDK 实现、Host 路由之间的漂移，已登记：

1. `项目日志与笔记/问题工单.md`
2. `项目日志与笔记/工单081-卡片校验接口文档与SDK实现漂移/任务说明.md`

这不影响本轮对“卡片 / 箱子主查看链路和编辑链路”的主体判断，但意味着接口层仍存在未收口点，后续正式沉淀报告时必须显式标注。
