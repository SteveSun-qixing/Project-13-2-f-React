# chips-parser 接管 A 路（任务 #53）开发日志

接管说明：前一路智能体在轮次上限中断，其快照产物已由主智能体提交。本日志记录接管 A 路（cache/schema/存量修复/自检）各阶段推进。

## 阶段 0：接管盘点（2026-09-20，开工前）

- 内容：按任务书要求复测工作区真实状态，发现与任务书「当前实测状态」不一致——快照实际已包含：9 处存量类型错误的全部修复（model/directory/inflate/yaml×3/SourceFingerprint 导出）、`src/cache.rs`（含单元自测）、`src/schema/mod.rs`（校验体系主体，含单元自测）；仍缺 `src/schema/card.rs`、`src/schema/box.rs`（`schema/mod.rs` 引用了 `#[path="box.rs"] pub mod box_model;` 与 `pub mod card;`）。
- 证据：`cargo check -p chips-parser` → EXIT=101，残余错误为 parser 的 E0583 + `schema/box.rs` couldn't read（B 路负责 parser/view，不做）。日志：/tmp/pcheck_a0.log。
- 结论：不重做已完成部分；本路交付物收敛为「补齐 schema 子模块 + 修通 cache/schema 的类型与测试问题 + 验收闸口清零」。

## 阶段 1：schema 体系补齐（2026-09-20）

- 内容：
  1. 新建 `crates/chips-parser/src/schema/card.rs`：卡片三张字段规格表（`METADATA_FIELDS`/`STRUCTURE_FIELDS`/`CONTENT_FIELDS`），逐字对照《04-文件格式规范/01-卡片文件格式》§4.1、§5.1、§6.1（required 集合、pattern→FieldFormat、enum、maxLength、默认值 `3:4`/`private`/`true`/`""`）；`file_info.total_size/file_count` 依模型 `u64` 加非负下限。
  2. 新建 `crates/chips-parser/src/schema/box.rs`：箱子三张表，对照《02-箱子文件格式》§4.2/§4.3（六必填）、§5.3/§5.7（`entry_id`/`url`/`enabled` 必填三元组）、§6.3/§6.4（`active_layout_type` 必填、`layout_configs` 键为任意布局类型故不逐项收窄）。
  3. 修改 `schema/mod.rs`：为 `FieldSpec` 增加 `minimum`（JSON Schema `minimum` 口径，含 `with_minimum` 构造器与整数字段检查）；`validate` 根层按 `SchemaRegistry::allows_unknown_fields` 放行插件专有成员（§6.3 第 3 条），嵌套层维持未知字段策略。
- 依据：《06-文档解析器设计》§6.1/§6.3、《核心接口规范》§6、两份文件格式规范。
- 证据：`cargo check -p chips-parser`（修复后，见阶段 2）→ EXIT=101，仅剩 parser/view 两个 E0583。

## 阶段 2：cache 与存量编译错误修复（2026-09-20）

- 内容：
  1. `cache.rs`：`ParsedUnit::memory_bytes` 中 `Result::map(Vec::len)` 签名不符（E0631×2）→ 改为闭包取 `len`；`ParseCache` 的 `#[derive(Debug)]` 因内部 `Mutex<CacheState>` 含 `Arc<dyn Any>`（E0277）→ 改手工 `Debug`（只输出配额与规模观测面）。
  2. `model/mod.rs`：`ContentIndex::serialize` 对 `Arc<ContentNode>` 直接 `serialize_element`（E0277，serde 的 `Arc` 支持需 rc 特性）→ `node.as_ref()`，输出形状不变。
- 证据：`/tmp/pcheck_a2.log`：EXIT=101，`error[` 计数=2（仅 lib.rs 对 `parser`、`view` 的 E0583，B 路范围），warning=0。

## 阶段 3：单元自测与测试面修复（2026-09-20）

