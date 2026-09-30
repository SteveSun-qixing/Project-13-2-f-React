# document 宿主接管 · 开发日志（任务 #28）

## 阶段 0：接管准备与基线实测（2026-09-20 20:2x）

- 时间：接管会话开始（前路线最后活动约 19:0x，产物已随防丢快照 24605d61 / #49 验收 604b5863 入库）。
- 内容：通读 AGENTS.md、《本轮架构收口裁决》§一/§三/§四、《04-能力契约规范》§7.3（四能力契约与 Schema）、《03-核心接口规范》§3.3/§5.3-5.4/§6（ChipsError、Bridge TS 适配层、chips-parser 公开面）、《11-文档服务设计》§九、《02-Bridge三层设计》§九、《05-事件契约规范》§4.2；逐文件审计 `src/capabilities/document/**`（contract / ports / service / session-store / validation / digest / errors / descriptors 八件）与四个活动 document 套件、`tests/helpers/document-fake-ports.ts`。
- 证据（重定向取真实退出码）：
  - `npx tsc -p tsconfig.json --noEmit` → EXIT=0（任务书所记 14 条类型错误已随快照入库归零，实测确认，无需再修）；
  - `npm test` → EXIT=0（46 文件 / 595 用例，document 错误面套件缺位）；
  - `npx eslint src/capabilities tests/document-* tests/helpers` → EXIT=1（17 条：`tests/document-session-store.test.ts` 6、`tests/document-validation.test.ts` 1、`tests/helpers/document-fake-ports.ts` 10；历史"29 条"中的类型错误面部分已随 tsc 归零一并消解）。
- 遗留：错误面 `.bak` 恢复、17 条 lint、`contract.ts`/`descriptors.ts` 头注承诺的 `tests/document-capability-contract.test.ts` 未落地（前路中断）。

## 阶段 1：错误面套件恢复（验收硬闸）（2026-09-20 20:29）

- 内容：`tests/document-service-errors.test.ts` 按 `归档/document-service-errors.test.ts.disabled.bak` 的 7 条用例逐项等价重写为活动套件（覆盖面 7/7 不缩水，原 `.bak` 留归档不动）：登记码透传、未识别异常归一 `BRIDGE_INTERNAL`、诊断口缺位、opened 发布失败不阻断、changed/saved 发布失败不回滚落盘、权限每调用查询撤销即生效、会话在途失活拒绝。
- 适配依据：前路 `.bak` 写于旧替身 API（`failOpenWith` / `failPublish` / `createCardFixture`）之上；现行夹具以 `failures` 面板 + 注册来源建模（`harness.failures.open` 等），逐项等价迁移并保留全部原断言意图。
- 一处口径对齐（非放宽）：`.bak` 中"诊断日志 JSON 不含 Users"的断言与《02-Bridge三层设计》§九 权威行冲突——"未识别异常归一为 BRIDGE_INTERNAL，`message` 使用通用文案，`details` 不携带堆栈与内部路径；诊断信息写宿主日志"。防泄漏的对象是跨 Bridge 返回的错误，宿主日志正是诊断信息的落点。恢复版据此锁定：返回错误（含 `toPlain()` 序列化形态）不含内部路径、宿主日志收到 error 级诊断且携带原始消息。跨 Bridge 面反而加严（新增 `toPlain()` 不泄漏与 `retryable:false` 断言）。
- 证据：`npx vitest run tests/document-service-errors.test.ts` → EXIT=0（7 用例全绿）。

## 阶段 2：eslint 清零（17 条）（2026-09-20 20:31）

