# 契约基建与 Rust Host Core 详细任务

## 1. W0 决策与基线

### W0-01 冻结正式架构 ADR

**目标**：把已确认的混合 Shell 与 Rust Core 决策变成可实施、可否决、不歧义的 ADR。

**实施动作**：

1. 记录 Desktop Electron、Mobile Tauri 2、Rust Core、Kotlin/Swift PAL 的决策和责任边界；
2. 记录 Flutter、Capacitor、Node.js Mobile、Desktop Tauri 未采用的原因；
3. 冻结 Desktop Rust Core 为 Electron 管理子进程的部署模型；
4. 冻结“统一 Core 和契约，Shell 按平台择优”原则；
5. 声明不做长期兼容层、双 Kernel 或双公共 API。

**产物**：正式 ADR、架构图、决策日期、适用范围和替代条件。

**完成判据**：公共架构文档只有一个目标口径；搜索 Electron/Capacitor/Tauri/Flutter 时，每处都能区分“当前实现”和“目标决策”。

### W0-02 盘点迁移资产

**目标**：没有遗漏地建立所有实现、契约、插件和发布资产清单。

**实施动作**：扫描顶层仓库、`Chips-Host/packages`、`src/main`、SDK API、脚手架、所有 `manifest.yaml`、社区/个人服务器内置插件、CI、打包与文档；对每个项标注 owner、当前技术、Node/Electron 依赖、目标归属、测试和迁移任务 ID。

**测试**：自动扫描结果与清单双向对比；新增仓库或 manifest 未入清单时 CI 失败。

**完成判据**：所有正式 manifest 和可执行入口都有唯一迁移归属，不使用 `.chips-host-dev` 副本充当源码基线。

### W0-03 TypeScript 行为金标基线

**目标**：为 Rust 重写提供行为证据，不依赖阅读旧实现猜测语义。

**实施动作**：为 route、schema error、card/box/cpk、路径安全、ID、权限、事件顺序、session、安装事务和 module job 建立版本化 corpus；记录输入、输出、错误、日志关键字和事件序列。

**测试**：TypeScript 生成端与固定 corpus 一致；必须包含损坏 ZIP、zip-slip、大包、重复 ID、超时、取消、权限不足和进程中断样本。

**完成判据**：Rust 实现可完全独立消费 corpus，不需运行 TypeScript 代码才知道预期结果。

### W0-04 能力与认证基线

**动作**：对 Desktop/Android/iOS/Web/Headless 的每个 PAL facet 标注 supported/degraded/unsupported；对每个官方插件记录实际 import、权限、surface、媒体、后台、文件和模块依赖。

**产物**：平台 capability matrix、插件 certification matrix、能力不等价说明。

**完成判据**：任何 `runtime.targets.*.supported: true` 都能对应一份自动化认证证据。

## 2. W1 契约单一源

### W1-01 契约源目录

**动作**：建立独立 contract workspace；按 `kernel/bridge/pal/plugin/document/module` 分域；固定 schema dialect、编码、整数范围、时间、二进制、optional/null 和枚举语义。

**测试**：schema meta-validation、重复 ID、循环引用、未封闭 object 和不稳定 map key 检查。

### W1-02 内核契约

**动作**：定义 `RouteDescriptor`、`InvocationEnvelope`、`CallerContext`、`StandardError`、event、deadline、cancel、stream 和 health 契约；为所有错误码指定 owner 和 retryable 语义。

**完成判据**：路由不能脱离 descriptor 注册，任何未列入的错误码都无法通过 CI。

### W1-03 生态契约

**动作**：定义 manifest、runtime target、capability snapshot、`DocumentHandle`、`ResourceHandle`、`SurfaceContext`、plugin session、module provider/job 与安装回执。

**重点**：handle 只含不透明 ID、scope、capabilities、expiry/version，不包含绝对路径；平台不支持是一等语义。

### W1-04 四语言代码生成

**动作**：生成 Rust serde types、TypeScript strict types/validators、Kotlin serialization types、Swift Codable types；所有生成文件带 source hash，禁止手工修改。

**测试**：每种语言对 golden JSON 完成 decode -> encode -> canonical compare；边界数值、Unicode、未知字段与版本字段覆盖。

### W1-05 契约 CI

**动作**：CI 重新生成后检查 diff；同时运行 schema validation、四语言 round-trip、route manifest drift 和破坏性变更检查。

**完成判据**：不再需人工复制 SDK route manifest；任何契约变更都能准确列出受影响生成物和测试。

### W1-06 本地 RPC 与 Bridge envelope

**动作**：冻结 framing、handshake、协议版本、双向身份、request/response/event/stream/cancel、deadline、背压、重连和心跳；大二进制使用 handle/stream，不用 JSON base64 作为主链路。

**测试**：分包/粘包、乱序、断线、重放、伪造 peer、流取消、慢消费者和进程重启。

## 3. W2 Rust Kernel

### W2-01 Rust workspace 边界

**建议 crate**：`chips-contracts`、`chips-kernel`、`chips-pal`、`chips-services`、`chips-plugin-runtime`、`chips-module-runtime`、`chips-rpc`、`chips-host-core`、`chips-headless`。

