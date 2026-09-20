# bridge 补测接管 · 开发计划（任务 #42）

> 登记：W2 波次接管（bridge-cov-takeover-2，死路接管波重发）
> 目标：`chips-ecosystem/packages/core-rust/crates/chips-bridge` 行覆盖率实测 ≥92%
> 前置：前路线智能体最后活动 19:06，五套件（admission_races / draining_shutdown_edges / late_results / registration_races / serial_queue_timeout）已随 24605d61 入库；本接管以实测为准，不采信历史书面数值。

## 一、口径与依据

- 覆盖率工具：`cargo-tarpaulin 0.37.3`（`cargo-llvm-cov` 未安装，`which` 实测确认）。
- 测量口径：与 G6 `rust-core` 线一致（`tools/gates/check-coverage.mjs` 的 tarpaulin 行覆盖口径，含测试行；报告过滤仅计 `crates/chips-bridge/` 下的源文件行）。
- 语义依据：《能力契约规范》§4.4（注销幂等、原 owner 绑定、蓝绿 draining）与 §9.3/§10.1/§11.2；《核心接口规范》§5；`Bridge三层设计》§8。
- 不可达防御臂处理：按工单012 TD-001 同型口径——逐行定性、登记式处理（开发日志 + 本计划追加记录），不设 `#[cfg(test)]` 后门、不为内部态开 `pub`、不改阈值、不放宽任何既有断言。

## 二、文件面（owner 唯一）

- 仅 `packages/core-rust/crates/chips-bridge/**`（src、tests）。
- 禁触：`crates/chips-parser/**`（并行路在途）、`chips-core`、`cordis`、任何 TS 包、根 Cargo workspace 配置。
- cargo 一律 `-p chips-bridge` 作用域；target 可清、`~/.cargo` 不动；与 parser 路锁竞争时耐心等待重试。

## 三、阶段计划

1. **基线实测**：`cargo test -p chips-bridge`（用例数）+ `cargo tarpaulin -p chips-bridge`（报告落 /tmp，过滤出 chips-bridge 包内 src/tests 各行覆盖率），记录前值与未覆盖行清单。
2. **补测**：对每一处未覆盖行判定「可达但未测」vs「不可达防御臂」；前者补真实行为用例（经公开面驱动，带有效断言），后者逐行定性登记。
3. **验收复跑**（全部重定向取真实退出码）：
   - `cargo test -p chips-bridge` → EXIT=0（报用例数）
   - 覆盖率报告 → 行覆盖 ≥92%（报精确数值与命令）
   - `cargo clippy -p chips-bridge --all-targets -- -D warnings` → EXIT=0
   - `cargo fmt -p chips-bridge --check` → EXIT=0
4. **落档**：本文件追加开发日志（基线数值、增量用例清单、不可达臂定性表、终值与退出码）；同步 `crates/chips-bridge` 相关口径到 core-rust 开发日志；不做任何 git 写操作。

## 四、开发日志

### 阶段 0：接管准备（本文档落档）

- 已读：AGENTS.md、《能力契约规范》§4.2/§4.3/§4.4、《核心接口规范》03.05 §5 相关口径、工单005 §4.4 残口收口记录、工单012 TD-001 豁免口径（《技术债务清单.md》TD-001：登记式豁免、照常测量呈现、不改阈值/口径）。
- 工具确认：`cargo-tarpaulin 0.37.3` 可用；`cargo-llvm-cov` 不存在。
- 磁盘：数据卷余量约 11Gi；`packages/core-rust/target` 1.2G（含前路 tarpaulin 缓存），按红线全部走 `-p chips-bridge` 作用域。

（后续阶段日志随进度追加。）

### 阶段 1：基线实测（接管复核）

- `cargo test -p chips-bridge`（重定向 `/tmp/r42_test.log`）EXIT=0：**135 用例**（单测 53 + 集成 81 + 文档示例 1），与前路 24605d61 入库快照一致，五套件全部在库且在绿。
- 覆盖率基线命令：`cargo tarpaulin -p chips-bridge --engine llvm -o Lcov Stdout --output-dir /tmp/r42_cov`（`/tmp/r42_cov_baseline.log`、`/tmp/r42_cov/lcov.info`），过滤仅 `crates/chips-bridge/` 口径文件：
  - `src/bridge.rs` 491/493 = 99.59%（未覆盖 182、224）
  - `src/schema.rs` 489/490 = 99.80%（未覆盖 801）
  - `src/descriptor.rs` 12/12、`src/naming.rs` 31/31、`src/permissions.rs` 24/24 = 100%
  - **crate 合计 1047/1050 = 99.71%**，已远超 ≥92% 目标；未覆盖行恰为前路逐行定性过的三处防御臂，本轮接管独立复核（见阶段 3）。

### 阶段 2：接管复核与补测

