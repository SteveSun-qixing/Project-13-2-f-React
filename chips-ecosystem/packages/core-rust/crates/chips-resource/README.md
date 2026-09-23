# chips-resource（段一寻址内核 + 段二 B1：MemoryProvider 挂载与 unicode 触发臂 + B2：DirectoryProvider 挂载与读面 + B3：ArchiveProvider 归档只读域与流式写入提交面 + 段三 #157：unicode 非字符全集与写锁异步形收口）

薯片平台资源管理器的 Rust 权威 crate：段一交付 `chips-resource://` URI 与作用域解析、
管理器侧权限判定（PathGuard）、资源句柄与租约状态机；段二 B1 随单追加内置
`MemoryProvider` 挂载、写入提交与 FS 操作入口、unicode 触发臂产化（工单042 裁定④）；
段二 B2 随单追加内置 `DirectoryProvider`（真实文件系统目录域，`mount_directory`
挂载，读面/流面/列举面/写入提交面，《04》§3.3）与 `NOT_EMPTY` / `WRITE_FAILED`
产化、符号链接逃逸落位后防御（《06》§9.1）；段二 B3 随单追加内置
`ArchiveProvider`（ZIP Store 归档只读域，`mount_archive` 挂载，读面/流面/
列举面，ZIP 解析复用 `chips-parser` 归档层公开读取面）、流式写入提交面
（`open_write_stream` / `append_write_stream` / `commit_write_stream` /
`abort_write_stream`，《04.04》§4.8）与 `WriteCoordinator` 路径写锁
（目录写族全部提交点单写者化，《04.04》§4.9、《04.13》§13-3），并把
`RESOURCE_READ_ONLY` 的 `details.uri` 统一为精确目标 uri（工单044 §三.5
裁定⑧-2，权限矩阵臂与预检臂同形）。
权威依据：

- 《06-资源协议规范》§2（URI 语法）、§3（作用域）、§4（权限）、§6（句柄生命周期）、§7（错误码，唯一权威）、§9（安全约束）；
- 《04-资源管理设计》§4（句柄）、§5（解析与权限·管理器侧）、§9（路径安全）、§10（清理与泄漏防护）、§11（核心结构）、§12（默认配置）、§13（约束与规则）；
- 《03-核心接口规范》§7（公开面形状）。

## 基线盘点

- 分支「第五次重构」，基线哈希 `84ddd04d4`；workspace `members = ["crates/*"]` glob 自动吸收，根 `Cargo.toml` 零改动。
- 工程先例对齐 `chips-parser` / `chips-bridge`：`&'static str` 错误码常量 + 码表锁测、强类型错误枚举 + `From<T> for ChipsError` 归一、`#![forbid(unsafe_code)]` `#![warn(missing_docs)]`、逐码集成测试。

## 模块导览

| 模块          | 职责                                                                                                                                                                                                                                                                           | 权威条目                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `error`       | 18 个在册 `RESOURCE_*` 错误码常量、`ResourceError` 强类型枚举、`details` 形状、`ChipsError` 归一                                                                                                                                                                               | 《06》§7                           |
| `constants`   | 默认限额（8 MiB / 2 GiB / 256 KiB / 64 / 4096 等）与 `ResourceLimits`                                                                                                                                                                                                          | 《04》§12、《06》§9.3              |
| `uri`         | 语法解析与归一化（scheme/scope/path/query、External origin、大小写、百分号、punycode、IPv6）                                                                                                                                                                                   | 《06》§2                           |
| `path_guard`  | 解码一次 + NFC + 分段 + 控制字符 + 平台特例 + 长度 + 符号链接根内校验 + Unicode 触发臂（工单042 裁定④，`reason=unicode` 已产化）                                                                                                                                               | 《04》§9、《06》§2.4/§9.1          |
| `scope`       | `ScopeKind`/`ScopeRegistration`/`ScopePolicy`/`ScopeRegistry`（含 External 按 origin 惰性注册）                                                                                                                                                                                | 《04》§5.2、《06》§3               |
| `session`     | `ResourceSession`/`SessionKind`/会话注册表：派生不扩权、关闭级联                                                                                                                                                                                                               | 《04》§11.2、《03》§7.2            |
| `permission`  | 作用域×能力面管理器侧在册判定矩阵与 `IPermissionDeniedDetails`（口径：《06.04》§4.3 为协议权威，Platform 任意插件免权限公开只读）                                                                                                                                              | 《06》§4、《04》§5.3（已对齐）     |
| `provider`    | 在册 `ResourceProvider` trait 与地址模型类型（仅抽象；内置实现见 `memory`/`directory`/`archive`，HTTP 属后续波次）                                                                                                                                                             | 《04》§3.1/§3.2                    |
| `memory`      | 内置 `MemoryProvider`：运行时内存字节、不落盘、无磁盘缓存；流式/可写如实声明、目录列举不支持                                                                                                                                                                                   | 《04.03》§3.2/§3.3                 |
| `directory`   | 内置 `DirectoryProvider`：真实文件系统目录域（`attach_root` 落位）；stat/范围读/流读不整档入内存、列举过滤隐藏与符号链接条目、写族原子提交（temp+rename）、根外符号链接逃逸防御（`reason=symlink`）                                                                            | 《04.03》§3.2/§3.3、《06》§9.1     |
| `archive`     | 内置 `ArchiveProvider`：ZIP Store 归档只读域（`attach_archive` 挂载）；stat/范围读/流读（Store 映射切片、Deflate 经解析器解码面）、列举前缀合成目录树 + 隐藏过滤 + 定序；写入族纵深臂 `READ_ONLY`（精确目标 uri）                                                              | 《04.03》§3.2/§3.3、《04.07》      |
| `write_coord` | `WriteCoordinator` 路径写锁：同一规范路径单写者排队（rename 双键 {A,B}、升序获取无死锁构造）；覆盖目录写族全部提交点与写流生命周期                                                                                                                                             | 《04.04》§4.8/§4.9、《04.13》§13-3 |
| `handle`      | `open`/`invalidated`/`released` 三态状态机、句柄表、租约归属与归还、失效订阅、池上限                                                                                                                                                                                           | 《04》§4、《06》§6                 |
| `manager`     | `ResourceManager` 门面：`resolve` 流水线、`open/stat/read_range/read_chunk/release`、Memory 挂载（`mount_memory`）/目录挂载（`mount_directory`）/归档挂载（`mount_archive`）与写族/FS 操作入口、流式写入提交面（`open_write_stream` 族）、会话与作用域级联（含写流中止零残留） | 《04》§5.1/§11、《03》§7           |

## 段边界（本段做与不做）

