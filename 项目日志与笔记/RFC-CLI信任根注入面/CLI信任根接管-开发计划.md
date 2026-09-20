# CLI 信任根接管-开发计划（任务 #46：工单019/020 收口）

> 接管日期：2026-09-21
> 路线：W2 波次 #46（前路线智能体中断，在途产物已入库于提交 `24605d61`）
> 权威依据：`项目日志与笔记/RFC-CLI信任根注入面/RFC-CLI信任根注入面.md`（v1.0.0，方案 A 已裁决）
> 文件面（owner 唯一）：`chips-ecosystem/packages/cli/**`、
> `chips-ecosystem/tests/contract/tests/cli-bin-resolution.test.ts`、
> `chips-ecosystem/package.json`（根 bin 锚点，快照已入库）、
> `chips-ecosystem/tools/scaffold/src/templates/**`（工单020 缺陷① 模板锚点，RFC §四.5 登记）、
> `项目日志与笔记/RFC-CLI信任根注入面/`、`项目日志与笔记/工单019-*/`、`工单020-*/`、
> 《问题工单.md》019/020 状态行、`薯片生态文档库` 五处回写面（RFC §四.7 清单）。
> 禁改面：`packages/sdk/**`（R43 并行在改）、`packages/host/**`（两路并行在改）、
> `tests/e2e/fixtures/cpk/**`（夹具链只读消费）、`tools/gates/**`。

## 一、接管时点现状审计（逐文件）

| 文件 | 状态 |
| --- | --- |
| `src/artifacts/trust-roots.ts` | 已落：`TRUST_ROOTS_ENV` + `loadTrustRootsFile` 严格 schema（缺失 5 / 非文件 5 / 非法 2），无判定逻辑 |
| `src/artifacts/index.ts` | 已接线：`validate` 输入 `trustRootsFile` 覆盖构造期 `trustRoots`；判定唯一收敛于 `verifySignature` |
| `src/artifacts/cpk-validate.ts` | 已接线：目录态路径归一 + 源码工程（根级 `package.json`）前置诊断 `CPK_LAYOUT_INVALID`；不可达版本比对死代码已按 RFC 替换 |
| `src/client/types.ts` | 已接线：`ICliArtifactsApi.validate` 新增可选 `trustRootsFile` |
| `src/commands/plugin.ts` | 已接线：`validateCommand` 读 `context.env[TRUST_ROOTS_ENV]`，空串按未设置 |
| `src/index.ts` | 已导出 `loadTrustRootsFile` / `TRUST_ROOTS_ENV` 公共库面 |
| `tests/trust-roots-injection.test.ts` | 已落 306 行：loader 单元 + 命令面接线 + 真实夹具正/负/未注入三态 + 目录态口径 |
| `tests/support/fake-client.ts` | 已扩展 `trust=` 调用记录锚点 |
| `tests/contract/tests/cli-bin-resolution.test.ts` | 已落：`pnpm exec chips` 工作区 bin 锚点 + `package` 脚本链端到端 + 自清理 |
| `chips-ecosystem/package.json` | 已加根 `devDependencies: "@chips/cli": "workspace:*"`（锁文件同步） |

接管后仍需收口的缺口：

1. **工单020 缺陷① 模板锚点**：`tools/scaffold` 模板 `packageDevDependencies` 未补 `@chips/cli`（RFC §四.5 裁决项，未落地）；相应脚手架测试锚点需同步。
2. **文档回写面（RFC §四.7 清单，5 处）全部未动**：
   `07.02` §2.7 环境变量表、`07.03` §3.5.3、`03.06` §6.3、`03.07` §7.2 目录态示例纠偏、`02.07` §7.3 关系注记。
3. **RFC §五 验证证据表**未回填（需全链真实退出码）。
4. **两工单收口记录与状态行**、`packages/cli/开发日志.md` 接管段未写。
5. 全量验收（build/typecheck/test/test:contract/gates:all）未在本接管时点跑过。

## 二、阶段计划

