# chips-parser 接管 C 路 · 开发计划（任务 #54）

> 登记：W2 波次接管 C（parser.rs 六阶段流水线 + 整 crate 收口）
> 前置：A 路（类型错面 + cache.rs/schema.rs，任务 #53）与 B1 路（view.rs，任务 #55，提交 a987b85b）均已验收；本路唯一编译缺口为 `src/parser.rs` 缺失（lib.rs:46 单点 E0583）。
> 目标：`cargo test -p chips-parser` 全绿 + clippy `-D warnings` 0 + fmt 0 + §8 错误码覆盖自检齐全。

## 一、口径与依据（全部为只读事实源）

1. 《核心接口规范》分册 03.06：§6.1-6.5（`open_document` / `CardParser` / `BoxParser` / `ParseOptions` / 句柄访问器面）、§3.3（错误码归一）、§5.3-5.4（缓存与修订）、§8（公开错误码表）。
2. 《06-文档解析器设计》：06.03 §3.1-3.7 六阶段流水线逐条、06.04 双模式数据源、06.05 §5.1 惰性层级与「层级不可逆」、§5.2 句柄公开面、06.08 §8.2 12 项致命码 / §8.3 19 项诊断码 / §8.4 部分成功矩阵 / §8.5 修复与归一（不回写）、06.11 §11.2 `ParsedCard`/`ParsedBox`、§11.4 模块布局（`src/parser/{mod.rs,card.rs,box.rs,pipeline.rs}`）、§11.5 依赖口径（工单015 裁决：不引入 zip/memmap2/rayon）、06.13 §13 测试策略。
3. 《04-文件格式规范》全部：schema 层已对齐，本路不改 schema 事实源。
4. A 路 / B1 路开发日志「遗留与移交」：12 项存量功能缺陷清单（硬输入）、`DocumentHandle` 六访问器逐字契约（含 `present=false` 节点必须返回携错误级诊断的占位模型）、`layout_config()` 属《06》§5.2 句柄清单文档遗漏。

## 二、文件面（owner 唯一）

- 仅 `chips-ecosystem/packages/core-rust/crates/chips-parser/**`：新增 `src/parser/{mod.rs,card.rs,box.rs,pipeline.rs}`（+ `tests/` 如需）；`model/`、`source/`、`yaml/`、`digest.rs`、`cache.rs` 在缺陷修复所需范围内可改；`lib.rs` 仅在确有必要时最小改动。
- 禁触：`crates/chips-bridge/**`（并行补测路在途）、`生态共用技术文档/`、`薯片生态文档库/`（文档面差异走工单）。
- cargo 一律 `-p chips-parser` 作用域；禁止 workspace 级 cargo；禁止任何 git 写操作；target 可清、`~/.cargo` 不动；与并行路锁竞争时耐心等待。

## 三、阶段计划

1. **阶段 0 基线**：`cargo test -p chips-parser` 取真实失败清单，锁定 12 项存量缺陷的逐条根因假设（/tmp 日志留证）。
2. **阶段 1 存量缺陷修复**（禁止放宽断言、禁止删用例；断言与文档冲突时以文档为准改实现）：
   - `digest.rs`：SHA-256 标准向量 ×2。
   - `source/inflate.rs`：stored / fixed / dynamic 三块型 ×3。
   - `source/archive.rs`：Store 读取、Deflate 读取、目录条目跳过、压缩比限额、ZIP64 ×5。
   - `source/directory.rs`：生成物忽略诊断计数 ×1。
   - `yaml/value.rs`：重复键诊断指针 ×1。
3. **阶段 2 parser 模块落地**：按 §11.4 四文件布局实现六阶段流水线与 `DocumentHandle` 全访问器面（`metadata`/`revision`/`structure`/`content`/`entries`/`layout_config` + `read_resource`/`diagnostics`/`content_digest`/`validate`/`statistics`），`CardParser`/`BoxParser`/`open_document`，L0-L3 惰性不可逆、§8.4 部分成功、§8.5 修复与归一不回写、缓存单元接入。
4. **阶段 3 收口**：四道门禁（test / clippy -D warnings / fmt / §8 错误码覆盖自检矩阵），存量 lint 噪声一并 mine 清零。
5. **阶段 4 落档**：本文件与 `-开发日志.md` 追加；登记「文档-代码漂移」工单（《06》§5.2 句柄清单缺 `layout_config()`），只写问题/影响/证据/验收口径，不写解决办法。

## 四、验收闸口（全部重定向、真实退出码、文件名不含斜杠）

| 闸口 | 命令 | 期望 |
| ---- | ---- | ---- |
| a 测试 | `cd chips-ecosystem/packages/core-rust && cargo test -p chips-parser > /tmp/c54_test.log 2>&1; echo EXIT=$?` | 0（报测试文件数与用例数） |
| b Clippy | `cargo clippy -p chips-parser --all-targets -- -D warnings > /tmp/c54_clippy.log 2>&1; echo EXIT=$?` | 0 |
| c 格式 | 根 `cargo fmt --all --check`；若被并行路污染则至少 `cargo fmt -p chips-parser --check` | 0（并如实上报根工作区状态） |
| d 错误码覆盖 | 《核心接口规范》§8 与《06》§8 全部公开错误码逐码 ≥1 用例，列清单 | 清单齐全 |

## 五、开发日志

（阶段日志随进度追加于 `chips-parser接管C-开发日志.md`：时间 / 内容 / 证据命令与退出码 / 遗留。）