段一做寻址内核。段二 B1（已随单落位）起追加：内置 `MemoryProvider` 挂载（`mount_memory`，
《04.03》§3.2/§3.3——运行时内存字节、只读或会话内可写、不落盘、无磁盘缓存）、写入提交面
（`commit_write`）与 FS 操作公开入口（`list_directory` / `delete` / `rename` / `copy` /
`create_directory`，《04.04》§4.9），能力预检在 Manager 层直接返回
`RESOURCE_READ_ONLY` / `RESOURCE_NOT_SUPPORTED`，不透传 Provider；以及工单042 裁定④
unicode 触发臂产化（《06.02》§2.4）。段二 B2（已随单落位）起追加：内置
`DirectoryProvider` 挂载（`mount_directory`，Workspace/Document/Plugin/Temporary
四类目录域，只读临时域走 `dialog:open` 只读臂）与其读面（stat/范围读/流读，全程
无整档驻留）、列举面（隐藏点文件与符号链接条目过滤、按名定序）、写入提交面落
真实 FS（原子 temp+rename 提交、rename/copy 不覆盖、mkdir 幂等、非递归删除
`NOT_EMPTY`）与落位后符号链接逃逸防御（《06》§9.1）。段二 B3（本次随单）
起追加：内置 `ArchiveProvider` 归档只读域（`mount_archive`，ZIP 解析复用
`chips-parser` 归档层公开读取面，零 ZIP/Deflate 自实现；读面/流面/列举面 +
写入族全量 `RESOURCE_READ_ONLY` 精确目标 uri 臂）、流式写入提交面
（`open_write_stream → append_write_stream → commit_write_stream /
abort_write_stream`，目录域隐藏 temp 流式落盘、失败/中止/级联中断零残留）
与 `WriteCoordinator` 路径写锁（`commit_write`/`delete`/`rename`/`copy`/
`create_directory`/写流生命周期单写者化），并随单落地工单044 §三.5 裁定⑧-2
（`READ_ONLY` 两臂统一精确 uri）与 `permission.rs` 工单042 旧口径残留注释
清理。
仍不做：`file:*`/`resource:*` 能力面接线、Neon 绑定（§11.3）、缓存（§6，B4）、
网络两栖与 HTTP Provider（段三）、unicode 非字符全集触发臂（043-A1，段三收口
合并单）。
`Provider` trait 按《04》§3.2 全量在册定义，未重定义。

## 在册错误码 ↔ 用例对照（段一 + 段二 B1/B2/B3 产生面）

| 错误码                                              | 段一产生点                                                                                                                                                                                                                                                                                                                                                                              | 锁测                                                                                                                                                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESOURCE_INVALID_URI`                              | 语法矩阵：query/fragment/编码/userinfo/origin/scheme 前缀、无路径分隔符的裸 origin                                                                                                                                                                                                                                                                                                      | `src/uri.rs` 单测矩阵 + `tests/uri_syntax_matrix.rs` + `tests/error_code_lock.rs`                                                                                                                            |
| `RESOURCE_UNSUPPORTED_SCHEME`                       | `resolve_input` 收到 `file://`、`webdav://`、未知 scheme                                                                                                                                                                                                                                                                                                                                | `src/uri.rs` + `tests/uri_syntax_matrix.rs`                                                                                                                                                                  |
| `RESOURCE_PATH_INVALID`                             | PathGuard 攻击面全量（9 类 reason 中 `absolute/separator/segment/encoding/control/length/platform/symlink` 8 类；第 9 类 `unicode` 亦以本码承载（2026-09-21 主智能体码归属更正），见下行）                                                                                                                                                                                              | `src/path_guard.rs` 单测 + `tests/error_code_lock.rs` 形状锁                                                                                                                                                 |
| `RESOURCE_PATH_INVALID`（`reason=unicode`）         | Unicode 触发臂（工单042 裁定④，码归属按 2026-09-21 更正落路径族）：百分号解码一次后字节非法 UTF-8、含 U+FFFD 或非字符 U+nFFFE/U+nFFFF（n=1..10）即拒绝；NFC 归一差异不拒绝                                                                                                                                                                                                              | `src/path_guard.rs` 产化单测 + `tests/error_code_lock.rs::test_unicode_reason_has_production` + `tests/memory_provider.rs` URI 面用例                                                                        |
| `RESOURCE_PATH_INVALID`（`reason=symlink`，目录域） | 段二 B2 产化：真实 FS 落位后宿主侧防御——根内组件逐段 `canonicalize` 复核命中根外符号链接即拒绝（`src/path_guard.rs::resolve_within_root`，uri 由 `DirectoryProvider::locate` 回填目标规范 URI，《06》§7.3）                                                                                                                                                                             | `src/directory.rs` 单测 + `tests/directory_provider.rs::test_directory_symlink_escape_and_traversal_defense`                                                                                                 |
| `RESOURCE_NOT_FOUND`                                | 作用域未注册；直接请求作用域根（空路径基址）；段二 B2 产化：目录域资源缺失、目录态路径不得作为资源读取/开流/范围读、列举作用于文件或不存在目录、挂载根缺失/为文件（《06》§2.4，findings 登记裁定）                                                                                                                                                                                      | `src/scope.rs` / `src/manager.rs` / `src/directory.rs` / `tests/directory_provider.rs`                                                                                                                       |
| `RESOURCE_PERMISSION_DENIED`                        | 判定矩阵拒绝面 + 会话未解析                                                                                                                                                                                                                                                                                                                                                             | `src/permission.rs` / `src/manager.rs` 单测                                                                                                                                                                  |
| `RESOURCE_TOO_LARGE`                                | `open` 超过作用域 `max_resource_bytes`（段二 B2 起对目录域真实大小同样生效，stat 后于 Manager 层收口；段二 B3 起写流 `append` 累计超上限同样产化并回滚）                                                                                                                                                                                                                                | `src/manager.rs` 单测 + `tests/directory_provider.rs` + `tests/archive_write_stream.rs`                                                                                                                      |
| `RESOURCE_BUSY`                                     | 流游标占用期间 `read_range`                                                                                                                                                                                                                                                                                                                                                             | `src/manager.rs` / `src/handle.rs` 单测                                                                                                                                                                      |
| `RESOURCE_HANDLE_RELEASED`                          | 已释放句柄使用（含 ID 陈旧命中墓碑）                                                                                                                                                                                                                                                                                                                                                    | `src/handle.rs` 单测                                                                                                                                                                                         |
| `RESOURCE_HANDLE_INVALIDATED`                       | 已失效句柄读操作                                                                                                                                                                                                                                                                                                                                                                        | `src/handle.rs` / `src/manager.rs` 单测                                                                                                                                                                      |
| `RESOURCE_POOL_EXHAUSTED`                           | 单插件 64 / 全局 4096 超限（`kind: handles`）                                                                                                                                                                                                                                                                                                                                           | `src/handle.rs` 单测                                                                                                                                                                                         |
| `RESOURCE_READ_ONLY`                                | 只读策略作用域写入能力预检（Manager 层直接返回不透传；段二 B2 起对 `dialog:open` 只读临时目录域生效——写/删预检 READ_ONLY，读/列举放行；段二 B3 起对归档域全写族与写流入口生效 + Provider 纵深臂；Platform/External 由判定矩阵先行以 PERMISSION_DENIED 拒绝，见 findings）+ `supports_write=false` Provider 写预检；**`details.uri` 两臂统一精确目标 uri（工单044 ⑧-2，B3 代码波落地）** | `src/permission.rs` / `src/manager.rs` 单测 + `tests/directory_provider.rs::test_directory_read_only_temporary_mount_arm` + `tests/archive_write_stream.rs::test_archive_write_family_precise_read_only_uri` |
| `RESOURCE_ALREADY_EXISTS`                           | 作用域 / Provider 重复注册（含 Memory 重复挂载、目录重复挂载 `mount_directory`、rename/copy 目标已存在不覆盖、mkdir 同名文件占用、写族目标为在册目录）                                                                                                                                                                                                                                  | `src/scope.rs` / `src/manager.rs` / `src/directory.rs` / `tests/directory_provider.rs`                                                                                                                       |
| `RESOURCE_INTERNAL`                                 | 兜底：作用域注册项指向未注册 Provider（装配错误，协议层兜底口径《06》§7.2）                                                                                                                                                                                                                                                                                                             | `src/manager.rs` 兜底单测 + `tests/error_code_lock.rs` 形状锁（无 details）                                                                                                                                  |
| `RESOURCE_NOT_SUPPORTED`                            | 段二 B1 产化：Memory 目录列举/建目录预检、`delete`/`create_directory`/`rename`/`list` 作用域类别门（Manager 层直接返回，`details{uri,scope,operation}`）；段二 B2 追加：目录域 `set_metadata`（§7.3 operation 六词无 metadata 词，映射 `write` 臂，沿用 B1 口径）与 Workspace/Document 目录域过同类门                                                                                   | `src/memory.rs` / `src/directory.rs` / `src/manager.rs` / `tests/memory_provider.rs` / `tests/directory_provider.rs` + 锁测                                                                                  |
| `RESOURCE_CROSS_SCOPE`                              | 段二 B1 产化：跨作用域 `copy` 且对目标作用域缺写权（`details` 复用 `IPermissionDeniedDetails` 形状）                                                                                                                                                                                                                                                                                    | `src/manager.rs` 单测 + `tests/error_code_lock.rs` 形状锁                                                                                                                                                    |
| `RESOURCE_NOT_EMPTY`                                | 段二 B2 产化：目录域 `delete` 非递归模式命中非空目录（《06》§7.2；原始目录非空判定，隐藏条目亦计，findings 登记口径）；`details{uri}` 单键（§7.3）                                                                                                                                                                                                                                      | `src/directory.rs` / `tests/directory_provider.rs` + `tests/error_code_lock.rs::test_b2_not_empty_and_write_failed_locked`                                                                                   |
| `RESOURCE_WRITE_FAILED`                             | 段二 B2 产化：目录域写族提交遇磁盘/锁冲突（write/rename/copy/mkdir 落盘失败，原子临时文件清理后上抛）；段二 B3 追加：写流 `append`/`commit` 通道 IO 失败与 `expected_size` 超送/提交不符回滚（临时文件即时清理）；`details{uri}` 单键；§7.3 `cause` 分类词表未在册不携带（findings）                                                                                                    | `tests/error_code_lock.rs::test_b2_not_empty_and_write_failed_locked` 映射锁 + `tests/archive_write_stream.rs::test_write_stream_directory_lifecycle`（真实磁盘错误注入面留验收波）                          |
| 其余 1 码（`NETWORK_FAILED`）                       | 本段不产生（依赖外部代理，段三接入）；常量与 `retryable`、HTTP 映射表由 `tests/error_code_lock.rs` 三方锁钉住                                                                                                                                                                                                                                                                           | `tests/error_code_lock.rs`                                                                                                                                                                                   |