- **bridge.rs:182 复核（维持不可达定性）**：`state.invocations.remove` 全 crate 仅 `release_invocation` 一处调用点（grep 核实行 181），每序号恰有一个 `InvocationGuard`（RAII Drop 至多一次），同序号二次释放的结构路径不存在——防御性幂等兜底。不造伪装用例。
- **bridge.rs:224 复核（维持不可达定性）**：`Admitted` 字段声明序 `_guard`（279 行）先于 `permit_rx`（285 行），drop 时守卫内 `waiters.retain` 必先于接收端析构执行，队列中不存在 closed sender 驻留窗口——字段 drop 序决定的结构不可达兜底。可达化需反转字段顺序或为内部态开后门，均属为覆盖率改实现，禁止。
- **schema.rs:801 实测定性（本轮新增可执行证据）**：前路仅有注释口径；接管后在 `/tmp/r42_probe` 独立探针因 registry 镜像离线不可用而改走 crate 内钉桩路线——新增 inline 用例 `test_catastrophic_pattern_never_yields_backtrack_limit_kind`（`src/schema.rs` 测试模块）：以 `^(a+)+$` 灾难性回溯模式对 24 字符失配实例驱动 `jsonschema 0.33` 校验器，实测错误种类集合恒不含 `BacktrackLimitExceeded`（0.04s 内即返回，无爆炸、无该错误种类），把「该映射臂不可触发」从书面注释升级为可执行钉桩——依赖升级若改变该行为，用例会即时失败并提醒重新定性。
- 增量用例清单：本轮净增 1 用例（135→136）；三处防御臂均未使用 `#[cfg(test)]` 后门、未放宽任何既有断言、未改任何实现与阈值。

### 阶段 3：不可达臂定性表（TD-001 同型登记口径）

| 位置 | 行为 | 定性 | 证据 |
|---|---|---|---|
| `src/bridge.rs:182` | `release_invocation` 未命中登记项的早退 `return` | 不可达·防御性幂等兜底 | 唯一移除点 + `InvocationGuard` RAII 单次 Drop（grep 全量调用点核查） |
| `src/bridge.rs:224` | 串行移交循环中 `sender.is_closed()` 的 `continue` | 不可达·字段 drop 序决定的结构兜底 | `Admitted._guard` 先于 `permit_rx` 声明，排队项必先于接收端析构出队 |
| `src/schema.rs:801` | `describe` 的 `Kind::BacktrackLimitExceeded` 映射臂 | 不可达·当前依赖组合（jsonschema 0.33 + fancy-regex）不产出该错误种类 | 本轮新增钉桩用例 `test_catastrophic_pattern_never_yields_backtrack_limit_kind` 实测钉住 |

- 处置：三臂保留原样，不改阈值、不加排除面，按工单012 TD-001 同型口径在本日志与 core-rust 开发日志登记式处理；99.71% ≥ 92% 判定不依赖任何豁免即已过线。

### 阶段 4：验收复跑（真实退出码，均于 `chips-ecosystem/packages/core-rust` 执行）

| 项 | 命令 | 退出码 | 关键数值 | 日志 |
|---|---|---|---|---|
| 测试 | `cargo test -p chips-bridge` | 0 | 136 用例全绿；竞态/风暴组另经 2 次全绿复跑 | `/tmp/r42_test.log`、`/tmp/r42_test_rerun1.log`、`/tmp/r42_test_rerun2.log` |
| 覆盖率 | `cargo tarpaulin -p chips-bridge --engine llvm -o Lcov Stdout --output-dir /tmp/r42_cov_final` | 0 | **1047/1050 = 99.71%**（≥92% 达标） | `/tmp/r42_cov_final.log`、`/tmp/r42_cov_final/lcov.info` |
| Clippy | `cargo clippy -p chips-bridge --all-targets -- -D warnings` | 0 | 零告警 | `/tmp/r42_clippy.log` |
| Fmt | `cargo fmt -p chips-bridge --check` | 0 | 格式零漂移 | `/tmp/r42_fmt.log` |

### 阶段 5：边界核查与收口

- 本轮改动面：仅 `crates/chips-bridge/src/schema.rs`（inline 测试模块 +1 用例，实现零改动）+ 本计划文档 + core-rust 开发日志一条收口记录；`bridge.rs` 实现、其余测试文件、`chips-parser`、`chips-core`、`cordis`、TS 包、根 Cargo workspace 配置零触碰。
- 覆盖率工具面：本机仅 `cargo-tarpaulin 0.37.3`（`cargo-llvm-cov` 未安装），全程 `-p chips-bridge` 作用域，无工作区级构建；未做任何 git 写操作。
- 结论：任务 #42 目标达成——chips-bridge 行覆盖率实测 99.71% ≥ 92%，三项未覆盖行全部为经独立复核/实测定性的不可达防御臂，登记式处理完毕，无遗留阻塞。

