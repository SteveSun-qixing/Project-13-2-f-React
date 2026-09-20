# document 宿主接管 · 开发计划（任务 #28）

> 登记：W2 波次接管（document:open/read/write/save 宿主实现收口，接管中断路线）
> 目标：`packages/host` 内 `src/capabilities/document/**`、`src/runtime/**`（ports 相关）、`tests/document-*.test.ts`、`tests/helpers/document-fake-ports.ts` 三面全绿收口；恢复被移档的错误面套件为活动套件。
> 前置：前路线智能体最后活动约 19:0x，其产物已随防丢快照 24605d61 / 604b5863 入库；`tests/document-service-errors.test.ts` 被移入 `packages/host/归档/document-service-errors.test.ts.disabled.bak`（登记为验收闸口观察项：须在新套件复活，否则按删用例打回）。本接管以实测为准，不采信历史书面数值。

## 一、口径与依据

- 命名与类型唯一依据：《本轮架构收口裁决》§一（`DocumentView = CardRenderView | BoxRenderView`、`BaseCardView`、`ChipsError` 统一错误类、10 位 Base62）与 §三/§四。
- 契约依据：《04-能力契约规范》§7.3（四能力输入输出与 Schema、R19 权限映射、`documentId` 口径）、《11-文档服务设计》§三～§十（会话模型、生命周期失败语义、事件发布职责、错误码归属）、《02-Bridge三层设计》§9（错误归一：未识别异常归一 `BRIDGE_INTERNAL`、通用文案、`details` 不携带堆栈与内部路径、诊断信息写宿主日志）、《03-核心接口规范》§3.3（ChipsError）/§5.3-5.4（Bridge TS 适配层）/§6（chips-parser 公开面）。
- 修实现不修文档：所有断言以裁决与契约文档为准，不放宽任何既有断言。

## 二、文件面（owner 唯一）

- `packages/host/src/capabilities/document/**`
- `packages/host/src/runtime/**`（仅 ports 相关）
- `packages/host/tests/document-*.test.ts`
- `packages/host/tests/helpers/document-fake-ports.ts`
- 禁触：`src/main/**`（并行接管路 R27 在改组合根接线）、`src/platform/**`、任何文档库文件、任何 git 写操作。

## 三、基线实测（接管时点，全部重定向取真实退出码）

| 命令 | 退出码 | 实测 |
|---|---|---|
| `npx tsc -p tsconfig.json --noEmit` | 0 | 前路遗留的 14 条类型错误（IDocumentKind/DocumentKind 命名漂移等）已随快照入库归零，实测确认 |
| `npm test` | 0 | 46 文件 / 595 用例全绿（document 四活动套件在列，错误面套件缺位） |
| `npx eslint src/capabilities tests/document-* tests/helpers` | 1 | 17 条错误：`tests/document-session-store.test.ts` 6 条、`tests/document-validation.test.ts` 1 条、`tests/helpers/document-fake-ports.ts` 10 条（require-await / explicit-function-return-type / no-unnecessary-type-assertion） |

## 四、阶段计划

1. **错误面套件恢复**：按 `归档/document-service-errors.test.ts.disabled.bak` 的 7 条用例逐项等价重写为活动套件 `tests/document-service-errors.test.ts`（覆盖面不缩水：登记码透传、未识别异常归一 BRIDGE_INTERNAL、诊断口缺位、opened/changed/saved 发布失败不回滚、权限每调用查询不缓存、会话在途失活拒绝）。断言口径对齐《02-Bridge三层设计》§9 现行权威（"不透出原始消息"约束的对象是跨 Bridge 返回的错误，宿主日志按规范承载诊断信息）。原 `.bak` 留归档不动。
2. **eslint 清零**：按仓库既有口径（`fake-runtime.ts` / `router.ts` 的 `Promise.resolve()` 形态，非禁用注释、非规则放宽）修复 17 条。
3. **契约镜像锁落地**：新建 `tests/document-capability-contract.test.ts`，兑现 `contract.ts` / `descriptors.ts` 头注承诺的"读取 SDK / Bridge 生成源与登记表原文逐项比对，任一漂移即红"（正是前路 IDocumentKind/DocumentKind 命名漂移的防复发面）：锁定四能力 ID、权限映射、事件 ID、限定值目标、`PLATFORM_CAPABILITY_OWNER`、注册描述符与 `runtime/capabilities/reserved.ts` 预留槽位逐项一致。
4. **验收复跑**（全部重定向取真实退出码）：
   - `npx tsc -p tsconfig.json --noEmit` → 0（全包含 src/main，main 侧若报错归属 R27 并报告）
   - `npm test` → 0（报用例总数，document 全部套件 + 错误面恢复套件在列）
   - `npx eslint src/capabilities tests/document-* tests/helpers` → 0
5. **落档**：本文件同目录追加《document宿主接管-开发日志.md》（时间/内容/证据/遗留）；在 `packages/host/开发日志.md` 追加接管段；不做任何 git 写操作。

## 五、已知边界与观察

- 生产适配器（chips-parser Neon、资源管理器受控写、内核事件总线）接线属 R27 组合根接管路；本单文件面只交付端口与替身可验收面。
- `contract.ts` 头注引用的 `tests/document-capability-contract.test.ts` 在前路未及创建即中断，属注释承诺与实态漂移，阶段 3 收口。
