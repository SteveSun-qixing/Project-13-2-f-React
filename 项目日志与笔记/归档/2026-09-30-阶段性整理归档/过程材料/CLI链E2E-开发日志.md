# CLI 链进程级 E2E — 开发日志

## 任务 #92 接管段（W2 · 2026-09-21）

> 接管对象：任务 #88 `cli-e2e-agent`（触 150 轮上限死于「正式终闸执行中」，遗言称 lint/type 闸已绿但无退出码证据）。
> 前任产物固化快照：`91532f481`（接管窗口例外快照，非终验），已全部落入当前工作树。
> 本段先逐文件审计、后复跑定点闸，未做任何无审计重写或回退。

### 一、审计结论（逐文件）

1. **`packages/cli/src/artifacts/{manifest,cpk-pack,cpk-validate}.ts`（三处在途改动，意图核实）**：
   统一为清单校验注入包内成员内容表 `contents`（`IManifestValidationInput.contents?: ReadonlyMap<string, Uint8Array>`），使 `configSchema` 引用文件一律从归档/打包成员自身字节读取，不再依赖进程 cwd（《03-插件包格式》§七口径）。消费链完整：`manifest.ts:255` 优先 `contents.get(path)`、无表时才回落 `fileSystem`；`validateCardTypes`/`validateLayouts` 两臂透传；`validateManifest` 全仓仅 `cpk-pack.ts:96`、`cpk-validate.ts:589` 两个调用点，均已传表。
   **定性：该改动不是工单033 三缺陷中任何一条的修复**（与缺陷③的「嵌套归档自阻断」无关，是打包/校验的 cwd 独立性纠偏，金链路 E2E 以任意 cwd 打包生成工程的前提件）。接口、两调用点、注释三位一体，无 TODO、无占位，判定为**已完成态**，随本单一并过闸验收。
2. **`tests/e2e/cli/`（新目录，4 套件 + harness + config + tsconfig）**：全量通读。真子进程口径（spawn `packages/cli/dist/bin.js`，不 import 内部函数）、断言只认退出码+信封 `code`+磁盘产物、临时工作区 `os.tmpdir()` 隔离且 `afterAll` 无条件清理、无 skip、`runPnpm` 缺 pnpm 即失败不掩盖——与交付纪律一致。用例总数 **63**（cli-surface 15、no-carrier 17、scaffold-roles 8、golden-chain 23）。
3. **工单033 三缺陷在 E2E 中的处理（口径③硬闸核验）**：
   - 缺陷①（dist `--version` 回退 `0.0.0`）：`cli-surface.test.ts` 只断言退出 0 与 `{chips: string, platform 字段存在}` 信封形状，**未固写 `0.0.0`**，注释显名移交——维持「不为失实行为固写断言」✓；
   - 缺陷②（离线面 `host *`/未知命令/`help <未注册>` 误回 6）：**未写这组的任何断言**（写 6 即固化错误口径），三条文档承诺断言随承载链路移交金链路集成波（宿主内回归），套件头注释已登记归属——✓；`no-carrier.test.ts` 断言的「命令组缺子命令 → 3」与「平台操作 → 6」均为文档离线可定性面，无越界；
   - 缺陷③（缺省 `--out` 连续打包自阻断）：确定性用例改用工程外双显式 `--out` 目录比对字节 sha，未写缺省 out 二次 pack 用例、未 skip——✓；
   - 宿主驱动段（`plugin install --yes` → `CLI_TARGET_UNAVAILABLE / 6`）为定性边界断言，真实装载-启用-运行闭环归集成波，与「宿主驱动段登记归集成波、不做占位」裁决一致。
4. **根 `package.json` 追加脚本 `test:e2e:cli`**：先 `pnpm --filter @chips/cli run build` 再 `vitest run --config tests/e2e/cli/vitest.config.ts`，实测真实可执行（即本单终闸执行路径）。
5. **实验残留**：`项目日志与笔记/归档/task88-实验残留-e2e-chain/` 已由前任自主归档（含 README 说明），无散落残留。工作树唯一非本单改动为 `packages/native/src/parser.rs`（#93 在途禁碰面，本单零接触，仅如实留痕）。

### 二、完成态判定

前任产物判定为**功能完整、口径诚实、可收口**：E2E 套件与 src 在途改动均已收口态，无遗留半成品；本单未改动任何一行前任产物即全闸通过（见下）。工单033 三缺陷的 cli src 修复**前任未开始**（快照 diff 中 `version.ts`/`run.ts`/`collectPackInput` 零改动），按范围裁决维持 **033 开放、另单处置**，E2E 维持诚实断言口径不动。

### 三、定点闸真实退出码（volta PATH，Node v24.11.1，pnpm 9.15.9，日志留档 /tmp）