- 内容：按仓库既有口径（`tests/helpers/fake-runtime.ts`、`src/runtime/capability/scheduler.ts` 的 `Promise.resolve()` 形态；零 eslint-disable、零规则改动）修复：
  - `tests/helpers/document-fake-ports.ts` 10 条 `require-await`：无异步依赖的端口替身（`readPart` / `fingerprint` / `release` / `listMembers` / `readFileBytes` / `normalizeSource` / `registerScope` / `publish`）改为非 async 方法经 `toPortCall` 包装（失败保持 rejection 语义、不同步抛出）；`isSessionActive` / `hasPermission` 直接返回 `Promise.resolve(...)`。`readPart` 主体提取为 `readPartSync`，行为不变。
  - `tests/document-session-store.test.ts` 6 条：`require-await` ×5（释放回调与串行队列任务改 `Promise.resolve` / `Promise.reject` 形态）+ `explicit-function-return-type` ×1（`task` 补 `Promise<string>`）。
  - `tests/document-validation.test.ts` 1 条：`validateEntriesSlice({} as never)` 的多余断言移除（`{}` 本就是合法 `DocumentValue` 对象形态，拒绝语义不变）。
- 证据：`npx eslint src/capabilities tests/document-* tests/helpers` → EXIT=0；`npx tsc -p tsconfig.json --noEmit` → EXIT=0。

## 阶段 3：契约镜像锁落地（2026-09-20 20:33）

- 内容：新建 `tests/document-capability-contract.test.ts`（11 用例），兑现 `contract.ts` / `descriptors.ts` 头注承诺的双源锁：不建立包依赖边，直接读取 `packages/sdk/src/generated/{capability-ids,capability-permissions,event-ids}.ts` 与 `packages/bridge/src/protocol/capability-contracts.ts` 原文结构解析，逐项锁定：四能力 ID（并锁"SDK document 全集 − 本模块镜像 = 恰为 create/export"，防静默缩水）、R19 权限映射、四个事件 ID、限定值目标、`PLATFORM_CAPABILITY_OWNER`、输入 Schema 结构不变量与必填集、注册单元（ID/权限/Schema/目标/`parallel`/不自报 owner）、上下文四字段如实传递与 `emit` 双路禁令、与 `runtime/capabilities/reserved.ts` 预留槽位逐项一致。
- 证据（非空转验证）：向 `contract.ts` 注入两处漂移（`targetFields: ['source']→['src']`、`document:read` 权限改 `resources:write`）→ 套件 3 条失败（EXIT=1）；还原后全绿（EXIT=0），`git diff` 确认 `contract.ts` 与入库版零残差。
- `npx vitest run tests/document-capability-contract.test.ts` → EXIT=0（11 用例）。

## 阶段 4：验收复跑（最终，重定向取真实退出码）（2026-09-20 20:34）

| 命令 | 退出码 | 实测 |
|---|---|---|
| `npx tsc -p tsconfig.json --noEmit > /tmp/r28_tsc.log` | 0 | 全包含 `src/main`，无 main 侧报错可归属 R27（其并行文件零错误） |
| `npm test > /tmp/r28_test.log` | 0 | 49 文件 / 620 用例全绿；document 六套件 130 用例：session-store 20、validation 50、errors 19、service-errors 7（恢复件）、capability-contract 11（新增件）、digest 23 |
| `npx eslint src/capabilities tests/document-* tests/helpers > /tmp/r28_lint.log` | 0 | 17 → 0，无 disable 注释、无规则/配置改动 |

## 阶段 5：落档与遗留（2026-09-20 20:35）

- 落档：本日志；《document宿主接管-开发计划.md》；`packages/host/开发日志.md` 追加接管段（append-only）。
- 遗留与观察（均在本单文件面外）：
  1. 生产端口适配器（chips-parser Neon、资源管理器受控写、内核事件总线）注入组合根——属 R27 接管路（`src/main/**`）；`reserved.ts` 四槽位的 `wired=true` 待其接线达成。
  2. `tests/composition-root.test.ts` 与包 `开发日志.md` 的在途修改属 R27（工作树中并存，本单未触碰 `src/main/**`）。
  3. 包级 `npm run lint`（`eslint . && prettier --check .`）与 `npm run build` 不在本单验收闸内，其中 document 文件面实测零残差。
- 无 git 写操作；未触碰文档库任何文件。
