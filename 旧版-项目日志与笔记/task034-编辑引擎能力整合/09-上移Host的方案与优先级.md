# 09-上移 Host 的方案与优先级（2026-08-11 定案版）

> 本文档按用户 2026-08-11 决策定案。决策记录见 [00-总览与结论.md](./00-总览与结论.md) §3.5。

## 1. 决策基线（用户确认）

| # | 决策 | 内容 |
|---|---|---|
| 1 | 上移范围 | 卡片文档域、箱子文档域、编辑器资源会话、封面体系、重复造轮子（公共工具）**全部工程化上移到 Host** |
| 2 | undo/redo | 历史栈**必须闭环**，作为 Host 会话服务的公共语义 |
| 3 | 布局插件化 | **取消**「无限画布/工作台作为独立布局插件」设计，不再推进 |
| 4 | C 类共享组件 | **不迁移**：封面编辑面板/裁剪弹窗、拖拽排序、文件树、窗口 chrome、画布内核、窗口状态机均保留在编辑引擎 |
| 5 | 自动保存 | **接受职责转移**：会话与自动保存由 Host 主进程管理，应用只订阅事件 |
| 6 | 内嵌卡片 | 架构上允许（`box.session.addEmbeddedCard` 接口开放），一般默认链接；官方编辑引擎自身不提供内嵌操作入口 |
| 7 | 封面能力 | 归属**共享功能模块**（模块插件，无界面）；封面 UI 保留在编辑引擎 |
| 8 | 渲染收敛 | **程度 1**：保留本地装配层，单卡 iframe 文档生成（CSP/资源基址/高度上报/交互代理）统一由 Host 提供 |
| 9 | 工程化要求 | 迁移同步做好代码拆分解耦、小模块、平台级/系统级规范、高质量实现（见 §6） |

## 2. 迁移范围清单（上移对象）

### 2.1 A 类：Host 服务域（主进程，经内核路由对外）

| 能力 | 建议动作 | 现状位置 | 规模 |
|---|---|---|---|
| 卡片编辑会话（读/改/持久化/资源生命周期/自动保存） | `card.session.*` + `card.init` | `card-service.ts` + `card-initializer.ts` | ~1250 行 |
| 卡片会话 undo/redo 历史 | `card.session.undo/redo/history` | `command-manager.ts`（闭环） | ~290 行 |
| 箱子编辑会话（条目/布局/封面/自动保存） | `box.session.*` + `box.create/rename` | `box-document-service.ts` | ~1135 行 |
| 箱子会话 undo/redo 历史 | `box.session.undo/redo/history` | 同上 | — |
| ZIP 目录导入 | `resource.importArchive` | `archive-import.ts` | 592 行 |
| 编辑器资源会话编排 | 会话资源协议动作（resolve/import/delete/转换编排） | `EditorHost.tsx` + `session-store.ts` | ~1200 行 |
| 工作区扫描与文件操作 | `workspace.scan/createCard/createBox/createFolder/rename/delete` | `workspace-service.ts` | 534 行 |
| 文件类型识别 | `file.detectType`（或 document.detectType 增强） | `drag-drop-manager.ts` 局部 | ~80 行 |
| 基础卡片描述符装载 | `card.listBasecardDescriptors` | `registry.ts` | 234 行 |
| 单卡 iframe 文档生成器 | Host 内部模块公共导出（`chips-host/card-frame`） | Host `card-service.ts` + 编辑引擎 `frame-host.tsx` | 双份收敛 |
| MIME 猜测 / 路径规范化 / file URL / ID 等公共工具 | Host `src/shared` 或 SDK 工具统一收口 | 四处重复（见 §3） | — |

### 2.2 B 类：共享功能模块（模块插件，无界面，module.invoke 消费）

| 能力 | 建议模块 | 现状位置 |
|---|---|---|
| 封面 HTML 生成（默认/图片） | `chips.module.cover` | `utils/card-cover.ts`（147 行） |
| 封面比例规范化/校验 | 同上 | 同上 |
| 封面引用收集 | 同上（或 Host card-service 消费） | `card-service.ts reconcileCoverResources` 局部 |

### 2.3 保留在编辑引擎页面域（不迁移）

- 无限画布、工作台布局、窗口状态机、窗口 chrome、拖拽系统、文件树 UI、卡箱库、Dock、历史面板 UI、封面编辑面板/裁剪弹窗/制作器、命令定义与 handler 绑定、编辑态选中模型、布局切换编排、中文文案表。
- 以上 UI 能力直接消费 A/B 类迁移后的公共接口（会话 API、封面模块、识别服务），不再自带业务实现。