**动作**：固定 MSRV、feature policy、unsafe policy、dependency/license/advisory gate、format/lint/test/coverage 脚本；禁止 Core crate 依赖 Electron/Tauri/Android/iOS。

### W2-02 Kernel router

**动作**：实现 descriptor registry、精确路由、schema decode/validate、handler dispatch、统一错误、trace ID 和返回编码。

**测试**：重复注册、未知 route、非法 input/output、panic 隔离、并发调用和顺序保证。

### W2-03 调用政策

**动作**：实现 caller context 发放、permission matcher、deadline/timeout、idempotency key、non-idempotent replay window、rate/quota 和审计决策。

**完成判据**：handler 不能在权限、schema 和 deadline 校验前运行；pluginId 不从 payload 取信。

### W2-04 服务注册与生命周期

**动作**：实现依赖图验证、lazy/eager activation、startup rollback、graceful shutdown、health state 和崩溃后错误转移。

**测试**：循环依赖、启动失败、并发首调、停止中新请求、超时退出。

### W2-05 事件、取消与背压

**动作**：实现 scoped subscription、带界 queue、overflow policy、cancel token、stream credit 和 session cleanup。

**完成判据**：慢插件不能无限消耗 Host 内存；session 结束后不存在遗留订阅。

### W2-06 可观测与故障边界

**动作**：实现 structured log、metrics、audit record、trace propagation、panic capture、diagnostic bundle 和敏感字段脱敏。

**测试**：故障注入、上下文链接、脱敏 golden、指标基数限制和日志轮换。

## 4. W3 Rust Services 与 PAL traits

### W3-01 PAL traits

定义 `surface/storage/selection/transfer/association/device/systemUi/background/ipc/offscreenRender/network/credential/crypto/resource` traits，每个 method 有 capability 条件、错误和取消语义。使用 conformance suite 测试所有 adapter。

### W3-02 存储、路径与事务

实现虚拟路径/handle、sandbox root、atomic write、fsync policy、锁、staging、commit/rollback、quota 和崩溃清理。用临时文件系统、故障注入和中断恢复测试。

### W3-03 归档与文档 codecs

实现 ZIP Store、CRC、限制解包、zip-slip/symlink/bomb 拒绝、`.card/.box/.cpk` schema 验证与确定性打包。所有 W0 corpus 与 TypeScript 结果等价。

### W3-04 加密、签名与凭据 ports

实现 CSPRNG、hash、签名验证、信任根、证书链、撤销、key ID 和 credential reference；私钥不进入 Core 持久化明文。

### W3-05 基础服务

实现 config transaction、log store、HTTP policy client、resource metadata/blob/lease、content-type 检测和受控 URL 映射；禁止将 OS path 序列化给插件。

### W3-06 文档编辑会话

实现 card/box open、snapshot、mutation、history、save、checkpoint、conflict、close 和 crash recovery；建立状态机和 round-trip equivalence 测试。

### W3-07 Surface 与系统入口 ports

定义 surface open/focus/close/state、selection open/save/directory、transfer share/open/export、association file/url/share target；平台 adapter 不能改变公共状态机。

### W3-08 离屏、后台和设备 ports

定义 HTML->PDF/image、background job、notification、clipboard、screen、power、network state 等语义；为 Desktop/Mobile/Web/Headless 分别列出真实实现和 unsupported。

## 5. W4 插件与 module runtime

### W4-01 CPK 安装事务

流程固定为 receive -> staging -> size/count/path limits -> manifest/schema -> payload policy -> hash/signature/trust -> permission review -> atomic activate -> receipt/audit；失败必须回滚且不破坏旧版。

### W4-02 Registry 和更新

实现 query/get/enable/disable/update/uninstall、版本单活跃、引用计数、会话排空、失败回退和撤销禁用。

### W4-03 Session、权限和审计

实现 plugin/session/surface/scene 绑定、nonce、权限快照、动态撤销、限频、订阅回收和跨 session 访问拒绝。

### W4-04 Web 插件 loader

实现 app HTML、card/layout ESM descriptor、theme assets 解析；入口 hash、import boundary、CSP profile、origin assignment、load timeout 和 cleanup 一致。

### W4-05 Module ADR

用真实模块样本评估 JS engine 与 Wasm runtime，比较许可证、维护、Android/iOS 政策、包体、冷启动、ESM/Wasm 特性、调试、限额与可中断性；经批准后才新增运行时依赖。

### W4-06 Module sandbox

实现按 provider 隔离的 instance、显式 imports/capabilities、CPU fuel/timeout、memory ceiling、并发、网络/存储配额、取消和 deterministic test mode。

### W4-07 Provider 与 job runtime

实现 list/resolve/invoke、schema validation、sync/async job、progress、cancel、checkpoint/recovery、result handle 和 orphan cleanup。

### W4-08 Host builtin registry

将需要原生/高权限的功能定义为随 Host 签名发布的 builtin capability；它们仍经 Kernel route 调用，不冒充可下载 `.cpk` module。
