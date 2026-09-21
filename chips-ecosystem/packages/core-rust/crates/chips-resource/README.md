# chips-resource（段一：资源寻址内核）

薯片平台资源管理器的 Rust 权威 crate 第一段交付：`chips-resource://` URI 与作用域解析、
管理器侧权限判定（PathGuard）、资源句柄与租约状态机。权威依据：

- 《06-资源协议规范》§2（URI 语法）、§3（作用域）、§4（权限）、§6（句柄生命周期）、§7（错误码，唯一权威）、§9（安全约束）；
- 《04-资源管理设计》§4（句柄）、§5（解析与权限·管理器侧）、§9（路径安全）、§10（清理与泄漏防护）、§11（核心结构）、§12（默认配置）、§13（约束与规则）；
- 《03-核心接口规范》§7（公开面形状）。

## 基线盘点

- 分支「第五次重构」，基线哈希 `84ddd04d4`；workspace `members = ["crates/*"]` glob 自动吸收，根 `Cargo.toml` 零改动。
- 工程先例对齐 `chips-parser` / `chips-bridge`：`&'static str` 错误码常量 + 码表锁测、强类型错误枚举 + `From<T> for ChipsError` 归一、`#![forbid(unsafe_code)]` `#![warn(missing_docs)]`、逐码集成测试。

## 模块导览

| 模块         | 职责                                                                                                   | 权威条目                     |
| ------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `error`      | 18 个在册 `RESOURCE_*` 错误码常量、`ResourceError` 强类型枚举、`details` 形状、`ChipsError` 归一       | 《06》§7                     |
| `constants`  | 默认限额（8 MiB / 2 GiB / 256 KiB / 64 / 4096 等）与 `ResourceLimits`                                  | 《04》§12、《06》§9.3        |
| `uri`        | 语法解析与归一化（scheme/scope/path/query、External origin、大小写、百分号、punycode、IPv6）           | 《06》§2                     |
| `path_guard` | 解码一次 + NFC + 分段 + 控制字符 + 平台特例 + 长度 + 符号链接根内校验                                  | 《04》§9、《06》§2.4/§9.1    |
| `scope`      | `ScopeKind`/`ScopeRegistration`/`ScopePolicy`/`ScopeRegistry`（含 External 按 origin 惰性注册）        | 《04》§5.2、《06》§3         |
| `session`    | `ResourceSession`/`SessionKind`/会话注册表：派生不扩权、关闭级联                                       | 《04》§11.2、《03》§7.2      |
| `permission` | 作用域×能力面管理器侧在册判定矩阵与 `IPermissionDeniedDetails`                                         | 《04》§5.3（口径）、《06》§4 |
| `provider`   | 在册 `ResourceProvider` trait 与地址模型类型（仅抽象，无任何内置实现=段二）                            | 《04》§3.1/§3.2              |
| `handle`     | `open`/`invalidated`/`released` 三态状态机、句柄表、租约归属与归还、失效订阅、池上限                   | 《04》§4、《06》§6           |
| `manager`    | `ResourceManager` 门面：`resolve` 流水线与 `open/stat/read_range/read_chunk/release`、会话与作用域级联 | 《04》§5.1/§11、《03》§7     |

## 段一边界（明确不做）

文件系统抽象层挂载与具体 Provider、缓存（§6）、流式与大文件读取管线（§7）、
`file:*`/`resource:*` 能力面接线、Neon 绑定（§11.3）、写入提交与 FS 操作（§4.8/§4.9=段二/三）。
`commit_write` / `open_write_stream` / `list_directory` / `delete` 等公开面在段一不挂载到
`ResourceManager`；`Provider` trait 按《04》§3.2 全量在册定义，供测试替身实现。

## 在册错误码 ↔ 用例对照（段一产生面）