## 3. 重复实现证据表（上移后的直接收益）

| # | 能力 | 副本位置 | 收口目标 |
|---|---|---|---|
| 1 | MIME 猜测 | 编辑引擎 card-service、Host card-packer、编辑引擎 box-document-service、drag-drop-manager、SDK | Host 公共工具 + `file.detectType` |
| 2 | 相对资源路径规范化 | 编辑引擎 ×2、SDK、Host card-service、box-document-service、archive-import | Host/SDK 单实现 |
| 3 | YAML 文档序列化 | card-service、box-document-service、workspace-service | Host 会话服务内单实现 |
| 4 | file:// URL 构造 | SDK card.ts、box-document-service | SDK 单实现 |
| 5 | 默认封面 HTML | 编辑引擎 card-cover.ts、Host renderCover 兜底 | `chips.module.cover` 单实现 |
| 6 | 封面比例规范化 | card-service、card-cover.ts | `chips.module.cover` 单实现 |
| 7 | ID 生成 | 编辑引擎 utils/id.ts、Host shared/utils.ts | Host 单实现 |
| 8 | 单卡 iframe 文档生成 | Host card-service、编辑引擎 frame-host | Host 生成器单实现 |
| 9 | 文件类型识别 | SDK document.detectType（弱）、drag-drop-manager、workspace-service | `file.detectType` 单实现 |
| 10 | 编辑器资源桥协议实现 | SDK attachCardEditorResourceBridge、编辑引擎 EditorHost | Host 会话动作单实现 |

## 4. 实施阶段与里程碑

| 阶段 | 内容 | 里程碑验收 |
|---|---|---|
| **M1 公共工具收口** | MIME/路径规范化/file URL/ID/文件类型识别统一收口 Host shared + SDK | 编辑引擎与 Host 消费同一实现；契约测试通过 |
| **M2 卡片编辑会话上移** | `card.session.*` + `card.init` + 自动保存 + undo/redo 闭环 | 编辑引擎卡片窗口/编辑面板全部走会话 API；历史可撤销重做；原 card-service 本地实现删除 |
| **M3 箱子编辑会话上移** | `box.session.*` + `box.create/rename` + 自动保存 + undo/redo | 编辑引擎箱子窗口/编辑面板走会话 API；原 box-document-service 本地实现删除 |
| **M4 编辑器资源会话与导入上移** | `resource.importArchive` + 会话资源协议动作 | ZIP 导入、资源队列、转换编排由 Host 执行；EditorHost 瘦身为会话消费层；archive-import 本地实现删除 |
| **M5 封面能力共享模块** | `chips.module.cover`（生成/比例/引用收集）+ SDK 封装 | 卡片/箱子封面编辑消费模块；Host renderCover 兜底统一 |
| **M6 工作区与描述符上移** | `workspace.scan` 等 + `card.listBasecardDescriptors` | workspace-service 瘦身；registry 改订阅 Host |
| **M7 渲染单卡协议收敛（程度 1）** | Host 单卡帧生成器导出，frame-host 消费统一文档/脚本 | 编辑态/查看态单卡协议同一实现；frame-host 测试全绿 |
| **M8 收尾** | 文档同步（生态共用技术文档）、归档旧实现、全链路回归 | validate/build/test/lint 全绿；无残留 TODO/旁路 |

依赖关系：M1 → M2/M3 → M4 → M5 → M6 → M7 → M8；M2 与 M3 可并行；M5 可提前到与 M2 并行。

## 5. 需要冻结的公共契约点（迁移前先收口）

1. **卡片会话模型**：sessionId 生命周期、dirty/revision 语义、自动保存触发与失败策略、undo/redo 入栈范围与合并窗口；
2. **箱子会话模型**：会话工作目录由 Host 分配回收、条目排序键语义（sortKey 重建规则）、内嵌卡片接口开放（编辑引擎不使用）；
3. **资源导入契约**：`resource.importArchive` 输入输出与 SDK `CardEditorArchiveImportRequest/Result` 对齐，大文件进度走 module.job 任务模型；
4. **封面模块契约**：cover 模块方法、capability 命名、cover_ratio 规范化口径（兼容读、统一写）；
5. **工作区契约**：Host 运行时目录排除清单、卡片目录识别规则、扫描结果结构化；
6. **单卡帧协议**：`chips.basecard:*` 消息名与载荷、CSP 基线、资源基址注入方式（编辑态/查看态同一协议）。