## 发现的文档漂移（只登记，未改任何文档）

1. 《04.05》§5.3 Platform 读取要求 `resources:read:platform`，与《06.04》§4.3「Platform 免权限（公开只读）」矛盾。按协议规范 §4.3 实现（免权限），待裁决。已裁定收口（工单042，2026-09-21）。
2. 《04.09》§9.2 示例代码使用 `ChipsError::ResourcePathInvalid(..)` 枚举变体，但《核心接口规范》§3.3 落地的 `chips_core::ChipsError` 是单形结构体（`new/with_details/with_retryable`）。示例与实码不符，实现按实码 API。已裁定收口（工单042，2026-09-21）。
3. 《04.03》§3.2 `ResourceProvider::open_stream` 返回 `ResourceStream`，其形状在全部在册文档中未定义。段一定义为在册流读取抽象 trait（`next_chunk`），待文档补形。已裁定收口（工单042，2026-09-21）。该形状的实现消费面已随段二 B3 交付（`ArchiveStream` 拉取式游标，任务 #143/#151，2026-09-21）。
4. 《06.02》§2.4 `details.reason = unicode` 在全部文档中无触发规则（NFC 归一即通过）。段一保留词表成员但不产生；待补规则。已裁定收口（工单042，2026-09-21）。触发臂实现已于段二 B1 落地、段三 #157 按工单043 裁定 A1 收紧为 Unicode 非字符全集（`src/path_guard.rs` Unicode 触发臂小节：解码一次后须合法 UTF-8、不含 U+FFFD 与非字符全集——U+nFFFE/U+nFFFF 全 17 平面（n=0–16，含 U+FFFE/U+FFFF）+ 非字符区 U+FDD0–U+FDEF，NFC 差异不拒绝；违反 → `RESOURCE_PATH_INVALID` + `details.reason=unicode`；码归属由主智能体 2026-09-21 更正裁定，与《06.07》§7.3 `IResourcePathErrorDetails` 词表归组一致）。另登记：《06.02》§2.4 v1.0.3 与工单043 A1 原文所写非字符区端点「U+FDD0–U+FDCF」数值倒置（0xFDCF < 0xFDD0，非升序区间），按 Unicode 权威定义（UAX44 词汇表与 Unicode 17 核心规范 §23：66 非字符 = 每平面末二 + U+FDD0–U+FDEF）实现为 U+FDD0–U+FDEF，文档勘误归主智能体 errata 波。
5. 《04》§12 默认配置缺 URI/路径长度上限与「读取队列上限」的具体数值（§2.4 `length` 与 §7.2 `pool.kind = queue` 依赖它）。段一以 `ResourceLimits` 可配置项落地（默认 8192/4096/255 字节），队列上限面不做。
6. 《04.12》`maxResourceBytes` 2 GiB 与《06.06》§6.6「read() ≤8 MiB」共同决定 TOO_LARGE 两档；`resolve` 阶段无法预知大小，段一在 `open/stat` 处由 Provider 元数据触发。

## 段二前置观察（Provider 需要的签名）

- 见 `src/provider.rs` 的《04》§3.2 全量 trait；段二实现 `DirectoryProvider`/`ArchiveProvider` 时按 `ResourceAddress{scope,path,origin}` 挂载即可，无需改 trait。
- `ScopeRegistration` 需要携带 `provider_id` 供管理器选择 Provider（文档 §5.2 结构未列该字段，段一补充，属可实现必需）。

## 段一收口记录（任务 #128 接管，2026-09 复检）

### 前任（#125）死亡定性

- `src/manager.rs`（877 行、含 12+ 在册单测）**并非半成品**：解析流水线、句柄门面
  `open/stat/read_range/read_chunk/release`、会话/作用域级联全部落盘且属段一在册
  范围（lib 文档与模块导览均以之为段一交付），判定为「段界内→补完并配测试」，
  **不归档、不摘挂载**。
- 接管时编译即绿（`cargo check` EXIT=0），但 `cargo test` 为 68/70：失败两例均为
  **实现缺陷**（断言本身符合《06》，未放宽任何断言）：
  1. `canonical_percent_encode` 的 `RESERVED` 表误含 `?`，致规范输出出现裸 `?`
     （违反《06》§2.5「字面 `?` 必须编码为 `%3F`」与函数自身文档）；已移出 `?`，
     `/` 保留字面（按段调用、段文本经 PathGuard 后必不含 `/`）。
  2. `normalize_bare_http` 把无路径分隔符的裸 origin（`https://example.com`）折叠
     为基址形态；《06》§2.4 规定空路径只允许尾斜杠基址形态，现按
     `INVALID_URI/malformed_path` 拒绝，`https://example.com/` 基址形态保持不变。
- 另修正 lib.rs 顶层 doctest 的规范输出期望：裸空格形态违反《06》§2.6「空格必须
  编码为 `%20`」，实现输出 `a%20b.png` 正确，doctest 期望改为 `%20`。
