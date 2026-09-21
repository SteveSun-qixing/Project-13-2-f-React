# chips-resource（段一寻址内核 + 段二 B1：MemoryProvider 挂载与 unicode 触发臂）

薯片平台资源管理器的 Rust 权威 crate：段一交付 `chips-resource://` URI 与作用域解析、
管理器侧权限判定（PathGuard）、资源句柄与租约状态机；段二 B1 随单追加内置
`MemoryProvider` 挂载、写入提交与 FS 操作入口、unicode 触发臂产化（工单042 裁定④）。
权威依据：

- 《06-资源协议规范》§2（URI 语法）、§3（作用域）、§4（权限）、§6（句柄生命周期）、§7（错误码，唯一权威）、§9（安全约束）；
- 《04-资源管理设计》§4（句柄）、§5（解析与权限·管理器侧）、§9（路径安全）、§10（清理与泄漏防护）、§11（核心结构）、§12（默认配置）、§13（约束与规则）；
- 《03-核心接口规范》§7（公开面形状）。

## 基线盘点

- 分支「第五次重构」，基线哈希 `84ddd04d4`；workspace `members = ["crates/*"]` glob 自动吸收，根 `Cargo.toml` 零改动。
- 工程先例对齐 `chips-parser` / `chips-bridge`：`&'static str` 错误码常量 + 码表锁测、强类型错误枚举 + `From<T> for ChipsError` 归一、`#![forbid(unsafe_code)]` `#![warn(missing_docs)]`、逐码集成测试。

## 模块导览

| 模块         | 职责                                                                                                                                                   | 权威条目                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `error`      | 18 个在册 `RESOURCE_*` 错误码常量、`ResourceError` 强类型枚举、`details` 形状、`ChipsError` 归一                                                       | 《06》§7                       |
| `constants`  | 默认限额（8 MiB / 2 GiB / 256 KiB / 64 / 4096 等）与 `ResourceLimits`                                                                                  | 《04》§12、《06》§9.3          |
| `uri`        | 语法解析与归一化（scheme/scope/path/query、External origin、大小写、百分号、punycode、IPv6）                                                           | 《06》§2                       |
| `path_guard` | 解码一次 + NFC + 分段 + 控制字符 + 平台特例 + 长度 + 符号链接根内校验 + Unicode 触发臂（工单042 裁定④，`reason=unicode` 已产化）                       | 《04》§9、《06》§2.4/§9.1      |
| `scope`      | `ScopeKind`/`ScopeRegistration`/`ScopePolicy`/`ScopeRegistry`（含 External 按 origin 惰性注册）                                                        | 《04》§5.2、《06》§3           |
| `session`    | `ResourceSession`/`SessionKind`/会话注册表：派生不扩权、关闭级联                                                                                       | 《04》§11.2、《03》§7.2        |
| `permission` | 作用域×能力面管理器侧在册判定矩阵与 `IPermissionDeniedDetails`（口径：《06.04》§4.3 为协议权威，Platform 任意插件免权限公开只读）                      | 《06》§4、《04》§5.3（已对齐） |
| `provider`   | 在册 `ResourceProvider` trait 与地址模型类型（仅抽象；内置实现见 `memory`，目录/ZIP/HTTP 属段二后续波次）                                              | 《04》§3.1/§3.2                |
| `memory`     | 内置 `MemoryProvider`：运行时内存字节、不落盘、无磁盘缓存；流式/可写如实声明、目录列举不支持                                                           | 《04.03》§3.2/§3.3             |
| `handle`     | `open`/`invalidated`/`released` 三态状态机、句柄表、租约归属与归还、失效订阅、池上限                                                                   | 《04》§4、《06》§6             |
| `manager`    | `ResourceManager` 门面：`resolve` 流水线、`open/stat/read_range/read_chunk/release`、Memory 挂载（`mount_memory`）与写族/FS 操作入口、会话与作用域级联 | 《04》§5.1/§11、《03》§7       |

