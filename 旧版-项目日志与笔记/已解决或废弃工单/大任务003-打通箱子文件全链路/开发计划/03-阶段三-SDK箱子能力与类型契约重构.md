# 阶段三：SDK箱子能力与类型契约重构

## 1. 阶段目标

让 SDK 成为 Host 新箱子动作面的唯一类型化消费入口，彻底移除旧箱子类型和旧返回结构，使查看器、编辑引擎以及后续生态应用都能以同一套正式 API 使用箱子能力。

## 2. 入口条件

- 阶段二已完成；
- Host 新箱子动作面、schema、权限和错误码已冻结；
- `Chips-SDK` 当前 `src/api/box.ts` 与相关技术文档已核对。

## 3. 涉及仓库

| 仓库 | 本阶段职责 |
|---|---|
| `Chips-SDK` | 重构箱子 API、类型与测试 |
| `生态共用技术文档` | 仅在代码核对后修正文档漂移 |

## 4. 重点交付物

- 新版 `BoxApi`；
- 箱子摘要、详情、资源句柄、查询、会话等类型定义；
- 新版 `route-manifest`；
- SDK 侧参数校验与错误归一；
- 对应技术文档和测试。

## 5. 任务拆解

### 5.1 替换旧 `BoxApi`

需要彻底移除以下旧口径：

- `full/shell/mixed`
- `internal/external`
- 仅三动作 `pack/unpack/inspect`

新 `BoxApi` 至少应覆盖：

- `pack`
- `unpack`
- `inspect`
- `validate`
- `readMetadata`
- `openView`
- `listEntries`
- `readEntryDetail`
- `resolveEntryResource`
- `readBoxAsset`
- `prefetchEntries`
- `closeView`

### 5.2 建立完整类型系统

至少补齐以下类型：

- `BoxMetadata`
- `BoxEntrySnapshot`
- `BoxEntryPage`
- `BoxEntryQuery`
- `BoxSessionInfo`
- `BoxOpenViewResult`
- `BoxEntryDetailResult`
- `ResolvedRuntimeResource`

要求：

- 类型命名与共享文档保持一致；
- 调用方无需再自己拼接 schema 或手写 `unknown`；
- 不把 Host 运行时实现细节迁入 SDK。

### 5.3 更新核心客户端导出面

需要同步更新：

- `src/index.ts`
- `src/core/client.ts`
- `src/types/client.ts`
- `src/contracts/route-manifest.json`
- 箱子相关内部技术文档

并确保：

- 查看器、编辑引擎后续都只消费 SDK 新版接口；
- `plugin.getLayoutPlugin`、`plugin.query({ type: 'layout' })` 等类型也与布局插件新清单结构保持一致。

### 5.4 测试收口

需要补齐：

- 参数必填校验测试；
- 新动作面调用测试；
- 路由清单同步测试；
- 旧模型删除后的类型烟雾测试。

## 6. 串并行安排

本阶段可与阶段四受控并行，但必须遵守：

- 阶段三只围绕 Host 已冻结的新动作面编码；
- 若阶段四发现布局插件类型需要额外公共字段，必须先回到共享文档和 Host 统一收口，再更新 SDK；
- 不允许 SDK 为了先支持查看器而保留旧箱子 API。

## 7. 验证门禁

- `cd Chips-SDK && npm test`

同时必须验证：

- `client.box.*` 动作覆盖 Host 全部正式箱子能力；
- 类型定义中不再出现旧箱子分类；
- `route-manifest` 与 Host 新动作面一致；
- 调用方可以不写 `any/unknown` 直接消费箱子 API。

## 8. 阶段退出标准

- SDK 已成为箱子正式类型入口；
- 查看器与编辑引擎可以直接基于 `client.box` 开发；
- 若调用方仍必须绕过 SDK 直接写 `invoke('box.xxx')` 才能完成正式能力，则本阶段不算完成。
