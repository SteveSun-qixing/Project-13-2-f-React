# 薯片生态质量门禁脚本集

> 版本：v1.0.0
> 日期：2026-09-19
> 状态：正式版
> 适用范围：`chips-ecosystem/tools/gates/` 门禁脚本集的使用方法、退出码契约、配置参考、检查项代码、报告产物与自测方式；不覆盖门禁数值基线与豁免流程本身（以《CI/CD 与质量门禁》为准）。

---

## 一、定位

本目录交付零第三方依赖、可独立执行的 Node.js（ESM）门禁脚本集，供本地与 CI 统一调用：

| 脚本                   | 门禁           | 判定依据                                                                                               |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `check-docs.mjs`       | G12 文档门禁   | `薯片生态文档库/06-开发与运维/05-CICD与质量门禁.md` §3.6、《02-开发规范/07-文档编写规范》              |
| `check-contracts.mjs`  | G8 契约一致性  | 同上 §3.4、`05-接口与契约/04-能力契约规范.md` §6.2、`05-事件契约规范.md` §4、`08-权限系统设计.md` §4.1 |
| `check-boundaries.mjs` | G9 架构红线    | 同上 §3.5、《02-开发规范/01-代码组织规范.md》§4 依赖矩阵                                               |
| `check-coverage.mjs`   | G6 覆盖率      | 同上 §3.2、《02-开发规范/05-测试规范.md》§10.2（总体 > 80%，共享层与 Rust 核心 > 90%）                 |
| `check-entries.mjs`    | 构建期入口校验 | `06-开发与运维/02-构建与打包.md` §5.5-§5.6（插件包双入口）                                             |

统一入口 `gates-all.mjs` 串行执行前四项门禁（`gates:all`）；`check-entries.mjs` 由插件构建脚本按插件目录调用，不参与工作区级聚合。

约束：不引入任何第三方依赖；Node.js 18+（仓库基线 22）；全部脚本为 ESM（`.mjs`）；报告默认写入 `<workspaceRoot>/reports/<gate>/`。

## 二、命令

```bash
# 工作区聚合（chips-ecosystem/）
pnpm gates:all              # 全部四项，任一失败即退出码 1
pnpm gates:all --only docs,contracts
pnpm gates:docs             # 单门禁（等价 pnpm docs:check）
pnpm gates:contracts
pnpm gates:boundaries
pnpm gates:coverage
pnpm gates:test             # node:test 自测（fixtures/）

# 插件入口校验（插件目录）
node tools/gates/check-entries.mjs examples/plugins/hello
```

单脚本通用选项：`--workspace-root <dir>`、`--config <file>`、`--report-dir <dir>`、`--json`、`--no-report`、`--help`；各门禁另有专属覆盖项（见 `--help`）。

### 2.1 退出码契约

| 退出码 | 含义                                                                |
| ------ | ------------------------------------------------------------------- |
| 0      | 通过                                                                |
| 1      | 门禁失败（存在违规项）                                              |
| 2      | 用法或配置错误（参数非法、配置缺失/格式错误、来源文档或路径不存在） |
| 3      | 工具内部错误（未预期异常、报告写入失败）                            |

与《CLI 完整参考》§2.5 的 0 / 1 / 2 语义一致；3 为工具自身错误。

## 三、配置（`gates.config.json`）

单一配置驱动全部门禁，`workspaceRoot` 相对配置文件解析。

| 键                                                                                | 内容                                                                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `reports.dir`                                                                     | 报告根目录（默认 `reports`）                                                                                                   |
| `docs.root` / `docs.index` / `docs.skipDirs`                                      | 文档库根（默认 `../薯片生态文档库`）、索引文件（`README.md`）、跳过的目录（`归档` 等）                                         |
| `docs.headerKeys` / `statusValues` / `adrStatusPrefixes` / `minPieceContentLines` | 文档头键序、状态取值、ADR 状态前缀、拆分件正文下限                                                                             |
| `contracts.generated`                                                             | `contract-gen` 生成物目录与四个文件名（`capability-ids.ts`、`permission-ids.ts`、`event-ids.ts`、`capability-permissions.ts`） |
| `contracts.sources`                                                               | 能力（§6.2 表与声明计数）、权限（§4.1 表）、事件（文档目录与文件名通配、排除域 `internal`）                                    |
| `boundaries.rules`                                                                | 包规则：`allowedInternal`、`typeOnlyInternal`、`forbiddenModules`、`forbidNodeBuiltins`、`allowAnyInternal`                    |
| `boundaries.allowedDevInternal`                                                   | 允许作为 `devDependencies` 的测试基础设施包（当前 `@chips/testing`，仅限 `*.config.*` 等开发文件导入）                         |
| `boundaries.rust.allowedDeps`                                                     | Rust crate 依赖允许集（未登记 crate 即失败）                                                                                   |
| `coverage.inputs` / `metrics` / `defaultThreshold` / `groups`                     | 覆盖率输入路径与逐组阈值（TS 侧统计面）；判定为严格大于                                                                        |
| `coverage.rust.coreThreshold` / `coverage.rust.coreMatch`                         | Rust 核心统计面（`chips-*` crates）的阈值与仓库相对路径前缀集；核心阈值缺省 90（不回落 `defaultThreshold`），见 §4.4           |

