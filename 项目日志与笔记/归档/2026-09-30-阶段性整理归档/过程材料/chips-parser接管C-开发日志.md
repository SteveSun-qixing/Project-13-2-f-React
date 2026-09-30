# chips-parser 接管 C 路 · 开发日志（任务 #54，第三任接管）

> 接管基线：主智能体快照 c6096c85（前任两任死亡后的在途产物入库）
> 权威计划书：`chips-parser接管C-开发计划.md`
> 本日志按接管四件套要求分三段记录：基线审计 / 主体工作 / 收口验收。

---

## 第一段 · 基线审计（快照 c6096c85）

- **基线实测**：`cargo test -p chips-parser` EXIT=101 —— `src/parser/pipeline.rs`
  存在**未闭合括号**（E0583 级编译失败）：第 283 行 `let build_failure = || DocumentError::MetadataInvalid {`
  闭包体被截断，直接拼到 `let metadata = match kind {`。这是快照入库时的在途件断裂点，
  全 crate 因此零编译零测试，其余文件无法评估红绿面。日志：`/tmp/r54_audit.log`。
- **十二项存量缺陷勾稽（以测试实证逐项核对，禁止回退前任成果）**：
  1. `digest.rs` SHA-256 标准向量 ×2 —— `test_sha256_empty_vector` /
     `test_sha256_abc_vector`（另有 padding 第二块与流式一致性两测试）全绿；
     前任遗言核查项落实：`compress` 轮函数第 4h 步确为 `a = temp1.wrapping_add(temp2)`
     （FIPS 180-4 §6.2.2，不含旧 a），无回归。✅
  2. `source/inflate.rs` 三块型 ×3 —— `test_inflate_stored_block` /
     `test_inflate_fixed_huffman_block` / `test_inflate_dynamic_sample` 全绿（另有
     reserved 块、截断、尺寸失配、输出限额、空哈夫曼表等负矩阵）。✅
  3. `source/archive.rs` ×5 —— Store 读取（`test_open_reads_members_in_store_mode`）、
     Deflate 读取（`test_deflate_member_inflates_on_read`）、目录条目跳过
     （`test_directory_entries_are_skipped_not_fatal`）、压缩比限额
     （`test_limit_on_compression_ratio`）、ZIP64（`test_zip64_...` 族，另含加密、
     未知压缩方法、重复路径、CRC 失配、本地头失配等，测试模块 16 用例）全绿。✅
  4. `source/directory.rs` 生成物忽略诊断 ×1 —— `test_open_indexes_files_and_ignores_generated`
     断言 `DOCUMENT_GENERATED_FILE_IGNORED` 恰 3 条全绿。✅
  5. `yaml/value.rs` 重复键诊断指针 ×1 —— `test_duplicate_key_rejected_with_pointer`
     全绿。✅
  上述 12 项（#53 收口面）在快照编译修复后实测全部通过，无断言放宽、无删用例。
- **禁触面核查**：`view.rs`（#55 已验收）、`cache.rs`、`schema/*` 事实源、
  `chips-bridge`、host/cli/sdk、文档库均零触碰；git 全禁遵守。

## 第二段 · 主体工作（parser 四件编译修复 + 语义补齐 + 集成测试）

1. **pipeline.rs 编译修复（快照断裂点续写）**：
   - 补全 `build_failure` 闭包体（`MetadataInvalid`，诊断快照随闭包捕获）；
   - `open_l0` 先取 `source.fingerprint()` 再移入 `OpenedL0`；`OpenedL0` 去除
     无人读取的 `fingerprint` 字段；
   - `parse_metadata` / `parse_structure` / `parse_layout_unit` 三处
     `has_errors()` 判定先于 `outcome.diagnostics` 部分移动（消 E0382）；
   - `verify_resource_checksum` 的 `mismatch` 闭包改 `mut`；
   - `yaml/mod.rs` 删除无人使用的 `YamlDocument::failed`。
2. **parser/mod.rs 修复与补齐**：
   - `parse_units_parallel` 作用域线程重构：每工作线程自有捕获（`Arc` 克隆源、
     `ParseOptions`/`ParseCache`/`PackagePath` 克隆），结果经 `ScopedJoinHandle`
     在作用域内 join 回收后按下标归并（输出确定性不变，任一单元真致命按原序
     复核上抛语义不变）——修复 `results` 生命周期与 `structure_file` 循环移动；
   - `DocumentHandle::statistics()` 从 `pub(crate)` 提升为 `pub`（§5.2 句柄
     公开面清单十项之一，测试面亦需要）；
   - 手工 `impl Debug for DocumentHandle`（只暴露 kind / document_id / 版本，
     不触发惰性解析）；`missing path` 测试改 `match` 断言（不再依赖
     `expect_err` 的 Debug 约束）。
3. **存量 lint 清零（16 项，-D warnings 闸）**：schema 表 6 处 `needless_borrow`、
   `useless_format`、MSRV 域内 `is_none_or → map_or(true, ..)`、`redundant_closure`
   ×2、`manual_range_contains`、archive `map(read_u64_le)`、inflate 3 处
   `u32::from` 无效转换、path `segments` 双重 `must_use`、yaml
   `enrich_with_spans` 改 `&mut [Diagnostic]`。
4. **本轮发现并修复的功能缺陷（超出十二项清单的新增面）**：
   `collect_unreferenced_files` 未把箱子必需配置成员 `.box/content.yaml`
   （《箱子文件格式》§6）计入引用集合——严格模式与 `validate()` 会把完全合法的
   箱子判出 `DOCUMENT_UNREFERENCED_FILE` 错误级诊断（状态 Invalid）。已在 Box
   分支补登记；行为由 `test_box_handle_full_accessor_surface` 的 Valid 断言钉住。