| 错误码                                                                                 | 段一产生点                                                                                                                        | 锁测                                                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `RESOURCE_INVALID_URI`                                                                 | 语法矩阵：query/fragment/编码/userinfo/origin/scheme 前缀、无路径分隔符的裸 origin                                                | `src/uri.rs` 单测矩阵 + `tests/uri_syntax_matrix.rs` + `tests/error_code_lock.rs` |
| `RESOURCE_UNSUPPORTED_SCHEME`                                                          | `resolve_input` 收到 `file://`、`webdav://`、未知 scheme                                                                          | `src/uri.rs` + `tests/uri_syntax_matrix.rs`                                       |
| `RESOURCE_PATH_INVALID`                                                                | PathGuard 攻击面全量（9 类 reason 中 `absolute/separator/segment/encoding/control/length/platform/symlink` 8 类）                 | `src/path_guard.rs` 单测 + `tests/error_code_lock.rs` 形状锁                      |
| `RESOURCE_NOT_FOUND`                                                                   | 作用域未注册；直接请求作用域根（空路径基址）                                                                                      | `src/scope.rs` / `src/manager.rs` 流水线单测                                      |
| `RESOURCE_PERMISSION_DENIED`                                                           | 判定矩阵拒绝面 + 会话未解析                                                                                                       | `src/permission.rs` / `src/manager.rs` 单测                                       |
| `RESOURCE_TOO_LARGE`                                                                   | `open` 超过作用域 `max_resource_bytes`                                                                                            | `src/manager.rs` 单测                                                             |
| `RESOURCE_BUSY`                                                                        | 流游标占用期间 `read_range`                                                                                                       | `src/manager.rs` / `src/handle.rs` 单测                                           |
| `RESOURCE_HANDLE_RELEASED`                                                             | 已释放句柄使用（含 ID 陈旧命中墓碑）                                                                                              | `src/handle.rs` 单测                                                              |
| `RESOURCE_HANDLE_INVALIDATED`                                                          | 已失效句柄读操作                                                                                                                  | `src/handle.rs` / `src/manager.rs` 单测                                           |
| `RESOURCE_POOL_EXHAUSTED`                                                              | 单插件 64 / 全局 4096 超限（`kind: handles`）                                                                                     | `src/handle.rs` 单测                                                              |
| `RESOURCE_READ_ONLY`                                                                   | 只读策略作用域写入能力预检（Platform/External/归档来源/Document 挂载直写）                                                        | `src/permission.rs` 单测                                                          |
| `RESOURCE_ALREADY_EXISTS`                                                              | 作用域 / Provider 重复注册                                                                                                        | `src/scope.rs` / `src/manager.rs` 单测                                            |
| `RESOURCE_INTERNAL`                                                                    | 兜底：作用域注册项指向未注册 Provider（装配错误，协议层兜底口径《06》§7.2）                                                       | `src/manager.rs` 兜底单测 + `tests/error_code_lock.rs` 形状锁（无 details）       |
| 其余 5 码（`NOT_EMPTY`/`NOT_SUPPORTED`/`CROSS_SCOPE`/`WRITE_FAILED`/`NETWORK_FAILED`） | 段一不产生（依赖 Provider 写路径/外部代理，段二/三接入）；常量与 `retryable`、HTTP 映射表由 `tests/error_code_lock.rs` 三方锁钉住 | `tests/error_code_lock.rs`                                                        |

## 发现的文档漂移（只登记，未改任何文档）

1. 《04.05》§5.3 Platform 读取要求 `resources:read:platform`，与《06.04》§4.3「Platform 免权限（公开只读）」矛盾。按协议规范 §4.3 实现（免权限），待裁决。已裁定收口（工单042，2026-09-21）。
2. 《04.09》§9.2 示例代码使用 `ChipsError::ResourcePathInvalid(..)` 枚举变体，但《核心接口规范》§3.3 落地的 `chips_core::ChipsError` 是单形结构体（`new/with_details/with_retryable`）。示例与实码不符，实现按实码 API。已裁定收口（工单042，2026-09-21）。
3. 《04.03》§3.2 `ResourceProvider::open_stream` 返回 `ResourceStream`，其形状在全部在册文档中未定义。段一定义为在册流读取抽象 trait（`next_chunk`），待文档补形。已裁定收口（工单042，2026-09-21）。
4. 《06.02》§2.4 `details.reason = unicode` 在全部文档中无触发规则（NFC 归一即通过）。段一保留词表成员但不产生；待补规则。已裁定收口（工单042，2026-09-21）。触发臂实现随动归段二波。
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
