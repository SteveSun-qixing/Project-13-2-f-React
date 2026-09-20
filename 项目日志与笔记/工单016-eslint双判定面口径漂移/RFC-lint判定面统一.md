# RFC-lint判定面统一：eslint 唯一权威判定面合并（工单016 收口）

> 提案/实施：W1-016（子智能体）+ 主智能体接管收口（2026-09-20）
> 状态：已实施
> 裁决依据：主智能体按工单011「合并」同型裁定——唯一权威判定面 = 根 `chips-ecosystem/eslint.config.mjs`；根配置与根 `package.json` lint 脚本一字不改；不允许以放宽根类型感知规则或 disable 注释拉平差异。
> 关联：`任务说明.md`（问题与验收口径）、`开发计划.md`（实测基线与形态修订过程）。

---

## 一、结论形态

1. 树内不再存在任何第二份 eslint 配置：`packages/host|bridge|cli|sdk|antd` 五份包级 `eslint.config.mjs` 移入各包 `归档/eslint-config-工单016收口/`（附 `归档说明.md`，不删除）。`find` 复核实测全树（排除 node_modules 与归档）仅剩根 `eslint.config.mjs` 一份。
2. 包目录内既有裸形态 `eslint .`（ui/bridge/cli/sdk/host/antd/tests/contract/tests/perf/tools/scaffold/examples/plugins/hello）经 ESLint 9 向上查找结构性命中根配置，base path = 仓库根，与根面 `npx eslint .` 对同批文件判定等价。委托由结构保证：无第二配置即无劫持可能。
3. 无包脚本需要改写（修订后的形态即「零 package.json 改动」，见开发计划 §2.1 形态裁决修订——初版 `--config ../../eslint.config.mjs` 形态实测把配置 base path 置为执行 cwd，导致根配置 `packages/ui/**`、`packages/antd/**` 路径特例块失配，伪红 22/94 条，违背「蕴含性」验收，故弃用）。
4. prettier 面维持工单010 暂行口径（`--ignore-path ../../.prettierignore`），本轮一字不动。

## 二、合并消失的规则面（不静默丢弃，登记如下）

旧包级配置中的附加规则随面合并消失，属「合并」裁决的直接结果（禁止改根配置故无法吸收），其守护职责由既有的其它机制承接：

| 消失面                                       | 承接机制（实测在册）                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| host/cli 包级 electron 导入限制              | 根 `eslint.config.mjs` 自身含三处 `no-restricted-imports` 块 + `tools/gates/check-boundaries.mjs`（`gates.config.json` `forbiddenModules` 实测含 electron、@chips/antd） |
| `@typescript-eslint/consistent-type-imports` | 类型感知面由根 `recommendedTypeChecked` 主导；该风格规则为非判定性（不影响正确性），随合并自然退场                                                                       |
| 包级测试文件豁免                             | 根配置统一以路径特例块表达测试文件语义，无第二口径                                                                                                                       |

## 三、验证证据（2026-09-20 主智能体实测，全部 `> log 2>&1; echo EXIT=$?` 真实退出码）

| #   | 命令                                                                                   | 结果                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | 根 `pnpm lint`                                                                         | 首轮 EXIT=1（唯一红点=工单003-B 入库的 `tsconfig.base.json` 未过 prettier 格式，属 003B 收尾遗漏）；`npx prettier --write tsconfig.base.json` 后复跑 EXIT=0（`/tmp/t016-root-lint2.log`） |
| V2  | `pnpm -r --if-present run lint` 全工作区                                               | EXIT=0（`/tmp/t016-r-lint.log`）                                                                                                                                                          |
| V3  | 蕴含性负证据：`packages/bridge/src/__t016-probe.ts` 注入 `no-floating-promises` 触发体 | 包面 `eslint .` EXIT=1 与根面 `eslint packages/bridge` EXIT=1 报出同规则同消息（`/tmp/t016-neg-pkg2.log`、`/tmp/t016-neg-root2.log`）；删除探针后包面复绿 EXIT=0                          |
| V4  | 委托等价的结构证据：包目录 `npx eslint --print-config src/…`                           | 有效配置含 `@typescript-eslint/require-await`、`no-floating-promises`、`no-unsafe-return` 均为 severity 2——类型感知规则在包 cwd 下生效，证明命中根配置而非任何包级残留                    |
| V5  | `find . -name "eslint.config.*"`（排除 node_modules/归档）                             | 仅 `./eslint.config.mjs` 一项                                                                                                                                                             |

探针选型记录：初版探针 `async fn { return Promise.resolve(1); }` 在现行 typescript-eslint 的 `require-await` 语义下不触发（返回 Promise 即视为已消费异步值）——非判定面失效，V4 已证规则在配；换用 `no-floating-promises` 悬空 Promise 触发体后双向显红。后续复用此实验勿再用 require-await 探针误判。

## 四、验收对照（任务说明 §期望行为）

1. 单一事实源：达成（V5 结构性唯一 + 委托由向上查找保证）。
2. 任一执行面红蕴含另一面红：达成（同配置对象，V3 双向同规则同消息实证）。
3. 未放宽根规则、未加 disable 注释：达成（根配置一字未改；本轮改动面=5 配置入归档 + 1 次 prettier 格式化）。

## 五、遗留与建议（不构成本单红点）

1. `tools/testing` 的 `eslint src tests vitest.config.ts` 面与 G6 合并代理（工单017）在途文件面交叠，按串行闸由主智能体在 017 收口后复核其委托形态（该目录本无包级配置，预期零动作）。
2. `tests/e2e` 既有 `eslint . --config ../../eslint.config.mjs` 形态：判定结果与根口径等价（其目录无路径特例块依赖），但 `--config` 置 base path 为 cwd 的机制隐患在册（§一.3），后续如为 e2e 增加路径特例需先改回裸形态。本轮不动（不在裁决改动面内）。
3. ESLint v10 将收紧向上查找/配置语义，届时根配置单面形态需随大版本 RFC 复核。