- lint 卫生：`from_validated` 仅测试面使用，收为 `#[cfg(test)]`（消除 dead_code，
  未用 `#[allow]`）；`split_query` 冗余生命周期、`segments()` 双重 `must_use`、
  `let...else`、`assert_eq!(.., true)`、冗余闭包共 5 处 clippy 违规按建议修实；
  `tests/uri_syntax_matrix.rs` 的 `crate_codes` 模块删除 10 个未使用常量再导出。
- 补 `src/manager.rs` 兜底用例 1 个（注册项指向未注册 Provider → `RESOURCE_INTERNAL`
  且不泄漏句柄）。

### 错误码三方对表结论

- `tests/error_code_lock.rs`（9 用例）：《06》§7.2 十八码 ↔ crate 常量 ↔
  `ResourceError::code()` 三方逐码对照，`retryable` 五码真值表、协议路径 HTTP
  映射 18 项、`RESOURCE_/DOMAIN_REASON` 文法、§7.3 details 键形状与
  reason 词表（URI 8 词、路径 9 词、句柄状态 3 词、失效原因 3 词 kebab-case、
  池类别 2 词、权限拒绝 5 词）全量锁定。**结论：逐码一致，无缺码、无多码、
  无文案漂移**；§7.3 `ResourceNetworkErrorReason` 7 词在册但段一无产生面，
  Rust 枚举待段二网络面落地时补形并纳入同型锁测。

### 四闸 + workspace 收口数字（真实输出）

| 闸   | 命令                                                          | EXIT                                                                                          |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 编译 | `cargo check -p chips-resource`                               | 0                                                                                             |
| 格式 | `cargo fmt -p chips-resource -- --check`                      | 0                                                                                             |
| 静态 | `cargo clippy -p chips-resource --all-targets -- -D warnings` | 0                                                                                             |
| 测试 | `cargo test -p chips-resource`                                | 0（lib 71 + error_code_lock 9 + uri_syntax_matrix 9 + doctest 1，共 90 用例，零 skip 零忽略） |
| 构建 | `cargo build -p chips-resource`                               | 0                                                                                             |
| 卫生 | `cargo check --workspace`                                     | 0（不毒化兄弟面）                                                                             |

（lib 用例数 71 = 前任 70 + 本次补 manager 兜底 1。）

## 段二 B1 收口记录（任务 #132 随单，2026-09-21）

- ① MemoryProvider 挂载：`src/memory.rs` 新增内置 `MemoryProvider`（复用 `provider` 段一在册
  trait 未重定义；能力三元组 `id="memory"` / `supports_streaming=true` / `supports_write=true`
  如实声明，目录列举不支持）。运行时内存字节、不落盘、无磁盘缓存；版本戳 `mem-{n}` 递增。
  Manager 侧（`src/manager.rs`）：`mount_memory(session)` 挂 `memory-1`（会话须存在，
  重复挂载 `ALREADY_EXISTS`；provider 惰性注册一次）；creator 会话关闭（含级联）即
  `provider.clear()` + 注销作用域——不持久化，新会话重挂读旧字节必 `NOT_FOUND`；
  《06.04》§4.3 行 9：creator 会话免重复校验读、写须 `resources:write`
  （`src/permission.rs::memory`），禁止跨会话传递（外来会话 resolve 即
  PERMISSION_DENIED/out_of_scope）。写入提交面 `commit_write` 与 FS 操作公开入口
  `list_directory`/`delete`/`rename`/`copy`/`create_directory` 挂载；能力预检在 Manager 层
  直接返回 `READ_ONLY`（只读策略/`supports_write=false`）/ `NOT_SUPPORTED`
  （作用域类别门，`details{uri,scope,operation}` 六词表），不透传 Provider。
  `open_write_stream` 写流提交面留后续波。
- ② unicode 触发臂产化（工单042 裁定④，《06.02》§2.4）：`src/path_guard.rs`
  「Unicode 触发臂」小节（`percent_decode_checked` / `is_forbidden_unicode`）——解码一次后
  须合法 UTF-8、不含 U+FFFD 与非字符 U+nFFFE/U+nFFFF（n=1..10，段三 #157 已按
  工单043 裁定 A1 收紧为全 17 平面 + 非字符区 U+FDD0–U+FDEF 全集，见文末段三收口记录）；违反 →
  `RESOURCE_PATH_INVALID` + `details{uri,path,reason:"unicode"}`（错误码零自造，过密/畸形序列仍
  走 `invalid_encoding`）；NFC 归一差异不拒绝（`caf%C3%A9` ≡ `cafe%CC%81`）。
  产化锁测 `tests/error_code_lock.rs::test_unicode_reason_has_production`（公开输入面
  `resolve_input` 7 拒绝例 + NFC 等价例）+ `src/path_guard.rs` 四单测臂 +
  `tests/memory_provider.rs` URI 层用例；由零产化翻转为有产化，未删任何在册词。
- ③ `src/permission.rs` 模块注释旧口径清理（纯注释零逻辑改动）：旧文保留
  「《04.05》§5.3 要求 resources:read:platform 收紧口径待裁决」话术，现按工单042
  裁定①已收口口径改写——《06.04》§4.3 为协议权威，Platform 任意插件免权限公开只读，
  收紧预留删除。
- 测试账（真实输出）：基线 90（lib 71 + error_code_lock 9 + uri_syntax_matrix 9 + doctest 1）
  → 124（lib 97 + error_code_lock 11 + memory_provider 6 + uri_syntax_matrix 9 + doctest 1），
  **+34 纯增量、零删档零放宽**；段一既有句柄矩阵与 URI 矩阵原样通过（unicode 臂翻转前
  URI 矩阵无 `%FF` 在册钉，无冲突）。
- 门禁复跑（真实退出码）：`cargo test -p chips-resource`=0、
  `cargo clippy -p chips-resource --all-targets -- -D warnings`=0、
  `cargo fmt -p chips-resource -- --check`=0、`cargo check -p chips-resource`=0 零警告。
- 文档-实码张力裁量（不自造口径，详见波次 findings 交回裁决）：unicode 臂承载形态初稿为 `UnicodeRejected` 新变体（随裁定④初稿 INVALID_URI 口径），经主智能体 2026-09-21 码归属更正废止该变体、归入 `PathInvalid{reason: Unicode}` 同表臂承载在册 wire 值；`copy` 采《06》§7.2「目标存在必 ALREADY_EXISTS」（弃《04.04》§4.9
  覆盖说）；rename 跨作用域 → `NOT_SUPPORTED{rename}`（§4.9 同作用域约束），
  `CROSS_SCOPE` 仅保留 copy 缺目标写权臂；Memory `set_metadata` 无 §7.3 operation
  六词之「metadata」词，映射 `NOT_SUPPORTED{operation:"write"}` 并注记；
  判定矩阵先于 Manager 预检执行（Platform 写 → PERMISSION_DENIED/policy；
  只读策略临时作用域 → READ_ONLY），顺序按实码矩阵固化。

## 段二 B2 收口记录（任务 #134 随单，2026-09）

