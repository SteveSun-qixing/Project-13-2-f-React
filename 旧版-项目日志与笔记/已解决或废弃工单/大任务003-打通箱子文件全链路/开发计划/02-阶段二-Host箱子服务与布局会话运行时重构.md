# 阶段二：Host箱子服务与布局会话运行时重构

## 1. 阶段目标

把 Host 从“旧箱子静态打包检查器”重构为“新箱子正式运行时中心”，完整提供 `.box` 的静态动作、查看会话、动态取数、资源解析、事件与文件关联入口。

## 2. 入口条件

- 阶段一已完成；
- 共享文档中的箱子文件格式、业务模型和运行时契约已经冻结；
- `Chips-Host` 当前 `box-service`、路由、schema、文件关联和 preload 白名单已重新核对。

## 3. 涉及仓库

| 仓库 | 本阶段职责 |
|---|---|
| `Chips-Host` | 完成 Host 箱子服务主实现 |
| `生态共用技术文档` | 仅在代码核对后修正文档漂移，不新增新口径 |
| `项目日志与笔记` | 若出现新的公共缺口，补工单 |

## 4. 重点交付物

- 新版 `box-service` 数据模型与解析器；
- `box.validate / box.readMetadata / box.openView / box.listEntries / box.readEntryDetail / box.resolveEntryResource / box.readBoxAsset / box.prefetchEntries / box.closeView` 正式路由；
- 对应 schema、错误码、事件与权限校验；
- `.box` 文件关联正式入口；
- Host 侧单元测试、契约测试和内部技术文档收口。

## 5. 任务拆解

### 5.1 重建 `box-service` 数据模型

需要把 `packages/box-service` 从旧 `cards/internal/layout` 结构重构为新模型：

- `metadata.yaml`
- `structure.yaml`
- `content.yaml`
- `assets/`
- `entries[].entry_id`
- `entries[].url`
- `entries[].snapshot`
- `entries[].layout_hints`

同时实现：

- `.box` 结构校验；
- YAML 解析与字段归一；
- URL 合法性校验；
- 旧字段拒绝策略；
- 箱子资产路径校验。

### 5.2 建立箱子查看会话层

Host 必须新增正式会话层，至少负责：

1. `sessionId` 分配与回收；
2. 箱子元数据、布局类型与首批摘要缓存；
3. 条目分页、筛选、排序和详情读取；
4. 会话所有权校验；
5. 会话事件发布；
6. 会话关闭时的资源清理。

### 5.3 打通 Host 服务依赖

箱子会话不能单独闭门实现，必须正式复用以下服务域：

- `card`：解析卡片元数据、封面、预览与入口资源；
- `resource`：产出统一资源句柄；
- `credential`：处理网络 URL 凭证；
- `plugin`：按 `layoutType` 解析布局插件；
- `window`：承载查看页窗口与关闭链路；
- `file`：解包工作目录与导出路径操作。

同时必须同步收口 Host 现有布局插件元数据解析，确保 `manifest.layout.layoutType` 可以稳定进入 `plugin.query({ type: 'layout' })` 与 `plugin.getLayoutPlugin()` 的正式返回记录，否则查看器无法基于已安装插件入口加载布局模块。

### 5.4 注册正式路由、schema 与权限

需要在 Host 中补齐：

- 路由注册；
- schema 注册；
- `box.read / box.write` 权限边界；
- 标准错误码映射；
- `box.session.updated / box.session.entryStateChanged / box.session.closed` 事件；
- preload / Bridge 白名单与 hook 暴露。

### 5.5 重写 `.box` 文件关联入口

需要把 `.box` 关联入口从“只 inspect”升级为正式消费入口：

1. `box.inspect` 只保留为静态预检查；
2. `.box` 文件打开要能带着 `targetPath` 和 mode=`box` 启动查看器；
3. 查看器缺失时必须给出可诊断错误，不允许静默打开空窗口；
4. 不再假设 `.box` 只是目录态资源。

### 5.6 测试与内部文档

至少补齐：

- `box-service` 单元测试；
- Host 路由契约测试；
- 文件关联与权限测试；
- 资源句柄与会话清理测试；
- Host 内部技术文档更新。

## 6. 串并行安排

本阶段内部可受控并行：

- 一路重构 `box-service` 核心数据模型；
- 一路补 `register-host-services / register-schemas / preload`；
- 一路补 `.box` 文件关联与 Host 技术文档；
- 但所有并行支路必须以同一套共享文档字段名为准，不得各自定义新结构。

## 7. 验证门禁

- `cd Chips-Host && npm run build`
- `cd Chips-Host && npm test`
- `cd Chips-Host && npm run test:contract`

同时必须验证：

- `box.openView` 能返回会话和首批摘要；
- `box.listEntries`、`box.readEntryDetail`、`box.resolveEntryResource`、`box.readBoxAsset` 全部可用；
- `.box` 文件关联入口可以把 `targetPath` 正确交给查看器；
- 没有旧 `internal/external` 与 `full/shell/mixed` 活跃路径。

## 8. 阶段退出标准

- Host 已成为箱子正式运行时中心；
- 后续仓库都可以只依赖 Host 新动作面开展实现；
- 若 Host 仍需要查看器或编辑引擎侧补逻辑才能“解释 `.box` 文件”，则本阶段不算完成。