## 6. 工程化规范要求（迁移同时执行，用户要求）

### 6.1 模块拆分与解耦

- 每个上移能力拆分为**职责单一的小模块**，遵循 `生态共用技术文档/协议与契约/02-服务协议标准.md` 的每服务导出模板：`types.ts`（输入输出类型）、`constants.ts`（动作名/错误码）、`service.ts`（注册与实现）、`<action>.contract.test.ts`（同名契约测试）；
- 服务内部按「解析/校验/序列化/持久化/历史」拆分内部小模块，禁止单体巨型文件（参考当前 card-service.ts 1155 行的反例，迁移时拆解）；
- 会话状态机、自动保存调度器、资源生命周期、历史栈各自独立成模块，互不 import 实现，只经服务入口协调。

### 6.2 平台级/系统级规范

- 所有动作遵循统一约束：输入/输出 schema、权限、超时、错误码、幂等性标注（`生态设计原稿/13-公共基础层设计.md` §服务动作统一约束）；
- 统一错误对象（code/message/details/retryable）；错误码前缀按服务域（CARD_SESSION_*、BOX_SESSION_*、IMPORT_*、COVER_*）；
- 事件走内核事件总线，命名点语义（`card.session.dirty/persisted/undo/redo`、`box.session.*`、`resource.import.*`）；
- 自动保存调度器支持并发合并（以 card-service runPersistLoop 与 box flushAutoSave 为基线，收敛为统一实现）；
- 路径安全（防 `..` 逃逸、规范化、符号链接边界）统一收口 Host 侧，应用不再自行校验。

### 6.3 SDK 封装与契约同步

- 每个新动作同步在 SDK `src/api/*` 提供类型化封装与入参校验（参考现有 card.ts/box.ts 的封装风格）；
- 契约变更必须同步 `生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md` 与 `02-服务协议标准.md`；
- manifest 权限基线同步更新（编辑引擎新增 `card.session.*`/`box.session.*`/`workspace.*` 对应权限）。

### 6.4 测试与质量门禁

- 每个上移模块携带：契约测试 + 单元测试（纯逻辑）+ 集成测试（Host 会话链路）；
- 编辑引擎原测试（card-files、box-document-service、editor-session-store、archive-import、basecard-frame-host、workspace-service 等）**随代码迁移同步迁移**，行为不得回退；
- 迁移完成标准：`npm run validate/build/test/lint` 全绿；编辑引擎无残留本地实现、无 TODO、无旁路运行时。

## 7. 建议登记的新工单（迁移启动前登记）

| 工单主题（建议） | 关联 |
|---|---|
| Host 缺少卡片解包态编辑会话服务（card.session.*） | M2 |
| Host 缺少箱子编辑会话服务（box.session.*），序列化双份实现 | M3 |
| ZIP 目录导入封闭在编辑引擎，SDK importArchiveBundle 无公共执行者 | M4 |
| undo/redo 命令历史悬空，文档操作未接入历史栈 | M2/M3 |
| 编辑态/查看态单卡渲染文档生成器双实现（关联工单 136/143） | M7 |
| 文件类型识别三套语义并存（SDK document.detectType 弱实现） | M1 |
| 工作区扫描/文件操作无 Host 服务动作 | M6 |
| 跨仓公共工具重复（MIME/路径规范化/file URL/ID/默认封面，10 项） | M1 |

## 8. 收敛后的编辑引擎形态（目标）

```text
编辑引擎（页面域，瘦壳）
  ├─ 工作区/文件树 UI ───────► client.workspace.* / client.file.* / client.file.detectType
  ├─ 卡片窗口/编辑面板 ──────► client.card.session.*（读/改/保存/历史/自动保存事件订阅）
  ├─ 箱子窗口/编辑面板 ──────► client.box.session.*（含条目/布局/封面/历史）
  ├─ 封面编辑（本地 UI） ────► client.module.invoke('cover', ...) + session.updateCover
  ├─ 编辑器资源 ────────────► client.resource.importArchive / 会话资源协议
  ├─ 渲染装配（本地装配壳） ──► Host 单卡帧生成器 + card.listBasecardDescriptors
  ├─ 布局/窗口/拖拽/画布 ────► 页面域保留（不迁移）
  └─ 命令/快捷键 ───────────► client.command.*（不变）
```