## 四、检查项代码

### 4.1 文档门禁（G12）

| 代码    | 检查项                                       |
| ------- | -------------------------------------------- |
| DOCS001 | 相对链接指向不存在的路径                     |
| DOCS002 | 相对链接越出文档库根                         |
| DOCS010 | 文档头四行缺失或适用范围为空                 |
| DOCS011 | 文档头四行顺序错误                           |
| DOCS012 | 状态取值非 `正式版` / `已废弃`               |
| DOCS013 | 日期非 `YYYY-MM-DD` 或版本非 `vX.Y.Z`        |
| DOCS014 | 文件结尾缺 `**文档结束**`                    |
| DOCS015 | ADR 元数据缺失，或状态/日期非法              |
| DOCS020 | 拆分件无法定位母文档，或章节与正文标题不一致 |
| DOCS021 | 拆分件未被母文档目次收录（孤儿件）           |
| DOCS022 | 拆分件无正文标题且内容不足（错位空壳）       |
| DOCS023 | 拆分件标题与同母文档既有拆分件重复           |
| DOCS024 | 拆分件首段与同母文档既有拆分件重复           |
| DOCS030 | 正式文档未被 README 索引收录                 |
| DOCS090 | 短章节（正文 < 3 行且命名一致）警告          |

范围：`薯片生态文档库/` 全部 Markdown（跳过 `归档/` 等目录）；链接默认跳过围栏代码块与行内代码，`--raw` 关闭跳过。ADR 不要求四行文档头，元数据可内联或位于 `*-元数据.md`。

### 4.2 契约门禁（G8）

| 代码              | 检查项                                                     |
| ----------------- | ---------------------------------------------------------- |
| CONTRACT001       | 生成物目录或文件缺失（先执行契约生成）                     |
| CONTRACT002       | 生成物结构非法（缺少导出数组或映射常量）                   |
| CONTRACT010 / 011 | 能力 ID 缺失 / 多余                                        |
| CONTRACT012       | 能力 → 权限映射与 R19 表不一致                             |
| CONTRACT013       | ID 文法非法、重复，或权限数组存在重复项                    |
| CONTRACT020 / 021 | 权限 ID 缺失 / 多余                                        |
| CONTRACT030 / 031 | 事件 ID 缺失 / 多余                                        |
| CONTRACT040       | 能力 / 权限 / 事件三个命名空间互相冲突                     |
| CONTRACT041       | 映射引用了权限词表之外的权限                               |
| CONTRACT042       | 解析能力数与文档声明的计数不一致                           |
| CONTRACT043       | 生成物映射缺少或多余能力键                                 |
| CONTRACT091       | 能力 ID 含大写字母（04.03 §3.1 与 R19 canonical 冲突）警告 |

生成物契约：`packages/sdk/src/generated/` 下由 `@chips/contract-gen` 生成的 TypeScript 常量（`CAPABILITY_IDS`、`PERMISSION_IDS`、`EVENT_IDS`、`CAPABILITY_PERMISSIONS`）；门禁只做独立比对与文法校验，不代行生成职责。

### 4.3 边界门禁（G9）

| 代码        | 检查项                                                   |
| ----------- | -------------------------------------------------------- |
| BOUNDARY001 | 工作区存在未在配置中登记规则的包                         |
| BOUNDARY010 | 内部依赖不在允许集合（含反向依赖与插件互相依赖）         |
| BOUNDARY011 | 内部依赖未使用 `workspace:*`（或出现 `file:` / `link:`） |
| BOUNDARY012 | 根 `package.json` 声明业务依赖                           |
| BOUNDARY020 | 源码导入禁止模块 / 禁止的 Node 内置模块                  |
| BOUNDARY021 | 源码导入未声明的 `@chips/*` 包                           |
| BOUNDARY022 | 仅允许 `import type` 的包被运行时导入                    |
| BOUNDARY030 | 包级或 Rust crate 循环依赖                               |
| BOUNDARY040 | Rust crate 依赖超出允许集合                              |
| BOUNDARY041 | Cargo workspace 成员缺少 `Cargo.toml`                    |
| BOUNDARY042 | 出现未登记的 `chips-*` crate                             |