- ① DirectoryProvider 挂载：`src/directory.rs` 新增内置 `DirectoryProvider`
  （复用 `provider` 在册 trait 未重定义；能力三元组 `id="directory"` /
  `supports_streaming=true` / `supports_write=true` 如实声明）。作用域→真实根
  以 `attach_root` 登记（`canonicalize` 根落位，macOS `/var` 符号链接形态自洽；
  根缺失/为文件 → `NOT_FOUND`；重复挂载 → `ALREADY_EXISTS`，细节仅携作用域
  标识不泄露真实路径）。读面 `stat`/`read_range`/`open_stream` 全程分块
  （64 KiB 传输缓冲 + 256 KiB 在册块上限），无整档驻留内存；版本戳
  `mtime_secs-size`（《04》§1.3）。流契按段一在册 `ResourceStream` 拉取模型
  （非末块 ∈ (0, min(max_bytes, 256 KiB)]、None 唯一终结、游标自 0 严格累计；
  BUSY 占用由 `HandleTable` 强制，Provider 不重复记账）。列举面过滤
  隐藏点文件（含 `.DS_Store`/`.git`）与 `Thumbs.db` 及符号链接条目
  （不跟随、不列举，06.02 §3.3 口径），非 UTF-8 文件名跳过，按名定序。
  写入提交面原子落地（`.chips-tmp-<pid>-<seq>` + `flush` + `sync_all` +
  `rename`，失败清理零残留）；rename/copy 不覆盖、mkdir 幂等、
  `delete` 非递归（非空目录 `NOT_EMPTY`，《04.04》§4.9）；
  `set_metadata` 无 §7.3 operation 词，映射 `NOT_SUPPORTED{operation:"write"}`
  沿用 B1 口径。
- ② 路径安全落位后防御：读/写族寻址统一走 `locate`（复用在册
  `path_guard::resolve_within_root`，9 词 reason 词表零自造）；根外符号链接
  逃逸 → `RESOURCE_PATH_INVALID` + `details.reason=symlink`；
  `resolve_within_root` 以空 uri 产错（段一在册形状），Provider 层回填
  目标规范 URI 以符 §7.3 `IResourcePathErrorDetails{uri,path,reason}`
  （修复面在调用层，不动 path_guard，登记 findings）。目录态路径不得
  作为资源读取（stat/范围读/开流 → `NOT_FOUND`，《06》§2.4）；列举作用
  域根由 `resolve` 先行拒绝，文件/缺失目录列举 → `NOT_FOUND`（findings）。
- ③ Manager `mount_directory(session, registration)`：会话须存在
  （PERMISSION_DENIED/out_of_scope）；种类限 Workspace/Document/Plugin/
  Temporary 且 origin 必为 `Directory`（越界装配错误 → INTERNAL，零自造码）；
  `provider_id` 强制归一为 `directory`，Provider 惰性注册一次；注册/绑定
  任一步失败回滚已完成的根挂载与作用域登记，不留半挂载态；
  `unregister_scope` 同步 `detach_root`（无泄漏收口）；目录域作用域**不**随
  `close_session` 自动摘除（宿主驱动注销，《06.03》§3.2 注销时机表，
  区别于 Memory 的 B1 驱逐臂；登记 findings 供裁决复核）。只读臂
  （`dialog:open` 临时域 `policy.read_only=true`）由既有判定矩阵
  `temporary()` 臂产 READ_ONLY，本单不改 permission.rs。
- ④ 错误码产化增量：`RESOURCE_NOT_EMPTY` / `RESOURCE_WRITE_FAILED` 由
  「常量在册、零产生」翻为「有产生」（`src/error.rs` 纯新增两变体，
  18 码表零改动）；`tests/error_code_lock.rs` 纯新增
  `test_b2_not_empty_and_write_failed_locked`（变体→码、retryable 走
  在册表、details 键形 {uri} 单键），既有 11 条锁零改零删。
- 测试账（真实输出）：基线 124（lib 97 + error_code_lock 11 +
  memory_provider 6 + uri_syntax_matrix 9 + doctest 1）→ 152（lib 112 +
  error_code_lock 12 + directory_provider 12 + memory_provider 6 +
  uri_syntax_matrix 9 + doctest 1），**+28 纯增量、零删档零放宽**
  （lib +15 = directory 单测 11 + manager 挂载单测 4；集成 +12；锁测 +1）。
  夹具为真实临时目录（std temp_dir + pid/原子序号命名，Drop 自清，
  不新增第三方依赖）。
- 门禁复跑（真实退出码）：`cargo test -p chips-resource`=0、
  `cargo clippy -p chips-resource --all-targets -- -D warnings`=0、
  `cargo fmt -p chips-resource -- --check`=0、`cargo check -p chips-resource`=0
  零警告、prettier `--check` README=0。

## 段二 B3 收口记录（任务 #143 交付 + #151 接管收口，2026-09-21）

- ① ArchiveProvider（`src/archive.rs`，822 行）：ZIP Store 归档只读域
  （`attach_archive` 挂载、`detach_archive` 归还）；ZIP 解析整体复用
  `chips-parser` 归档层公开读取面（段二 B3 C0 扩面：`ArchiveSource::open` /
  `from_bytes` / `looks_like_zip` / `members` / `read_member_range` 由
  `pub(crate)` 翻公开 + UNIX 宿主非普通文件条目解析期拒绝 + 3 新单测），
  本 crate 零 ZIP/Deflate 自实现（《04.03》§3.3）。读面 stat（版本戳
  `crc32-{CRC:08x}-{size}`）/范围读（Store 映射切片零解压、Deflate 限额内
  现场解码）；流面 `ArchiveStream` 按《04.03》§3.2 拉取式契约
  （`next_chunk(max_bytes)`、非末块 ∈ (0, min(max_bytes, 256 KiB)]、
  `None` 唯一终结、游标自 0 严格累计；BUSY 占用由 `HandleTable` 强制）；
  列举面前缀合成目录树（目录条目 `is_directory=true`）、隐藏点文件与
  `Thumbs.db` 过滤、按名定序，前缀下无成员 → `NOT_FOUND`（044 裁定①②
  同口径）；写入族（write/delete/rename/copy/create_directory/set_metadata）
  全量 `RESOURCE_READ_ONLY` 纵深臂（`details.uri` 精确目标形）。
  错误映射零自造：缺失归档 → `NOT_FOUND`，结构损坏/非普通条目 →
  `INTERNAL` 兜底，成员缺失 → `NOT_FOUND`。
- ② WriteCoordinator（`src/write_coord.rs`）：路径写锁（键 = 作用域 ID +
  规范虚拟路径），同键单写者排队、rename A→B 双键 {A,B}、多键升序获取
  无死锁构造（《04.04》§4.9、《04.13》§13-3）；覆盖面为 Manager 全部目录
  写族提交点（`commit_write`/`delete`/`rename`/`copy`/`create_directory`/
  写流生命周期全程持锁）。读取面不取写锁（句柄流占用互斥仍由
  `HandleTable` 以 `RESOURCE_BUSY` 承载）。
- ③ 流式写入提交面（`manager.rs`）：`open_write_stream`（同步签名）解析
  流水线写鉴权 → 能力预检（归档/只读 → READ_ONLY 精确 uri 臂）→
  `expected_size` 上限预核 → 取路径写锁贯穿流生命周期；目录域走
  `DirectoryStreamSink` 隐藏临时文件（`begin_stream_write`，B2 原子形态
  的流式承载），其余可写 Provider 走内存缓冲一次性落定。
  `append_write_stream` 超上限 → `TOO_LARGE` 回滚、超 `expected_size` →
  `WRITE_FAILED` 回滚（findings 登记裁量）、IO 失败 → `WRITE_FAILED`
  回滚；`commit_write_stream` flush+sync_all+rename 原子替换、尺寸不符
  即回滚不提交；`abort_write_stream` 与陈旧句柄三面 `NOT_FOUND`；
  目标为在册目录 → `ALREADY_EXISTS`、缺父目录 → `NOT_FOUND`。会话关闭 /
  作用域注销级联一律中止活动写流并清理临时文件（零残留，《04.04》§4.9）。