5. **新增集成测试 `tests/pipeline_error_codes.rs`（25 用例）**：目录态夹具全链
   走公开 API，覆盖 §8 错误码行为级断言与 `DocumentHandle` 全访问器面
   （metadata / revision / structure / content / entries 分页窗口 / layout_config /
   read_resource 全量与窗口 / diagnostics 排序去重快照 / content_digest 确定性 /
   validate 三态 / statistics / 严格入口与自动识别 / 误用归一 / 并行全量解析 /
   单元缓存复用），细节见第三段覆盖矩阵。

## 第三段 · 收口验收（四闸，真实退出码，`chips-ecosystem/packages/core-rust`）

1. **测试闸**：`cargo test -p chips-parser > /tmp/r54_test11.log 2>&1; echo EXIT=$?`
   → **EXIT=0**（126 用例：单元 100 + 集成 25 + 文档示例 1；0 失败）。
2. **Clippy 闸**：`cargo clippy -p chips-parser --all-targets -- -D warnings`
   → **EXIT=0**（日志 `/tmp/r54_clippy4.log`）。
3. **格式闸**：`cargo fmt -p chips-parser -- --check` → **EXIT=0**
   （日志 `/tmp/r54_fmt4.log`；根工作区未跑 `--all`，并行路面不越权）。
4. **§8 逐错误码覆盖矩阵（31 码全命中，行码为断言位置）**：

   | §8.2 致命码 | 用例 | | §8.3 诊断码 | 用例 |
   |---|---|---|---|---|
   | DOCUMENT_NOT_FOUND | `parser/mod.rs` 缺路径测试 + 集成 not_found（节点/资源） | | YAML_SYNTAX_ERROR | 集成 structure_syntax / node_failed（+yaml 层负矩阵） |
   | DOCUMENT_IO | 集成 io_range（read_resource 越窗）+ `source/mod.rs` 流越界 | | SCHEMA_REQUIRED_MISSING | 集成 metadata_invalid_required |
   | DOCUMENT_FORMAT_UNKNOWN | 集成 format_unknown（普通文件/严格入口矛盾）+ 误用归一 ×3 | | SCHEMA_TYPE_MISMATCH | 集成 metadata_type |
   | DOCUMENT_METADATA_MISSING | 集成 metadata_missing | | YAML_UNSUPPORTED_TAG | 集成 unsupported_tag |
   | DOCUMENT_METADATA_INVALID | 集成 required / type ×2 | | SCHEMA_UNKNOWN_FIELD | 集成 unknown_field（+error.rs 严格升级） |
   | DOCUMENT_STRUCTURE_INVALID | 集成 structure_syntax + view.rs kinds_conflict | | SCHEMA_DEFAULT_APPLIED | 集成 unknown_field 用例（+error.rs/schema） |
   | DOCUMENT_VERSION_OUTDATED | 集成 version 0.9.0 | | STRUCTURE_CONTENT_MISSING | 集成 content_missing / layout_missing ×2 |
   | DOCUMENT_VERSION_UNSUPPORTED | 集成 version 2.0.0 | | STRUCTURE_NODE_FAILED | 集成 node_failed |
   | DOCUMENT_ARCHIVE_INVALID | archive.rs 加密/未知方法/重复路径/CRC/签名 5 处断言 | | ENTRY_SOURCE_INVALID | 集成 entry_refs（ftp scheme） |
   | DOCUMENT_PATH_UNSAFE | path.rs 拒绝 + archive.rs 反斜杠 ×2 | | ENTRY_TARGET_MISSING | 集成 entry_refs（包内缺失） |
   | DOCUMENT_LIMIT_EXCEEDED | directory/inflate/archive 限额断言族 | | ENTRY_FAILED | 集成 entry_failed（重复 ID 位置保留） |
   | DOCUMENT_PARSE_CANCELLED | view.rs 归一测试 | | DOCUMENT_RESOURCE_FILE_MISSING | 集成 manifest（资源缺失） |
   | | | | DOCUMENT_RESOURCE_INTEGRITY_MISMATCH | 集成 manifest（尺寸失配） |
   | | | | DOCUMENT_UNREFERENCED_FILE | 集成 strict_unreferenced（升级错误级断言） |
   | | | | DOCUMENT_GENERATED_FILE_IGNORED | directory.rs 生成物 ×3 计数 |
   | | | | DOCUMENT_SYMLINK_IGNORED | directory.rs 符号链接 |
   | | | | DOCUMENT_UNICODE_NORMALIZED | 集成 crlf |
   | | | | DOCUMENT_EXTENSION_MISMATCH | 集成 extension_mismatch |
   | | | | DOCUMENT_VERSION_MISMATCH | 集成 version 1.1.0（+yaml 层） |

5. **工单**：文档-代码漂移一单——《06》§5.2 句柄清单缺 `layout_config()`，
   登记为**工单029**（`问题工单.md` 表行 + `工单029-文档解析器设计句柄清单缺layout_config访问器/任务说明.md`，
   只写问题/影响/证据/验收；编号避让已被 cpk 装载器占用的 028）。本轮修复的
   `.box/content.yaml` 未引用误判属代码缺陷直接修复，非文档漂移，不立单。

## 遗留与移交

- 无功能遗留；`chips-parser` crate 四闸全绿。
- 工单029 待文档面收口（不改代码）。
- 本轮零 git 操作；`/tmp` 日志留证：r54_audit / r54_test1-12 / r54_clippy2-4 /
  r54_fmt2-4。