| 闸 | 命令 | 退出码 | 日志 |
| --- | --- | --- | --- |
| 根级契约（工单030 权威口径） | `pnpm vitest run tests/contract/tests/errors.test.ts` | **0**（1/1） | `/tmp/ct-1.log` |
| cli 包内全量单测 | `pnpm --filter @chips/cli run test` | **0**（20 文件 488 用例） | `/tmp/ct-2.log` |
| cli 包 typecheck | `pnpm --filter @chips/cli run typecheck` | **0** | `/tmp/ct-3.log` |
| cli 包 lint（eslint+prettier） | `pnpm --filter @chips/cli run lint` | **0** | `/tmp/ct-4.log` |
| E2E 套件（经根脚本真子进程全链） | `pnpm run test:e2e:cli` | **0**（4 文件 63 用例，含真 `pnpm install --offline` + vite 双构建 + Ed25519 真签名打包 + 五阶段校验，13.27s） | `/tmp/ct-5.log` |
| E2E 套件自身 lint/type | `npx eslint tests/e2e/cli` / `npx tsc -p tests/e2e/cli/tsconfig.json --noEmit` | **0 / 0** | `/tmp/ct-6.log` `/tmp/ct-7.log` |

### 四、移交观察项

1. **工单033 三缺陷**（修复面本单未触碰，逐条错误清单/复现步骤见 `工单033-…/任务说明.md` 第二、四节）：①`dist` 产物 `--version` 恒 `0.0.0`（`src/version.ts` 相对路径按 src 布局成立、dist 落空）；②无承载进程 `chips host *`/任意未知命令/`help <未注册>` 回 6 而非 §2.3/§3.1.1 承诺的 3（`run.ts` 插件分支先调索引路由，保留根与 help 目标未先行定性）；③缺省 `--out <dir>/dist` 二次 pack 被自身上次 `.cpk` 触发 `CPK_ARCHIVE_INVALID`（`collectPackInput` 不排除本包历史输出）。收口后须翻转 E2E 断言至文档承诺形（`cli-surface` 版本值断言、`host`/未知/`help` 三组 → 3 用例、缺省 out 二次 pack 用例）。
2. **宿主驱动段**：`plugin install/uninstall/enable/…` 真实装载-启用-运行闭环与「命令不存在 → 3」的有承载回归，归金链路集成波（波次计划已登记，无占位）。
3. **`packages/native/src/parser.rs` 工作树在途改动**：归 #93，本单未碰、未评判。

## 任务 #96 工单033 收口段（W2 · 2026-09-21）

### 一、三缺陷修复落点（修实现不改文档承诺）

1. 缺陷①：`packages/cli/src/version.ts` 清单相对路径 `../../package.json` → `../package.json`
   （`src`/`dist` 双布局同深解析到 `packages/cli/package.json`）+ 包名 `@chips/cli` 守卫；
   进程级防回归锁 `packages/cli/tests/process-dist.test.ts`（对 `dist/bin.js` 与
   `dist/version.js` 双面对象断言版本等于包清单）。
2. 缺陷②：`packages/cli/src/run.ts` 插件分支前新增固定根（含保留名 `host`）先行定性
   → `CLI_COMMAND_NOT_FOUND`（3，§2.3，不依赖索引）；发现阶段（`cli.command.list`）
   承载缺失按「无匹配」归 3，匹配后执行链路真「目标不可用」保持 6 不被吞；
   `src/commands/help.ts` 未注册目标在承载缺失时按 §3.1.1 定性 3。
   单测 `tests/dispatch-command-not-found.test.ts`（6 用例，正反两向）。
3. 缺陷③：`packages/cli/src/artifacts/cpk-pack.ts` 按**输出目录归属**排除本包历史输出
   （`<dir>/<out>` 顶层、`<名称>-<版本>.cpk` 同族 `.cpk` 不入输入；其余嵌套归档仍拒），
   §3.5.2「同一输入两次打包字节级可复现」在缺省 `--out <dir>/dist` 下成立；
   单测翻转 1 + 净增 1（`tests/artifacts-cpk.test.ts`）。

### 二、E2E 断言翻转（63 → 67，零回退）

- `cli-surface.test.ts`：`--version` 由形状断言翻转为「`chips` == 包清单版本」；
  新增「命令未找到定性」3 用例（`host list`/未知命令/`help <未注册>` → 3）。
- `golden-chain.test.ts`：新增「缺省 `--out` 连续两次 pack 字节级一致」用例；
  工程外双 `--out` 确定性用例保留。
- 第四节移交观察项 1 至此闭环；移交观察项 2（宿主驱动段）归属不变。

### 三、闸（真实退出码，volta PATH，日志留档 /tmp）

| 闸 | 命令 | 退出码 |
| --- | --- | --- |
| cli 包全量单测 | `pnpm --filter @chips/cli run test`（22 文件 497 用例，基线 488 零回退 + 净增 9） | **0**（`/tmp/cli-test2.log`） |
| cli 包 typecheck / lint | `pnpm --filter @chips/cli run typecheck` / `run lint` | **0 / 0** |
| E2E CLI 链 | 根 `pnpm run test:e2e:cli`（4 文件 67 用例） | **0**（`/tmp/e2e-cli2.log`） |
| E2E 目录 lint / tsc | `npx eslint .` / `npx tsc --noEmit`（tests/e2e/cli） | **0 / 0** |
| 契约错误码旁表面 | `tests/contract` `npx vitest run tests/errors.test.ts` | **0**（`/tmp/contract-errors.log`） |

工单033 状态随之改为**已收口**（任务说明第八节收口记录、`问题工单.md` 033 行同步）。

**文档结束**
