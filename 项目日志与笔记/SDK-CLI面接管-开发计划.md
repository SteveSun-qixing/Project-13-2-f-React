# SDK-CLI 面接管-开发计划（任务 #43 接管：@chips/sdk 主入口 CLI 面 P0 收口，关闭工单022）

> 日期：2026-09-21
> 性质：接管计划。前一路线智能体中断（最后活动 19:11），在途产物已入库于提交 24605d61；
> 本计划基于对遗留产物的逐文件审计制定，不重做已完成部分。
> 关联：`项目日志与笔记/RFC-SDK主入口CLI面收口/RFC-SDK主入口CLI面收口.md`（方案与影响面登记，
> 接管书沿用其裁决）、`项目日志与笔记/问题工单.md` 工单022、
> `薯片生态文档库/05-接口与契约/02.03-02-SDK-API规范-三、客户端封装.md` §3.5、
> `薯片生态文档库/06-开发与运维/07.10-07-CLI完整参考-五、插件 CLI 命令扩展-5.6 SDK 接口.md`。

## 一、接管审计结论（逐文件现状，2026-09-21 实读）

| 产物 | 现状 | 判定 |
|---|---|---|
| `src/client/target-invocation.ts` | 完整：`TargetResolver` + `invokeTarget`，目标缺失异步拒绝 `SDK_BRIDGE_UNAVAILABLE`、错误原样透传 | 不收尾 |
| `src/types/cli/command.ts` | 完整：§2.2 CLI 扩展行 8 个命令类型 + 内部声明形状（不导出，RFC 5.1 口径） | 不收尾 |
| `src/types/cli/task.ts` | **缺失**。`cli-task-api.ts:29`、`chips-bridge.ts:25`、`index.ts:174`、`index.test.ts:158` 均引用 `./types/cli/task.js` → 构建/类型检查必然失败 | 本接管唯一实现缺口 |
| `src/client/cli-command-api.ts` / `.test.ts` | 完整：三方法 → `cli.command.*` 路由，`list` 省略参数传 `{}`；测试 8 用例覆盖转发形状、透传、无目标拒绝 | 不收尾，跑通即可 |
| `src/client/cli-task-api.ts` / `.test.ts` | 完整：五能力方法取 `Capability.CLI_TASK_*` 生成常量、三调度方法走 `cli.task.*` 路由、`{ task }` 信封解包；测试 7 用例 | 不收尾，跑通即可 |
| `src/client/chips-bridge.ts` + `.test.ts` | 完整：`cliCommand` / `cliTask` 只读实例成员（§3.2 形状），原型面保持三方法；冻结断言已按 RFC §7 口径更新 | 不收尾 |
| `src/index.ts` | 完整：CLI 扩展 11 类（8 命令类型 + `CliTaskApi` + 既有 `CliTaskStatus`/`CliTaskRecord`）与 manifest 15 类 `export type` 段均已就位，头注缺口句已删 | 不收尾 |
| `src/index.test.ts` | 完整：新增「CLI 扩展与 manifest 类型为纯类型再导出、运行时说明符集合不变」断言 | 不收尾 |
| `tests/public-entries.test.ts` | 完整：§3.5 两段示例落地为可执行用例、11+15 类型编译期消费点就位 | 不收尾 |
| `package.json` 导出表 | 三入口 `.` / `./testing` / `./scaffold` 与 §2.1 一致，无需变更 | 不动 |
| `tests/contract`（sdk-exports） | 判定面以文档 §2.2/§8 为输入解析成快照，不含实现侧（RFC §三补充复核）；本单不改 §2.2 → 零扰动 | 只跑验证 |

## 二、阶段划分

1. 阶段一（实现）：新建 `src/types/cli/task.ts` —— `CliTaskApi` 八方法面逐字对齐
   《07-CLI完整参考》§5.6:79-88；`CliTaskRecord` / `CliTaskStatus` 复用
   `../types/capabilities/cli-task.js` 既有定义，不重复定义（§11 约束 5、12；RFC 5.1）；
   `create` / `bindInvocation` 入参按 §5.6 行内对象类型表达，不新增命名类型（RFC 5.1）。
2. 阶段二（验证）：验收四条命令全跑，重定向取真实退出码：
   - `pnpm --filter @chips/sdk build` → 0
   - `pnpm --filter @chips/sdk typecheck` → 0；`pnpm --filter @chips/sdk test` → 0（记录文件/用例数）
   - `npx eslint packages/sdk` → 0；根 `pnpm test:contract` → 0
   - 失败则按错误修正（只允许改 `packages/sdk/**`），循环至全绿。
3. 阶段三（收口文档）：
   - `项目日志与笔记/问题工单.md`：仅改 022 条目状态行为「已收口」+ 证据命令与退出码（不动其他行）；
   - `chips-ecosystem/packages/sdk/开发日志.md`：末尾追加接管段（交付、证据、遗留）；
   - RFC 目录：追加《接管收口记录.md》，登记 §8 文档面两条（07.10 代码块残缺补全、02.03 §3.5
     传输映射小节）未随在途提交落地、属共用文档面且不在本接管 owner 文件面内，结转遗留待文档波次处理。

## 三、边界与红线（继承任务书）

- 只改 `packages/sdk/**`、RFC 目录、`问题工单.md` 的 022 状态行；`packages/cli/**`、`packages/host/**` 零改动。
- 禁止任何 git 写操作；禁止 TODO/占位/兼容层/放宽断言/删用例。
- `src/generated/**`、`tools/contract-gen`、文档库（薯片生态文档库）零改动（RFC 第四节判定：实现补齐、冻结面零变化）。