- ④ 工单044 §三.5 裁定⑧-2 随单翻正：`PermissionChecker::new` 增
  `target_uri` 入参，判定矩阵 `READ_ONLY` 臂回填精确目标 uri，与
  `writable_provider` 预检臂、ArchiveProvider 纵深臂三臂统一形
  （《06.07》§7.3 终裁背书句落地）；`tests/directory_provider.rs`
  相应锁测翻正（不放宽：根形期望翻为精确形 + delete 臂新增 uri 锁）；
  `src/permission.rs` L5 工单042 旧口径残留注释随单清理收口（本crate
  README 漂移登记第 1 条在册不复活）。
- ⑤ Manager `mount_archive(session, registration)`：种类限 Document/Plugin
  且 origin 必为 `Archive`（越界装配 → `INTERNAL`）；`provider_id` 强制
  归一 `archive`、`policy.read_only` 强制翻真；attach→register→attach
  失败回滚不留半挂载态；重复挂载 `ALREADY_EXISTS`；归档域与目录域同款
  不随 `close_session` 摘除（《06.03》§3.2 注销时机表），
  `unregister_scope` 同步 `detach_archive` + 写流中止。
- 测试账（真实输出）：#143 在途基线 159（lib 119 = 112 + archive 单测 5 +
  write_coord 单测 2；dir 12 + errlock 12 + mem 6 + uri 9 + doctest 1）→
  #151 接管补 Manager 面集成锁 `tests/archive_write_stream.rs` +6
  （挂载流水线/归一/回滚、读面端到端、写族 ⑧-2 精确 uri、写流生命周期、
  级联中止零残留、单写者串行化）→ 165 全绿；chips-parser 面 103 lib +
  91 集成 + 1 doctest = 195 全绿。零删档零放宽。
- 门禁复跑（真实退出码，日志 /tmp/w151_*.log）：
  `cargo test -p chips-resource -p chips-parser`=0、
  `cargo clippy -p chips-resource -p chips-parser --all-targets -- -D warnings`=0、
  `cargo fmt -p chips-resource -p chips-parser --check`=0；crate 级行覆盖率
  chips-resource src 1879/2144=87.64%（TD-002 豁免在册 86.27%→回升，<90
  维持至 2026-10-19）、chips-parser src 3121/3357=92.97%（越组阈）。

## 段三收口记录（任务 #157 随单，2026-09-22）

- ① unicode 非字符全集触发臂补口（工单043 裁定 A1，《06.02》§2.4 v1.0.3
  权威文面，与 #132 段二 B1 已落臂逐值对表）：`src/path_guard.rs`
  `is_forbidden_unicode` 由 B1 形（平面封顶 n≤10、无非字符区臂）翻正为
  Unicode 非字符全集——U+nFFFE/U+nFFFF 全 17 平面（n = 0–16，含
  U+FFFE/U+FFFF；`char` 码位上界 U+10FFFF 使 `(cp & 0xFFFE) == 0xFFFE`
  天然覆盖平面 11–16）+ 非字符区 U+FDD0–U+FDEF + 替换字符 U+FFFD。
  错误码与 reason 词表零改动（`RESOURCE_PATH_INVALID` +
  `details.reason = unicode`，2026-09-21 码归属更正口径维持，无需翻正）；
  合法 UTF-8 通过臂、NFC 差异不拒臂两臂锁测维持并随单加强。
  锁测随动（零删零放宽）：单测全集逐值正例 9 + 负例防误伤 4
  （`test_percent_decode_checked_arms`）、编码形 11 例 + 字面形 4 例
  （`test_unicode_arm_noncharacters_rejected`）；公开入口产生面锁
  `tests/error_code_lock.rs::test_unicode_reason_has_production` 拒绝列
  7→11（补平面 11、平面 16 末端、非字符区两界），URI 层
  `tests/memory_provider.rs` 6→8。
- ② 写锁 Condvar 异步形勘查收口（#151 残账）：暴露面实存——Manager
  异步写族入口 `commit_write`/`delete`/`rename`/`copy`/`create_directory`
  原在 `async fn` 内同步调用 `WriteCoordinator::lock`（`Mutex`+`Condvar`
  无超时等待）：单线程 runtime 下排队任务独占执行线程、持锁任务释放点
  永不可达（构造性永久死锁）；多线程 runtime 下饿死 worker。最小收口：
  `src/write_coord.rs` 新增 `lock_async`（`tokio::sync::Notify` 登记式
  唤醒、等待让出线程；与同步臂同规范——升序排队、去重、单写者、跨臂
  互斥共用同一锁表；等待后续键被取消时已取得前缀键随 `KeyRollback`
  守卫归还，取消安全），五处异步入口翻 `lock_async(...).await`；同步
  签名入口 `open_write_stream`（《03.07》§7.1）维持同步臂在册形。
  锁测 +5：write_coord 单测 4（单线程不饿死、升序去重与占键、跨臂
  互斥 + 半获取取消回滚、异步持锁方排斥同步排队者）+ Manager 层
  `test_commit_write_async_arm_does_not_starve_single_thread_executor`
  （带闸可写替身模拟持锁 Provider Pending 窗口，同路径双提交按序排队
  各得新版本）。
- ③ TD-002 覆盖率读数复报（既有通道、crate 级作用域，不跑全工作区
  聚合闸）：`cargo tarpaulin -p chips-resource --engine llvm -o Lcov
  Stdout` EXIT=0，lcov 过滤 `crates/chips-resource/src` 口径
  **1922/2190 = 87.76%**（对照在册 1879/2144 = 87.64%：+43 覆盖行/+46
  总行、+0.12pp 回升；<90% 维持豁免至 2026-10-19）。
- 测试账（真实输出）：基线 165（lib 119 + archive 6 + dir 12 +
  errlock 12 + mem 6 + uri 9 + doctest 1）→ **170**（lib 124 = 119+5，
  集成计数不变、册内用例扩充），全绿、零删档零放宽。
- 门禁复跑（真实退出码）：`cargo fmt --check`=0、
  `cargo test -p chips-resource`=0、
  `cargo clippy -p chips-resource --all-targets -- -D warnings`=0。
  chips-parser 零改动（本单未触其导出面），其 195 用例基线不随本单动。
- 文档勘误升级（归主智能体文档库 errata 波，本波文档库禁改）：
  《06.02》§2.4 v1.0.3 与工单043 A1 原文非字符区端点「U+FDD0–U+FDCF」
  数值倒置（0xFDCF < 0xFDD0，非升序区间），按 Unicode 权威定义（66 非
  字符 = 17 平面末二 + U+FDD0–U+FDEF，Unicode 17 核心规范 §23）实现为
  U+FDD0–U+FDEF 并在此登记；实现臂为原文面所有可解释读法的超集。

## 波 C2a-1 收口记录（任务 #255 随单，2026-09-23）

工单036 波 C2a-1：提交日志（写意图落盘 prepare–commit 两相）+ 恢复扫描
+ 孤儿临时物回收，全部落在本 crate 独占面，公开形状零改动。