测试文件（`tests/`、`*.test.*`、`*.spec.*`、`*.stories.*`）不参与源码导入检查；子路径导入（如 `@chips/testing/vitest`）按包名归一判定。

### 4.4 覆盖率门禁（G6）

| 代码              | 检查项                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| COVERAGE001 / 002 | 覆盖报告缺失 / 格式或结构非法                                          |
| COVERAGE010       | 组内某维度覆盖率未严格大于阈值                                         |
| COVERAGE011       | 必需组无数据（TS `total` 与 `required` 组、Rust 核心面前缀内无行条目） |
| COVERAGE020       | 覆盖率报告不含任何文件条目                                             |

输入：TS 为 vitest + v8 `json-summary`（`coverage/ts/coverage-summary.json`，按 `coverage.groups` 分总体与共享层两个统计面，判定 `metrics` 四项）；Rust 为 cargo-tarpaulin 的 Cobertura 报告（`coverage/rust/cobertura.xml`）。

Rust 侧两条独立判定（《05-测试规范》10.2 与《CICD与质量门禁》3.2：总体 > 80%、核心 > 90%，数值权威为《架构原则》附录 R18）：

- `rust-overall`：工作区全部行数据，阈值取 `defaultThreshold`（80）。
- `rust-core`：只聚合 `<class filename="…">` 中命中 `coverage.rust.coreMatch` 前缀的行条目（逐 `<line hits="n">`，`hits > 0` 计已覆盖），
  阈值取 `coverage.rust.coreThreshold`（90）。`coreMatch` 按 **crate 名 `chips-*`** 划定，故 Neon 绑定 crate `chips-native`
  （当前目录 `packages/native/`，见工单 007）属于核心面，不设豁免、不另计统计面；核心面前缀内无行条目时报 COVERAGE011，不回退为工作区总量。
  未声明 `coreMatch` 时核心面退化为工作区总量（当前工作区全部为 `chips-*` 包，两者同值）。

cargo-tarpaulin 只产出行覆盖（不产函数、语句维度，也不产逐文件分支计数），因此 Rust 侧只按 `lines` 单维判定；
`branches` 维度仅在工作区总量层出现（`branches-valid > 0` 时）。扩大 `coreMatch` 之外的排除、更换测量口径均属豁免，须按《CICD与质量门禁》6.3 登记。

### 4.5 入口门禁（构建与打包 §5.6）

| 代码     | 检查项                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------- |
| ENTRY001 | 缺少入口文件                                                                                       |
| ENTRY002 | 入口超过字节上限（默认 8 MiB）                                                                     |
| ENTRY003 | 入口不是 UTF-8 文本                                                                                |
| ENTRY010 | 非法模块引用（`dist/index.js` 必须零引用；`render.js` 仅允许 `chips-resource://platform/vendor/`） |

## 五、报告与自测

- 报告（`--json` 与文件同构）：`gate`、`status`、`startedAt`、`finishedAt`、`summary`、`violations[]`、`warnings[]`；`gates-all` 聚合报告额外包含 `gates[]`，违约项带 `gate` 字段。
- 产物路径：`reports/docs/docs.json`、`reports/contracts/contracts.json`、`reports/boundaries/boundaries.json`、`reports/coverage/coverage.json`、`reports/gates/gates.json`、`reports/entries/entries.json`（目录已被 `.gitignore` 忽略）。

```bash
pnpm gates:test   # node --test "tools/gates/tests/**/*.test.mjs"
```

自测基于 `tests/fixtures/` 的独立夹具工作区：每个门禁同时覆盖通过路径与全部违规代码路径，CLI 覆盖 0 / 1 / 2 / 3 退出码。

## 六、维护规则

- 新增门禁规则必须同时补：检查项代码、夹具、自测断言与本文件表格。
- 门禁数值（覆盖率、体积、性能）只引用权威文档，不在脚本中另立口径；阈值变更走 `gates.config.json` 与对应文档同 PR。
- 生成物契约（`contracts.generated`）与 `@chips/contract-gen` 输出保持一一对应；生成器输出结构变更时同步门禁解析器与夹具。

---

## 相关文档

- [CI/CD 与质量门禁](../../../薯片生态文档库/06-开发与运维/05-CICD与质量门禁.md)
- [构建与打包](../../../薯片生态文档库/06-开发与运维/02-构建与打包.md)
- [代码组织规范](../../../薯片生态文档库/02-开发规范/01-代码组织规范.md)
- [测试规范](../../../薯片生态文档库/02-开发规范/05-测试规范.md)
- [文档编写规范](../../../薯片生态文档库/02-开发规范/07-文档编写规范.md)
- [开发计划](./开发计划.md)
- [开发日志](./开发日志.md)

---

**文档结束**