## 段边界（本段做与不做）

段一做寻址内核。段二 B1（本次随单）起追加：内置 `MemoryProvider` 挂载（`mount_memory`，
《04.03》§3.2/§3.3——运行时内存字节、只读或会话内可写、不落盘、无磁盘缓存）、写入提交面
（`commit_write`）与 FS 操作公开入口（`list_directory` / `delete` / `rename` / `copy` /
`create_directory`，《04.04》§4.9），能力预检在 Manager 层直接返回
`RESOURCE_READ_ONLY` / `RESOURCE_NOT_SUPPORTED`，不透传 Provider；以及工单042 裁定④
unicode 触发臂产化（《06.02》§2.4）。
仍不做：`open_write_stream` 写流提交入口（流式读 `read_chunk` 已在段一；跨 Provider 写流归后续波）、
`file:*`/`resource:*` 能力面接线、Neon 绑定（§11.3）、缓存（§6）、网络两栖（段三）。
`Provider` trait 按《04》§3.2 全量在册定义，未重定义。

## 在册错误码 ↔ 用例对照（段一 + 段二 B1 产生面）

| 错误码                                                   | 段一产生点                                                                                                                                                                                 | 锁测                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `RESOURCE_INVALID_URI`                                   | 语法矩阵：query/fragment/编码/userinfo/origin/scheme 前缀、无路径分隔符的裸 origin                                                                                                         | `src/uri.rs` 单测矩阵 + `tests/uri_syntax_matrix.rs` + `tests/error_code_lock.rs`                                                     |
| `RESOURCE_UNSUPPORTED_SCHEME`                            | `resolve_input` 收到 `file://`、`webdav://`、未知 scheme                                                                                                                                   | `src/uri.rs` + `tests/uri_syntax_matrix.rs`                                                                                           |
| `RESOURCE_PATH_INVALID`                                  | PathGuard 攻击面全量（9 类 reason 中 `absolute/separator/segment/encoding/control/length/platform/symlink` 8 类；第 9 类 `unicode` 亦以本码承载（2026-09-21 主智能体码归属更正），见下行） | `src/path_guard.rs` 单测 + `tests/error_code_lock.rs` 形状锁                                                                          |
| `RESOURCE_PATH_INVALID`（`reason=unicode`）              | Unicode 触发臂（工单042 裁定④，码归属按 2026-09-21 更正落路径族）：百分号解码一次后字节非法 UTF-8、含 U+FFFD 或非字符 U+nFFFE/U+nFFFF（n=1..10）即拒绝；NFC 归一差异不拒绝                 | `src/path_guard.rs` 产化单测 + `tests/error_code_lock.rs::test_unicode_reason_has_production` + `tests/memory_provider.rs` URI 面用例 |
| `RESOURCE_NOT_FOUND`                                     | 作用域未注册；直接请求作用域根（空路径基址）                                                                                                                                               | `src/scope.rs` / `src/manager.rs` 流水线单测                                                                                          |
| `RESOURCE_PERMISSION_DENIED`                             | 判定矩阵拒绝面 + 会话未解析                                                                                                                                                                | `src/permission.rs` / `src/manager.rs` 单测                                                                                           |
| `RESOURCE_TOO_LARGE`                                     | `open` 超过作用域 `max_resource_bytes`                                                                                                                                                     | `src/manager.rs` 单测                                                                                                                 |
| `RESOURCE_BUSY`                                          | 流游标占用期间 `read_range`                                                                                                                                                                | `src/manager.rs` / `src/handle.rs` 单测                                                                                               |
| `RESOURCE_HANDLE_RELEASED`                               | 已释放句柄使用（含 ID 陈旧命中墓碑）                                                                                                                                                       | `src/handle.rs` 单测                                                                                                                  |
| `RESOURCE_HANDLE_INVALIDATED`                            | 已失效句柄读操作                                                                                                                                                                           | `src/handle.rs` / `src/manager.rs` 单测                                                                                               |
| `RESOURCE_POOL_EXHAUSTED`                                | 单插件 64 / 全局 4096 超限（`kind: handles`）                                                                                                                                              | `src/handle.rs` 单测                                                                                                                  |
| `RESOURCE_READ_ONLY`                                     | 只读策略作用域写入能力预检（Manager 层直接返回不透传；Platform/External 由判定矩阵先行以 PERMISSION_DENIED 拒绝，见 findings）+ `supports_write=false` Provider 写预检                     | `src/permission.rs` / `src/manager.rs` 单测                                                                                           |
| `RESOURCE_ALREADY_EXISTS`                                | 作用域 / Provider 重复注册（含 Memory 重复挂载、rename/copy 目标已存在不覆盖）                                                                                                             | `src/scope.rs` / `src/manager.rs` 单测                                                                                                |
| `RESOURCE_INTERNAL`                                      | 兜底：作用域注册项指向未注册 Provider（装配错误，协议层兜底口径《06》§7.2）                                                                                                                | `src/manager.rs` 兜底单测 + `tests/error_code_lock.rs` 形状锁（无 details）                                                           |
| `RESOURCE_NOT_SUPPORTED`                                 | 段二 B1 产化：Memory 目录列举/建目录预检、`delete`/`create_directory`/`rename`/`list` 作用域类别门（Manager 层直接返回，`details{uri,scope,operation}`）                                   | `src/memory.rs` / `src/manager.rs` / `tests/memory_provider.rs` + 锁测                                                                |
| `RESOURCE_CROSS_SCOPE`                                   | 段二 B1 产化：跨作用域 `copy` 且对目标作用域缺写权（`details` 复用 `IPermissionDeniedDetails` 形状）                                                                                       | `src/manager.rs` 单测 + `tests/error_code_lock.rs` 形状锁                                                                             |
| 其余 3 码（`NOT_EMPTY`/`WRITE_FAILED`/`NETWORK_FAILED`） | 本段不产生（依赖真实 FS Provider 与外部代理，段二后续/段三接入）；常量与 `retryable`、HTTP 映射表由 `tests/error_code_lock.rs` 三方锁钉住                                                  | `tests/error_code_lock.rs`                                                                                                            |