- ① 提交日志（`src/journal.rs`，676 行新模块）：sidecar 意图记录形态——
  journal 文件 = 既有 `.chips-tmp-<pid>-<seq>` 临时物名 + `.j` 后缀、同目录
  成对（文件名词柄配对为权威判据面，恢复处置不依赖记录内容）；记录内容
  `CommitRecord{temp,target,createdUnixMs}`（camelCase、`deny_unknown_fields`，
  仅供判读与一致性锁测）。prepare–commit 两相接入既有全部目录域写路径：
  `atomic_write_with`（`commit_write`/`create_directory`/`copy` 共同通道，
  `directory.rs:242`，prepare `:254`、终结 `:273`）与 `begin_stream_write`
  （写流槽持有 `JournalTicket`，`:315/:332`；`finish` 成败双臂与 `abort`/
  Drop 通道统一撤记录，`:400/:407`）。IO 口径（有界）：每次提交固定
  +1 记录写入 +1 记录 fsync +1 父目录 fsync +1 终结 unlink，无按体量/
  按目录规模的摊销外 IO；终结 unlink 不做 fsync（断电后记录残留由恢复
  扫描幂等收敛，目标态不受影响）。令牌 = 进程号 + 进程全局原子序号
  （`static TOKEN_SEQ`），根治同进程多管理器实例/双挂载同根的令牌碰撞。
- ② 并发与锁序（与 `WriteCoordinator` 方言一致，禁第二套锁）：journal
  建档/撤销全部发生在既有路径写锁覆盖窗口内，本模块不新增任何路径锁；
  进程内在途账（`static Mutex<BTreeSet<String>>`）为叶子锁——取锁后不取
  其他锁、不跨 IO 长期持有，锁序单向（路径许可 → 在途账），无环。
  登记先于任何 FS 动作、销账后于 journal unlink，维持「记录可见 ⇒ 在途
  在册」不变量，恢复扫描据此绝不误删本进程并发在途临时物。
- ③ 恢复扫描（`journal::recover_root`，`:392`）接线于既有公开入口的唯一
  汇聚 seam = `DirectoryProvider::attach_root`（`directory.rs:115→130`，
  `mount_directory` 与 `register_temp_scope` 均经此）：作用域 FS 域重启后
  首次进入引擎时全树一次收敛（迭代栈遍历、lstat 语义不跟随符号链接、
  预算 `RECOVERY_WALK_MAX_DEPTH=32`/`RECOVERY_WALK_MAX_ENTRIES=100_000`
  截断如实计数）。选型理由：构造期无根可扫、逐写扫描 = 无界 IO，挂载
  即「崩溃中间态重启后第一次可达点」；扫描失败绝不使挂载失败（计入
  报告）。处置三态（确定性）：a) 记录在 + 同名临时物在 + 不在途 → 按
  既有失败回滚语义删临时物（目标保持旧态）再撤记录；b) 记录在 + 临时
  物不在（含 rename 已落定未终结、记录内容损坏）→ 只撤记录，绝不触碰
  目标（已完成未终结记录不误删合法新态）；c) 严格名形态临时物无记录
  支撑（协议外对象）→ 计数 `unbacked_temp_files` 保留不删（禁「存在即
  删」 crude 形态，兼防重叠挂载下他域在途临时物误伤）。在途记录计入
  `skipped_in_flight` 零处置。
- ④ 孤儿临时物回收与 ①/②/③ 同一张账单源：三者共用「journal 在册 ⇔
  在途账保护」单一判据面，无第二个不兼容判定面；`attach_root` 返回
  `JournalRecoveryReport` 按作用域存于 `recovery_reports`（`directory.rs:73`），
  Manager 新增查询面 `directory_recovery_report`（`manager.rs:893`），
  `detach_root` 同步清账。
- ⑤ 错误码零新增：恢复面不产错（计数报告）；写侧 journal 建档失败复用
  在册 `RESOURCE_WRITE_FAILED`（登记于《06》§7.2 磁盘臂），《06.02》§2.4
  九词面与 PermissionDenyReason 方言零触碰；native 绑定/export-surface
  无形状变化（`chips-native` 仅消费 `DIRECTORY_PROVIDER_ID` 常量，
  `attach_root`/`DirectoryStreamSink` 为 crate 内部形状）。
- ⑥ 跨进程共挂同一根：超出 Host 唯一运行时承载契约，登记为在册边界
  （模块头如实陈述）；不引入 pid 存活探测（需新依赖，越红线），进程内
  在途账 + 单宿主进程契约覆盖全部在册并发形态。
- 测试账（真实输出）：基线 266 → **287** 全绿（lib 182 = 171 + journal
  单测 10 + directory 探针单测 1；集成新册 `tests/journal_recovery.rs` 10
  例覆盖四类判据：崩溃中间态重启收敛 / 并发在途不被误删（双管理器同
  根竞态）/ 日志与真实 FS 一致性 / 级联中止与日志协同（会话关闭、作用域
  注销、超限回滚）；archive_ws 6 + audit 14 + cache 7 + dir 12 +
  errlock 14 + ssrf 25 + mem 6 + session_grant 1 + uri 9 + doctest 1）。
  零删档零放宽零 skip。
- 门禁复跑（真实退出码，日志 /tmp/w255_*.log）：
  `cargo fmt -p chips-resource -- --check`=0、
  `cargo clippy -p chips-resource --all-targets -- -D warnings`=0、
  `cargo test -p chips-resource`=0（287 passed / 0 failed）、
  `cargo check -p chips-parser`=0（core-rust 工作区）、
  `cargo check -p chips-native`=0（根工作区）。
- TD-002 覆盖率复报（既有通道、crate 级 src 口径）：
  `cargo tarpaulin -p chips-resource --engine llvm --out Lcov` EXIT=0，
  过滤 `crates/chips-resource/src` 合计 **3203/3597 = 89.05%**（对照在册
  88.89%：+0.16pp 回升；journal.rs 138/146，余 8 行为故障注入类臂——
  read_dir/entry IO 错误与 100_000 条目预算截断，夹具成本失配未锁测、
  如实登记；<90 维持豁免至 2026-10-19）。

## 波 C2a-3 收口记录（任务 #267 随单，2026-09-24）

工单036 波 C2a-3：归档态（`.card` / `.box`）**整包重建写通路**落位，即勘查
报告 §五 C2a 条④；全部落在本 crate 独占面，`chips-parser` 零改动（只读消费
其归档写侧公开面）。

- ① 两相通路（`src/archive.rs`，844 → 1382 行）：
  `ArchiveProvider::stage_rebuild_package`（`:331`，prepare 相）→
  `ArchiveProvider::publish_rebuild_package`（`:447`，publish 相）——
  prepare 相按「同目录 sidecar 意图记录先建（`JournalTicket`）→ 同级隐藏临时
  整包 `.chips-tmp-<pid>-<seq>` 建档 → `ZipArchiveWriter` 全量条目写出 →
  `finish` + `flush` + `sync_all`」把**全部慢 IO** 收在本相；publish 相是纯
  元数据动作（`rename` 原子换代 → 撤记录销账 → 以新归档文件重挂作用域）。
  注：任务书 §五字面枚举为「临时整包写出 → 意图账登记」，实现以 C2a-1 在册
  不变量**记录先于临时物**为准（否则崩溃中间态不可判读），差异如实登记。