- **P1 基线验证**：`pnpm --filter @chips/cli build / typecheck / test`（PATH 前置 volta/cargo），确认在途产物编译与测试现状；任何红灯先归因再修。
- **P2 缺口补齐**：脚手架模板 `@chips/cli` devDep 锚点 + 其测试面同步；确认 examples G9 边界不受影响（根 bin 锚点方案，不改 `tools/gates/**`）。
- **P3 文档回写**：按 RFC §四.7 五处清单写入 `薯片生态文档库`（主文档为目录壳，正文只在拆分件）；回写后跑 `校验拆分件.py`、`检查文档链接.py` 取真实退出码。
- **P4 端到端实证**：RFC §五 V2–V6 命令逐条执行（信任根注入正/负/未注入、bin 锚点、package 链），全部重定向取退出码。
- **P5 全量门禁**：`pnpm test:contract`、`pnpm gates:all`；失败项若归属并行路文件（sdk/host）如实报告归属，不越面修复。
- **P6 收口落档**：RFC 证据表回填、两工单 `收口记录.md`、《问题工单.md》状态行、`packages/cli/开发日志.md` 接管段。

## 三、验收口径（对应两工单 §四）

- 工单019：命令面唯一注入通道 `CHIPS_TRUST_ROOTS_FILE`（§2.7 登记）；正夹具注入后 EXIT=0 且 `签名校验: 通过`；未注入/不匹配按 `CPK_SIGNATURE_INVALID` 拒绝（stage=signature）；夹具链与库面判定同源，无第二实现。
- 工单020：`pnpm exec chips` 在插件子包解析到工作区 bin（契约测试固化）；脚手架模板自带锚点；目录态=包根形态口径文档与实现收敛，源码工程目录给出打包指引；`package` 脚本链端到端在册用例通过。

## 四、阶段执行记录（2026-09-21 接管轮）

- P1 基线：build/typecheck/test 均 0（20 文件 / 482 用例）——在途产物编译与测试现状良好。
- P2 缺口：脚手架模板全角色补 `@chips/cli: workspace:*` 锚点（`pnpm --filter @chips/scaffold test/typecheck` → 0/0，87 用例）；CLI lint 首跑 1（4 个本路线文件 prettier 非规范形），`--write` 收敛后 0，复跑 test 0（482 用例，纯格式化）。
- P3 回写：文档库 5 拆分件（§2.7 环境变量行、§3.5.3 注入+包根口径、§6.3 注入通道归属、§7.1 bin 锚点 + §7.2 漂移示例删除、§7.3 关系注记）；`校验拆分件.py` 0、`检查文档链接.py` 0。
- P4 实证：V2 注入正夹具 0（签名通过）、V3 负夹具 1/1/1（三码精确）、V4 未注入 1（未注册 keyId）、V5 解析到工作区 bin 0、V6 pack+validate 0/0（自清理）。
- P5 门禁：`gates:all` 收口实测 0；终验快照期两次外部漂移（`tools/gates/**` 并行 017 路在途编辑：豁免助手改名错位崩溃 → 改名收敛后 TD-001 `scopePaths` 登记为空不构成豁免），如实报告归属不越面；`test:contract` 1——直跑实例本单用例 `✓ 3 tests` 通过，唯一失败 `cpk-fixtures`（R43/#43 在途 sdk 源码漂移，非本路文件面，如实报告）。
- 计划外补强：双执行面并发串扰收口——首版互斥锁经一轮迭代（vitest 30s 超时残锁 + pnpm fail-fast 残锁），终版 PID 存活性/锁龄双接管 + 用例显式 240s 超时，双进程并发实测两实例均 3/3。
- P6 落档：RFC §五 证据回填（状态已收口）、两工单 `收口记录.md` + 任务说明状态行、《问题工单.md》019/020 状态行、`packages/cli/开发日志.md` 接管段。
- 收尾清理：契约/夹具运行对 `examples/plugins/hello/render.js` 的构建副作用已按 HEAD 内容复原（只读 `git show` 重定向，非 git 写操作）；临时锁目录已清除。

