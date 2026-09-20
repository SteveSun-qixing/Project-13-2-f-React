# RFC-权限码三方收口（工单013）

> 版本：v1.0.0
> 日期：2026-09-21
> 状态：已落地（本 RFC 记录公共资产改动的影响面与证据，工单013 据此收口）
> 关联：`项目日志与笔记/问题工单.md` 工单013；`chips-ecosystem/packages/cli/开发日志.md` 2026-09-20「跨包登记缺口」条目

## 一、事实源裁决（实测复核）

| 事实源 | 实测现状（改动前） | 结论 |
| --- | --- | --- |
| 文档《08.09-权限系统设计-九、拒绝错误码与提示》§9.1 | 8 码总表，其中 `PERMISSION_*` 裸域 4 码（`PERMISSION_NOT_DECLARED` / `PERMISSION_UNKNOWN` / `PERMISSION_INVALID` / `PERMISSION_ROLE_NOT_ALLOWED`），retryable 均 false | 权威源，无误，不改 |
| SDK 生成契约 `packages/sdk/src/generated/error-codes.ts` | 229 码中已含 §9.1 全部 8 码（含两拒绝码），与 §9.1 逐项一致 | 与文档一致，经正式管线再生成幂等（`写入 0 个文件，未变化 6 个`），未手改 |
| `@chips/bridge` `PERMISSION_ERROR_CODES`（`packages/bridge/src/protocol/errors.ts`） | 仅 `notDeclared` / `unknown` 两码 | 唯一漂移侧，本轮按 §9.1 补齐 |

引用勘误：工单013 任务说明将 §9.1 记在 `08.04-08-权限系统设计-四、内置权限清单与映射.md` 名下；实测
§9.1「错误码总表」位于 `08.09-08-权限系统设计-九、拒绝错误码与提示.md`（08.04 为 §4.x 内置权限清单分册），
两码头衔与内容完全一致，属路径笔误，不构成文档口径错误。

## 二、公共资产改动与影响面

1. `@chips/bridge`（运行时常量表，全生态错误码唯一口径来源）：
   - `PERMISSION_ERROR_CODES` 补 `invalid: 'PERMISSION_INVALID'`、`roleNotAllowed: 'PERMISSION_ROLE_NOT_ALLOWED'`；
     表注释改为「§9.1 权限拒绝域（PERMISSION_*）运行时常量表」；新增派生类型 `PermissionErrorCode` 并自包入口导出。
   - 消费面复核：`core/capability-registry.ts` 仍只用 `unknown` / `notDeclared`，行为零变化；
     `BRIDGE_PERMISSION_DENIED` 等其余 §9.1 码属 Bridge 通道表与各业务域表，不入本表（分层归属不变）。
2. `@chips/sdk` 生成契约：无字节变化（再生成幂等）；G8 `gates:contracts` 与 `contract-gen check` 双口径确认一致。
3. `@chips/cli`：`src/artifacts/permission-catalog.ts` 内 `PERMISSION_INVALID` ×3、
   `PERMISSION_ROLE_NOT_ALLOWED` ×1（及同表 `PERMISSION_UNKNOWN` ×2）全部改经 `PERMISSION_ERROR_CODES` 常量引用；
   码值与退出码行为零变化（`CROSS_DOMAIN_EXIT_CODES` 无权限码权威登记，维持退出码 1 兜底）。
4. Host：实测无这两码的字符串硬编码（仅资源域 `RESOURCE_PERMISSION_DENIED`，走自有常量），零改动。
5. 测试锚点：cli 契约面测试（`tests/artifacts-*.test.ts`）保留字面量断言，作为对外线协议码值的独立锚点；
   bridge `errors.test.ts` 新增四码集合断言。

## 三、防漂移门禁（自动化，G8 判定唯一归属 `tests/contract/`）

- 新增 `tests/contract/src/check/permission-errors.ts` + `tests/permission-errors.test.ts` + `src/code/sdk.ts`：
  ① §9.1 `PERMISSION_*` 域 ↔ Bridge 常量表 ↔ SDK 生成契约三方逐项一致（无缺项、无多余项、无重复码）；
  ② §9.1 全表（含跨层拒绝码）每码必须被生成契约收录。
- 漂移注入负例六向（bridge 缺项/自造码、sdk 缺项/多余码、文档删行/加行）均被检出；真实文件零改动（内存注入）。
- 边界：未触碰 `tools/gates/**`；G2 门禁覆盖面扩展按既有裁决归工单017。

## 四、验证证据（volta PATH，`> log 2>&1; echo EXIT=$?` 取真实退出码）

| 命令 | 退出码 | 关键输出 |
| --- | --- | --- |
| `pnpm --filter @chips/bridge run build` / `run test` / `run typecheck` | 0 / 0 / 0 | 22 文件、288 用例全绿（+1 新用例） |
| `pnpm --filter @chips/contract-gen run generate` / `run check` | 0 / 0 | 生成幂等（0 变化）；契约门禁通过（错误码 229） |
| `pnpm -r run test:contract` | 0 | `Test Files 10 passed`、`Tests 53 passed (53)`（+7 新用例）；根口径中 `cargo test -p chips-native` 步按本轮禁 cargo 约束未跑（存量 33 用例归属在途 Rust 线，本任务零 Rust 改动） |
| `pnpm gates:contracts` | 0 | [contracts] 通过（仅存量 CONTRACT091 警告） |
| `pnpm --filter @chips/cli --filter @chips/sdk --filter @chips/host run test` | 0 | cli 465 / sdk 155 / host 420 全绿 |
| `pnpm --filter @chips/cli run build` / `run typecheck` | 0 / 0 | — |
| 负证据：bridge 常量 `PERMISSION_INVALID` 临时改名 | 1 → 恢复后 0 | 正例即红报 `CONTRACT_PERMISSION_CODE_BRIDGE_MISSING: PERMISSION_INVALID`；恢复后 7/7 绿 |

## 五、结论

工单013 验收三条全部满足：三方逐项一致（缺项已按 §9.1 修实现侧补齐）、自动化防漂移用例落 `tests/contract/`、
消费方经正式常量引用无字符串硬编码。文档库零改动（实测证明 §9.1 无误，仅工单引用路径笔误已在本文勘误）。

---

**文档结束**