## 发现的文档漂移（只登记，未改任何文档）

1. 《04.05》§5.3 Platform 读取要求 `resources:read:platform`，与《06.04》§4.3「Platform 免权限（公开只读）」矛盾。按协议规范 §4.3 实现（免权限），待裁决。已裁定收口（工单042，2026-09-21）。
2. 《04.09》§9.2 示例代码使用 `ChipsError::ResourcePathInvalid(..)` 枚举变体，但《核心接口规范》§3.3 落地的 `chips_core::ChipsError` 是单形结构体（`new/with_details/with_retryable`）。示例与实码不符，实现按实码 API。已裁定收口（工单042，2026-09-21）。
3. 《04.03》§3.2 `ResourceProvider::open_stream` 返回 `ResourceStream`，其形状在全部在册文档中未定义。段一定义为在册流读取抽象 trait（`next_chunk`），待文档补形。已裁定收口（工单042，2026-09-21）。
4. 《06.02》§2.4 `details.reason = unicode` 在全部文档中无触发规则（NFC 归一即通过）。段一保留词表成员但不产生；待补规则。已裁定收口（工单042，2026-09-21）。触发臂实现已于段二 B1 落地（`src/path_guard.rs` Unicode 触发臂小节：解码一次后须合法 UTF-8、不含 U+FFFD 与非字符 U+nFFFE/U+nFFFF（n=1..10），NFC 差异不拒绝；违反 → `RESOURCE_PATH_INVALID` + `details.reason=unicode`；码归属由主智能体 2026-09-21 更正裁定，与《06.07》§7.3 `IResourcePathErrorDetails` 词表归组一致）。
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
  须合法 UTF-8、不含 U+FFFD 与非字符 U+nFFFE/U+nFFFF（n=1..10）；违反 →
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