- ② 写出权威在解析域（跨 crate 只走公开面，零 `#[path]`、零 ZIP 自实现）：
  `chips_parser::serialize::{ZipArchiveWriter, archive_total_size,
  entry_overhead}`（`crates/chips-parser/src/serialize/write_archive.rs:158/
  90/77`）；未变更成员经 `MemberReader`（`src/archive.rs:725`）把
  `ArchiveSource::read_member_range` 适配为 `&mut dyn Read`，64 KiB 常数内存
  分块复用（《11.05》§5.4「未变更成员」行，不整包载入）。终成员集 =（旧包
  成员 − `removals` − 被覆写路径）∪ `members`，`BTreeMap<PackagePath>` 键序
  即 UTF-8 字节升序，与写侧严格升序要求同源（`assemble_rebuild_entries:562`）。
- ③ 恢复扫描复用（不新造第二套日志）：`journal::recover_package_slot`
  （`src/journal.rs:414`）为归档槽位（正式归档文件**同级目录**）的定向单层
  扫描——归档作用域根是文件本身、`recover_root` 的整树扫描天然覆盖不到该
  槽位；分拣判据（`slot_collect:422`）与三态处置（`dispose_walked:457`）与
  `recover_root` **同一函数单源**（含在途账保护、判据 3 无账临时物保留不删、
  计数口径），`recover_root` 本体已改为「walk_collect + dispose_walked」组合，
  行为逐字不变（既有 10 例 journal 单测与 `tests/journal_recovery.rs` 全绿
  自证）。接线位 = `ArchiveProvider::attach_archive`（`:191`，
  `mount_archive` 唯一入口）挂载即扫，报告存 `recovery_reports` 账
  （`recovery_report:242` / Manager 查询面 `archive_recovery_report`，
  `manager.rs:1028`），`detach_archive` 同步清账；扫描失败不改变挂载成败。
- ④ 锁面（禁绕锁直写正式路径）：`ResourceManager::rebuild_archive`
  （`manager.rs:1504`）经 `WriteCoordinator::lock_async` 一次性取
  `archive_rebuild_lock_keys`（`manager.rs:1664`）= 整包槽位键
  `(归档作用域, "")`（虚拟路径空形 = 作用域基址，与成员键空间天然不相交）+
  归档宿主文件所落入的**每个目录态载体作用域**的 `(目录作用域, 成员虚拟路径)`
  交叉键——同一宿主 `.card` 既可被整包换代也可被目录域 `commit_write` /
  `commit_changeset` 覆写，缺交叉键即成旁路面；素材与点位三同一权威
  （`fs::canonicalize` + `canonical_percent_encode` + `VirtualPath::validate`）。
  锁覆盖 prepare+publish 全程；Provider 侧不自行取锁（与目录域
  `stage_bundle_member` 同方言）。
- ⑤ 语义边界（如实登记，不改架构）：归档**永不就地改写**的成员级只读臂
  （`write`/`delete`/`rename`/`copy`/`create_directory`/`set_metadata` →
  `RESOURCE_READ_ONLY`，`supports_write=false`）**零改动**；整包换代不是
  「归档可写」，其授权单源 = 会话绑定闸（`require_session_bound_scope`）+
  Document 种类写族 `resources:write` 判定（判定素材照常发射审计），不经
  `writable_provider`、不翻转 `mount_archive` 强制的 `policy.read_only`。
  载体种类限 `Document`：`.cpk` 插件包（Plugin）与非归档 origin 一律
  `RESOURCE_NOT_SUPPORTED{operation=write}`。换代成功后 Provider 立即重挂
  新包（读取面与盘上同步）；换代前已打开的句柄仍读旧映射（temp+rename 对
  读者呈原子替换，《04.04》§4.8 既有口径）。
- ⑥ 错误码零新增（《06.02》§2.4 九词冻结）：请求形态（重复/交叉 →
  `ALREADY_EXISTS`、超内联 → `TOO_LARGE`）先于授权判定，与
  `commit_changeset` 判定序同谱；`removals` 缺失 → `NOT_FOUND`（成员精确
  uri）；发布格式上限（条目数/名称长度/单成员字节/总字节闭式和，
  `check_publish_bounds:608` + `check_publish_total_size:650` + `finish` 后
  实然尺寸闸）→ `TOO_LARGE`（`size`/`limit` 取真实数值，权威判定仍在解析器
  `check_publish_bounds`，本侧只负责折算在册形，绝不放宽）；解析器
  `LimitExceeded` → `TOO_LARGE`、其余写侧错误 → `WRITE_FAILED`
  （`publish_error:701`）；换代 `rename` 失败 → `WRITE_FAILED`（正式归档旧态、
  零残留）；换代成功但新包重挂失败 → 摘除陈旧挂载 + `INTERNAL`（宁可不交付
  视图，绝不交付换代前旧包视图）。空变更集 → 幂等 no-op（不取锁、不写账）。
- 测试账（真实输出）：基线 **298 → 308 全绿**（+10：新册
  `tests/archive_rebuild.rs` 7 例 + `src/journal.rs` 槽位单测 3 例）。集成锁
  七判据：① 整包重建往返（覆写+新增+删除+200 KiB 二进制成员逐字节复用、
  回执总字节即盘上实况、换代后读面即新包、零残留）；② prepare 窗口崩溃残骸
  由挂载槽位扫描回滚旧态（正式归档字节零触碰 + 报告逐项计数 + 收敛后可正常
  换代）；③ 失败臂全不现（缺失删除目标 / 超内联 / 超作用域上限前后字节
  完全一致、同级零 `.chips-tmp-*`）；④ 拒绝臂在册码（`not_granted` /
  `out_of_scope` / `ALREADY_EXISTS` 双臂 / `NOT_FOUND` / Plugin 与非归档
  `NOT_SUPPORTED` / 空集 no-op）；⑤ 并发两笔换代串行收敛（终成员集完整 4
  员、正文取值为两候选之一、盘上总字节等某笔回执）；⑥ 目录载体在途写流
  未终结时整包换代排队（交叉锁真生效，中止后放行）；⑦ 发布形态合规（全
  条目 Store、时间戳统一取 `saved_at`、成员尺寸如实）。夹具以解析器写侧
  `ZipArchiveWriter` 产出真实 ZIP（零手写 ZIP 字节、零 mock）；零删档、零
  放宽断言、零 skip、无 TODO。
- 门禁复跑（真实退出码，日志 /tmp/g_*.log，于 core-rust 工作区）：
  `cargo fmt -p chips-resource --check`=0、
  `cargo clippy -p chips-resource --all-targets -- -D warnings`=0、
  `cargo test -p chips-resource`=0（308 passed / 0 failed，14 个
  `test result: ok` 面求和）、`cargo check -p chips-parser`=0。
  基线对账：`cargo test -p chips-resource` 起跑前实测 298/0（E=0，
  /tmp/w267_baseline_test.log），收口 308/0（+10 只增不减）。
- TD-002 覆盖率复报（同通道、crate 级 src 口径）：
  `cargo tarpaulin -p chips-resource --ignore-tests --out Lcov Json
  --output-dir /tmp/w267_cov` EXIT=0，过滤 `crates/chips-resource/src`
  合计 **3650/4131 = 88.36%**（对照 C2a-1 在册 89.05%：**-0.69pp**，分母
  +534 行系本波新增通路；`archive.rs 244/317 = 77.0%`（miss 73：换代 rename
  失败臂、重挂失败 `INTERNAL` 臂、`publish_error`/`MemberReader` IO 臂、
  ZIP64 数值越界臂需 GiB 级夹具——均属故障注入/不可达防御臂，夹具成本失配
  未锁测、如实登记）、`journal.rs 159/173 = 91.9%`、`manager.rs 956/1098 =
  87.1%`；<90 维持 TD-002 豁免至 2026-10-19）。

