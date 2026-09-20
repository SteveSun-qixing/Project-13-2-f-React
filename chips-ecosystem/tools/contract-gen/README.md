# @chips/contract-gen（契约常量生成器）

> 从 `薯片生态文档库/` 的权威表生成 `@chips/sdk` 的能力 / 权限 / 事件 / 错误码 TypeScript 常量与字面量联合类型，并提供文档↔生成物一致性校验（G8 门禁）。

---

## 一、单一事实源

- 事实源是文档库权威表：能力与能力→权限映射（`04.06` §6.2）、权限词表（`08.04` §4.1、`08.03` §3.2、`13.06` §6.1）、标准事件（`05.04~05.13` 的 `#### <eventId>` 标题与 `05.02` §2.2 保留域）、错误码（各文档错误码章节，见 `src/sources.ts`）。
- `packages/sdk/src/generated/` 下的产物全部由本工具生成，禁止手写；生成物头部标注事实源与再生成命令。
- 文档变更与再生成必须同一提交；`check` 失败即视为契约漂移。

## 二、命令

```bash
pnpm --filter @chips/contract-gen run typecheck       # 严格类型检查（含测试）
pnpm --filter @chips/contract-gen run test            # 单测（样例→输出、幂等、真实文档集成）
pnpm --filter @chips/contract-gen run generate        # 生成到 packages/sdk/src/generated/
pnpm --filter @chips/contract-gen run check           # 文档↔生成物一致性（退出码 1 表示漂移）
pnpm --filter @chips/contract-gen run validate        # 仅解析与校验文档库，不比对生成物
pnpm --filter @chips/contract-gen run test:contract   # 根 test:contract 聚合入口
```

CLI 支持 `--docs-root <目录>` 与 `--out-dir <目录>` 覆盖默认路径（默认分别为仓库根 `薯片生态文档库/` 与 `packages/sdk/src/generated/`）。

## 三、产物

生成到 `chips-ecosystem/packages/sdk/src/generated/`：

| 文件                        | 导出                                           |
| --------------------------- | ---------------------------------------------- |
| `capability-ids.ts`         | `Capability`、`CapabilityId`、`CAPABILITY_IDS` |
| `capability-permissions.ts` | `CAPABILITY_PERMISSIONS`（能力 → 基础权限 ID） |
| `permission-ids.ts`         | `Permission`、`PermissionId`、`PERMISSION_IDS` |
| `event-ids.ts`              | `StandardEvent`、`EventId`、`EVENT_IDS`        |
| `error-codes.ts`            | `ERROR_CODES`、`ErrorCode`                     |
| `index.ts`                  | 统一再导出                                     |

## 四、门禁接入

- G8 契约一致性：`pnpm gates:contracts`（`tools/gates/check-contracts.mjs`）按 `gates.config.json` → `contracts.generated` 读取上述 TS 生成物，与文档库权威表逐项比对；生成物缺失、漂移或目录出现手写 `.ts` 即失败。
- 根 `test:contract` 聚合：`pnpm -r run test:contract` → 本包 `tsc && node dist/cli.js check`。
- 生成物同时纳入根 `prettier --check .`（G3），渲染格式保持 Prettier 兼容。

## 五、目录

```text
tools/contract-gen/
├── src/                 # types / sources / markdown / load / parse / naming / validate / emit / generate / cli / index
├── test/                # 样例夹具、单测与真实文档集成测试
├── vitest.config.ts     # 工作区测试发现与包内覆盖率阈值（80）
├── 开发计划.md
└── 开发日志.md
```

## 六、口径说明

- 能力 ID 动作段按 canonical R19 表拼写（含 `window:setTitle` 等驼峰形式）；《能力契约规范》§3.1 已统一为「`domain`/`target` 全小写、`action` 段允许平台登记的驼峰」，与生成器 `CAPABILITY_ID_PATTERN` 一致（工单 003 收口，原 `CONTRACT091` 警告判定面已删除）。
- `internal:*` 内核内部事件与通配族错误码（`RESOURCE_*` 等）不进入生成物；内容处理服务能力只收录代表性错误码，完整码随提供方契约发布。

---

**文档结束**