- 内容：真实工作区 lib 不含 parser/view 无法编译测试面，采用隔离副本验证：将 `chips-ecosystem` 的工作区根配置（含 `.cargo/config.toml` 稀疏索引覆盖）与 `chips-core`+`chips-parser` 复制到 `/tmp/pa_verify`，仅在副本中移除 lib.rs 的 parser/view 声明后运行 `cargo test -p chips-parser --lib --offline`（`CARGO_TARGET_DIR=/tmp/pa_target`，不触碰真实工作区与共享 target）。
- 测试面编译错误修复（真实工作区，均为测试代码实现修正、未放宽断言）：
  1. `error.rs` 测试：`Diagnostic::new(_, _, "字面量".into())` 触发 E0283（`impl Into<String>` 泛型下 `.into()` 目标类型不可推断）→ 直接传 `&str`（5 处）。
  2. `source/archive.rs:909` 测试夹具：`extend_from_slice(central)`（E0308）→ `&central`。
  3. `source/directory.rs` 测试夹具：`create_dir_all(base)` 后移用（E0382）→ `&base`。
  4. `cache.rs` 测试：`test_cross_thread_reuse` 断言少一层 `Option`（E0308）→ `Some(Some(..))`；`test_memory_quota_eviction_and_oversize_rejection` 原配额 400 容得下两条单元、断言前提不成立 → 配额改 200（单元约 132 字节，一条能存、两条必触发内存淘汰），断言强度不降。
- 证据：副本 `cargo test -p chips-parser --lib --offline` → 76 passed / 12 failed（/tmp/patest_a2.log）；**cache 全部 9 项、schema 全部 22 项自测通过**。

## 阶段 4：最终验收闸口（2026-09-20 19:51）

- `cd packages/core-rust && cargo check -p chips-parser > /tmp/pcheck_a.log 2>&1; echo EXIT=$?` → **EXIT=101**；`error[` 计数=**2**（仅 lib.rs 对 `parser`、`view` 的 E0583，B 路范围）；warning=**0**。
- `cargo clippy -p chips-parser > /tmp/pclippy_a.log 2>&1; echo EXIT=$?` → **EXIT=101**；`error[` 计数=2（同上）；warning 3 行，其中 1 条实为 `clippy::duplicate_mod`——由 parser/view 两个模块文件缺失这一同源事实引发（clippy 把两个未解析模块路径误判为重复加载 `clippy.toml`），B 路落地后自然消失；无其余 lint 输出。

## 遗留与移交（需 B 路 / 主智能体处理）

隔离副本测试面暴露 **12 个非本路交付物的存量测试失败**（写于快照之前、`cargo check` 不可见，属上一路/后续波次的模块实现缺陷）：

- `digest::tests::test_sha256_empty_vector` / `test_sha256_abc_vector`：`digest.rs` 的 SHA-256 输出与标准向量不符（实现在 `digest.rs:197` 附近，长度/填充或多块路径疑似有 bug）。该函数被 `model::index_digest_of` 与本路 `cache::fingerprint_digest_of` 消费，缓存键仍确定可用，但**修订摘要/内容摘要对外语义不正确**，须修。
- `source::archive::tests`（4 项失败：store 读取、deflate 解压、目录条目跳过、压缩比限额、zip64）与 `source::inflate::tests`（3 项：stored/固定/动态 Huffman 块）：压缩态数据源与解压实现存在功能缺陷（限额用例返回 `DOCUMENT_ARCHIVE_INVALID` 而非 `DOCUMENT_LIMIT_EXCEEDED`）。
- `source::directory::tests::test_open_indexes_files_and_ignores_generated`：目录态索引/生成物忽略逻辑失败。
- `yaml::value::tests::test_duplicate_key_rejected_with_pointer`：重复键诊断指针未按预期产出。

上述文件不在 A 路交付面（存量错误清单只含类型/可见性错误，功能测试失败未曾暴露）。按 AGENTS.md「文档与代码不一致/组件缺失先登记工单」的口径，建议主智能体将其纳入 B 路收口范围或登记问题工单后再处理；A 路未擅自扩大修改面。
